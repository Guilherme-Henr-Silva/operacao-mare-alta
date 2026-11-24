# C3 — Debug Cypher

Feita depois da C1 e da C2. Todas as evidências são saídas reais do meu Neo4j (arquivos `c3_*` nesta pasta).

---

## (i) CREATE que duplica empresas

```cypher
CREATE (a:Empresa {cnpj:'E1'})-[:SOCIA_DE {pct:30}]->(b:Empresa {cnpj:'E2'})
```

**Sintoma:** o objetivo era só ligar E1 a E2, mas a contagem de empresas foi de **30 para 32**. Agora existem duas "E1" e duas "E2", e as cópias novas não têm `nome` nem `sancionada`. A aresta nova ficou entre as cópias, não entre as empresas originais.

**Causa raiz:** `CREATE` sempre cria tudo o que está no padrão, inclusive os nós. O `{cnpj:'E1'}` dentro de um CREATE não é uma busca, é a lista de propriedades do nó **novo**. O Neo4j não tem chave primária implícita (a menos que exista uma constraint), então ele aceita dois nós com o mesmo cnpj sem reclamar.

**Evidência:**

| Momento | Empresas com cnpj E1/E2 | Total de `:Empresa` | Arestas E1→E2 | Arquivo |
|---|---|---|---|---|
| antes | 2 (ids …:6 e …:7) | 30 | 0 | `c3_i_1_antes.txt` |
| depois do CREATE | **4** (…:6, …:125 sem nome, …:7, …:126 sem nome) | **32** | 1 (entre as cópias) | `c3_i_2_bug.txt`, `c3_i_3_depois_bug.txt` |
| depois da limpeza | 2 | 30 | 0 | `c3_i_4_limpeza.txt`, `c3_i_5_depois_limpeza.txt` |
| depois do corrigido (rodado 2×) | 2 (os mesmos …:6 e …:7) | 30 | **1** | `c3_i_6_corrigido.txt`, `c3_i_7_final.txt` |

O `cypher-shell` deixa claro: o original mostra "Added 2 nodes, Created 1 relationships". O corrigido mostra só "Created 1 relationships" na 1ª execução e nada criado na 2ª.

**Limpeza dos duplicados (antes de rodar a correção):**

```cypher
MATCH (e:Empresa) WHERE e.cnpj IN ['E1','E2'] AND e.nome IS NULL
DETACH DELETE e;      // "Deleted 2 nodes, Deleted 1 relationships"
```

**Código corrigido:**

```cypher
MATCH (a:Empresa {cnpj:'E1'}), (b:Empresa {cnpj:'E2'})   // usa as que já existem
MERGE (a)-[r:SOCIA_DE]->(b)                               // cria a aresta só se não existir
ON CREATE SET r.pct = 30
ON MATCH  SET r.pct = 30
RETURN a.nome, b.nome, r.pct;
```

O `MATCH` acha os nós existentes, e se algum não existir a consulta não cria nada. O `MERGE` só no relacionamento deixa a operação idempotente: rodar duas vezes não duplica a aresta. Não coloquei o `pct` dentro do MERGE porque aí um pct diferente criaria uma segunda aresta. Para evitar o problema de vez, o ideal seria uma constraint `CREATE CONSTRAINT FOR (e:Empresa) REQUIRE e.cnpj IS UNIQUE`, que faria o CREATE original falhar em vez de duplicar.

---

## (ii) Caminho sem limite e sem direção

```cypher
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*]-(x:Empresa) RETURN x.nome
```

**Sintoma (rodado com `LIMIT 20` e corte de 30 s, como o enunciado pede):** no meu grafo **não travou**. Voltou 1 linha (`Empresa 11`) em ~0,6 s, com 67 acessos ao banco (`c3_ii_1_bug.txt`). O motivo é o que descobri na C2: a E22 está num componente isolado de só 2 empresas, então não tem para onde explodir.

Mas o defeito existe e aparece assim que a sancionada estiver numa parte conectada da rede. Para mostrar isso no meu próprio grafo, rodei o mesmo padrão sem direção a partir da **E18**, a empresa de maior grau (8 arestas), aumentando só o limite de profundidade (`c3_ii_2_crescimento.txt`):

| profundidade máx. | caminhos (linhas) | empresas distintas |
|---|---|---|
| 1 | 8 | 6 |
| 2 | 29 | 15 |
| 3 | 98 | 23 |
| 4 | 288 | 28 |
| 6 | 2.209 | 28 |
| 8 | 13.644 | 28 |
| 10 | 71.589 | 28 |
| 12 | 324.549 | 28 |
| 14 | **1.290.481** | 28 |

A partir da profundidade 4 a resposta útil para de mudar (28 empresas), mas o número de caminhos continua multiplicando por ~2,3 a cada nível. Com `*` sem limite, o Neo4j tenta enumerar **todos** os caminhos sem repetir aresta, que podem ter até 46 arestas de comprimento. Isso é exponencial, e é aí que a memória estoura. Não rodei a versão sem limite a partir da E18 justamente por esse risco de travar o servidor. A curva acima já mostra para onde ela vai.

**Causa raiz:**
1. `*` sem limite: a profundidade só é limitada pelo número de arestas do grafo.
2. Sem direção (`-…-`): cada aresta pode ser atravessada nos dois sentidos, então ciclos como A→B←C→A viram muitos caminhos diferentes. Além disso, mistura "empresas em que a sancionada tem participação" com "sócios dos sócios", que não é o que se quer.
3. Sem `DISTINCT`: o `RETURN x.nome` devolve uma linha **por caminho**, e não por empresa. Já na profundidade 1 a E18 devolve 8 linhas para 6 empresas.

**Código corrigido:**

```cypher
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa)
WHERE x <> s
RETURN DISTINCT x.nome AS empresa_ligada ORDER BY empresa_ligada;
```

**Evidência depois:** com a E22, o resultado é `Empresa 11`, com 75 acessos ao banco (`c3_ii_3_corrigido.txt`). A partir da E18, o mesmo padrão corrigido gera só **17 caminhos para 7 empresas** (`c3_ii_4_corrigido_E18.txt`), contra milhões na versão sem limite. O `DISTINCT` deixa uma linha por empresa.

---

## (iii) Pilha com id literal e direção invertida

```cypher
MATCH (base:Container {id:'BASE_DA_PILHA'})-[:EMPILHADO_SOBRE*1..3]->(x:Container) RETURN x.id
```

**Sintoma:** 0 linhas, sem erro nenhum.

**Causa raiz (são dois defeitos):**
1. `'BASE_DA_PILHA'` é o **nome do parâmetro** da prova, não um id. Não existe contêiner com esse id (`count = 0`). O meu é **K28**.
2. A seta está ao contrário. No modelo, `(topo)-[:EMPILHADO_SOBRE]->(base)`: quem está em cima aponta para quem está embaixo. A única aresta que toca a K28 é `K29 → K28`. Saindo da K28 pela seta não tem nada, porque ela é a base e não está apoiada em ninguém. Para achar quem fica preso **acima** dela, tem que seguir as setas que **chegam** nela.

Prova de que são dois defeitos, e não um só: corrigir só o id e manter a seta (`{id:'K28'})-[...]->`) **continua dando 0 linhas** (`c3_iii_saida.txt`).

**Código corrigido:**

```cypher
MATCH (base:Container {id:'K28'})<-[:EMPILHADO_SOBRE*1..3]-(x:Container)
RETURN DISTINCT x.id AS preso_acima ORDER BY preso_acima;
```

**Evidência depois:** `K29`, `K30`, `K31`. São os 3 contêineres acima da base (K29 sobre K28, K30 sobre K29, K31 sobre K30). O `*1..3` cobre exatamente a altura da pilha, já que o gerador cria pilhas de 4. O K31 é da sancionada E22 (ver C1).

---

## (iv) Contagem sem DISTINCT

```cypher
MATCH (k:Container)-[:PASSOU_POR]->(t:Terminal) WHERE k.classe = 'Perigoso' RETURN t.nome, count(k)
```

**Sintoma:** os números não batem com a quantidade de contêineres. Somando os terminais dá **46**, e eu só tenho **23** contêineres perigosos.

**Causa raiz:** o `MATCH` gera uma linha por **caminho**, ou seja, por aresta `PASSOU_POR`, e não por contêiner. Cada contêiner tem 2 passagens. Quando as duas são no mesmo terminal, o mesmo `k` aparece em duas linhas daquele terminal, e o `count(k)` conta as duas, porque `count` conta linhas não nulas e não valores diferentes.

**Código corrigido:**

```cypher
MATCH (k:Container)-[:PASSOU_POR]->(t:Terminal) WHERE k.classe = 'Perigoso'
RETURN t.nome AS terminal, count(DISTINCT k) AS conteineres_perigosos ORDER BY terminal;
```

**Evidência antes/depois** (`c3_iv_saida.txt`):

| terminal | `count(k)` (original) | `count(DISTINCT k)` (corrigido) | contêineres que passaram 2× ali |
|---|---|---|---|
| T1 | 13 | **11** | K0, K83 |
| T2 | 8 | **8** | — |
| T3 | 10 | **8** | K12, K63 |
| T4 | 5 | **4** | K53 |
| T5 | 10 | **9** | K30 |

A diferença entre as colunas é exatamente o número de contêineres que passaram duas vezes no mesmo terminal. O T2 não muda porque nenhum perigoso repetiu ali. O K0, que é da E22, aparece aqui também: ele passou duas vezes pelo T1 (20/10 e 26/10), como está no diagrama da C1.
