import js from "@eslint/js";
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
    plugins: { js, "react-hooks": reactHooks },
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
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    }
  },
]);
