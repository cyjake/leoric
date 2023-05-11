'use strict';

const eslintConfig = {
  overrides: [],
  'parser': '@babel/eslint-parser',
  'parserOptions': {
    'sourceType': 'script',
    'ecmaVersion': 2020,
    'requireConfigFile': false
  },
  'env': {
    'node': true,
    'es6': true
  },
  'plugins': [
    'no-only-tests'
  ],
  'rules': {
    'curly': [2, 'multi-line'],
    'consistent-return': 0,
    'quotes': [2, 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }],
    'semi': [2, 'always'],
    'strict': ['error', 'safe'],
    'no-const-assign': 'error',
    'no-undef': 2,
    'no-underscore-dangle': 0,
    'no-use-before-define': [2, 'nofunc'],
    'no-unused-vars': [2, { 'vars': 'all', 'args': 'none', 'ignoreRestSiblings': true }],
    'no-shadow': 2,
    'keyword-spacing': 'error',
    'eol-last': 'error',
    'prefer-const': 'error',
    'no-only-tests/no-only-tests': 'error',
    'no-trailing-spaces': 'error',
    'space-before-blocks': 'error',
    'space-in-parens': 'error'
  }
};

const tslintConfig = {
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  files: ['*.ts'],
  plugins: [
    '@typescript-eslint',
    'no-only-tests',
  ],
  rules: {
    ...eslintConfig.rules,
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-use-before-define': ['error'],
    strict: 0,
    '@typescript-eslint/ban-ts-comment': ['warn'],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['warn'],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

eslintConfig.overrides.push(tslintConfig);

module.exports = eslintConfig;
