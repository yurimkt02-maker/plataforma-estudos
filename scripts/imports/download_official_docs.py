#!/usr/bin/env python3
"""
Baixa documentos oficiais públicos legitimamente disponíveis (Vunesp stream,
Cebraspe CDN, FGV OAB) e extrai texto/metadados para auditoria e importação.
Nunca contorna WAF, CAPTCHA ou login.
"""

import hashlib
import urllib.request
import urllib.error
from pathlib import Path
import fitz  # PyMuPDF

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/pdf,application/octet-stream,*/*",
}


def download_pdf(url: str, dest: Path) -> tuple[bool, str, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            if not data.startswith(b"%PDF"):
                return False, f"Conteúdo não-PDF ({ctype}, {len(data)} bytes)", ""
            dest.write_bytes(data)
            digest = hashlib.sha256(data).hexdigest()
            return True, f"OK ({len(data)} bytes, {ctype})", digest
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} {e.reason}", ""
    except Exception as e:
        return False, str(e), ""


def dump_pdf_text(path: Path, max_pages: int = 10) -> str:
    doc = fitz.open(str(path))
    parts = [f"=== PDF: {path.name} | Páginas: {len(doc)} ==="]
    for i in range(min(len(doc), max_pages)):
        parts.append(f"\n--- PÁGINA {i + 1} ---\n" + doc[i].get_text("text"))
    doc.close()
    return "\n".join(parts)


def main() -> None:
    targets = [
        (
            "VUNESP TJSP2401 Gabarito Definitivo 24/11/2024",
            "https://documento.vunesp.com.br/documento/stream/NjY2ODM2OA%3D%3D",
            Path("acervo/tjsp_2024/vunesp_tjsp2401_gabarito_definitivo_24_11_2024.pdf"),
            True,
        ),
        (
            "CEBRASPE PRF 2021 Prova Língua Inglesa (Itens 1-8)",
            "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/578_PRF_ING_01.PDF",
            Path("acervo/prf_2021/578_PRF_ING_01.PDF"),
            False,
        ),
        (
            "CEBRASPE PRF 2021 Gabarito Definitivo Inglês",
            "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/GAB_DEFINITIVO_578_PRF_ING_01.PDF",
            Path("acervo/prf_2021/GAB_DEFINITIVO_578_PRF_ING_01.PDF"),
            True,
        ),
        (
            "CEBRASPE PRF 2021 Prova Língua Espanhola (Itens 1-8)",
            "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/578_PRF_ESP_02.PDF",
            Path("acervo/prf_2021/578_PRF_ESP_02.PDF"),
            False,
        ),
        (
            "CEBRASPE PRF 2021 Gabarito Definitivo Espanhol",
            "https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/GAB_DEFINITIVO_578_PRF_ESP_02.PDF",
            Path("acervo/prf_2021/GAB_DEFINITIVO_578_PRF_ESP_02.PDF"),
            True,
        ),
    ]

    for label, url, dest, dump in targets:
        ok, msg, sha = download_pdf(url, dest)
        print(f"\n[{label}] -> {msg}")
        if ok:
            print(f"   Salvo em: {dest} | SHA-256: {sha}")
            if dump:
                print(dump_pdf_text(dest, max_pages=5))


if __name__ == "__main__":
    main()
