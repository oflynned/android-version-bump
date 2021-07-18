import { Toolkit } from 'actions-toolkit';
import Fs from 'fs/promises';
import { mock } from 'jest-mock-extended';
import { doesVersionPropertiesExist, getVersionProperties } from './gradle';

const toolkit = mock<Toolkit>();
const fs = mock<typeof Fs>();

describe('Gradle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
  });

  describe('getVersionProperties', () => {
    it('should return parsed version', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return `
          majorVersion=1
          minorVersion=2
          patchVersion=3
          buildNumber=
        `;
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should return 0.0.0 on error', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return `
          majorVersion=
          minorVersion=
          patchVersion=
          buildNumber=
        `;
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });

    it('should parse 10 as integer and not stringified truncation', async () => {
      toolkit.readFile.mockImplementation(async () => {
        return `
          majorVersion=1
          minorVersion=0
          patchVersion=10
          buildNumber=
        `;
      });

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 1,
        minor: 0,
        patch: 10,
      });
    });

    it('should return 0.0.0 on empty file', async () => {
      toolkit.readFile.mockImplementation(async () => '');

      await expect(getVersionProperties(toolkit)).resolves.toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });
  });
});
