// C1 — consultas usadas para montar o subgrafo real da EMPRESA_SANCIONADA (E22)

// sócios diretos, nas duas direções, com o pct real
MATCH (s:Empresa {cnpj:'E22'})-[r:SOCIA_DE]->(x:Empresa)
RETURN 'E22 -> x' AS sentido, s.cnpj AS de, x.cnpj AS para, x.nome AS nome, r.pct AS pct ORDER BY para;

MATCH (x:Empresa)-[r:SOCIA_DE]->(s:Empresa {cnpj:'E22'})
RETURN 'x -> E22' AS sentido, x.cnpj AS de, s.cnpj AS para, x.nome AS nome, r.pct AS pct ORDER BY de;

// propriedades da sancionada
MATCH (s:Empresa {sancionada:true}) RETURN s.cnpj, s.nome, s.sancionada;

// contêineres da sancionada e por onde passaram
MATCH (k:Container)-[:PERTENCE_A]->(s:Empresa {cnpj:'E22'})
OPTIONAL MATCH (k)-[p:PASSOU_POR]->(t:Terminal)
RETURN k.id, k.classe, t.nome, p.data ORDER BY k.id, p.data;

// pilha da BASE_DA_PILHA (K28), só pra ter um exemplo de EMPILHADO_SOBRE
MATCH (a:Container)-[:EMPILHADO_SOBRE]->(b:Container) WHERE a.id IN ['K28','K29','K30','K31'] OR b.id = 'K28'
RETURN a.id AS topo, b.id AS base ORDER BY topo;
