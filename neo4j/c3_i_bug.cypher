// (i) trecho original, rodado como está (reproduz o sintoma)
CREATE (a:Empresa {cnpj:'E1'})-[:SOCIA_DE {pct:30}]->(b:Empresa {cnpj:'E2'});
