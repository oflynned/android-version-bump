export type Version = {
  major: number;
  minor: number;
  patch: number;
};

export type Release = {
  version: Version;
  isReleasable: boolean;
};

export const isMajorBump = (message: string): boolean => {
  if (message.includes('BREAKING CHANGE')) {
    return true;
  }

  const [intent] = message.split(':');

  return message.startsWith(intent) && intent.includes('!');
};

export const isMinorBump = (message: string): boolean => {
  return message.toLowerCase().startsWith('feat');
};

export const isPatchBump = (message: string): boolean => {
  const intents = [
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
  const lowerCaseMessage = message.toLowerCase();

  return intents.some((intent) => lowerCaseMessage.startsWith(intent));
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
      isReleasable: false,
      version: currentVersion,
    };
  }

  const isMajor = semanticCommits.some(isMajorBump);

  if (isMajor) {
    return {
      isReleasable: true,
      version: {
        major: currentVersion.major + 1,
        minor: 0,
        patch: 0,
      },
    };
  }

  const isMinor = semanticCommits.some(isMinorBump);

  if (isMinor) {
    return {
      isReleasable: true,
      version: {
        major: currentVersion.major,
        minor: currentVersion.minor + 1,
        patch: 0,
      },
    };
  }

  const isPatch = semanticCommits.some(isPatchBump);

  if (isPatch) {
    return {
      isReleasable: true,
      version: {
        major: currentVersion.major,
        minor: currentVersion.minor,
        patch: currentVersion.patch + 1,
      },
    };
  }

  return {
    isReleasable: false,
    version: currentVersion,
  };
};
