export type Version = {
  major: number;
  minor: number;
  patch: number;
};

export type Release = {
  status: Status;
  version: {
    current: Version;
    next: Version;
  };
};

export type Status = 'NO_BUMP' | 'MAJOR_BUMP' | 'MINOR_BUMP' | 'PATCH_BUMP';

const getCommitIntent = (message: string): string => {
  const [commitIntent] = message.toLowerCase().split(':');

  return commitIntent;
};

export const isMajorBump = (message: string): boolean => {
  if (message.includes('BREAKING CHANGE')) {
    return true;
  }

  const commitIntent = getCommitIntent(message);
  if (commitIntent.includes('!')) {
    return true;
  }

  const intents = ['major'];

  return intents.some((intent) => commitIntent.startsWith(intent));
};

export const isMinorBump = (message: string): boolean => {
  const intents = ['minor', 'feat'];
  const commitIntent = getCommitIntent(message);

  return intents.some((intent) => commitIntent.startsWith(intent));
};

export const isPatchBump = (message: string): boolean => {
  const intents = [
    'patch',
    'build',
    'chore',
    'ci',
    'docs',
    'fix',
    'perf',
    'refactor',
    'revert',
    'style',
    'test',
  ];

  const commitIntent = getCommitIntent(message);

  return intents.some((intent) => commitIntent.startsWith(intent));
};

export const isSemanticCommit = (message: string): boolean => {
  return /^([a-zA-Z]+)(\(.+\))?(!)?:/.test(message);
};

export const getReleaseVersion = (
  commits: string[],
  currentVersion: Version,
): Release => {
  const semanticCommits = commits.filter(isSemanticCommit);

  if (semanticCommits.length === 0) {
    return {
      version: {
        current: currentVersion,
        next: currentVersion,
      },
      status: 'NO_BUMP',
    };
  }

  const isMajor = semanticCommits.some(isMajorBump);

  if (isMajor) {
    return {
      status: 'MAJOR_BUMP',
      version: {
        current: currentVersion,
        next: {
          major: currentVersion.major + 1,
          minor: 0,
          patch: 0,
        },
      },
    };
  }

  const isMinor = semanticCommits.some(isMinorBump);

  if (isMinor) {
    return {
      version: {
        current: currentVersion,
        next: {
          major: currentVersion.major,
          minor: currentVersion.minor + 1,
          patch: 0,
        },
      },
      status: 'MINOR_BUMP',
    };
  }

  const isPatch = semanticCommits.some(isPatchBump);

  if (isPatch) {
    return {
      version: {
        current: currentVersion,
        next: {
          major: currentVersion.major,
          minor: currentVersion.minor,
          patch: currentVersion.patch + 1,
        },
      },
      status: 'PATCH_BUMP',
    };
  }

  return {
    version: {
      current: currentVersion,
      next: currentVersion,
    },
    status: 'NO_BUMP',
  };
};
