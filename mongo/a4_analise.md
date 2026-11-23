# A4 — Consulta coberta

Script: [`a4.js`](a4.js) · explains: [`a4_coberta_explain.json`](a4_coberta_explain.json), [`a4_com_id_explain.json`](a4_com_id_explain.json) · amostra: [`a4_amostra.txt`](a4_amostra.txt)

```js
db.movimentacoes.createIndex({ tipo: 1, terminal: 1, container: 1 })

db.movimentacoes.find({ tipo: "inspecao", terminal: "T2" }, { _id: 0, container: 1 })   // 1) coberta
db.movimentacoes.find({ tipo: "inspecao", terminal: "T2" }, { container: 1 })           // 2) sem _id: 0
```

| Métrica | 1) `{_id:0, container:1}` | 2) `{container:1}` |
|---|---|---|
| Plano | PROJECTION_COVERED → IXSCAN | PROJECTION_SIMPLE → **FETCH** → IXSCAN |
| totalKeysExamined | 15.961 | 15.961 |
| **totalDocsExamined** | **0** | **15.961** |
| nReturned | 15.961 | 15.961 |
| executionTimeMillis | 21 | 38 |
| Plano rejeitado | índice ESR da A1 (`terminal_1_classe_…`) com FETCH | o mesmo |

## Por que a 1) é coberta

O índice `{tipo, terminal, container}` tem tudo de que a consulta precisa:
- `tipo` e `terminal` são as duas igualdades do filtro. O IXSCAN vai direto no bloco `inspecao / T2` da B-Tree e lê só as 15.961 chaves dele.
- `container` é o único campo que a projeção pede, e o valor dele já está dentro da chave.

O estágio `PROJECTION_COVERED` monta o resultado `{container: ...}` direto da chave do índice. O Mongo nunca abre o documento, e por isso dá `totalDocsExamined: 0`.

## O que muda sem o `_id: 0`

Em toda projeção o `_id` vem junto por padrão, a não ser que eu exclua explicitamente. O `_id` **não está** no índice `{tipo, terminal, container}`. Para devolver o `_id`, o Mongo precisa buscar cada documento: aparece o **FETCH**, e os docs examinados vão de 0 para 15.961 (um por resultado). A projeção vira `PROJECTION_SIMPLE`, aplicada em cima do documento inteiro. O IXSCAN continua igual, com as mesmas 15.961 chaves. A diferença está só no acesso ao disco/cache, e o tempo quase dobrou (21 → 38 ms).

Se a aplicação precisasse mesmo do `_id`, daria para colocar `_id` no fim do índice (`{tipo, terminal, container, _id}`) e a consulta continuaria coberta. Mas aqui o painel só quer o `container`, então o certo é `_id: 0` e um índice menor.

## Sobre o plano rejeitado

O planner testou também o índice ESR da A1, porque ele começa por `terminal`. Com ele, o Mongo teria que ler todas as chaves de T2 (~80 mil), buscar cada documento e filtrar `tipo` lá. O índice novo venceu porque entrega exatamente as 15.961 chaves certas.

---

# Auditoria de índices — fim da Parte A

Saída: [`indices_fim_parte_A.txt`](indices_fim_parte_A.txt)

| Coleção | Índice | Para quê |
|---|---|---|
| movimentacoes | `_id_` | padrão, não dá pra remover |
| movimentacoes | `terminal_1_classe_1_peso_kg_-1_ts_1` | A1 (ESR) |
| movimentacoes | `posicao_2dsphere` | A2 (`$near` não roda sem ele) |
| movimentacoes | `tipo_1_terminal_1_container_1` | A4 (consulta coberta) |
| alertas | `_id_` | padrão |
| alertas | `registrado_em_1` (TTL 30 dias) | A3, política de retenção |

O índice "na ordem do filtro" da A1 b) já foi removido na c). Não sobrou nenhum índice de teste.
