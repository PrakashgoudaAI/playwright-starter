import { defineConfig } from "@playwright/test";
export default defineConfig({
  reporter: [
    ["html", { outputFolder: "merged-report", open: "never" }],
    ["junit", { outputFile: "merged-results/junit.xml" }],
  ],
});
