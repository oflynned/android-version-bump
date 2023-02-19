import { Toolkit } from 'actions-toolkit';
import fs from 'fs/promises';
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
import { runCommand } from './run';
import { Build, bumpBuild, getBuildFromVersion, Version } from './version';

const main = async () => {
  await Toolkit.run(async (tools): Promise<void> => {
    try {
      console.log('process.env.GITHUB_WORKSPACE', process.env.GITHUB_WORKSPACE);
      console.log('process.env.GITHUB_HEAD_REF', process.env.GITHUB_HEAD_REF);

      await runCommand('git', ['fetch']);
      await runCommand('git', ['checkout', process.env.GITHUB_REF as any]);

      const tagPrefix = getTagPrefix(tools);
      const skipCi = isSkippingCi(tools);
      const buildNumber = getBuildNumber(tools);
      const versionFileExists = await doesVersionPropertiesExist(fs);

      let build: Build;

      if (versionFileExists) {
        const existingVersion = await getVersionProperties(tools);
        const { commits } = tools.context.payload;

        build = bumpBuild(commits ?? [], existingVersion, buildNumber);
      } else {
        // create version 0.0.1 by default in build.gradle if it does not exist
        const defaultBuild: Version = {
          major: 0,
          minor: 0,
          patch: 1,
          build: buildNumber,
        };

        build = getBuildFromVersion(defaultBuild);
      }

      const message = getCommitMessage(tools, build, tagPrefix, skipCi);

      await setVersionProperties(fs, tools, build.version);
      await setGitIdentity(tools);
      await createCommit(tools, message);
      await pushChanges(tools, build.name, true);

      // fixes deprecation warning of ::set-output
      // https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/
      await runCommand('sh', [
        '-c',
        `echo "new_tag=${build.name}" >> $GITHUB_OUTPUT`,
      ]);

      tools.exit.success(
        `Version bumped version to ${build.name} successfully!`,
      );
    } catch (e) {
      tools.log.fatal(e);
      tools.exit.failure('Failed to bump version!');
    }
  });
};

(async () => await main())();
