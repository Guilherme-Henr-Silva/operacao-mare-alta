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
