# B2 — Debug arquitetural

Objetivo do pipeline: os 3 terminais com maior peso total da classe **Refrigerado**, considerando todo o período.

Script: [`b2.js`](b2.js) · explains: [`b2_a_explain.json`](b2_a_explain.json) (original), [`b2_c_explain.json`](b2_c_explain.json) (corrigido) · saídas: [`b2_a_saida.json`](b2_a_saida.json), [`b2_a_ate_limit.json`](b2_a_ate_limit.json), [`b2_c_saida.json`](b2_c_saida.json), [`b2_prova_js.json`](b2_prova_js.json)

## a) Rodando exatamente como está

```js
db.movimentacoes.aggregate([
  { $project: { terminal: 1, classe: 1 } },
  { $group: { _id: { terminal: "$terminal", classe: "$classe" }, kg_total: { $sum: "peso_kg" }, mov: { $sum: 1 } } },
  { $limit: 3 },
  { $sort: { kg_total: -1 } },
  { $match: { "_id.classe": "Refrigerado" } }
])
```

Saída:

```js
{ _id: { terminal: "T2", classe: "Refrigerado" }, kg_total: 0, mov: 19978 }
{ _id: { terminal: "T4", classe: "Refrigerado" }, kg_total: 0, mov: 19852 }
```

Roda sem erro, mas está tudo errado:
- devolveu **2** terminais em vez de 3;
- o peso total é **0**;
- o T3, que é o primeiro de verdade, nem aparece, e o T4 é o penúltimo.

Rodando só até o `$limit` dá pra ver o que aconteceu: o `$limit` pegou `T1/Perigoso`, `T2/Refrigerado` e `T4/Refrigerado`, ou seja, os 3 primeiros grupos que o `$group` soltou. O `$match` do fim jogou fora o de Perigoso e sobraram 2.

O explain mostra que o `$group` recebeu os **400.000** docs (COLLSCAN, `totalDocsExamined: 400000`, sem índice). Mostra também como o servidor interpretou o acumulador: `kg_total: { $sum: { $const: "peso_kg" } }`, ou seja, uma **constante de texto**, não o campo.

## b) Defeitos

| # | Defeito | Tipo | Por quê |
|---|---|---|---|
| 1 | `$sum: "peso_kg"` sem o `$` | **Lógica** | Sem `$`, é a string literal `"peso_kg"` (o explain mostra `$const`). O `$sum` ignora valores não numéricos, então soma 0 pra todo mundo. |
| 2 | `$project` no começo sem `peso_kg` | **Lógica** (e desempenho) | Ele joga fora o campo que vai ser somado. Mesmo corrigindo o `$`, o `$sum: "$peso_kg"` continuaria dando 0, porque o campo não existe mais quando chega no `$group`. Além disso, é um estágio desnecessário: o aggregate já faz a análise de dependências e projeta sozinho só o que precisa. |
| 3 | `$limit: 3` antes do `$sort` | **Lógica** | O `$group` não devolve os grupos em ordem nenhuma. O `$limit` corta 3 grupos **quaisquer** dos 20, e o `$sort` depois só ordena esses 3. O "top 3" não é top de nada. |
| 4 | `$match` de classe no fim | **Lógica** e **desempenho** | Lógica: como vem depois do `$limit`, ele filtra os 3 que sobraram e devolve menos de 3 (aqui, 2). Desempenho: o filtro que poderia ir pro índice só roda depois de varrer e agrupar a coleção inteira (400 mil docs e COLLSCAN, em vez de ~100 mil chaves). |
| 5 | Agrupar por `{terminal, classe}` | **Desempenho** | Só existe porque o filtro de classe ficou pro fim. Cria **20 grupos** em vez de 5, todos acumulando em memória (1.920 bytes por acumulador contra 480 no corrigido), sendo que 15 deles seriam descartados. Também deixa a saída com `_id` composto em vez de um campo `terminal`. |
| 6 | Nenhum índice aproveitado | **Desempenho** | Consequência do 2, 4 e 5: com o primeiro estágio sendo um `$project`, não tem filtro nenhum pra mandar pro índice, e o plano vira COLLSCAN. |

Curiosidade do explain: o otimizador do Mongo trocou a ordem do `$sort` e do `$match` do fim (o plano real ficou `$group → $limit → $match → $sort`). Ele pode fazer isso porque filtrar antes de ordenar dá o mesmo resultado. Mas ele **não** pode passar o `$match` pra antes do `$limit`, porque isso muda o resultado. Então o otimizador não salva o pipeline: os erros de lógica precisam ser corrigidos na mão.

## c) Pipeline corrigido

```js
db.movimentacoes.aggregate([
  { $match: { classe: "Refrigerado" } },                                              // 1º: filtra (usa índice)
  { $group: { _id: "$terminal", kg_total: { $sum: "$peso_kg" }, mov: { $sum: 1 } } },  // por terminal, com $
  { $sort: { kg_total: -1 } },                                                         // ordena antes de cortar
  { $limit: 3 },
  { $project: { _id: 0, terminal: "$_id", kg_total: 1, mov: 1 } }                      // projeção só no fim
])
```

Saída:

| terminal | kg_total | mov |
|---|---|---|
| T3 | 323.503.944 | 20.151 |
| T2 | 321.502.486 | 19.978 |
| T1 | 321.374.184 | 19.953 |

**Prova de que está certo:** fiz a mesma conta sem `$group`, varrendo os documentos Refrigerado com `find().forEach()` e somando em JavaScript ([`b2_prova_js.json`](b2_prova_js.json)). Deu exatamente os mesmos números, com T5 (318.443.597) e T4 (317.995.417) em 4º e 5º. O `mov` do T2 (19.978) também bate com o Código de Autenticidade (`LP-240087832-19978-…`), que conta exatamente T2 + Refrigerado.

| Métrica | original | corrigido |
|---|---|---|
| Plano do `$cursor` | PROJECTION_SIMPLE → COLLSCAN | PROJECTION_COVERED → IXSCAN |
| totalDocsExamined | 400.000 | **0** |
| totalKeysExamined | 0 | 99.885 |
| Docs que entram no `$group` | 400.000 | 99.885 |
| Grupos criados | 20 | 5 |
| Memória dos acumuladores | 1.920 B cada | 480 B cada |
| executionTimeMillis (`$cursor`) | 339 | 67 |

O corrigido usa o mesmo índice da B1, `{classe, ts, terminal, peso_kg}`, com `classe` igual a Refrigerado e `ts` de MinKey a MaxKey. Como `terminal` e `peso_kg` estão no índice, nenhum documento é lido. Não precisei criar índice novo para a B2.

## d) Impacto em RAM, CPU e índices

No pipeline original, o Mongo lia os 400 mil documentos, montava uma cópia projetada de cada um e jogava tudo no `$group`, que mantinha 20 grupos com acumuladores na memória, só para no fim descartar a maior parte do trabalho. Colocando o `$match` primeiro, o filtro vira bound de índice: o servidor só toca nas ~100 mil chaves de Refrigerado, que já estão separadas na B-Tree, e como o índice tem `terminal` e `peso_kg` ele nem abre o documento (0 docs examinados). Isso derruba o uso de CPU (menos documentos para desserializar, projetar e agrupar; o tempo caiu de ~340 ms para ~67 ms) e de RAM (5 grupos em vez de 20, sem puxar documentos inteiros pro cache só para jogar fora; e o `$sort` + `$limit` juntos viram um top-k de 3 em cima de 5 grupos). Com mais dados, isso pesa também no limite de 100 MB por estágio: um `$group` com muitos grupos inúteis chega mais rápido no ponto de precisar de disco (`allowDiskUse`), enquanto filtrando antes ele continua pequeno.

---

# Auditoria de índices — fim das Partes A e B

Saída: [`indices_fim_partes_A_B.txt`](indices_fim_partes_A_B.txt)

| Índice em `movimentacoes` | Usado em |
|---|---|
| `_id_` | padrão |
| `terminal_1_classe_1_peso_kg_-1_ts_1` | A1 (ESR) |
| `posicao_2dsphere` | A2 |
| `tipo_1_terminal_1_container_1` | A4 (coberta) |
| `classe_1_ts_1_terminal_1_peso_kg_1` | B1 e B2 corrigido (coberto nos dois) |

Cinco índices, e cada um é o plano vencedor de pelo menos uma questão. Não sobrou nenhum índice de teste. Em `alertas`, fica só o `_id_` e o TTL `registrado_em_1` (A3).
