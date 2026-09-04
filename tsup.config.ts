import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/adapters/primary/cli/index.ts"],
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  dts: false, // Generate declaration file (.d.ts) disabled due to rollup error
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
});
