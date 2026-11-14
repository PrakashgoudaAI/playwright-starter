import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "allure-results/**",
      "allure-report/**",
      "quality-results/**",
      "blob-report/**",
      "merged-report/**",
      "merged-results/**",
      "merged-allure-results/**",
      "merged-allure-report/**",
    ],
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "examples/**/*.ts",
      "scripts/**/*.ts",
      "merge.config.ts",
      "playwright.config.ts",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];
