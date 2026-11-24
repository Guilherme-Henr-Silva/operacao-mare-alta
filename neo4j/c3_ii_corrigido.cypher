// (ii) CORRIGIDO: profundidade limitada (1..3), direção definida (saindo da sancionada) e DISTINCT
PROFILE MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa)
WHERE x <> s
RETURN DISTINCT x.nome AS empresa_ligada ORDER BY empresa_ligada;
