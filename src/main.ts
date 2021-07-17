import { Toolkit } from 'actions-toolkit';
import {
  getCommitMessage,
  getGradleLocation,
  getTagPrefix,
  isSkippingCi,
} from './env';
import { getReleaseVersion, Version } from './version';

Toolkit.run(async (tools): Promise<void> => {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    tools.exit.failure('No GitHub token set in env, cannot continue run');
    return;
  }

  try {
    const gradleLocation = getGradleLocation(tools);
    const gradleFile = tools.readFile(gradleLocation);

    console.log({ gradleFile });

    const tagPrefix = getTagPrefix(tools);
    const skipCi = isSkippingCi(tools);

    // create version 0.0.0 by default in build.gradle

    // fetch the current values
    const fileVersion: Version = {
      major: 1,
      minor: 0,
      patch: 0,
    };

    const { commits } = tools.context.payload;
    const { current, next } = getReleaseVersion(commits ?? [], fileVersion);
    const commitMessage = getCommitMessage(tools, next, tagPrefix, skipCi);

    console.log({ commitMessage });
    console.log({ next });

    tools.exit.success(
      `Version bumped from ${current.name} to ${next.name} successfully!`,
    );
  } catch (e) {
    tools.log.fatal(e);
    tools.exit.failure('Failed to bump version!');
  }
});
