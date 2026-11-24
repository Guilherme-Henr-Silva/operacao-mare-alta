// (i) limpeza: remove SÓ as duplicatas criadas pelo CREATE (mesmo cnpj, mas sem nome/sancionada).
// DETACH leva junto a aresta SOCIA_DE {pct:30} que ficou presa entre as duas cópias.
MATCH (e:Empresa) WHERE e.cnpj IN ['E1','E2'] AND e.nome IS NULL
DETACH DELETE e;
