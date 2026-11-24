// (ii) mesma comparação a partir da E18 (componente grande), só pra ver o efeito da correção
MATCH (s:Empresa {cnpj:'E18'})-[:SOCIA_DE*]-(x:Empresa) RETURN 'original (sem limite, sem direção) LIMIT 20' AS versao, count(*) AS linhas, count(DISTINCT x) AS distintas LIMIT 20;
MATCH (s:Empresa {cnpj:'E18'})-[:SOCIA_DE*1..3]->(x:Empresa) WHERE x <> s RETURN 'corrigida: caminhos' AS versao, count(*) AS linhas, count(DISTINCT x) AS distintas;
