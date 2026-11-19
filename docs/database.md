# Modelagem do Banco de Dados (Prisma Postgres)

## 1. Domínios Modelados (`prisma/schema.prisma`)

O esquema possui **34 modelos normalizados** com chaves primárias `UUID` (`@default(uuid()) @db.Uuid`), constraints de integridade referencial e índices compostos:

1. **Autenticação e Preferências**:
   - `User`, `UserSettings`
2. **Catálogo Acadêmico (Seção 6.1)**:
   - `StudyTrack` (`TJSP`, `PCSP`, `PRF`, `OAB`)
   - `Institution` (`TJSP`, `PCSP`, `PRF`, `CFOAB`)
   - `ExamBoard` (`VUNESP`, `CEBRASPE`, `FGV`)
   - `Position`, `ExamEdition`, `ExamForm`, `Subject`, `QuestionSubject`
3. **Banco de Questões e Gabaritos Versionados (Seção 6.2)**:
   - `Question` (deduplicada por `canonicalHash` SHA-256)
   - `QuestionOption`, `QuestionAsset`
   - `ExamQuestionInstance` (vincula a questão à versão específica do caderno `ExamForm`, número original e `optionMapping`)
   - `QuestionRevision`
   - `OfficialAnswerKey` (histórico imutável de revisões: `PRELIMINARY`, `DEFINITIVE`, `RECTIFIED`, `ANNULLED`, `PENDING_VERIFICATION`)
4. **Histórico do Usuário e Revisão Espaçada (Seção 6.3)**:
   - `StudySession`, `QuestionAttempt`, `UserProgress`, `ReviewQueue`, `Bookmark`, `StudyNote`, `SavedFilter`
5. **Simulados e Regras de Edital (Seção 6.4)**:
   - `ExamRuleset`, `Simulation`, `SimulationItem`, `SimulationAttempt`, `SimulationResponse`
6. **Cadernos Personalizados e Caderno Automático de Erros (Seção 6.5)**:
   - `Notebook`, `NotebookQuestion`
7. **Importação e Auditoria Documental (Seção 6.6)**:
   - `SourceDocument` (com hash `sha256` único), `QuestionSource` (até o nível de página do PDF), `ImportJob`, `ImportJobItem`, `ContentReviewLog`
8. **Conhecimento Jurídico Verificável (Seção 6.7)**:
   - `LegalSource`, `LegalPassage`, `QuestionExplanation`, `ExplanationCitation`, `LegalUpdateCheck`

## 2. Full Text Search em Português

A migration inicial (`prisma/migrations/20261119100000_init/migration.sql`) cria o índice GIN nativo do PostgreSQL para busca textual em português:

```sql
CREATE INDEX IF NOT EXISTS "Question_fts_pt_idx"
ON "Question"
USING GIN (to_tsvector('portuguese', coalesce("statement", '') || ' ' || coalesce("supportText", '')));
```

## 3. Procedimento de Backup e Restauração

Para exportar um snapshot completo do desempenho, anotações, cadernos e explicações verificadas com checksum SHA-256:

```bash
npm run db:backup
```

Os arquivos são gravados em `backups/backup-<timestamp>.json`.
