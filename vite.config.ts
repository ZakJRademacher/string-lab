// vite.config.ts: the build tool. The Cloudflare plugin copies everything in /public
// to Cloudflare as static files (there is no server code any more).
import os from "node:os";
import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// "cf dev" keeps some local runtime files in .cloudflare/state. Windows can't open files
// whose full path is longer than 260 characters, so when this project sits in a very
// deeply nested folder we keep those files in the temp folder instead.
const deepFolder = process.platform === "win32" && process.cwd().length > 120;

export default defineConfig({
	plugins: [
		cloudflare({
			persistState: deepFolder ? { path: path.join(os.tmpdir(), "string-lab-dev-state") } : true,
		}),
	],
});
