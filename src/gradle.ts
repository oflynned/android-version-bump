import Fs from 'fs/promises';
import path from 'path';
import type { VersionStorageBackend } from './env';
import { Toolkit } from './toolkit';
import { Version } from './version';

type VersionStorage = {
  path: string;
};

const storageByBackend: Record<VersionStorageBackend, VersionStorage> = {
  'version-properties': {
    path: 'version.properties',
  },
  'gradle-properties': {
    path: 'gradle.properties',
  },
};

const getVersionStorage = (
  backend: VersionStorageBackend = 'version-properties',
): VersionStorage => storageByBackend[backend];

export const getVersionStoragePath = (
  backend: VersionStorageBackend = 'version-properties',
  appPath = '',
): string => {
  const storagePath = getVersionStorage(backend).path;

  return appPath ? path.posix.join(appPath, storagePath) : storagePath;
};

const getProperty = (contents: string, key: string): string | undefined => {
  const matcher = new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm');
  const match = contents.match(matcher);

  return match?.[1];
};

const getIntegerProperty = (contents: string, key: string): number => {
  const value = Number.parseInt(getProperty(contents, key) ?? '0');

  return Number.isNaN(value) ? 0 : value;
};

const getVersionFromProperties = (
  contents: string,
): Pick<Version, 'major' | 'minor' | 'patch'> => {
  return {
    major: getIntegerProperty(contents, 'majorVersion'),
    minor: getIntegerProperty(contents, 'minorVersion'),
    patch: getIntegerProperty(contents, 'patchVersion'),
  };
};

const setProperty = (contents: string, key: string, value: string): string => {
  const matcher = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, 'm');

  if (matcher.test(contents)) {
    return contents.replace(matcher, `$1${value}`);
  }

  return `${contents}${contents.endsWith('\n') || contents.length === 0 ? '' : '\n'}${key}=${value}`;
};

const setProperties = (contents: string, version: Version): string => {
  const versionProperties: Record<string, string> = {
    majorVersion: version.major.toString(),
    minorVersion: version.minor.toString(),
    patchVersion: version.patch.toString(),
    buildNumber: version.build?.toString() ?? '',
  };

  return Object.entries(versionProperties).reduce(
    (nextContents, [key, value]) => setProperty(nextContents, key, value),
    contents,
  );
};

export const doesVersionPropertiesExist = async (
  fs: typeof Fs,
  backend: VersionStorageBackend = 'version-properties',
  appPath = '',
): Promise<boolean> => {
  try {
    const file = await fs.readFile(getVersionStoragePath(backend, appPath));

    return file?.toString().length > 0;
  } catch {
    return false;
  }
};

export const getVersionProperties = async (
  toolkit: Toolkit,
  backend: VersionStorageBackend = 'version-properties',
  appPath = '',
): Promise<Pick<Version, 'major' | 'minor' | 'patch'>> => {
  const file = (
    await toolkit.readFile(getVersionStoragePath(backend, appPath))
  ).toString();

  return getVersionFromProperties(file);
};

export const setVersionProperties = async (
  fs: typeof Fs,
  toolkit: Toolkit,
  version: Version,
  backend: VersionStorageBackend = 'version-properties',
  appPath = '',
): Promise<void> => {
  const path = getVersionStoragePath(backend, appPath);
  let existingContents = '';

  if (backend === 'gradle-properties') {
    try {
      existingContents = (await fs.readFile(path)).toString();
    } catch {
      existingContents = '';
    }
  }

  const contents = setProperties(existingContents, version);

  await fs.writeFile(path, contents);
  toolkit.log.log(contents);
};
