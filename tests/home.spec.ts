import { test, expect } from "@playwright/test";

test("home page has correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Beat Muser");
});

test("home page shows heading and action buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Beat Muser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Folder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Demo" })).toBeVisible();
});

test("try demo opens dialog with demo options", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try Demo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Demo 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Demo 2" })).toBeVisible();
});

test("selecting demo navigates to project page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try Demo" }).click();
  await page.getByRole("button", { name: "Demo 1" }).click();
  await expect(page).toHaveURL(/\/demo1$/);
  await expect(page.getByRole("heading", { name: "demo1" })).toBeVisible();
});
