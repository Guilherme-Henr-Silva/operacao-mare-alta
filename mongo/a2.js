// A2 — Incidente no pátio
// INCIDENTE do Google Maps: -25.4680, -48.4930 (lat, lon) -> GeoJSON [lon, lat]
db = db.getSiblingDB("logiporto");

const INCIDENTE = { type: "Point", coordinates: [-48.4930, -25.4680] };
const consulta = { posicao: { $near: { $geometry: INCIDENTE, $maxDistance: 300 } } }; // metros
const marca = (s) => print("===A2_" + s + "===");

// 1) antes do índice 2dsphere
marca("antes");
try {
  db.movimentacoes.find(consulta).limit(10).toArray();
  print("rodou sem erro (inesperado)");
} catch (e) {
  print(EJSON.stringify({ code: e.code, codeName: e.codeName, errmsg: e.errmsg || e.message }, null, 2));
}

// 2) índice geoespacial esférico
marca("createIndex");
print(db.movimentacoes.createIndex({ posicao: "2dsphere" }));

// 3) explain da consulta
marca("explain");
print(EJSON.stringify(db.movimentacoes.find(consulta).limit(10).explain("executionStats"), null, 2, { relaxed: true }));

// 4) resultado, com a distância em metros (via $geoNear só para mostrar a distância)
marca("resultado");
db.movimentacoes.aggregate([
  { $geoNear: { near: INCIDENTE, distanceField: "dist_m", maxDistance: 300, spherical: true } },
  { $limit: 10 },
  { $project: { _id: 0, container: 1, terminal: 1, tipo: 1, posicao: 1, dist_m: { $round: ["$dist_m", 1] } } }
]).forEach(d => print(EJSON.stringify(d)));

// 5) prova da armadilha: mesma consulta com [lat, lon] invertido
marca("invertido");
print("resultados com [lat, lon] invertido: " +
  db.movimentacoes.countDocuments({ posicao: { $geoWithin: { $centerSphere: [[-25.4680, -48.4930], 300 / 6378100] } } }));
print("total dentro do raio de 300 m (ordem certa): " +
  db.movimentacoes.countDocuments({ posicao: { $geoWithin: { $centerSphere: [INCIDENTE.coordinates, 300 / 6378100] } } }));
