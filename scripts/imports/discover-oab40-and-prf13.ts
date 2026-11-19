import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    // 1. 40º EOU Tipo 1 Booklet
    const p1 = await browser.newPage();
    await p1.goto("https://oab.fgv.br/home.aspx?key=643", { waitUntil: "networkidle", timeout: 30000 });
    const sel = p1.locator("select").first();
    if (await sel.count()) {
      const opts = await sel.locator("option").allTextContents();
      const sp = opts.find((t) => /OAB\s*\/\s*SP/i.test(t));
      if (sp) {
        await sel.selectOption({ label: sp });
        await p1.waitForLoadState("networkidle").catch(() => {});
        await p1.waitForTimeout(1500);
      }
    }
    const oab40Links = await p1.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().replace(/\s+/g, " "), href: (a as HTMLAnchorElement).href }))
        .filter((l) => /caderno de prova|tipo 1/i.test(`${l.text} ${l.href}`) && l.href.toLowerCase().includes(".pdf"))
    );
    console.log("40º EOU Tipo 1 candidates:", oab40Links);
    await p1.close();

    // 2. Cebraspe DPRF_13 (lowercase URL)
    const p2 = await browser.newPage();
    await p2.goto("https://www.cebraspe.org.br/concursos/dprf_13", { waitUntil: "networkidle", timeout: 30000 });
    await p2.waitForTimeout(2500);
    const prf13Links = await p2.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().replace(/\s+/g, " "), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.href.toLowerCase().includes(".pdf") && /prova|gabarito|edital|objetiva/i.test(`${l.text} ${l.href}`))
    );
    console.log(`PRF 2013 links (${prf13Links.length}):`);
    for (const l of prf13Links.slice(0, 30)) {
      console.log(`  - [${l.text}] -> ${l.href}`);
    }
    await p2.close();
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
