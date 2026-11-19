import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://oab.fgv.br/home.aspx?key=644", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    console.log("URL after goto:", page.url());
    const select = page.locator("select").first();
    if (await select.count()) {
      const opts = await select.locator("option").allTextContents();
      console.log("Select options:", opts.slice(0, 10));
      const spOpt = opts.find((t) => /SP|São Paulo/i.test(t));
      if (spOpt) {
        await select.selectOption({ label: spOpt });
        const btn = page.locator("input[type='submit'], button[type='submit'], input[type='button']").first();
        if (await btn.count()) {
          await Promise.all([
            page.waitForLoadState("networkidle"),
            btn.click(),
          ]);
          await page.waitForTimeout(1500);
          console.log("URL after selecting SP:", page.url());
        }
      }
    }
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          text: (a.textContent || "").trim().replace(/\s+/g, " "),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter((l) => /pdf|prova|gabarito|branca|tipo|definitivo|objetiva/i.test(`${l.text} ${l.href}`))
    );
    console.log(`Found ${links.length} links:`);
    for (const l of links.slice(30, 57)) {
      console.log(`  - [${l.text}] -> ${l.href}`);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
  } finally {
    await browser.close();
  }
}

main();
