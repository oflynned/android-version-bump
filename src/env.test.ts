import { mock } from 'jest-mock-extended';
import {
  getAppPath,
  getCommitBaseRef,
  getCommitMessage,
  getCommitRange,
  getCommitTagPattern,
  getGitTagPrefix,
  getVersionStorageBackend,
  isPathFilterEnabled,
} from './env';
import { Toolkit } from './toolkit';
import { Build } from './version';

const toolkit = mock<Toolkit>();
const build: Build = {
  version: {
    major: 1,
    minor: 2,
    patch: 3,
  },
  name: '1.2.3',
  code: 123,
};

describe('Env', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getAppPath', () => {
    it('should default to empty string', () => {
      toolkit.inputs['app_path'] = undefined;

      const result = getAppPath(toolkit);

      expect(result).toEqual('');
    });

    it('should normalize configured app path', () => {
      toolkit.inputs['app_path'] = './apps/mobile/';

      const result = getAppPath(toolkit);

      expect(result).toEqual('apps/mobile');
    });

    it('should reject app paths outside the workspace', () => {
      toolkit.inputs['app_path'] = '../mobile';

      expect(() => getAppPath(toolkit)).toThrow('app_path cannot contain ..');
    });
  });

  describe('getCommitRange', () => {
    it('should default to previous-tag', () => {
      toolkit.inputs['commit_range'] = undefined;

      const result = getCommitRange(toolkit);

      expect(result).toEqual('previous-tag');
    });

    it('should return configured commit range', () => {
      toolkit.inputs['commit_range'] = 'base-ref';

      const result = getCommitRange(toolkit);

      expect(result).toEqual('base-ref');
    });

    it('should reject unknown commit ranges', () => {
      toolkit.inputs['commit_range'] = 'everything';

      expect(() => getCommitRange(toolkit)).toThrow(
        'Invalid commit range "everything"',
      );
    });
  });

  describe('getCommitBaseRef', () => {
    it('should default to empty string', () => {
      toolkit.inputs['commit_base_ref'] = undefined;

      const result = getCommitBaseRef(toolkit);

      expect(result).toEqual('');
    });

    it('should return configured commit base ref', () => {
      toolkit.inputs['commit_base_ref'] = 'origin/main';

      const result = getCommitBaseRef(toolkit);

      expect(result).toEqual('origin/main');
    });
  });

  describe('getCommitTagPattern', () => {
    it('should default to any tag', () => {
      toolkit.inputs['commit_tag_pattern'] = undefined;

      const result = getCommitTagPattern(toolkit);

      expect(result).toEqual('*');
    });

    it('should return configured commit tag pattern', () => {
      toolkit.inputs['commit_tag_pattern'] = 'v*';

      const result = getCommitTagPattern(toolkit);

      expect(result).toEqual('v*');
    });

    it('should default to git tag prefix pattern when configured', () => {
      toolkit.inputs['commit_tag_pattern'] = undefined;
      toolkit.inputs['git_tag_prefix'] = 'mobile-v';

      const result = getCommitTagPattern(toolkit);

      expect(result).toEqual('mobile-v*');
    });
  });

  describe('getGitTagPrefix', () => {
    it('should default to empty string', () => {
      toolkit.inputs['git_tag_prefix'] = undefined;

      const result = getGitTagPrefix(toolkit);

      expect(result).toEqual('');
    });

    it('should return configured git tag prefix', () => {
      toolkit.inputs['git_tag_prefix'] = 'mobile-v';

      const result = getGitTagPrefix(toolkit);

      expect(result).toEqual('mobile-v');
    });
  });

  describe('isPathFilterEnabled', () => {
    it('should default to false', () => {
      toolkit.inputs['path_filter'] = undefined;

      const result = isPathFilterEnabled(toolkit);

      expect(result).toEqual(false);
    });

    it('should return true when configured', () => {
      toolkit.inputs['path_filter'] = 'true';

      const result = isPathFilterEnabled(toolkit);

      expect(result).toEqual(true);
    });
  });

  describe('getVersionStorageBackend', () => {
    it('should default to version properties', () => {
      toolkit.inputs['version_storage'] = undefined;

      const result = getVersionStorageBackend(toolkit);

      expect(result).toEqual('version-properties');
    });

    it('should return configured version storage backend', () => {
      toolkit.inputs['version_storage'] = 'gradle-properties';

      const result = getVersionStorageBackend(toolkit);

      expect(result).toEqual('gradle-properties');
    });

    it('should reject unknown version storage backends', () => {
      toolkit.inputs['version_storage'] = 'spreadsheet';

      expect(() => getVersionStorageBackend(toolkit)).toThrow(
        'Invalid version storage backend "spreadsheet"',
      );
    });
  });

  describe('getCommitMessage', () => {
    it('should default message on none set', () => {
      toolkit.inputs['commit_message'] = undefined;

      const result = getCommitMessage(toolkit, build, 'v', false);

      expect(result).toEqual('release: v1.2.3');
    });

    it('should default message on empty string', () => {
      toolkit.inputs['commit_message'] = '';

      const result = getCommitMessage(toolkit, build, 'v', false);

      expect(result).toEqual('release: v1.2.3');
    });

    it('should set message from toolkit set', () => {
      toolkit.inputs['commit_message'] = 'release: new version!';

      const result = getCommitMessage(toolkit, build, 'v', false);

      expect(result).toEqual('release: new version!');
    });

    it('should replace {{version}} with actual version on custom message', () => {
      toolkit.inputs['commit_message'] = 'release: new version {{version}}';

      const result = getCommitMessage(toolkit, build, 'v', false);

      expect(result).toEqual('release: new version v1.2.3');
    });

    it('should allow empty tag prefix', () => {
      toolkit.inputs['commit_message'] = undefined;

      const result = getCommitMessage(toolkit, build, '', false);

      expect(result).toEqual('release: 1.2.3');
    });

    it('should allow ci skip', () => {
      toolkit.inputs['commit_message'] = undefined;

      const result = getCommitMessage(toolkit, build, 'v', true);

      expect(result).toEqual('release: v1.2.3 [skip-ci]');
    });

    it('should allow ci skip on custom message', () => {
      toolkit.inputs['commit_message'] = 'release: new release!';

      const result = getCommitMessage(toolkit, build, 'v', true);

      expect(result).toEqual('release: new release! [skip-ci]');
    });
  });
});
