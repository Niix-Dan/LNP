import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["packages/index.ts"],
	format: ["cjs", "esm"],
	sourcemap: true,
	minify: true,
	clean: true,
	dts: true
})
