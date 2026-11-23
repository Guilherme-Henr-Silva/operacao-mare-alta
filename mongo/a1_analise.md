# A1 — Painel do pátio

```js
db.movimentacoes.find({
  terminal: "T2", classe: "Refrigerado", ts: { $gte: ISODate("2026-04-01T00:00:00Z") }
}).sort({ peso_kg: -1 }).limit(20)
```

Script: [`a1.js`](a1.js) · explains completos: [`a1_a_explain.json`](a1_a_explain.json), [`a1_b_explain.json`](a1_b_explain.json), [`a1_c_explain.json`](a1_c_explain.json) · resultado: [`a1_resultado.txt`](a1_resultado.txt)

Comandos de índice usados:

```js
// b)
db.movimentacoes.createIndex({ terminal: 1, classe: 1, ts: 1, peso_kg: -1 })
// c)
db.movimentacoes.dropIndex({ terminal: 1, classe: 1, ts: 1, peso_kg: -1 })
db.movimentacoes.createIndex({ terminal: 1, classe: 1, peso_kg: -1, ts: 1 })   // ESR
```

## d) Comparação

| Métrica | a) sem índice | b) `{terminal, classe, ts, peso_kg:-1}` | c) ESR `{terminal, classe, peso_kg:-1, ts}` |
|---|---|---|---|
| Plano (de cima pra baixo) | SORT → COLLSCAN | FETCH → SORT → IXSCAN | LIMIT → FETCH → IXSCAN |
| totalDocsExamined | 400.000 | 20 | 20 |
| totalKeysExamined | 0 | 13.973 | 28 |
| nReturned | 20 | 20 | 20 |
| SORT em memória | sim (13.973 docs inteiros) | sim (13.973 chaves) | **não** |
| executionTimeMillis | 1437 | 34 | 2 |

13.973 é exatamente a quantidade de documentos que batem com o filtro (é o `nReturned` do COLLSCAN na a e do IXSCAN na b).

## Por que b) e c) são diferentes

A B-Tree guarda as chaves ordenadas campo por campo, na ordem em que o índice foi declarado.

**Índice b `{terminal, classe, ts, peso_kg}`:** dentro do bloco `T2 / Refrigerado`, as chaves ficam ordenadas por `ts`, e o `peso_kg` só desempata quando o `ts` é igual. Como o `ts` tem milissegundo, ele praticamente nunca se repete. Então, olhando a faixa `ts >= 2026-04-01`, os pesos aparecem fora de ordem. O índice serve para **achar** os documentos (o IXSCAN lê só as 13.973 chaves certas em vez de 400 mil docs), mas não serve para **ordenar**. Por isso aparece o estágio `SORT` (top-k com `limitAmount: 20`). Ele precisa ver todas as 13.973 chaves para ter certeza de quais são as 20 mais pesadas.

Detalhe que eu não esperava: o SORT ficou **antes** do FETCH. Como `peso_kg` está dentro do índice, o Mongo ordenou só as chaves (`totalDataSizeSorted` = 1.920 bytes) e foi no disco buscar só os 20 vencedores. Por isso deu `totalDocsExamined: 20`. Mesmo assim, ele examinou 13.973 chaves e fez a ordenação na memória.

**Índice c (ESR) `{terminal, classe, peso_kg:-1, ts}`:**
- **E**quality primeiro: `terminal` e `classe` fixam um bloco contínuo da árvore.
- **S**ort depois: dentro desse bloco, as chaves já estão em `peso_kg` decrescente, que é a ordem que o `.sort()` pede. Não sobra trabalho de ordenação, e o plano não tem SORT.
- **R**ange por último: o `ts >= DATA_CORTE` vira um bound aplicado na própria chave. O IXSCAN anda do mais pesado pro mais leve e descarta as chaves com `ts` antigo sem buscar o documento (`seeks: 9` no explain). Quando junta 20, o LIMIT para tudo.

Resultado: 28 chaves lidas (20 que passaram + 8 com `ts` antes de abril), 20 documentos buscados e nenhuma ordenação. Os 8 descartados batem com a conta: ~30% das chaves têm `ts` antigo, e 28 × 0,3 ≈ 8.

Resumindo: no índice b o campo de range vem antes do campo de sort, e isso "quebra" a ordem do sort dentro da B-Tree. A regra ESR põe o range por último justamente para o índice continuar entregando os dados já ordenados.

Ficou na coleção só o índice ESR (`terminal_1_classe_1_peso_kg_-1_ts_1`), que é o que a A1 precisa.
