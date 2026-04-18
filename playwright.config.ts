import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file (local dev only).
 * In CI, rely on workflow env — loading `.env.local` can mask missing vars.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

if (!process.env.CI) {
  config({
    path: ".env.local",
  });
}

/** Matches `.github/workflows/playwright.yml` service Postgres. */
const CI_POSTGRES_URL =
  "postgresql://postgres:postgres@localhost:5432/virgil_ci";
const CI_AUTH_SECRET = "ci-playwright-insecure-secret-not-for-production";

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Limit workers to prevent browser crashes */
  workers: process.env.CI ? 2 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: 240 * 1000, // 120 seconds
  expect: {
    timeout: 240 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*.test.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/ping`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    // Ensure Next.js sees DB auth even if the child process does not inherit the runner env.
    ...(process.env.CI
      ? {
          env: {
            POSTGRES_URL: process.env.POSTGRES_URL ?? CI_POSTGRES_URL,
            AUTH_SECRET: process.env.AUTH_SECRET ?? CI_AUTH_SECRET,
          },
        }
      : {}),
  },
});
