import { Toolkit } from 'actions-toolkit';
import { Build } from './version';

export type Key =
  | 'gradle_location'
  | 'tag_prefix'
  | 'skip_ci'
  | 'commit_message'
  | 'build_number';

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
