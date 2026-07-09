import { expect, test } from "@playwright/test";

test("homepage renders the ArchiGuide placeholder", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ArchiGuide", level: 1 }),
  ).toBeVisible();
});
