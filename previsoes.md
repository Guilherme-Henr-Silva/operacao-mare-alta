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

## A2 — Incidente no pátio

Ponto do Google Maps: `-25.4680, -48.4930` (lat, lon). Em GeoJSON fica `coordinates: [-48.4930, -25.4680]` (lon, lat). Se eu inverter, o ponto cai em latitude -48, longe de tudo, e a consulta volta vazia.

Consulta que vou usar: `find({posicao: {$near: {$geometry: {type:"Point", coordinates:[-48.4930, -25.4680]}, $maxDistance: 300}}}).limit(10)`

**Antes do índice:** acho que vai dar **erro**, não COLLSCAN. O `$near` precisa de índice geoespacial para conseguir ordenar por distância. A mensagem deve ser algo como "unable to find index for $geoNear query" (erro de planner, sem plano possível).

**Depois do `createIndex({posicao: "2dsphere"})`:**
- Stage esperado: `LIMIT → GEO_NEAR_2DSPHERE`, e dentro dele `FETCH → IXSCAN` sobre as células S2 do índice. Não espero estágio SORT separado: a ordenação por distância é feita pelo próprio GEO_NEAR, que vai buscando em anéis cada vez maiores.
- Quantos docs existem no raio: os pontos são uniformes num quadrado de 0,05° × 0,05° (~5,0 km × 5,55 km ≈ 27,8 km²). Um círculo de 300 m tem ~0,28 km², ou seja ~1% da área, o que dá **~4.000 docs** no raio. O ponto do incidente está longe das bordas do quadrado, então o círculo cabe inteiro.
- Mas, com o limit 10, o GEO_NEAR não deve ler todos. Ele começa num anel pequeno perto do centro. Chuto `totalDocsExamined` e `totalKeysExamined` na casa das **dezenas a poucas centenas**, bem abaixo de 4 mil. Não tenho certeza do tamanho do primeiro anel, então isso é o ponto mais incerto.
- SORT em memória: não (sem estágio SORT).
- nReturned: **10**.

## A3 — O TTL que não apaga

Observação: o gerador não cria o índice TTL. Para reproduzir o cenário, vou criar o índice do "desenvolvedor anterior" do jeito que o enunciado descreve: `createIndex({registrado_em: 1}, {expireAfterSeconds: 2592000})`.

**Hipótese principal:** o `registrado_em` foi gravado como **string** (o gerador faz `.toISOString()`). O monitor de TTL roda em segundo plano mais ou menos a cada 60 s e só apaga documentos cujo campo indexado é um **BSON Date** (ou array de Dates) mais antigo que `agora - expireAfterSeconds`. Uma string tipo `"2026-03-10T12:00:00.000Z"` parece data para a gente, mas para o Mongo é texto, e o TTL simplesmente ignora o documento. Não dá erro, não dá aviso: o índice existe e não faz nada.

Como vou provar: um `aggregate` com `$group` por `{$type: "$registrado_em"}` deve mostrar **100.000 docs do tipo "string"** e nenhum "date". Também vou rodar `getIndexes()` para mostrar que o índice TTL está lá certinho com `expireAfterSeconds: 2592000`, e assim descartar a hipótese de que "faltou criar o índice".

Hipóteses alternativas que vou descartar no caminho:
- Índice composto (o TTL só funciona em índice de campo único). Acho que não é, o enunciado fala em índice em `registrado_em`.
- Pouco tempo de espera (o monitor roda a cada 60 s). Também acho que não: o enunciado diz "horas depois". Além disso, como hoje é 23/11/2026 e todas as datas estão entre jan e out/2026, quase tudo já passou dos 30 dias e deveria ter sumido.

Correção esperada: gravar os novos alertas com `registrado_em: new Date()` (BSON Date) e manter o índice `{registrado_em: 1}` com `expireAfterSeconds: 2592000`.

## A4 — Consulta coberta

Consulta: `find({tipo:"inspecao", terminal:"T2"}, {_id:0, container:1})`

Índice que pretendo criar: `{tipo: 1, terminal: 1, container: 1}`. Os dois primeiros são igualdade, e o `container` entra no fim só para a projeção ser respondida pelo índice. A ordem entre `tipo` e `terminal` não deve importar, porque os dois são igualdade.

Quantos docs: `tipo` tem 5 valores e `terminal` também, então ~400.000 / 25 ≈ **16.000**.

| | com `_id: 0` | sem `_id: 0` |
|---|---|---|
| Stage esperado | `PROJECTION_COVERED → IXSCAN` | `PROJECTION_SIMPLE → FETCH → IXSCAN` |
| totalKeysExamined | ~16.000 | ~16.000 |
| totalDocsExamined | **0** | ~16.000 |
| SORT em memória | não | não |
| nReturned | ~16.000 | ~16.000 |

Por quê: a projeção sempre inclui o `_id`, a não ser que eu tire. O `_id` não está no índice, então, sem o `_id: 0`, o Mongo precisa ir em cada documento só para pegar o `_id`. Aí volta o FETCH e a consulta deixa de ser coberta.

Também acho que o planner vai considerar o índice ESR da A1 (que começa por `terminal`) como candidato e rejeitar. Ele pegaria ~80 mil chaves de T2 e teria que filtrar `tipo` no documento. Então espero 1 plano rejeitado.

## B1 — Relatório gerencial

Pipeline que vou usar:

```js
[
  { $match: { classe: "Refrigerado", ts: { $gte: ISODate("2026-04-01") } } },
  { $group: { _id: "$terminal", total_mov: { $sum: 1 }, peso_total: { $sum: "$peso_kg" },
              peso_medio: { $avg: "$peso_kg" }, maior_peso: { $max: "$peso_kg" } } },
  { $sort: { peso_total: -1 } },
  { $limit: 3 },
  { $project: { _id: 0, terminal: "$_id", total_mov: 1, peso_total: 1, peso_medio: 1, maior_peso: 1 } }
]
```

Quantos docs entram no `$group`: Refrigerado é ~1/4 da coleção (~100 mil), e ~70% tem `ts >= abril`. Então devem entrar **~70.000 docs** no `$group`. Saem 5 grupos (T1..T5), e depois do `$limit` ficam **3**. Os totais por terminal devem ser parecidos (~14 mil movimentações cada, peso médio perto de 16.000 kg, já que o peso vai de 1.000 a 30.999), e o top 3 vai ser decidido por diferenças pequenas.

Índice: vou criar **`{classe: 1, ts: 1, terminal: 1, peso_kg: 1}`**.
- `classe` (igualdade) e `ts` (range) atendem o `$match`. Nenhum índice da Parte A serve aqui, porque todos começam por outro campo (`terminal`, `posicao`, `tipo`).
- `terminal` e `peso_kg` no fim são os únicos campos de que o `$group` precisa. Com isso, a ideia é o Mongo nem abrir os documentos (consulta coberta dentro do aggregate).
- De quebra, o mesmo índice deve servir o pipeline corrigido da B2 (`classe` igual, `ts` sem filtro). Assim não preciso de um índice só pra B2.

| | sem índice novo | com `{classe, ts, terminal, peso_kg}` |
|---|---|---|
| Stage de acesso | COLLSCAN | IXSCAN + projeção coberta (sem FETCH) |
| totalDocsExamined | 400.000 | **0** (se cobrir mesmo) |
| totalKeysExamined | 0 | ~70.000 |
| Docs que entram no `$group` | ~70.000 | ~70.000 (o índice não muda quantos, muda o custo de achar) |
| SORT em memória | só do `$sort` em cima de 5 grupos (irrelevante) | idem |
| nReturned final | 3 | 3 |

Incerteza: no Mongo 7 o `$group` pode ser "empurrado" para o motor SBE, e aí o explain vem num formato diferente, com GROUP dentro do plano da query em vez de um estágio `$group` separado. Vou ler o número de docs que entram no group pelo `nReturned` do estágio logo abaixo do GROUP (ou do `$cursor`, se vier no formato clássico). Também não tenho 100% de certeza de que ele vai escolher o plano coberto. Se der FETCH, o docsExamined vai ser ~70 mil.
