import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3187", trace: "off" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3187",
    url: "http://localhost:3187/login",
    // Explicit opt-in only for a server started from this checkout.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120000,
  },
});
