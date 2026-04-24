import { test, expect } from "@playwright/test";

test.describe("Project view timeline", () => {
  test("renders BPM change markers", async ({ page }) => {
    await page.goto("/projects/__demo__");
    await expect(page.locator('[data-testid="bpm-change-marker"]:has-text("128")')).toBeVisible();
    await expect(page.locator('[data-testid="bpm-change-marker"]:has-text("160")')).toBeVisible();
  });

  test("renders time signature markers", async ({ page }) => {
    await page.goto("/projects/__demo__");
    await expect(page.locator('[data-testid="time-sig-marker"]:has-text("4/4")')).toBeVisible();
  });
});
