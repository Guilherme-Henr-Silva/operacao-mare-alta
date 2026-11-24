# C1 — Modelo do grafo do LogiPorto

Consultas usadas: [`c1_consultas.cypher`](c1_consultas.cypher) · saída real: [`c1_subgrafo_E22.txt`](c1_subgrafo_E22.txt)

## 1. Modelo (rótulos, relacionamentos, direções e propriedades)

```mermaid
flowchart LR
    E1["<b>:Empresa</b><br/>cnpj: String<br/>nome: String<br/>sancionada: Boolean"]
    E2["<b>:Empresa</b><br/>(outra empresa)"]
    C1["<b>:Container</b><br/>id: String<br/>classe: String"]
    C2["<b>:Container</b><br/>(contêiner de baixo)"]
    T["<b>:Terminal</b><br/>nome: String"]

    E1 -- "SOCIA_DE<br/>{pct: Integer}" --> E2
    C1 -- "PERTENCE_A" --> E1
    C1 -- "PASSOU_POR<br/>{data: String 'AAAA-MM-DD'}" --> T
    C1 -- "EMPILHADO_SOBRE" --> C2

    classDef empresa fill:#fde2e2,stroke:#b42318,color:#111;
    classDef container fill:#e0ecff,stroke:#1d4ed8,color:#111;
    classDef terminal fill:#e3f5e1,stroke:#15803d,color:#111;
    class E1,E2 empresa;
    class C1,C2 container;
    class T terminal;
```

`SOCIA_DE` e `EMPILHADO_SOBRE` ligam nós do **mesmo** rótulo. Desenhei duas caixas de `:Empresa` e duas de `:Container` só para a seta ficar legível. No banco é o mesmo rótulo.

| Relacionamento | Direção | Significado | Propriedade |
|---|---|---|---|
| `SOCIA_DE` | `(a:Empresa)-->(b:Empresa)` | **a** tem participação no capital de **b** | `pct`: % de participação |
| `PERTENCE_A` | `(:Container)-->(:Empresa)` | o contêiner é dessa empresa | — |
| `PASSOU_POR` | `(:Container)-->(:Terminal)` | o contêiner passou pelo terminal | `data`: dia da passagem |
| `EMPILHADO_SOBRE` | `(topo:Container)-->(base:Container)` | o de cima está apoiado no de baixo | — |

## 2. Exemplo real: EMPRESA_SANCIONADA (E22) e sócios diretos

Dados tirados do meu Neo4j (não inventados):
- E22 tem **um** sócio direto: ela é sócia da **E11** com **pct = 10**.
- **Nenhuma** empresa tem `SOCIA_DE` apontando para a E22.
- A E22 é dona de 5 contêineres. Mostro as passagens reais deles e a pilha da BASE_DA_PILHA (K28), porque o K31, que é da E22, está no topo dela.

```mermaid
flowchart LR
    E22["<b>:Empresa</b><br/>cnpj: 'E22'<br/>nome: 'Empresa 22'<br/>sancionada: true"]
    E11["<b>:Empresa</b><br/>cnpj: 'E11'<br/>nome: 'Empresa 11'<br/>sancionada: false"]
    E22 -- "SOCIA_DE {pct: 10}" --> E11

    K0["<b>:Container</b><br/>id: 'K0'<br/>classe: 'Perigoso'"]
    K1["<b>:Container</b><br/>id: 'K1'<br/>classe: 'Granel'"]
    K2["<b>:Container</b><br/>id: 'K2'<br/>classe: 'Granel'"]
    K8["<b>:Container</b><br/>id: 'K8'<br/>classe: 'Perigoso'"]
    K31["<b>:Container</b><br/>id: 'K31'<br/>classe: 'Geral'"]
    K0 -- PERTENCE_A --> E22
    K1 -- PERTENCE_A --> E22
    K2 -- PERTENCE_A --> E22
    K8 -- PERTENCE_A --> E22
    K31 -- PERTENCE_A --> E22

    T1["<b>:Terminal</b><br/>nome: 'T1'"]
    T2["<b>:Terminal</b><br/>nome: 'T2'"]
    T5["<b>:Terminal</b><br/>nome: 'T5'"]
    K0 -- "PASSOU_POR {data: '2026-10-20'}" --> T1
    K0 -- "PASSOU_POR {data: '2026-10-26'}" --> T1
    K1 -- "PASSOU_POR {data: '2026-10-05'}" --> T2
    K1 -- "PASSOU_POR {data: '2026-10-20'}" --> T5
    K2 -- "PASSOU_POR {data: '2026-10-03'}" --> T5
    K2 -- "PASSOU_POR {data: '2026-10-18'}" --> T5
    K8 -- "PASSOU_POR {data: '2026-10-09'}" --> T5
    K8 -- "PASSOU_POR {data: '2026-10-18'}" --> T2
    K31 -- "PASSOU_POR {data: '2026-10-22'}" --> T2
    K31 -- "PASSOU_POR {data: '2026-10-28'}" --> T2

    K28["<b>:Container</b><br/>id: 'K28'<br/>(BASE_DA_PILHA)"]
    K29["<b>:Container</b><br/>id: 'K29'"]
    K30["<b>:Container</b><br/>id: 'K30'"]
    K29 -- EMPILHADO_SOBRE --> K28
    K30 -- EMPILHADO_SOBRE --> K29
    K31 -- EMPILHADO_SOBRE --> K30

    classDef empresa fill:#fde2e2,stroke:#b42318,color:#111;
    classDef sancionada fill:#b42318,stroke:#7a1010,color:#fff;
    classDef container fill:#e0ecff,stroke:#1d4ed8,color:#111;
    classDef terminal fill:#e3f5e1,stroke:#15803d,color:#111;
    class E11 empresa;
    class E22 sancionada;
    class K0,K1,K2,K8,K31,K28,K29,K30 container;
    class T1,T2,T5 terminal;
```

## Legenda

| Elemento | Representa |
|---|---|
| Caixa vermelha escura | `:Empresa` com `sancionada: true` (E22) |
| Caixa vermelha clara | `:Empresa` |
| Caixa azul | `:Container` |
| Caixa verde | `:Terminal` |
| Seta `-->` | relacionamento, na direção em que está gravado no banco |
| `TIPO {prop: valor}` na seta | tipo do relacionamento e as propriedades **dele** |
| Texto dentro da caixa | rótulo e propriedades do nó |

## Por que não tem FK nem tabela associativa

- A participação societária não é uma tabela `socios(empresa_id, socia_id, pct)`. Ela é o próprio relacionamento `SOCIA_DE`, e o `pct` mora **na aresta**.
- A data da passagem também fica na aresta `PASSOU_POR`. Um contêiner que passou duas vezes no mesmo terminal tem **duas arestas** (como o K0 em T1 e o K31 em T2), e não duas linhas numa tabela de junção.
- O contêiner não guarda `dono_cnpj`. Quem diz o dono é a aresta `PERTENCE_A`. Para chegar da empresa ao terminal, o Neo4j segue ponteiros de nó em nó, sem precisar de JOIN por chave.
