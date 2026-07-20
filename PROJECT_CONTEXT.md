# Projeto CMV Dashboard - Contexto completo

## 1. Visão geral
Este projeto é uma aplicação web em React + TypeScript + Vite para análise operacional de restaurantes, com foco em:
- cruzamento entre vendas e fichas técnicas;
- cálculo de CMV, lucro bruto, margem e cobertura de ficha;
- análise de DRE (Demonstração de Resultados);
- entrada de dados de estoque/mercadorias;
- autenticação local e opcionalmente via Supabase;
- gestão de múltiplos restaurantes e perfis de usuário.

## 2. Objetivo do sistema
O sistema tem como objetivo transformar arquivos de vendas e fichas técnicas em indicadores executivos úteis para operação e gestão, permitindo:
- comparar vendas x custo teórico;
- identificar itens sem correspondência;
- analisar performance por período;
- visualizar dados por grupo/subgrupo;
- apoiar decisões operacionais com base em dados importados.

## 3. Stack tecnológica
- React 18
- TypeScript
- Vite
- Vitest (testes unitários)
- Playwright (testes E2E)
- Supabase (autenticação e dados remotos opcionais)
- xlsx para leitura de arquivos .xlsx/.xls/.csv
- CSS customizado no arquivo principal de estilos

## 4. Estrutura do projeto

### Pasta principal
- src/App.tsx
  - ponto central da aplicação.
  - coordena estado global e fluxo de navegação.

- src/components/
  - painéis visuais e componentes da UI.
  - principais arquivos:
    - appChrome.tsx: header, navegação, avatar, switchers de idioma/tema.
    - dashboardShell.tsx: layout da área logada e carregamento de seções.
    - cmvPanels.tsx: dashboard executivo de CMV.
    - drePanels.tsx: análise de DRE.
    - goodsEntryPanels.tsx: entrada de dados de mercadorias.
    - accountPanels.tsx: perfil, restaurante, gestão de usuários.
    - helpPage.tsx: página de ajuda.

- src/hooks/
  - hooks de estado e regras de negócio.
  - principais arquivos:
    - useOperationalData.ts: importação, parsing, dashboard e estado operacional.
    - useSessionWorkspace.ts: sessão, seleção de restaurante e navegação por seção.
    - useAccountManagement.ts: edição de perfil e gestão de contas/restaurantes.
    - useOwnerInvitations.ts: convites e permissões de owner.
    - useAppPresentation.ts: textos e labels da interface.

- src/utils/
  - lógica de processamento, parsing e integração.
  - principais arquivos:
    - cmv.ts: cálculo de dashboard e agregação de indicadores.
    - file.ts: leitura e parsing de planilhas.
    - auth.ts: lógica local de autenticação.
    - cloudAuth.ts: integração com Supabase.
    - supabase.ts: configuração do cliente Supabase.

- src/types.ts
  - modelos centrais do sistema.

- src/i18n.tsx
  - textos multilíngues.

- src/styles.css
  - estilos globais do app.

## 5. Fluxos principais

### 5.1 Autenticação
- O app suporta modo local e modo Supabase.
- Em modo local, há um fluxo simples de login demo.
- Em modo Supabase, há autenticação real, contas e permissões por restaurante.

### 5.2 Importação de dados
O usuário pode importar:
- vendas
- fichas técnicas
- DRE
- entradas de mercadorias

Os arquivos são lidos pelo módulo de parsing, que tenta identificar colunas de forma flexível, mesmo com variações de nome.

### 5.3 Processamento de CMV
- Vendas são consolidadas por produto/código.
- Fichas técnicas são mapeadas por código.
- O sistema tenta ligar vendas a fichas e calcular:
  - receita
  - custo
  - lucro bruto
  - CMV médio
  - cobertura de receita/custo
  - ranking por grupo/subgrupo

### 5.4 Gestão de restaurantes e contas
- Há suporte a múltiplos restaurantes por conta.
- Perfis podem ter papéis de owner, admin ou viewer.
- O owner pode gerenciar usuários e permissões.

### 5.5 Navegação por seção
As principais seções são:
- dashboard
- dre
- goods-entry
- restaurants
- account
- user-management
- help

## 6. Regras de negócio atuais
- O cruzamento principal entre venda e ficha técnica é feito pelo código.
- Linhas especiais de grupo/subgrupo são preservadas para contexto.
- Totais gerais e subtotais não entram no cruzamento de produtos, mas aparecem no dashboard.
- O app tenta ser tolerante a diferenças de formatação em planilhas.
- Há validação de colunas esperadas, com mensagens de erro quando o formato não corresponde.

## 7. Estado atual do projeto
### Funcionalidades já implementadas
- autenticação local e online
- layout da dashboard com sidebar e cabeçalho
- importação e processamento de vendas e fichas técnicas
- renderização de dashboard CMV
- painel de DRE
- painel de entradas/mercadorias
- gerenciamento de restaurantes e contas
- página de ajuda estática
- testes unitários e E2E
- melhorias visuais de interface e UX

### Melhorias já realizadas recentemente
- correção de mensagens de erro e UI de importação
- ajustes de ícones e botões
- melhoria visual do topo da dashboard
- carregamento sob demanda de painéis pesados via lazy loading
- padronização de mensagens e erros em várias áreas

## 8. Pontos de atenção
- ainda há espaço para melhora na correspondência entre venda e ficha técnica;
- a performance pode ser otimizada mais ainda com lazy loading e divisão de bundle adicional;
- a experiência de importação pode ficar mais robusta e amigável;
- o sistema ainda depende muito de estrutura padronizada das planilhas importadas;
- o fluxo de onboarding não é mais prioridade neste momento.

## 9. Como o projeto deve ser visto em uma versão completa
Uma versão funcional completa deveria incluir:
- importação confiável de arquivos reais de operação;
- análise consistente e confiável de CMV e DRE;
- experiência fluida em desktop e mobile;
- gestão de contas, restaurantes e permissões;
- testes sólidos cobrindo fluxos críticos;
- performance aceitável para uso real.

## 10. Próximos passos recomendados
1. melhorar matching fuzzy entre vendas e fichas;
2. adicionar comparativos entre períodos;
3. criar monitoramento básico de eventos e erros;
4. melhorar parsing e validação para formatos reais de planilha;
5. otimizar further bundle e renderização;
6. revisar experiência de importação e mensagens.
