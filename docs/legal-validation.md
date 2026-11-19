# Sistema de Explicações Jurídicas Verificáveis

## 1. Regra de Ouro

**A inteligência artificial explica, mas jamais determina ou altera o gabarito oficial da banca organizadora.**

## 2. Regras de Auditoria (`src/features/legal-knowledge/validator.ts`)

Todo comentário produzido ou atualizado passa pela função determinística `validateLegalExplanation`, que aplica 4 verificações obrigatórias:

1. **Consistência com o Gabarito Oficial**: Se a conclusão do comentário divergir do gabarito oficial definitivo da banca, o comentário é imediatamente classificado como `DIVERGENCE_IDENTIFIED` e bloqueado de publicação como verificado.
2. **Existência Documental das Fontes Citadas**: Toda citação (`ExplanationCitation`) deve referenciar um `LegalSource` e `LegalPassage` reais cadastrados no catálogo (`Planalto`, `Alesp`, `STF`, `STJ`). Citações de fontes inexistentes resultam em `REVIEW_REQUIRED`.
3. **Presença de Evidência Suficiente**: Comentários sem ao menos uma fonte oficial verificada vinculada permanecem em `PENDING_VERIFICATION` e nunca recebem o selo `VERIFIED`.
4. **Vigência Temporal (Época da Prova vs. Atual)**: O validador verifica `effectiveTo` e `isCurrentlyInForce` das passagens normativas. Caso o dispositivo citado tenha sofrido revogação ou alteração superveniente (ex.: Lei nº 14.230/2021 na Lei de Improbidade Administrativa), o comentário é marcado como `POSSIBLY_OUTDATED` e exige exibição separada de `historicalUnderstanding` e `currentUnderstanding`.
