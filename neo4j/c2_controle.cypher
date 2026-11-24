// Controle positivo: a MESMA parte operacional da C2, mas com QUALQUER empresa (sem exigir SOCIA_DE).
// Serve para provar que o encontro terminal+data funciona e que o 0 da C2 vem da rede societária.
MATCH (s:Empresa {sancionada:true})
MATCH (ks:Container)-[:PERTENCE_A]->(s),
      (ks)-[ps:PASSOU_POR]->(t:Terminal)<-[px:PASSOU_POR]-(kx:Container)-[:PERTENCE_A]->(x:Empresa)
WHERE ps.data = px.data AND x <> s
RETURN DISTINCT x.nome AS empresa, kx.id AS container, t.nome AS terminal, px.data AS data, ks.id AS container_sancionada
ORDER BY data, terminal, empresa;
