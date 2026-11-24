// (i) CORRIGIDO: acha as duas empresas que já existem e cria a aresta só se ela ainda não existir
MATCH (a:Empresa {cnpj:'E1'}), (b:Empresa {cnpj:'E2'})
MERGE (a)-[r:SOCIA_DE]->(b)
ON CREATE SET r.pct = 30
ON MATCH  SET r.pct = 30
RETURN a.nome AS de, b.nome AS para, r.pct AS pct;
