// (i) ANTES: estado de E1/E2 antes de rodar o trecho com defeito
MATCH (e:Empresa) WHERE e.cnpj IN ['E1','E2'] RETURN e.cnpj AS cnpj, e.nome AS nome, e.sancionada AS sancionada, elementId(e) AS id ORDER BY cnpj;
MATCH (a:Empresa {cnpj:'E1'})-[r:SOCIA_DE]->(b:Empresa {cnpj:'E2'}) RETURN count(r) AS arestas_E1_E2;
MATCH (e:Empresa) RETURN count(e) AS total_empresas;
