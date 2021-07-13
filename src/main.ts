import { Toolkit } from 'actions-toolkit';

type Key = 'GRADLE-LOCATION' | 'TAG-PREFIX';

const getValue = (toolkit: Toolkit, key: Key, fallback?: string): string => {
  return toolkit.inputs[`INPUT_${key}`] ?? fallback ?? '';
};

const getGradleLocation = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'GRADLE-LOCATION', 'app/build.gradle');
};

const getTagPrefix = (toolkit: Toolkit): string => {
  return getValue(toolkit, 'TAG-PREFIX');
};

const isSkippingCi = (toolkit: Toolkit): boolean => {
  return toolkit.inputs['skip-ci'] === 'true';
};

Toolkit.run(async (tools): Promise<void> => {
  const gradleLocation = getGradleLocation(tools);
  const tagPrefix = getTagPrefix(tools);
  const skipCi = isSkippingCi(tools);
  const commitMessage = tools.inputs['commit-message'];

  const { commits } = tools.context.payload;

  if (!commits) {
    // no commits, bump patch version for ci?
  }
});
