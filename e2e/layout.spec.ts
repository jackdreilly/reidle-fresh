import { expect, test, type Page } from "@playwright/test";
import { signIn, sql } from "./helpers";

// The board must never run under the keyboard: 6 rows are reserved from the start and the grid
// shrinks to fit when a game stretches to 7..10 guesses.
const VIEWPORTS = [
  { width: 375, height: 667 }, // iPhone SE-ish
  { width: 360, height: 560 }, // small Android with browser chrome
  { width: 700, height: 480 }, // landscape phone / short window
  { width: 1000, height: 700 },
  { width: 1280, height: 800 },
];

const geometry = (page: Page) =>
  page.evaluate(() => {
    const rect = (id: string) => document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect();
    const board = rect("board"), keys = rect("keyboard");
    const rows = document.querySelectorAll("[data-testid=board] .grid-cols-5");
    const cell = rows[0].children[0].getBoundingClientRect();
    return { boardTop: board.top, boardBottom: board.bottom, keyTop: keys.top, rows: rows.length, cellW: cell.width, cellH: cell.height };
  });

async function expectFits(page: Page, rows: number) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(120);
    const g = await geometry(page);
    const where = `${rows} rows @ ${vp.width}x${vp.height}`;
    expect(g.rows, where).toBe(rows);
    expect(g.boardBottom, `board overlaps keyboard: ${where}`).toBeLessThanOrEqual(g.keyTop + 1);
    expect(g.boardTop, `board above viewport: ${where}`).toBeGreaterThanOrEqual(0);
    expect(g.cellH, `cells too small: ${where}`).toBeGreaterThanOrEqual(14);
    expect(Math.abs(g.cellW - g.cellH), `cells not square: ${where}`).toBeLessThan(8);
  }
}

const setHistory = (name: string, rows: number) =>
  sql(`update checkpoints set history = (select jsonb_agg(r) from generate_series(1, ${rows}), lateral (select jsonb_agg(jsonb_build_object('letter', l, 'score', 2)) r from unnest(string_to_array('C,R,A,N,E', ',')) l) x) where name = '${name}'`);

test("board never overlaps the keyboard, from 6 rows up to 10", async ({ page }) => {
  await signIn(page, "frank", "/play");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("board")).toBeVisible();
  await page.waitForTimeout(500);

  await expectFits(page, 6); // fresh game: 6 rows reserved up front
  for (const guesses of [6, 7, 9]) { // history of N guesses + the active row
    setHistory("frank", guesses);
    await page.reload();
    await expect(page.getByTestId("board")).toBeVisible();
    await page.waitForTimeout(400);
    await expectFits(page, Math.max(6, guesses + 1));
  }
});
