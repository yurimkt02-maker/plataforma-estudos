# Downloads Manuais Pendentes — TJSP e PCSP (Fundação Vunesp)

> **Motivo:** Todos os 7 endereços oficiais da Vunesp (`www.vunesp.com.br/TJSP2503`, `TJSP2401`, `TJSP2301`, `TJSP2201`, `PCSP2304`, `PCSP2305`, `PCSP1702`) e `documento.vunesp.com.br` retornam `HTTP 403 Forbidden` a requisições automatizadas (WAF) e disponibilizam os cadernos de prova na **Área do Candidato**. Nenhuma restrição de acesso é contornada.

Todas as 8 edições abaixo já estão cadastradas no Prisma Postgres e prontas para importação direta pelo navegador em **`https://plataforma-estudos-virid.vercel.app/admin/importacoes`**, com armazenamento privado, prévia comparativa lado a lado com o PDF original e conferência humana obrigatória antes de publicar.

---

## Relação Completa dos 16 PDFs (8 Cadernos de Prova + 8 Gabaritos Definitivos)

### TJSP — Escrevente Técnico Judiciário (5 edições)

| # | Concurso / Região | Edital | Data de Aplicação | Código no `/admin/importacoes` | Nome Sugerido do PDF da Prova | Nome Sugerido do PDF do Gabarito Definitivo | Link Oficial |
|---|---|---|---|---|---|---|---|
| 1 | **TJSP 2025** | `TJSP2503` | 07/12/2025 | `TJSP-2025-ESCREVENTE` | `tjsp2503_2025_prova_v1.pdf` | `tjsp2503_2025_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/TJSP2503 |
| 2 | **TJSP 2024 — Capital (1ª RAJ, Reaplicação)** | `TJSP2401` | 24/11/2024 | `TJSP-2024-ESCREVENTE-CAPITAL` | `tjsp2401_24_11_2024_capital_prova_v1.pdf` | `tjsp2401_24_11_2024_capital_gabarito_definitivo_v1.pdf` *(anuladas `#21, #80`)* | https://www.vunesp.com.br/TJSP2401 |
| 3 | **TJSP 2024 — Interior e Litoral (2ª–10ª RAJs)** | `TJSP2401` | 08/09/2024 | `TJSP-2024-ESCREVENTE` | `tjsp2401_08_09_2024_interior_prova_v1.pdf` | `tjsp2401_08_09_2024_interior_gabarito_definitivo_v1.pdf` *(anuladas `#26, #30, #64, #98`)* | https://www.vunesp.com.br/TJSP2401 |
| 4 | **TJSP 2023 — Interior** | `TJSP2301` | 02/07/2023 | `TJSP-2023-ESCREVENTE-INTERIOR` | `tjsp2301_02_07_2023_interior_prova_v1.pdf` | `tjsp2301_02_07_2023_interior_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/TJSP2301 |
| 5 | **TJSP 2023 — Capital** | `TJSP2201` | 28/05/2023 | `TJSP-2023-ESCREVENTE-CAPITAL` | `tjsp2201_28_05_2023_capital_prova_v1.pdf` | `tjsp2201_28_05_2023_capital_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/TJSP2201 |

### PCSP — Investigador e Escrivão de Polícia (3 edições)

| # | Concurso / Cargo | Edital | Data de Aplicação | Código no `/admin/importacoes` | Nome Sugerido do PDF da Prova | Nome Sugerido do PDF do Gabarito Definitivo | Link Oficial |
|---|---|---|---|---|---|---|---|
| 6 | **PCSP 2023 — Investigador** | `PCSP2304` | 26/11/2023 | `PCSP-2023-INVESTIGADOR` | `pcsp2304_2023_investigador_prova_v1.pdf` | `pcsp2304_2023_investigador_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/PCSP2304 |
| 7 | **PCSP 2023 — Escrivão** | `PCSP2305` | 26/11/2023 | `PCSP-2023-ESCRIVAO` | `pcsp2305_2023_escrivao_prova_v1.pdf` | `pcsp2305_2023_escrivao_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/PCSP2305 |
| 8 | **PCSP 2018 — Investigador** | `PCSP1702` | 10/06/2018 | `PCSP-2018-INVESTIGADOR` | `pcsp1702_2018_investigador_prova_v1.pdf` | `pcsp1702_2018_investigador_gabarito_definitivo_v1.pdf` | https://www.vunesp.com.br/PCSP1702 |

---

## Como Importar pelo Painel `/admin/importacoes` (Passo a Passo Simples)

1. Baixe o par de PDFs (Caderno de Prova **Versão 1** + **Gabarito Oficial Definitivo** correspondente à mesma data e versão) na página oficial da Vunesp acima.
2. Acesse **`https://plataforma-estudos-virid.vercel.app/admin/importacoes`** (autenticado como proprietário).
3. Selecione o **Concurso / Edição Oficial** (conforme a coluna *Código no `/admin/importacoes`*), a versão **`Versão 1`** e o formato **`Múltipla Escolha (Vunesp A–E / FGV A–D)`**.
4. Anexe o **PDF do Caderno de Prova** e o **PDF do Gabarito Oficial Definitivo** e clique em **"Enviar PDFs e Gerar Prévia"**.
5. **Conferência obrigatória antes da publicação:**
   - Na barra **"Conferência Independente dos Documentos Oficiais e Gabarito Definitivo"**, marque os 3 checkboxes (edição/data, versão do caderno e integridade do gabarito) e clique em **"Confirmar Documentos e Gabarito"**.
   - Compare cada questão com o **PDF original embutido à direita** (clique em `Pág. N` para ir direto à página da questão).
   - Corrija enunciado/alternativas se necessário, selecione a **disciplina** (itens em `CLASSIFICATION_PENDING` ou com figura/tabela pendente são bloqueados), marque **"Conferi o gabarito oficial definitivo"** e clique em **"Salvar e Aprovar (VERIFIED)"** (ou **"Rejeitar Item"**).
6. Clique em **"Publicar Itens Verificados (N)"** — somente as questões explicitamente aprovadas como `VERIFIED` serão publicadas no Prisma Postgres.
