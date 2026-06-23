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
    expect(readOutput(fixture)).toBe('new_tag=0.0.1');
    expect(readOutputs(fixture)).toEqual({
      new_tag: '0.0.1',
      git_tag: '0.0.1',
      version_name: '0.0.1',
      version_code: '1',
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

  it('applies inputs, identity, and head-ref checkout', () => {
    const fixture = run({
      version: '1.2.3',
      commits: ['feat: add login'],
      headRef: 'feature/login',
      inputs: {
        tag_prefix: 'release-',
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
    expect(readOutput(fixture)).toBe('new_tag=1.3.0.42');
    expect(readOutputs(fixture)).toEqual({
      new_tag: '1.3.0.42',
      git_tag: '1.3.0.42',
      version_name: '1.3.0.42',
      version_code: '10300',
    });
    expect(gitInRemote(fixture, 'rev-parse', 'refs/heads/main')).not.toBe(
      gitInRemote(fixture, 'rev-parse', `refs/heads/${fixture.branch}`),
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

  it('reads commit messages from real GitHub push payload objects (#122)', () => {
    const fixture = run({
      version: '1.2.3',
      commits: ['feat: add login'],
      eventCommits: [{ id: 'fixture', message: 'feat: add login' }],
    });

    expect(fixture.result.status).toBe(0);
    expect(gitInRemote(fixture, 'show', 'main:version.properties')).toContain(
      'minorVersion=3',
    );
  });

  it('declares the output written by the packaged action', () => {
    const action = fs.readFileSync(
      path.resolve(__dirname, '../action.yml'),
      'utf8',
    );

    expect(action).toContain('  new_tag:');
    expect(action).toContain('  git_tag:');
    expect(action).toContain('  version_name:');
    expect(action).toContain('  version_code:');
  });
});
