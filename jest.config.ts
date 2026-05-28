export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@dude/sdk/runner$": "<rootDir>/packages/sdk/src/runner/index.ts",
    "^@dude/sdk/gateway-runtime$": "<rootDir>/packages/sdk/src/gateway-runtime/index.ts",
    "^@dude/sdk$": "<rootDir>/packages/sdk/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
