import Fs from 'fs/promises';
import { mock } from 'jest-mock-extended';
import {
  doesVersionPropertiesExist,
  getVersionStoragePath,
  getVersionProperties,
  setVersionProperties,
} from './gradle';
import { Toolkit } from './toolkit';

const toolkit = mock<Toolkit>();
const fs = mock<typeof Fs>();
const toolkitWithLog = {
  ...toolkit,
  log: {
    log: jest.fn(),
    warn: jest.fn(),
    fatal: jest.fn(),
  },
} as unknown as Toolkit;

describe('Gradle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getVersionStoragePath', () => {
    it('should return root storage path by default', () => {
      expect(getVersionStoragePath()).toEqual('version.properties');
    });

    it('should scope storage path under app path', () => {
      expect(getVersionStoragePath('gradle-properties', 'apps/mobile')).toEqual(
        'apps/mobile/gradle.properties',
      );
    });
  });

  describe('doesVersionPropertiesExist', () => {
    it('should return false on exception', async () => {
      fs.readFile.mockImplementation(async () => {
        throw new Error();
      });

      await expect(doesVersionPropertiesExist(fs)).resolves.toBeFalsy();
    });

    it('should return false on empty file', async () => {
      fs.readFile.mockImplementation(async () => '');

      await expect(doesVersionPropertiesExist(fs)).resolves.toBeFalsy();
    });

    it('should return true on file containing text', async () => {
      fs.readFile.mockImplementation(async () => 'majorVersion=1');

      await expect(doesVersionPropertiesExist(fs)).resolves.toBeTruthy();
    });

    it('should read gradle.properties when configured', async () => {
      fs.readFile.mockImplementation(async () => 'majorVersion=1');

      await expect(
        doesVersionPropertiesExist(fs, 'gradle-properties'),
      ).resolves.toBeTruthy();
      expect(fs.readFile).toHaveBeenCalledWith('gradle.properties');
    });

    it('should read storage under app path when configured', async () => {
      fs.readFile.mockImplementation(async () => 'majorVersion=1');

      await expect(
        doesVersionPropertiesExist(fs, 'version-properties', 'apps/mobile'),
      ).resolves.toBeTruthy();
      expect(fs.readFile).toHaveBeenCalledWith(
        'apps/mobile/version.properties',
      );
    });
  });

  describe('getVersionProperties', () => {
    it('should return parsed version', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return Buffer.from(`
          majorVersion=1
          minorVersion=2
          patchVersion=3
          buildNumber=
        `);
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should return parsed gradle.properties version', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return Buffer.from(`
          org.gradle.jvmargs=-Xmx2g
          majorVersion=4
          minorVersion=5
          patchVersion=6
          buildNumber=
        `);
      });

      await expect(
        getVersionProperties(toolkit, 'gradle-properties'),
      ).resolves.toEqual({
        major: 4,
        minor: 5,
        patch: 6,
      });
      expect(toolkit.readFile).toHaveBeenCalledWith('gradle.properties');
    });

    it('should return parsed version from app path', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return Buffer.from(`
          majorVersion=7
          minorVersion=8
          patchVersion=9
          buildNumber=
        `);
      });

      await expect(
        getVersionProperties(toolkit, 'version-properties', 'apps/mobile'),
      ).resolves.toEqual({
        major: 7,
        minor: 8,
        patch: 9,
      });
      expect(toolkit.readFile).toHaveBeenCalledWith(
        'apps/mobile/version.properties',
      );
    });

    it('should return 0.0.0 on error', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return Buffer.from(`
          majorVersion=
          minorVersion=
          patchVersion=
          buildNumber=
        `);
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });

    it('should parse 10 as integer and not stringified truncation', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return Buffer.from(`
          majorVersion=1
          minorVersion=0
          patchVersion=10
          buildNumber=
        `);
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 1,
        minor: 0,
        patch: 10,
      });
    });

    it('should return 0.0.0 on empty file', async () => {
      toolkit.readFile.mockImplementation(async () => Buffer.from(''));

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });
  });

  describe('setVersionProperties', () => {
    it('should write version.properties by default', async () => {
      await setVersionProperties(fs, toolkitWithLog, {
        major: 1,
        minor: 2,
        patch: 3,
        build: 4,
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        'version.properties',
        [
          'majorVersion=1',
          'minorVersion=2',
          'patchVersion=3',
          'buildNumber=4',
        ].join('\n'),
      );
    });

    it('should preserve unrelated gradle.properties values when writing', async () => {
      fs.readFile.mockImplementation(async () => {
        return [
          'org.gradle.jvmargs=-Xmx2g',
          'majorVersion=1',
          'minorVersion=2',
          'patchVersion=3',
          'buildNumber=',
        ].join('\n');
      });

      await setVersionProperties(
        fs,
        toolkitWithLog,
        {
          major: 2,
          minor: 0,
          patch: 0,
          build: '42',
        },
        'gradle-properties',
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        'gradle.properties',
        [
          'org.gradle.jvmargs=-Xmx2g',
          'majorVersion=2',
          'minorVersion=0',
          'patchVersion=0',
          'buildNumber=42',
        ].join('\n'),
      );
    });

    it('should write version properties under app path', async () => {
      await setVersionProperties(
        fs,
        toolkitWithLog,
        {
          major: 3,
          minor: 2,
          patch: 1,
        },
        'version-properties',
        'apps/mobile',
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        'apps/mobile/version.properties',
        [
          'majorVersion=3',
          'minorVersion=2',
          'patchVersion=1',
          'buildNumber=',
        ].join('\n'),
      );
    });
  });
});
