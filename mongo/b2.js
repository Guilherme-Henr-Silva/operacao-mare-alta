// B2 — Debug arquitetural (Refrigerado, todo o período, top 3 terminais por peso total)
db = db.getSiblingDB("logiporto");
const mostrar = (s, x) => { print("===B2_" + s + "==="); print(EJSON.stringify(x, null, 2, { relaxed: true })); };

// a) pipeline original, exatamente como veio (só troquei CLASSE_ALVO pelo meu valor)
const original = [
  { $project: { terminal: 1, classe: 1 } },
  { $group: { _id: { terminal: "$terminal", classe: "$classe" }, kg_total: { $sum: "peso_kg" }, mov: { $sum: 1 } } },
  { $limit: 3 },
  { $sort: { kg_total: -1 } },
  { $match: { "_id.classe": "Refrigerado" } }
];
mostrar("a_saida", db.movimentacoes.aggregate(original).toArray());
mostrar("a_explain", db.movimentacoes.explain("executionStats").aggregate(original));
// diagnóstico: o que o $limit pegou antes do $match
mostrar("a_ate_limit", db.movimentacoes.aggregate(original.slice(0, 3)).toArray());

// c) pipeline corrigido
const corrigido = [
  { $match: { classe: "Refrigerado" } },                                          // filtra primeiro (usa índice)
  { $group: { _id: "$terminal", kg_total: { $sum: "$peso_kg" }, mov: { $sum: 1 } } }, // agrupa só por terminal, com $
  { $sort: { kg_total: -1 } },                                                    // ordena ANTES de cortar
  { $limit: 3 },
  { $project: { _id: 0, terminal: "$_id", kg_total: 1, mov: 1 } }
];
mostrar("c_saida", db.movimentacoes.aggregate(corrigido).toArray());
mostrar("c_explain", db.movimentacoes.explain("executionStats").aggregate(corrigido));

// prova independente: soma em JavaScript, sem $group, varrendo os documentos Refrigerado
const soma = {};
db.movimentacoes.find({ classe: "Refrigerado" }, { _id: 0, terminal: 1, peso_kg: 1 }).forEach(d => {
  soma[d.terminal] = soma[d.terminal] || { kg_total: 0, mov: 0 };
  soma[d.terminal].kg_total += d.peso_kg; soma[d.terminal].mov += 1;
});
mostrar("prova_js", Object.entries(soma).map(([t, v]) => ({ terminal: t, ...v })).sort((x, y) => y.kg_total - x.kg_total));
