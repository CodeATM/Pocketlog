// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    /**
     * Reanimated's shared values are mutable by design — assigning `.value` is the
     * documented API, both on the JS thread and inside worklets. The React Compiler
     * rules read that assignment as illegal mutation of a captured value, which is
     * exactly what a shared value is for.
     *
     * These are scoped to the animation components rather than disabled globally, so
     * the compiler rules stay enforced everywhere else — including on the stores and
     * screens, where immutable updates genuinely are the point.
     */
    files: ["src/components/ui/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    /**
     * React Hook Form's `watch()` is documented as non-memoizable, and the sheet
     * deliberately reads the whole form each render to derive the computed end time.
     * Subscribing field-by-field would add subscriptions without changing what is
     * rendered.
     */
    files: ["src/features/**/*.tsx"],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
]);