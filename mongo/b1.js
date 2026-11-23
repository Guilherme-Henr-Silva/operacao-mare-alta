// B1 — Relatório gerencial (Refrigerado, ts >= 2026-04-01, top 3 terminais por peso total)
db = db.getSiblingDB("logiporto");
const pipeline = [
  { $match: { classe: "Refrigerado", ts: { $gte: ISODate("2026-04-01T00:00:00Z") } } },
  { $group: {
      _id: "$terminal",
      total_mov: { $sum: 1 },
      peso_total: { $sum: "$peso_kg" },
      peso_medio: { $avg: "$peso_kg" },
      maior_peso: { $max: "$peso_kg" } } },
  { $sort: { peso_total: -1 } },
  { $limit: 3 },
  { $project: { _id: 0, terminal: "$_id", total_mov: 1, peso_total: 1, peso_medio: 1, maior_peso: 1 } }
];
const mostrar = (s, x) => { print("===B1_" + s + "==="); print(EJSON.stringify(x, null, 2, { relaxed: true })); };

// 1) antes do índice
mostrar("sem_indice", db.movimentacoes.explain("executionStats").aggregate(pipeline));

// 2) índice para o $match (igualdade classe + range ts) com os campos do $group no fim
db.movimentacoes.createIndex({ classe: 1, ts: 1, terminal: 1, peso_kg: 1 });
mostrar("com_indice", db.movimentacoes.explain("executionStats").aggregate(pipeline));

// 3) resultado
mostrar("resultado", db.movimentacoes.aggregate(pipeline).toArray());

// 4) conferência: todos os 5 grupos (sem $limit), pra ver se o top 3 está certo
mostrar("todos_grupos", db.movimentacoes.aggregate(pipeline.filter(s => !s.$limit)).toArray());
