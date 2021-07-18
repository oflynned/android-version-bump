import { Toolkit } from 'actions-toolkit';
import { Version } from './version';

export const doesVersionPropertiesExist = async (
  toolkit: Toolkit,
): Promise<boolean> => {
  try {
    const file = await toolkit.readFile('version.properties');

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
  toolkit: Toolkit,
  { major, minor, patch, build }: Version,
): Promise<void> => {
  await toolkit.exec('touch', ['version.properties']);
  await toolkit.exec('echo', [
    `"majorVersion=${major}"`,
    '>',
    'version.properties',
  ]);
  await toolkit.exec('echo', [
    `"minorVersion=${minor}"`,
    '>>',
    'version.properties',
  ]);
  await toolkit.exec('echo', [
    `"patchVersion=${patch}"`,
    '>>',
    'version.properties',
  ]);

  const buildNumber = build ? `"buildNumber=${build}"` : `"buildNumber="`;
  await toolkit.exec('echo', [buildNumber, '>>', 'version.properties']);

  await toolkit.exec('cat', ['version.properties']);
};
