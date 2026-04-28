"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/admin";
import { useAppStore } from "@/lib/store";
import { recordSale, lookupProduct, lookupInventoryProduct } from "@/lib/api";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Package,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SalesPage() {
  const router = useRouter();
  const { items, updateItemStock, addToast, addItemWithId } = useAppStore();
  
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<"Cash" | "UPI">("UPI");

  useEffect(() => {
    if (!isAuthenticated()) router.push("/admin");
  }, [router]);

  // Filter items based on search (name or barcode)
  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return [];
    return items.filter(i => 
      i.item_name.toLowerCase().includes(s) || 
      (i as any).barcode?.includes(s)
    ).slice(0, 5);
  }, [items, search]);

  const addToCart = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.current_stock <= (cart[itemId] || 0)) {
      addToast(`Only ${item.current_stock} units left in stock!`, "warning");
      return;
    }

    setCart(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
    setSearch(""); // Clear search after adding
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemId] > 1) {
        next[itemId] -= 1;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const addInventoryMatchToCart = (inventoryItem: any) => {
    const stock = inventoryItem.current_stock ?? inventoryItem.quantity ?? 0;
    const existingQty = cart[inventoryItem.id] || 0;
    if (stock <= existingQty) {
      addToast(`Only ${stock} units left in stock!`, "warning");
      return false;
    }
    setCart(prev => ({
      ...prev,
      [inventoryItem.id]: existingQty + 1
    }));
    return true;
  };

  const clearCartItem = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };


  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const item = items.find(i => i.id === id);
      return acc + (item?.unit_price || 0) * qty;
    }, 0);
  }, [cart, items]);

  const handleCheckout = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      addToast("Authentication required", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const promises = Object.entries(cart).map(([itemId, qty]) => 
        recordSale(token, { item_id: itemId, quantity: qty, payment_type: paymentType })
      );

      const results = await Promise.all(promises);
      
      // Update local stock
      Object.entries(cart).forEach(([itemId, qty], index) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
          const newStock = results[index].new_stock ?? Math.max(0, item.current_stock - qty);
          updateItemStock(itemId, newStock);
        }
      });

      addToast("Sale recorded successfully!", "success");
      setCart({});
    } catch (e: any) {
      addToast(`Checkout failed: ${e.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = items.find(i => i.id === id);
    return { ...item, qty };
  });

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto bg-white sm:bg-transparent">
      {/* Search & Scan Header */}
      <div className="p-4 sm:p-6 bg-white border-b border-slate-100 sm:rounded-b-3xl sm:shadow-sm z-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-900 transition-colors sm:hidden">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">Terminal Sale</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Store: Main Canteen</p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center text-slate-400 group-focus-within:text-indigo-600 transition-colors">
            <Search size={18} />
          </div>
          <input 
            type="text"
            placeholder="Search by name or barcode..."
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-14 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#313D71]/10 focus:bg-white transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Search Dropdown */}
          {filteredItems.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
              {filteredItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#313D71] group-hover:bg-white transition-colors">
                      <Package size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">{item.item_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock: {item.current_stock} left</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-900">₹{item.unit_price}</span>
                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-[#313D71] group-hover:text-white transition-all">
                      <Plus size={14} strokeWidth={3} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 pb-32">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
              <ShoppingCart size={40} />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-500">Cart is empty</p>
              <p className="text-[10px] uppercase font-black tracking-widest mt-1">Scan or search to begin sale</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Summary</span>
              <button 
                onClick={() => setCart({})}
                className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600"
              >
                Clear All
              </button>
            </div>
            
            {cartItems.map((item: any) => (
              <div key={item.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <Package size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{item.item_name}</h4>
                    <p className="text-[10px] font-bold text-[#E52820] uppercase font-bold tracking-widest">₹{item.unit_price} EACH</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 hover:bg-white hover:text-rose-500 rounded-lg transition-all text-slate-400"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-slate-900">{item.qty}</span>
                    <button 
                      onClick={() => addToCart(item.id)}
                      className="p-1.5 hover:bg-white hover:text-emerald-500 rounded-lg transition-all text-slate-400"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                  <button 
                    onClick={() => clearCartItem(item.id)}
                    className="p-2 text-slate-300 hover:text-rose-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Checkout Footer */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-30 sm:static sm:bg-transparent sm:border-0 sm:p-0">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Payment Selector */}
            <div className="grid grid-cols-2 gap-2">
              {["UPI", "Cash"].map((type) => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type as any)}
                  className={cn(
                    "py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    paymentType === type 
                      ? "bg-[#313D71] text-white shadow-lg shadow-blue-100" 
                      : "bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <button 
              onClick={handleCheckout}
              disabled={isProcessing}
              className={cn(
                "w-full py-5 rounded-2xl flex items-center justify-between px-8 shadow-2xl transition-all active:scale-[0.98]",
                "bg-[#313D71] text-white hover:bg-[#252f58] disabled:opacity-50 disabled:cursor-not-allowed shadow-blue-200"
              )}
            >
              <div className="text-left">
                <span className="block text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Total Amount</span>
                <span className="text-xl font-black">₹{cartTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[11px]">
                {isProcessing ? "Processing..." : "Complete Sale"}
                <CheckCircle2 size={18} />
              </div>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
