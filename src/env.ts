import { Toolkit } from './toolkit';
import { Build } from './version';

export type Key =
  | 'commit_range'
  | 'commit_base_ref'
  | 'commit_tag_pattern'
  | 'gradle_location'
  | 'version_storage'
  | 'tag_prefix'
  | 'skip_ci'
  | 'commit_message'
  | 'build_number';

export const versionStorageBackends = [
  'version-properties',
  'gradle-properties',
] as const;

export type VersionStorageBackend = (typeof versionStorageBackends)[number];

export const commitRanges = ['previous-tag', 'base-ref', 'payload'] as const;

export type CommitRange = (typeof commitRanges)[number];

export const getValue = (
  toolkit: Toolkit,
  key: Key,
  fallback?: string,
): string => {
  return toolkit.inputs[key] ?? fallback ?? '';
};

export const getGradleLocation = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'gradle_location', 'app/build.gradle');
};

export const getTagPrefix = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'tag_prefix', 'v');
};

export const isSkippingCi = (toolkit: Toolkit): boolean => {
  return getValue(toolkit, 'skip_ci', 'true') === 'true';
};

export const getBuildNumber = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'build_number', '');
};

export const getCommitRange = (toolkit: Toolkit): CommitRange => {
  const range = getValue(toolkit, 'commit_range', 'previous-tag');

  if (commitRanges.includes(range as CommitRange)) {
    return range as CommitRange;
  }

  throw new Error(
    `Invalid commit range "${range}". Expected one of: ${commitRanges.join(
      ', ',
    )}`,
  );
};

export const getCommitBaseRef = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'commit_base_ref', '');
};

export const getCommitTagPattern = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'commit_tag_pattern', '*');
};

export const getVersionStorageBackend = (
  toolkit: Toolkit,
): VersionStorageBackend => {
  const backend = getValue(toolkit, 'version_storage', 'version-properties');

  if (versionStorageBackends.includes(backend as VersionStorageBackend)) {
    return backend as VersionStorageBackend;
  }

  throw new Error(
    `Invalid version storage backend "${backend}". Expected one of: ${versionStorageBackends.join(
      ', ',
    )}`,
  );
};

export const getCommitMessage = (
  toolkit: Toolkit,
  build: Build,
  tagPrefix: string,
  skipCi: boolean,
): string => {
  const tagName = `${tagPrefix}${build.name}`;
  const defaultMessage = `release: ${tagName}`;
  const message = getValue(toolkit, 'commit_message', defaultMessage).replace(
    '{{version}}',
    tagName,
  );
  const flag = skipCi ? '[skip-ci]' : '';

  return `${message.length > 0 ? message : defaultMessage} ${flag}`.trim();
};
