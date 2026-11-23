// A3 — O TTL que não apaga
db = db.getSiblingDB("logiporto");
const ttlStats = () => db.serverStatus().metrics.ttl;  // passes = rodadas do monitor, deletedDocuments = total apagado
const linha = (t) => print("\n### " + t);

// 0) cenário do desenvolvedor anterior: índice TTL de 30 dias em registrado_em
linha("0) índice criado pelo dev anterior");
print(db.alertas.createIndex({ registrado_em: 1 }, { expireAfterSeconds: 2592000 }));

// 1) o índice está lá e está certo
linha("1) getIndexes()");
printjson(db.alertas.getIndexes());

// 2) espera o monitor de TTL passar (ele roda a cada 60 s) e vê se algo sumiu
linha("2) monitor de TTL: antes x depois de ~75 s");
const antes = { docs: db.alertas.countDocuments(), ttl: ttlStats() };
sleep(75 * 1000);
const depois = { docs: db.alertas.countDocuments(), ttl: ttlStats() };
printjson({ antes, depois });

// 3) quantos deveriam ter expirado? (comparando como texto ISO, que é o que está gravado)
linha("3) alertas com mais de 30 dias");
const limite = new Date(Date.now() - 2592000 * 1000);
print("agora: " + new Date().toISOString() + " | limite (agora - 30 dias): " + limite.toISOString());
print("registrado_em < limite (comparando string ISO): " + db.alertas.countDocuments({ registrado_em: { $lt: limite.toISOString() } }));
print("registrado_em < limite (comparando BSON Date):  " + db.alertas.countDocuments({ registrado_em: { $lt: limite } }));

// 4) PROVA: tipo BSON do campo
linha("4) aggregate por $type");
db.alertas.aggregate([
  { $group: { _id: { $type: "$registrado_em" }, qtd: { $sum: 1 }, exemplo: { $first: "$registrado_em" } } }
]).forEach(printjson);

// 5) contraprova: um alerta gravado do jeito certo (Date) e um do jeito errado (string), os dois com 40 dias
linha("5) contraprova com 2 alertas de teste");
const quarentaDias = new Date(Date.now() - 40 * 86400000);
db.alertas.insertMany([
  { sensor: "TESTE_A3_DATE", nivel: "info", registrado_em: quarentaDias },
  { sensor: "TESTE_A3_STRING", nivel: "info", registrado_em: quarentaDias.toISOString() }
]);
print("logo após inserir: " + EJSON.stringify(db.alertas.find({ sensor: /^TESTE_A3/ }, { _id: 0 }).toArray()));
sleep(75 * 1000);
print("~75 s depois:      " + EJSON.stringify(db.alertas.find({ sensor: /^TESTE_A3/ }, { _id: 0 }).toArray()));
printjson({ ttl_final: ttlStats() });

// limpa o alerta de teste que sobrou (o de string, que o TTL nunca vai apagar)
db.alertas.deleteMany({ sensor: /^TESTE_A3/ });
print("total final de alertas: " + db.alertas.countDocuments());
