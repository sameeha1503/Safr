import { registerHooks } from "node:module";
// Node sets this for test workers. Each API test must replace fetch with fixtures.
if (process.env.NODE_TEST_CONTEXT) {
  globalThis.fetch = async () => {
    throw new Error("Network disabled in tests: mock fetch with a fixture.");
  };
}
// Node 24 strips TypeScript; resolve the extensionless imports used by Vite.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:ts|tsx|js|mjs|json)$/i.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        /* Try normal resolution. */
      }
    }
    return nextResolve(specifier, context);
  },
});
