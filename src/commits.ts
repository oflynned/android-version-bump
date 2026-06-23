import {
  CommitRange,
  getCommitBaseRef,
  getCommitRange,
  getCommitTagPattern,
} from './env';
import { runCommandOutput } from './run';
import { Toolkit } from './toolkit';
import { Commit } from './version';

const commitSeparator = '\0';

type GitVersionBumpContext = {
  commits: Commit[];
  changedPaths: string[];
};

const parseGitLog = (output: string): string[] => {
  return output
    .split(commitSeparator)
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
};

const parseChangedPaths = (output: string): string[] => {
  return Array.from(
    new Set(
      output
        .split('\n')
        .map((changedPath) => changedPath.trim())
        .filter((changedPath) => changedPath.length > 0),
    ),
  );
};

const getPayloadCommits = (toolkit: Toolkit): Commit[] => {
  return toolkit.context.payload.commits ?? [];
};

const getDefaultBaseRef = (): string => {
  const baseRef = process.env.GITHUB_BASE_REF;

  if (baseRef) {
    return `origin/${baseRef}`;
  }

  return '';
};

const resolveGitRange = async (
  toolkit: Toolkit,
  commitRange: Exclude<CommitRange, 'payload'>,
): Promise<string> => {
  if (commitRange === 'base-ref') {
    const baseRef = getCommitBaseRef(toolkit) || getDefaultBaseRef();

    if (!baseRef) {
      throw new Error(
        'commit_range base-ref requires commit_base_ref or GITHUB_BASE_REF',
      );
    }

    return `${baseRef}..HEAD`;
  }

  const tagPattern = getCommitTagPattern(toolkit);
  const previousTag = (
    await runCommandOutput('git', [
      'describe',
      '--tags',
      '--abbrev=0',
      '--match',
      tagPattern,
    ])
  ).trim();

  return `${previousTag}..HEAD`;
};

const getGitVersionBumpContext = async (
  toolkit: Toolkit,
  commitRange: Exclude<CommitRange, 'payload'>,
): Promise<GitVersionBumpContext> => {
  let range: string | undefined;

  try {
    range = await resolveGitRange(toolkit, commitRange);
  } catch (error) {
    if (commitRange === 'previous-tag') {
      toolkit.log.warn(
        `No previous tag matched ${getCommitTagPattern(
          toolkit,
        )}; reading all reachable commits`,
      );
    } else {
      throw error;
    }
  }

  const commitArgs = ['log', '--format=%B%x00'];
  const pathArgs = ['log', '--name-only', '--format='];

  if (range) {
    commitArgs.push(range);
    pathArgs.push(range);
  }

  const [commits, changedPaths] = await Promise.all([
    runCommandOutput('git', commitArgs),
    runCommandOutput('git', pathArgs),
  ]);

  return {
    commits: parseGitLog(commits),
    changedPaths: parseChangedPaths(changedPaths),
  };
};

export const getVersionBumpContext = async (
  toolkit: Toolkit,
  allowPayloadFallback = true,
): Promise<GitVersionBumpContext> => {
  const commitRange = getCommitRange(toolkit);

  if (commitRange === 'payload') {
    toolkit.log.log('Reading version bump commits from GitHub event payload');

    return {
      commits: getPayloadCommits(toolkit),
      changedPaths: [],
    };
  }

  try {
    const context = await getGitVersionBumpContext(toolkit, commitRange);

    if (context.commits.length > 0) {
      toolkit.log.log(
        `Reading version bump commits from git ${commitRange} range`,
      );

      return context;
    }

    if (allowPayloadFallback) {
      toolkit.log.warn(
        `Git ${commitRange} range did not contain commits; falling back to GitHub event payload`,
      );
    }
  } catch (error) {
    if (!allowPayloadFallback) {
      throw error;
    }

    toolkit.log.warn(
      `Could not read git ${commitRange} range; falling back to GitHub event payload`,
    );
    toolkit.log.warn(error);
  }

  if (allowPayloadFallback) {
    return {
      commits: getPayloadCommits(toolkit),
      changedPaths: [],
    };
  }

  return {
    commits: [],
    changedPaths: [],
  };
};

export const getCommitsForVersionBump = async (
  toolkit: Toolkit,
): Promise<Commit[]> => {
  const { commits } = await getVersionBumpContext(toolkit);

  return commits;
};
