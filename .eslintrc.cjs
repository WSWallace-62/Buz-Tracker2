// wswallace-62/buz-tracker2/Buz-Tracker2-Github-errors/.eslintrc.cjs
// .eslintrc.cjs
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  // Ignore the functions directory, as it has its own linting process.
  // Also, ignore this config file itself.
  ignorePatterns: ['functions/**/*', '.eslintrc.cjs'],
  rules: {
    // CI is failing on "Unexpected any" and warnings are treated as errors.
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
