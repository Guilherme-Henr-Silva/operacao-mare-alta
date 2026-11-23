# Diário de bordo

## Preparação

- Rodei o `logiporto_gerador.js` mandando o arquivo pelo stdin do `docker exec`. Funcionou, mas o mongosh ecoou cada linha e cada `insertMany` (o arquivo de saída ficou com quase 6 MB de ObjectId). Guardei só o bloco dos parâmetros em `mongo/saida_gerador.txt`. Para o grafo, passei a copiar o .js para dentro do contêiner e rodar com `--file`, que não tem esse eco.
- O `grafo.cypher` rodou inteiro de uma vez no `cypher-shell`, sem precisar quebrar em blocos. Conferi as contagens (30 empresas, 90 contêineres, 5 terminais, 45/90/180/45 relações) e bateram com o que o gerador cria.

## A1

- **Hipótese que falhou:** na b) eu chutei `totalDocsExamined ≈ 14.000`, achando que o Mongo ia buscar todos os documentos e só depois ordenar. Deu **20**. Olhando o explain, o SORT aparece entre o IXSCAN e o FETCH: como `peso_kg` faz parte do índice, ele ordena as próprias chaves e só busca os 20 do topo. O que eu acertei foi o custo que sobra: 13.973 chaves lidas e ordenação em memória. Vou lembrar disso: "SORT em memória" não quer dizer necessariamente documento inteiro na memória.
- **Acertei:** COLLSCAN com 400 mil docs na a; ~14 mil chaves na b (deu 13.973, bem perto da conta 19.978 × 0,7); na c, umas 30 chaves (deu 28) e 20 docs, sem SORT.
- Na c fiquei na dúvida se os "pulos" do bound de `ts` iam inflar o `keysExamined`. Não inflaram: são 28 chaves = 20 que passaram + 8 de antes de abril. O explain mostra `seeks: 9`.
- O tempo da a) (1437 ms) deve ter pegado cache frio, porque foi a primeira consulta depois da carga. Não ligo muito pra esse número, o que importa é a contagem de docs e chaves.

## A2

- Antes de tudo, conferi a ordem das coordenadas: o Google Maps dá lat, lon e o GeoJSON quer lon, lat. Testei de propósito a ordem errada com `$geoWithin` e deu 0 resultados, sem erro nenhum. Isso é perigoso porque passa batido.
- **Acertei** que ia dar erro antes do índice (`NoQueryExecutionPlans` / "unable to find index for $geoNear query"), e não um COLLSCAN lento.
- **Acertei** o plano (LIMIT → GEO_NEAR_2DSPHERE → FETCH → IXSCAN) e a conta de ~4.000 docs no raio (deu 4.095).
- Os docs examinados ficaram no chute "dezenas a poucas centenas": deu 42 docs e 66 chaves. O que eu não sabia era quantos anéis ele ia abrir. Abriu **só um**, de 0 a ~26,6 m, porque a densidade é alta (~14 pontos por 1.000 m²) e 10 pontos cabem com folga num círculo de 20 m.
- Fiquei na dúvida por que keys (66) > docs (42). Primeiro achei que o FETCH tinha descartado pontos da borda, mas o explain desmente: o FETCH recebeu 42 e devolveu 42. Quem "jogou fora" foi o próprio IXSCAN (examinou 66 e repassou 42). Essas 24 chaves ficam entre as faixas de células S2 que cobrem o anel: ele lê a chave, vê que está fora dos bounds e pula pra próxima faixa.

## A3

- **Hipótese inicial confirmada:** `registrado_em` é string. O `$group` por `$type` deu 100.000 "string" e zero "date".
- Antes de bater o martelo, descartei as outras: o índice existe e é de campo único (`getIndexes`), e o monitor rodou durante o teste (`metrics.ttl.passes` subiu de 77 pra 78) sem apagar nada.
- Para contar quantos alertas "já deviam ter vencido", rodei a comparação dos dois jeitos. Com `{registrado_em: {$lt: new Date(...)}}` deu **0**, e com a data em texto ISO deu 98.992. É a mesma armadilha aparecendo numa consulta normal: o Mongo não converte string em Date na comparação. Um dev que testasse só do primeiro jeito ia achar que "não tem nada vencido".
- Para não ficar só na teoria, fiz uma contraprova com dois alertas de 40 dias atrás, um Date e um string. Depois de ~75 s o Date sumiu e o string ficou. Apaguei o que sobrou para não sujar a coleção.
- O contador `deletedDocuments` já começou em 6. Não fui eu nesta rodada, devem ser restos de testes antigos no mesmo contêiner. Anotei para não confundir.

## A4

- **Acertei tudo:** PROJECTION_COVERED com 0 docs, ~16 mil chaves (deu 15.961, perto do 400.000/25) e o FETCH voltando quando tirei o `_id: 0`. Também previ que o índice ESR da A1 ia aparecer como plano rejeitado, e apareceu.
- Escolhi `{tipo, terminal, container}`. Pensei em pôr `terminal` primeiro para "reaproveitar" alguma coisa do índice da A1, mas não faz diferença: os dois são igualdade, e o índice da A1 não cobre `container` de qualquer jeito.
- Pensei em incluir o `_id` no índice pra cobrir as duas versões da consulta, mas aí o índice fica maior só pra atender um caso que o enunciado mesmo diz que é o "errado". Deixei sem.

## Fim da Parte A — índices

- `getIndexes()` em `movimentacoes`: `_id_`, ESR da A1, 2dsphere da A2 e o coberto da A4. Cada um é usado por uma questão, então nenhum sobrando.
- O TTL ficou em `alertas`, porque é a política de retenção que o enunciado pede.
