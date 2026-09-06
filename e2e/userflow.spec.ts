import { expect, test } from "@playwright/test";

import { resetDb } from "./db.ts";

test.beforeEach(async () => {
  await resetDb();
});

test("a guest can see the app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByText("Meet")).toBeVisible();
});
