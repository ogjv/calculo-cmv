import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import { Suspense, lazy } from "react";
import { useRef } from "react";
import type { AccountInvitation, AccountMember, AuthSession, DashboardData, DrePeriodData, GroupSummary, ImportValidation, PeriodDashboard, PersistedWorkspace, ProductSummary, RecipeRow, SalesTotalRow, UploadFeedbackItem } from "./types";
import { buildDashboardData, buildDashboardSlice, formatCurrency, formatNumber, formatPercent, mapRecipeRows, mapSalesRows } from "./utils/cmv";
import { AuthScreen, BrandMark, DashboardShellHeader, InternalNavigation, UserAvatar } from "./components/appChrome";
import { DashboardReadOnlyGuide, RestaurantNavigatorPanel } from "./components/dashboardPanels";
import { type DrePanelCopy, getDrePeriodKey, getDrePeriodLabel, getDreRevenueGroups, getDreRevenueValue } from "./components/drePanels";
import { DEFAULT_INVITE_FEATURE, type InviteFormState } from "./components/teamPanels";
import { parseDreSpreadsheetFile, parseSalesSpreadsheetFile, parseSpreadsheetFile } from "./utils/file";
import { createLocalRestaurantForAccount, deleteLocalRestaurantAccount, deleteLocalRestaurantFromAccount, loadRestaurantWorkspace, registerRestaurant, restoreSession, saveRestaurantWorkspace, signIn, signOut, updateLocalRestaurantProfile, updateLocalUserProfile } from "./utils/auth";
import { createAccountInvitation, createSupabaseRestaurantForCurrentUser, deleteSupabaseRestaurantAccount, deleteSupabaseRestaurantFromAccount, getSupabaseSession, hydrateSupabaseSession, loadAccountInvitations, loadAccountMembers, loadCloudWorkspace, registerRestaurantWithSupabase, removeAccountMemberAccess, revokeAccountInvitation, saveCloudWorkspace, signInWithSupabase, signOutFromSupabase, subscribeToSupabaseAuth, updateAccountMemberAccess, updateSupabaseRestaurantProfile, updateSupabaseUserProfile } from "./utils/cloudAuth";
import { isSupabaseConfigured } from "./utils/supabase";

type Locale = "pt" | "es" | "en";
type ThemeMode = "light" | "dark";

const LazyAccountSettingsPanel = lazy(() =>
  import("./components/accountPanels").then((module) => ({ default: module.AccountSettingsPanel }))
);
const LazyRestaurantManagementPanel = lazy(() =>
  import("./components/accountPanels").then((module) => ({ default: module.RestaurantManagementPanel }))
);
const LazyDreAnalysisPanel = lazy(() =>
  import("./components/drePanels").then((module) => ({ default: module.DreAnalysisPanel }))
);
const LazyTeamPermissionsPanel = lazy(() =>
  import("./components/teamPanels").then((module) => ({ default: module.TeamPermissionsPanel }))
);

const piePalette = ["#1f7a5a", "#e09f3e", "#d95d39", "#457b9d", "#8d6a9f", "#c36f6f", "#49796b", "#7b8cde"];

type UploadState = {
  salesFileNames?: string[];
  recipeFileName?: string;
  data?: DashboardData;
  periodDashboards?: PeriodDashboard[];
  validations?: ImportValidation[];
  recipeBase?: RecipeRow[];
  duplicateRecipeCodes?: string[];
  error?: string;
  processing?: boolean;
};

type PieDatum = {
  name: string;
  value: number;
  share: number;
  color: string;
};

type ProfileFormState = {
  restaurantName: string;
  profilePhotoUrl?: string;
};

type UserProfileFormState = {
  fullName: string;
  userPhotoUrl?: string;
};

type InternalSection = "account" | "dashboard" | "dre" | "restaurants" | "team";

const TOTAL_VIEW = "__TOTAL__";
const TOTAL_PERIOD = "__ALL_PERIODS__";
const DEFAULT_DRE_PERIOD = "__LATEST_DRE__";
const ACTIVE_RESTAURANT_STORAGE_PREFIX = "grest.activeRestaurant.";
const THEME_STORAGE_KEY = "grest.theme";
const AUTH_BOOT_TIMEOUT_MS = 30000;
const AUTH_HYDRATE_TIMEOUT_MS = 15000;
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return "light";
};

const translations = {
  pt: {
    brandTagline: "Gest\u00e3o para restaurantes",
    heroEyebrow: "Plataforma anal\u00edtica de CMV",
    heroTitle: "Transforme relat\u00f3rios operacionais em decis\u00f5es mais r\u00e1pidas para o restaurante.",
    heroText: "A G/REST organiza vendas, fichas t\u00e9cnicas e indicadores de custo em uma experi\u00eancia visual limpa, orientada para leitura gerencial e a\u00e7\u00e3o imediata.",
    heroGainEyebrow: "O que voc\u00ea ganha",
    heroGainTitle: "Uma opera\u00e7\u00e3o mais leg\u00edvel para o gestor.",
    heroGainText: "Menos planilha bruta, mais clareza sobre onde vender bem, onde custa caro e onde falta cadastro.",
    uploadTitle: "Importa\u00e7\u00e3o guiada",
    uploadText: "Carregue a base de vendas, conecte as fichas t\u00e9cnicas e acompanhe a leitura visual do CMV sem retrabalho manual.",
    processEyebrow: "Fluxo do sistema",
    processTitle: "Como a an\u00e1lise funciona",
    processText: "Uma interface mais explicativa reduz erro operacional e acelera o uso por qualquer pessoa da equipe.",
    total: "TOTAL",
    language: "Idioma",
    theme: "Tema",
    themeLight: "Claro",
    themeDark: "Escuro",
    processing: "Processando arquivos e atualizando o dashboard...",
    success: "Arquivos processados com sucesso.",
    sales: "Vendas",
    recipes: "Fichas t\u00e9cnicas",
    analysis: "An\u00e1lise",
    salesStepText: "Um ou v\u00e1rios relat\u00f3rios com C\u00d3DIGO, PRODUTO, QTE e TOTAL",
    recipesStepText: "Arquivo-base com C\u00d3DIGO, PRODUTO, PRE\u00c7O, CUSTO e CMV",
    analysisStepText: "Painel consolidado, recortes por m\u00eas e vis\u00e3o por grupo",
    salesUpload: "Relat\u00f3rio de vendas",
    salesUploadDefault: "Selecione um ou mais arquivos de vendas",
    salesUploadMany: (count: number) => `${count} arquivo(s) de vendas selecionado(s)`,
    salesUploadHint: "Estrutura com grupos, subgrupos, itens e totais do per\u00edodo. A base fica acumulativa por compet\u00eancia.",
    recipesUpload: "Fichas t\u00e9cnicas",
    recipesUploadDefault: "Selecione o arquivo de fichas t\u00e9cnicas",
    recipesUploadHint: "O cruzamento principal \u00e9 feito pelo c\u00f3digo do item, respeitando itens promocionais e lacunas de FT",
    recipesUploadLocked: "Envie primeiro pelo menos um arquivo de vendas",
    periodImported: "Per\u00edodo importado",
    consolidatedBase: "Base consolidada",
    importedPeriods: (count: number) => `${count} per\u00edodos importados`,
    kpiRevenue: "Faturamento",
    kpiCost: "Custo te\u00f3rico",
    kpiProfit: "Lucro bruto",
    kpiMissingFt: "Itens sem FT",
    kpiPromo: "Promocionais",
    soldItems: (count: string) => `${count} itens vendidos`,
    coverage: (value: string) => `${value} de cobertura de fichas`,
    costHint: (value: string) => `${value} do faturamento`,
    margin: (value: string) => `Margem de ${value}`,
    promoHint: "Custo entra, CMV n\u00e3o classifica",
    periodAnalyzed: "Per\u00edodo analisado",
    periodAnalyzedText: "Use TOTAL para ver o consolidado ou escolha um m\u00eas importado para analisar aquele fechamento isoladamente.",
    groupFilter: "Filtro de visualiza\u00e7\u00e3o",
    groupFilterText: "Use TOTAL para a vis\u00e3o geral ou escolha um grupo para abrir apenas aquele recorte.",
    chartSalesTitle: "Participa\u00e7\u00e3o das vendas por grupo",
    chartSalesText: "Cada fatia mostra o peso do grupo no faturamento. Clique para detalhar.",
    chartSalesCenter: "faturamento total",
    chartCostTitle: "Participa\u00e7\u00e3o do custo por grupo",
    chartCostText: "Leitura complementar para entender onde o custo se concentra.",
    chartCostCenter: "custo total",
    cmvRangesTitle: "Faixas de CMV",
    cmvRangesText: "Leitura r\u00e1pida do risco do card\u00e1pio por cor.",
    below15: "Abaixo de 15%",
    between15And30: "Entre 15% e 30%",
    above30: "Acima de 30%",
    itemsWithFt: (value: string) => `${value} dos itens com ficha t\u00e9cnica`,
    cmvByGroupTitle: "CMV por grupo",
    cmvByGroupText: "Barra colorida pela sa\u00fade do CMV. Clique para detalhar.",
    totalOverviewTitle: "CMV m\u00e9dio por grupo",
    totalOverviewText: "Abertura padr\u00e3o do dashboard. Clique em uma fatia para detalhar o grupo.",
    cmvAverage: "cmv m\u00e9dio",
    groups: "grupos",
    groupDetailTitle: "Detalhamento por grupo",
    groupDetailText: "Clique em um grupo nos gr\u00e1ficos para abrir os itens organizados por subgrupo.",
    clearFocus: "Limpar foco",
    groupItemsText: "Itens do grupo separados por subgrupo.",
    itemsCount: (count: string) => `${count} item(ns)`,
    topSalesTitle: "Itens com maior venda",
    topSalesText: "Os protagonistas do faturamento.",
    topCmvTitle: "Itens com maior CMV",
    topCmvText: "Onde vale investigar custo, pre\u00e7o ou ficha t\u00e9cnica.",
    strategicMatrixTitle: "Leitura estrat\u00e9gica do card\u00e1pio",
    strategicMatrixText: "Cruza volume e margem para destacar onde promover, corrigir ou proteger resultado.",
    strategicHighPotentialTitle: "Alto potencial",
    strategicHighPotentialText: "Itens com margem alta e poucas vendas. Bons candidatos para ganhar destaque comercial.",
    strategicLowReturnTitle: "Volume sem Retorno",
    strategicLowReturnText: "Itens com muita venda e margem baixa. Pedem revis\u00e3o de pre\u00e7o, custo ou ficha.",
    strategicProfitEnginesTitle: "Motores de Lucro",
    strategicProfitEnginesText: "Itens com muita venda e margem alta. S\u00e3o os mais valiosos para proteger e ampliar.",
    strategicAttentionTitle: "Pontos de Aten\u00e7\u00e3o",
    strategicAttentionText: "Itens com pouca venda e margem baixa. Merecem ajuste, reformula\u00e7\u00e3o ou sa\u00edda do card\u00e1pio.",
    strategicHighSalesCut: (value: string) => `Venda alta a partir de ${value} un.`,
    strategicHighMarginCut: (value: string) => `Margem alta a partir de ${value}`,
    strategicLowMarginCut: (value: string) => `Margem baixa at\u00e9 ${value}`,
    strategicEmpty: "Nenhum item caiu nesta classifica\u00e7\u00e3o no per\u00edodo.",
    promoTitle: "Itens promocionais",
    promoText: "Itens com pre\u00e7o simb\u00f3lico. O custo \u00e9 considerado, mas o CMV n\u00e3o entra na classifica\u00e7\u00e3o.",
    promoDetected: "Promo\u00e7\u00f5es identificadas",
    promoAssociatedCost: (value: string) => `${value} em custo total associado`,
    missingTitle: "Itens sem ficha t\u00e9cnica",
    missingText: "Esses itens precisam de cadastro para que o CMV fique completo.",
    pendingItems: "Itens pendentes",
    missingRevenue: (value: string) => `${value} em vendas sem custo te\u00f3rico`,
    officialTotalTitle: "Total oficial do relat\u00f3rio",
    officialTotalText: "Confer\u00eancia direta da linha TOTAL GERAL dos arquivos de vendas importados.",
    officialTotal: "Total geral",
    officialTotalConsolidated: "Total geral consolidado",
    closingUnits: (value: string) => `${value} unidades no fechamento do relat\u00f3rio`,
    healthy: "Saud\u00e1vel",
    attention: "Aten\u00e7\u00e3o",
    critical: "Cr\u00edtico",
    promotionalItem: "Item promocional",
    withoutFt: "Sem FT",
    uploadOriented: "Importa\u00e7\u00e3o orientada",
    uploadOrientedText: "Carregue vendas e fichas t\u00e9cnicas com um fluxo simples, na ordem certa.",
    executiveReading: "Leitura executiva",
    executiveReadingText: "Veja faturamento, custo, CMV e desvios com hierarquia visual clara.",
    competenceBase: "Base por compet\u00eancia",
    competenceBaseText: "Acumule meses importados e compare a opera\u00e7\u00e3o com mais contexto.",
    prioritizedActions: "A\u00e7\u00f5es priorizadas",
    prioritizedActionsText: "Identifique produtos sem FT, promocionais e grupos cr\u00edticos rapidamente.",
    intuitiveCharts: "Gr\u00e1ficos intuitivos",
    intuitiveChartsText: "Visualiza\u00e7\u00f5es que ajudam a navegar do total ao detalhe sem polui\u00e7\u00e3o.",
    historyByPeriod: "Hist\u00f3rico por per\u00edodo",
    historyByPeriodText: "Importe mais de um m\u00eas e acompanhe a base consolidada por compet\u00eancia.",
    actionableAlerts: "Alertas acion\u00e1veis",
    actionableAlertsText: "Itens sem ficha, promocionais e grupos cr\u00edticos ficam evidentes para a equipe.",
    processStep1: "1. Importe as vendas",
    processStep1Text: "Aceite um ou v\u00e1rios meses por vez, preservando a base j\u00e1 carregada.",
    processStep2: "2. Cruze com as fichas",
    processStep2Text: "O sistema relaciona os itens por c\u00f3digo e separa lacunas automaticamente.",
    processStep3: "3. Explore o resultado",
    processStep3Text: "Navegue por total, por m\u00eas ou por grupo para ler a opera\u00e7\u00e3o com clareza.",
    ownerFlowTitle: "Fluxo do owner",
    ownerFlowText: "Um caminho direto para importar, cruzar e ler o restaurante ativo.",
    ownerFlowSales: "Vendas",
    ownerFlowSalesText: "Envie os relatórios.",
    ownerFlowRecipes: "Fichas",
    ownerFlowRecipesText: "Conecte a base técnica.",
    ownerFlowRead: "Leitura",
    ownerFlowReadText: "Confira CMV e alertas.",
    uploadDropHint: "Arraste ou clique para enviar",
    uploadSalesShort: "Um ou mais arquivos de vendas",
    uploadRecipesShort: "Arquivo de fichas técnicas",
    authEyebrow: "G/REST",
    authTitle: "Analise os números do seu restaurante de onde estiver.",
    authText: "Acesso limpo, seguro e conectado aos dados da sua operação.",
    authLoginTab: "Entrar",
    authRegisterTab: "Criar conta",
    authRestaurantName: "Nome do restaurante",
    authEmail: "E-mail",
    authPassword: "Senha",
    authSubmitLogin: "Entrar no dashboard",
    authSubmitRegister: "Criar conta",
    authHelp: "Nesta primeira versão, o acesso fica salvo neste navegador. No próximo passo, conectamos isso a uma base online.",
    authDemoHint: "Acesso de demonstração: ipanema@grest.com | 123456",
    authSupabaseReady: "Modo online ativo via Supabase. O restaurante poderá acessar de qualquer lugar com o mesmo login.",
    authSupabaseSetup: "Modo local temporário. Para liberar acesso online, preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    authWelcome: "Restaurante ativo",
    authWorkspace: "Base separada por conta",
    authWorkspaceText: "Tudo o que for importado e analisado fica vinculado a este restaurante.",
    authLogout: "Sair",
    authGreeting: "Painel do restaurante",
    authEmptyState: "Nenhum dado salvo ainda. Importe as vendas e as fichas técnicas para começar.",
    dashboardGuideTitle: "Como esta aba ajuda na decisão",
    dashboardGuideText: "Use esta aba para acompanhar vendas, CMV, margens e alertas importantes em uma visão rápida da operação.",
    dashboardGuideKpisTitle: "Indicadores rápidos",
    dashboardGuideKpisText: "Mostram faturamento, CMV, cobertura de fichas e variações importantes do período.",
    dashboardGuideChartsTitle: "Gráficos de composição",
    dashboardGuideChartsText: "Ajudam a entender quais grupos vendem mais e onde o custo pesa no resultado.",
    dashboardGuideAlertsTitle: "Pontos de atenção",
    dashboardGuideAlertsText: "Destacam itens sem ficha, CMV alto e oportunidades para priorizar conversas com a operação.",
    dashboardGuideRevenueLabel: "Faturamento",
    dashboardGuideRevenueTrend: "+12% vs. período anterior",
    dashboardGuideSalesChartTitle: "Vendas por grupo",
    dashboardGuideSalesChartHint: "Onde olhar primeiro",
    dashboardGuideBarPizzas: "Pizzas",
    dashboardGuideBarDrinks: "Bebidas",
    dashboardGuideBarKitchen: "Cozinha",
    dashboardGuideCmvTitle: "CMV em foco",
    dashboardGuideCmvText: "Compara custo, venda e margem por grupo.",
    dashboardGuideAlertLabel: "Ponto de atenção",
    dashboardGuideAlertTitle: "Itens sem ficha técnica",
    dashboardGuideAlertText: "Ajuda a priorizar cadastros antes de confiar no CMV consolidado.",
    authSettings: "Configurações da conta",
    authSettingsText: "Gerencie seu perfil e os restaurantes vinculados a esta conta.",
    authUserProfile: "Perfil do usuário",
    authUserProfileText: "Esses dados pertencem à pessoa que acessa a conta.",
    authRestaurantProfile: "Restaurante ativo",
    authRestaurantProfileText: "Edite nome e foto apenas do restaurante selecionado.",
    authFullName: "Nome do usuário",
    authAccountStatus: "Status da conta",
    authRestaurantsCount: "Restaurantes vinculados",
    authAccountSummary: "Resumo da conta",
    authAccountSummaryText: "Acompanhe rapidamente seu acesso e vá para a área de conta quando precisar.",
    authManageAccount: "Gerenciar conta",
    navMyAccount: "Minha conta",
    navDashboard: "Dashboard",
    navDre: "Análise de DRE",
    navRestaurants: "Restaurantes",
    navTeam: "Equipe e permissões",
    dreTitle: "Análise de DRE",
    dreText: "Ambiente preparado para importar, estruturar e comparar a Demonstração do Resultado do Exercício da unidade selecionada.",
    dreEmptyTitle: "Módulo de DRE em preparação",
    dreEmptyText: "Em breve, esta área vai organizar receitas, custos, despesas e resultado operacional em uma leitura gerencial.",
    dreStepImport: "Importar DRE",
    dreStepClassify: "Classificar contas",
    dreStepAnalyze: "Analisar resultado",
    dreUploadTitle: "Importar modelo de DRE",
    dreUploadHint: "Use o arquivo Excel no padrão de DRE analítico. O sistema identifica seções, subdivisões, linhas, totais e percentuais.",
    dreUploadAction: "Selecionar Excel",
    dreProcessing: "Lendo DRE e organizando a estrutura...",
    dreParsedTitle: "Leitura estruturada",
    dreParsedText: "Prévia do que foi identificado no arquivo importado.",
    dreRestaurant: "Restaurante",
    drePeriod: "Período",
    dreSelectPeriod: "Selecionar mês",
    dreSections: "Seções",
    dreSummary: "Resumo",
    dreGroups: "subdivisões",
    dreLines: "linhas",
    dreResultMap: "Mapa do resultado",
    dreResultMapText: "Receitas, saídas e saldo final em uma leitura direta.",
    dreRevenue: "Receitas",
    dreOutflows: "Saídas",
    dreFinalBalance: "Saldo final",
    dreSectionChart: "Peso por seção",
    dreSectionChartText: "Compare onde a DRE concentra dinheiro.",
    dreGroupHeatmap: "Maiores subdivisões",
    dreGroupHeatmapText: "Os grupos com maior impacto dentro das seções.",
    dreParticipationTitle: "Participação por grupo",
    dreParticipationText: "Cada pizza mostra como as subdivisões compõem o total daquela seção.",
    dreStrategicTitle: "Leituras estratégicas",
    dreStrategicText: "Sinais rápidos para apoiar decisão: concentração, pressão de custo e margem.",
    dreLargestExpense: "Maior pressão de despesa",
    dreRevenueConcentration: "Concentração de receita",
    dreFinalMargin: "Margem final",
    dreExpenseRatio: "Despesas sobre receita",
    dreRestaurantDiagnostics: "Diagnóstico do restaurante",
    dreRestaurantDiagnosticsText: "Indicadores práticos para entender margem, peso operacional e prioridades de ação.",
    dreFinalMarginCard: "Margem final",
    dreOperationalMarginCard: "Margem operacional",
    dreInputsOnRevenue: "Insumos sobre receita",
    drePeopleOnRevenue: "Pessoal sobre receita",
    dreStructureOnRevenue: "Estrutura sobre receita",
    dreAttentionPoints: "Top pontos de atenção",
    dreHealthy: "Saudável",
    dreAttention: "Atenção",
    dreCritical: "Crítico",
    dreNoData: "Sem dados suficientes",
    dreRevenueMixTitle: "Mix de receitas",
    dreRevenueMixText: "Abertura do principal grupo de receita identificado no DRE.",
    dreMenuMixTitle: "Mix de receitas do cardápio",
    dreMenuMixText: "Abertura dos itens que compõem a receita do cardápio.",
    dreCardFeesTitle: "Tarifas de cartões",
    dreCardFeesText: "Detalhamento das taxas e tarifas ligadas aos meios de pagamento.",
    dreRevenueVsExpenses: "Receita vs Despesas",
    dreRevenueVsExpensesText: "Comparativo direto entre entrada e saída no período importado.",
    dreOperationalResultChart: "Resultado operacional",
    dreOperationalResultChartText: "Leitura do resultado operacional da competência.",
    teamTitle: "Equipe e permissões",
    teamText: "Veja quem tem acesso à conta e qual é o papel de cada pessoa.",
    teamEmpty: "Nenhum membro adicional foi encontrado nesta conta.",
    teamAccessModel: "Modelo de acesso",
    teamAccessModelText: "Owner gerencia todos os usuários; usuários comuns acessam apenas os restaurantes liberados.",
    teamMembersTotal: "Pessoas com acesso",
    teamAdminsTotal: "Owners",
    teamUsersTotal: "Usuários comuns",
    teamRestaurantsTotal: "Restaurantes cobertos",
    teamAccountRole: "Papel na conta",
    teamRestaurantAccess: "Acesso aos restaurantes",
    teamNoRestaurants: "Nenhum restaurante vinculado",
    teamYou: "Você",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "Usuário",
    teamRoleUser: "Usuário",
    teamRoleViewer: "Leitura",
    teamInviteTitle: "Convidar pessoa",
    teamInviteText: "Defina o acesso da pessoa por e-mail e vincule os restaurantes liberados para ela.",
    teamInviteEmail: "E-mail da pessoa",
    teamInviteFeatures: "Funcionalidades liberadas",
    teamFeatureDashboard: "Dashboard de CMV",
    teamInviteAccountRole: "Papel na conta",
    teamInviteRestaurantRole: "Papel nos restaurantes",
    teamInviteRestaurants: "Restaurantes liberados",
    teamInviteAction: "Enviar convite",
    teamInvitePending: "Convites pendentes",
    teamInviteEmpty: "Nenhum convite pendente nesta conta.",
    teamInviteRevoke: "Revogar convite",
    teamInviteHint: "A pessoa pode criar a própria senha no cadastro. Se já tiver conta, o acesso entra no próximo login.",
    teamInviteRestaurantOptional: "Se a pessoa foi convidada, ela pode deixar o nome do restaurante em branco no cadastro.",
    authFullNameHint: "Use o nome da pessoa. Os restaurantes podem ser vinculados depois.",
    teamManageMember: "Gerenciar acesso",
    teamManageMemberText: "Ajuste as funcionalidades liberadas, os restaurantes vinculados e remova acessos quando necessário.",
    teamSaveMember: "Salvar acesso",
    teamRemoveMember: "Remover acesso",
    teamMemberUpdated: "Acesso atualizado com sucesso.",
    teamMemberRemoved: "Acesso removido com sucesso.",
    teamMemberImmutable: "Esse acesso não pode ser alterado por esta tela.",
    authRestaurantOptional: "Nome do restaurante da conta principal",
    authProfilePhoto: "Foto de perfil",
    authUploadPhoto: "Enviar foto",
    authPhotoHint: "Use PNG ou JPG para personalizar a exibição do perfil.",
    authSaveProfile: "Salvar alterações",
    authDeleteAccount: "Excluir conta",
    authDeleteHint: "A exclusão remove o acesso e a base online deste restaurante.",
    authDangerZone: "Zona de atenção",
    authClose: "Fechar",
    authProfileUpdated: "Perfil do restaurante atualizado com sucesso.",
    authDeleteConfirm: "Tem certeza que deseja excluir esta conta? Esta ação não poderá ser desfeita.",
    authRestaurants: "Restaurantes",
    authRestaurantsText: "Selecione o restaurante ativo da sua conta.",
    authRestaurantsQuick: "Troca rápida de restaurante",
    authRestaurantsQuickText: "Mude de unidade sem abrir o painel de gestão.",
    authRestaurantNavigator: "Seus restaurantes",
    authRestaurantNavigatorText: "Escolha abaixo a unidade que deseja acompanhar agora.",
    authManageRestaurants: "Gerenciar restaurantes",
    authManageRestaurantsText: "Cadastre novas unidades ou ajuste os dados das existentes.",
    authHideRestaurantManager: "Fechar gerenciamento",
    authCreateRestaurant: "Novo restaurante",
    authCreateRestaurantText: "Cadastre novas unidades dentro desta mesma conta.",
    authCreateRestaurantAction: "Cadastrar restaurante",
    authDeleteRestaurant: "Excluir restaurante",
    authDeleteRestaurantHint: "A exclusão remove a base, os membros e o histórico dessa unidade.",
    authActivate: "Ativar",
    authActive: "Ativo",
    authRoleOwner: "Owner",
    authRoleAdmin: "Usuário",
    authRoleViewer: "Leitura",
    authReadOnlyTitle: "Acesso somente leitura",
    authReadOnlyText: "Sua conta pode consultar os dados deste restaurante, mas não pode importar ou alterar informações.",
    authManageOnly: "Apenas owner pode importar relatórios e editar esta base.",
    authSettingsRestricted: "Apenas owner pode editar os dados deste restaurante.",
    authHeroCardTitle: "Conta própria por restaurante",
    authHeroCardText: "Acesso, histórico e base separados por unidade.",
    homeHeroBadge: "Plataforma de CMV para restaurantes",
    homeHeroTitle: "CMV, faturamento e custos em um painel executivo.",
    homeHeroText: "Uma leitura clara para decidir rápido, acompanhar períodos e agir onde a operação pede atenção.",
    homeHeroStat1: "Organização",
    homeHeroStat1Text: "Restaurantes, históricos e bases separados com estrutura clara por unidade.",
    homeHeroStat2: "Agilidade",
    homeHeroStat2Text: "Fluxos simples, filtros diretos e leitura rápida para decidir sem perder tempo.",
    homeHeroStat3: "Clareza",
    homeHeroStat3Text: "Custos, alertas e oportunidades ficam visíveis de forma objetiva no painel."
  },
  es: {
    brandTagline: "Gesti\u00f3n para restaurantes",
    heroEyebrow: "Plataforma anal\u00edtica de CMV",
    heroTitle: "Transforma informes operativos en decisiones m\u00e1s r\u00e1pidas para el restaurante.",
    heroText: "G/REST organiza ventas, fichas t\u00e9cnicas e indicadores de costo en una experiencia visual limpia, orientada a la lectura gerencial y a la acci\u00f3n inmediata.",
    heroGainEyebrow: "Lo que obtienes",
    heroGainTitle: "Una operaci\u00f3n m\u00e1s legible para la gesti\u00f3n.",
    heroGainText: "Menos planilla bruta, m\u00e1s claridad sobre d\u00f3nde vender bien, d\u00f3nde cuesta caro y d\u00f3nde falta registro.",
    uploadTitle: "Importaci\u00f3n guiada",
    uploadText: "Carga la base de ventas, conecta las fichas t\u00e9cnicas y acompa\u00f1a la lectura visual del CMV sin retrabajo manual.",
    processEyebrow: "Flujo del sistema",
    processTitle: "C\u00f3mo funciona el an\u00e1lisis",
    processText: "Una interfaz m\u00e1s explicativa reduce errores operativos y acelera el uso por cualquier persona del equipo.",
    ownerFlowTitle: "Flujo del owner",
    ownerFlowText: "Un camino directo para importar, cruzar y leer el restaurante activo.",
    ownerFlowSales: "Ventas",
    ownerFlowSalesText: "Sube los reportes.",
    ownerFlowRecipes: "Fichas",
    ownerFlowRecipesText: "Conecta la base técnica.",
    ownerFlowRead: "Lectura",
    ownerFlowReadText: "Revisa CMV y alertas.",
    uploadDropHint: "Arrastra o haz clic para subir",
    uploadSalesShort: "Uno o más archivos de ventas",
    uploadRecipesShort: "Archivo de fichas técnicas",
    total: "TOTAL",
    language: "Idioma",
    theme: "Tema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    processing: "Procesando archivos y actualizando el panel...",
    success: "Archivos procesados con \u00e9xito.",
    authEyebrow: "G/REST",
    authTitle: "Analiza los números de tu restaurante desde donde estés.",
    authText: "Acceso limpio, seguro y conectado a los datos de tu operación.",
    authLoginTab: "Ingresar",
    authRegisterTab: "Crear cuenta",
    authRestaurantName: "Restaurante",
    authEmail: "Correo",
    authPassword: "Contrase\u00f1a",
    authSubmitLogin: "Entrar al panel",
    authSubmitRegister: "Crear cuenta",
    authLogout: "Salir",
    authSupabaseReady: "Modo online activo con Supabase.",
    authSupabaseSetup: "Modo local temporal. Configure las variables de Supabase para acceso online real.",
    dashboardGuideTitle: "Cómo ayuda esta pestaña",
    dashboardGuideText: "Usa esta pestaña para seguir ventas, CMV, márgenes y alertas importantes en una vista rápida de la operación.",
    dashboardGuideKpisTitle: "Indicadores rápidos",
    dashboardGuideKpisText: "Muestran ventas, CMV, cobertura de recetas y variaciones importantes del periodo.",
    dashboardGuideChartsTitle: "Gráficos de composición",
    dashboardGuideChartsText: "Ayudan a entender qué grupos venden más y dónde el costo pesa en el resultado.",
    dashboardGuideAlertsTitle: "Puntos de atención",
    dashboardGuideAlertsText: "Destacan ítems sin receta, CMV alto y oportunidades para priorizar conversaciones operativas.",
    dashboardGuideRevenueLabel: "Facturación",
    dashboardGuideRevenueTrend: "+12% vs. período anterior",
    dashboardGuideSalesChartTitle: "Ventas por grupo",
    dashboardGuideSalesChartHint: "Dónde mirar primero",
    dashboardGuideBarPizzas: "Pizzas",
    dashboardGuideBarDrinks: "Bebidas",
    dashboardGuideBarKitchen: "Cocina",
    dashboardGuideCmvTitle: "CMV en foco",
    dashboardGuideCmvText: "Compara costo, venta y margen por grupo.",
    dashboardGuideAlertLabel: "Punto de atención",
    dashboardGuideAlertTitle: "Ítems sin receta técnica",
    dashboardGuideAlertText: "Ayuda a priorizar registros antes de confiar en el CMV consolidado.",
    authSettings: "Configuración de la cuenta",
    authUserProfile: "Perfil del usuario",
    authRestaurantProfile: "Restaurante activo",
    authFullName: "Nombre del usuario",
    authAccountStatus: "Estado de la cuenta",
    authRestaurantsCount: "Restaurantes vinculados",
    authAccountSummary: "Resumen de la cuenta",
    authAccountSummaryText: "Consulta tu acceso rápidamente y abre la cuenta cuando necesites editarla.",
    authManageAccount: "Gestionar cuenta",
    navMyAccount: "Mi cuenta",
    navDashboard: "Dashboard",
    navDre: "Análisis de PyG",
    navRestaurants: "Restaurantes",
    navTeam: "Equipo y permisos",
    dreTitle: "Análisis de PyG",
    dreText: "Entorno preparado para importar, estructurar y comparar el estado de resultados de la unidad seleccionada.",
    dreEmptyTitle: "Módulo de PyG en preparación",
    dreEmptyText: "Pronto esta área organizará ingresos, costos, gastos y resultado operativo en una lectura gerencial.",
    dreStepImport: "Importar PyG",
    dreStepClassify: "Clasificar cuentas",
    dreStepAnalyze: "Analizar resultado",
    dreUploadTitle: "Importar modelo de PyG",
    dreUploadHint: "Usa el archivo Excel en el patrón analítico. El sistema identifica secciones, subdivisiones, líneas, totales y porcentajes.",
    dreUploadAction: "Seleccionar Excel",
    dreProcessing: "Leyendo PyG y organizando la estructura...",
    dreParsedTitle: "Lectura estructurada",
    dreParsedText: "Vista previa de lo identificado en el archivo importado.",
    dreRestaurant: "Restaurante",
    drePeriod: "Periodo",
    dreSelectPeriod: "Seleccionar mes",
    dreSections: "Secciones",
    dreSummary: "Resumen",
    dreGroups: "subdivisiones",
    dreLines: "líneas",
    dreResultMap: "Mapa del resultado",
    dreResultMapText: "Ingresos, salidas y saldo final en una lectura directa.",
    dreRevenue: "Ingresos",
    dreOutflows: "Salidas",
    dreFinalBalance: "Saldo final",
    dreSectionChart: "Peso por sección",
    dreSectionChartText: "Compara dónde el PyG concentra dinero.",
    dreGroupHeatmap: "Mayores subdivisiones",
    dreGroupHeatmapText: "Los grupos con mayor impacto dentro de las secciones.",
    dreParticipationTitle: "Participación por grupo",
    dreParticipationText: "Cada gráfico muestra cómo las subdivisiones componen el total de esa sección.",
    dreStrategicTitle: "Lecturas estratégicas",
    dreStrategicText: "Señales rápidas para decidir: concentración, presión de costo y margen.",
    dreLargestExpense: "Mayor presión de gasto",
    dreRevenueConcentration: "Concentración de ingresos",
    dreFinalMargin: "Margen final",
    dreExpenseRatio: "Gastos sobre ingresos",
    dreRestaurantDiagnostics: "Diagnóstico del restaurante",
    dreRestaurantDiagnosticsText: "Indicadores prácticos para entender margen, peso operativo y prioridades de acción.",
    dreFinalMarginCard: "Margen final",
    dreOperationalMarginCard: "Margen operativo",
    dreInputsOnRevenue: "Insumos sobre ingresos",
    drePeopleOnRevenue: "Personal sobre ingresos",
    dreStructureOnRevenue: "Estructura sobre ingresos",
    dreAttentionPoints: "Principales puntos de atención",
    dreHealthy: "Saludable",
    dreAttention: "Atención",
    dreCritical: "Crítico",
    dreNoData: "Sin datos suficientes",
    dreRevenueMixTitle: "Mix de ingresos",
    dreRevenueMixText: "Apertura del principal grupo de ingresos identificado en el PyG.",
    dreMenuMixTitle: "Mix de ingresos del menú",
    dreMenuMixText: "Apertura de los ítems que componen los ingresos del menú.",
    dreCardFeesTitle: "Tarifas de tarjetas",
    dreCardFeesText: "Detalle de tasas y tarifas relacionadas con medios de pago.",
    dreRevenueVsExpenses: "Ingresos vs Gastos",
    dreRevenueVsExpensesText: "Comparativo directo entre entradas y salidas del periodo importado.",
    dreOperationalResultChart: "Resultado operativo",
    dreOperationalResultChartText: "Lectura del resultado operativo de la competencia.",
    teamTitle: "Equipo y permisos",
    teamText: "Consulta quién tiene acceso a la cuenta y qué papel ocupa cada persona.",
    teamEmpty: "No se encontraron miembros adicionales en esta cuenta.",
    teamAccessModel: "Modelo de acceso",
    teamAccessModelText: "Owner gestiona todos los usuarios; los usuarios comunes acceden solo a restaurantes liberados.",
    teamMembersTotal: "Personas con acceso",
    teamAdminsTotal: "Owners",
    teamUsersTotal: "Usuarios comunes",
    teamRestaurantsTotal: "Restaurantes cubiertos",
    teamAccountRole: "Rol en la cuenta",
    teamRestaurantAccess: "Acceso a restaurantes",
    teamNoRestaurants: "Sin restaurantes vinculados",
    teamYou: "Tú",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "Usuario",
    teamRoleUser: "Usuario",
    teamRoleViewer: "Lectura",
    teamInviteTitle: "Invitar persona",
    teamInviteText: "Define el acceso por correo y vincula los restaurantes permitidos para esa persona.",
    teamInviteEmail: "Correo de la persona",
    teamInviteFeatures: "Funciones habilitadas",
    teamFeatureDashboard: "Dashboard de CMV",
    teamInviteAccountRole: "Rol en la cuenta",
    teamInviteRestaurantRole: "Rol en los restaurantes",
    teamInviteRestaurants: "Restaurantes habilitados",
    teamInviteAction: "Enviar invitación",
    teamInvitePending: "Invitaciones pendientes",
    teamInviteEmpty: "No hay invitaciones pendientes en esta cuenta.",
    teamInviteRevoke: "Revocar invitación",
    teamInviteHint: "La persona puede crear su propia contraseña al registrarse. Si ya tiene cuenta, el acceso se aplicará en el próximo ingreso.",
    teamInviteRestaurantOptional: "Si la persona fue invitada, puede dejar el nombre del restaurante vacío al registrarse.",
    authFullNameHint: "Usa el nombre de la persona. Los restaurantes pueden vincularse después.",
    teamManageMember: "Gestionar acceso",
    teamManageMemberText: "Ajusta las funciones habilitadas, los restaurantes vinculados y elimina accesos cuando sea necesario.",
    teamSaveMember: "Guardar acceso",
    teamRemoveMember: "Quitar acceso",
    teamMemberUpdated: "Acceso actualizado correctamente.",
    teamMemberRemoved: "Acceso quitado correctamente.",
    teamMemberImmutable: "Este acceso no puede modificarse desde esta pantalla.",
    authRestaurantOptional: "Nombre del restaurante principal",
    authSaveProfile: "Guardar cambios",
    authDeleteAccount: "Eliminar cuenta",
    authClose: "Cerrar",
    authRestaurants: "Restaurantes",
    authRestaurantsQuick: "Cambio rápido de restaurante",
    authRestaurantsQuickText: "Cambia de unidad sin abrir la gestión.",
    authRestaurantNavigator: "Tus restaurantes",
    authRestaurantNavigatorText: "Elige abajo la unidad que deseas revisar ahora.",
    authManageRestaurants: "Gestionar restaurantes",
    authManageRestaurantsText: "Crea nuevas unidades o ajusta los datos de las existentes.",
    authHideRestaurantManager: "Cerrar gestión",
    authCreateRestaurant: "Nuevo restaurante",
    authCreateRestaurantAction: "Crear restaurante",
    authDeleteRestaurant: "Eliminar restaurante",
    authActivate: "Activar",
    authActive: "Activo",
    authReadOnlyTitle: "Acceso de solo lectura"
  },
  en: {
    brandTagline: "Management for restaurants",
    heroEyebrow: "CMV analytics platform",
    heroTitle: "Turn operational reports into faster decisions for the restaurant.",
    heroText: "G/REST organizes sales, recipe sheets and cost indicators in a clean visual experience built for management reading and immediate action.",
    heroGainEyebrow: "What you get",
    heroGainTitle: "A more readable operation for managers.",
    heroGainText: "Less raw spreadsheet work, more clarity on where revenue performs, where costs rise and where records are missing.",
    uploadTitle: "Guided import",
    uploadText: "Load the sales base, connect the recipe sheets and follow the CMV reading without manual rework.",
    processEyebrow: "System flow",
    processTitle: "How the analysis works",
    processText: "A clearer interface reduces operational mistakes and speeds up adoption across the team.",
    ownerFlowTitle: "Owner flow",
    ownerFlowText: "A direct path to upload, match and read the active restaurant.",
    ownerFlowSales: "Sales",
    ownerFlowSalesText: "Upload the reports.",
    ownerFlowRecipes: "Recipes",
    ownerFlowRecipesText: "Link the technical base.",
    ownerFlowRead: "Readout",
    ownerFlowReadText: "Review CMV and alerts.",
    uploadDropHint: "Drag or click to upload",
    uploadSalesShort: "One or more sales files",
    uploadRecipesShort: "Recipe file",
    total: "TOTAL",
    language: "Language",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    processing: "Processing files and updating the dashboard...",
    success: "Files processed successfully.",
    authEyebrow: "G/REST",
    authTitle: "Analyze your restaurant numbers from anywhere.",
    authText: "A clean, secure access layer connected to your operation data.",
    authLoginTab: "Sign in",
    authRegisterTab: "Create account",
    authRestaurantName: "Restaurant name",
    authEmail: "Email",
    authPassword: "Password",
    authSubmitLogin: "Open dashboard",
    authSubmitRegister: "Create account",
    authLogout: "Sign out",
    authSupabaseReady: "Online mode is active with Supabase.",
    authSupabaseSetup: "Temporary local mode. Configure the Supabase environment variables for real remote access.",
    dashboardGuideTitle: "How this tab supports decisions",
    dashboardGuideText: "Use this tab to track sales, CMV, margins and key alerts in a quick view of the operation.",
    dashboardGuideKpisTitle: "Quick indicators",
    dashboardGuideKpisText: "Shows revenue, CMV, recipe coverage and important period movements.",
    dashboardGuideChartsTitle: "Composition charts",
    dashboardGuideChartsText: "Helps identify which groups sell more and where cost weighs on the result.",
    dashboardGuideAlertsTitle: "Attention points",
    dashboardGuideAlertsText: "Highlights missing recipes, high CMV and opportunities to prioritize operational conversations.",
    dashboardGuideRevenueLabel: "Revenue",
    dashboardGuideRevenueTrend: "+12% vs. previous period",
    dashboardGuideSalesChartTitle: "Sales by group",
    dashboardGuideSalesChartHint: "Where to look first",
    dashboardGuideBarPizzas: "Pizzas",
    dashboardGuideBarDrinks: "Drinks",
    dashboardGuideBarKitchen: "Kitchen",
    dashboardGuideCmvTitle: "CMV in focus",
    dashboardGuideCmvText: "Compares cost, sales and margin by group.",
    dashboardGuideAlertLabel: "Attention point",
    dashboardGuideAlertTitle: "Items without recipes",
    dashboardGuideAlertText: "Helps prioritize setup before trusting consolidated CMV.",
    authSettings: "Account settings",
    authUserProfile: "User profile",
    authRestaurantProfile: "Active restaurant",
    authFullName: "User name",
    authAccountStatus: "Account status",
    authRestaurantsCount: "Linked restaurants",
    authAccountSummary: "Account summary",
    authAccountSummaryText: "Review your access quickly and open the account area whenever you need to edit it.",
    authManageAccount: "Manage account",
    navMyAccount: "My account",
    navDashboard: "Dashboard",
    navDre: "P&L analysis",
    navRestaurants: "Restaurants",
    navTeam: "Team and permissions",
    dreTitle: "P&L analysis",
    dreText: "Environment prepared to import, structure and compare the selected unit's profit and loss statement.",
    dreEmptyTitle: "P&L module in preparation",
    dreEmptyText: "Soon this area will organize revenue, costs, expenses and operating result into a management view.",
    dreStepImport: "Import P&L",
    dreStepClassify: "Classify accounts",
    dreStepAnalyze: "Analyze result",
    dreUploadTitle: "Import P&L model",
    dreUploadHint: "Use the analytical P&L Excel template. The system identifies sections, subdivisions, lines, totals and percentages.",
    dreUploadAction: "Select Excel",
    dreProcessing: "Reading P&L and organizing the structure...",
    dreParsedTitle: "Structured reading",
    dreParsedText: "Preview of what was identified in the imported file.",
    dreRestaurant: "Restaurant",
    drePeriod: "Period",
    dreSelectPeriod: "Select month",
    dreSections: "Sections",
    dreSummary: "Summary",
    dreGroups: "subdivisions",
    dreLines: "lines",
    dreResultMap: "Result map",
    dreResultMapText: "Revenue, outflows and final balance in a direct read.",
    dreRevenue: "Revenue",
    dreOutflows: "Outflows",
    dreFinalBalance: "Final balance",
    dreSectionChart: "Weight by section",
    dreSectionChartText: "Compare where the P&L concentrates money.",
    dreGroupHeatmap: "Largest subdivisions",
    dreGroupHeatmapText: "The highest-impact groups inside each section.",
    dreParticipationTitle: "Participation by group",
    dreParticipationText: "Each pie shows how subdivisions make up that section total.",
    dreStrategicTitle: "Strategic readings",
    dreStrategicText: "Quick signals for decision-making: concentration, cost pressure and margin.",
    dreLargestExpense: "Largest expense pressure",
    dreRevenueConcentration: "Revenue concentration",
    dreFinalMargin: "Final margin",
    dreExpenseRatio: "Expenses over revenue",
    dreRestaurantDiagnostics: "Restaurant diagnostics",
    dreRestaurantDiagnosticsText: "Practical indicators to understand margin, operational weight and action priorities.",
    dreFinalMarginCard: "Final margin",
    dreOperationalMarginCard: "Operating margin",
    dreInputsOnRevenue: "Inputs over revenue",
    drePeopleOnRevenue: "People over revenue",
    dreStructureOnRevenue: "Structure over revenue",
    dreAttentionPoints: "Top attention points",
    dreHealthy: "Healthy",
    dreAttention: "Attention",
    dreCritical: "Critical",
    dreNoData: "Not enough data",
    dreRevenueMixTitle: "Revenue mix",
    dreRevenueMixText: "Breakdown of the main revenue group identified in the P&L.",
    dreMenuMixTitle: "Menu revenue mix",
    dreMenuMixText: "Breakdown of the items that make up menu revenue.",
    dreCardFeesTitle: "Card fees",
    dreCardFeesText: "Breakdown of fees related to payment methods.",
    dreRevenueVsExpenses: "Revenue vs Expenses",
    dreRevenueVsExpensesText: "Direct comparison between inflow and outflow for the imported period.",
    dreOperationalResultChart: "Operating result",
    dreOperationalResultChartText: "Operating result reading for the period.",
    teamTitle: "Team and permissions",
    teamText: "Review who has access to this account and the role assigned to each person.",
    teamEmpty: "No additional members were found in this account.",
    teamAccessModel: "Access model",
    teamAccessModelText: "Owner manages every user; common users only access assigned restaurants.",
    teamMembersTotal: "People with access",
    teamAdminsTotal: "Owners",
    teamUsersTotal: "Common users",
    teamRestaurantsTotal: "Covered restaurants",
    teamAccountRole: "Account role",
    teamRestaurantAccess: "Restaurant access",
    teamNoRestaurants: "No linked restaurants",
    teamYou: "You",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "User",
    teamRoleUser: "User",
    teamRoleViewer: "Read only",
    teamInviteTitle: "Invite person",
    teamInviteText: "Define access by email and link the restaurants that person can use.",
    teamInviteEmail: "Person email",
    teamInviteFeatures: "Enabled features",
    teamFeatureDashboard: "CMV Dashboard",
    teamInviteAccountRole: "Account role",
    teamInviteRestaurantRole: "Restaurant role",
    teamInviteRestaurants: "Allowed restaurants",
    teamInviteAction: "Send invite",
    teamInvitePending: "Pending invites",
    teamInviteEmpty: "There are no pending invites in this account.",
    teamInviteRevoke: "Revoke invite",
    teamInviteHint: "The person can create their own password when signing up. If they already have an account, access will be applied on the next login.",
    teamInviteRestaurantOptional: "If the person was invited, they can leave the restaurant name blank during sign-up.",
    authFullNameHint: "Use the person's name. Restaurants can be linked later.",
    teamManageMember: "Manage access",
    teamManageMemberText: "Adjust enabled features, linked restaurants and remove access when needed.",
    teamSaveMember: "Save access",
    teamRemoveMember: "Remove access",
    teamMemberUpdated: "Access updated successfully.",
    teamMemberRemoved: "Access removed successfully.",
    teamMemberImmutable: "This access cannot be changed from this screen.",
    authRestaurantOptional: "Primary account restaurant name",
    authSaveProfile: "Save changes",
    authDeleteAccount: "Delete account",
    authClose: "Close",
    authRestaurants: "Restaurants",
    authRestaurantsQuick: "Quick restaurant switch",
    authRestaurantsQuickText: "Change units without opening management.",
    authRestaurantNavigator: "Your restaurants",
    authRestaurantNavigatorText: "Choose which unit you want to review right now.",
    authManageRestaurants: "Manage restaurants",
    authManageRestaurantsText: "Create new units or adjust the existing ones.",
    authHideRestaurantManager: "Close management",
    authCreateRestaurant: "New restaurant",
    authCreateRestaurantAction: "Create restaurant",
    authDeleteRestaurant: "Delete restaurant",
    authActivate: "Activate",
    authActive: "Active",
    authReadOnlyTitle: "Read-only access"
  }
} as const;

const withLocaleFallback = <T extends Record<string, unknown>>(locale: Locale, key: keyof typeof translations.pt) => {
  const selected = translations[locale] as Record<string, unknown>;
  const fallback = translations.pt as Record<string, unknown>;
  return (selected[key as string] ?? fallback[key as string]) as T[keyof T];
};

const LocaleContext = createContext<Locale>("pt");

const useLocale = () => {
  const locale = useContext(LocaleContext);
  const t = <K extends keyof typeof translations.pt>(key: K) => withLocaleFallback<typeof translations.pt>(locale, key);
  return { locale, t };
};
const getPeriodLabel = (dashboard: PeriodDashboard) => dashboard.label || dashboard.data.reportPeriod?.periodLabel || dashboard.data.reportPeriod?.displayLabel || "Per\u00edodo";


const dedupeFiles = (files: File[]) => {
  const map = new Map<string, File>();
  for (const file of files) {
    map.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }
  return [...map.values()];
};

const normalizeDisplayProductKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const mergeProductsForDisplay = (products: ProductSummary[]) =>
  [...products
    .reduce((map, item) => {
      const normalizedCode = item.code.trim().toUpperCase();
      const normalizedName = normalizeDisplayProductKey(item.itemName);
      const key = `${normalizedCode || "__NO_CODE__"}::${normalizedName}`;
      const current = map.get(key);

      if (!current) {
        map.set(key, { ...item });
        return map;
      }

      const previousRevenue = current.revenue;
      const nextRevenue = current.revenue + item.revenue;

      current.quantity += item.quantity;
      current.revenue = nextRevenue;
      current.cost += item.cost;
      current.grossProfit += item.grossProfit;
      current.matchedRecipe = current.matchedRecipe || item.matchedRecipe;
      current.isPromotional = current.isPromotional || item.isPromotional;
      current.cmvPercent =
        nextRevenue > 0
          ? Number((((current.cmvPercent * previousRevenue) + (item.cmvPercent * item.revenue)) / nextRevenue).toFixed(2))
          : Number(Math.max(current.cmvPercent, item.cmvPercent).toFixed(2));

      return map;
    }, new Map<string, ProductSummary>())
    .values()];

const getMedian = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const getPercentile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
};

const getPreferredRestaurant = (userId: string) => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage.getItem(`${ACTIVE_RESTAURANT_STORAGE_PREFIX}${userId}`) ?? undefined;
};

const savePreferredRestaurant = (userId: string, restaurantId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${ACTIVE_RESTAURANT_STORAGE_PREFIX}${userId}`, restaurantId);
};

const applyActiveRestaurant = (session: AuthSession, restaurantId?: string): AuthSession => {
  const memberships = session.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.restaurantId === restaurantId) ??
    memberships.find((membership) => membership.restaurantId === session.activeRestaurantId) ??
    memberships[0];

  if (!activeMembership) {
    return session;
  }

  const scopedMemberships =
    session.globalRole === "owner" || !activeMembership.accountId
      ? memberships
      : memberships.filter((membership) => membership.accountId === activeMembership.accountId);

  return {
    ...session,
    memberships: scopedMemberships,
    activeRole: activeMembership.role,
    activeRestaurantId: activeMembership.restaurantId,
    activeRestaurantName: activeMembership.restaurantName,
    activeRestaurantPhotoUrl: activeMembership.photoUrl,
    restaurantId: activeMembership.restaurantId,
    restaurantName: activeMembership.restaurantName,
    profilePhotoUrl: activeMembership.photoUrl
  };
};

const getWorkspaceSessionKey = (session?: AuthSession | null) => {
  if (!session) {
    return undefined;
  }

  const restaurantId = session.activeRestaurantId ?? session.restaurantId;
  if (!restaurantId) {
    return `${session.userId}:${session.authMode}:pending`;
  }

  return `${session.userId}:${session.authMode}:${restaurantId}`;
};

const productsToSalesRows = (products: ProductSummary[]) =>
  mapSalesRows(
    products.map((product) => ({
      codigo: product.code,
      produto: product.itemName,
      qte: product.quantity,
      total: product.revenue,
      grupo: product.group,
      subgrupo: product.subgroup
    }))
  );

const buildConsolidatedDashboard = (periods: PeriodDashboard[]) => {
  if (periods.length === 0) {
    return undefined;
  }

  const consolidatedProducts = periods.flatMap((periodDashboard) => periodDashboard.data.products);
  const consolidatedTotals = periods.flatMap((periodDashboard) => periodDashboard.data.importedSalesTotals);
  const consolidatedPeriodLabel =
    periods.length === 1
      ? periods[0].data.reportPeriod
      : {
          rawLabel: periods.map((periodDashboard) => getPeriodLabel(periodDashboard)).join(" • "),
          displayLabel: "Base consolidada",
          periodKey: TOTAL_PERIOD,
          periodLabel: "TOTAL"
        };

  return buildDashboardSlice(periods[0].data, consolidatedProducts, consolidatedTotals, consolidatedPeriodLabel);
};

const mergePeriodDashboards = (
  currentPeriods: PeriodDashboard[],
  incomingPeriods: PeriodDashboard[],
  recipes: RecipeRow[],
  duplicateRecipeCodes: string[]
) =>
  [...incomingPeriods
    .reduce((map, periodDashboard) => {
      const current = map.get(periodDashboard.key);
      if (!current) {
        map.set(periodDashboard.key, periodDashboard);
        return map;
      }

      const mergedSales = productsToSalesRows([...current.data.products, ...periodDashboard.data.products]);

      map.set(periodDashboard.key, {
        key: periodDashboard.key,
        label: periodDashboard.label,
        data: buildDashboardData(
          mergedSales,
          recipes,
          [...current.data.importedSalesTotals, ...periodDashboard.data.importedSalesTotals],
          current.data.reportPeriod ?? periodDashboard.data.reportPeriod,
          duplicateRecipeCodes
        )
      });

      return map;
    }, new Map<string, PeriodDashboard>(currentPeriods.map((period) => [period.key, period])))
    .values()].sort((a, b) => {
    const yearA = a.data.reportPeriod?.year ?? 0;
    const yearB = b.data.reportPeriod?.year ?? 0;
    const monthA = a.data.reportPeriod?.month ?? 0;
    const monthB = b.data.reportPeriod?.month ?? 0;
    return yearA !== yearB ? yearA - yearB : monthA - monthB;
  });

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const validateColumns = (
  kind: "sales" | "recipes",
  fileName: string,
  availableColumns: string[],
  expectedColumns: string[]
): ImportValidation => {
  const normalizedAvailable = availableColumns.map((header) => normalizeLabel(header));
  return {
    kind,
    fileName,
    availableColumns,
    missingColumns: expectedColumns.filter((column) => !normalizedAvailable.includes(normalizeLabel(column)))
  };
};

const getDuplicateCodes = (recipes: RecipeRow[]) => {
  const signaturesByCode = new Map<string, Set<string>>();
  const normalizeComparableCode = (value: string) =>
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/^(\d+)[.,]0+$/, "$1");

  for (const recipe of recipes) {
    const normalizedCode = normalizeComparableCode(recipe.code ?? "");
    if (!normalizedCode || !recipe.itemName.trim()) {
      continue;
    }

    const signature = JSON.stringify({
      place: (recipe.place ?? "").trim().toUpperCase(),
      cost: Number(recipe.cost.toFixed(4)),
      salePrice: recipe.salePrice ? Number(recipe.salePrice.toFixed(4)) : 0,
      cmvPercent: recipe.cmvPercent ? Number(recipe.cmvPercent.toFixed(4)) : 0,
      isPromotional: recipe.isPromotional,
      group: recipe.group.trim().toUpperCase(),
      subgroup: recipe.subgroup.trim().toUpperCase()
    });

    const current = signaturesByCode.get(normalizedCode) ?? new Set<string>();
    current.add(signature);
    signaturesByCode.set(normalizedCode, current);
  }

  return [...signaturesByCode.entries()]
    .filter(([, signatures]) => signatures.size > 1)
    .map(([code]) => code);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });

function IconSpark() {
  return (
    <svg viewBox="0 0 32 32" className="kpi-art" aria-hidden="true">
      <path
        d="M29 26C29 26.2652 28.8946 26.5196 28.7071 26.7071C28.5196 26.8946 28.2652 27 28 27H4C3.73478 27 3.48043 26.8946 3.29289 26.7071C3.10536 26.5196 3 26.2652 3 26V6C3 5.73478 3.10536 5.48043 3.29289 5.29289C3.48043 5.10536 3.73478 5 4 5C4.26522 5 4.51957 5.10536 4.70711 5.29289C4.89464 5.48043 5 5.73478 5 6V19.5863L11.2925 13.2925C11.3854 13.1995 11.4957 13.1258 11.6171 13.0754C11.7385 13.0251 11.8686 12.9992 12 12.9992C12.1314 12.9992 12.2615 13.0251 12.3829 13.0754C12.5043 13.1258 12.6146 13.1995 12.7075 13.2925L16 16.5863L22.5863 10H20C19.7348 10 19.4804 9.89464 19.2929 9.70711C19.1054 9.51957 19 9.26522 19 9C19 8.73478 19.1054 8.48043 19.2929 8.29289C19.4804 8.10536 19.7348 8 20 8H25C25.2652 8 25.5196 8.10536 25.7071 8.29289C25.8946 8.48043 26 8.73478 26 9V14C26 14.2652 25.8946 14.5196 25.7071 14.7071C25.5196 14.8946 25.2652 15 25 15C24.7348 15 24.4804 14.8946 24.2929 14.7071C24.1054 14.5196 24 14.2652 24 14V11.4137L16.7075 18.7075C16.6146 18.8005 16.5043 18.8742 16.3829 18.9246C16.2615 18.9749 16.1314 19.0008 16 19.0008C15.8686 19.0008 15.7385 18.9749 15.6171 18.9246C15.4957 18.8742 15.3854 18.8005 15.2925 18.7075L12 15.4137L5 22.4137V25H28C28.2652 25 28.5196 25.1054 28.7071 25.2929C28.8946 25.4804 29 25.7348 29 26Z"
        fill="#292929"
      />
    </svg>
  );
}

const getCMVTone = (value: number) => {
  if (value < 15) {
    return "good";
  }
  if (value <= 30) {
    return "mid";
  }
  return "bad";
};

const getProductCMVTone = (product: ProductSummary) => {
  if (!product.matchedRecipe) {
    return "pending";
  }
  if (product.isPromotional) {
    return "promo";
  }

  return getCMVTone(product.cmvPercent);
};

const getCMVToneLabel = (value: number) => {
  if (value < 15) {
    return "Saud\u00e1vel";
  }
  if (value <= 30) {
    return "Aten\u00e7\u00e3o";
  }
  return "Cr\u00edtico";
};

const getProductCMVLabel = (product: ProductSummary) => {
  if (!product.matchedRecipe) {
    return "Sem FT";
  }
  if (product.isPromotional) {
    return "Item promocional";
  }

  return getCMVToneLabel(product.cmvPercent);
};

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians)
  };
};

const buildArcPath = (cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) => {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z"
  ].join(" ");
};

const asPieData = (rows: GroupSummary[], metric: "revenue" | "cost"): PieDatum[] => {
  const total = rows.reduce((sum, row) => sum + row[metric], 0);
  return rows
    .filter((row) => row[metric] > 0)
    .map((row, index) => ({
      name: row.name,
      value: row[metric],
      share: total > 0 ? row[metric] / total : 0,
      color: piePalette[index % piePalette.length]
    }));
};

function KPIGrid({ data }: { data: DashboardData }) {
  const { t } = useLocale();
  const cards = [
    {
      label: String(t("kpiRevenue")),
      value: formatCurrency(data.totalRevenue),
      hint: (t("soldItems") as (count: string) => string)(formatNumber(data.totalQuantity)),
      badge: "Receita",
      iconTone: "metric",
      badgeTone: "good",
      icon: <IconRevenueKpi />
    },
    {
      label: String(t("kpiCost")),
      value: formatCurrency(data.totalCost),
      hint: (t("costHint") as (value: string) => string)(formatPercent(data.averageCMV)),
      badge: "Base técnica",
      iconTone: "metric",
      badgeTone: "cool",
      icon: <IconCostKpi />
    },
    {
      label: String(t("kpiProfit")),
      value: formatCurrency(data.grossProfit),
      hint: (t("margin") as (value: string) => string)(formatPercent(data.totalRevenue > 0 ? (data.grossProfit / data.totalRevenue) * 100 : 0)),
      badge: "Resultado",
      iconTone: "metric",
      badgeTone: "warm",
      icon: <IconSpark />
    }
  ] as const;

  return (
    <section className="kpi-grid">
      {cards.map((card) => (
        <article key={card.label} className="card kpi-card clean">
          <div className="kpi-card-head">
            <div className={`icon-chip ${card.iconTone}`}>
              {card.icon}
            </div>
            <div className="kpi-card-heading">
              <span className="eyebrow">{card.label}</span>
            </div>
          </div>
          <strong>{card.value}</strong>
          <div className="kpi-card-foot">
            <span className={`kpi-card-badge ${card.badgeTone}`}>{card.badge}</span>
            <p>{card.hint}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function UploadPanel({
  state,
  onUpload,
  canUploadRecipes,
  canManageData,
  onClearAll,
  onResetFlow
}: {
  state: UploadState;
  onUpload: (kind: "sales" | "recipes", files: File[]) => void;
  canUploadRecipes: boolean;
  canManageData: boolean;
  onClearAll: () => void;
  onResetFlow: () => void;
}) {
  const { t } = useLocale();
  const [dragTarget, setDragTarget] = useState<"sales" | "recipes" | null>(null);
  const handleChange = (kind: "sales" | "recipes") => (event: ChangeEvent<HTMLInputElement>) => {
    onUpload(kind, Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop =
    (kind: "sales" | "recipes") =>
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragTarget(null);

      if (!canManageData) {
        return;
      }

      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) {
        return;
      }

      onUpload(kind, kind === "recipes" ? files.slice(0, 1) : files);
    };

  return (
    <section className="card upload-panel">
      <div className="section-head">
        <div>
          <h3>{String(t("uploadTitle"))}</h3>
          <p>{String(t("uploadDropHint"))}</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="ghost-button" onClick={onResetFlow} disabled={!canManageData}>
            Novo carregamento
          </button>
          <button type="button" className="ghost-button danger-button" onClick={onClearAll} disabled={!canManageData}>
            Limpar base
          </button>
        </div>
      </div>

      <div className="upload-grid guided">
        <label
          className={`upload-box featured simple ${canManageData ? "" : "locked"} ${dragTarget === "sales" ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (canManageData) {
              setDragTarget("sales");
            }
          }}
          onDragLeave={() => setDragTarget((current) => (current === "sales" ? null : current))}
          onDrop={handleDrop("sales")}
        >
          <span className="eyebrow">{String(t("salesUpload"))}</span>
          <strong className="upload-title">{String(t("uploadSalesShort"))}</strong>
          <small>{String(t("uploadDropHint"))}</small>
          <div className="upload-box-footer">
            <span className="upload-action">{String(t("uploadDropHint"))}</span>
            <span className="upload-meta">.csv .xlsx .xls</span>
          </div>
          <input className="upload-input-hidden" type="file" accept=".csv,.xlsx,.xls" multiple onChange={handleChange("sales")} disabled={!canManageData} />
        </label>

        <label
          className={`upload-box featured secondary simple ${canUploadRecipes && canManageData ? "" : "locked"} ${dragTarget === "recipes" ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (canUploadRecipes && canManageData) {
              setDragTarget("recipes");
            }
          }}
          onDragLeave={() => setDragTarget((current) => (current === "recipes" ? null : current))}
          onDrop={handleDrop("recipes")}
        >
          <span className="eyebrow">{String(t("recipesUpload"))}</span>
          <strong className="upload-title">{String(t("uploadRecipesShort"))}</strong>
          <small>
            {canManageData
              ? canUploadRecipes
                ? String(t("uploadDropHint"))
                : String(t("recipesUploadLocked"))
              : String(t("authManageOnly"))}
          </small>
          <div className="upload-box-footer">
            <span className="upload-action">{canUploadRecipes && canManageData ? String(t("uploadDropHint")) : "Envie vendas primeiro"}</span>
            <span className="upload-meta">.csv .xlsx .xls</span>
          </div>
          <input className="upload-input-hidden" type="file" accept=".csv,.xlsx,.xls" onChange={handleChange("recipes")} disabled={!canUploadRecipes || !canManageData} />
        </label>
      </div>

      {!canManageData ? <p className="message">{String(t("authManageOnly"))}</p> : null}
      {state.processing ? <p className="message">{String(t("processing"))}</p> : null}
      {state.error ? <p className="message error">{state.error}</p> : null}
      {!state.error && state.data ? <p className="message success">{String(t("success"))}</p> : null}
    </section>
  );
}

function IconRevenueKpi() {
  return (
    <svg viewBox="0 0 32 32" className="kpi-art" aria-hidden="true">
      <path d="M16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74819 16.0144 3.2498 18.5362C3.75141 21.0579 4.98953 23.3743 6.80762 25.1924C8.6257 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5995 28.9944 20.9749 28.0104C23.3503 27.0265 25.3807 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C28.9964 12.5533 27.6256 9.24882 25.1884 6.81163C22.7512 4.37445 19.4467 3.00364 16 3ZM16 27C13.8244 27 11.6977 26.3549 9.88873 25.1462C8.07979 23.9375 6.66989 22.2195 5.83733 20.2095C5.00477 18.1995 4.78693 15.9878 5.21137 13.854C5.63581 11.7202 6.68345 9.7602 8.22183 8.22183C9.76021 6.68345 11.7202 5.6358 13.854 5.21136C15.9878 4.78692 18.1995 5.00476 20.2095 5.83733C22.2195 6.66989 23.9375 8.07979 25.1462 9.88873C26.3549 11.6977 27 13.8244 27 16C26.9967 18.9164 25.8367 21.7123 23.7745 23.7745C21.7123 25.8367 18.9164 26.9967 16 27ZM21 18.5C21 19.4283 20.6313 20.3185 19.9749 20.9749C19.3185 21.6313 18.4283 22 17.5 22H17V23C17 23.2652 16.8946 23.5196 16.7071 23.7071C16.5196 23.8946 16.2652 24 16 24C15.7348 24 15.4804 23.8946 15.2929 23.7071C15.1054 23.5196 15 23.2652 15 23V22H13C12.7348 22 12.4804 21.8946 12.2929 21.7071C12.1054 21.5196 12 21.2652 12 21C12 20.7348 12.1054 20.4804 12.2929 20.2929C12.4804 20.1054 12.7348 20 13 20H17.5C17.8978 20 18.2794 19.842 18.5607 19.5607C18.842 19.2794 19 18.8978 19 18.5C19 18.1022 18.842 17.7206 18.5607 17.4393C18.2794 17.158 17.8978 17 17.5 17H14.5C13.5717 17 12.6815 16.6313 12.0251 15.9749C11.3688 15.3185 11 14.4283 11 13.5C11 12.5717 11.3688 11.6815 12.0251 11.0251C12.6815 10.3687 13.5717 10 14.5 10H15V9C15 8.73478 15.1054 8.48043 15.2929 8.29289C15.4804 8.10536 15.7348 8 16 8C16.2652 8 16.5196 8.10536 16.7071 8.29289C16.8946 8.48043 17 8.73478 17 9V10H19C19.2652 10 19.5196 10.1054 19.7071 10.2929C19.8946 10.4804 20 10.7348 20 11C20 11.2652 19.8946 11.5196 19.7071 11.7071C19.5196 11.8946 19.2652 12 19 12H14.5C14.1022 12 13.7206 12.158 13.4393 12.4393C13.158 12.7206 13 13.1022 13 13.5C13 13.8978 13.158 14.2794 13.4393 14.5607C13.7206 14.842 14.1022 15 14.5 15H17.5C18.4283 15 19.3185 15.3687 19.9749 16.0251C20.6313 16.6815 21 17.5717 21 18.5Z" fill="#292929" />
    </svg>
  );
}

function IconCostKpi() {
  return (
    <svg viewBox="0 0 32 32" className="kpi-art" aria-hidden="true">
      <path d="M17 15V22C17 22.2652 16.8947 22.5196 16.7071 22.7071C16.5196 22.8946 16.2653 23 16 23C15.7348 23 15.4805 22.8946 15.2929 22.7071C15.1054 22.5196 15 22.2652 15 22V15C15 14.7348 15.1054 14.4804 15.2929 14.2929C15.4805 14.1054 15.7348 14 16 14C16.2653 14 16.5196 14.1054 16.7071 14.2929C16.8947 14.4804 17 14.7348 17 15ZM29.9825 12.2637L28.25 25.265C28.1858 25.7455 27.9492 26.1863 27.5843 26.5054C27.2195 26.8246 26.7511 27.0003 26.2663 27H5.73379C5.24902 27.0003 4.78063 26.8246 4.41573 26.5054C4.05084 26.1863 3.81427 25.7455 3.75004 25.265L2.01629 12.265C1.97851 11.9824 2.0016 11.6949 2.08401 11.422C2.16642 11.149 2.30625 10.8968 2.49412 10.6823C2.68199 10.4678 2.91355 10.2959 3.17328 10.1783C3.43301 10.0606 3.7149 9.9998 4.00004 10H8.54629L15.25 2.34125C15.3439 2.23484 15.4593 2.14962 15.5886 2.09125C15.7179 2.03287 15.8582 2.00269 16 2.00269C16.1419 2.00269 16.2822 2.03287 16.4115 2.09125C16.5408 2.14962 16.6562 2.23484 16.75 2.34125L23.4538 10H28C28.2849 10.0002 28.5663 10.0612 28.8257 10.1789C29.085 10.2967 29.3162 10.4685 29.5038 10.6828C29.6913 10.8971 29.831 11.149 29.9133 11.4217C29.9957 11.6943 30.0189 11.9814 29.9813 12.2637H29.9825ZM11.2038 10H20.7963L16 4.51875L11.2038 10ZM28 12H4.00004L5.73379 25H26.2663L28 12ZM21.605 14.9L20.905 21.9C20.8912 22.0311 20.9034 22.1636 20.941 22.2899C20.9785 22.4162 21.0407 22.5339 21.1238 22.6361C21.207 22.7383 21.3096 22.8231 21.4256 22.8855C21.5417 22.948 21.6689 22.9869 21.8 23C21.8338 23.0018 21.8676 23.0018 21.9013 23C22.149 22.9997 22.3877 22.9075 22.5713 22.7412C22.7549 22.5749 22.8703 22.3464 22.895 22.1L23.595 15.1C23.6216 14.8361 23.5422 14.5725 23.3743 14.3671C23.2065 14.1618 22.9639 14.0315 22.7 14.005C22.4362 13.9785 22.1725 14.0579 21.9672 14.2257C21.7618 14.3936 21.6316 14.6361 21.605 14.9ZM10.395 14.9C10.3685 14.6361 10.2383 14.3936 10.0329 14.2257C9.82755 14.0579 9.56393 13.9785 9.30004 14.005C9.03615 14.0315 8.7936 14.1618 8.62576 14.3671C8.45791 14.5725 8.37852 14.8361 8.40504 15.1L9.10504 22.1C9.12991 22.3475 9.24616 22.5769 9.43107 22.7433C9.61597 22.9097 9.85627 23.0012 10.105 23C10.1388 23.0018 10.1726 23.0018 10.2063 23C10.337 22.9869 10.4638 22.9481 10.5795 22.886C10.6951 22.8239 10.7975 22.7395 10.8806 22.6379C10.9637 22.5362 11.026 22.4191 11.0638 22.2934C11.1017 22.1676 11.1144 22.0357 11.1013 21.905L10.395 14.9Z" fill="#292929" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M9 7H6.8A1.8 1.8 0 0 0 5 8.8v6.4A1.8 1.8 0 0 0 6.8 17H9" />
      <path d="M13 8.5 17 12l-4 3.5" />
      <path d="M17 12H9" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M5 7.5h14" />
      <path d="M9 7.5V5.2h6v2.3" />
      <path d="M7.5 7.5 8.3 19h7.4l.8-11.5" />
      <path d="M10 10.5v5.5" />
      <path d="M14 10.5v5.5" />
    </svg>
  );
}

function ValidationPanel({ validations }: { validations: ImportValidation[] }) {
  const invalid = validations.filter((item) => item.missingColumns.length > 0);
  if (invalid.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>Validação de arquivos</h3>
          <p>Algumas colunas obrigatórias não foram encontradas. Corrija isso antes de confiar na leitura do dashboard.</p>
        </div>
      </div>

      <div className="issue-grid">
        {invalid.map((validation) => (
          <article key={`${validation.kind}-${validation.fileName}`} className="issue-card danger">
            <span className="eyebrow">{validation.kind === "sales" ? "Vendas" : "Fichas técnicas"}</span>
            <strong>{validation.fileName}</strong>
            <p>Colunas ausentes: {validation.missingColumns.join(", ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function IssuesPanel({ data }: { data: DashboardData }) {
  if (data.issues.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>Inconsistências e alertas</h3>
          <p>Leitura rápida dos pontos que merecem revisão antes de concluir a análise.</p>
        </div>
      </div>

      <div className="issue-grid">
        {data.issues.map((issue) => (
          <article key={issue.id} className={`issue-card ${issue.tone}`}>
            <span className="eyebrow">Alerta</span>
            <strong>{issue.title}</strong>
            <p>{issue.description}</p>
            {typeof issue.count === "number" ? <p>{formatNumber(issue.count)} ocorrência(s)</p> : null}
            {issue.details?.length ? <p>Código(s): {issue.details.join(", ")}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DonutChartCard({
  title,
  subtitle,
  data,
  activeName,
  onSelect,
  valueFormatter = formatCurrency,
  centerValue,
  centerLabel = "grupos",
  hideCenterLabel = false,
  centerEmphasis = "default"
}: {
  title: string;
  subtitle: string;
  data: PieDatum[];
  activeName?: string;
  onSelect: (name: string) => void;
  valueFormatter?: (value: number) => string;
  centerValue?: string;
  centerLabel?: string;
  hideCenterLabel?: boolean;
  centerEmphasis?: "default" | "large";
}) {
  const size = 248;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 88;
  const innerRadius = 68;
  let cursor = 0;
  const activeSlice = data.find((slice) => slice.name === activeName);
  const resolvedCenterValue = centerValue ?? (activeSlice ? valueFormatter(activeSlice.value) : valueFormatter(data.reduce((sum, slice) => sum + slice.value, 0)));
  const resolvedCenterLabel = activeSlice ? activeSlice.name : centerLabel;
  const showCenterLabel = !hideCenterLabel && Boolean(resolvedCenterLabel);

  return (
    <section className="card chart-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="donut-layout">
        <svg viewBox={`0 0 ${size} ${size}`} className="donut-chart" role="img" aria-label={title}>
          {data.map((slice) => {
            const start = cursor * 360;
            const end = (cursor + slice.share) * 360;
            cursor += slice.share;
            const isActive = slice.name === activeName;
            const style = {
              "--slice-color": slice.color,
              "--slice-opacity": isActive ? "1" : "0.82"
            } as CSSProperties;

            return (
              <path
                key={slice.name}
                d={buildArcPath(cx, cy, outerRadius, innerRadius, start, end)}
                className={`donut-slice ${isActive ? "active" : ""}`}
                style={style}
                onClick={() => onSelect(slice.name)}
              />
            );
          })}
          <circle cx={cx} cy={cy} r={innerRadius - 6} fill="var(--donut-hole)" />
          <foreignObject
            x={cx - innerRadius + 6}
            y={cy - innerRadius + 6}
            width={(innerRadius - 8) * 2}
            height={(innerRadius - 8) * 2}
          >
            <div className={`donut-center-box ${showCenterLabel ? "" : "value-only"} ${centerEmphasis === "large" ? "large" : ""} ${resolvedCenterValue.length > 17 ? "tight" : resolvedCenterValue.length > 13 ? "compact" : ""}`}>
              <div className="donut-center-value">{resolvedCenterValue}</div>
              {showCenterLabel ? <div className="donut-center-subtitle-html">{resolvedCenterLabel}</div> : null}
            </div>
          </foreignObject>
        </svg>

        <div className="donut-legend">
          {data.map((slice) => (
            <button
              key={slice.name}
              type="button"
              className={`legend-item ${slice.name === activeName ? "active" : ""}`}
              onClick={() => onSelect(slice.name)}
            >
              <span className="legend-swatch" style={{ backgroundColor: slice.color }} />
              <span className="legend-name">{slice.name}</span>
              <strong>{valueFormatter(slice.value)}</strong>
              <small>{formatPercent(slice.share * 100)}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function GroupFilterBar({
  groups,
  selectedView,
  onSelect
}: {
  groups: GroupSummary[];
  selectedView: string;
  onSelect: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <section className="card compact-card">
      <div className="section-head">
        <div>
          <h3>{String(t("groupFilter"))}</h3>
          <p>{String(t("groupFilterText"))}</p>
        </div>
      </div>

      <div className="filter-bar">
        <button type="button" className={`filter-pill ${selectedView === TOTAL_VIEW ? "active" : ""}`} onClick={() => onSelect(TOTAL_VIEW)}>
          {String(t("total"))}
        </button>
        {groups.map((group) => (
          <button
            type="button"
            key={group.name}
            className={`filter-pill ${selectedView === group.name ? "active" : ""}`}
            onClick={() => onSelect(group.name)}
          >
            {group.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function PeriodFilterBar({
  dashboards,
  selectedPeriod,
  onSelect,
  onRemovePeriod,
  canManagePeriods = false
}: {
  dashboards: PeriodDashboard[];
  selectedPeriod: string;
  onSelect: (value: string) => void;
  onRemovePeriod?: (value: string) => void;
  canManagePeriods?: boolean;
}) {
  const { t } = useLocale();
  if (dashboards.length === 0) {
    return null;
  }

  return (
    <section className="card compact-card period-filter-card">
      <div className="section-head">
        <div>
          <h3>{String(t("periodAnalyzed"))}</h3>
          <p>{String(t("periodAnalyzedText"))}</p>
        </div>
      </div>

      <div className="filter-bar">
        <button type="button" className={`filter-pill ${selectedPeriod === TOTAL_PERIOD ? "active" : ""}`} onClick={() => onSelect(TOTAL_PERIOD)}>
          {String(t("total"))}
        </button>
        {dashboards.map((dashboard) => (
          <span key={dashboard.key} className={`filter-pill filter-pill-group ${selectedPeriod === dashboard.key ? "active" : ""}`}>
            <button type="button" className="filter-pill-main" onClick={() => onSelect(dashboard.key)}>
              {getPeriodLabel(dashboard)}
            </button>
            {canManagePeriods && onRemovePeriod ? (
              <button
                type="button"
                className="filter-pill-remove"
                onClick={() => onRemovePeriod(dashboard.key)}
                aria-label={`Remover ${getPeriodLabel(dashboard)}`}
                title={`Excluir ${getPeriodLabel(dashboard)}`}
              >
                <IconTrash />
              </button>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  );
}

function TotalOverviewPanel({
  groups,
  activeName,
  onSelect
}: {
  groups: GroupSummary[];
  activeName?: string;
  onSelect: (name: string) => void;
}) {
  const { t } = useLocale();
  const totalRevenue = groups.reduce((sum, group) => sum + group.revenue, 0);
  const totalCost = groups.reduce((sum, group) => sum + group.cost, 0);
  const total = groups.reduce((sum, group) => sum + group.cmvPercent, 0);
  const cmvPieData = groups
    .filter((group) => group.cmvPercent > 0)
    .map((group, index) => ({
      name: group.name,
      value: group.cmvPercent,
      share: total > 0 ? group.cmvPercent / total : 0,
      color: piePalette[index % piePalette.length]
    }));

  return (
    <DonutChartCard
      title={String(t("totalOverviewTitle"))}
      subtitle={String(t("totalOverviewText"))}
      data={cmvPieData}
      activeName={activeName}
      onSelect={onSelect}
      valueFormatter={formatPercent}
      centerValue={formatPercent(totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0)}
      hideCenterLabel
      centerEmphasis="large"
    />
  );
}

function CMVStatusPanel({ products }: { products: ProductSummary[] }) {
  const { t } = useLocale();
  const validProducts = products.filter((item) => item.matchedRecipe && !item.isPromotional && item.revenue > 0);
  const buckets = [
    {
      label: String(t("below15")),
      tone: "good",
      items: validProducts.filter((item) => item.cmvPercent < 15)
    },
    {
      label: String(t("between15And30")),
      tone: "mid",
      items: validProducts.filter((item) => item.cmvPercent >= 15 && item.cmvPercent <= 30)
    },
    {
      label: String(t("above30")),
      tone: "bad",
      items: validProducts.filter((item) => item.cmvPercent > 30)
    }
  ];
  const total = validProducts.length || 1;

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{String(t("cmvRangesTitle"))}</h3>
          <p>{String(t("cmvRangesText"))}</p>
        </div>
      </div>

      <div className="cmv-band">
        {buckets.map((bucket) => {
          const percentage = (bucket.items.length / total) * 100;
          return (
            <div key={bucket.label} className={`band-card ${bucket.tone}`}>
              <span className="eyebrow">{bucket.label}</span>
              <strong>{formatNumber(bucket.items.length)}</strong>
              <p>{(t("itemsWithFt") as (value: string) => string)(formatPercent(percentage))}</p>
            </div>
          );
        })}
      </div>

      <div className="cmv-bar-overview">
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className={`cmv-bar-segment ${bucket.tone}`}
            style={{ width: `${(bucket.items.length / total) * 100}%` }}
          />
        ))}
      </div>
    </section>
  );
}

function CMVGroupBars({ groups, onSelect, activeName }: { groups: GroupSummary[]; onSelect: (name: string) => void; activeName?: string }) {
  const { t } = useLocale();
  const max = Math.max(...groups.map((item) => item.cmvPercent), 0);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{String(t("cmvByGroupTitle"))}</h3>
          <p>{String(t("cmvByGroupText"))}</p>
        </div>
      </div>

      <div className="ranking-list">
        {groups.map((group) => (
          <button
            type="button"
            key={group.name}
            className={`group-bar-button ${group.name === activeName ? "active" : ""}`}
            onClick={() => onSelect(group.name)}
          >
            <div className="ranking-labels">
              <span>{group.name}</span>
              <strong>{formatPercent(group.cmvPercent)}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill cmv-${getCMVTone(group.cmvPercent)}`}
                style={{ width: `${max > 0 ? Math.max((group.cmvPercent / max) * 100, 10) : 0}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function MissingRecipesPanel({ products, coveragePercent }: { products: ProductSummary[]; coveragePercent: number }) {
  const { t } = useLocale();
  const unmatchedProducts = mergeProductsForDisplay(products.filter((item) => !item.matchedRecipe));
  const unmatchedRevenue = unmatchedProducts.reduce((sum, item) => sum + item.revenue, 0);

  if (unmatchedProducts.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{String(t("missingTitle"))}</h3>
          <p>{String(t("missingText"))}</p>
        </div>
      </div>

      <div className="totals-grid">
        <div className="totals-box compact warning-surface">
          <span className="eyebrow">{String(t("pendingItems"))}</span>
          <strong>{formatNumber(unmatchedProducts.length)}</strong>
          <p>{(t("missingRevenue") as (value: string) => string)(formatCurrency(unmatchedRevenue))}</p>
          <p>{(t("coverage") as (value: string) => string)(formatPercent(coveragePercent))}</p>
        </div>
      </div>

      <div className="table-wrap insight-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Item</th>
              <th>Grupo</th>
              <th>Subgrupo</th>
              <th>Receita</th>
            </tr>
          </thead>
          <tbody>
            {unmatchedProducts.map((product) => (
              <tr key={`missing-${product.code}-${product.itemName}`}>
                <td>{product.code}</td>
                <td>{product.itemName}</td>
                <td>{product.group}</td>
                <td>{product.subgroup}</td>
                <td>{formatCurrency(product.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PromotionalItemsPanel({ products }: { products: ProductSummary[] }) {
  const { t } = useLocale();
  const promotionalProducts = mergeProductsForDisplay(products.filter((item) => item.isPromotional));
  const promotionalCost = promotionalProducts.reduce((sum, item) => sum + item.cost, 0);

  if (promotionalProducts.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{String(t("promoTitle"))}</h3>
          <p>{String(t("promoText"))}</p>
        </div>
      </div>

      <div className="totals-grid">
        <div className="totals-box compact promo-surface">
          <span className="eyebrow">{String(t("promoDetected"))}</span>
          <strong>{formatNumber(promotionalProducts.length)}</strong>
          <p>{(t("promoAssociatedCost") as (value: string) => string)(formatCurrency(promotionalCost))}</p>
        </div>
      </div>

      <div className="table-wrap insight-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Item</th>
              <th>Grupo</th>
              <th>Subgrupo</th>
              <th>Receita</th>
              <th>Custo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {promotionalProducts.map((product) => (
              <tr key={`promo-${product.code}-${product.itemName}`}>
                <td>{product.code}</td>
                <td>{product.itemName}</td>
                <td>{product.group}</td>
                <td>{product.subgroup}</td>
                <td>{formatCurrency(product.revenue)}</td>
                <td>{formatCurrency(product.cost)}</td>
                <td>
                  <span className="cmv-pill promo">{String(t("promotionalItem"))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupExplorer({
  groupName,
  products,
  onClear
}: {
  groupName?: string;
  products: ProductSummary[];
  onClear: () => void;
}) {
  const { t } = useLocale();
  const visibleProducts = groupName ? products.filter((item) => item.group === groupName) : [];
  const subgroupMap = visibleProducts.reduce((map, item) => {
    const current = map.get(item.subgroup) ?? [];
    current.push(item);
    map.set(item.subgroup, current);
    return map;
  }, new Map<string, ProductSummary[]>());

  if (!groupName) {
    return (
      <section className="card explorer-empty">
        <h3>{String(t("groupDetailTitle"))}</h3>
        <p>{String(t("groupDetailText"))}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{groupName}</h3>
          <p>{String(t("groupItemsText"))}</p>
        </div>
        <button type="button" className="ghost-button" onClick={onClear}>
          {String(t("clearFocus"))}
        </button>
      </div>

      <div className="subgroup-stack">
        {[...subgroupMap.entries()]
          .sort(([, a], [, b]) => b.reduce((sum, item) => sum + item.revenue, 0) - a.reduce((sum, item) => sum + item.revenue, 0))
          .map(([subgroup, items]) => (
            <section key={subgroup} className="subgroup-card">
              <div className="subgroup-head">
                <div>
                  <span className="eyebrow">{subgroup}</span>
                  <strong>{formatCurrency(items.reduce((sum, item) => sum + item.revenue, 0))}</strong>
                </div>
                <small>{(t("itemsCount") as (count: string) => string)(formatNumber(items.length))}</small>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th>Receita</th>
                      <th>Custo</th>
                      <th>CMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .slice()
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((item) => (
                        <tr key={`${subgroup}-${item.code}-${item.itemName}`}>
                          <td>{item.code}</td>
                          <td>{item.itemName}</td>
                          <td>{formatNumber(item.quantity)}</td>
                          <td>{formatCurrency(item.revenue)}</td>
                          <td>{formatCurrency(item.cost)}</td>
                          <td>
                            <span className={`cmv-pill ${getProductCMVTone(item)}`}>
                              {item.isPromotional
                                ? String(t("promotionalItem"))
                                : item.matchedRecipe
                                  ? `${formatPercent(item.cmvPercent)} | ${getProductCMVLabel(item)}`
                                  : String(t("withoutFt"))}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
      </div>
    </section>
  );
}

function ProductHighlights({ products }: { products: ProductSummary[] }) {
  const { t } = useLocale();
  const validProducts = products.filter((item) => item.matchedRecipe && !item.isPromotional);
  const highlightedProducts = mergeProductsForDisplay(validProducts);

  const topRevenue = highlightedProducts.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const highestCMV = highlightedProducts
    .filter((item) => item.revenue > 0 && item.quantity > 0)
    .slice()
    .sort((a, b) => b.cmvPercent - a.cmvPercent)
    .slice(0, 6);

  return (
    <section className="analytics-grid">
      <section className="card">
        <div className="section-head">
          <div>
            <h3>{String(t("topSalesTitle"))}</h3>
            <p>{String(t("topSalesText"))}</p>
          </div>
        </div>
        <div className="ranking-list">
          {topRevenue.map((item) => (
            <div key={`top-${item.code}`} className="ranking-row">
              <div className="ranking-labels">
                <span>{item.itemName}</span>
                <strong>{formatCurrency(item.revenue)}</strong>
              </div>
              <div className="meta-inline">
                <small>{item.group}</small>
                <small>{formatNumber(item.quantity)} un.</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h3>{String(t("topCmvTitle"))}</h3>
            <p>{String(t("topCmvText"))}</p>
          </div>
        </div>
        <div className="ranking-list">
          {highestCMV.map((item) => (
            <div key={`cmv-${item.code}`} className="ranking-row">
              <div className="ranking-labels">
                <span>{item.itemName}</span>
                <strong className={`text-${getCMVTone(item.cmvPercent)}`}>{formatPercent(item.cmvPercent)}</strong>
              </div>
              <div className="bar-track">
                <div className={`bar-fill cmv-${getCMVTone(item.cmvPercent)}`} style={{ width: `${Math.min(item.cmvPercent, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function StrategicProductMatrix({ products }: { products: ProductSummary[] }) {
  const { t } = useLocale();
  const validProducts = mergeProductsForDisplay(
    products.filter((item) => item.matchedRecipe && !item.isPromotional && item.revenue > 0 && item.quantity > 0)
  );

  if (validProducts.length === 0) {
    return null;
  }

  const enrichedProducts = validProducts.map((item) => ({
    ...item,
    marginPercent: item.revenue > 0 ? ((item.grossProfit / item.revenue) * 100) : 0
  }));
  const quantityCut = getMedian(enrichedProducts.map((item) => item.quantity));
  const highMarginCut = getPercentile(enrichedProducts.map((item) => item.marginPercent), 0.65);
  const lowMarginCut = getPercentile(enrichedProducts.map((item) => item.marginPercent), 0.35);
  const sortByOpportunity = (left: typeof enrichedProducts[number], right: typeof enrichedProducts[number]) =>
    (right.revenue * right.marginPercent) - (left.revenue * left.marginPercent);

  const cards = [
    {
      key: "high-potential",
      title: String(t("strategicHighPotentialTitle")),
      text: String(t("strategicHighPotentialText")),
      tone: "good",
      items: enrichedProducts
        .filter((item) => item.quantity < quantityCut && item.marginPercent >= highMarginCut)
        .sort(sortByOpportunity)
        .slice(0, 4)
    },
    {
      key: "low-return",
      title: String(t("strategicLowReturnTitle")),
      text: String(t("strategicLowReturnText")),
      tone: "bad",
      items: enrichedProducts
        .filter((item) => item.quantity >= quantityCut && item.marginPercent <= lowMarginCut)
        .sort((a, b) => (b.quantity * (100 - b.marginPercent)) - (a.quantity * (100 - a.marginPercent)))
        .slice(0, 4)
    },
    {
      key: "profit-engines",
      title: String(t("strategicProfitEnginesTitle")),
      text: String(t("strategicProfitEnginesText")),
      tone: "good",
      items: enrichedProducts
        .filter((item) => item.quantity >= quantityCut && item.marginPercent >= highMarginCut)
        .sort(sortByOpportunity)
        .slice(0, 4)
    },
    {
      key: "attention-points",
      title: String(t("strategicAttentionTitle")),
      text: String(t("strategicAttentionText")),
      tone: "mid",
      items: enrichedProducts
        .filter((item) => item.quantity < quantityCut && item.marginPercent <= lowMarginCut)
        .sort((a, b) => (b.revenue - b.grossProfit) - (a.revenue - a.grossProfit))
        .slice(0, 4)
    }
  ];

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>{String(t("strategicMatrixTitle"))}</h3>
          <p>{String(t("strategicMatrixText"))}</p>
        </div>
        <div className="strategic-thresholds">
          <small>{(t("strategicHighSalesCut") as (value: string) => string)(formatNumber(quantityCut))}</small>
          <small>{(t("strategicHighMarginCut") as (value: string) => string)(formatPercent(highMarginCut))}</small>
          <small>{(t("strategicLowMarginCut") as (value: string) => string)(formatPercent(lowMarginCut))}</small>
        </div>
      </div>

      <div className="issue-grid strategic-grid">
        {cards.map((card) => (
          <article key={card.key} className={`issue-card strategic-card ${card.tone}`}>
            <span className="eyebrow">{card.title}</span>
            <p>{card.text}</p>

            {card.items.length > 0 ? (
              <div className="ranking-list">
                {card.items.map((item) => (
                  <div key={`${card.key}-${item.code}`} className="ranking-row strategic-row">
                    <div className="ranking-labels">
                      <span>{item.itemName}</span>
                      <strong>{formatPercent(item.marginPercent)}</strong>
                    </div>
                    <div className="meta-inline strategic-meta">
                      <small>{formatNumber(item.quantity)} un.</small>
                      <small>{formatCurrency(item.revenue)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="message">{String(t("strategicEmpty"))}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SalesTotalsPanel({ totals }: { totals: SalesTotalRow[] }) {
  const { t } = useLocale();
  const generalTotals = totals.filter((item) => item.level === "general");
  if (generalTotals.length === 0) {
    return null;
  }

  const totalRevenue = generalTotals.reduce((sum, item) => sum + item.revenue, 0);
  const totalQuantity = generalTotals.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="card compact-footer">
      <div className="section-head">
        <div>
          <h3>{String(t("officialTotalTitle"))}</h3>
          <p>{String(t("officialTotalText"))}</p>
        </div>
      </div>

      <div className="totals-box compact">
        <span className="eyebrow">{generalTotals.length > 1 ? String(t("officialTotalConsolidated")) : String(t("officialTotal"))}</span>
        <strong>{formatCurrency(totalRevenue)}</strong>
        <p>{(t("closingUnits") as (value: string) => string)(formatNumber(totalQuantity))}</p>
      </div>
    </section>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [authHydrating, setAuthHydrating] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>();
  const [accountError, setAccountError] = useState<string>();
  const [currentSection, setCurrentSection] = useState<InternalSection>("dashboard");
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [accountMembersLoading, setAccountMembersLoading] = useState(false);
  const [accountInvitations, setAccountInvitations] = useState<AccountInvitation[]>([]);
  const [accountInvitationsLoading, setAccountInvitationsLoading] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string>();
  const [inviteError, setInviteError] = useState<string>();
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: "",
    featureIds: [DEFAULT_INVITE_FEATURE],
    restaurantIds: []
  });
  const [userProfileForm, setUserProfileForm] = useState<UserProfileFormState>({ fullName: "" });
  const [restaurantProfileForm, setRestaurantProfileForm] = useState<ProfileFormState>({ restaurantName: "" });
  const [restaurantProfileDirty, setRestaurantProfileDirty] = useState(false);
  const [restaurantProfileRestaurantId, setRestaurantProfileRestaurantId] = useState<string>();
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceRestaurantId, setWorkspaceRestaurantId] = useState<string>();
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [, setRecipeFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({});
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedbackItem[]>([]);
  const [drePeriods, setDrePeriods] = useState<DrePeriodData[]>([]);
  const [selectedDrePeriod, setSelectedDrePeriod] = useState<string>(DEFAULT_DRE_PERIOD);
  const [dreError, setDreError] = useState<string>();
  const [dreProcessing, setDreProcessing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(TOTAL_PERIOD);
  const [selectedView, setSelectedView] = useState<string>(TOTAL_VIEW);
  const latestWorkspaceRestaurantIdRef = useRef<string>();
  const latestStateRef = useRef<UploadState>({});
  const latestUploadFeedbackRef = useRef<UploadFeedbackItem[]>([]);
  const latestDrePeriodsRef = useRef<DrePeriodData[]>([]);
  const latestWorkspaceMetaRef = useRef({
    locale: "pt" as Locale,
    selectedPeriod: TOTAL_PERIOD,
    selectedView: TOTAL_VIEW,
    selectedDrePeriod: DEFAULT_DRE_PERIOD,
    currentSection: "dashboard" as InternalSection
  });
  const t = <K extends keyof typeof translations.pt>(key: K) => withLocaleFallback<typeof translations.pt>(locale, key);
  const effectiveSession = useMemo(
    () => (session ? applyActiveRestaurant(session, getPreferredRestaurant(session.userId)) : null),
    [session]
  );
  const activeWorkspaceSession = useMemo(
    () =>
      effectiveSession
        ? {
            authMode: effectiveSession.authMode,
            restaurantId: effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId ?? ""
          }
        : null,
    [effectiveSession]
  );
  const activeWorkspaceKey = getWorkspaceSessionKey(effectiveSession);
  latestWorkspaceRestaurantIdRef.current = workspaceRestaurantId;
  latestStateRef.current = state;
  latestUploadFeedbackRef.current = uploadFeedback;
  latestDrePeriodsRef.current = drePeriods;
  latestWorkspaceMetaRef.current = {
    locale,
    selectedPeriod,
    selectedView,
    selectedDrePeriod,
    currentSection
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const hasSalesFile = salesFiles.length > 0 || (state.periodDashboards?.length ?? 0) > 0;
  const hasPersistedWorkspaceContent = (workspace?: PersistedWorkspace | null) =>
    Boolean(
      workspace &&
        (
          ((workspace.state?.periodDashboards?.length ?? 0) > 0) ||
          ((workspace.state?.recipeBase?.length ?? 0) > 0) ||
          ((workspace.state?.salesFileNames?.length ?? 0) > 0) ||
          ((workspace.drePeriods?.length ?? 0) > 0) ||
          ((workspace.uploadFeedback?.length ?? 0) > 0) ||
          workspace.state?.processing
        )
    );
  const activeRole = effectiveSession?.activeRole ?? "viewer";
  const canManageRestaurants =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageOperationalData =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageTeam = effectiveSession?.globalRole === "owner";
  const themeLabels = {
    label: String(t("theme")),
    light: String(t("themeLight")),
    dark: String(t("themeDark"))
  };
  const navigationItems = [
    { key: "dashboard" as InternalSection, label: String(t("navDashboard")) },
    { key: "dre" as InternalSection, label: String(t("navDre")) },
    ...(canManageRestaurants ? [{ key: "restaurants" as InternalSection, label: String(t("navRestaurants")) }] : []),
    ...(canManageTeam ? [{ key: "team" as InternalSection, label: String(t("navTeam")) }] : [])
  ];
  const accountPanelCopy = {
    settings: String(t("authSettings")),
    settingsText: String(t("authSettingsText")),
    close: String(t("authClose")),
    userProfile: String(t("authUserProfile")),
    userProfileText: String(t("authUserProfileText")),
    profilePhoto: String(t("authProfilePhoto")),
    uploadPhoto: String(t("authUploadPhoto")),
    fullName: String(t("authFullName")),
    email: String(t("authEmail")),
    accountStatus: String(t("authAccountStatus")),
    roleOwner: String(t("authRoleOwner")),
    roleViewer: String(t("authRoleViewer")),
    restaurantsCount: String(t("authRestaurantsCount")),
    saveProfile: String(t("authSaveProfile")),
    manageRestaurants: String(t("authManageRestaurants")),
    manageRestaurantsText: String(t("authManageRestaurantsText")),
    restaurantProfile: String(t("authRestaurantProfile")),
    restaurantProfileText: String(t("authRestaurantProfileText")),
    restaurantName: String(t("authRestaurantName")),
    activate: String(t("authActivate")),
    active: String(t("authActive")),
    deleteRestaurant: String(t("authDeleteRestaurant")),
    createRestaurant: String(t("authCreateRestaurant")),
    createRestaurantText: String(t("authCreateRestaurantText")),
    createRestaurantAction: String(t("authCreateRestaurantAction")),
    dangerZone: String(t("authDangerZone")),
    deleteAccount: String(t("authDeleteAccount")),
    deleteHint: String(t("authDeleteHint")),
    processing: String(t("processing"))
  };
  const drePanelCopy: DrePanelCopy = {
    navDre: String(t("navDre")),
    dreParsedTitle: String(t("dreParsedTitle")),
    dreEmptyTitle: String(t("dreEmptyTitle")),
    dreEmptyText: String(t("dreEmptyText")),
    dreUploadTitle: String(t("dreUploadTitle")),
    dreUploadAction: String(t("dreUploadAction")),
    dreUploadHint: String(t("dreUploadHint")),
    dreProcessing: String(t("dreProcessing")),
    drePeriod: String(t("drePeriod")),
    dreSelectPeriod: String(t("dreSelectPeriod")),
    dreRevenue: String(t("dreRevenue")),
    dreOutflows: String(t("dreOutflows")),
    dreFinalBalance: String(t("dreFinalBalance")),
    dreResultMap: String(t("dreResultMap")),
    dreResultMapText: String(t("dreResultMapText")),
    dreSectionChart: String(t("dreSectionChart")),
    dreSectionChartText: String(t("dreSectionChartText")),
    dreParticipationTitle: String(t("dreParticipationTitle")),
    dreParticipationText: String(t("dreParticipationText")),
    dreStrategicTitle: String(t("dreStrategicTitle")),
    dreStrategicText: String(t("dreStrategicText")),
    dreRevenueConcentration: String(t("dreRevenueConcentration")),
    dreNoData: String(t("dreNoData")),
    dreLargestExpense: String(t("dreLargestExpense")),
    dreFinalMargin: String(t("dreFinalMargin")),
    dreExpenseRatio: String(t("dreExpenseRatio")),
    dreRestaurantDiagnostics: String(t("dreRestaurantDiagnostics")),
    dreRestaurantDiagnosticsText: String(t("dreRestaurantDiagnosticsText")),
    dreFinalMarginCard: String(t("dreFinalMarginCard")),
    dreOperationalMarginCard: String(t("dreOperationalMarginCard")),
    dreInputsOnRevenue: String(t("dreInputsOnRevenue")),
    drePeopleOnRevenue: String(t("drePeopleOnRevenue")),
    dreStructureOnRevenue: String(t("dreStructureOnRevenue")),
    dreHealthy: String(t("dreHealthy")),
    dreCritical: String(t("dreCritical")),
    dreAttention: String(t("dreAttention")),
    dreAttentionPoints: String(t("dreAttentionPoints")),
    dreRevenueMixTitle: String(t("dreRevenueMixTitle")),
    dreRevenueMixText: String(t("dreRevenueMixText")),
    dreMenuMixTitle: String(t("dreMenuMixTitle")),
    dreMenuMixText: String(t("dreMenuMixText")),
    dreCardFeesTitle: String(t("dreCardFeesTitle")),
    dreCardFeesText: String(t("dreCardFeesText")),
    dreRevenueVsExpenses: String(t("dreRevenueVsExpenses")),
    dreRevenueVsExpensesText: String(t("dreRevenueVsExpensesText")),
    dreOperationalResultChart: String(t("dreOperationalResultChart")),
    dreOperationalResultChartText: String(t("dreOperationalResultChartText")),
    total: String(t("total"))
  };
  const teamPanelCopy = {
    processing: String(t("processing")),
    navTeam: String(t("navTeam")),
    teamTitle: String(t("teamTitle")),
    teamText: String(t("teamText")),
    teamAccessModel: String(t("teamAccessModel")),
    teamAccessModelText: String(t("teamAccessModelText")),
    teamMembersTotal: String(t("teamMembersTotal")),
    teamAccountRole: String(t("teamAccountRole")),
    teamAdminsTotal: String(t("teamAdminsTotal")),
    teamUsersTotal: String(t("teamUsersTotal")),
    teamRestaurantsTotal: String(t("teamRestaurantsTotal")),
    authRestaurants: String(t("authRestaurants")),
    teamEmpty: String(t("teamEmpty")),
    teamRoleOwner: String(t("teamRoleOwner")),
    teamRoleUser: String(t("teamRoleUser")),
    teamRoleViewer: String(t("teamRoleViewer")),
    teamRestaurantAccess: String(t("teamRestaurantAccess")),
    teamNoRestaurants: String(t("teamNoRestaurants")),
    teamManageMember: String(t("teamManageMember")),
    teamManageMemberText: String(t("teamManageMemberText")),
    teamInviteFeatures: String(t("teamInviteFeatures")),
    teamFeatureDashboard: String(t("teamFeatureDashboard")),
    teamInviteRestaurants: String(t("teamInviteRestaurants")),
    teamSaveMember: String(t("teamSaveMember")),
    teamRemoveMember: String(t("teamRemoveMember")),
    teamMemberImmutable: String(t("teamMemberImmutable")),
    teamMemberUpdated: String(t("teamMemberUpdated")),
    teamMemberRemoved: String(t("teamMemberRemoved")),
    teamYou: String(t("teamYou")),
    teamInviteTitle: String(t("teamInviteTitle")),
    teamInviteText: String(t("teamInviteText")),
    teamInviteEmail: String(t("teamInviteEmail")),
    teamInviteHint: String(t("teamInviteHint")),
    teamInviteAction: String(t("teamInviteAction")),
    teamInvitePending: String(t("teamInvitePending")),
    teamInviteEmpty: String(t("teamInviteEmpty")),
    teamInviteRevoke: String(t("teamInviteRevoke")),
    ownerOnlyMessage: "A gestão de equipe fica disponível apenas para o owner.",
    featureRequired: "Selecione ao menos uma funcionalidade.",
    selectedLabel: "Selecionado",
    noAccessLabel: "Sem acesso"
  };
  const copyBySection: Record<Exclude<InternalSection, "account">, { eyebrow: string; title: string; text: string }> = {
    dashboard: {
      eyebrow: String(t("navDashboard")),
      title: effectiveSession?.activeRestaurantName ?? effectiveSession?.restaurantName ?? String(t("navDashboard")),
      text:
        effectiveSession?.activeRole === "owner"
          ? "Visão executiva completa para leitura, upload e tomada de decisão."
          : "Acompanhe os indicadores e o desempenho da unidade selecionada."
    },
    dre: {
      eyebrow: String(t("navDre")),
      title: String(t("dreTitle")),
      text: String(t("dreText"))
    },
    restaurants: {
      eyebrow: String(t("navRestaurants")),
      title: String(t("authManageRestaurants")),
      text: String(t("authManageRestaurantsText"))
    },
    team: {
      eyebrow: String(t("navTeam")),
      title: String(t("teamTitle")),
      text: String(t("teamText"))
    }
  };
  const activeHeaderSection = currentSection === "account" ? "dashboard" : currentSection;
  const dashboardHeaderCopy = copyBySection[activeHeaderSection];
  const periodDashboards = useMemo(() => state.periodDashboards ?? [], [state.periodDashboards]);
  const consolidatedPeriodDashboard = useMemo(
    () => (!state.data && periodDashboards.length > 0 ? buildConsolidatedDashboard(periodDashboards) : undefined),
    [periodDashboards, state.data]
  );
  const dashboard =
    selectedPeriod === TOTAL_PERIOD
      ? state.data ?? consolidatedPeriodDashboard
      : periodDashboards.find((periodDashboard) => periodDashboard.key === selectedPeriod)?.data;
  const activeDrePeriod =
    drePeriods.find((period) => period.key === selectedDrePeriod) ??
    drePeriods[drePeriods.length - 1];
  const dreData = activeDrePeriod?.data;
  const hasDashboardData = Boolean(dashboard);
  const revenuePieData = useMemo(() => (dashboard ? asPieData(dashboard.groups, "revenue") : []), [dashboard]);
  const costPieData = useMemo(() => (dashboard ? asPieData(dashboard.groups, "cost") : []), [dashboard]);

  useEffect(() => {
    if (!state.recipeBase?.length) {
      return;
    }

    const nextDuplicateCodes = getDuplicateCodes(state.recipeBase);
    const currentDuplicateCodes = state.duplicateRecipeCodes ?? [];
    if (JSON.stringify(nextDuplicateCodes) === JSON.stringify(currentDuplicateCodes)) {
      return;
    }

    setState((current) => ({
      ...current,
      duplicateRecipeCodes: nextDuplicateCodes,
      data: current.data
        ? {
            ...current.data,
            duplicateRecipeCodes: nextDuplicateCodes,
            issues: current.data.issues.filter((issue) => issue.id !== "duplicate-recipe-codes")
          }
        : current.data,
      periodDashboards: current.periodDashboards?.map((period) => ({
        ...period,
        data: {
          ...period.data,
          duplicateRecipeCodes: nextDuplicateCodes,
          issues: period.data.issues.filter((issue) => issue.id !== "duplicate-recipe-codes")
        }
      }))
    }));
  }, [state.recipeBase, state.duplicateRecipeCodes]);

  useEffect(() => {
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      setAccountMembers([]);
      setAccountMembersLoading(false);
      setAccountInvitations([]);
      setAccountInvitationsLoading(false);
      return;
    }

    let mounted = true;
    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    void loadAccountMembers(effectiveSession.activeAccountId)
      .then((members) => {
        if (mounted) {
          setAccountMembers(members);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountMembers([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountMembersLoading(false);
        }
      });

    void loadAccountInvitations(effectiveSession.activeAccountId)
      .then((invitations) => {
        if (mounted) {
          setAccountInvitations(invitations);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountInvitations([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountInvitationsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canManageTeam, effectiveSession]);

  useEffect(() => {
    if (selectedView !== TOTAL_VIEW && !dashboard?.groups.some((group) => group.name === selectedView)) {
      setSelectedView(TOTAL_VIEW);
    }
  }, [dashboard, selectedView]);

  useEffect(() => {
    if (selectedPeriod !== TOTAL_PERIOD && !periodDashboards.some((periodDashboard) => periodDashboard.key === selectedPeriod)) {
      setSelectedPeriod(TOTAL_PERIOD);
    }
  }, [periodDashboards, selectedPeriod]);

  useEffect(() => {
    if (!effectiveSession) {
      setUserProfileForm({ fullName: "" });
      setRestaurantProfileForm({ restaurantName: "" });
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(undefined);
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: []
      });
      return;
    }

    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });
    const currentRestaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId;
    if (!restaurantProfileDirty || restaurantProfileRestaurantId !== currentRestaurantId) {
      setRestaurantProfileForm({
        restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
        profilePhotoUrl: effectiveSession.profilePhotoUrl
      });
      setRestaurantProfileRestaurantId(currentRestaurantId);
      setRestaurantProfileDirty(false);
    }
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.length > 0 ? current.featureIds : [DEFAULT_INVITE_FEATURE],
      restaurantIds:
        current.restaurantIds.length > 0
          ? current.restaurantIds
          : (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
    }));
  }, [effectiveSession, restaurantProfileDirty, restaurantProfileRestaurantId]);

  useEffect(() => {
    if ((currentSection === "restaurants" && !canManageRestaurants) || (currentSection === "team" && !canManageTeam)) {
      setCurrentSection("dashboard");
    }
  }, [canManageRestaurants, canManageTeam, currentSection]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(restoreSession());
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    void withTimeout(getSupabaseSession(), AUTH_BOOT_TIMEOUT_MS, "Tempo limite ao inicializar autenticação.")
      .then((nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);
      })
      .catch((error) => {
        if (mounted) {
          setSession(null);
          setAuthError(error instanceof Error ? error.message : "Não foi possível inicializar a autenticação.");
        }
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    const unsubscribe = subscribeToSupabaseAuth((nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || session.authMode !== "supabase") {
      setAuthHydrating(false);
      return;
    }

    if ((session.memberships?.length ?? 0) > 0 && (session.activeRestaurantId ?? session.restaurantId)) {
      setAuthHydrating(false);
      return;
    }

    let mounted = true;
    setAuthHydrating(true);

    void withTimeout(
      hydrateSupabaseSession(session),
      AUTH_HYDRATE_TIMEOUT_MS,
      "Tempo limite ao carregar restaurantes e permissões da conta."
    )
      .then((nextSession) => {
        if (!mounted || !nextSession) {
          return;
        }

        if (!(nextSession.activeRestaurantId ?? nextSession.restaurantId)) {
          throw new Error("Login efetuado, mas nenhum restaurante ativo foi encontrado para esta conta.");
        }

        setSession((current) => {
          if (!current || current.userId !== nextSession.userId) {
            return current;
          }

          const preferredRestaurantId = getPreferredRestaurant(nextSession.userId);
          return applyActiveRestaurant(nextSession, preferredRestaurantId);
        });
        setAuthError(undefined);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setAuthError(error instanceof Error ? error.message : "Não foi possível carregar os restaurantes da conta.");
        setSession((current) =>
          current && !(current.activeRestaurantId ?? current.restaurantId) ? null : current
        );
      })
      .finally(() => {
        if (mounted) {
          setAuthHydrating(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || session.authMode !== "supabase") {
      return;
    }

    const refreshSessionAccess = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void withTimeout(
        hydrateSupabaseSession(session),
        AUTH_HYDRATE_TIMEOUT_MS,
        "Tempo limite ao atualizar restaurantes e permissões da conta."
      )
        .then((nextSession) => {
          if (!nextSession) {
            return;
          }

          setSession((current) => {
            if (!current || current.userId !== nextSession.userId) {
              return current;
            }

            const preferredRestaurantId = getPreferredRestaurant(nextSession.userId);
            return applyActiveRestaurant(nextSession, preferredRestaurantId);
          });
        })
        .catch(() => undefined);
    };

    window.addEventListener("focus", refreshSessionAccess);
    document.addEventListener("visibilitychange", refreshSessionAccess);

    return () => {
      window.removeEventListener("focus", refreshSessionAccess);
      document.removeEventListener("visibilitychange", refreshSessionAccess);
    };
  }, [session]);

  useEffect(() => {
    if (!activeWorkspaceSession) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      setSalesFiles([]);
      setRecipeFile(null);
      setState({});
      setUploadFeedback([]);
      setDrePeriods([]);
      setSelectedDrePeriod(DEFAULT_DRE_PERIOD);
      setSelectedPeriod(TOTAL_PERIOD);
      setSelectedView(TOTAL_VIEW);
      setCurrentSection("dashboard");
      setAuthLoading(false);
      return;
    }

    if (activeWorkspaceSession.authMode === "supabase" && !activeWorkspaceSession.restaurantId) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      return;
    }

    let mounted = true;
    const targetRestaurantId = activeWorkspaceSession.restaurantId;
    const localWorkspace = loadRestaurantWorkspace<PersistedWorkspace>(targetRestaurantId);
    setWorkspaceReady(false);
    setWorkspaceRestaurantId(undefined);

    if (localWorkspace) {
      setLocale(localWorkspace.locale ?? "pt");
      setState((localWorkspace.state as UploadState | undefined) ?? {});
      setUploadFeedback(localWorkspace.uploadFeedback ?? []);
      setDrePeriods(localWorkspace.drePeriods ?? []);
      setSelectedDrePeriod(
        localWorkspace.selectedDrePeriod ??
          localWorkspace.drePeriods?.[localWorkspace.drePeriods.length - 1]?.key ??
          DEFAULT_DRE_PERIOD
      );
      setSelectedPeriod(localWorkspace.selectedPeriod ?? TOTAL_PERIOD);
      setSelectedView(localWorkspace.selectedView ?? TOTAL_VIEW);
      setWorkspaceRestaurantId(targetRestaurantId);
      setWorkspaceReady(true);
    }

    const loadWorkspace = async () => {
      try {
        const cloudWorkspace =
          activeWorkspaceSession.authMode === "supabase"
            ? await loadCloudWorkspace(targetRestaurantId)
            : localWorkspace;
        const workspace = cloudWorkspace ?? localWorkspace;

        if (!mounted) {
          return;
        }

        const currentWorkspaceHasContent =
          latestWorkspaceRestaurantIdRef.current === targetRestaurantId &&
          hasPersistedWorkspaceContent({
            locale: latestWorkspaceMetaRef.current.locale,
            state: latestStateRef.current as PersistedWorkspace["state"],
            uploadFeedback: latestUploadFeedbackRef.current,
            drePeriods: latestDrePeriodsRef.current,
            selectedPeriod: latestWorkspaceMetaRef.current.selectedPeriod,
            selectedView: latestWorkspaceMetaRef.current.selectedView,
            selectedDrePeriod: latestWorkspaceMetaRef.current.selectedDrePeriod,
            currentSection: latestWorkspaceMetaRef.current.currentSection
          });

        if (currentWorkspaceHasContent) {
          setWorkspaceRestaurantId(targetRestaurantId);
          setWorkspaceReady(true);
          return;
        }

        setSalesFiles([]);
        setRecipeFile(null);
        setAuthError(undefined);
        setLocale(workspace?.locale ?? "pt");
        setState((workspace?.state as UploadState | undefined) ?? {});
        setUploadFeedback(workspace?.uploadFeedback ?? []);
        setDrePeriods(workspace?.drePeriods ?? []);
        setSelectedDrePeriod(
          workspace?.selectedDrePeriod ??
            workspace?.drePeriods?.[(workspace.drePeriods?.length ?? 0) - 1]?.key ??
            DEFAULT_DRE_PERIOD
        );
        setSelectedPeriod(workspace?.selectedPeriod ?? TOTAL_PERIOD);
        setSelectedView(workspace?.selectedView ?? TOTAL_VIEW);
        setWorkspaceRestaurantId(targetRestaurantId);
        setWorkspaceReady(true);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setAuthError(error instanceof Error ? error.message : "Não foi possível carregar a base do restaurante.");
        setWorkspaceRestaurantId(targetRestaurantId);
        setWorkspaceReady(true);
      }
    };

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [activeWorkspaceKey, activeWorkspaceSession]);

  useEffect(() => {
    if (!effectiveSession || !workspaceReady) {
      return;
    }

    const restaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId;
    if (!restaurantId || workspaceRestaurantId !== restaurantId) {
      return;
    }

    const workspace: PersistedWorkspace = {
      locale,
      state: state as PersistedWorkspace["state"],
      uploadFeedback,
      selectedPeriod,
      selectedView,
      drePeriods,
      selectedDrePeriod,
      currentSection
    };

    saveRestaurantWorkspace<PersistedWorkspace>(restaurantId, workspace);

    if (effectiveSession.authMode === "supabase") {
      void saveCloudWorkspace(restaurantId, workspace).catch(() => undefined);
      return;
    }

  }, [currentSection, drePeriods, effectiveSession, locale, selectedDrePeriod, selectedPeriod, selectedView, state, uploadFeedback, workspaceReady, workspaceRestaurantId]);

  const createPeriodDashboardsFromImports = (
    fileNames: string[],
    recipes: RecipeRow[],
    duplicateRecipeCodes: string[],
    salesImports: Awaited<ReturnType<typeof parseSalesSpreadsheetFile>>[]
  ) =>
    salesImports
      .map((salesImport, index) => {
        const sales = mapSalesRows(salesImport.items);
        if (sales.length === 0) {
          return null;
        }

        const fallbackKey = `arquivo-${index + 1}`;
        return {
          key: salesImport.reportPeriod?.periodKey ?? fallbackKey,
          label: salesImport.reportPeriod?.periodLabel ?? salesImport.reportPeriod?.displayLabel ?? fileNames[index] ?? fallbackKey,
          data: buildDashboardData(sales, recipes, salesImport.totals, salesImport.reportPeriod, duplicateRecipeCodes)
        };
      })
      .filter((dashboardItem): dashboardItem is PeriodDashboard => Boolean(dashboardItem));

  const applyPeriodDashboards = (
    nextPeriods: PeriodDashboard[],
    options?: {
      recipeBase?: RecipeRow[];
      duplicateRecipeCodes?: string[];
      recipeFileName?: string;
      validations?: ImportValidation[];
      error?: string;
    }
  ) => {
    const nextData = buildConsolidatedDashboard(nextPeriods);

    setState((current) => ({
      ...current,
      data: nextData,
      periodDashboards: nextPeriods,
      salesFileNames: undefined,
      recipeFileName: undefined,
      recipeBase: options?.recipeBase ?? current.recipeBase,
      duplicateRecipeCodes: options?.duplicateRecipeCodes ?? current.duplicateRecipeCodes,
      validations: options?.validations ?? current.validations,
      error: options?.error,
      processing: false
    }));
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
  };

  const handleSalesUpload = async (files: File[]) => {
    const nextSalesFiles = dedupeFiles([...salesFiles, ...files]);
    setSalesFiles(nextSalesFiles);
    setState((current) => ({
      ...current,
      salesFileNames: nextSalesFiles.map((file) => file.name),
      error: undefined
    }));

    if (!state.recipeBase?.length) {
      return;
    }

    const recipes = state.recipeBase;
    const duplicateRecipeCodes = state.duplicateRecipeCodes ?? getDuplicateCodes(recipes);
    let validations = state.validations?.filter((item) => item.kind === "recipes") ?? [];

    try {
      setUploadFeedback(nextSalesFiles.map((file) => ({ id: `sales-${file.name}`, kind: "sales", fileName: file.name, status: "pending" })));
      setState((current) => ({ ...current, processing: true, error: undefined }));

      const salesImports = await Promise.all(nextSalesFiles.map((file) => parseSalesSpreadsheetFile(file)));
      validations = [
        ...validations,
        ...salesImports.map((salesImport, index) =>
          validateColumns("sales", nextSalesFiles[index]?.name ?? `vendas-${index + 1}`, salesImport.headerValues, ["CÓDIGO", "PRODUTO", "QTE", "TOTAL"])
        )
      ];

      const invalidValidation = validations.find((validation) => validation.missingColumns.length > 0);
      if (invalidValidation) {
        throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidValidation.fileName}: ${invalidValidation.missingColumns.join(", ")}.`);
      }

      const incomingPeriods = createPeriodDashboardsFromImports(nextSalesFiles.map((file) => file.name), recipes, duplicateRecipeCodes, salesImports);
      if (incomingPeriods.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada nos arquivos de vendas.");
      }

      const mergedPeriods = mergePeriodDashboards(periodDashboards, incomingPeriods, recipes, duplicateRecipeCodes);
      setUploadFeedback(nextSalesFiles.map((file) => ({ id: `sales-${file.name}`, kind: "sales", fileName: file.name, status: "success" })));
      applyPeriodDashboards(mergedPeriods, {
        recipeBase: recipes,
        duplicateRecipeCodes,
        validations
      });
      setSalesFiles([]);
    } catch (error) {
      setUploadFeedback(
        nextSalesFiles.map((file) => ({
          id: `sales-${file.name}`,
          kind: "sales",
          fileName: file.name,
          status: "error",
          detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
        }))
      );
      setState((current) => ({
        ...current,
        validations,
        error: error instanceof Error ? error.message : "Falha ao processar os arquivos.",
        processing: false
      }));
    }
  };

  const handleRecipeUpload = async (file: File) => {
    if (salesFiles.length === 0 && periodDashboards.length === 0) {
      setState((current) => ({
        ...current,
        error: "Envie primeiro o arquivo de vendas."
      }));
      return;
    }

    setRecipeFile(file);
    let validations: ImportValidation[] = [];

    try {
      setUploadFeedback([
        ...(salesFiles.length > 0 ? salesFiles.map((salesFile) => ({ id: `sales-${salesFile.name}`, kind: "sales" as const, fileName: salesFile.name, status: "pending" as const })) : []),
        { id: `recipes-${file.name}`, kind: "recipes", fileName: file.name, status: "pending" }
      ]);
      setState((current) => ({
        ...current,
        recipeFileName: file.name,
        processing: true,
        error: undefined
      }));

      const recipesRaw = await parseSpreadsheetFile(file);
      const recipes = mapRecipeRows(recipesRaw);
      const recipeHeaders = recipesRaw[0] ? Object.keys(recipesRaw[0]) : [];
      validations = [
        validateColumns("recipes", file.name, recipeHeaders, ["CÓDIGO", "PRODUTO DO CARDÁPIO", "PREÇO", "CUSTO", "CMV"])
      ];

      const invalidRecipeValidation = validations.find((validation) => validation.missingColumns.length > 0);
      if (invalidRecipeValidation) {
        throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidRecipeValidation.fileName}: ${invalidRecipeValidation.missingColumns.join(", ")}.`);
      }

      if (recipes.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada no arquivo de fichas técnicas.");
      }

      const duplicateRecipeCodes = getDuplicateCodes(recipes);
      const rebuiltPeriods = periodDashboards.map((period) => ({
        key: period.key,
        label: period.label,
        data: buildDashboardData(
          productsToSalesRows(period.data.products),
          recipes,
          period.data.importedSalesTotals,
          period.data.reportPeriod,
          duplicateRecipeCodes
        )
      }));

      let incomingPeriods: PeriodDashboard[] = [];
      if (salesFiles.length > 0) {
        const salesImports = await Promise.all(salesFiles.map((salesFile) => parseSalesSpreadsheetFile(salesFile)));
        const salesValidations = salesImports.map((salesImport, index) =>
          validateColumns("sales", salesFiles[index]?.name ?? `vendas-${index + 1}`, salesImport.headerValues, ["CÓDIGO", "PRODUTO", "QTE", "TOTAL"])
        );
        validations = [...salesValidations, ...validations];

        const invalidSalesValidation = validations.find((validation) => validation.missingColumns.length > 0);
        if (invalidSalesValidation) {
          throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidSalesValidation.fileName}: ${invalidSalesValidation.missingColumns.join(", ")}.`);
        }

        incomingPeriods = createPeriodDashboardsFromImports(salesFiles.map((salesFile) => salesFile.name), recipes, duplicateRecipeCodes, salesImports);
      }

      const mergedPeriods = mergePeriodDashboards(rebuiltPeriods, incomingPeriods, recipes, duplicateRecipeCodes);
      if (mergedPeriods.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada para montar o dashboard.");
      }

      setUploadFeedback([
        ...(salesFiles.length > 0 ? salesFiles.map((salesFile) => ({ id: `sales-${salesFile.name}`, kind: "sales" as const, fileName: salesFile.name, status: "success" as const })) : []),
        { id: `recipes-${file.name}`, kind: "recipes", fileName: file.name, status: "success" }
      ]);

      applyPeriodDashboards(mergedPeriods, {
        recipeBase: recipes,
        duplicateRecipeCodes,
        recipeFileName: file.name,
        validations
      });
      setSalesFiles([]);
      setRecipeFile(null);
    } catch (error) {
      setUploadFeedback([
        ...(salesFiles.length > 0
          ? salesFiles.map((salesFile) => ({
              id: `sales-${salesFile.name}`,
              kind: "sales" as const,
              fileName: salesFile.name,
              status: "error" as const,
              detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
            }))
          : []),
        {
          id: `recipes-${file.name}`,
          kind: "recipes",
          fileName: file.name,
          status: "error",
          detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
        }
      ]);
      setState((current) => ({
        ...current,
        recipeFileName: file.name,
        validations,
        error: error instanceof Error ? error.message : "Falha ao processar os arquivos.",
        processing: false
      }));
    }
  };

  const handleUpload = (kind: "sales" | "recipes", files: File[]) => {
    if (!canManageOperationalData) {
      return;
    }

    if (files.length === 0) {
      return;
    }

    if (kind === "sales") {
      void handleSalesUpload(files);
      return;
    }

    void handleRecipeUpload(files[0]);
  };

  const handleDreImport = async (file: File) => {
    if (!canManageOperationalData) {
      return;
    }

    try {
      setDreProcessing(true);
      setDreError(undefined);
      const nextDreData = await parseDreSpreadsheetFile(file);

      if (nextDreData.sections.length === 0 && nextDreData.summary.length === 0) {
        throw new Error("Nenhuma seção de DRE foi identificada neste arquivo.");
      }

      if (getDreRevenueValue(nextDreData) > 0 && getDreRevenueGroups(nextDreData).length === 0) {
        throw new Error("A seção de Receitas Operacionais foi encontrada, mas nenhuma subdivisão de receita foi identificada. Verifique se os subgrupos estão na coluna B do arquivo.");
      }

      const fallbackKey = `${file.name}-${Date.now()}`;
      const periodKey = getDrePeriodKey(nextDreData, fallbackKey);
      const periodLabel = getDrePeriodLabel(nextDreData, file.name);
      setDrePeriods((current) => {
        const nextPeriod = {
          key: periodKey,
          label: periodLabel,
          fileName: file.name,
          data: nextDreData
        };
        const withoutCurrentPeriod = current.filter((period) => period.key !== periodKey);
        return [...withoutCurrentPeriod, nextPeriod].sort((left, right) => left.key.localeCompare(right.key));
      });
      setSelectedDrePeriod(periodKey);
    } catch (error) {
      setDreError(error instanceof Error ? error.message : "Falha ao processar o arquivo de DRE.");
    } finally {
      setDreProcessing(false);
    }
  };

  const rebuildFromPeriods = (nextPeriods: PeriodDashboard[]) => {
    if (nextPeriods.length === 0) {
      applyPeriodDashboards([], { error: undefined });
      return;
    }

    applyPeriodDashboards(nextPeriods, { error: undefined });
  };

  const handleRemovePeriod = (periodKey: string) => {
    const targetPeriod = periodDashboards.find((period) => period.key === periodKey);
    const targetLabel = targetPeriod ? getPeriodLabel(targetPeriod) : periodKey;
    if (typeof window !== "undefined") {
      const shouldRemove = window.confirm(
        `Deseja excluir apenas o período ${targetLabel}?\n\nEssa ação remove somente os dados desse mês da análise atual e não pode ser desfeita.`
      );
      if (!shouldRemove) {
        return;
      }
    }

    rebuildFromPeriods(periodDashboards.filter((period) => period.key !== periodKey));
  };

  const handleClearAll = () => {
    setSalesFiles([]);
    setRecipeFile(null);
    setUploadFeedback([]);
    setState({});
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
  };

  const handleResetFlow = () => {
    setRecipeFile(null);
    setUploadFeedback([]);
    setSalesFiles([]);
    setState((current) => ({
      ...current,
      error: undefined,
      processing: false
    }));
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      setAuthSubmitting(true);
      setAuthError(undefined);
      const nextSession = isSupabaseConfigured
        ? await signInWithSupabase(email, password)
        : signIn(email, password);
      if (!isSupabaseConfigured && !(nextSession.activeRestaurantId ?? nextSession.restaurantId)) {
        throw new Error("Login efetuado, mas nenhum restaurante ativo foi encontrado para esta conta.");
      }
      setSession(nextSession);
      setAuthError(undefined);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (fullName: string, email: string, password: string) => {
    try {
      setAuthSubmitting(true);
      setAuthError(undefined);
      const nextSession = isSupabaseConfigured
        ? await registerRestaurantWithSupabase({ fullName, email, password })
        : registerRestaurant({ fullName, email, password });
      setSession(nextSession);
      setAuthError(undefined);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível criar o acesso.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (session?.authMode === "supabase") {
        await signOutFromSupabase();
      } else {
        signOut();
      }
    } finally {
      setSession(null);
    }
  };

  const handleSelectRestaurant = (restaurantId: string) => {
    if (!session) {
      return;
    }

    savePreferredRestaurant(session.userId, restaurantId);
    setWorkspaceReady(false);
    setWorkspaceRestaurantId(undefined);
    setSalesFiles([]);
    setRecipeFile(null);
    setState({});
    setUploadFeedback([]);
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
    setSession((current) => (current ? applyActiveRestaurant(current, restaurantId) : current));
    setAccountError(undefined);
    setAccountMessage(undefined);
  };

  const refreshTeamData = async (currentSession: AuthSession) => {
    if (currentSession.globalRole !== "owner" || currentSession.authMode !== "supabase" || !currentSession.activeAccountId) {
      setAccountMembers([]);
      setAccountInvitations([]);
      return;
    }

    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    try {
      const [members, invitations] = await Promise.all([
        loadAccountMembers(currentSession.activeAccountId),
        loadAccountInvitations(currentSession.activeAccountId)
      ]);
      setAccountMembers(members);
      setAccountInvitations(invitations);
    } finally {
      setAccountMembersLoading(false);
      setAccountInvitationsLoading(false);
    }
  };

  const handleInviteRestaurantToggle = (restaurantId: string) => {
    setInviteForm((current) => ({
      ...current,
      restaurantIds: current.restaurantIds.includes(restaurantId)
        ? current.restaurantIds.filter((id) => id !== restaurantId)
        : [...current.restaurantIds, restaurantId]
    }));
  };

  const handleInviteFeatureToggle = (featureId: string) => {
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.includes(featureId)
        ? current.featureIds.filter((id) => id !== featureId)
        : [...current.featureIds, featureId]
    }));
  };

  const handleCreateInvitation = async () => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    if (!effectiveSession.activeAccountId) {
      setInviteError("Não foi possível identificar a conta ativa deste usuário. Atualize o vínculo da conta no banco antes de enviar convites.");
      return;
    }

    if (inviteForm.featureIds.length === 0) {
      setInviteError("Selecione ao menos uma funcionalidade para este convite.");
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await createAccountInvitation({
        email: inviteForm.email,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds: inviteForm.restaurantIds
      });
      await refreshTeamData(effectiveSession);
      setInviteMessage("Convite criado com sucesso.");
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
      });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Não foi possível criar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await revokeAccountInvitation(invitationId);
      await refreshTeamData(effectiveSession);
      setInviteMessage("Convite revogado com sucesso.");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Não foi possível revogar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleUpdateMember = async ({
    member,
    accountRole,
    restaurantRole,
    restaurantIds
  }: {
    member: AccountMember;
    accountRole: "user";
    restaurantRole: "viewer";
    restaurantIds: string[];
  }) => {
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await updateAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId,
      accountRole,
      restaurantRole,
      restaurantIds
    });
    await refreshTeamData(effectiveSession);
  };

  const handleRemoveMember = async (member: AccountMember) => {
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await removeAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId
    });
    await refreshTeamData(effectiveSession);
  };

  const handleUserPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setUserProfileForm((current) => ({
        ...current,
        userPhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setRestaurantProfileDirty(true);
      setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
      setRestaurantProfileForm((current) => ({
        ...current,
        profilePhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantNameChange = (value: string) => {
    setRestaurantProfileDirty(true);
    setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
    setRestaurantProfileForm((current) => ({ ...current, restaurantName: value }));
  };

  const handleSaveUserAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseUserProfile(session, userProfileForm)
          : updateLocalUserProfile(session, userProfileForm);

      setSession(nextSession);
      if (nextSession.authMode === "supabase") {
        await refreshTeamData(nextSession);
      }
      setAccountMessage(String(t("authProfileUpdated")));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSaveRestaurantAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseRestaurantProfile(session, restaurantProfileForm)
          : updateLocalRestaurantProfile(session, restaurantProfileForm);

      setSession(nextSession);
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(nextSession.activeRestaurantId ?? nextSession.restaurantId);
      setAccountMessage(String(t("authProfileUpdated")));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateRestaurant = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await createSupabaseRestaurantForCurrentUser(session, newRestaurantName)
          : createLocalRestaurantForAccount(session, newRestaurantName);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setNewRestaurantName("");
      setAccountMessage("Restaurante cadastrado com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível cadastrar o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    if (!session) {
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir este restaurante? Esta ação remove a base dessa unidade.")) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await deleteSupabaseRestaurantFromAccount(session, restaurantId)
          : deleteLocalRestaurantFromAccount(session, restaurantId);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setAccountMessage("Restaurante excluído com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session) {
      return;
    }

    if (!window.confirm(String(t("authDeleteConfirm")))) {
      return;
    }

    try {
      setAccountBusy(true);
      if (session.authMode === "supabase") {
        await deleteSupabaseRestaurantAccount();
        await signOutFromSupabase();
      } else {
        deleteLocalRestaurantAccount(session);
      }
      setSession(null);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
    } finally {
      setAccountBusy(false);
    }
  };

  const resetAccountPanelState = () => {
    if (!effectiveSession) {
      return;
    }

    setAccountMessage(undefined);
    setAccountError(undefined);
    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });
    setRestaurantProfileForm({
      restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
      profilePhotoUrl: effectiveSession.profilePhotoUrl
    });
    setRestaurantProfileDirty(false);
    setRestaurantProfileRestaurantId(effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId);
    setNewRestaurantName("");
  };

  if (authLoading || authHydrating) {
    return (
      <LocaleContext.Provider value={locale}>
        <div className="app-shell refined auth-shell">
          <section className="card">
            <p className="message">
              {authLoading
                ? "Inicializando acesso e verificando a sua conta..."
                : "Carregando restaurantes e permissões da sua conta..."}
            </p>
          </section>
        </div>
      </LocaleContext.Provider>
    );
  }

  if (!effectiveSession) {
    return (
      <LocaleContext.Provider value={locale}>
        <AuthScreen
          locale={locale}
          onChangeLocale={setLocale}
          theme={theme}
          onChangeTheme={setTheme}
          onLogin={handleLogin}
          onRegister={handleRegister}
          error={authError}
          isCloudEnabled={isSupabaseConfigured}
          busy={authSubmitting}
          copy={{
            brandTagline: String(t("brandTagline")),
            title: String(t("authTitle")),
            loginTab: String(t("authLoginTab")),
            registerTab: String(t("authRegisterTab")),
            fullName: String(t("authFullName")),
            fullNameHint: String(t("authFullNameHint")),
            email: String(t("authEmail")),
            password: String(t("authPassword")),
            processing: String(t("processing")),
            submitLogin: String(t("authSubmitLogin")),
            submitRegister: String(t("authSubmitRegister")),
            demoHint: String(t("authDemoHint")),
            language: String(t("language")),
            ...themeLabels
          }}
        />
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-brand">
            <BrandMark tagline={String(t("brandTagline"))} />
          </div>
          <InternalNavigation
            section={currentSection}
            onChange={setCurrentSection}
            items={navigationItems}
          />
          <div className="dashboard-sidebar-footer">
            <button
              type="button"
              className="sidebar-footer-action icon-only"
              onClick={handleLogout}
              title={String(t("authLogout"))}
              aria-label={String(t("authLogout"))}
            >
              <IconLogout />
            </button>
            <button
              type="button"
              className="sidebar-avatar-button"
              onClick={() => {
                resetAccountPanelState();
                setCurrentSection("account");
              }}
              title={String(t("navMyAccount"))}
              aria-label={String(t("navMyAccount"))}
            >
              <UserAvatar session={effectiveSession} size="lg" />
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="content dashboard-content">
            <DashboardShellHeader
              session={effectiveSession}
              eyebrow={dashboardHeaderCopy.eyebrow}
              title={dashboardHeaderCopy.title}
              text={dashboardHeaderCopy.text}
              locale={locale}
              onChangeLocale={setLocale}
              theme={theme}
              onChangeTheme={setTheme}
              languageLabel={String(t("language"))}
              themeLabels={themeLabels}
            />

            {currentSection === "dashboard" || currentSection === "dre" ? (
              <RestaurantNavigatorPanel
                eyebrow={String(t("authRestaurantNavigator"))}
                title={String(t("authRestaurantNavigator"))}
                description={String(t("authRestaurantNavigatorText"))}
                memberships={effectiveSession.memberships ?? []}
                activeRestaurantId={effectiveSession.activeRestaurantId}
                onActivateRestaurant={handleSelectRestaurant}
              />
            ) : null}
            {currentSection === "dre" ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyDreAnalysisPanel
                  data={dreData}
                  periods={drePeriods}
                  selectedPeriod={activeDrePeriod?.key ?? selectedDrePeriod}
                  error={dreError}
                  processing={dreProcessing}
                  canManageData={canManageOperationalData}
                  copy={drePanelCopy}
                  onImport={(file) => void handleDreImport(file)}
                  onSelectPeriod={setSelectedDrePeriod}
                />
              </Suspense>
            ) : null}
            {currentSection === "restaurants" && canManageRestaurants ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyRestaurantManagementPanel
                  session={effectiveSession}
                  restaurantForm={restaurantProfileForm}
                  newRestaurantName={newRestaurantName}
                  busy={accountBusy}
                  message={accountMessage}
                  error={accountError}
                  onRestaurantNameChange={handleRestaurantNameChange}
                  onRestaurantPhotoSelect={handleRestaurantPhotoSelect}
                  onCreateRestaurantNameChange={setNewRestaurantName}
                  onSaveRestaurant={handleSaveRestaurantAccount}
                  onCreateRestaurant={handleCreateRestaurant}
                  onDeleteRestaurant={handleDeleteRestaurant}
                  onActivateRestaurant={handleSelectRestaurant}
                  copy={accountPanelCopy}
                />
              </Suspense>
            ) : null}
            {currentSection === "team" && canManageTeam ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyTeamPermissionsPanel
                  session={effectiveSession}
                  members={accountMembers}
                  invitations={accountInvitations}
                  loading={accountMembersLoading}
                  invitationsLoading={accountInvitationsLoading}
                  canManageTeam={Boolean(canManageTeam)}
                  inviteForm={inviteForm}
                  inviteBusy={inviteBusy}
                  inviteMessage={inviteMessage}
                  inviteError={inviteError}
                  copy={teamPanelCopy}
                  onInviteEmailChange={(value) => setInviteForm((current) => ({ ...current, email: value }))}
                  onInviteFeatureToggle={handleInviteFeatureToggle}
                  onInviteRestaurantToggle={handleInviteRestaurantToggle}
                  onCreateInvitation={() => void handleCreateInvitation()}
                  onRevokeInvitation={(invitationId) => void handleRevokeInvitation(invitationId)}
                  onUpdateMember={handleUpdateMember}
                  onRemoveMember={handleRemoveMember}
                />
              </Suspense>
            ) : null}
            {currentSection === "account" ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyAccountSettingsPanel
                  session={effectiveSession}
                  userForm={userProfileForm}
                  restaurantForm={restaurantProfileForm}
                  newRestaurantName={newRestaurantName}
                  busy={accountBusy}
                  message={accountMessage}
                  error={accountError}
                  onClose={() => {
                    resetAccountPanelState();
                    setCurrentSection("dashboard");
                  }}
                  onUserNameChange={(value) => setUserProfileForm((current) => ({ ...current, fullName: value }))}
                  onRestaurantNameChange={handleRestaurantNameChange}
                  onUserPhotoSelect={handleUserPhotoSelect}
                  onRestaurantPhotoSelect={handleRestaurantPhotoSelect}
                  onCreateRestaurantNameChange={setNewRestaurantName}
                  onSaveUser={handleSaveUserAccount}
                  onSaveRestaurant={handleSaveRestaurantAccount}
                  onCreateRestaurant={handleCreateRestaurant}
                  onDeleteRestaurant={handleDeleteRestaurant}
                  onDeleteAccount={handleDeleteAccount}
                  onActivateRestaurant={handleSelectRestaurant}
                  canManageRestaurants={false}
                  copy={accountPanelCopy}
                />
              </Suspense>
            ) : null}
            {authError ? (
              <section className="card">
                <p className="message error">{authError}</p>
              </section>
            ) : null}
            {currentSection === "dashboard" ? (
              <>
                {canManageOperationalData ? (
                  <UploadPanel
                    state={state}
                    onUpload={handleUpload}
                    canUploadRecipes={hasSalesFile}
                    canManageData={canManageOperationalData}
                    onClearAll={handleClearAll}
                    onResetFlow={handleResetFlow}
                  />
                ) : null}
                {!hasDashboardData && canManageOperationalData ? (
                  <section className="card">
                    <div className="section-head">
                      <div>
                        <h3>{String(t("authEmptyState"))}</h3>
                        <p>{String(t("authRestaurantNavigatorText"))}</p>
                      </div>
                    </div>
                  </section>
                ) : !hasDashboardData ? (
                  <DashboardReadOnlyGuide
                    eyebrow={String(t("navDashboard"))}
                    title={String(t("dashboardGuideTitle"))}
                    text={String(t("dashboardGuideText"))}
                    revenueLabel={String(t("dashboardGuideRevenueLabel"))}
                    revenueValue="R$ 128 mil"
                    revenueTrend={String(t("dashboardGuideRevenueTrend"))}
                    salesChartTitle={String(t("dashboardGuideSalesChartTitle"))}
                    salesChartHint={String(t("dashboardGuideSalesChartHint"))}
                    cmvTitle={String(t("dashboardGuideCmvTitle"))}
                    cmvText={String(t("dashboardGuideCmvText"))}
                    alertLabel={String(t("dashboardGuideAlertLabel"))}
                    alertTitle={String(t("dashboardGuideAlertTitle"))}
                    alertText={String(t("dashboardGuideAlertText"))}
                    signals={[
                      {
                        title: String(t("dashboardGuideKpisTitle")),
                        text: String(t("dashboardGuideKpisText")),
                        tone: "good"
                      },
                      {
                        title: String(t("dashboardGuideChartsTitle")),
                        text: String(t("dashboardGuideChartsText")),
                        tone: "mid"
                      },
                      {
                        title: String(t("dashboardGuideAlertsTitle")),
                        text: String(t("dashboardGuideAlertsText")),
                        tone: "bad"
                      }
                    ]}
                    bars={[
                      { label: String(t("dashboardGuideBarPizzas")), value: 78, color: "#2f6f5e" },
                      { label: String(t("dashboardGuideBarDrinks")), value: 56, color: "#c9823a" },
                      { label: String(t("dashboardGuideBarKitchen")), value: 38, color: "#496f9f" }
                    ]}
                  />
                ) : (
                  <>
                    {dashboard ? (
                      <>
                        <ValidationPanel validations={state.validations ?? []} />
                        <KPIGrid data={dashboard} />
                        <IssuesPanel data={dashboard} />
                        <PeriodFilterBar
                          dashboards={periodDashboards}
                          selectedPeriod={selectedPeriod}
                          onSelect={setSelectedPeriod}
                          onRemovePeriod={canManageOperationalData ? handleRemovePeriod : undefined}
                          canManagePeriods={canManageOperationalData}
                        />
                        <GroupFilterBar groups={dashboard.groups} selectedView={selectedView} onSelect={setSelectedView} />

                        <section className="analytics-grid wide">
                          <DonutChartCard
                            title={String(t("chartSalesTitle"))}
                            subtitle={String(t("chartSalesText"))}
                            data={revenuePieData}
                            activeName={selectedView === TOTAL_VIEW ? undefined : selectedView}
                            onSelect={setSelectedView}
                            hideCenterLabel
                          />
                          <DonutChartCard
                            title={String(t("chartCostTitle"))}
                            subtitle={String(t("chartCostText"))}
                            data={costPieData}
                            activeName={selectedView === TOTAL_VIEW ? undefined : selectedView}
                            onSelect={setSelectedView}
                            hideCenterLabel
                          />
                        </section>

                        <section className="analytics-grid wide">
                          <CMVStatusPanel products={dashboard.products} />
                          <CMVGroupBars
                            groups={dashboard.groups}
                            activeName={selectedView === TOTAL_VIEW ? undefined : selectedView}
                            onSelect={setSelectedView}
                          />
                        </section>

                        {selectedView === TOTAL_VIEW ? (
                          <TotalOverviewPanel
                            groups={dashboard.groups}
                            activeName={selectedView === TOTAL_VIEW ? undefined : selectedView}
                            onSelect={setSelectedView}
                          />
                        ) : (
                          <GroupExplorer groupName={selectedView} products={dashboard.products} onClear={() => setSelectedView(TOTAL_VIEW)} />
                        )}
                        <ProductHighlights products={dashboard.products} />
                        <StrategicProductMatrix products={dashboard.products} />
                        <PromotionalItemsPanel products={dashboard.products} />
                        <MissingRecipesPanel products={dashboard.products} coveragePercent={dashboard.coveragePercent} />
                        <SalesTotalsPanel totals={dashboard.importedSalesTotals} />
                      </>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </LocaleContext.Provider>
  );
}




