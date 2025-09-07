// wswallace-62/buz-tracker2/Buz-Tracker2-more/.eslintrc.cjs
module.exports = {
  root: true, // <-- Good practice to add this
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended', // <-- Added for React hooks best practices
  ],
  // This is the critical addition:
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'vite.config.ts',
    'functions/**/*', // <-- This line tells the root linter to skip the functions folder
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
  settings: {
  
  },
  env: { // <-- Add environment info
    browser: true,
    es2020: true
  },
  overrides: [
    {
      files: ['*.css', '*.pcss'],
      parser: 'postcss-scss',
    },
  ],
};
