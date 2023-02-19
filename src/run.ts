import { spawn } from 'child_process';
import { EOL } from 'os';

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
