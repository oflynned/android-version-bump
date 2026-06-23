import * as core from '@actions/core';
import * as exec from '@actions/exec';
import fs from 'fs/promises';

const inputNames = [
  'app_path',
  'commit_range',
  'commit_base_ref',
  'commit_tag_pattern',
  'commit_message_version_prefix',
  'git_tag_prefix',
  'path_filter',
  'version_storage',
  'skip_ci',
  'commit_message',
  'build_number',
] as const;

const formatLogValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

export class Toolkit {
  readonly inputs = Object.fromEntries(
    inputNames.map((name) => [name, core.getInput(name) || undefined]),
  ) as Record<string, string | undefined>;

  readonly log = {
    log: (value: unknown): void => core.info(formatLogValue(value)),
    warn: (value: unknown): void => core.warning(formatLogValue(value)),
    fatal: (value: unknown): void =>
      core.error(value instanceof Error ? value : formatLogValue(value)),
  };

  readonly exit = {
    success: (message: string): void => core.info(message),
    failure: (message: string): void => core.setFailed(message),
  };

  static async run(callback: (tools: Toolkit) => Promise<void>): Promise<void> {
    await callback(new Toolkit());
  }

  async exec(command: string, args: string[]): Promise<void> {
    await exec.exec(command, args);
  }

  async readFile(path: string): Promise<Buffer> {
    return fs.readFile(path);
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }
}
