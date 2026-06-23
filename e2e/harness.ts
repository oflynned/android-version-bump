import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const actionEntryPoint = path.resolve(__dirname, '../dist/index.js');
const realGit = execFileSync('command', ['-v', 'git'], {
  encoding: 'utf8',
  shell: true,
}).trim();

type EventCommit = string | { id: string; message: string };

type FixtureOptions = {
  version?: string;
  commits?: string[];
  eventCommits?: EventCommit[];
  inputs?: Record<string, string>;
  environment?: Record<string, string>;
  headRef?: string;
  rejectPush?: boolean;
  unrelatedFile?: boolean;
};

export type ActionFixture = {
  root: string;
  workspace: string;
  remote: string;
  outputFile: string;
  branch: string;
  triggerSha: string;
  result: ReturnType<typeof spawnSync>;
};

const git = (cwd: string, args: string[]): string =>
  execFileSync(realGit, args, { cwd, encoding: 'utf8' }).trim();

const writeVersion = (workspace: string, version: string): void => {
  const [major, minor, patch] = version.split('.');
  fs.writeFileSync(
    path.join(workspace, 'version.properties'),
    [
      `majorVersion=${major}`,
      `minorVersion=${minor}`,
      `patchVersion=${patch}`,
      'buildNumber=',
    ].join('\n'),
  );
};

const createGitShim = (root: string, remote: string): string => {
  const shimDirectory = path.join(root, 'bin');
  const shim = path.join(shimDirectory, 'git');
  fs.mkdirSync(shimDirectory);
  fs.writeFileSync(
    shim,
    `#!/bin/sh
if [ "$1" = "push" ]; then
  case "$2" in
    https://*@github.com/*.git)
      if [ "\${E2E_REJECT_PUSH:-}" = "1" ]; then
        echo "rejected by e2e git shim" >&2
        exit 1
      fi
      shift 2
      exec "${realGit}" push "${remote}" "$@"
      ;;
  esac
fi
exec "${realGit}" "$@"
`,
    { mode: 0o755 },
  );

  return shimDirectory;
};

export const runActionFixture = (
  options: FixtureOptions = {},
): ActionFixture => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'android-version-bump-'));
  const workspace = path.join(root, 'workspace');
  const remote = path.join(root, 'remote.git');
  const home = path.join(root, 'home');
  const outputFile = path.join(root, 'github-output');
  const eventFile = path.join(root, 'event.json');
  const branch = options.headRef ?? 'main';

  fs.mkdirSync(workspace);
  fs.mkdirSync(home);
  git(root, ['init', '--bare', '--initial-branch=main', remote]);
  git(workspace, ['init', '--initial-branch=main']);
  git(workspace, ['config', 'user.name', 'Fixture Author']);
  git(workspace, ['config', 'user.email', 'fixture@example.com']);
  fs.writeFileSync(path.join(workspace, 'README.md'), 'fixture\n');
  if (options.version) {
    writeVersion(workspace, options.version);
  }
  git(workspace, ['add', '.']);
  git(workspace, ['commit', '-m', 'chore: initial fixture']);
  git(workspace, ['remote', 'add', 'origin', remote]);
  git(workspace, ['push', '-u', 'origin', 'main']);

  if (branch !== 'main') {
    git(workspace, ['checkout', '-b', branch]);
  }

  for (const [index, message] of (options.commits ?? []).entries()) {
    fs.appendFileSync(
      path.join(workspace, 'README.md'),
      `${index}:${message}\n`,
    );
    git(workspace, ['add', 'README.md']);
    git(workspace, ['commit', '-m', message]);
  }

  if (branch !== 'main' || (options.commits?.length ?? 0) > 0) {
    git(workspace, ['push', '-u', 'origin', branch]);
  }
  const triggerSha = git(workspace, ['rev-parse', 'HEAD']);

  if (branch !== 'main') {
    git(workspace, ['checkout', 'main']);
  }
  if (options.unrelatedFile) {
    fs.writeFileSync(path.join(workspace, 'notes.txt'), 'leave me alone\n');
  }

  fs.writeFileSync(
    eventFile,
    JSON.stringify({
      commits: options.eventCommits ?? options.commits ?? [],
    }),
  );
  fs.writeFileSync(outputFile, '');
  const shimDirectory = createGitShim(root, remote);
  const inputEnvironment = Object.fromEntries(
    Object.entries(options.inputs ?? {}).map(([key, value]) => [
      `INPUT_${key.toUpperCase()}`,
      value,
    ]),
  );

  const result = spawnSync(process.execPath, [actionEntryPoint], {
    cwd: workspace,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...inputEnvironment,
      ...options.environment,
      CI: 'true',
      HOME: home,
      PATH: `${shimDirectory}${path.delimiter}${process.env.PATH}`,
      GITHUB_ACTIONS: 'true',
      GITHUB_ACTOR: 'fixture-actor',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_EVENT_PATH: eventFile,
      GITHUB_HEAD_REF: options.headRef ?? '',
      GITHUB_OUTPUT: outputFile,
      GITHUB_REF: `refs/heads/${branch}`,
      GITHUB_REPOSITORY: 'fixture/repository',
      GITHUB_SHA: triggerSha,
      GITHUB_TOKEN: 'fixture-token',
      GITHUB_WORKSPACE: workspace,
      E2E_REJECT_PUSH: options.rejectPush ? '1' : '',
    },
  });

  return {
    root,
    workspace,
    remote,
    outputFile,
    branch,
    triggerSha,
    result,
  };
};

export const cleanupFixture = (fixture: ActionFixture): void => {
  fs.rmSync(fixture.root, { recursive: true, force: true });
};

export const gitInWorkspace = (
  fixture: ActionFixture,
  ...args: string[]
): string => git(fixture.workspace, args);

export const gitInRemote = (
  fixture: ActionFixture,
  ...args: string[]
): string => git(fixture.root, ['--git-dir', fixture.remote, ...args]);

export const readOutput = (fixture: ActionFixture): string => {
  const outputs = readOutputs(fixture);
  const [name, value] = Object.entries(outputs)[0] ?? [];

  return name ? `${name}=${value}` : '';
};

export const readOutputs = (fixture: ActionFixture): Record<string, string> => {
  const contents = fs.readFileSync(fixture.outputFile, 'utf8').trim();

  if (!contents) {
    return {};
  }

  const outputs: Record<string, string> = {};
  const lines = contents.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const [name, delimiter] = line.split('<<');

    if (delimiter) {
      const valueLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index] !== delimiter) {
        valueLines.push(lines[index]);
        index += 1;
      }

      outputs[name] = valueLines.join('\n');
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex > -1) {
      outputs[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
    }
  }

  return outputs;
};
