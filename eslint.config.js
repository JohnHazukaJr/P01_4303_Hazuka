// Flat config for ESLint v9+. Lints server-side Node.js sources only.
// Run from repo root: `npm run lint`. Browser code under web/ has its own
// runtime concerns and isn't part of this lint scope.
const js = require("@eslint/js");

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "readonly",
  global: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
};

module.exports = [
  {
    /* Lint only server code + this config file. Web/static assets are out of scope. */
    ignores: [
      "node_modules/**",
      "server/node_modules/**",
      "server/data/**",
      "web/**",
      "**/*.min.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
  },
  {
    files: ["server/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_|^e$|^err$|^bcErr$",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "no-var": "off",
      "prefer-const": "off",
      eqeqeq: ["warn", "smart"],
    },
  },
];
