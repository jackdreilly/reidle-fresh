import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The local stack runs no edge functions: the `ask` function is mocked here (its prompt and streaming are covered
// by trying it on staging); this checks the page, the request it sends and how answers render.
test("Ask Reidog: starter question, a streamed answer with links, follow-up keeps the history", async ({ page }) => {
  const bodies: { messages: { role: string; text: string }[]; page: string | null }[] = [];
  await page.route("**/functions/v1/ask", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    expect(route.request().headers()["authorization"]).toMatch(/^Bearer ey/);
    await route.fulfill({
      contentType: "text/plain; charset=utf-8",
      headers: { "access-control-allow-origin": "*" },
      body: bodies.length === 1
        ? "Woof! Each day's place earns points:\n- **1st** gets 40\n- 2nd gets 20\n\nSee [the week](/stats/this_week)."
        : "Open [Invite & league](/league) and share the link.",
    });
  });
  await signIn(page, "dave", "/stats/today");
  await page.getByRole("link", { name: "Ask Reidog" }).click();
  await expect(page.getByRole("heading", { name: "Ask Reidog" })).toBeVisible();
  await page.getByRole("button", { name: "How does scoring work?" }).click();
  const convo = page.getByRole("list", { name: "Conversation with Reidog" });
  await expect(convo.getByText("1st")).toBeVisible();
  await expect(convo.locator("b", { hasText: "1st" })).toBeVisible();
  await expect(convo.getByRole("link", { name: "the week" })).toHaveAttribute("href", "/stats/this_week");
  expect(bodies[0].page).toBe("/stats");

  await page.getByRole("textbox", { name: "Your question" }).fill("And inviting friends?");
  await page.keyboard.press("Enter");
  await expect(convo.getByRole("link", { name: "Invite & league" })).toBeVisible();
  expect(bodies[1].messages.map((m) => m.role)).toEqual(["user", "model", "user"]);
  await page.screenshot({ path: "test-results/ask.png" });

  // following a link and coming back keeps the conversation (this tab)
  await convo.getByRole("link", { name: "Invite & league" }).click();
  await expect(page).toHaveURL(/\/league/);
  await page.goBack();
  await expect(convo.getByText("And inviting friends?")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByRole("button", { name: "How does scoring work?" })).toBeVisible();
});

test("Ask Reidog: an error keeps the question", async ({ page }) => {
  await page.route("**/functions/v1/ask", (route) => route.fulfill({
    status: 400, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ message: "Reidog needs a nap: that's 50 questions today. Try again tomorrow!" }),
  }));
  await signIn(page, "erin", "/ask");
  await page.getByRole("textbox", { name: "Your question" }).fill("hello?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Reidog needs a nap")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("hello?");
});
