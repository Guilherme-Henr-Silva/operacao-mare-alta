// A4 — Consulta coberta
db = db.getSiblingDB("logiporto");
const filtro = { tipo: "inspecao", terminal: "T2" };
const mostrar = (s, ex) => { print("===A4_" + s + "==="); print(EJSON.stringify(ex, null, 2, { relaxed: true })); };

// índice: as duas igualdades + o campo projetado no fim
db.movimentacoes.createIndex({ tipo: 1, terminal: 1, container: 1 });

// 1) projeção só com container e sem _id -> deve ser coberta
mostrar("coberta", db.movimentacoes.find(filtro, { _id: 0, container: 1 }).explain("executionStats"));

// 2) mesma coisa, mas sem o _id: 0 (o _id volta por padrão)
mostrar("com_id", db.movimentacoes.find(filtro, { container: 1 }).explain("executionStats"));

print("===A4_amostra===");
db.movimentacoes.find(filtro, { _id: 0, container: 1 }).limit(5).forEach(d => print(EJSON.stringify(d)));
print("total: " + db.movimentacoes.countDocuments(filtro));
