import { Toolkit } from 'actions-toolkit';

const setCommitIdentity = async (toolkit: Toolkit): Promise<void> => {
  await toolkit.exec('');
};

const createCommit = async (
  toolkit: Toolkit,
  commit: string,
): Promise<void> => {
  // await toolkit.exec()
};

const createTag = async (): Promise<void> => {};

const createRelease = async (): Promise<void> => {};
