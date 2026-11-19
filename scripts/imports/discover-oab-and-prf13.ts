import fs from "node:fs";
import { chromium } from "@playwright/test";

const OAB_KEYS: Array<{ key: number; examNum: number; year: number }> = [
  { key: 650, examNum: 47, year: 2026 },
  { key: 649, examNum: 46, year: 2026 },
  { key: 648, examNum: 45, year: 2025 },
  { key: 647, examNum: 44, year: 2025 },
  { key: 646, examNum: 43, year: 2025 },
  { key: 645, examNum: 42, year: 2024 },
  { key: 644, examNum: 41, year: 2024 },
  { key: 643, examNum: 40, year: 2024 },
  { key: 642, examNum: 39, year: 2023 },
  { key: 641, examNum: 38, year: 2023 },
  { key: 640, examNum: 37, year: 2023 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  const discovered: Array<{
    key: number;
    examNum: number;
    year: number;
    tipo1Pdf: string | null;
    gabaritoDefPdf: string | null;
    gabaritoPrelimPdf: string | null;
    editalPdf: string | null;
    allRelevantPdfs: Array<{ text: string; href: string }>;
  }> = [];

  try {
    for (const item of OAB_KEYS) {
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
            const btn = page
              .locator("input[type='submit'], button[type='submit'], input[type='button']")
              .first();
            if (await btn.count()) {
              await Promise.all([
                page.waitForLoadState("networkidle").catch(() => {}),
                btn.click(),
              ]);
              await page.waitForTimeout(1000);
            }
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
        const gabPrelim = links.find(
          (l) =>
            /gabaritos?\s*preliminares?/i.test(l.text) &&
            !/2ª fase|prático/i.test(l.text)
        );
        const edital = links.find((l) => /edital de abertura/i.test(l.text));

        discovered.push({
          key: item.key,
          examNum: item.examNum,
          year: item.year,
          tipo1Pdf: tipo1?.href ?? null,
          gabaritoDefPdf: gabDef?.href ?? null,
          gabaritoPrelimPdf: gabPrelim?.href ?? null,
          editalPdf: edital?.href ?? null,
          allRelevantPdfs: links.filter((l) =>
            /tipo\s*1|gabarito|anula|retifica|edital de abertura|comunicado/i.test(
              `${l.text} ${l.href}`
            )
          ),
        });

        console.log(
          `[${item.examNum}º EOU | ${item.year} | key=${item.key}] Tipo1=${tipo1?.href ?? "N/A"} | GabDef=${gabDef?.href ?? "N/A"} | TotalPDFs=${links.length}`
        );
        if (item.examNum === 47) {
          console.log("  47º EOU PDFs:", links.map((l) => `[${l.text}] -> ${l.href}`));
        }
      } catch (e) {
        console.log(
          `[${item.examNum}º EOU | key=${item.key}] ERRO: ${e instanceof Error ? e.message.slice(0, 80) : e}`
        );
      } finally {
        await page.close();
      }
    }

    fs.mkdirSync("acervo/oab_2023_2026", { recursive: true });
    fs.writeFileSync(
      "acervo/oab_2023_2026/discovered_oab_links.json",
      JSON.stringify(discovered, null, 2),
      "utf-8"
    );
    console.log(
      `\nSalvo acervo/oab_2023_2026/discovered_oab_links.json (${discovered.length} edições)`
    );

    // 2. PRF 2013 (Cebraspe DPRF_13)
    const prfPage = await browser.newPage();
    try {
      console.log("\n=== PRF 2013 (DPRF_13) ===");
      await prfPage.goto("https://www.cebraspe.org.br/concursos/DPRF_13", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await prfPage.waitForTimeout(2500);
      const prf13Links = await prfPage.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]"))
          .map((a) => ({
            text: (a.textContent || "").trim().replace(/\s+/g, " "),
            href: (a as HTMLAnchorElement).href,
          }))
          .filter(
            (l) =>
              l.href.toLowerCase().includes(".pdf") &&
              /prova|gabarito|edital|objetiva/i.test(`${l.text} ${l.href}`)
          )
      );
      console.log(`PRF 2013 PDFs encontrados (${prf13Links.length}):`);
      for (const l of prf13Links.slice(0, 25)) {
        console.log(`  - [${l.text}] -> ${l.href}`);
      }
      fs.mkdirSync("acervo/prf_2013", { recursive: true });
      fs.writeFileSync(
        "acervo/prf_2013/discovered_prf13_links.json",
        JSON.stringify(prf13Links, null, 2),
        "utf-8"
      );
    } finally {
      await prfPage.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
