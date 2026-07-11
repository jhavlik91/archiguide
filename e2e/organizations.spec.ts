import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth-helpers";
import { db } from "./db";

test.afterAll(async () => {
  await db.$disconnect();
});

/** Přečte odkaz z posledního dev e-mailu na danou adresu (in-memory outbox). */
async function fetchInviteLink(page: Page, email: string): Promise<string> {
  const res = await page.request.get(
    `/api/dev/outbox?to=${encodeURIComponent(email)}`,
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { link?: string };
  expect(body.link, "pozvánka obsahuje odkaz").toBeTruthy();
  return body.link as string;
}

/**
 * T009 — Organizace. Happy path akceptačního kritéria: založení firmy → pozvání
 * člena → přijetí druhým účtem → změna role → odebrání. Owner a člen jsou dva
 * nezávislé prohlížečové kontexty (dvě session).
 */
test("firma: založení → pozvání → přijetí → změna role → odebrání", async ({
  browser,
}) => {
  const ownerEmail = uniqueEmail("org-owner");
  const memberEmail = uniqueEmail("org-member");
  const password = "test-password-123";

  // --- Owner: registrace a založení firmy ---
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await registerViaUi(owner, ownerEmail, password);

  await owner.goto("/organizations");
  await owner.getByLabel("Název firmy").fill("Studio Test");
  await owner.getByRole("button", { name: "Založit firmu" }).click();

  // Přesměrování na detail firmy.
  await owner.waitForURL(/\/organizations\/[a-z0-9]+$/);
  await expect(
    owner.getByRole("heading", { name: "Studio Test" }),
  ).toBeVisible();

  // --- Owner: pozvání člena jako editor ---
  // `exact`, ať locator nechytí i „Kontaktní e-mail" z firemního profilu (T010).
  await owner.getByLabel("E-mail", { exact: true }).fill(memberEmail);
  await owner.getByRole("button", { name: "Pozvat" }).click();
  await expect(owner.getByText("Pozvánka odeslána.")).toBeVisible();

  const inviteLink = await fetchInviteLink(owner, memberEmail);

  // --- Člen: registrace a přijetí pozvánky ---
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await registerViaUi(member, memberEmail, password);

  await member.goto(inviteLink);
  await expect(member.getByText(/Pozvánka do firmy/)).toBeVisible();
  await member.getByRole("button", { name: "Přijmout" }).click();

  // Po přijetí přejde na detail firmy.
  await member.waitForURL(/\/organizations\/[a-z0-9]+$/);
  await expect(
    member.getByRole("heading", { name: "Studio Test" }),
  ).toBeVisible();

  // --- Owner: člen je vidět, změna role a odebrání ---
  await owner.reload();
  // Cílíme na ovládací prvky člena (kombobox/tlačítko), ne na jeho e-mail —
  // ten se totiž objevuje i v seznamu pozvánek (přijatá pozvánka).
  const roleSelect = owner.getByRole("combobox", {
    name: `Role: ${memberEmail}`,
  });
  await expect(roleSelect).toBeVisible();

  // Změna role člena (member → administrátor).
  await roleSelect.click();
  await owner.getByRole("option", { name: "Administrátor" }).click();
  await expect(owner.getByText("Role změněna.")).toBeVisible();

  // Odebrání člena.
  await owner.getByRole("button", { name: `Odebrat ${memberEmail}` }).click();
  await expect(owner.getByText("Člen odebrán.")).toBeVisible();
  await expect(
    owner.getByRole("button", { name: `Odebrat ${memberEmail}` }),
  ).toHaveCount(0);

  await ownerCtx.close();
  await memberCtx.close();
});

/**
 * Invariant „min. 1 owner": jediný owner nemůže opustit firmu (musí nejdřív
 * předat vlastnictví). Ověřuje i DB stav — členství zůstává.
 */
test("poslední vlastník nemůže opustit firmu", async ({ page }) => {
  const ownerEmail = uniqueEmail("org-solo");
  await registerViaUi(page, ownerEmail, "test-password-123");

  await page.goto("/organizations");
  await page.getByLabel("Název firmy").fill("Sólo studio");
  await page.getByRole("button", { name: "Založit firmu" }).click();
  await page.waitForURL(/\/organizations\/[a-z0-9]+$/);

  await page.getByRole("button", { name: "Opustit firmu" }).click();
  await expect(page.getByText(/poslední vlastník/i)).toBeVisible();

  // Členství přetrvává — owner je pořád v seznamu.
  await expect(page.getByText(ownerEmail)).toBeVisible();
  const user = await db.user.findUniqueOrThrow({
    where: { email: ownerEmail },
  });
  const memberships = await db.organizationMember.count({
    where: { userId: user.id, role: "owner" },
  });
  expect(memberships).toBe(1);
});
