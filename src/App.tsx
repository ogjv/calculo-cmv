import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import { useRef } from "react";
import type { AccountInvitation, AccountMember, AuthSession, DashboardData, GroupSummary, ImportValidation, PeriodDashboard, PersistedWorkspace, ProductSummary, RecipeRow, SalesTotalRow, UploadFeedbackItem } from "./types";
import { buildDashboardData, buildDashboardSlice, formatCurrency, formatNumber, formatPercent, mapRecipeRows, mapSalesRows } from "./utils/cmv";
import { parseSalesSpreadsheetFile, parseSpreadsheetFile } from "./utils/file";
import { createLocalRestaurantForAccount, deleteLocalRestaurantAccount, deleteLocalRestaurantFromAccount, loadRestaurantWorkspace, registerRestaurant, restoreSession, saveRestaurantWorkspace, signIn, signOut, updateLocalRestaurantProfile, updateLocalUserProfile } from "./utils/auth";
import { createAccountInvitation, createSupabaseRestaurantForCurrentUser, deleteSupabaseRestaurantAccount, deleteSupabaseRestaurantFromAccount, getSupabaseSession, hydrateSupabaseSession, loadAccountInvitations, loadAccountMembers, loadCloudWorkspace, registerRestaurantWithSupabase, removeAccountMemberAccess, revokeAccountInvitation, saveCloudWorkspace, signInWithSupabase, signOutFromSupabase, subscribeToSupabaseAuth, updateAccountMemberAccess, updateSupabaseRestaurantProfile, updateSupabaseUserProfile } from "./utils/cloudAuth";
import { isSupabaseConfigured } from "./utils/supabase";

type Locale = "pt" | "es" | "en";

const sampleSales = [
  { codigo: "1001", produto: "Pizza Margherita", qte: 42, total: 1764, grupo: "Pizzas", subgrupo: "Tradicionais" },
  { codigo: "1002", produto: "Pizza Calabresa", qte: 35, total: 1610, grupo: "Pizzas", subgrupo: "Tradicionais" },
  { codigo: "2001", produto: "Risoto Funghi", qte: 18, total: 972, grupo: "Cozinha", subgrupo: "Principais" },
  { codigo: "3001", produto: "Limonada", qte: 29, total: 406, grupo: "Bebidas", subgrupo: "Sem alcool" }
];

const sampleRecipes = [
  { codigo: "1001", "produto do cardapio": "Pizza Margherita", praca: "Salao", preco: 42, custo: 17.5, cmv: 41.7, grupo: "Pizzas", subgrupo: "Tradicionais" },
  { codigo: "1002", "produto do cardapio": "Pizza Calabresa", praca: "Salao", preco: 46, custo: 19.2, cmv: 41.7, grupo: "Pizzas", subgrupo: "Tradicionais" },
  { codigo: "2001", "produto do cardapio": "Risoto Funghi", praca: "Salao", preco: 54, custo: 21.4, cmv: 39.6, grupo: "Cozinha", subgrupo: "Principais" },
  { codigo: "3001", "produto do cardapio": "Limonada", praca: "Bar", preco: 14, custo: 4.8, cmv: 34.3, grupo: "Bebidas", subgrupo: "Sem alcool" }
];

const sampleDashboard = buildDashboardData(mapSalesRows(sampleSales), mapRecipeRows(sampleRecipes), [
  { level: "subgroup", label: "TOTAL SUBGRUPO", group: "Pizzas", subgroup: "Tradicionais", quantity: 77, revenue: 3374 },
  { level: "group", label: "TOTAL GRUPO", group: "Pizzas", subgroup: "", quantity: 77, revenue: 3374 },
  { level: "general", label: "TOTAL GERAL", group: "", subgroup: "", quantity: 124, revenue: 4752 }
], {
  rawLabel: "ABERT.: 01/03/26 | FECH.: 29/03/26",
  startDate: "01/03/26",
  endDate: "29/03/26",
  displayLabel: "01/03/26 a 29/03/26",
  periodKey: "2026-03",
  periodLabel: "Mar/2026",
  month: 3,
  year: 2026
});

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

type InviteFormState = {
  email: string;
  featureIds: string[];
  restaurantIds: string[];
};

type InternalSection = "account" | "dashboard" | "restaurants" | "team";

const TOTAL_VIEW = "__TOTAL__";
const TOTAL_PERIOD = "__ALL_PERIODS__";
const DEFAULT_INVITE_FEATURE = "cmv_dashboard";
const ACTIVE_RESTAURANT_STORAGE_PREFIX = "grest.activeRestaurant.";
const AUTH_BOOT_TIMEOUT_MS = 30000;
const INTERNAL_SECTIONS: InternalSection[] = ["dashboard", "account", "restaurants", "team"];

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
    authEyebrow: "Acesso por restaurante",
    authTitle: "Login seguro para cada restaurante.",
    authText: "Entre, acompanhe o histórico e continue a operação no mesmo ambiente.",
    authLoginTab: "Entrar",
    authRegisterTab: "Criar acesso",
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
    navRestaurants: "Restaurantes",
    navTeam: "Equipe e permissões",
    teamTitle: "Equipe e permissões",
    teamText: "Veja quem tem acesso à conta e qual é o papel de cada pessoa.",
    teamEmpty: "Nenhum membro adicional foi encontrado nesta conta.",
    teamAccessModel: "Modelo de acesso",
    teamAccessModelText: "Owner é global, Admin administra a conta e usuários comuns acessam apenas o que receberem.",
    teamMembersTotal: "Pessoas com acesso",
    teamAdminsTotal: "Admins da conta",
    teamUsersTotal: "Usuários comuns",
    teamRestaurantsTotal: "Restaurantes cobertos",
    teamAccountRole: "Papel na conta",
    teamRestaurantAccess: "Acesso aos restaurantes",
    teamNoRestaurants: "Nenhum restaurante vinculado",
    teamYou: "Você",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "Admin",
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
    authRoleAdmin: "Admin",
    authRoleViewer: "Leitura",
    authReadOnlyTitle: "Acesso somente leitura",
    authReadOnlyText: "Sua conta pode consultar os dados deste restaurante, mas não pode importar ou alterar informações.",
    authManageOnly: "Apenas usuários admin ou owner podem importar relatórios e editar esta base.",
    authSettingsRestricted: "Apenas admin ou owner podem editar os dados deste restaurante.",
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
    processing: "Procesando archivos y actualizando el panel...",
    success: "Archivos procesados con \u00e9xito.",
    authLoginTab: "Ingresar",
    authRegisterTab: "Crear acceso",
    authRestaurantName: "Restaurante",
    authEmail: "Correo",
    authPassword: "Contrase\u00f1a",
    authSubmitLogin: "Entrar al panel",
    authSubmitRegister: "Crear cuenta",
    authLogout: "Salir",
    authSupabaseReady: "Modo online activo con Supabase.",
    authSupabaseSetup: "Modo local temporal. Configure las variables de Supabase para acceso online real.",
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
    navRestaurants: "Restaurantes",
    navTeam: "Equipo y permisos",
    teamTitle: "Equipo y permisos",
    teamText: "Consulta quién tiene acceso a la cuenta y qué papel ocupa cada persona.",
    teamEmpty: "No se encontraron miembros adicionales en esta cuenta.",
    teamAccessModel: "Modelo de acceso",
    teamAccessModelText: "Owner es global, Admin gestiona la cuenta y los usuarios comunes acceden solo a lo que reciban.",
    teamMembersTotal: "Personas con acceso",
    teamAdminsTotal: "Admins de la cuenta",
    teamUsersTotal: "Usuarios comunes",
    teamRestaurantsTotal: "Restaurantes cubiertos",
    teamAccountRole: "Rol en la cuenta",
    teamRestaurantAccess: "Acceso a restaurantes",
    teamNoRestaurants: "Sin restaurantes vinculados",
    teamYou: "Tú",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "Admin",
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
    processing: "Processing files and updating the dashboard...",
    success: "Files processed successfully.",
    authLoginTab: "Sign in",
    authRegisterTab: "Create access",
    authRestaurantName: "Restaurant name",
    authEmail: "Email",
    authPassword: "Password",
    authSubmitLogin: "Open dashboard",
    authSubmitRegister: "Create account",
    authLogout: "Sign out",
    authSupabaseReady: "Online mode is active with Supabase.",
    authSupabaseSetup: "Temporary local mode. Configure the Supabase environment variables for real remote access.",
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
    navRestaurants: "Restaurants",
    navTeam: "Team and permissions",
    teamTitle: "Team and permissions",
    teamText: "Review who has access to this account and the role assigned to each person.",
    teamEmpty: "No additional members were found in this account.",
    teamAccessModel: "Access model",
    teamAccessModelText: "Owner is global, Admin manages the account and common users access only what they receive.",
    teamMembersTotal: "People with access",
    teamAdminsTotal: "Account admins",
    teamUsersTotal: "Common users",
    teamRestaurantsTotal: "Covered restaurants",
    teamAccountRole: "Account role",
    teamRestaurantAccess: "Restaurant access",
    teamNoRestaurants: "No linked restaurants",
    teamYou: "You",
    teamRoleOwner: "Owner",
    teamRoleAdmin: "Admin",
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

const isInternalSection = (value: string | undefined): value is InternalSection =>
  Boolean(value && INTERNAL_SECTIONS.includes(value as InternalSection));

const applyActiveRestaurant = (session: AuthSession, restaurantId?: string): AuthSession => {
  const memberships = session.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.restaurantId === restaurantId) ??
    memberships.find((membership) => membership.restaurantId === session.activeRestaurantId) ??
    memberships[0];

  if (!activeMembership) {
    return session;
  }

  return {
    ...session,
    activeRole: activeMembership.role,
    activeRestaurantId: activeMembership.restaurantId,
    activeRestaurantName: activeMembership.restaurantName,
    activeRestaurantPhotoUrl: activeMembership.photoUrl,
    restaurantId: activeMembership.restaurantId,
    restaurantName: activeMembership.restaurantName,
    profilePhotoUrl: activeMembership.photoUrl
  };
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

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M12 16V7" />
      <path d="M8.5 10.5 12 7l3.5 3.5" />
      <path d="M5 18.5h14" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M5 18.5h14" />
      <path d="M8 18.5v-6" />
      <path d="M12 18.5v-9" />
      <path d="M16 18.5v-4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M12 4l6 2.5v5.5c0 3.8-2.5 6.9-6 8-3.5-1.1-6-4.2-6-8V6.5L12 4Z" />
      <path d="m9.5 12 1.7 1.8L14.8 10" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M7 4.5v3" />
      <path d="M17 4.5v3" />
      <path d="M5 9.5h14" />
      <rect x="4.5" y="6.5" width="15" height="13" rx="3" />
    </svg>
  );
}

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

function IconAsset({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="icon-chip-image" />;
}

function BrandMark() {
  const { t } = useLocale();
  return (
    <div className="brand-mark" aria-label="G/REST">
      <div className="brand-logo-frame brand-logo-cutout">
        <img src="/grest.png" alt="G/REST" className="brand-logo-image" />
      </div>
      <div className="brand-wordmark">
        <span className="brand-name">G/REST</span>
        <span className="brand-tagline">{String(t("brandTagline"))}</span>
      </div>
    </div>
  );
}

function HeroHighlights() {
  const { t } = useLocale();
  const items = [
    {
      icon: <IconUpload />,
      title: String(t("uploadOriented")),
      text: String(t("uploadOrientedText"))
    },
    {
      icon: <IconChart />,
      title: String(t("executiveReading")),
      text: String(t("executiveReadingText"))
    },
    {
      icon: <IconCalendar />,
      title: String(t("competenceBase")),
      text: String(t("competenceBaseText"))
    },
    {
      icon: <IconShield />,
      title: String(t("prioritizedActions")),
      text: String(t("prioritizedActionsText"))
    }
  ];

  return (
    <div className="hero-highlights">
      {items.map((item) => (
        <article key={item.title} className="hero-highlight-card">
          <span className="icon-chip">{item.icon}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProcessPanel() {
  const { t } = useLocale();
  const steps = [
    {
      icon: <IconAsset src="/vendas.svg" alt="Vendas" />,
      title: String(t("ownerFlowSales")),
      text: String(t("ownerFlowSalesText"))
    },
    {
      icon: <IconAsset src="/ficha-tecnica.png" alt="Fichas técnicas" />,
      title: String(t("ownerFlowRecipes")),
      text: String(t("ownerFlowRecipesText"))
    },
    {
      icon: <IconAsset src="/analise.svg" alt="Análise" />,
      title: String(t("ownerFlowRead")),
      text: String(t("ownerFlowReadText"))
    }
  ];

  return (
    <section className="card process-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{String(t("processEyebrow"))}</span>
          <h3>{String(t("ownerFlowTitle"))}</h3>
          <p>{String(t("ownerFlowText"))}</p>
        </div>
      </div>

      <div className="process-grid">
        {steps.map((step) => (
          <article key={step.title} className="process-card">
            <span className="icon-chip soft">{step.icon}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LanguageSwitcher({
  locale,
  onChange
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  const { t } = useLocale();
  const options: Array<{ value: Locale; label: string }> = [
    { value: "pt", label: "PT" },
    { value: "es", label: "ES" },
    { value: "en", label: "EN" }
  ];

  return (
    <div className="language-switcher" aria-label={String(t("language"))}>
      <span className="eyebrow">{String(t("language"))}</span>
      <div className="language-switcher-pills">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`language-pill ${locale === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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

function PeriodBanner({
  period,
  selectedPeriod,
  dashboards
}: {
  period?: DashboardData["reportPeriod"];
  selectedPeriod: string;
  dashboards: PeriodDashboard[];
}) {
  const { t } = useLocale();
  if (!period && dashboards.length === 0) {
    return null;
  }

  const isTotal = selectedPeriod === TOTAL_PERIOD;
  const title = isTotal
    ? dashboards.length > 1
      ? (t("importedPeriods") as (count: number) => string)(dashboards.length)
      : dashboards[0]
        ? getPeriodLabel(dashboards[0])
        : String(t("periodImported"))
    : period?.displayLabel ?? String(t("periodImported"));
  const description = isTotal
    ? dashboards.map((dashboard) => getPeriodLabel(dashboard)).join(" • ")
    : period?.rawLabel ?? "";

  return (
    <section className="card compact-card period-banner">
      <div>
        <span className="eyebrow">{isTotal ? String(t("consolidatedBase")) : String(t("periodImported"))}</span>
        <strong>{title}</strong>
      </div>
      <p>{description}</p>
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

function AuthHighlights() {
  const { t } = useLocale();
  const items = [
    {
      icon: <IconAsset src="/organizacao.svg" alt="Organização" />,
      title: String(t("homeHeroStat1")),
      text: String(t("homeHeroStat1Text"))
    },
    {
      icon: <IconAsset src="/segundo.svg" alt="Agilidade" />,
      title: String(t("homeHeroStat2")),
      text: String(t("homeHeroStat2Text"))
    },
    {
      icon: <IconAsset src="/clareza.svg" alt="Clareza" />,
      title: String(t("homeHeroStat3")),
      text: String(t("homeHeroStat3Text"))
    }
  ];

  return (
    <div className="auth-highlights">
      {items.map((item) => (
        <article key={item.title} className="auth-highlight-card">
          <span className="icon-chip soft">{item.icon}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfileAvatar({
  session,
  size = "md"
}: {
  session: AuthSession;
  size?: "sm" | "md" | "lg";
}) {
  const classes = `profile-avatar ${size} ${session.profilePhotoUrl ? "has-photo" : ""}`;
  const restaurantLabel = session.restaurantName ?? session.activeRestaurantName ?? "Restaurante";

  return (
    <div className={classes} aria-hidden="true">
      {session.profilePhotoUrl ? (
        <img src={session.profilePhotoUrl} alt={restaurantLabel} />
      ) : (
        <img src="/grest.png" alt="G/REST" className="brand-logo-image cutout" />
      )}
    </div>
  );
}

function UserAvatar({
  session,
  size = "md"
}: {
  session: AuthSession;
  size?: "sm" | "md" | "lg";
}) {
  const classes = `profile-avatar ${size} ${session.userPhotoUrl ? "has-photo" : ""}`;
  const userLabel = session.userFullName?.trim() || session.email || "Usuário";

  return (
    <div className={classes}>
      {session.userPhotoUrl ? (
        <img src={session.userPhotoUrl} alt={userLabel} />
      ) : (
        <span>{userLabel.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
      <path d="M19.4 12a7.6 7.6 0 0 0-.1-1.1l2-1.5-1.9-3.2-2.4 1a8.6 8.6 0 0 0-1.9-1.1l-.4-2.6H10l-.4 2.6c-.7.2-1.3.6-1.9 1.1l-2.4-1-1.9 3.2 2 1.5a7.6 7.6 0 0 0 0 2.2l-2 1.5 1.9 3.2 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.6h3.8l.4-2.6c.7-.2 1.3-.6 1.9-1.1l2.4 1 1.9-3.2-2-1.5c.1-.4.1-.8.1-1.1Z" />
    </svg>
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

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M8 7.5 9.2 5h5.6L16 7.5h2.5A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17v-7A2.5 2.5 0 0 1 5.5 7.5H8Z" />
      <path d="M12 9.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
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

function IconDashboardNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="4" rx="2" />
      <rect x="13" y="10" width="7" height="10" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

function IconBuildingNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M5 20V6.5c0-.8.4-1.4 1.1-1.7l5.3-2.1c.8-.3 1.6.3 1.6 1.1V20" />
      <path d="M13 20V10.4c0-.7.6-1.3 1.3-1.3H18c.6 0 1 .4 1 1V20" />
      <path d="M8 8h2" />
      <path d="M8 11.5h2" />
      <path d="M8 15h2" />
      <path d="M15.5 12.5h1.5" />
      <path d="M15.5 15.5h1.5" />
    </svg>
  );
}

function IconUsersNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M4.5 19.5c0-2.7 2.4-4.5 5.5-4.5s5.5 1.8 5.5 4.5" />
      <path d="M14.5 19.5c.2-1.9 1.9-3.2 4.2-3.2 1 0 1.9.2 2.8.7" />
    </svg>
  );
}

function UploadFeedbackPanel({
  items,
  periods,
  onRemovePeriod
}: {
  items: UploadFeedbackItem[];
  periods: PeriodDashboard[];
  onRemovePeriod: (periodKey: string) => void;
}) {
  if (items.length === 0 && periods.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>Base carregada</h3>
          <p>Acompanhe os arquivos processados e remova um mês específico sem reiniciar toda a análise.</p>
        </div>
      </div>

      {periods.length > 0 ? (
        <div className="loaded-periods">
          {periods.map((period) => (
            <div key={period.key} className="loaded-period-card">
              <div>
                <span className="eyebrow">Competência</span>
                <strong>{period.label}</strong>
              </div>
              <button type="button" className="ghost-button" onClick={() => onRemovePeriod(period.key)}>
                Remover mês
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="issue-grid">
          {items.map((item) => (
            <article key={item.id} className={`issue-card ${item.status === "error" ? "danger" : item.status === "success" ? "good" : "info"}`}>
              <span className="eyebrow">{item.kind === "sales" ? "Arquivo de vendas" : "Ficha técnica"}</span>
              <strong>{item.fileName}</strong>
              <p>
                {item.status === "pending" ? "Processando arquivo..." : item.status === "success" ? "Arquivo processado com sucesso." : item.detail ?? "Falha no processamento."}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
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
          <circle cx={cx} cy={cy} r={innerRadius - 6} fill="#fff8ef" />
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

function AuthScreen({
  locale,
  onChangeLocale,
  onLogin,
  onRegister,
  error,
  isCloudEnabled,
  busy
}: {
  locale: Locale;
  onChangeLocale: (locale: Locale) => void;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onRegister: (fullName: string, email: string, password: string) => void | Promise<void>;
  error?: string;
  isCloudEnabled: boolean;
  busy?: boolean;
}) {
  const { t } = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    if (mode === "login") {
      await onLogin(email, password);
      return;
    }

    await onRegister(fullName, email, password);
  };

  return (
    <div className="app-shell refined auth-shell">
      <section className="hero refined-hero auth-hero">
        <div className="hero-copy">
          <BrandMark />
          <div className="hero-copy-block">
            <span className="eyebrow">{String(t("authEyebrow"))}</span>
            <h1>{String(t("authTitle"))}</h1>
            <p>{String(t("authText"))}</p>
          </div>
          <AuthHighlights />
        </div>

        <div className="hero-side">
          <div className="hero-panel auth-panel">
            <LanguageSwitcher locale={locale} onChange={onChangeLocale} />

            <div className="auth-tabs">
              <button
                type="button"
                className={`language-pill ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
              >
                {String(t("authLoginTab"))}
              </button>
              <button
                type="button"
                className={`language-pill ${mode === "register" ? "active" : ""}`}
                onClick={() => setMode("register")}
              >
                {String(t("authRegisterTab"))}
              </button>
            </div>

            <div className="auth-form">
              {mode === "register" ? (
                <label className="auth-field">
                  <span>{String(t("authFullName"))}</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ex: João Silva" />
                  <small>{String(t("authFullNameHint"))}</small>
                </label>
              ) : null}

              <label className="auth-field">
                <span>{String(t("authEmail"))}</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="contato@restaurante.com" />
              </label>

              <label className="auth-field">
                <span>{String(t("authPassword"))}</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••" />
              </label>

              {error ? <p className="message error">{error}</p> : null}

              <button type="button" className="primary-button" onClick={() => void handleSubmit()} disabled={busy}>
                {busy ? String(t("processing")) : mode === "login" ? String(t("authSubmitLogin")) : String(t("authSubmitRegister"))}
              </button>

              <p className="message">{isCloudEnabled ? String(t("authSupabaseReady")) : String(t("authSupabaseSetup"))}</p>
              {!isCloudEnabled ? <p className="message">{String(t("authHelp"))}</p> : null}
              {!isCloudEnabled ? <p className="message">{String(t("authDemoHint"))}</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceHeader({
  session,
  onLogout,
  onOpenSettings,
  canOpenSettings
}: {
  session: AuthSession;
  onLogout: () => void;
  onOpenSettings: () => void;
  canOpenSettings: boolean;
}) {
  const { t } = useLocale();

  return (
    <section className="card workspace-header">
      <div className="workspace-copy">
        <UserAvatar session={session} size="lg" />
        <span className="eyebrow">{String(t("authUserProfile"))}</span>
        <h2>{session.userFullName ?? session.email}</h2>
        <p>{String(t("authUserProfileText"))}</p>
      </div>
      <div className="workspace-actions">
        <div className="workspace-badge">
          <strong>{session.userFullName ?? String(t("authGreeting"))}</strong>
          <span>{session.email}</span>
          <span>{session.memberships?.length ?? 0} restaurante(s)</span>
        </div>
        {canOpenSettings ? (
          <button type="button" className="ghost-button" onClick={onOpenSettings}>
            {String(t("authSettings"))}
          </button>
        ) : null}
        <button type="button" className="ghost-button" onClick={onLogout}>
          {String(t("authLogout"))}
        </button>
      </div>
    </section>
  );
}

function DashboardShellHeader({
  session,
  section,
  locale,
  onChangeLocale
}: {
  session: AuthSession;
  section: InternalSection;
  locale: Locale;
  onChangeLocale: (locale: Locale) => void;
}) {
  const { t } = useLocale();
  const copyBySection: Record<Exclude<InternalSection, "account">, { eyebrow: string; title: string; text: string }> = {
    dashboard: {
      eyebrow: String(t("navDashboard")),
      title: session.activeRestaurantName ?? session.restaurantName ?? String(t("navDashboard")),
      text:
        session.activeRole === "owner"
          ? "Visão executiva completa para leitura, upload e tomada de decisão."
          : "Acompanhe os indicadores e o desempenho da unidade selecionada."
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

  const activeSection = section === "account" ? "dashboard" : section;
  const copy = copyBySection[activeSection];

  return (
    <section className="card workspace-topbar dashboard-shell-topbar">
      <div className="dashboard-shell-heading">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1>Olá, {session.userFullName ?? session.email}!</h1>
        <strong className="dashboard-shell-subtitle">{copy.title}</strong>
        <p>{copy.text}</p>
      </div>

      <div className="dashboard-shell-topbar-actions">
        <LanguageSwitcher locale={locale} onChange={onChangeLocale} />
      </div>
    </section>
  );
}

function AccountSettingsPanel({
  session,
  userForm,
  restaurantForm,
  newRestaurantName,
  busy,
  message,
  error,
  onClose,
  onUserNameChange,
  onRestaurantNameChange,
  onUserPhotoSelect,
  onRestaurantPhotoSelect,
  onCreateRestaurantNameChange,
  onSaveUser,
  onSaveRestaurant,
  onCreateRestaurant,
  onDeleteRestaurant,
  onDeleteAccount,
  onActivateRestaurant,
  canManageRestaurants
}: {
  session: AuthSession;
  userForm: UserProfileFormState;
  restaurantForm: ProfileFormState;
  newRestaurantName: string;
  busy: boolean;
  message?: string;
  error?: string;
  onClose: () => void;
  onUserNameChange: (value: string) => void;
  onRestaurantNameChange: (value: string) => void;
  onUserPhotoSelect: (file: File | null) => void;
  onRestaurantPhotoSelect: (file: File | null) => void;
  onCreateRestaurantNameChange: (value: string) => void;
  onSaveUser: () => void;
  onSaveRestaurant: () => void;
  onCreateRestaurant: () => void;
  onDeleteRestaurant: (restaurantId: string) => void;
  onDeleteAccount: () => void;
  onActivateRestaurant: (restaurantId: string) => void;
  canManageRestaurants: boolean;
}) {
  const { t } = useLocale();

  return (
    <section className="card account-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{String(t("authSettings"))}</span>
          <h3>{String(t("authSettings"))}</h3>
          <p>{String(t("authSettingsText"))}</p>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          {String(t("authClose"))}
        </button>
      </div>

      <div className="account-panel-stack">
        <section className="account-user-section">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">{String(t("authUserProfile"))}</span>
              <h3>{String(t("authUserProfile"))}</h3>
              <p>{String(t("authUserProfileText"))}</p>
            </div>
          </div>

          <div className="account-user-grid">
            <section className="account-identity-card">
              <div className="account-avatar-panel">
                <UserAvatar
                  session={{
                    ...session,
                    userFullName: userForm.fullName,
                    userPhotoUrl: userForm.userPhotoUrl
                  }}
                  size="lg"
                />
                <div>
                  <strong>{String(t("authUserProfile"))}</strong>
                  <p>{String(t("authUserProfileText"))}</p>
                </div>
              </div>

              <label className="upload-box compact-upload">
                <div className="upload-box-top">
                  <span className="upload-order">{String(t("authProfilePhoto"))}</span>
                  <span className="upload-status ready">{busy ? String(t("processing")) : String(t("authUploadPhoto"))}</span>
                </div>
                <strong className="upload-title">{userForm.userPhotoUrl ? (userForm.fullName || session.email) : String(t("authUploadPhoto"))}</strong>
                <small>{String(t("authUserProfileText"))}</small>
                <div className="upload-box-footer">
                  <span className="upload-action">{String(t("authUploadPhoto"))}</span>
                  <span className="upload-meta">.png .jpg .jpeg</span>
                </div>
                <input
                  className="upload-input-hidden"
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={(event) => onUserPhotoSelect(event.target.files?.[0] ?? null)}
                />
              </label>
            </section>

            <section className="account-form-card">
              <label className="auth-field">
                <span>{String(t("authFullName"))}</span>
                <input value={userForm.fullName} onChange={(event) => onUserNameChange(event.target.value)} />
              </label>

              <label className="auth-field">
                <span>{String(t("authEmail"))}</span>
                <input value={session.email} disabled />
              </label>

              <div className="user-status-grid">
                <article className="mini-stat-card">
                  <span>{String(t("authAccountStatus"))}</span>
                  <strong>{session.activeRole === "owner" ? String(t("authRoleOwner")) : session.activeRole === "admin" ? String(t("authRoleAdmin")) : String(t("authRoleViewer"))}</strong>
                </article>
                <article className="mini-stat-card">
                  <span>{String(t("authRestaurantsCount"))}</span>
                  <strong>{String(session.memberships?.length ?? 0)}</strong>
                </article>
              </div>

              {message ? <p className="message success">{message}</p> : null}
              {error ? <p className="message error">{error}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onSaveUser} disabled={busy}>
                  {String(t("authSaveProfile"))}
                </button>
              </div>
            </section>
          </div>
        </section>

        {canManageRestaurants ? (
        <section className="account-restaurant-section">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">{String(t("authManageRestaurants"))}</span>
              <h3>{String(t("authManageRestaurants"))}</h3>
              <p>{String(t("authManageRestaurantsText"))}</p>
            </div>
          </div>

          <div className="account-panel-grid">
            <section className="account-form-card">
              <div className="account-avatar-panel">
                <ProfileAvatar
                  session={{
                    ...session,
                    restaurantName: restaurantForm.restaurantName,
                    profilePhotoUrl: restaurantForm.profilePhotoUrl
                  }}
                  size="lg"
                />
                <div>
                  <strong>{String(t("authRestaurantProfile"))}</strong>
                  <p>{String(t("authRestaurantProfileText"))}</p>
                </div>
              </div>

              <label className="upload-box compact-upload">
                <div className="upload-box-top">
                  <span className="upload-order">{String(t("authProfilePhoto"))}</span>
                  <span className="upload-status ready">{busy ? String(t("processing")) : String(t("authUploadPhoto"))}</span>
                </div>
                <strong className="upload-title">{restaurantForm.profilePhotoUrl ? restaurantForm.restaurantName : String(t("authUploadPhoto"))}</strong>
                <small>{String(t("authRestaurantProfileText"))}</small>
                <div className="upload-box-footer">
                  <span className="upload-action">{String(t("authUploadPhoto"))}</span>
                  <span className="upload-meta">.png .jpg .jpeg</span>
                </div>
                <input
                  className="upload-input-hidden"
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={(event) => onRestaurantPhotoSelect(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="auth-field">
                <span>{String(t("authRestaurantName"))}</span>
                <input value={restaurantForm.restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} />
              </label>

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onSaveRestaurant} disabled={busy}>
                  {String(t("authSaveProfile"))}
                </button>
              </div>
            </section>

            <section className="account-form-card restaurant-management-card">
              <div className="restaurant-member-list">
                {(session.memberships ?? []).map((membership) => {
                  const isActive = membership.restaurantId === session.activeRestaurantId;
                  const canDeleteThisRestaurant = membership.role === "owner" && (session.memberships?.length ?? 0) > 1;

                  return (
                    <article key={membership.membershipId} className={`restaurant-member-card ${isActive ? "active" : ""}`}>
                      <div>
                        <strong>{membership.restaurantName}</strong>
                        <p>{membership.role === "owner" ? String(t("authRoleOwner")) : membership.role === "admin" ? String(t("authRoleAdmin")) : String(t("authRoleViewer"))}</p>
                      </div>
                      <div className="restaurant-member-actions">
                        {!isActive ? (
                          <button type="button" className="ghost-button" onClick={() => onActivateRestaurant(membership.restaurantId)}>
                            {String(t("authActivate"))}
                          </button>
                        ) : null}
                        {canDeleteThisRestaurant ? (
                          <button
                            type="button"
                            className="ghost-button danger-button"
                            onClick={() => onDeleteRestaurant(membership.restaurantId)}
                            disabled={busy}
                          >
                            {String(t("authDeleteRestaurant"))}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="restaurant-create-box">
                <div>
                  <strong>{String(t("authCreateRestaurant"))}</strong>
                  <p>{String(t("authCreateRestaurantText"))}</p>
                </div>
                <label className="auth-field">
                  <span>{String(t("authRestaurantName"))}</span>
                  <input value={newRestaurantName} onChange={(event) => onCreateRestaurantNameChange(event.target.value)} />
                </label>
                <div className="panel-actions">
                  <button type="button" className="primary-button" onClick={onCreateRestaurant} disabled={busy}>
                    {String(t("authCreateRestaurantAction"))}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
        ) : null}

        <section className="danger-panel">
          <div className="danger-panel-copy">
            <span className="eyebrow">{String(t("authDangerZone"))}</span>
            <strong>{String(t("authDeleteAccount"))}</strong>
            <p>{String(t("authDeleteHint"))}</p>
          </div>
          <button type="button" className="ghost-button danger-button" onClick={onDeleteAccount} disabled={busy}>
            {String(t("authDeleteAccount"))}
          </button>
        </section>
      </div>
    </section>
  );
}

function RestaurantNavigatorPanel({
  session,
  onActivateRestaurant
}: {
  session: AuthSession;
  onActivateRestaurant: (restaurantId: string) => void;
}) {
  const { t } = useLocale();

  return (
    <section className="card restaurant-overview-panel">
      <div className="section-head compact">
        <div>
          <span className="eyebrow">{String(t("authRestaurantNavigator"))}</span>
          <h3>{String(t("authRestaurantNavigator"))}</h3>
          <p>{String(t("authRestaurantNavigatorText"))}</p>
        </div>
      </div>

      <div className="restaurant-navigator-grid">
        {(session.memberships ?? []).map((membership) => {
          const isActive = membership.restaurantId === session.activeRestaurantId;

          return (
            <button
              key={membership.membershipId}
              type="button"
              className={`restaurant-tile ${isActive ? "active" : ""}`}
              onClick={() => onActivateRestaurant(membership.restaurantId)}
            >
              <div className={`restaurant-tile-avatar ${membership.photoUrl ? "has-photo" : ""}`}>
                {membership.photoUrl ? (
                  <img src={membership.photoUrl} alt={membership.restaurantName} />
                ) : (
                  <span>{membership.restaurantName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="restaurant-tile-copy">
                <strong>{membership.restaurantName}</strong>
                <span>
                  {membership.role === "owner"
                    ? String(t("authRoleOwner"))
                    : membership.role === "admin"
                      ? String(t("authRoleAdmin"))
                      : String(t("authRoleViewer"))}
                </span>
              </div>
              <span className={`status ${isActive ? "ok" : ""}`}>
                {isActive ? String(t("authActive")) : String(t("authActivate"))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RestaurantManagementPanel({
  session,
  restaurantForm,
  newRestaurantName,
  busy,
  message,
  error,
  onRestaurantNameChange,
  onRestaurantPhotoSelect,
  onCreateRestaurantNameChange,
  onSaveRestaurant,
  onCreateRestaurant,
  onDeleteRestaurant,
  onActivateRestaurant
}: {
  session: AuthSession;
  restaurantForm: ProfileFormState;
  newRestaurantName: string;
  busy: boolean;
  message?: string;
  error?: string;
  onRestaurantNameChange: (value: string) => void;
  onRestaurantPhotoSelect: (file: File | null) => void;
  onCreateRestaurantNameChange: (value: string) => void;
  onSaveRestaurant: () => void;
  onCreateRestaurant: () => void;
  onDeleteRestaurant: (restaurantId: string) => void;
  onActivateRestaurant: (restaurantId: string) => void;
}) {
  const { t } = useLocale();

  return (
    <section className="card account-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{String(t("authManageRestaurants"))}</span>
          <h3>{String(t("authManageRestaurants"))}</h3>
          <p>{String(t("authManageRestaurantsText"))}</p>
        </div>
      </div>

      <div className="account-panel-grid">
        <section className="account-form-card">
          <div className="account-avatar-panel">
            <ProfileAvatar
              session={{
                ...session,
                restaurantName: restaurantForm.restaurantName,
                profilePhotoUrl: restaurantForm.profilePhotoUrl
              }}
              size="lg"
            />
            <div>
              <strong>{String(t("authRestaurantProfile"))}</strong>
              <p>{String(t("authRestaurantProfileText"))}</p>
            </div>
          </div>

          <label className="upload-box compact-upload">
            <div className="upload-box-top">
              <span className="upload-order">{String(t("authProfilePhoto"))}</span>
              <span className="upload-status ready">{busy ? String(t("processing")) : String(t("authUploadPhoto"))}</span>
            </div>
            <strong className="upload-title">{restaurantForm.profilePhotoUrl ? restaurantForm.restaurantName : String(t("authUploadPhoto"))}</strong>
            <small>{String(t("authRestaurantProfileText"))}</small>
            <div className="upload-box-footer">
              <span className="upload-action">{String(t("authUploadPhoto"))}</span>
              <span className="upload-meta">.png .jpg .jpeg</span>
            </div>
            <input
              className="upload-input-hidden"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => onRestaurantPhotoSelect(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="auth-field">
            <span>{String(t("authRestaurantName"))}</span>
            <input value={restaurantForm.restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} />
          </label>

          {message ? <p className="message success">{message}</p> : null}
          {error ? <p className="message error">{error}</p> : null}

          <div className="panel-actions">
            <button type="button" className="primary-button" onClick={onSaveRestaurant} disabled={busy}>
              {String(t("authSaveProfile"))}
            </button>
          </div>
        </section>

        <section className="account-form-card restaurant-management-card">
          <div className="restaurant-member-list">
            {(session.memberships ?? []).map((membership) => {
              const isActive = membership.restaurantId === session.activeRestaurantId;
              const canDeleteThisRestaurant = membership.role === "owner" && (session.memberships?.length ?? 0) > 1;

              return (
                <article
                  key={membership.membershipId}
                  className={`restaurant-member-card ${isActive ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onActivateRestaurant(membership.restaurantId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActivateRestaurant(membership.restaurantId);
                    }
                  }}
                >
                  <div>
                    <strong>{membership.restaurantName}</strong>
                    <p>{membership.role === "owner" ? String(t("authRoleOwner")) : membership.role === "admin" ? String(t("authRoleAdmin")) : String(t("authRoleViewer"))}</p>
                  </div>
                  <div className="restaurant-member-actions">
                    <span className={`status ${isActive ? "ok" : ""}`}>
                      {isActive ? String(t("authActive")) : String(t("authActivate"))}
                    </span>
                    {canDeleteThisRestaurant ? (
                      <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRestaurant(membership.restaurantId);
                        }}
                        disabled={busy}
                      >
                        {String(t("authDeleteRestaurant"))}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="restaurant-create-box">
            <div>
              <strong>{String(t("authCreateRestaurant"))}</strong>
              <p>{String(t("authCreateRestaurantText"))}</p>
            </div>
            <label className="auth-field">
              <span>{String(t("authRestaurantName"))}</span>
              <input value={newRestaurantName} onChange={(event) => onCreateRestaurantNameChange(event.target.value)} />
            </label>
            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={onCreateRestaurant} disabled={busy}>
                {String(t("authCreateRestaurantAction"))}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function InternalNavigation({
  section,
  onChange,
  canManageRestaurants
}: {
  section: InternalSection;
  onChange: (section: InternalSection) => void;
  canManageRestaurants: boolean;
}) {
  const { t } = useLocale();

  const items: { key: InternalSection; label: string; icon: JSX.Element }[] = [
    { key: "dashboard", label: String(t("navDashboard")), icon: <IconDashboardNav /> },
    ...(canManageRestaurants
      ? [{ key: "restaurants" as InternalSection, label: String(t("navRestaurants")), icon: <IconBuildingNav /> }]
      : []),
    { key: "team", label: String(t("navTeam")), icon: <IconUsersNav /> }
  ];

  return (
    <nav className="internal-sidebar-nav" aria-label="Navegação principal">
      <div className="internal-sidebar-nav-list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-nav-item ${section === item.key ? "active" : ""}`}
            onClick={() => onChange(item.key)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-text">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function TeamMemberCard({
  session,
  member,
  canManageTeam,
  onSave,
  onRemove
}: {
  session: AuthSession;
  member: AccountMember;
  canManageTeam: boolean;
  onSave: (input: {
    member: AccountMember;
    accountRole: "admin" | "user";
    restaurantRole: "admin" | "viewer";
    restaurantIds: string[];
  }) => Promise<void>;
  onRemove: (member: AccountMember) => Promise<void>;
}) {
  const { t } = useLocale();
  const [featureIds, setFeatureIds] = useState<string[]>([DEFAULT_INVITE_FEATURE]);
  const [restaurantIds, setRestaurantIds] = useState<string[]>(member.restaurants.map((restaurant) => restaurant.restaurantId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setFeatureIds([DEFAULT_INVITE_FEATURE]);
    setRestaurantIds(member.restaurants.map((restaurant) => restaurant.restaurantId));
    setMessage(undefined);
    setError(undefined);
  }, [member]);

  const formatAccountRole = (role: AccountMember["role"]) => {
    if (role === "owner") {
      return String(t("teamRoleOwner"));
    }

    if (role === "admin") {
      return String(t("teamRoleAdmin"));
    }

    return String(t("teamRoleUser"));
  };

  const formatRestaurantRole = (role: "owner" | "admin" | "viewer") => {
    if (role === "owner") {
      return String(t("teamRoleOwner"));
    }

    if (role === "admin") {
      return String(t("teamRoleAdmin"));
    }

    return String(t("teamRoleViewer"));
  };

  const canEditMember =
    canManageTeam &&
    member.userId !== session.userId &&
    member.role === "user" &&
    !member.restaurants.some((restaurant) => restaurant.role === "owner" || restaurant.role === "admin");

  const hasChanges =
    JSON.stringify([...featureIds].sort()) !== JSON.stringify([DEFAULT_INVITE_FEATURE]) ||
    JSON.stringify([...restaurantIds].sort()) !==
      JSON.stringify(member.restaurants.map((restaurant) => restaurant.restaurantId).sort());

  const handleRestaurantToggle = (restaurantId: string) => {
    setRestaurantIds((current) =>
      current.includes(restaurantId) ? current.filter((id) => id !== restaurantId) : [...current, restaurantId]
    );
  };

  const handleFeatureToggle = (featureId: string) => {
    setFeatureIds((current) =>
      current.includes(featureId) ? current.filter((id) => id !== featureId) : [...current, featureId]
    );
  };

  const handleSave = async () => {
    try {
      setBusy(true);
      setError(undefined);
      setMessage(undefined);
      if (featureIds.length === 0) {
        throw new Error("Selecione ao menos uma funcionalidade.");
      }
      await onSave({
        member,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds
      });
      setMessage(String(t("teamMemberUpdated")));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(t("teamMemberImmutable")));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    try {
      setBusy(true);
      setError(undefined);
      setMessage(undefined);
      await onRemove(member);
      setMessage(String(t("teamMemberRemoved")));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(t("teamMemberImmutable")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="team-member-card">
      <div className="team-member-head">
        <div className="team-member-identity">
          <div className={`profile-avatar sm ${member.photoUrl ? "has-photo" : ""}`}>
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.fullName ?? member.email ?? member.userId} />
            ) : (
              <span>{(member.fullName ?? member.email ?? member.userId).slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <strong>{member.fullName ?? member.email ?? member.userId}</strong>
            <p>{member.userId === session.userId ? String(t("teamYou")) : member.email ?? member.userId}</p>
          </div>
        </div>
        <span className={`status-chip ${member.role === "owner" ? "danger" : member.role === "admin" ? "warning" : "good"}`}>
          {formatAccountRole(member.role)}
        </span>
      </div>

      <div className="team-member-meta">
        <span className="eyebrow">{String(t("teamRestaurantAccess"))}</span>
        <div className="team-restaurant-chips">
          {member.restaurants.length > 0 ? (
            member.restaurants.map((restaurant) => (
              <span key={`${member.membershipId}-${restaurant.restaurantId}`} className="team-restaurant-chip">
                <strong>{restaurant.restaurantName}</strong>
                <small>{formatRestaurantRole(restaurant.role)}</small>
              </span>
            ))
          ) : (
            <span className="team-restaurant-chip muted">{String(t("teamNoRestaurants"))}</span>
          )}
        </div>
      </div>

      {canManageTeam ? (
        <div className="team-member-actions">
          <div>
            <span className="eyebrow">{String(t("teamManageMember"))}</span>
            <p className="team-member-actions-text">{String(t("teamManageMemberText"))}</p>
          </div>

          {canEditMember ? (
            <>
              <div className="team-restaurant-selector">
                <span>{String(t("teamInviteFeatures"))}</span>
                <div className="team-restaurant-chips">
                  <button
                    type="button"
                    className={`team-restaurant-chip selectable ${featureIds.includes(DEFAULT_INVITE_FEATURE) ? "selected" : ""}`}
                    onClick={() => handleFeatureToggle(DEFAULT_INVITE_FEATURE)}
                    disabled={busy}
                  >
                    <strong>{String(t("teamFeatureDashboard"))}</strong>
                    <small>{String(t("teamRoleUser"))}</small>
                  </button>
                </div>
              </div>

              <div className="team-restaurant-selector">
                <span>{String(t("teamInviteRestaurants"))}</span>
                <div className="team-restaurant-chips">
                  {(session.memberships ?? []).map((membership) => (
                    <button
                      key={`member-${member.membershipId}-${membership.restaurantId}`}
                      type="button"
                      className={`team-restaurant-chip selectable ${restaurantIds.includes(membership.restaurantId) ? "selected" : ""}`}
                      onClick={() => handleRestaurantToggle(membership.restaurantId)}
                      disabled={busy}
                    >
                      <strong>{membership.restaurantName}</strong>
                      <small>
                        {membership.role === "owner"
                          ? String(t("teamRoleOwner"))
                          : membership.role === "admin"
                            ? String(t("teamRoleAdmin"))
                            : String(t("teamRoleViewer"))}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              {error ? <p className="message error">{error}</p> : null}
              {message ? <p className="message success">{message}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={handleSave} disabled={busy || !hasChanges}>
                  {busy ? String(t("processing")) : String(t("teamSaveMember"))}
                </button>
                <button type="button" className="ghost-button danger-button" onClick={handleRemove} disabled={busy}>
                  {String(t("teamRemoveMember"))}
                </button>
              </div>
            </>
          ) : (
            <p className="message">{String(t("teamMemberImmutable"))}</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function TeamPermissionsPanel({
  session,
  members,
  invitations,
  loading,
  invitationsLoading,
  canManageTeam,
  inviteForm,
  inviteBusy,
  inviteMessage,
  inviteError,
  onInviteEmailChange,
  onInviteFeatureToggle,
  onInviteRestaurantToggle,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateMember,
  onRemoveMember
}: {
  session: AuthSession;
  members: AccountMember[];
  invitations: AccountInvitation[];
  loading: boolean;
  invitationsLoading: boolean;
  canManageTeam: boolean;
  inviteForm: InviteFormState;
  inviteBusy: boolean;
  inviteMessage?: string;
  inviteError?: string;
  onInviteEmailChange: (value: string) => void;
  onInviteFeatureToggle: (featureId: string) => void;
  onInviteRestaurantToggle: (restaurantId: string) => void;
  onCreateInvitation: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onUpdateMember: (input: {
    member: AccountMember;
    accountRole: "admin" | "user";
    restaurantRole: "admin" | "viewer";
    restaurantIds: string[];
  }) => Promise<void>;
  onRemoveMember: (member: AccountMember) => Promise<void>;
}) {
  const { t } = useLocale();
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const adminCount = members.filter((member) => member.role === "admin").length;
  const commonUsersCount = members.filter((member) => member.role === "user").length;
  const coveredRestaurants = new Set(
    members.flatMap((member) => member.restaurants.map((restaurant) => restaurant.restaurantId))
  ).size;

  const formatAccountRole = (role: AccountMember["role"]) =>
    role === "owner" ? String(t("teamRoleOwner")) : role === "admin" ? String(t("teamRoleAdmin")) : String(t("teamRoleUser"));

  const formatRestaurantRole = (role: "owner" | "admin" | "viewer") =>
    role === "owner" ? String(t("teamRoleOwner")) : role === "admin" ? String(t("teamRoleAdmin")) : String(t("teamRoleViewer"));

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <span className="eyebrow">{String(t("navTeam"))}</span>
          <h3>{String(t("teamTitle"))}</h3>
          <p>{String(t("teamText"))}</p>
        </div>
      </div>

      <div className="totals-grid">
        <div className="totals-box compact">
          <span className="eyebrow">{String(t("teamAccessModel"))}</span>
          <strong>{session.globalRole === "owner" ? "OWNER" : session.globalRole === "admin" ? "ADMIN" : "USER"}</strong>
          <p>{String(t("teamAccessModelText"))}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{String(t("teamMembersTotal"))}</span>
          <strong>{formatNumber(members.length)}</strong>
          <p>{String(t("teamAccountRole"))}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{String(t("teamAdminsTotal"))}</span>
          <strong>{formatNumber(ownerCount + adminCount)}</strong>
          <p>{formatNumber(ownerCount)} owner / {formatNumber(adminCount)} admin</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{String(t("teamUsersTotal"))}</span>
          <strong>{formatNumber(commonUsersCount)}</strong>
          <p>{String(t("teamRestaurantAccess"))}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{String(t("teamRestaurantsTotal"))}</span>
          <strong>{formatNumber(coveredRestaurants)}</strong>
          <p>{String(t("authRestaurants"))}</p>
        </div>
      </div>

      {loading ? <p className="message">{String(t("processing"))}</p> : null}
      {!loading && members.length === 0 ? <p className="message">{String(t("teamEmpty"))}</p> : null}

      {!loading && members.length > 0 ? (
        <div className="team-members-grid">
          {members.map((member) => (
            <TeamMemberCard
              key={member.membershipId}
              session={session}
              member={member}
              canManageTeam={canManageTeam}
              onSave={onUpdateMember}
              onRemove={onRemoveMember}
            />
          ))}
        </div>
      ) : null}

      {canManageTeam ? (
        <section className="team-management-grid">
          <article className="team-member-card">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">{String(t("teamInviteTitle"))}</span>
                <h3>{String(t("teamInviteTitle"))}</h3>
                <p>{String(t("teamInviteText"))}</p>
              </div>
            </div>

            <div className="team-invite-form">
              <label className="auth-field">
                <span>{String(t("teamInviteEmail"))}</span>
                <input
                  value={inviteForm.email}
                  onChange={(event) => onInviteEmailChange(event.target.value)}
                  placeholder="nome@empresa.com"
                />
              </label>

              <div className="team-restaurant-selector">
                <span>{String(t("teamInviteFeatures"))}</span>
                <div className="team-restaurant-chips">
                  <button
                    type="button"
                    className={`team-restaurant-chip selectable ${inviteForm.featureIds.includes(DEFAULT_INVITE_FEATURE) ? "selected" : ""}`}
                    onClick={() => onInviteFeatureToggle(DEFAULT_INVITE_FEATURE)}
                  >
                    <strong>{String(t("teamFeatureDashboard"))}</strong>
                    <small>{String(t("teamRoleUser"))}</small>
                  </button>
                </div>
              </div>

              <div className="team-restaurant-selector">
                <span>{String(t("teamInviteRestaurants"))}</span>
                <div className="team-restaurant-chips">
                  {(session.memberships ?? []).map((membership) => (
                    <button
                      key={`invite-${membership.restaurantId}`}
                      type="button"
                      className={`team-restaurant-chip selectable ${inviteForm.restaurantIds.includes(membership.restaurantId) ? "selected" : ""}`}
                      onClick={() => onInviteRestaurantToggle(membership.restaurantId)}
                    >
                      <strong>{membership.restaurantName}</strong>
                      <small>
                        {membership.role === "owner"
                          ? String(t("teamRoleOwner"))
                          : membership.role === "admin"
                            ? String(t("teamRoleAdmin"))
                            : String(t("teamRoleViewer"))}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <p className="message">{String(t("teamInviteHint"))}</p>
              {inviteError ? <p className="message error">{inviteError}</p> : null}
              {inviteMessage ? <p className="message success">{inviteMessage}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onCreateInvitation} disabled={inviteBusy}>
                  {inviteBusy ? String(t("processing")) : String(t("teamInviteAction"))}
                </button>
              </div>
            </div>
          </article>

          <article className="team-member-card">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">{String(t("teamInvitePending"))}</span>
                <h3>{String(t("teamInvitePending"))}</h3>
                <p>{String(t("teamInviteHint"))}</p>
              </div>
            </div>

            {invitationsLoading ? <p className="message">{String(t("processing"))}</p> : null}
            {!invitationsLoading && invitations.length === 0 ? <p className="message">{String(t("teamInviteEmpty"))}</p> : null}

            {!invitationsLoading && invitations.length > 0 ? (
              <div className="team-members-grid compact">
                {invitations.map((invitation) => (
                  <article key={invitation.invitationId} className="team-member-card nested">
                    <div className="team-member-head">
                      <div>
                        <strong>{invitation.email}</strong>
                        <p>{formatAccountRole(invitation.accountRole)} · {String(t("teamFeatureDashboard"))}</p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={() => onRevokeInvitation(invitation.invitationId)}
                        disabled={inviteBusy}
                      >
                        {String(t("teamInviteRevoke"))}
                      </button>
                    </div>
                    <div className="team-restaurant-chips">
                      {invitation.restaurants.map((restaurant) => (
                        <span key={`${invitation.invitationId}-${restaurant.restaurantId}`} className="team-restaurant-chip">
                          <strong>{restaurant.restaurantName}</strong>
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        </section>
      ) : (
        <p className="message">
          A gestão de equipe fica disponível para perfis owner/admin da conta ou do restaurante ativo.
        </p>
      )}
    </section>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
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
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceRestaurantId, setWorkspaceRestaurantId] = useState<string>();
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [, setRecipeFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({});
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedbackItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(TOTAL_PERIOD);
  const [selectedView, setSelectedView] = useState<string>(TOTAL_VIEW);
  const latestWorkspaceRestaurantIdRef = useRef<string>();
  const latestStateRef = useRef<UploadState>({});
  const latestUploadFeedbackRef = useRef<UploadFeedbackItem[]>([]);
  const t = <K extends keyof typeof translations.pt>(key: K) => withLocaleFallback<typeof translations.pt>(locale, key);
  const effectiveSession = useMemo(
    () => (session ? applyActiveRestaurant(session, getPreferredRestaurant(session.userId)) : null),
    [session]
  );
  latestWorkspaceRestaurantIdRef.current = workspaceRestaurantId;
  latestStateRef.current = state;
  latestUploadFeedbackRef.current = uploadFeedback;
  const hasSalesFile = salesFiles.length > 0 || (state.periodDashboards?.length ?? 0) > 0;
  const hasPersistedWorkspaceContent = (workspace?: PersistedWorkspace | null) =>
    Boolean(
      workspace &&
        (
          ((workspace.state?.periodDashboards?.length ?? 0) > 0) ||
          ((workspace.state?.recipeBase?.length ?? 0) > 0) ||
          ((workspace.state?.salesFileNames?.length ?? 0) > 0) ||
          ((workspace.uploadFeedback?.length ?? 0) > 0) ||
          workspace.state?.processing
        )
    );
  const activeRole = effectiveSession?.activeRole ?? "viewer";
  const canManageRestaurants =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    effectiveSession?.activeAccountRole === "admin" ||
    activeRole === "owner" ||
    activeRole === "admin";
  const canManageOperationalData =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageTeam =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    effectiveSession?.activeAccountRole === "admin" ||
    activeRole === "owner" ||
    activeRole === "admin";
  const periodDashboards = state.periodDashboards ?? [];
  const dashboard =
    selectedPeriod === TOTAL_PERIOD
      ? state.data
      : periodDashboards.find((periodDashboard) => periodDashboard.key === selectedPeriod)?.data;
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
    if (!effectiveSession || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
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
  }, [effectiveSession]);

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
    setRestaurantProfileForm({
      restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
      profilePhotoUrl: effectiveSession.profilePhotoUrl
    });
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.length > 0 ? current.featureIds : [DEFAULT_INVITE_FEATURE],
      restaurantIds:
        current.restaurantIds.length > 0
          ? current.restaurantIds
          : (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
    }));
  }, [effectiveSession]);

  useEffect(() => {
    if (currentSection === "restaurants" && !canManageRestaurants) {
      setCurrentSection("dashboard");
    }
  }, [canManageRestaurants, currentSection]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(restoreSession());
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Tempo limite ao inicializar autenticação.")), ms);
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

    void withTimeout(getSupabaseSession(), AUTH_BOOT_TIMEOUT_MS)
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

    void hydrateSupabaseSession(session)
      .then((nextSession) => {
        if (!mounted || !nextSession) {
          return;
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

      void hydrateSupabaseSession(session)
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
    if (!effectiveSession) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      setSalesFiles([]);
      setRecipeFile(null);
      setState({});
      setUploadFeedback([]);
      setSelectedPeriod(TOTAL_PERIOD);
      setSelectedView(TOTAL_VIEW);
      setCurrentSection("dashboard");
      setAuthLoading(false);
      return;
    }

    if (effectiveSession.authMode === "supabase" && !(effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId)) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      return;
    }

    let mounted = true;
    const targetRestaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId ?? "";
    const localWorkspace = loadRestaurantWorkspace<PersistedWorkspace>(targetRestaurantId);
    setWorkspaceReady(false);
    setWorkspaceRestaurantId(undefined);

    if (localWorkspace) {
      setLocale(localWorkspace.locale ?? "pt");
      setState((localWorkspace.state as UploadState | undefined) ?? {});
      setUploadFeedback(localWorkspace.uploadFeedback ?? []);
      setSelectedPeriod(localWorkspace.selectedPeriod ?? TOTAL_PERIOD);
      setSelectedView(localWorkspace.selectedView ?? TOTAL_VIEW);
      setCurrentSection(isInternalSection(localWorkspace.currentSection) ? localWorkspace.currentSection : "dashboard");
      setWorkspaceRestaurantId(targetRestaurantId);
      setWorkspaceReady(true);
    }

    const loadWorkspace = async () => {
      try {
        const cloudWorkspace =
          effectiveSession.authMode === "supabase"
            ? await loadCloudWorkspace(targetRestaurantId)
            : localWorkspace;
        const workspace = cloudWorkspace ?? localWorkspace;

        if (!mounted) {
          return;
        }

        const currentWorkspaceHasContent =
          latestWorkspaceRestaurantIdRef.current === targetRestaurantId &&
          hasPersistedWorkspaceContent({
            locale,
            state: latestStateRef.current as PersistedWorkspace["state"],
            uploadFeedback: latestUploadFeedbackRef.current,
            selectedPeriod,
            selectedView,
            currentSection
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
        setSelectedPeriod(workspace?.selectedPeriod ?? TOTAL_PERIOD);
        setSelectedView(workspace?.selectedView ?? TOTAL_VIEW);
        setCurrentSection(isInternalSection(workspace?.currentSection) ? workspace.currentSection : "dashboard");
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
  }, [effectiveSession]);

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
      currentSection
    };

    saveRestaurantWorkspace<PersistedWorkspace>(restaurantId, workspace);

    if (effectiveSession.authMode === "supabase") {
      void saveCloudWorkspace(restaurantId, workspace).catch(() => undefined);
      return;
    }

  }, [currentSection, effectiveSession, locale, selectedPeriod, selectedView, state, uploadFeedback, workspaceReady, workspaceRestaurantId]);

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
      if (!(nextSession.activeRestaurantId ?? nextSession.restaurantId)) {
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
    if (currentSession.authMode !== "supabase" || !currentSession.activeAccountId) {
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
    accountRole: "admin" | "user";
    restaurantRole: "admin" | "viewer";
    restaurantIds: string[];
  }) => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    await updateAccountMemberAccess({
      accountId: effectiveSession.activeAccountId,
      userId: member.userId,
      accountRole,
      restaurantRole,
      restaurantIds
    });
    await refreshTeamData(effectiveSession);
  };

  const handleRemoveMember = async (member: AccountMember) => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    await removeAccountMemberAccess({
      accountId: effectiveSession.activeAccountId,
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
      setRestaurantProfileForm((current) => ({
        ...current,
        profilePhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
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
          onLogin={handleLogin}
          onRegister={handleRegister}
          error={authError}
          isCloudEnabled={isSupabaseConfigured}
          busy={authSubmitting}
        />
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-brand">
            <BrandMark />
          </div>
          <InternalNavigation section={currentSection} onChange={setCurrentSection} canManageRestaurants={Boolean(canManageRestaurants)} />
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
              section={currentSection}
              locale={locale}
              onChangeLocale={setLocale}
            />

            {currentSection === "dashboard" ? (
              <RestaurantNavigatorPanel
                session={effectiveSession}
                onActivateRestaurant={handleSelectRestaurant}
              />
            ) : null}
            {currentSection === "restaurants" && canManageRestaurants ? (
              <RestaurantManagementPanel
                session={effectiveSession}
                restaurantForm={restaurantProfileForm}
                newRestaurantName={newRestaurantName}
                busy={accountBusy}
                message={accountMessage}
                error={accountError}
                onRestaurantNameChange={(value) => setRestaurantProfileForm((current) => ({ ...current, restaurantName: value }))}
                onRestaurantPhotoSelect={handleRestaurantPhotoSelect}
                onCreateRestaurantNameChange={setNewRestaurantName}
                onSaveRestaurant={handleSaveRestaurantAccount}
                onCreateRestaurant={handleCreateRestaurant}
                onDeleteRestaurant={handleDeleteRestaurant}
                onActivateRestaurant={handleSelectRestaurant}
              />
            ) : null}
            {currentSection === "team" ? (
              <TeamPermissionsPanel
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
                onInviteEmailChange={(value) => setInviteForm((current) => ({ ...current, email: value }))}
                onInviteFeatureToggle={handleInviteFeatureToggle}
                onInviteRestaurantToggle={handleInviteRestaurantToggle}
                onCreateInvitation={() => void handleCreateInvitation()}
                onRevokeInvitation={(invitationId) => void handleRevokeInvitation(invitationId)}
                onUpdateMember={handleUpdateMember}
                onRemoveMember={handleRemoveMember}
              />
            ) : null}
            {currentSection === "account" ? (
          <AccountSettingsPanel
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
            onRestaurantNameChange={(value) => setRestaurantProfileForm((current) => ({ ...current, restaurantName: value }))}
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
          />
            ) : null}
            {authError ? (
              <section className="card">
                <p className="message error">{authError}</p>
              </section>
            ) : null}
            {currentSection === "dashboard" ? (
              <>
                {canManageOperationalData ? <ProcessPanel /> : null}
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
                {!hasDashboardData ? (
                  <section className="card">
                    <div className="section-head">
                      <div>
                        <h3>{String(t("authEmptyState"))}</h3>
                        <p>{String(t("authRestaurantNavigatorText"))}</p>
                      </div>
                    </div>
                  </section>
                ) : (
                  <>
                    {!canManageOperationalData ? (
                      <section className="card">
                        <div className="section-head">
                          <div>
                            <h3>{String(t("authReadOnlyTitle"))}</h3>
                            <p>{String(t("authReadOnlyText"))}</p>
                          </div>
                        </div>
                      </section>
                    ) : null}
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




