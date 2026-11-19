import { chromium } from "@playwright/test";

const REMAINING = [
  { key: 645, examNum: 42, year: 2024 },
  { key: 643, examNum: 40, year: 2024 },
  { key: 640, examNum: 37, year: 2023 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const item of REMAINING) {
      const page = await browser.newPage();
      try {
        await page.goto(`https://oab.fgv.br/home.aspx?key=${item.key}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        const select = page.locator("select").first();
        if (await select.count()) {
          const opts = await select.locator("option").allTextContents();
          const spOpt = opts.find((t) => /OAB\s*\/\s*SP/i.test(t));
          if (spOpt) {
            await select.selectOption({ label: spOpt });
            await page.waitForLoadState("networkidle").catch(() => {});
            await page.waitForTimeout(2000);
          }
        }
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .map((a) => ({
              text: (a.textContent || "").trim().replace(/\s+/g, " "),
              href: (a as HTMLAnchorElement).href,
            }))
            .filter((l) => l.href.toLowerCase().includes(".pdf"))
        );
        const tipo1 = links.find(
          (l) =>
            /caderno de prova.*tipo\s*1/i.test(l.text) ||
            (/tipo\s*1/i.test(`${l.text} ${l.href}`) &&
              !/direito|padrão|prático|2ª fase|comentado/i.test(l.text) &&
              /prova|caderno|cns01/i.test(`${l.text} ${l.href}`))
        );
        const gabDef =
          links.find(
            (l) =>
              /gabaritos?\s*definitivos?/i.test(l.text) &&
              !/2ª fase|prático/i.test(l.text)
          ) ??
          links.find(
            (l) =>
              /gabarito.*definitivo/i.test(`${l.text} ${l.href}`) &&
              !/2ª fase|prático/i.test(l.text)
          );
        console.log(
          `[${item.examNum}º EOU | ${item.year} | key=${item.key}] Tipo1=${tipo1?.href ?? "N/A"} | GabDef=${gabDef?.href ?? "N/A"} | TotalPDFs=${links.length}`
        );
        if (!tipo1 || !gabDef) {
          console.log(
            "  Candidates:",
            links
              .filter((l) => /tipo\s*1|gabarito|prova/i.test(`${l.text} ${l.href}`))
              .slice(0, 12)
              .map((l) => `[${l.text}] -> ${l.href}`)
          );
        }
      } finally {
        await page.close();
      }
    }

    // Check PRF 2013 on Cebraspe (cespe.unb.br / cdn.cebraspe.org.br/concursos/DPRF_13/arquivos/)
    const prfRes = await fetch("https://www.cebraspe.org.br/concursos/dprf_13");
    console.log("\nCebraspe dprf_13 status:", prfRes.status);
    // Also check Cebraspe API for DPRF_13
    const apiRes = await fetch(
      "https://api.cebraspe.org.br/eventos/DPRF_13"
    ).catch(() => null);
    if (apiRes) {
      console.log("Cebraspe API DPRF_13 status:", apiRes.status);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
