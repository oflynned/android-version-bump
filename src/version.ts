export type Version = {
  major: number;
  minor: number;
  patch: number;
  build?: number;
};

export type Build = {
  version: Version;
  name: string;
  code: number;
};

export type Release = {
  status: Status;
  current: Build;
  next: Build;
};

export type Status = 'MAJOR_BUMP' | 'MINOR_BUMP' | 'PATCH_BUMP';

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

export const getVersionName = ({
  major,
  minor,
  patch,
  build,
}: Version): string => {
  const versionName = `${major}.${minor}.${patch}`;

  return build ? `${versionName}.${build}` : versionName;
};

export const getVersionCode = ({ major, minor, patch }: Version): number => {
  return major * 10000 + minor * 100 + patch;
};

export const getReleaseVersion = (
  commits: string[],
  currentVersion: Version,
  buildNumber?: number,
): Release => {
  const semanticCommits = commits.filter(isSemanticCommit);
  const isMajor = semanticCommits.some(isMajorBump);

  if (isMajor) {
    const next: Version = {
      major: currentVersion.major + 1,
      minor: 0,
      patch: 0,
    };

    if (buildNumber) {
      next.build = buildNumber;
    }

    return {
      status: 'MAJOR_BUMP',
      current: {
        version: currentVersion,
        name: getVersionName(currentVersion),
        code: getVersionCode(currentVersion),
      },
      next: {
        version: next,
        name: getVersionName(next),
        code: getVersionCode(next),
      },
    };
  }

  const isMinor = semanticCommits.some(isMinorBump);

  if (isMinor) {
    const next: Version = {
      major: currentVersion.major,
      minor: currentVersion.minor + 1,
      patch: 0,
    };

    if (buildNumber) {
      next.build = buildNumber;
    }

    return {
      status: 'MINOR_BUMP',
      current: {
        version: currentVersion,
        name: getVersionName(currentVersion),
        code: getVersionCode(currentVersion),
      },
      next: {
        version: next,
        name: getVersionName(next),
        code: getVersionCode(next),
      },
    };
  }

  // bump patch by default
  const next: Version = {
    major: currentVersion.major,
    minor: currentVersion.minor,
    patch: currentVersion.patch + 1,
  };

  if (buildNumber) {
    next.build = buildNumber;
  }

  return {
    status: 'PATCH_BUMP',
    current: {
      version: currentVersion,
      name: getVersionName(currentVersion),
      code: getVersionCode(currentVersion),
    },
    next: {
      version: next,
      name: getVersionName(next),
      code: getVersionCode(next),
    },
  };
};
