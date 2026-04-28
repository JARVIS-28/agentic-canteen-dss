"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { analyzeInventory } from "@/lib/api";

export default function BackgroundAnalysisManager() {
  const {
    isBatchAnalyzing,
    batchQueue,
    horizonDays,
    cashOnHand,
    items,
    updateItemStatus,
    setItemAnalysis,
    advanceBatchProgress,
    stopBatchAnalysis,
    addToast
  } = useAppStore();

  const isProcessing = useRef(false);

  useEffect(() => {
    const processNext = async () => {
      if (!isBatchAnalyzing || batchQueue.length === 0 || isProcessing.current) {
        return;
      }

      isProcessing.current = true;
      const itemId = batchQueue[0];
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        advanceBatchProgress();
        isProcessing.current = false;
        return;
      }

      updateItemStatus(itemId, "analyzing");

      try {
        const result = await analyzeInventory({
          item_id: item.id,
          item_name: item.item_name,
          unit_price: item.unit_price,
          usual_order_qty: item.usual_order_qty,
          current_stock: item.current_stock,
          item_category: item.item_category || "snacks",
          is_perishable: item.is_perishable,
          cash_on_hand: Number((item as any).cash_on_hand || cashOnHand || 5000),
          user_location: item.user_location || "PES EC Campus",
          expiry_date: (item as any).expiry_date,
          horizon_days: horizonDays,
          monthly_revenue: 50000,
        });

        setItemAnalysis(itemId, result);
        advanceBatchProgress();
      } catch (error: any) {
        console.error(`Analysis failed for ${item.item_name}:`, error);
        updateItemStatus(itemId, "error");
        addToast(`AI analysis failed for ${item.item_name}`, "error");
        advanceBatchProgress();
      } finally {
        isProcessing.current = false;
      }
    };

    processNext();
  }, [
    isBatchAnalyzing,
    batchQueue,
    horizonDays,
    cashOnHand,
    items,
    updateItemStatus,
    setItemAnalysis,
    advanceBatchProgress,
    addToast
  ]);

  return null;
}
