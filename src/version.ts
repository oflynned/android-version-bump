export type Version = {
  major: number;
  minor: number;
  patch: number;
  build?: number | string;
};

export type Build = {
  version: Version;
  name: string;
  code: number;
};

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

export const getBuildFromVersion = (version: Version): Build => {
  return {
    version,
    name: getVersionName(version),
    code: getVersionCode(version),
  };
};

export const bumpBuild = (
  commits: string[],
  currentVersion: Version,
  buildNumber?: string | number,
): Build => {
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
      version: next,
      name: getVersionName(next),
      code: getVersionCode(next),
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
      version: next,
      name: getVersionName(next),
      code: getVersionCode(next),
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
    version: next,
    name: getVersionName(next),
    code: getVersionCode(next),
  };
};
