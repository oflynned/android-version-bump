import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    const buildGradleDirectory = `${process.env.GITHUB_WORKSPACE}/app/build.gradle`;
    const tagPrefix = core.getInput('tag-prefix') ?? '';
    const skipTag = core.getInput('skip-tag') === 'true';
    const commitMessage = core.getInput('commit-message');

    //
    // core.debug(`Waiting ${ms} milliseconds ...`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    //
    // core.debug(new Date().toTimeString());
    // await wait(parseInt(ms, 10));
    // core.debug(new Date().toTimeString());
    //
    // core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
