# Operação Maré Alta — Prova Prática Integradora

Banco de Dados NoSQL · Engenharia de Software (6º semestre) · Unicesumar · Prof. Leonardo Rocha

**Aluno:** Guilherme Henrique Silva
**RA:** 240087832

## Parâmetros da minha prova

Saída do `logiporto_gerador.js` (MongoDB):

| Parâmetro | Valor |
|---|---|
| CLASSE_ALVO | `Refrigerado` |
| TERMINAL_ALVO | `T2` |
| DATA_CORTE | `2026-04-01` |
| INCIDENTE (Google Maps "lat, lon") | `-25.4680, -48.4930` |
| **Código de Autenticidade** | **`LP-240087832-19978-31421`** |

Saída do `grafo_gerador.js` (primeira linha do `grafo.cypher`):

| Parâmetro | Valor |
|---|---|
| EMPRESA_SANCIONADA | `E22` |
| BASE_DA_PILHA | `K28` |

> Lembrete: o GeoJSON usa `[lon, lat]`, então o INCIDENTE vira `[-48.4930, -25.4680]` nas consultas.

## Ambiente

- MongoDB 7 no contêiner Docker `mongo-lab` (porta 27017), usando o `mongosh` de dentro do contêiner.
- Neo4j 5 no contêiner `neo4j-lab` (portas 7474/7687), consultas rodadas pelo `cypher-shell` do contêiner.

Como recriei os dados:

```bash
docker exec -i mongo-lab mongosh < mongo/logiporto_gerador.js
docker cp mongo/grafo_gerador.js mongo-lab:/tmp/grafo_gerador.js
docker exec mongo-lab mongosh --nodb --quiet --file /tmp/grafo_gerador.js > neo4j/grafo.cypher
docker exec -i neo4j-lab cypher-shell -u neo4j -p <senha> < neo4j/grafo.cypher
```

Conferência da carga:

- `logiporto.movimentacoes`: 400.000 documentos · `logiporto.alertas`: 100.000 documentos
- Neo4j: 30 `Empresa`, 90 `Container`, 5 `Terminal`; 45 `SOCIA_DE`, 90 `PERTENCE_A`, 180 `PASSOU_POR`, 45 `EMPILHADO_SOBRE` (o arquivo rodou inteiro de uma vez, sem precisar separar em blocos)

## Estrutura

```
operacao-mare-alta/
├── README.md      # este arquivo
├── previsoes.md   # pré-registro (commitado antes de cada execução)
├── diario.md      # hipóteses, erros e correções
├── mongo/         # geradores, scripts, saídas e JSONs de explain (Partes A e B)
└── neo4j/         # grafo.cypher, consultas, evidências e diagrama (Parte C)
```

## Onde está cada resposta

| Questão | Análise | Scripts / evidências |
|---|---|---|
| A1 | [mongo/a1_analise.md](mongo/a1_analise.md) | `mongo/a1.js`, `mongo/a1_*_explain.json` |
| A2 | [mongo/a2_analise.md](mongo/a2_analise.md) | `mongo/a2.js`, `mongo/a2_explain.json` |
| A3 | [mongo/a3_analise.md](mongo/a3_analise.md) | `mongo/a3.js`, `mongo/a3_saida.txt` |
| A4 | [mongo/a4_analise.md](mongo/a4_analise.md) | `mongo/a4.js`, `mongo/a4_*_explain.json` |
| B1 | [mongo/b1_analise.md](mongo/b1_analise.md) | `mongo/b1.js`, `mongo/b1_*_explain.json` |
| B2 | [mongo/b2_analise.md](mongo/b2_analise.md) | `mongo/b2.js`, `mongo/b2_*` |
| Índices (fim de A e B) | [mongo/b2_analise.md](mongo/b2_analise.md#auditoria-de-índices--fim-das-partes-a-e-b) | `mongo/indices_fim_parte_A.txt`, `mongo/indices_fim_partes_A_B.txt` |
| C1 | [neo4j/diagrama.md](neo4j/diagrama.md) | `neo4j/c1_consultas.cypher`, `neo4j/c1_subgrafo_E22.txt` |
| C2 | [neo4j/c2_analise.md](neo4j/c2_analise.md) | `neo4j/c2.cypher`, `neo4j/c2_*` |
| C3 | [neo4j/c3_analise.md](neo4j/c3_analise.md) | `neo4j/c3_*` |

Índices finais em `logiporto.movimentacoes`: `_id_`, `terminal_1_classe_1_peso_kg_-1_ts_1` (A1), `posicao_2dsphere` (A2), `tipo_1_terminal_1_container_1` (A4), `classe_1_ts_1_terminal_1_peso_kg_1` (B1/B2). Em `alertas`: `_id_` e o TTL `registrado_em_1` (A3).
