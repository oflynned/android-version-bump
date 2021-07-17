import { Toolkit } from 'actions-toolkit';
import { Build } from './version';

export type Key =
  | 'GRADLE-LOCATION'
  | 'TAG-PREFIX'
  | 'SKIP-CI'
  | 'COMMIT-MESSAGE'
  | 'BUILD-NUMBER';

export const getValue = (
  toolkit: Toolkit,
  key: Key,
  fallback?: string,
): string => {
  return toolkit.inputs[`INPUT_${key}`] ?? fallback ?? '';
};

export const getGradleLocation = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'GRADLE-LOCATION', 'app/build.gradle');
};

export const getTagPrefix = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'TAG-PREFIX', 'v');
};

export const isSkippingCi = (toolkit: Toolkit): boolean => {
  return getValue(toolkit, 'SKIP-CI', 'true') === 'true';
};

export const getBuildNumber = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'BUILD-NUMBER', '');
};

export const getCommitMessage = (
  toolkit: Toolkit,
  build: Build,
  tagPrefix: string,
  skipCi: boolean,
): string => {
  const defaultMessage = `release: ${tagPrefix}${build.name}`;
  const message = getValue(toolkit, 'COMMIT-MESSAGE', defaultMessage).replace(
    '{{version}}',
    build.name,
  );
  const flag = skipCi ? '[skip-ci]' : '';

  return `${message} ${flag}`.trim();
};
