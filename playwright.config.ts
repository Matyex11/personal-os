import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/** Prefer the Node binary that launched Playwright (avoid agent-bundled Node 18). */
const nodeBinary = process.execPath;
const nodeDir = path.dirname(nodeBinary);
const pathWithLauncherNode = `${nodeDir}${path.delimiter}${process.env.PATH ?? ""}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: `"${nodeBinary}" ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: pathWithLauncherNode,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
