import fs from 'fs';
import path from 'path';
import {
  ActionFixture,
  cleanupFixture,
  gitInRemote,
  gitInWorkspace,
  readOutput,
  readOutputs,
  runActionFixture,
} from './harness';

describe('packaged action with local git repositories', () => {
  const fixtures: ActionFixture[] = [];
  const run = (
    options?: Parameters<typeof runActionFixture>[0],
  ): ActionFixture => {
    const fixture = runActionFixture(options);
    fixtures.push(fixture);
    return fixture;
  };

  afterEach(() => {
    fixtures.splice(0).forEach(cleanupFixture);
  });

  it('creates the initial version commit, tag, push, and output', () => {
    const fixture = run({ unrelatedFile: true });
    expect(fixture.result.status).toBe(0);
    expect(gitInRemote(fixture, 'show', 'main:version.properties')).toBe(
      [
        'majorVersion=0',
        'minorVersion=0',
        'patchVersion=1',
        'buildNumber=',
      ].join('\n'),
    );
    const remoteHead = gitInRemote(fixture, 'rev-parse', 'refs/heads/main');
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/0.0.1')).toBe(
      remoteHead,
    );
    expect(gitInRemote(fixture, 'log', '-1', '--format=%s', 'main')).toBe(
      'release: v0.0.1 [skip-ci]',
    );
    expect(readOutput(fixture)).toBe('git_tag=0.0.1');
    expect(readOutputs(fixture)).toEqual({
      git_tag: '0.0.1',
      version_name: '0.0.1',
      version_code: '1',
      release_action: 'released',
    });
    expect(gitInWorkspace(fixture, 'status', '--porcelain')).toBe(
      '?? notes.txt',
    );
    expect(
      gitInRemote(
        fixture,
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        'main',
      ),
    ).toBe('version.properties');
  });

  it.each([
    ['patch', ['fix: repair launch'], '1.2.4'],
    ['minor', ['feat: add login'], '1.3.0'],
    [
      'major precedence',
      ['fix: repair launch', 'feat: add login', 'refactor!: remove v1'],
      '2.0.0',
    ],
  ])(
    'performs a %s bump from the triggering commits',
    (_, commits, version) => {
      const fixture = run({ version: '1.2.3', commits });

      expect(fixture.result.status).toBe(0);
      expect(
        gitInRemote(fixture, 'show', `${fixture.branch}:version.properties`),
      ).toBe(
        [
          `majorVersion=${version.split('.')[0]}`,
          `minorVersion=${version.split('.')[1]}`,
          `patchVersion=${version.split('.')[2]}`,
          'buildNumber=',
        ].join('\n'),
      );
      expect(gitInRemote(fixture, 'rev-parse', `refs/tags/${version}`)).toBe(
        gitInRemote(fixture, 'rev-parse', `refs/heads/${fixture.branch}`),
      );
    },
  );

  it('reads and writes gradle.properties when configured', () => {
    const fixture = run({
      version: '1.2.3',
      versionStorage: 'gradle-properties',
      commits: ['fix: repair launch'],
      inputs: {
        version_storage: 'gradle-properties',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(gitInRemote(fixture, 'show', 'main:gradle.properties')).toBe(
      [
        'org.gradle.jvmargs=-Xmx2g',
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=4',
        'buildNumber=',
      ].join('\n'),
    );
    expect(
      gitInRemote(
        fixture,
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        'main',
      ),
    ).toBe('gradle.properties');
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/1.2.4')).toBe(
      gitInRemote(fixture, 'rev-parse', 'refs/heads/main'),
    );
  });

  it('applies inputs, identity, and head-ref checkout', () => {
    const fixture = run({
      version: '1.2.3',
      commits: ['feat: add login'],
      headRef: 'feature/login',
      inputs: {
        commit_range: 'base-ref',
        commit_base_ref: 'origin/main',
        commit_message_version_prefix: 'release-',
        skip_ci: 'false',
        build_number: '42',
        commit_message: 'publish {{version}}',
      },
      environment: {
        GITHUB_USER: 'Release Bot',
        GITHUB_EMAIL: 'release@example.com',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(
      gitInRemote(fixture, 'log', '-1', '--format=%s', fixture.branch),
    ).toBe('publish release-1.3.0.42');
    expect(
      gitInRemote(fixture, 'log', '-1', '--format=%an <%ae>', fixture.branch),
    ).toBe('Release Bot <release@example.com>');
    expect(
      gitInRemote(fixture, 'show', `${fixture.branch}:version.properties`),
    ).toContain('buildNumber=42');
    expect(readOutput(fixture)).toBe('git_tag=1.3.0.42');
    expect(readOutputs(fixture)).toEqual({
      git_tag: '1.3.0.42',
      version_name: '1.3.0.42',
      version_code: '10300',
      release_action: 'released',
    });
    expect(gitInRemote(fixture, 'rev-parse', 'refs/heads/main')).not.toBe(
      gitInRemote(fixture, 'rev-parse', `refs/heads/${fixture.branch}`),
    );
  });

  it('uses squash-style git history', () => {
    const fixture = run({
      version: '1.2.3',
      commits: ['feat: squash login branch (#42)'],
    });

    expect(fixture.result.status).toBe(0);
    expect(gitInRemote(fixture, 'show', 'main:version.properties')).toContain(
      'minorVersion=3',
    );
  });

  it('uses the previous matching tag to HEAD range', () => {
    const fixture = run({
      version: '1.2.3',
      previousTag: '1.2.3',
      preTagCommits: ['feat: already released login'],
      commits: ['fix: repair launch'],
    });

    expect(fixture.result.status).toBe(0);
    expect(gitInRemote(fixture, 'show', 'main:version.properties')).toBe(
      [
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=4',
        'buildNumber=',
      ].join('\n'),
    );
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/1.2.4')).toBe(
      gitInRemote(fixture, 'rev-parse', 'refs/heads/main'),
    );
  });

  it('bumps only the configured mobile app version and tag', () => {
    const fixture = run({
      appVersions: {
        'apps/mobile': '1.2.3',
        'apps/admin': '9.8.7',
      },
      previousTags: ['mobile-v1.2.3', 'admin-v9.8.7'],
      commits: [
        {
          message: 'fix: repair mobile launch',
          filePath: 'apps/mobile/src/Main.kt',
        },
      ],
      inputs: {
        app_path: 'apps/mobile',
        git_tag_prefix: 'mobile-v',
        path_filter: 'true',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(
      gitInRemote(fixture, 'show', 'main:apps/mobile/version.properties'),
    ).toBe(
      [
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=4',
        'buildNumber=',
      ].join('\n'),
    );
    expect(
      gitInRemote(fixture, 'show', 'main:apps/admin/version.properties'),
    ).toBe(
      [
        'majorVersion=9',
        'minorVersion=8',
        'patchVersion=7',
        'buildNumber=',
      ].join('\n'),
    );
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/mobile-v1.2.4')).toBe(
      gitInRemote(fixture, 'rev-parse', 'refs/heads/main'),
    );
    expect(readOutputs(fixture)).toMatchObject({
      git_tag: 'mobile-v1.2.4',
      version_name: '1.2.4',
      release_action: 'released',
    });
  });

  it('bumps only the configured admin app version and tag', () => {
    const fixture = run({
      appVersions: {
        'apps/mobile': '1.2.3',
        'apps/admin': '9.8.7',
      },
      previousTags: ['mobile-v1.2.3', 'admin-v9.8.7'],
      commits: [
        {
          message: 'feat: add admin dashboard',
          filePath: 'apps/admin/src/Main.kt',
        },
      ],
      inputs: {
        app_path: 'apps/admin',
        git_tag_prefix: 'admin-v',
        path_filter: 'true',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(
      gitInRemote(fixture, 'show', 'main:apps/admin/version.properties'),
    ).toBe(
      [
        'majorVersion=9',
        'minorVersion=9',
        'patchVersion=0',
        'buildNumber=',
      ].join('\n'),
    );
    expect(
      gitInRemote(fixture, 'show', 'main:apps/mobile/version.properties'),
    ).toBe(
      [
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=3',
        'buildNumber=',
      ].join('\n'),
    );
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/admin-v9.9.0')).toBe(
      gitInRemote(fixture, 'rev-parse', 'refs/heads/main'),
    );
    expect(readOutputs(fixture)).toMatchObject({
      git_tag: 'admin-v9.9.0',
      version_name: '9.9.0',
      release_action: 'released',
    });
  });

  it('succeeds without side effects when path filtering finds no app changes', () => {
    const fixture = run({
      appVersions: {
        'apps/mobile': '1.2.3',
        'apps/admin': '9.8.7',
      },
      previousTags: ['mobile-v1.2.3', 'admin-v9.8.7'],
      commits: [
        {
          message: 'fix: repair admin launch',
          filePath: 'apps/admin/src/Main.kt',
        },
      ],
      inputs: {
        app_path: 'apps/mobile',
        git_tag_prefix: 'mobile-v',
        path_filter: 'true',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(
      gitInRemote(fixture, 'show', 'main:apps/mobile/version.properties'),
    ).toBe(
      [
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=3',
        'buildNumber=',
      ].join('\n'),
    );
    expect(gitInRemote(fixture, 'rev-parse', 'refs/heads/main')).toBe(
      fixture.triggerSha,
    );
    expect(gitInRemote(fixture, 'tag', '--list', 'mobile-v1.2.4')).toBe('');
    expect(readOutputs(fixture)).toMatchObject({
      git_tag: 'mobile-v1.2.3',
      version_name: '1.2.3',
      release_action: 'skipped',
    });
  });

  it('rejects payload commit range', () => {
    const fixture = run({
      appVersions: {
        'apps/mobile': '1.2.3',
      },
      commits: [
        {
          message: 'fix: repair mobile launch',
          filePath: 'apps/mobile/src/Main.kt',
        },
      ],
      inputs: {
        app_path: 'apps/mobile',
        commit_range: 'payload',
      },
    });

    expect(fixture.result.status).toBe(1);
    expect(`${fixture.result.stdout}${fixture.result.stderr}`).toContain(
      'Invalid commit range "payload"',
    );
    expect(gitInRemote(fixture, 'tag', '--list', '1.2.4')).toBe('');
  });

  it('uses app-specific previous tags for the bump range', () => {
    const fixture = run({
      appVersions: {
        'apps/mobile': '1.2.3',
        'apps/admin': '9.8.7',
      },
      previousTags: ['mobile-v1.2.3', 'admin-v9.8.7'],
      preTagCommits: [
        {
          message: 'feat: released mobile feature',
          filePath: 'apps/mobile/src/Main.kt',
        },
      ],
      commits: [
        {
          message: 'fix: repair mobile launch',
          filePath: 'apps/mobile/src/Main.kt',
        },
      ],
      inputs: {
        app_path: 'apps/mobile',
        git_tag_prefix: 'mobile-v',
        path_filter: 'true',
      },
    });

    expect(fixture.result.status).toBe(0);
    expect(
      gitInRemote(fixture, 'show', 'main:apps/mobile/version.properties'),
    ).toBe(
      [
        'majorVersion=1',
        'minorVersion=2',
        'patchVersion=4',
        'buildNumber=',
      ].join('\n'),
    );
    expect(gitInRemote(fixture, 'rev-parse', 'refs/tags/mobile-v1.2.4')).toBe(
      gitInRemote(fixture, 'rev-parse', 'refs/heads/main'),
    );
  });

  it('reports a rejected push and leaves the remote unchanged', () => {
    const fixture = run({
      version: '1.2.3',
      commits: ['fix: repair launch'],
      rejectPush: true,
    });

    expect(fixture.result.status).toBe(1);
    expect(gitInRemote(fixture, 'rev-parse', 'refs/heads/main')).toBe(
      fixture.triggerSha,
    );
    expect(gitInRemote(fixture, 'tag', '--list', '1.2.4')).toBe('');
    expect(gitInWorkspace(fixture, 'log', '-1', '--format=%s')).toBe(
      'release: v1.2.4 [skip-ci]',
    );
    expect(gitInWorkspace(fixture, 'rev-parse', 'refs/tags/1.2.4')).toBe(
      gitInWorkspace(fixture, 'rev-parse', 'HEAD'),
    );
    expect(readOutput(fixture)).toBe('');
    expect(`${fixture.result.stdout}${fixture.result.stderr}`).toContain(
      'rejected by e2e git shim',
    );
  });

  it('declares the output written by the packaged action', () => {
    const action = fs.readFileSync(
      path.resolve(__dirname, '../action.yml'),
      'utf8',
    );

    expect(action).toContain('  git_tag:');
    expect(action).toContain('  version_name:');
    expect(action).toContain('  version_code:');
    expect(action).toContain('  release_action:');
  });
});
