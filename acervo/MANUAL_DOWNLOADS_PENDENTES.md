# Documentos Oficiais Pendentes de Download Manual (Vunesp)

Os portais da **Fundação Vunesp** (`vunesp.com.br` e `documento.vunesp.com.br`) aplicam proteção anti-automação (HTTP 403 / WAF) e exigem acesso via **Área do Candidato** para download de cadernos de prova. Conforme as regras de conformidade da plataforma, nenhuma restrição de acesso é contornada automaticamente.

## Arquivos necessários para completar 100% de TJSP e PCSP

Salve os PDFs oficiais baixados legitimamente nas pastas abaixo:

### 1. TJSP 2024 — Escrevente Técnico Judiciário (`TJSP2401`)
- **Aplicação 08/09/2024 (2ª a 10ª RAJs — Interior e Litoral):**
  - `acervo/tjsp_2024/tjsp2401_08_09_2024_prova_v1.pdf`
  - `acervo/tjsp_2024/tjsp2401_08_09_2024_gabarito_definitivo.pdf` (anuladas: 26, 30, 64, 98)
- **Aplicação 24/11/2024 (1ª RAJ — Comarca da Capital / Reaplicação):**
  - `acervo/tjsp_2024/tjsp2401_24_11_2024_prova_v1.pdf`
  - `acervo/tjsp_2024/tjsp2401_24_11_2024_gabarito_definitivo.pdf` (URL oficial: `https://documento.vunesp.com.br/documento/stream/NjY2ODM2OA%3D%3D` — anuladas: 21 e 80)

### 2. TJSP 2025 — Escrevente Técnico Judiciário (se aplicável à edição vigente)
- `acervo/tjsp_2025/tjsp2025_prova_v1.pdf`
- `acervo/tjsp_2025/tjsp2025_gabarito_definitivo.pdf`

### 3. PCSP 2023 — Investigador de Polícia (`PCSP2304`)
- `acervo/pcsp_2023/pcsp2304_investigador_prova_v1.pdf`
- `acervo/pcsp_2023/pcsp2304_investigador_gabarito_definitivo.pdf`

### 4. PCSP 2023 — Escrivão de Polícia (`PCSP2305`)
- `acervo/pcsp_2023/pcsp2305_escrivao_prova_v1.pdf`
- `acervo/pcsp_2023/pcsp2305_escrivao_gabarito_definitivo.pdf`

## Como importar após salvar os PDFs

1. Extraia o caderno e o gabarito com o extrator PyMuPDF:
   ```powershell
   python scripts/imports/extract_pdf_exam.py --exam-pdf <CAMINHO_PROVA.pdf> --key-pdf <CAMINHO_GABARITO.pdf> --edition <EDITION_CODE> --version "Versão 1" --out <SAIDA.json>
   ```
2. Ou utilize a interface administrativa em `/admin/importacoes` para subir e auditar o lote antes da publicação.
