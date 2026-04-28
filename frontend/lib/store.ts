"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { InventoryItem, MASResponse, Notification, UserProfile, PortfolioAnalysis, Toast } from "./types";
import { v4 as uuidv4 } from "uuid";

interface AppStore {
  // ===== USER PROFILE (NEW) =====
  userId: string | null;
  userProfile: UserProfile | null;
  shopName: string;
  userLocation: string;
  userLanguage: "english" | "hinglish" | "hindi" | "kannada";

  // ===== INVENTORY =====
  items: InventoryItem[];
  notifications: Notification[];
  toasts: Toast[];
  cashOnHand: number;
  activeItemId: string | null;

  // ===== CATEGORIES (NEW) =====
  predefinedCategories: string[];
  customCategories: string[];
  selectedCategory: string | null;
  horizonDays: number; // 0=today, 1=tomorrow, 7, 15, 30

  // ===== PORTFOLIO ANALYTICS (NEW) =====
  portfolioAnalysis: PortfolioAnalysis | null;

  // ===== BATCH ANALYSIS (NEW) =====
  isBatchAnalyzing: boolean;
  batchQueue: string[];
  batchProgress: number;
  batchTotal: number;
  startBatchAnalysis: (itemIds: string[]) => void;
  stopBatchAnalysis: () => void;
  advanceBatchProgress: () => void;

  // ===== USER METHODS (NEW) =====
  setUserProfile: (profile: UserProfile) => void;
  setUserId: (id: string) => void;
  updateUserLocation: (city: string) => void;
  updateUserLanguage: (lang: "english" | "hinglish" | "hindi" | "kannada") => void;
  addCustomCategory: (catName: string) => void;
  setSelectedCategory: (catName: string | null) => void;
  setHorizonDays: (days: number) => void;
  setPortfolioAnalysis: (analysis: PortfolioAnalysis) => void;
  setItems: (items: InventoryItem[]) => void;


  // ===== INVENTORY METHODS =====
  setCashOnHand: (v: number) => void;
  addItem: (item: Omit<InventoryItem, "id" | "status"> & { id?: string }) => string;
  addItemWithId: (item: Omit<InventoryItem, "status">) => void;

  addMultipleItems: (items: Array<Omit<InventoryItem, "id" | "status">>) => string[];
  updateItemStatus: (id: string, status: InventoryItem["status"]) => void;
  setItemAnalysis: (id: string, analysis: MASResponse) => void;
  setActiveItem: (id: string | null) => void;
  removeItem: (id: string) => void;
  updateItemStock: (id: string, newStock: number) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;

  // ===== NOTIFICATION METHODS =====
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  // ===== TOAST METHODS (NEW) =====
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ===== USER PROFILE INIT =====
      userId: null,
      userProfile: null,
      shopName: "PES Canteen",
      userLocation: "PES EC Campus",
      userLanguage: "english",

      // ===== INVENTORY INIT =====
      items: [],
      notifications: [],
      toasts: [],
      cashOnHand: 5000,
      activeItemId: null,

      // ===== CATEGORIES INIT =====
      predefinedCategories: [
        "snacks", "beverages", "fast_food", "dairy", "meals", "bakery", "general"
      ],
      customCategories: [],
      selectedCategory: null,
      horizonDays: 1, // Default: Tomorrow

      // ===== PORTFOLIO INIT =====
      portfolioAnalysis: null,

      // ===== BATCH ANALYSIS INIT =====
      isBatchAnalyzing: false,
      batchQueue: [],
      batchProgress: 0,
      batchTotal: 0,

      // ===== USER METHODS =====
      setUserProfile: (profile) => set({
        userId: profile.id,
        userProfile: profile,
        shopName: profile.canteen_name,
        userLocation: profile.city,
        userLanguage: profile.language,
        cashOnHand: profile.cash_on_hand,
      }),

      setUserId: (id) => set({ userId: id }),

      updateUserLocation: (city) => set({ userLocation: city }),

      updateUserLanguage: (lang) => set({ userLanguage: lang }),

      addCustomCategory: (catName) =>
        set((s) => {
          if (!s.customCategories.includes(catName)) {
            return { customCategories: [...s.customCategories, catName] };
          }
          return s;
        }),

      setSelectedCategory: (catName) => set({ selectedCategory: catName }),
      setHorizonDays: (days) => set({ horizonDays: days }),

      setPortfolioAnalysis: (analysis) => set({ portfolioAnalysis: analysis }),
      setItems: (items) => set({ items }),


      // ===== INVENTORY METHODS =====
      setCashOnHand: (v) => set({ cashOnHand: v }),

      addItem: (item) => {
        const id = item.id || uuidv4();
        set((s) => ({ items: [...s.items, { ...item, id, status: "idle" as const }] }));
        return id;
      },

      addItemWithId: (item) => {
        set((s) => ({
          items: [...s.items, { ...item, status: "idle" as const }]
        }));
      },


      addMultipleItems: (items) => {
        const ids = items.map(() => uuidv4());
        set((s) => ({
          items: [
            ...s.items,
            ...items.map((item, idx) => ({
              ...item,
              id: ids[idx],
              status: "idle" as const,
            })),
          ],
        }));
        return ids;
      },

      updateItemStatus: (id, status) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, status } : i)),
        })),

      setItemAnalysis: (id, analysis) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, analysis, status: "done", analyzed_at: new Date() } : i
          ),
        }));
        // Auto-generate notifications based on analysis
        const item = get().items.find((i) => i.id === id);
        if (!item) return;

        const explanationLines = (analysis.explanation_english || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const detectedRiskLine = explanationLines.find((line) =>
          /financial safety|critical risk|caution|unsafe|risk/i.test(line)
        );
        const fallbackRiskLine = explanationLines[0] || "Order may strain your cash.";
        const riskMessage = (detectedRiskLine || fallbackRiskLine)
          .replace(/^[-*\d.\s]+/, "")
          .replace("💰 Risk Reason:", "")
          .trim();

        if (analysis.risk_status === "Unsafe") {
          get().addNotification({
            type: "risk_alert",
            severity: "critical",
            title: "⚠️ Risk Alert",
            message: `${item.item_name}: ${riskMessage}`,
            item_name: item.item_name,
          });
        }
        if (item.current_stock <= item.usual_order_qty * 0.2) {
          get().addNotification({
            type: "low_stock",
            severity: "warning",
            title: "📦 Low Stock",
            message: `${item.item_name} is running low (only ${item.current_stock} units left). Consider ordering ${analysis.recommended_qty} units now.`,
            item_name: item.item_name,
          });
        }
        if (item.current_stock === 0) {
          get().addNotification({
            type: "out_of_stock",
            severity: "critical",
            title: "🚨 Out of Stock",
            message: `${item.item_name} is completely out of stock! You are losing sales right now.`,
            item_name: item.item_name,
          });
        }
        if (analysis.trend_modifier > 1.4) {
          get().addNotification({
            type: "high_demand",
            severity: "info",
            title: "🔥 High Demand Detected",
            message: `Strong demand signal for ${item.item_name} (trend factor ×${analysis.trend_modifier.toFixed(1)}). Stock up now before prices rise!`,
            item_name: item.item_name,
          });
        }
        if (analysis.profit_impact > 200) {
          get().addNotification({
            type: "profit_opportunity",
            severity: "info",
            title: "💰 Profit Opportunity",
            message: `Following AI advice for ${item.item_name} could save/earn ₹${analysis.profit_impact.toLocaleString("en-IN")}.`,
            item_name: item.item_name,
          });
        }
      },

      setActiveItem: (id) => set({ activeItemId: id }),
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      updateItemStock: (id, newStock) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, current_stock: newStock } : i))
        })),

      updateItem: (id, updates) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i))
        })),

      // ===== NOTIFICATION METHODS =====
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: uuidv4(), timestamp: new Date(), read: false },
            ...s.notifications,
          ],
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      markRead: (id: string) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      // ===== TOAST METHODS =====
      addToast: (message, type = "info") => {
        const id = uuidv4();
        set((s) => ({
          toasts: [...s.toasts, { id, message, type, timestamp: new Date() }],
        }));
        // Auto-remove toast after 4 seconds
        setTimeout(() => {
          get().removeToast(id);
        }, 4000);
      },

      removeToast: (id: string) =>
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        })),

      // ===== BATCH ANALYSIS METHODS =====
      startBatchAnalysis: (itemIds) => set({
        isBatchAnalyzing: true,
        batchQueue: itemIds,
        batchProgress: 0,
        batchTotal: itemIds.length
      }),

      stopBatchAnalysis: () => set({
        isBatchAnalyzing: false,
        batchQueue: [],
        batchProgress: 0,
        batchTotal: 0
      }),

      advanceBatchProgress: () => set((s) => {
        const newQueue = s.batchQueue.slice(1);
        const newProgress = s.batchProgress + 1;
        const isDone = newQueue.length === 0;
        
        if (isDone && s.isBatchAnalyzing) {
          get().addToast("Batch analysis complete!", "success");
        }

        return {
          batchQueue: newQueue,
          batchProgress: newProgress,
          isBatchAnalyzing: !isDone && s.isBatchAnalyzing
        };
      }),
    }),
    {
      name: "bharat-mas-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

