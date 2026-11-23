// A1 — Painel do pátio
// Uso: docker exec mongo-lab mongosh --quiet --file /tmp/a1.js
// Imprime cada explain entre marcadores ===A1_x=== para eu separar em arquivos .json
db = db.getSiblingDB("logiporto");

const filtro = { terminal: "T2", classe: "Refrigerado", ts: { $gte: ISODate("2026-04-01T00:00:00Z") } };
const explicar = () => db.movimentacoes.find(filtro).sort({ peso_kg: -1 }).limit(20).explain("executionStats");
const mostrar = (etapa, ex) => { print("===A1_" + etapa + "==="); print(EJSON.stringify(ex, null, 2, { relaxed: true })); };

// a) sem índice nenhum (só o _id)
mostrar("a", explicar());

// b) índice "na ordem do filtro"
db.movimentacoes.createIndex({ terminal: 1, classe: 1, ts: 1, peso_kg: -1 });
mostrar("b", explicar());

// c) troca pelo índice ESR: Equality (terminal, classe) -> Sort (peso_kg) -> Range (ts)
db.movimentacoes.dropIndex({ terminal: 1, classe: 1, ts: 1, peso_kg: -1 });
db.movimentacoes.createIndex({ terminal: 1, classe: 1, peso_kg: -1, ts: 1 });
mostrar("c", explicar());

// resultado em si (os 20 mais pesados), pra conferência
print("===A1_resultado===");
db.movimentacoes.find(filtro, { _id: 0, container: 1, peso_kg: 1, ts: 1 }).sort({ peso_kg: -1 }).limit(20)
  .forEach(d => print(EJSON.stringify(d, { relaxed: true })));
