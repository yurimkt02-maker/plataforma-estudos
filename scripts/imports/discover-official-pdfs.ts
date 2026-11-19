import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  async function listPdfLinks(url: string, label: string) {
    console.log(`\n=== ${label}: ${url} ===`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2500);
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href]"))
          .map((a) => ({
            text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
            href: (a as HTMLAnchorElement).href,
          }))
          .filter((l) => l.href.toLowerCase().includes(".pdf"));
      });
      console.log(`Found ${links.length} PDF links:`);
      for (const l of links) {
        if (
          /prova|gabarito|caderno|objetiva|definitivo|branca|tipo 1/i.test(
            `${l.text} ${l.href}`
          )
        ) {
          console.log(`  - [${l.text}] -> ${l.href}`);
        }
      }
    } catch (err) {
      console.error(`Error on ${label}:`, err instanceof Error ? err.message : err);
    }
  }

  await listPdfLinks("https://www.cebraspe.org.br/concursos/prf_18", "CEBRASPE PRF 2018/2019");
  await listPdfLinks("https://examedeordem.oab.org.br/EditaisProvas?NumeroExame=41", "OAB 41o EXAME (OAB.ORG.BR)");

  await browser.close();
}

main();
