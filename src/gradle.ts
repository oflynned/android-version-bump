import { Toolkit } from 'actions-toolkit';
import Fs from 'fs/promises';
import { Version } from './version';

export const doesVersionPropertiesExist = async (
  fs: typeof Fs,
): Promise<boolean> => {
  try {
    const file = await fs.readFile('version.properties');

    return file?.toString().length > 0;
  } catch (e) {
    return false;
  }
};

export const getVersionProperties = async (
  toolkit: Toolkit,
): Promise<Pick<Version, 'major' | 'minor' | 'patch'>> => {
  const file = (await toolkit.readFile('version.properties')).toString();
  const major = file.match(/(majorVersion=)(\d)/);
  const minor = file.match(/(minorVersion=)(\d)/);
  const patch = file.match(/(patchVersion=)(\d)/);

  return {
    major: major && major.length > 1 ? Number.parseInt(major[2]) : 0,
    minor: minor && minor.length > 1 ? Number.parseInt(minor[2]) : 0,
    patch: patch && patch.length > 1 ? Number.parseInt(patch[2]) : 0,
  };
};

export const setVersionProperties = async (
  fs: typeof Fs,
  toolkit: Toolkit,
  { major, minor, patch, build }: Version,
): Promise<void> => {
  const contents = [
    `majorVersion=${major}`,
    `minorVersion=${minor}`,
    `patchVersion=${patch}`,
    `buildNumber=${build ?? ''}`,
  ].join('\n');

  await fs.writeFile('version.properties', contents);

  await toolkit.exec('cat', ['version.properties']);
};
