import type { DrePanelCopy } from "../components/drePanels";
import type { AppSection } from "../hooks/useSessionWorkspace";

export type ThemeLabels = {
  label: string;
  light: string;
  dark: string;
};

export type AuthScreenCopy = {
  brandTagline: string;
  title: string;
  loginTab: string;
  registerTab: string;
  fullName: string;
  fullNameHint: string;
  email: string;
  password: string;
  processing: string;
  submitLogin: string;
  submitRegister: string;
  demoHint: string;
  language: string;
} & ThemeLabels;

export type AccountPanelCopy = {
  settings: string;
  settingsText: string;
  close: string;
  userProfile: string;
  userProfileText: string;
  profilePhoto: string;
  uploadPhoto: string;
  fullName: string;
  email: string;
  accountStatus: string;
  roleOwner: string;
  roleViewer: string;
  restaurantsCount: string;
  saveProfile: string;
  manageRestaurants: string;
  manageRestaurantsText: string;
  restaurantProfile: string;
  restaurantProfileText: string;
  restaurantName: string;
  activate: string;
  active: string;
  deleteRestaurant: string;
  createRestaurant: string;
  createRestaurantText: string;
  createRestaurantAction: string;
  dangerZone: string;
  deleteAccount: string;
  deleteHint: string;
  processing: string;
};

export type HeaderCopy = {
  eyebrow: string;
  title: string;
  text: string;
};

export type NavigationItem = {
  key: AppSection;
  label: string;
};

export type RestaurantNavigatorCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

export type AppPresentationModel = {
  authScreenCopy: AuthScreenCopy;
  accountPanelCopy: AccountPanelCopy;
  drePanelCopy: DrePanelCopy;
  dashboardHeaderCopy: HeaderCopy;
  themeLabels: ThemeLabels;
  navigationItems: NavigationItem[];
  canManageRestaurants: boolean;
  canManageOperationalData: boolean;
};
