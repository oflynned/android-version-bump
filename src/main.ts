import fs from 'fs/promises';
import {
  getBuildNumber,
  getCommitMessage,
  getTagPrefix,
  getVersionStorageBackend,
  isSkippingCi,
} from './env';
import { createCommit, pushChanges, setGitIdentity } from './git';
import {
  doesVersionPropertiesExist,
  getVersionStoragePath,
  getVersionProperties,
  setVersionProperties,
} from './gradle';
import { runCommand } from './run';
import { Toolkit } from './toolkit';
import { Build, bumpBuild, getBuildFromVersion, Version } from './version';

const main = async () => {
  await Toolkit.run(async (tools): Promise<void> => {
    try {
      console.log('process.env.GITHUB_WORKSPACE', process.env.GITHUB_WORKSPACE);
      console.log('process.env.GITHUB_HEAD_REF', process.env.GITHUB_HEAD_REF);

      const workspace = process.env.GITHUB_WORKSPACE;

      if (workspace) {
        await runCommand('git', [
          'config',
          '--global',
          'safe.directory',
          workspace,
        ]);
      }

      const headRef = process.env.GITHUB_HEAD_REF;

      if (headRef) {
        await runCommand('git', ['checkout', headRef]);
      }

      await runCommand('git', ['fetch']);

      const tagPrefix = getTagPrefix(tools);
      const skipCi = isSkippingCi(tools);
      const buildNumber = getBuildNumber(tools);
      const versionStorageBackend = getVersionStorageBackend(tools);
      const versionFileExists = await doesVersionPropertiesExist(
        fs,
        versionStorageBackend,
      );

      let build: Build;

      if (versionFileExists) {
        const existingVersion = await getVersionProperties(
          tools,
          versionStorageBackend,
        );
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

      await setVersionProperties(
        fs,
        tools,
        build.version,
        versionStorageBackend,
      );
      await setGitIdentity(tools);
      await createCommit(tools, message, [
        getVersionStoragePath(versionStorageBackend),
      ]);
      await pushChanges(tools, build.name, true);
      tools.setOutput('new_tag', build.name);
      tools.setOutput('git_tag', build.name);
      tools.setOutput('version_name', build.name);
      tools.setOutput('version_code', build.code.toString());

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
