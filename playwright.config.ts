import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/** Prefer the Node binary that launched Playwright (avoid agent-bundled Node 18). */
const nodeBinary = process.execPath;
const nodeDir = path.dirname(nodeBinary);
const pathWithLauncherNode = `${nodeDir}${path.delimiter}${process.env.PATH ?? ""}`;

/** Gitignored session file for authenticated e2e (never commit). */
const authStorageState = path.join(__dirname, "tests", "e2e", ".auth", "user.json");

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
      testIgnore: [/auth\.preflight\.ts$/, /[/\\]authenticated[/\\]/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "auth-preflight",
      testMatch: /auth\.preflight\.ts$/,
    },
    {
      name: "chromium-authenticated",
      testMatch: /[/\\]authenticated[/\\].*\.spec\.ts$/,
      dependencies: ["auth-preflight"],
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStorageState,
      },
    },
  ],
});
