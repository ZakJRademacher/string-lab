// cloudflare.config.ts: tells Cloudflare how to run String Lab.
//
// String Lab is now a purely static site: every calculation runs in the visitor's
// browser and saved setups stay in their browser too. So there is no backend code and no
// database, just the files in /public, served by Cloudflare as static assets.
//
//   name → the Worker's name (and its URL: string-lab.<your-subdomain>.workers.dev)

import { defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "string-lab",
		compatibilityDate: "2026-11-13",
	},
});
