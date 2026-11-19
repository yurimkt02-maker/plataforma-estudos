# Pipeline de Importação de Provas e Questões Reais

## 1. Princípios de Integridade Documental

1. **Zero Questões Fictícias**: Nenhuma questão gerada por IA ou sem origem documental verificável pode ser publicada como questão oficial.
2. **Preservação de Versão de Caderno (`ExamForm`)**: Cada questão extraída é vinculada à versão exata do caderno (ex.: `Versão 1`, `Tipo 1 - Branca`, `Caderno Padrão`) antes da associação com o gabarito.
3. **Deduplicação por Hash Canônico (`canonicalHash`)**: Quando a mesma questão aparece em diferentes versões de caderno, o registro base `Question` é único e cada versão recebe sua própria `ExamQuestionInstance` com seu `optionMapping` e `OfficialAnswerKey`.

## 2. Extração Local com Python + PyMuPDF

Para processar PDFs oficiais de provas e gabaritos sem depender dos limites de memória e tempo das requisições HTTP na Vercel:

```bash
pip install pymupdf
python scripts/imports/extract_pdf_exam.py \
  --exam-pdf ./provas/tjsp_2024_v1.pdf \
  --answer-key-pdf ./provas/tjsp_2024_gabarito.pdf \
  --edition-code TJSP-2024-ESCREVENTE \
  --version-label "Versão 1" \
  --question-type MULTIPLE_CHOICE \
  --exam-url "https://www.vunesp.com.br/TJSP2401" \
  --answer-key-url "https://www.vunesp.com.br/TJSP2401" \
  --output import_payload.json
```

## 3. Validação e Publicação (`/admin/importacoes`)

1. Envie o pacote extraído para `POST /api/admin/imports`.
2. O validador (`src/features/imports/pipeline.ts`) verifica cada item e bloqueia enunciados truncados, alternativas ausentes, gabaritos incompatíveis ou documentos sem SHA-256.
3. Após revisão em `/admin/importacoes`, aprove a publicação via `POST /api/admin/imports/:id/approve`.
