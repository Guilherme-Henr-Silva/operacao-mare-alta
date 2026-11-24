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

## B1

- **Acertei** a ordem de grandeza: previ ~70 mil docs entrando no `$group` e deram 69.736. Também acertei o plano coberto (0 docs examinados com o índice `{classe, ts, terminal, peso_kg}`).
- **Errei a incerteza do formato:** achei que o Mongo 7 podia empurrar o `$group` pro motor SBE e o explain viria diferente. Veio no formato clássico, com o `$cursor` separado do `$group`. Foi até melhor, porque o `$cursor.nReturned` mostra direto quantos entraram no group.
- Fiquei na dúvida se valia criar só `{classe, ts}`, que é o mínimo pro `$match`. Com ele, o Mongo ia ter que buscar os ~70 mil documentos (FETCH) só pra ler `terminal` e `peso_kg`. Colocando os dois campos no fim do índice, a consulta fica coberta. E ainda pretendo usar esse mesmo índice na B2, então ele se paga.
- O top 3 ficou bem apertado: T2 e T3 têm diferença de ~570 toneladas em 225 mil. Conferi rodando sem o `$limit` e vendo os 5 grupos.
- Detalhe bobo: o campo `terminal` aparece por último na saída, porque o `$project` põe os campos calculados depois dos que já existiam. Não muda nada no resultado.

## B2

- **Acertei** que `kg_total` ia dar 0 e que o `$group` ia receber os 400 mil docs via COLLSCAN. O explain até mostra `$sum: {$const: "peso_kg"}`, a prova de que ele leu como texto.
- **Errei** o tamanho da saída: chutei "0 ou 1 documento" (cada um dos 3 grupos tem 1/4 de chance de ser Refrigerado) e vieram **2**. Não é que a conta esteja errada, só caiu pro lado menos provável. Rodei só até o `$limit` pra ver quais 3 grupos ele tinha pego: T1/Perigoso, T2/Refrigerado e T4/Refrigerado.
- Não esperava ver o otimizador mexendo no pipeline: no explain a ordem ficou `$group → $limit → $match → $sort`. Ele trocou `$sort` e `$match` porque isso não muda o resultado. Mas ele não passa o `$match` pra antes do `$limit`, e é por isso que os erros de lógica continuam.
- No corrigido, previ ~100 mil chaves, 0 docs e uso do índice da B1. Deram 99.885 chaves, 0 docs e o índice `classe_1_ts_1_terminal_1_peso_kg_1`. Também chutei ~320 milhões de kg por terminal, e ficou entre 318 e 323 milhões.
- Pra provar que o corrigido está certo, não quis comparar com outro aggregate (que podia ter o mesmo erro). Fiz a soma "na mão" em JavaScript com `find().forEach()`, e os 5 terminais bateram.
- O `mov` do T2/Refrigerado deu 19.978 nas duas versões, que é o mesmo número do meu código de autenticidade. Boa conferência de que o banco é o meu mesmo.

## Fim da Parte B — índices

- Ficaram 5 índices em `movimentacoes`, cada um vencedor em alguma questão. A B2 não precisou de índice novo, porque reaproveitou o da B1. Foi por isso que coloquei `terminal` e `peso_kg` nele.

## C1

- Antes de desenhar, consultei o Neo4j pra pegar o subgrafo real da E22. Esperava uns 2 ou 3 sócios diretos (são 45 arestas pra 30 empresas, ~3 por empresa contando entrada e saída), mas a E22 só tem **uma**: ela é sócia da E11 com 10%. Ninguém é sócio dela.
- Descobri que o K31, que é um dos contêineres da E22, está no topo da pilha da minha BASE_DA_PILHA (K31 → K30 → K29 → K28). Coloquei no diagrama porque isso vai aparecer de novo no trecho (iii) da C3.
- No Mermaid não dá pra fazer seta de um nó pra ele mesmo de um jeito legível, então no modelo desenhei duas caixas de `:Empresa` e duas de `:Container`, com uma nota explicando que é o mesmo rótulo.

## C2

- **Acertei a direção e a ordem de grandeza, mas o número foi o extremo:** previ "unidades, pode dar 0" e deu **0 linhas**. Na previsão eu tinha chutado ~3 a 5 empresas alcançáveis em 3 níveis, mas só deu 1 (E11). A conta de "média 1,5 sócias por empresa" não vale aqui: a E11 não tem nenhuma outra aresta `SOCIA_DE`, então E22 e E11 ficam isoladas do resto da rede.
- Quando vi o 0, desconfiei de mim primeiro. Testei: sem o `DISTINCT` também dá 0; sem direção, a única empresa ligada continua sendo a E11; e os contêineres da E11 (K23, K38, K63) só passaram pelo T3, onde a E22 nunca esteve.
- Para ter certeza de que a parte de "mesmo terminal e mesma data" estava certa, rodei um controle sem exigir vínculo societário e vieram 15 encontros com outras empresas. Então a consulta funciona, e o 0 é o resultado verdadeiro no meu grafo.

## C3

- **(i):** o CREATE criou 2 nós novos, exatamente como o enunciado avisava. Antes de apagar, conferi que as cópias eram as que tinham `nome` nulo (as originais têm "Empresa 1"/"Empresa 2"), e apaguei só elas com `DETACH DELETE`. Rodei o corrigido duas vezes de propósito: na segunda, o `cypher-shell` não criou nada. Isso deixou uma aresta E1→E2 nova no grafo (agora são 46 `SOCIA_DE`). Conferi que ela não mexe na C2, porque E1 e E2 não estão no componente da E22.
- **(ii):** esperava que ia travar e **não travou**: com a E22 voltou 1 linha em menos de 1 s, porque o componente dela tem só 2 nós. Para mostrar o defeito mesmo assim, rodei o mesmo padrão a partir da E18, que tem mais ligações, aumentando a profundidade aos poucos e com corte de 30 s. Foi de 8 caminhos para 1,29 milhão na profundidade 14, enquanto as empresas distintas pararam em 28 já na profundidade 4. A versão totalmente sem limite a partir da E18 eu **não rodei**, porque a curva já mostrava que ia ficar pesada e eu não quis arriscar travar o Neo4j.
- **(iii):** para provar que eram dois defeitos separados, rodei uma versão intermediária trocando só 'BASE_DA_PILHA' por 'K28'. Continuou 0, porque a base não está apoiada em ninguém: os outros é que apontam pra ela. Só com o id certo **e** a seta `<-` deu K29, K30 e K31.
- **(iv):** conferi com uma conta de controle: 23 perigosos × 2 passagens = 46, que é exatamente a soma do `count(k)` original. Com `DISTINCT` a soma cai para 40, e a diferença (6) são os 6 contêineres que passaram duas vezes no mesmo terminal.
