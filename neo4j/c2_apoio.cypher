// C2 — consultas de apoio (conferência)
// empresas alcançadas a partir da E22, com o menor nível
MATCH p=(s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa) WHERE x <> s
RETURN x.cnpj AS empresa, min(length(p)) AS nivel, count(p) AS caminhos ORDER BY nivel, empresa;
// quantas linhas a C2 teria SEM o DISTINCT
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa) WHERE x <> s
MATCH (ks:Container)-[:PERTENCE_A]->(s), (ks)-[ps:PASSOU_POR]->(t:Terminal)<-[px:PASSOU_POR]-(kx:Container)-[:PERTENCE_A]->(x)
WHERE ps.data = px.data
RETURN count(*) AS linhas_sem_distinct;
// comparação: direção contrária e sem direção
MATCH (s:Empresa {sancionada:true})<-[:SOCIA_DE*1..3]-(x:Empresa) WHERE x <> s RETURN 'entrando' AS direcao, count(DISTINCT x) AS empresas;
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]-(x:Empresa) WHERE x <> s RETURN 'sem direcao' AS direcao, count(DISTINCT x) AS empresas;
// mostra o contêiner da sancionada que bateu, pra ver o "encontro"
MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*1..3]->(x:Empresa) WHERE x <> s
MATCH (ks:Container)-[:PERTENCE_A]->(s), (ks)-[ps:PASSOU_POR]->(t:Terminal)<-[px:PASSOU_POR]-(kx:Container)-[:PERTENCE_A]->(x)
WHERE ps.data = px.data
RETURN DISTINCT ks.id AS container_sancionada, kx.id AS container_investigada, x.cnpj AS empresa, t.nome AS terminal, ps.data AS data;
// todas as arestas SOCIA_DE que tocam E11 ou E22 (componente isolado?)
MATCH (a:Empresa)-[r:SOCIA_DE]->(b:Empresa) WHERE a.cnpj IN ['E11','E22'] OR b.cnpj IN ['E11','E22']
RETURN a.cnpj AS de, b.cnpj AS para, r.pct AS pct;
// contêineres e passagens da E11, para comparar com as da E22
MATCH (k:Container)-[:PERTENCE_A]->(:Empresa {cnpj:'E11'}) OPTIONAL MATCH (k)-[p:PASSOU_POR]->(t:Terminal)
RETURN k.id AS container_E11, t.nome AS terminal, p.data AS data ORDER BY data;
// passagens (terminal, data) que a E11 tem em comum com a E22 — controle
MATCH (:Empresa {cnpj:'E22'})<-[:PERTENCE_A]-(:Container)-[p1:PASSOU_POR]->(t:Terminal)
MATCH (:Empresa {cnpj:'E11'})<-[:PERTENCE_A]-(:Container)-[p2:PASSOU_POR]->(t)
RETURN t.nome AS terminal, p1.data AS data_E22, p2.data AS data_E11, p1.data = p2.data AS mesma_data ORDER BY terminal, data_E22;
