import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import markdownlint from "eslint-plugin-markdownlint";
import markdownlintParser from "eslint-plugin-markdownlint/parser.js";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["src/renderer/scripts.js"] },
  {
    files: ["**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        electronAPI: "readonly"
      },
      sourceType: "module",
    }
  },
  {
    files: ["**/*.jsx"],
    plugins: { js, "react-hooks": reactHooks },
    extends: ["js/recommended", eslintReact.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        electronAPI: "readonly"
      },
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    }
  },
  {
    files: ["**/*.md"],
    ignores: [".claude/**", ".github/**", "CHANGELOG.md", "TODO.md"],
    plugins: { markdownlint },
    languageOptions: { parser: markdownlintParser },
    settings: {
      markdownlint: { configFile: ".markdownlint.json" },
    },
    rules: markdownlint.configs.recommended.rules,
  },
]);
