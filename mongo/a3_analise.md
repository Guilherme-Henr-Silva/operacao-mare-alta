# A3 — O TTL que não apaga

Script: [`a3.js`](a3.js) · saída completa: [`a3_saida.txt`](a3_saida.txt)

O gerador não cria o índice TTL, então recriei o do "desenvolvedor anterior":

```js
db.alertas.createIndex({ registrado_em: 1 }, { expireAfterSeconds: 2592000 })   // 30 dias
```

## O que está acontecendo

1. **O índice existe e está certo.** O `getIndexes()` mostra `registrado_em_1` com `expireAfterSeconds: 2592000`. Isso descarta as hipóteses "esqueceu de criar o índice" e "criou como índice composto".
2. **O monitor de TTL está rodando, mas não apaga nada.** Esperei ~75 s: `metrics.ttl.passes` foi de 77 para 78 (rodou uma vez) e a coleção continuou com **100.000** docs. Isso descarta a hipótese de "não esperou o suficiente".
3. **Quase tudo já deveria ter ido embora.** Hoje é 23/11/2026, e o limite de 30 dias é 24/10/2026. **98.992** alertas são mais antigos que isso.

## Prova (comando no banco)

```js
db.alertas.aggregate([
  { $group: { _id: { $type: "$registrado_em" }, qtd: { $sum: 1 }, exemplo: { $first: "$registrado_em" } } }
])
// { _id: 'string', qtd: 100000, exemplo: '2026-08-31T22:03:37.872Z' }
```

**Todos** os 100.000 `registrado_em` são do tipo **string**. Nenhum é `date`.

Isso aparece também numa consulta comum: `registrado_em < limite` passando um BSON Date retorna **0**, e passando a mesma data como texto ISO retorna **98.992**. No Mongo, comparação entre tipos diferentes não converte nada: string e Date são tipos BSON diferentes e não se misturam.

## Causa raiz

O monitor de TTL é uma thread do `mongod` que acorda a cada 60 s. Para cada índice TTL, ela procura no índice as chaves do tipo **Date** menores que `agora - expireAfterSeconds` e apaga esses documentos. Um documento cujo campo indexado não é Date (nem array com Date) **nunca expira**: ele está no índice, mas a chave é uma string. Na ordem de comparação do BSON, string fica numa faixa diferente de Date, então ela nunca cai no intervalo que o monitor percorre. Não dá erro nem aviso.

O gerador (e a aplicação antiga) grava `new Date(...).toISOString()`, que transforma a data num texto como `"2026-08-31T22:03:37.872Z"`. Pra gente parece uma data, mas pro Mongo é só um texto.

## Contraprova

Inseri dois alertas de teste com a mesma data de 40 dias atrás, um como Date e outro como string, e esperei ~75 s:

| Alerta | `registrado_em` | Logo após inserir | ~75 s depois |
|---|---|---|---|
| TESTE_A3_DATE | `ISODate("2026-10-14…")` | existe | **apagado pelo TTL** |
| TESTE_A3_STRING | `"2026-10-14…"` | existe | **continua lá** |

O contador `metrics.ttl.deletedDocuments` subiu de 6 para 7, ou seja, exatamente o alerta Date. (Os 6 que já estavam no contador são de antes, de outros testes no mesmo servidor.) No fim, apaguei o alerta de teste que sobrou.

## Correção

Índice correto (o mesmo, de campo único, com 30 dias). Ele fica na coleção como política de retenção:

```js
db.alertas.createIndex({ registrado_em: 1 }, { expireAfterSeconds: 2592000 })
```

Como a aplicação deve gravar os novos alertas, com o campo como **BSON Date**:

```js
db.alertas.insertOne({ sensor: "S12", nivel: "critico", registrado_em: new Date() })
```

- Em JavaScript/Node, passar o objeto `Date` direto. **Não** usar `.toISOString()`, `JSON.stringify` nem template string.
- Se o dado vier como texto de uma API, converter antes de gravar: `new Date(textoRecebido)`.
- Não precisa migrar os antigos (o enunciado dispensa). Se precisasse, seria um `updateMany` com pipeline `[{ $set: { registrado_em: { $toDate: "$registrado_em" } } }]`, e aí o próprio TTL apagaria os vencidos na próxima passada.
