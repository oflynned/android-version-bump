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

const getDefaultBaseRef = (): string => {
  const baseRef = process.env.GITHUB_BASE_REF;

  if (baseRef) {
    return `origin/${baseRef}`;
  }

  return '';
};

const resolveGitRange = async (
  toolkit: Toolkit,
  commitRange: CommitRange,
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
  commitRange: CommitRange,
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
): Promise<GitVersionBumpContext> => {
  const commitRange = getCommitRange(toolkit);
  const context = await getGitVersionBumpContext(toolkit, commitRange);

  toolkit.log.log(`Reading version bump commits from git ${commitRange} range`);

  return context;
};
