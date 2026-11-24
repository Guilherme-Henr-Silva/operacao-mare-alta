// (ii) trecho original + LIMIT 20 (pedido do enunciado), com PROFILE para ver o trabalho
PROFILE MATCH (s:Empresa {sancionada:true})-[:SOCIA_DE*]-(x:Empresa) RETURN x.nome LIMIT 20;
