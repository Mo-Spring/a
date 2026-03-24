import React, { createContext, useContext } from 'react';
import { Industry, AIConfig, ViewType, NavigationState, Index, ValuationConfig, PresetName } from './types';
import { ValuationResult, FinancialStatement } from './valuation/types';
import { ChatConversation } from './types/chat';
import { MarketData, IndexValuationData, LivePriceData } from './types/market';

export interface ConfirmDialog {
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface AppContextType {
  // State
  view: ViewType;
  market: 'A' | 'HK';
  indexMarket: 'A' | 'HK' | 'GLOBAL';
  indexValFilter: 'all' | 'low' | 'mid' | 'high';
  indices: Index[];
  navStack: NavigationState[];
  navArgs: any[];
  favStocks: string[];
  favIndices: string[];
  config: AIConfig;
  filter: 'all' | 'low' | 'mid' | 'high';
  aiConversations: ChatConversation[];
  activeAiConvId: string | null;
  showAiConvList: boolean;
  aiLoading: boolean;
  valuationConfig: ValuationConfig;
  activePreset: PresetName | null;
  settingsTab: 'ai' | 'data' | 'valuation';
  livePrice: LivePriceData | null;
  customCompanies: any[];
  deletedCompanies: string[];
  isAddingCompany: boolean;
  aiAddError: string | null;
  isAddingIndex: boolean;
  aiIndexError: string | null;
  batchData: Record<string, MarketData>;
  indexVal: Record<string, IndexValuationData>;
  stockStatements: Record<string, FinancialStatement[]>;
  stockDetailLoading: Record<string, boolean>;
  valuationResults: Record<string, ValuationResult>;
  darkMode: boolean;
  confirmDialog: ConfirmDialog | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Setters
  setView: (view: ViewType) => void;
  setMarket: (market: 'A' | 'HK') => void;
  setIndexMarket: (market: 'A' | 'HK' | 'GLOBAL') => void;
  setIndexValFilter: (f: 'all' | 'low' | 'mid' | 'high') => void;
  setIndices: (indices: Index[] | ((prev: Index[]) => Index[])) => void;
  setFavStocks: (stocks: string[] | ((prev: string[]) => string[])) => void;
  setFavIndices: (indices: string[] | ((prev: string[]) => string[])) => void;
  setConfig: (config: AIConfig) => void;
  setFilter: (f: 'all' | 'low' | 'mid' | 'high') => void;
  setAiConversations: (convs: ChatConversation[] | ((prev: ChatConversation[]) => ChatConversation[])) => void;
  setActiveAiConvId: (id: string | null) => void;
  setShowAiConvList: (show: boolean) => void;
  setAiLoading: (loading: boolean) => void;
  setValuationConfig: (cfg: ValuationConfig) => void;
  setActivePreset: (p: PresetName | null) => void;
  setSettingsTab: (tab: 'ai' | 'data' | 'valuation') => void;
  setCustomCompanies: (comps: any[] | ((prev: any[]) => any[])) => void;
  setDeletedCompanies: (dels: string[] | ((prev: string[]) => string[])) => void;
  setIsAddingCompany: (v: boolean) => void;
  setAiAddError: (v: string | null) => void;
  setIsAddingIndex: (v: boolean) => void;
  setAiIndexError: (v: string | null) => void;
  setDarkMode: (v: boolean) => void;
  setConfirmDialog: (v: ConfirmDialog | null) => void;

  // Computed / actions
  allIndustries: Industry[];
  currentIndustries: Industry[];
  navigate: (view: ViewType, ...args: any[]) => void;
  goBack: () => void;
  toggleFav: (code: string, type: 'stock' | 'index', e?: React.MouseEvent) => void;
  handleDeleteCompany: (code: string) => void;
  handleRestoreDefaults: () => void;
  handleRestoreDefaultIndices: () => void;
  handleAiAddCompany: () => Promise<void>;
  handleAiAddIndex: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
};
