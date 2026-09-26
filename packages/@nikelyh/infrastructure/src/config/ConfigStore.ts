import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  DEFAULT_METAMORPH_CONFIG,
  MetamorphConfig,
} from '@nikelyh/domain';

export const CONFIG_FILE_NAME = '.metamorphrc.json';

export interface ResolveConfigOptions {
  cwd?: string;
  cliFlags?: Partial<MetamorphConfig>;
  env?: NodeJS.ProcessEnv;
}

export class ConfigStore {
  /**
   * Retrieves the absolute path to the local or global configuration file.
   */
  static getConfigPath(isGlobal = false, cwd: string = process.cwd()): string {
    return isGlobal
      ? path.join(os.homedir(), CONFIG_FILE_NAME)
      : path.join(cwd, CONFIG_FILE_NAME);
  }

  /**
   * Reads a JSON configuration file safely.
   */
  private static readConfigFile(filePath: string): Partial<MetamorphConfig> | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Partial<MetamorphConfig>;
    } catch {
      return null;
    }
  }

  /**
   * Writes a JSON configuration file safely, creating parent folders if necessary.
   */
  private static writeConfigFile(filePath: string, config: Partial<MetamorphConfig>): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Reads the local configuration file (.metamorphrc.json) from the target directory.
   */
  static loadLocalConfig(cwd: string = process.cwd()): Partial<MetamorphConfig> | null {
    return this.readConfigFile(this.getConfigPath(false, cwd));
  }

  /**
   * Reads the global configuration file (~/.metamorphrc.json) from the user's home directory.
   */
  static loadGlobalConfig(): Partial<MetamorphConfig> | null {
    return this.readConfigFile(this.getConfigPath(true));
  }

  /**
   * Persists a key-value update into the local configuration file.
   */
  static saveLocalConfig(config: Partial<MetamorphConfig>, cwd: string = process.cwd()): void {
    const existing = this.loadLocalConfig(cwd) || {};
    const updated = { ...existing, ...config };
    this.writeConfigFile(this.getConfigPath(false, cwd), updated);
  }

  /**
   * Persists a key-value update into the global configuration file.
   */
  static saveGlobalConfig(config: Partial<MetamorphConfig>): void {
    const existing = this.loadGlobalConfig() || {};
    const updated = { ...existing, ...config };
    this.writeConfigFile(this.getConfigPath(true), updated);
  }

  /**
   * Extracts environment variable configurations if present.
   */
  static loadEnvConfig(env: NodeJS.ProcessEnv = process.env): Partial<MetamorphConfig> {
    const envConfig: Partial<MetamorphConfig> = {};

    if (env.METAMORPH_MODEL) {
      envConfig.model = env.METAMORPH_MODEL;
    }
    if (env.METAMORPH_REVIEWER_MODEL) {
      envConfig.reviewerModel = env.METAMORPH_REVIEWER_MODEL;
    }
    if (env.METAMORPH_CONCURRENCY) {
      const parsed = parseInt(env.METAMORPH_CONCURRENCY, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        envConfig.concurrency = parsed;
      }
    }
    if (env.METAMORPH_INFERENCE_TIMEOUT_MS) {
      const parsed = parseInt(env.METAMORPH_INFERENCE_TIMEOUT_MS, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        envConfig.inferenceTimeoutMs = parsed;
      }
    }
    if (env.METAMORPH_MAX_RETRIES) {
      const parsed = parseInt(env.METAMORPH_MAX_RETRIES, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        envConfig.maxRetries = parsed;
      }
    }
    if (env.METAMORPH_INTEGRATION_ROUNDS) {
      const parsed = parseInt(env.METAMORPH_INTEGRATION_ROUNDS, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        envConfig.maxIntegrationRounds = parsed;
      }
    }

    return envConfig;
  }

  /**
   * Resolves the final effective MetamorphConfig applying the cascading precedence:
   * CLI Flags > Environment Variables > Local Config > Global Config > Defaults.
   */
  static resolveConfig(options: ResolveConfigOptions = {}): MetamorphConfig {
    const cwd = options.cwd || process.cwd();
    const globalConfig = this.loadGlobalConfig() || {};
    const localConfig = this.loadLocalConfig(cwd) || {};
    const envConfig = this.loadEnvConfig(options.env || process.env);
    const cliFlags = options.cliFlags || {};

    // Remove undefined values from partial configs
    const clean = (obj: Record<string, unknown>) => {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined && v !== null) {
          res[k] = v;
        }
      }
      return res;
    };

    const merged = {
      ...DEFAULT_METAMORPH_CONFIG,
      ...clean(globalConfig as Record<string, unknown>),
      ...clean(localConfig as Record<string, unknown>),
      ...clean(envConfig as Record<string, unknown>),
      ...clean(cliFlags as Record<string, unknown>),
    };

    return merged as MetamorphConfig;
  }
}
