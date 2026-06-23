import fs from 'fs/promises';
import { getVersionBumpContext } from './commits';
import {
  getAppPath,
  getBuildNumber,
  getCommitMessage,
  getCommitMessageVersionPrefix,
  getGitTagPrefix,
  getVersionStorageBackend,
  isPathFilterEnabled,
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

type ReleaseAction = 'released' | 'skipped';

const isChangedPathInApp = (changedPath: string, appPath: string): boolean => {
  return changedPath === appPath || changedPath.startsWith(`${appPath}/`);
};

const setVersionOutputs = (
  tools: Toolkit,
  build: Build,
  gitTag: string,
  releaseAction: ReleaseAction,
): void => {
  tools.setOutput('git_tag', gitTag);
  tools.setOutput('version_name', build.name);
  tools.setOutput('version_code', build.code.toString());
  tools.setOutput('release_action', releaseAction);
};

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

      await runCommand('git', ['fetch', '--tags']);

      const commitMessageVersionPrefix = getCommitMessageVersionPrefix(tools);
      const gitTagPrefix = getGitTagPrefix(tools);
      const skipCi = isSkippingCi(tools);
      const buildNumber = getBuildNumber(tools);
      const appPath = getAppPath(tools);
      const pathFilter = isPathFilterEnabled(tools);

      if (pathFilter && !appPath) {
        throw new Error('path_filter requires app_path');
      }

      const versionStorageBackend = getVersionStorageBackend(tools);
      const versionFileExists = await doesVersionPropertiesExist(
        fs,
        versionStorageBackend,
        appPath,
      );

      let build: Build;
      let currentBuild: Build | undefined;
      let versionChanged = true;
      let versionBumpContext:
        | Awaited<ReturnType<typeof getVersionBumpContext>>
        | undefined;

      if (versionFileExists) {
        const existingVersion = await getVersionProperties(
          tools,
          versionStorageBackend,
          appPath,
        );
        currentBuild = getBuildFromVersion(existingVersion);
        versionBumpContext = await getVersionBumpContext(tools);

        build = bumpBuild(
          versionBumpContext.commits,
          existingVersion,
          buildNumber,
        );
      } else {
        // create version 0.0.1 by default in build.gradle if it does not exist
        const defaultBuild: Version = {
          major: 0,
          minor: 0,
          patch: 1,
          build: buildNumber,
        };

        build = getBuildFromVersion(defaultBuild);

        if (pathFilter) {
          versionBumpContext = await getVersionBumpContext(tools);
        }
      }

      if (
        pathFilter &&
        versionBumpContext &&
        !versionBumpContext.changedPaths.some((changedPath) =>
          isChangedPathInApp(changedPath, appPath),
        )
      ) {
        versionChanged = false;
        build = currentBuild ?? build;
      }

      const gitTag = `${gitTagPrefix}${build.name}`;

      if (!versionChanged) {
        setVersionOutputs(tools, build, gitTag, 'skipped');
        tools.exit.success(
          `No changes detected for ${appPath}; version remains ${build.name}.`,
        );

        return;
      }

      const message = getCommitMessage(
        tools,
        build,
        commitMessageVersionPrefix,
        skipCi,
      );

      await setVersionProperties(
        fs,
        tools,
        build.version,
        versionStorageBackend,
        appPath,
      );
      await setGitIdentity(tools);
      await createCommit(tools, message, [
        getVersionStoragePath(versionStorageBackend, appPath),
      ]);
      await pushChanges(tools, gitTag, true);
      setVersionOutputs(tools, build, gitTag, 'released');

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
