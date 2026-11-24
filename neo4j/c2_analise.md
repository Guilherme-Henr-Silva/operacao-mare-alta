# C2 — Investigação societária e operacional

Consulta: [`c2.cypher`](c2.cypher) · resultado: [`c2_resultado.txt`](c2_resultado.txt) · PROFILE: [`c2_profile.txt`](c2_profile.txt) · apoio: [`c2_apoio.cypher`](c2_apoio.cypher) → [`c2_apoio_saida.txt`](c2_apoio_saida.txt) · controle: [`c2_controle.cypher`](c2_controle.cypher) → [`c2_controle_saida.txt`](c2_controle_saida.txt)

```cypher
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa)
WHERE x <> s
MATCH (ks:Container)-[:PERTENCE_A]->(s),
      (ks)-[ps:PASSOU_POR]->(t:Terminal)<-[px:PASSOU_POR]-(kx:Container)-[:PERTENCE_A]->(x)
WHERE ps.data = px.data
RETURN DISTINCT x.nome AS empresa_investigada, kx.id AS container, t.nome AS terminal, px.data AS data
ORDER BY data, terminal, empresa_investigada;
```

## Direção escolhida: saindo da sancionada

`(a)-[:SOCIA_DE]->(b)` significa "a tem participação em b". Partindo da E22 e seguindo as setas, chego nas empresas em que a sancionada tem participação direta ou indireta (até 3 níveis). São as empresas que ela pode controlar ou usar de fachada para continuar movimentando carga, e é isso que a investigação quer achar.

Por que não sem direção: com `-[:SOCIA_DE*1..3]-` a travessia sobe e desce misturando coisas. No 2º nível já entrariam "outros sócios da minha participada", que não têm nenhuma relação de controle com a sancionada, e o número de caminhos multiplica (ver C3 ii). O `*1..3` limita a profundidade, e o `DISTINCT` tira as linhas repetidas que aparecem quando a mesma empresa é alcançada por mais de um caminho.

## Resultado no meu grafo: 0 linhas

A consulta roda certo e devolve **nenhuma linha**. Fui atrás do porquê:

| Conferência | Resultado |
|---|---|
| Empresas alcançadas saindo da E22 (1..3) | só a **E11** (nível 1, 1 caminho) |
| Arestas `SOCIA_DE` que tocam E22 ou E11 | só `E22 -[pct:10]-> E11` |
| Empresas alcançadas **entrando** na E22 | nenhuma |
| Empresas alcançadas **sem direção** | só a E11 |
| Contêineres da E11 | K23, K38, K63, que passaram **só pelo T3** |
| Terminais por onde a E22 passou | T1, T2 e T5 (nunca T3) |
| Linhas sem `DISTINCT` | 0 |

Ou seja, no meu grafo a sancionada e a E11 formam um **componente isolado** da rede societária: a E11 não tem nenhuma outra aresta `SOCIA_DE`. Então não existe 2º nem 3º nível, e a única empresa ligada (E11) nunca esteve no mesmo terminal que a E22. Isso vale em qualquer data, não só na mesma data.

**Controle positivo** (para ter certeza de que o 0 não é erro de escrita da consulta): rodei só a parte operacional, sem exigir `SOCIA_DE`, ou seja, qualquer empresa com contêiner no mesmo terminal e data que um contêiner da E22. Vieram **15 encontros** com outras empresas, por exemplo `Empresa 21 / K45 / T2 / 2026-10-05`, que encontrou o K1 da E22. O padrão de "encontro" funciona. O que zera o resultado é a exigência de vínculo societário, e esse é o resultado correto da investigação: **nenhuma empresa da rede societária da E22 cruzou com ela no pátio em outubro**.

Rodei a C2 de novo depois de terminar a C3 ([`c2_reexecucao_pos_C3.txt`](c2_reexecucao_pos_C3.txt)) e continuou 0. A aresta `E1→E2` criada na correção do trecho (i) não toca esse componente.

## PROFILE

Planner COST, runtime SLOTTED, **223 acessos ao banco** no total, 0 linhas. O plano começa pela sancionada (filtro `sancionada = true`), expande `SOCIA_DE*1..3` só pra frente e só depois testa os contêineres. Com isso, o trabalho fica proporcional à vizinhança da sancionada, e não ao grafo inteiro.
