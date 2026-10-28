import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { MigrationEventStream } from './MigrationEventStream';

function fakeResponse(options: { writeThrows?: boolean } = {}) {
  const emitter = new EventEmitter();
  const chunks: string[] = [];
  const state = { destroyed: false, writableEnded: false, ended: false };
  const res = Object.assign(emitter, {
    writeHead: () => res,
    flushHeaders: () => undefined,
    write: (chunk: string) => {
      if (options.writeThrows) throw new Error('write after end');
      chunks.push(chunk);
      return true;
    },
    end: () => {
      state.ended = true;
      return res;
    },
  }) as unknown as Response;
  Object.defineProperties(res, {
    destroyed: { get: () => state.destroyed },
    writableEnded: { get: () => state.writableEnded },
  });
  return {
    res,
    chunks,
    state,
    disconnect: () => emitter.emit('close'),
    fail: () => emitter.emit('error', new Error('socket hang up')),
  };
}

function frames(chunks: string[]): Array<{ event: string; data: unknown }> {
  return chunks
    .filter((chunk) => chunk.startsWith('event:'))
    .map((chunk) => {
      const [eventLine, dataLine] = chunk.trim().split('\n');
      return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
    });
}

describe('MigrationEventStream broadcasting', () => {
  it('sends the retry hint on connect, then events and plan changes to every client', () => {
    const stream = new MigrationEventStream();
    const a = fakeResponse();
    const b = fakeResponse();
    stream.addClient(a.res);
    stream.addClient(b.res);
    assert.equal(stream.clientCount, 2);
    assert.equal(a.chunks[0], 'retry: 3000\n\n');

    stream.broadcastEvent('worker.started', { filePath: 'src/a.ts' });
    stream.broadcastPlanChange('task', 'plan-1');
    stream.broadcastPlanChange('reset');

    for (const client of [a, b]) {
      const sent = frames(client.chunks);
      assert.equal(sent.length, 3);
      assert.equal(sent[0].event, 'migration');
      const migration = sent[0].data as { eventName: string; payload: unknown; timestamp: string };
      assert.equal(migration.eventName, 'worker.started');
      assert.deepEqual(migration.payload, { filePath: 'src/a.ts' });
      assert.ok(!Number.isNaN(Date.parse(migration.timestamp)));
      assert.deepEqual(sent[1], { event: 'plan', data: { reason: 'task', planId: 'plan-1' } });
      assert.deepEqual(sent[2], { event: 'plan', data: { reason: 'reset', planId: null } });
    }
    stream.close();
  });

  it('drops clients on disconnect and stops writing to them', () => {
    const stream = new MigrationEventStream();
    const client = fakeResponse();
    stream.addClient(client.res);
    client.disconnect();
    assert.equal(stream.clientCount, 0);

    const before = client.chunks.length;
    stream.broadcastEvent('ignored', {});
    assert.equal(client.chunks.length, before);
    stream.close();
  });

  it('drops clients whose socket errors or whose write throws, without crashing', () => {
    const stream = new MigrationEventStream();
    const errored = fakeResponse();
    const throwing = fakeResponse({ writeThrows: true });
    const healthy = fakeResponse();
    stream.addClient(errored.res);
    stream.addClient(healthy.res);
    errored.fail();
    assert.equal(stream.clientCount, 1);

    // The failing write of the retry hint evicts the client immediately.
    stream.addClient(throwing.res);
    assert.equal(stream.clientCount, 1);

    stream.broadcastEvent('worker.started', {});
    assert.equal(frames(healthy.chunks).length, 1);
    stream.close();
  });

  it('evicts clients that were ended out of band before the next write', () => {
    const stream = new MigrationEventStream();
    const client = fakeResponse();
    stream.addClient(client.res);
    client.state.writableEnded = true;

    stream.broadcastEvent('worker.started', {});
    assert.equal(stream.clientCount, 0);
    assert.equal(frames(client.chunks).length, 0);
    stream.close();
  });

  it('close() ends every client and clears the registry', () => {
    const stream = new MigrationEventStream();
    const a = fakeResponse();
    const b = fakeResponse();
    stream.addClient(a.res);
    stream.addClient(b.res);
    stream.close();
    assert.equal(stream.clientCount, 0);
    assert.ok(a.state.ended && b.state.ended);
  });
});

describe('MigrationEventStream heartbeat', () => {
  it('runs only while clients are connected and is cleared on close', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const stream = new MigrationEventStream(1_000);
    assert.equal(stream.isHeartbeatActive, false);

    const client = fakeResponse();
    stream.addClient(client.res);
    assert.equal(stream.isHeartbeatActive, true);

    t.mock.timers.tick(2_000);
    assert.deepEqual(client.chunks.filter((c) => c === ': heartbeat\n\n').length, 2);

    client.disconnect();
    assert.equal(stream.isHeartbeatActive, false);
    t.mock.timers.tick(5_000);
    assert.equal(client.chunks.filter((c) => c === ': heartbeat\n\n').length, 2);

    stream.addClient(fakeResponse().res);
    assert.equal(stream.isHeartbeatActive, true);
    stream.close();
    assert.equal(stream.isHeartbeatActive, false);
  });

  it('does not stop the heartbeat while other clients remain', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const stream = new MigrationEventStream(1_000);
    const a = fakeResponse();
    const b = fakeResponse();
    stream.addClient(a.res);
    stream.addClient(b.res);
    a.disconnect();
    assert.equal(stream.isHeartbeatActive, true);

    t.mock.timers.tick(1_000);
    assert.equal(b.chunks.filter((c) => c === ': heartbeat\n\n').length, 1);
    stream.close();
  });
});
