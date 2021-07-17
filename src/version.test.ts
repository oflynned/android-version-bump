import {
  bumpBuild,
  isMajorBump,
  isMinorBump,
  isPatchBump,
  isSemanticCommit,
  Version,
} from './version';

const currentVersion: Version = { major: 1, minor: 2, patch: 3 };

describe('version', () => {
  describe('isMajorBump', () => {
    it('should return true when the commit message contains an uppercase breaking change', () => {
      expect(
        isMajorBump('chore: BREAKING CHANGE removed support for node 10'),
      ).toBeTruthy();
    });

    it('should return false when message does not contain an intent', () => {
      expect(isMajorBump('chore removed support for node 10')).toBeFalsy();
    });

    it('should return false when intent does not exist', () => {
      expect(isMajorBump('removed support for : character')).toBeFalsy();
    });

    it('should return true when message contain an exclamation mark', () => {
      expect(isMajorBump('chore!: removed support for node 10')).toBeTruthy();
    });

    it('should return true when message starts with major', () => {
      expect(isMajorBump('major: removed support for node 10')).toBeTruthy();
    });

    it('should return true when message is uppercase', () => {
      expect(
        isMajorBump('BREAKING CHANGE: removed support for node 10'),
      ).toBeTruthy();
    });

    it('should return true when message contains brackets', () => {
      expect(
        isMajorBump('feat(node): BREAKING CHANGE removed support for node 10'),
      ).toBeTruthy();
    });

    it('should return false if post intent clause contains an exclamation mark, but the intent does not', () => {
      expect(isMajorBump('chore: did something!')).toBeFalsy();
    });

    it('should return false otherwise', () => {
      expect(isMajorBump('chore: did something')).toBeFalsy();
    });
  });

  describe('isMinorBump', () => {
    it('should return true for feat', () => {
      expect(isMinorBump('feat: add user login')).toBeTruthy();
    });

    it('should return true for minor', () => {
      expect(isMinorBump('minor: add user login')).toBeTruthy();
    });

    it('should return true for feat when capitalised', () => {
      expect(isMinorBump('FEAT: add user login')).toBeTruthy();
    });

    it('should return true for feat when containing brackets', () => {
      expect(
        isMinorBump('feat(registration flow): add user login'),
      ).toBeTruthy();
    });

    it('should return false otherwise', () => {
      expect(isMinorBump('chore: add user login')).toBeFalsy();
    });
  });

  describe('isPatchBump', () => {
    it.each([
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
    ])('should return true for %p', (intent) => {
      const commit = `${intent}: did something`;

      expect(isPatchBump(commit)).toBeTruthy();
    });

    it('should return true when intent is uppercase', () => {
      expect(isPatchBump('CHORE: did something')).toBeTruthy();
    });

    it('should return true when intent is patch', () => {
      expect(isPatchBump('patch: did something')).toBeTruthy();
    });

    it('should return false otherwise', () => {
      expect(isPatchBump('feat: add user login')).toBeFalsy();
    });
  });

  describe('isSemanticCommit', () => {
    it('should return false on no intent', () => {
      expect(isSemanticCommit('did something')).toBeFalsy();
    });

    it('should return false on no colon with a scope', () => {
      expect(isSemanticCommit('chore(something) did something')).toBeFalsy();
    });

    it('should return false on no colon', () => {
      expect(isSemanticCommit('chore did something')).toBeFalsy();
    });

    it('should return true on containing brackets', () => {
      expect(isSemanticCommit('chore(something): did something')).toBeTruthy();
    });

    it('should return true on containing no brackets', () => {
      expect(isSemanticCommit('chore: did something')).toBeTruthy();
    });
  });

  describe('getReleaseVersion', () => {
    it('should bump patch by default on no semantic commits', () => {
      const commits: string[] = ['did something', 'did something else'];
      const build = bumpBuild(commits, currentVersion);

      expect(build).toEqual({
        version: {
          major: 1,
          minor: 2,
          patch: 4,
        },
        code: 10204,
        name: '1.2.4',
      });
    });

    it('should bump major and release minor and patch', () => {
      const commits: string[] = [
        'feat: BREAKING CHANGE did something',
        'feat!: did something else',
      ];
      const build = bumpBuild(commits, currentVersion);

      expect(build).toEqual({
        version: {
          major: 2,
          minor: 0,
          patch: 0,
        },
        code: 20000,
        name: '2.0.0',
      });
    });

    it('should bump minor, keep major the same and reset patch', () => {
      const commits: string[] = ['feat: did something'];
      const build = bumpBuild(commits, currentVersion);

      expect(build).toEqual({
        code: 10300,
        name: '1.3.0',
        version: {
          major: 1,
          minor: 3,
          patch: 0,
        },
      });
    });

    it('should bump patch, and keep major & minor the same', () => {
      const commits: string[] = ['chore: did something'];
      const build = bumpBuild(commits, currentVersion);

      expect(build).toEqual({
        code: 10204,
        name: '1.2.4',
        version: {
          major: 1,
          minor: 2,
          patch: 4,
        },
      });
    });

    it('should bump patch on nonsensical semantic commit', () => {
      const commits: string[] = ['qwerty: did something'];
      const build = bumpBuild(commits, currentVersion);

      expect(build).toEqual({
        code: 10204,
        name: '1.2.4',
        version: {
          major: 1,
          minor: 2,
          patch: 4,
        },
      });
    });
  });
});
