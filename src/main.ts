import { Toolkit } from 'actions-toolkit';
import {
  getBuildNumber,
  getCommitMessage,
  getTagPrefix,
  isSkippingCi,
} from './env';
import { createCommit, pushChanges, setGitIdentity } from './git';
import {
  doesVersionPropertiesExist,
  getVersionProperties,
  setVersionProperties,
} from './gradle';
import { Build, bumpBuild, getBuildFromVersion, Version } from './version';

Toolkit.run(async (tools): Promise<void> => {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    tools.exit.failure('No GitHub token set in env, cannot continue run');
    return;
  }

  try {
    const tagPrefix = getTagPrefix(tools);
    const skipCi = isSkippingCi(tools);
    const buildNumber = getBuildNumber(tools);

    const versionFileExists = await doesVersionPropertiesExist(tools);
    let build: Build;

    if (versionFileExists) {
      const existingVersion = await getVersionProperties(tools);
      const { commits } = tools.context.payload;

      build = bumpBuild(commits ?? [], existingVersion, buildNumber);
    } else {
      // create version 0.0.1 by default in build.gradle if not exists
      const defaultBuild: Version = {
        major: 0,
        minor: 0,
        patch: 1,
        build: buildNumber,
      };

      build = getBuildFromVersion(defaultBuild);
    }

    const message = getCommitMessage(tools, build, tagPrefix, skipCi);

    await setVersionProperties(tools, build.version);
    await setGitIdentity(tools);
    await createCommit(tools, message);
    await pushChanges(tools, build.name);

    tools.exit.success(`Version bumped from to ${build.name} successfully!`);
  } catch (e) {
    tools.log.fatal(e);
    tools.exit.failure('Failed to bump version!');
  }
});
