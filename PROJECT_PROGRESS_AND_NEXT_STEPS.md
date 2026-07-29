# Projeto CMV Dashboard - Progresso e próximos passos

## 1. Status geral
O projeto está em uma fase funcional, com o core da aplicação já implementado e validado. A base de importação, cálculo de dashboard, autenticação e navegação já estão operando.

## 2. O que já foi concluído

### Funcionalidades principais
- aplicação React + TypeScript + Vite funcionando;
- fluxo de login local e integração opcional com Supabase;
- importação de vendas e fichas técnicas;
- cálculo de CMV, lucro bruto, cobertura de fichas e métricas principais;
- dashboard com visão por período e grupo/subgrupo;
- painel de DRE;
- painel de entradas/mercadorias;
- gestão de restaurantes e perfis;
- página de ajuda estática;
- testes unitários e E2E cobrindo cenários principais.

### Melhorias de UX e estabilidade
- padronização de mensagens de erro;
- correção de textos malformados e mensagens inconsistentes;
- ajustes visuais no shell da dashboard;
- melhorias no layout do topo e botões;
- lazy loading de painéis pesados para reduzir carga inicial.

### Validação recente
- testes unitários: aprovados;
- testes E2E: aprovados para fluxo principal;
- build: aprovado.

## 3. O que ainda precisa ser feito para fechar uma versão completa funcional

### 3.1 Melhorar correspondência entre vendas e fichas técnicas
Prioridade alta.

Problema atual:
- o mapeamento depende muito do código exato.
- pequenas diferenças de formatação, espaços, pontuação ou códigos alternativos podem quebrar o matching.

Próximo passo:
- implementar heurísticas e matching fuzzy para comparar códigos e nomes.
- considerar normalização robusta de strings.
- criar fallback para casos de correspondência parcial.

### 3.2 Melhorar parsing e validação de arquivos reais
Prioridade alta.

Problema atual:
- a importação funciona bem para formatos esperados, mas pode falhar com variações reais de planilha.

Próximo passo:
- expandir suporte a diferentes layouts de arquivo.
- melhorar detecção de colunas e mensagens de erro.
- validar se o sistema consegue ler planilhas mais heterogêneas sem quebrar.

### 3.3 Comparativos entre períodos
Prioridade média/alta.

Próximo passo:
- adicionar comparação entre meses/períodos;
- mostrar tendências de faturamento, custo e CMV;
- permitir análise temporal mais forte na dashboard.

### 3.4 Monitoramento básico e logs
Prioridade média.

Próximo passo:
- registrar eventos de importação, erros e transições de estado;
- guardar logs simples para diagnóstico e posterior análise.

### 3.5 Performance
Prioridade média.

Próximo passo:
- continuar otimizando bundle e carregamento;
- revisar componentes pesados e reduzir custo de renderização;
- aplicar lazy loading adicional quando possível.

### 3.6 Qualidade e regressão
Prioridade média.

Próximo passo:
- adicionar testes de integração para parsing de planilhas reais;
- expandir cobertura para fluxos de importação e cálculos.

## 4. Ordem recomendada de implementação
1. matching fuzzy entre vendas e fichas;
2. parsing/validação mais robusta para planilhas reais;
3. comparativos temporais;
4. logging e telemetria básica;
5. otimizações de performance adicionais;
6. testes de integração e regressão.

## 5. Critério de conclusão de uma versão completa funcional
A versão pode ser considerada completa quando:
- o usuário consegue importar arquivos reais sem grandes fricções;
- o sistema faz o matching corretamente na maioria dos casos;
- as métricas principais são confiáveis;
- o app funciona bem em uso real com múltiplos períodos e restaurantes;
- há testes cobrindo os fluxos críticos;
- a performance é aceitável para operação diária.

## 6. Observação importante
O projeto já passou por uma fase forte de estabilização e UI. O próximo salto de valor está em tornar a análise mais robusta, menos dependente de formatos perfeitos e mais útil para uso real.
