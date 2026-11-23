# A2 — Incidente no pátio

INCIDENTE copiado do Google Maps: `-25.4680, -48.4930`. O Google Maps mostra **lat, lon**, mas o GeoJSON pede **[lon, lat]**:

```js
const INCIDENTE = { type: "Point", coordinates: [-48.4930, -25.4680] };
db.movimentacoes.find({
  posicao: { $near: { $geometry: INCIDENTE, $maxDistance: 300 } }   // 300 metros
}).limit(10)
```

Script: [`a2.js`](a2.js) · erro antes do índice: [`a2_antes_erro.txt`](a2_antes_erro.txt) · explain: [`a2_explain.json`](a2_explain.json) · resultado: [`a2_resultado.txt`](a2_resultado.txt)

## 1. Antes do índice: erro

```
code: 291, codeName: "NoQueryExecutionPlans"
planner returned error :: caused by :: unable to find index for $geoNear query
```

Não cai num COLLSCAN como um `find` comum faria. O `$near` tem que devolver os documentos **ordenados por distância**, e o planner só sabe fazer isso usando um índice geoespacial (2d ou 2dsphere). Sem índice, ele não tem nenhum plano possível e recusa a consulta.

## 2. Índice

```js
db.movimentacoes.createIndex({ posicao: "2dsphere" })   // -> "posicao_2dsphere"
```

Usei `2dsphere` e não `2d` porque `posicao` é um GeoJSON Point e a distância é em metros sobre a esfera.

## 3. Plano com o índice

| Métrica | Valor |
|---|---|
| nReturned | 10 |
| totalKeysExamined | 66 |
| totalDocsExamined | 42 |
| executionTimeMillis | 28 |
| Docs existentes no raio de 300 m | 4.095 (conferido com `$geoWithin`) |

Etapas, de baixo pra cima:

1. **IXSCAN (`posicao_2dsphere`)**: o 2dsphere guarda cada ponto como uma célula S2, que é um número que vem de uma curva que "costura" a esfera. Pontos próximos no mapa ficam com números próximos na B-Tree. Para o primeiro anel de busca, o Mongo calcula as células que cobrem esse anel e lê as faixas de chaves correspondentes. Foram **66 chaves examinadas**, mas o IXSCAN só repassou **42** (`nReturned: 42`). As outras 24 são chaves que o scan encontrou entre uma faixa de células e outra, fora dos bounds: ele olha a chave, vê que não pertence a nenhuma faixa e pula para a próxima. Isso conta como chave examinada, mas não vira documento.
2. **FETCH**: busca no disco os 42 documentos apontados por essas chaves (`docsExamined: 42`) e passa o documento inteiro para cima, porque o GEO_NEAR precisa da coordenada exata para calcular a distância.
3. **GEO_NEAR_2DSPHERE**: é ele que faz a ordenação por distância. Ele trabalha em **anéis** (`searchIntervals`): começa com um anel pequeno e só abre o próximo se precisar de mais resultados. Aqui bastou **um anel**, de 0 a 26,6 m, que já tinha 42 docs no buffer (`nBuffered: 42`). Ele ordenou esses 42 por distância e foi devolvendo do mais perto pro mais longe. Não aparece estágio SORT separado porque a ordenação é interna a esse estágio e feita só sobre o anel atual.
4. **LIMIT 10**: corta em 10. Por causa dele, o GEO_NEAR nunca precisou abrir o segundo anel.

Ou seja: tem 4.095 movimentações dentro dos 300 m, mas o Mongo só olhou 42 documentos, porque os 10 mais próximos estavam todos a menos de 20 m.

## 4. Resultado (10 mais próximos)

| # | container | terminal | tipo | distância (m) |
|---|---|---|---|---|
| 1 | CTN57781 | T4 | gate_in | 4,7 |
| 2 | CTN30016 | T5 | carga | 5,3 |
| 3 | CTN12691 | T1 | gate_in | 9,6 |
| 4 | CTN23830 | T3 | gate_out | 15,4 |
| 5 | CTN40074 | T5 | gate_out | 16,1 |
| 6 | CTN05322 | T2 | gate_out | 16,2 |
| 7 | CTN00738 | T2 | gate_in | 17,0 |
| 8 | CTN52500 | T5 | inspecao | 17,9 |
| 9 | CTN31185 | T2 | gate_out | 18,4 |
| 10 | CTN06245 | T3 | inspecao | 19,4 |

As distâncias vieram de um `$geoNear` com `distanceField`, que é a mesma busca. Os 10 contêineres são os mesmos e estão na mesma ordem do `find`.

## Armadilha do [lat, lon]

Com as coordenadas na ordem do Google Maps (`[-25.4680, -48.4930]`), o Mongo entende longitude -25,47 e latitude -48,49, um ponto no meio do Atlântico Sul. A consulta não dá erro, só volta **0 resultados**, o que é pior porque passa despercebido (conferido no fim do `a2.js`).
