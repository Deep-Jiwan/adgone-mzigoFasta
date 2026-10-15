import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const rnWeb = dirname(require.resolve("react-native-web/package.json"));

// React Native components run in the browser through react-native-web. The alias is absolute so that
// libraries inside node_modules (react-native-svg) resolve to the same copy.
export default defineConfig({
  plugins: [react()],
  define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== "production") },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: rnWeb },
      { find: /^@react-native\/assets-registry\/registry$/, replacement: resolve(import.meta.dirname, "src/stubs/assets-registry.ts") },
    ],
    extensions: [".web.tsx", ".web.ts", ".web.js", ".web.mjs", ".tsx", ".ts", ".js", ".mjs", ".json"],
  },
});
