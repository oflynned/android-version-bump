import { Toolkit } from 'actions-toolkit';
import { spawn } from 'child_process';
import { EOL } from 'os';

export const setGitIdentity = async (toolkit: Toolkit): Promise<void> => {
  const defaultName = 'Automated Version Bump';
  const name = process.env.GITHUB_USER ?? defaultName;
  toolkit.log.log(`Setting git config name to ${name}`);
  await toolkit.exec('git', ['config', 'user.name', name]);

  const defaultEmail = 'android-semantic-release@users.noreply.github.com';
  const email = process.env.GITHUB_EMAIL ?? defaultEmail;
  toolkit.log.log(`Setting git config email to ${email}`);
  await toolkit.exec('git', ['config', 'user.email', email]);
};

export const runCommand = async (
  command: string,
  args: string[],
): Promise<void> => {
  const workspace = process.env.GITHUB_WORKSPACE;

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { cwd: workspace });
    const errorMessages: string[] = [];
    let isDone = false;

    childProcess.on('error', (error) => {
      if (!isDone) {
        isDone = true;
        reject(error);
      }
    });

    childProcess.stderr.on('data', (chunk) => errorMessages.push(chunk));

    childProcess.on('exit', (code) => {
      if (!isDone) {
        if (code === 0) {
          resolve();
        } else {
          reject(
            `${errorMessages.join(
              '',
            )}${EOL}${command} exited with code ${code}`,
          );
        }
      }
    });
  });
};

export const createCommit = async (
  toolkit: Toolkit,
  commit: string,
): Promise<void> => {
  try {
    toolkit.log.log(`Creating version commit`);
    toolkit.log.log({ commit });

    await runCommand('git', ['add', 'version.properties']);
    await runCommand('git', ['commit', '-m', commit]);
  } catch (e) {
    toolkit.log.warn(
      `Commit failed, but this shouldn't be a problem if you are using actions/checkout@v2`,
    );
  }
};

export const pushChanges = async (
  toolkit: Toolkit,
  version: string,
  publishTag?: boolean,
): Promise<void> => {
  const remote = [
    'https://',
    process.env.GITHUB_ACTOR,
    ':',
    process.env.GITHUB_TOKEN,
    '@github.com/',
    process.env.GITHUB_REPOSITORY,
    '.git',
  ].join('');

  if (publishTag) {
    toolkit.log.log('Publishing tag');
    await runCommand('git', ['tag', version]);
    await runCommand('git', ['push', remote, '--follow-tags']);
    await runCommand('git', ['push', remote, '--tags']);
  } else {
    toolkit.log.log('Not publishing tag, pushing instead');
    await runCommand('git', ['push', remote]);
  }
};
