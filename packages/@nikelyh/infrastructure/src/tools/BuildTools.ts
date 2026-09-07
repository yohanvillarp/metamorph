import { Tool } from '@mozaik-ai/core';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ShadowCommandResult {
  ok: boolean;
  output: string;
}

export async function runInShadowWorkspace(
  shadowBase: string,
  command: string,
  onChunk?: (text: string) => void,
): Promise<ShadowCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: shadowBase,
      shell: true,
      env: {
        ...process.env,
        CI: 'true',
        NPM_CONFIG_WORKSPACES: 'false',
        NPM_CONFIG_FUND: 'false',
        NPM_CONFIG_AUDIT: 'false',
        npm_config_progress: 'false',
      },
    });

    let output = '';
    const append = (buf: Buffer) => {
      const text = buf.toString('utf-8');
      output += text;
      onChunk?.(text);
    };

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        ok: false,
        output: `${output}\nCommand timed out after 5 minutes: ${command}`,
      });
    }, 300000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, output: `${output}\n${error.message}` });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, output: output.trim() });
    });
  });
}

export function parseImplicatedFiles(output: string, shadowPath: string): string[] {
  const found = new Set<string>();
  const root = path.resolve(shadowPath);
  const ext = String.raw`tsx|ts|jsx|js|mjs|cjs|css`;
  const patterns = [
    new RegExp(String.raw`(?:^|[\s'"(\`])((?:\.{1,2}[\\/])?[^\s:'"()<>]+\.(?:${ext}))`, 'g'),
    new RegExp(String.raw`\b([A-Za-z]:[\\/][^\s'"()<>]+\.(?:${ext}))`, 'g'),
  ];

  const consider = (raw: string) => {
    const stripped = raw.replace(/[\\/]+$/, '').replace(/:[\d]+(?::[\d]+)?$/, '');
    const abs = /^[A-Za-z]:[\\/]/.test(stripped) || path.isAbsolute(stripped)
      ? stripped
      : path.join(shadowPath, stripped.replace(/^\.[\\/]/, ''));
    const resolved = path.resolve(abs);
    const inside = resolved === root || resolved.startsWith(root + path.sep);
    if (!inside) return;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) found.add(resolved);
  };

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(output)) !== null) consider(match[1]);
  }
  return [...found];
}

export const createRunBuildTool = (shadowBase: string): Tool => ({
  type: 'function',
  name: 'run_project_build',
  description: 'Runs a command (typically "npm install" or "npm run build") in the shadow workspace for this migration run. Never runs against the user\'s original tree.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to run. Use "npm install" then "npm run build".',
      }
    },
    required: ['command'],
  },
  strict: true,
  invoke: async (args: Record<string, any>) => {
    const result = await runInShadowWorkspace(shadowBase, args.command || 'npm run build', (chunk) => {
      process.stdout.write(chunk);
    });
    return result.ok
      ? `Build Output:\n${result.output}`
      : `Build Failed!\n${result.output}`;
  },
});
