import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.js"],
    ignores: ["src/renderer/scripts.js"],
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
    plugins: { js, react, "react-hooks": reactHooks },
    settings: { react: { version: "19" } },
    extends: ["js/recommended"],
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
      "react/no-unknown-property": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    }
  },
]);
