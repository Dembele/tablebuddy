//Backend tests. Suites named *.core.test.ts read real rulebook entries: they run only when the core book is installed (packages/data/core).
const fs = require('fs')
const path = require('path')
const coreInstalled = fs.existsSync(path.join(__dirname, 'deps', 'data', 'core', '_book.ts'))

module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  resetModules: false,
  moduleFileExtensions: ['ts', 'js'],
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '__tests__/tsconfig.tests.json',
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  testMatch: ['<rootDir>/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', ...(coreInstalled ? [] : ['\\.core\\.test\\.ts$'])],
  moduleNameMapper: {
    "^@backend/(.*)$": "<rootDir>/$1"
  }
}
