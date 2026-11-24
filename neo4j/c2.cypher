// C2 — empresas ligadas à sancionada (até 3 níveis, saindo dela) com contêiner
// no mesmo terminal e na mesma data que um contêiner da sancionada
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa)
WHERE x <> s
MATCH (ks:Container)-[:PERTENCE_A]->(s),
      (ks)-[ps:PASSOU_POR]->(t:Terminal)<-[px:PASSOU_POR]-(kx:Container)-[:PERTENCE_A]->(x)
WHERE ps.data = px.data
RETURN DISTINCT x.nome AS empresa_investigada, kx.id AS container, t.nome AS terminal, px.data AS data
ORDER BY data, terminal, empresa_investigada;
