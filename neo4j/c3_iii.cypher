// (iii) ANTES 1: trecho original, literalmente
MATCH (base:Container {id:'BASE_DA_PILHA'})-[:EMPILHADO_SOBRE*1..3]->(x:Container) RETURN x.id;
// ANTES 2: só trocando o texto pelo id real, mas mantendo a direção errada
MATCH (base:Container {id:'K28'})-[:EMPILHADO_SOBRE*1..3]->(x:Container) RETURN x.id;
// conferência: existe contêiner com id 'BASE_DA_PILHA'? e quais arestas tocam K28?
MATCH (c:Container {id:'BASE_DA_PILHA'}) RETURN count(c) AS existe_BASE_DA_PILHA;
MATCH (a:Container)-[:EMPILHADO_SOBRE]->(b:Container) WHERE a.id='K28' OR b.id='K28' RETURN a.id AS topo, b.id AS base;
// CORRIGIDO: id real e seta apontando PARA a base (quem está em cima aponta pra quem está embaixo)
MATCH (base:Container {id:'K28'})<-[:EMPILHADO_SOBRE*1..3]-(x:Container) RETURN DISTINCT x.id AS preso_acima ORDER BY preso_acima;
