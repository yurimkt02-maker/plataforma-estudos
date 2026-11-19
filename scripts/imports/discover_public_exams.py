#!/usr/bin/env python3
"""
Descobre links públicos diretos de PDFs oficiais nos portais públicos do
Cebraspe (PRF 2018/2019) e OAB/FGV (41º Exame de Ordem).
Respeita qualquer bloqueio HTTP 403/401 sem contornar proteções.
"""

import re
import urllib.request
import urllib.error

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
}


def inspect_page(label: str, url: str) -> None:
    print(f"\n=== {label} ({url}) ===")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            pdfs = sorted(set(re.findall(r'https?://[^\s"\'<>]+\.pdf', html, flags=re.IGNORECASE)))
            rel_pdfs = sorted(set(re.findall(r'href=["\']([^"\']+\.pdf[^"\']*)["\']', html, flags=re.IGNORECASE)))
            print(f"HTTP {resp.status} | Abs PDFs: {len(pdfs)} | Rel PDFs: {len(rel_pdfs)}")
            for u in (pdfs + rel_pdfs)[:30]:
                print("  ", u)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f"Erro: {e}")


def main() -> None:
    inspect_page("Cebraspe PRF 2018/2019", "https://www.cebraspe.org.br/concursos/prf_18")
    inspect_page("OAB FGV 41º Exame", "https://oab.fgv.br/NovoSecao.aspx?id=207&key=207")
    inspect_page("OAB FGV Home", "https://oab.fgv.br/")
    inspect_page("Exame de Ordem OAB.org.br", "https://examedeordem.oab.org.br/EditaisProvas?NumeroExame=41")


if __name__ == "__main__":
    main()
