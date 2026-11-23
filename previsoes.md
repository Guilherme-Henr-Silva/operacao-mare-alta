# Previsões (pré-registro)

Cada seção foi escrita e commitada **antes** de rodar a questão. O `git log` mostra a ordem.

Parâmetros: CLASSE_ALVO = `Refrigerado`, TERMINAL_ALVO = `T2`, DATA_CORTE = `2026-04-01`.

## A1 — Painel do pátio

Consulta: `find({terminal:"T2", classe:"Refrigerado", ts:{$gte:ISODate("2026-04-01")}}).sort({peso_kg:-1}).limit(20)`

Raciocínio antes de rodar:
- O gerador sorteia terminal entre 5 valores e classe entre 4, então T2 + Refrigerado dá mais ou menos 1/20 da coleção. O código de autenticidade já mostra esse número: **19.978** docs com T2 + Refrigerado.
- O `ts` é sorteado nos primeiros 300 dias de 2026. 1º de abril é o dia 90, então sobram 210 de 300 dias = 70%. 19.978 × 0,7 ≈ **14.000 docs** batem com o filtro inteiro.
- Com o `limit(20)` o nReturned deve ser 20 nos três casos.

| | a) sem índice | b) `{terminal, classe, ts, peso_kg:-1}` | c) ESR `{terminal:1, classe:1, peso_kg:-1, ts:1}` |
|---|---|---|---|
| Stage esperado | COLLSCAN + SORT | IXSCAN → FETCH → SORT | IXSCAN → FETCH → LIMIT (sem SORT) |
| totalDocsExamined | 400.000 (a coleção toda) | ~14.000 | ~20 |
| totalKeysExamined | 0 | ~14.000 | algumas dezenas (~30) |
| SORT em memória | sim | **sim** | **não** |
| nReturned | 20 | 20 | 20 |
| executionTimeMillis | centenas de ms | dezenas de ms | ~0–5 ms |

Por que acho isso:
- **b)** O `ts` é um range e vem antes do `peso_kg` no índice. Dentro do pedaço T2/Refrigerado, as chaves ficam ordenadas primeiro por `ts` e só depois por peso. Assim, a ordem por peso só vale dentro de cada valor de ts, que é quase único. O Mongo vai ter que ler todos os ~14 mil e ordenar na memória.
- **c)** Com as igualdades primeiro e o `peso_kg` logo depois, o índice já entrega na ordem do sort. O filtro de `ts` é aplicado nas próprias chaves, e uns 70% delas passam. Então ele deve parar depois de ler umas 20/0,7 ≈ 29 chaves e buscar só os 20 documentos. Não sei direito se o contador de chaves vai somar alguma coisa a mais por causa dos "pulos" de bound no ts, por isso coloquei "algumas dezenas".
