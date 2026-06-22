const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 30_000,
};
