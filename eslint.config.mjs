import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: [
      "**/*.js"
    ],
    ignores: [
      "src/renderer/scripts.js"
    ],
    plugins: { js },
    extends: [
      "js/recommended"
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      sourceType: "commonjs", // or "script" or "commonjs"
    }
  },
  {
    files: [,
      "stylelint.config.mjs",
      "src/renderer/js/**/*.js"
    ],
    plugins: { js },
    extends: [
      "js/recommended"
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        electronAPI: "readonly"
      },
      sourceType: "module", // or "script" or "commonjs"
    }
  },
]);
