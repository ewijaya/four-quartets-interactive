import { test, expect, setPrefs } from "./fixtures";

test("epigraph deep links take precedence over a movement URL", async ({ page, errors }) => {
  await setPrefs(page, { scenes: false, density: "clean" });
  await page.goto("/burnt-norton/1#epigraphs");
  const epigraphs = page.locator("#epigraphs");
  await expect(epigraphs).toBeInViewport();
  await expect(epigraphs.locator('blockquote[lang="grc"]')).toHaveCount(2);
  await expect(epigraphs).not.toContainText("placeholder");
  await expect(page.locator('[data-line="BN.1.1"] .ln')).toHaveText("1");

  const disclosure = epigraphs.locator("summary");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(epigraphs.locator("details")).toHaveAttribute("open", "");
  await expect(epigraphs).toContainText("Though wisdom is common");
  await page.keyboard.press("Enter");
  await expect(epigraphs.locator("details")).not.toHaveAttribute("open", "");
  void errors;
});

test("movement I links back to the epigraphs without losing the fragment", async ({ page, errors }) => {
  await setPrefs(page, { scenes: false });
  await page.goto("/burnt-norton/1");
  await page.getByRole("link", { name: "Read the epigraphs" }).click();
  await expect(page.locator("#epigraphs")).toBeInViewport();
  await expect(page).toHaveURL(/\/burnt-norton(?:\/1)?\/?#epigraphs$/);
  await page.reload();
  await expect(page.locator("#epigraphs")).toBeInViewport();
  void errors;
});

test("home links to epigraphs through client navigation", async ({ page, errors }) => {
  await setPrefs(page, { scenes: false });
  await page.goto("/");
  await page.getByRole("link", { name: "Read the epigraphs" }).click();
  await expect(page.locator("#epigraphs")).toBeInViewport();
  await expect(page.locator("#epigraphs")).toHaveCount(1);
  await page.goto("/the-dry-salvages");
  await expect(page.locator("#epigraphs")).toHaveCount(0);
  await expect(page.locator(".front-matter")).toBeVisible();
  void errors;
});
