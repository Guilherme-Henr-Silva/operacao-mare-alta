# B1 — Relatório gerencial

Script: [`b1.js`](b1.js) · explains: [`b1_sem_indice_explain.json`](b1_sem_indice_explain.json), [`b1_com_indice_explain.json`](b1_com_indice_explain.json) · resultado: [`b1_resultado.json`](b1_resultado.json) · os 5 grupos (conferência): [`b1_todos_grupos.json`](b1_todos_grupos.json)

```js
db.movimentacoes.aggregate([
  { $match: { classe: "Refrigerado", ts: { $gte: ISODate("2026-04-01T00:00:00Z") } } },
  { $group: {
      _id: "$terminal",
      total_mov:  { $sum: 1 },
      peso_total: { $sum: "$peso_kg" },
      peso_medio: { $avg: "$peso_kg" },
      maior_peso: { $max: "$peso_kg" } } },
  { $sort: { peso_total: -1 } },
  { $limit: 3 },
  { $project: { _id: 0, terminal: "$_id", total_mov: 1, peso_total: 1, peso_medio: 1, maior_peso: 1 } }
])
```

Usei só `$match`, `$group`, `$sort`, `$limit`, `$project`, `$sum`, `$avg`, `$max` e `$gte`.

## Resultado

| terminal | total_mov | peso_total (kg) | peso_medio (kg) | maior_peso (kg) |
|---|---|---|---|---|
| T3 | 14.049 | 225.871.677 | 16.077,42 | 30.997 |
| T2 | 13.973 | 225.302.634 | 16.124,14 | 30.996 |
| T1 | 13.920 | 223.426.386 | 16.050,75 | 30.999 |

Os dois que ficaram de fora: T4 (222.314.918 kg) e T5 (222.085.401 kg). O `total_mov` do T2 (13.973) é o mesmo número de documentos da A1, que usa o mesmo filtro com terminal T2. Os dois resultados batem entre si.

## Índice

```js
db.movimentacoes.createIndex({ classe: 1, ts: 1, terminal: 1, peso_kg: 1 })
```

- `classe` (igualdade) vem primeiro e `ts` (range) logo depois. Juntos, viram os bounds do IXSCAN: `classe: ["Refrigerado","Refrigerado"]`, `ts: [2026-04-01, ∞)`.
- `terminal` e `peso_kg` no fim não servem para filtrar. Estão ali porque são os **únicos campos que o `$group` usa**. O aggregate faz uma análise de dependências, percebe que só precisa de `terminal` e `peso_kg`, e o planner consegue responder tudo pelo índice (`PROJECTION_COVERED`), sem abrir nenhum documento.
- Nenhum índice da Parte A servia, porque todos começam por campos que não estão no `$match` (`terminal`, `posicao`, `tipo`).

## Prova: quantos documentos entraram no `$group`

Saída de `db.movimentacoes.explain("executionStats").aggregate([...])`:

| | sem índice | com índice |
|---|---|---|
| Plano do `$cursor` | PROJECTION_SIMPLE → COLLSCAN | PROJECTION_COVERED → IXSCAN |
| totalDocsExamined | 400.000 | **0** |
| totalKeysExamined | 0 | 69.736 |
| **`$cursor.nReturned` (docs que entram no `$group`)** | **69.736** | **69.736** |
| `$group.nReturned` | 5 | 5 |
| `$sort` + `$limit` (juntados num top-k) | 3 | 3 |
| executionTimeMillis do `$cursor` | 1330 | 109 |

O `$cursor` é a parte do pipeline que vira uma "find" por baixo (o `$match` e a projeção automática). O `nReturned` dele é exatamente o que alimenta o `$group`: **69.736 documentos**, com ou sem índice. O índice não muda **quantos** entram no `$group`, muda **como** eles são encontrados. Sem índice, ele lê os 400 mil docs e descarta 330 mil. Com o índice, ele lê só as 69.736 chaves certas e nenhum documento.

Os estágios depois do `$group` trabalham em cima de 5 documentos, então o `$sort` dali é desprezível.
