import { spawn } from 'child_process';
import { EOL } from 'os';

const runProcess = async (command: string, args: string[]): Promise<string> => {
  const workspace = process.env.GITHUB_WORKSPACE;

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { cwd: workspace });
    const errorMessages: string[] = [];
    const outputMessages: string[] = [];
    let isDone = false;

    childProcess.on('error', (error) => {
      if (!isDone) {
        isDone = true;
        reject(error);
      }
    });

    childProcess.stderr.on('data', (chunk) => errorMessages.push(chunk));
    childProcess.stdout.on('data', (chunk) => outputMessages.push(chunk));

    childProcess.on('exit', (code) => {
      if (!isDone) {
        if (code === 0) {
          resolve(outputMessages.join(''));
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

export const runCommand = async (
  command: string,
  args: string[],
): Promise<void> => {
  await runProcess(command, args);
};

export const runCommandOutput = async (
  command: string,
  args: string[],
): Promise<string> => {
  return runProcess(command, args);
};
