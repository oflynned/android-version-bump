import * as core from '@actions/core';
import { getReleaseVersion, Version } from './version';

const defaultGradleLocation = 'app/build.gradle';

async function run(): Promise<void> {
  try {
    const gradleLocation =
      core.getInput('gradle-location') ?? defaultGradleLocation;
    const buildGradleDirectory = `${process.env.GITHUB_WORKSPACE}/${gradleLocation}`;

    const tagPrefix = core.getInput('tag-prefix') ?? '';
    const skipCi = core.getInput('skip-ci') === 'true';
    const commitMessage = core.getInput('commit-message');

    const currentVersion: Version = {
      major: 1,
      minor: 0,
      patch: 0,
    };
    const commits: string[] = [];

    const { isReleasable, version } = getReleaseVersion(
      commits,
      currentVersion,
    );

    if (!isReleasable) {
    }

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
