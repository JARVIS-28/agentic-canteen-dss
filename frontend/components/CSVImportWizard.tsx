"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { InventoryItem } from "@/lib/types";
import { X, FileText, Folder, Download, XCircle, CheckCircle2 } from "lucide-react";

interface CSVImportWizardProps {
  onClose: () => void;
  cashOnHand: number;
  userLocation: string;
}

export function CSVImportWizard({
  onClose,
  cashOnHand,
  userLocation,
}: CSVImportWizardProps) {
  const addMultipleItems = useAppStore((s) => s.addMultipleItems);
  const [step, setStep] = useState<"upload" | "preview" | "success">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; failed: number }| null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError("");
        parseCSVFile(selectedFile);
      } else {
        setError("Invalid Protocol: Please utilize a verified CSV matrix.");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError("");
        parseCSVFile(selectedFile);
      } else {
        setError("Invalid Protocol: Please utilize a verified CSV matrix.");
      }
    }
  };

  const parseCSVFile = async (csvFile: File) => {
    const text = await csvFile.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      setError("Matrix Empty: No data detected in signal stream.");
      return;
    }

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .map((h) => h.replace(/"/g, ""));

    const requiredFields = ["item_name", "unit_price", "usual_order_qty", "current_stock"];
    const missingFields = requiredFields.filter((f) => !headers.includes(f));

    if (missingFields.length > 0) {
      setError(`Stream Interrupted: Missing required descriptors: ${missingFields.join(", ")}`);
      return;
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;

      const values = lines[i]
        .split(",")
        .map((v) => v.trim().replace(/"/g, ""))
        .map((v) => (v === "" ? "0" : v));

      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      if (!row.item_name || !row.unit_price || row.unit_price === "0") {
        continue;
      }

      row.unit_price = parseFloat(row.unit_price) || 0;
      row.cost_price = parseFloat(row.cost_price) || (row.unit_price * 0.8);
      row.usual_order_qty = parseInt(row.usual_order_qty) || 10;
      row.current_stock = parseInt(row.current_stock) || 0;
      row.item_category = row.category || row.item_category || "general";
      row.is_perishable = (row.is_perishable?.toString().toLowerCase() === "true");
      row.expiry_date = row.expiry_date || null;
      row.barcode = row.barcode || null;

      rows.push(row);
    }

    if (rows.length === 0) {
      setError("Logical Error: No valid neural nodes found in stream.");
      return;
    }

    setParsedRows(rows);
    setStep("preview");
  };

  const handleConfirmImport = async () => {
    const itemsToAdd = parsedRows.map((row) => ({
      item_name: row.item_name,
      unit_price: row.unit_price,
      cost_price: row.cost_price,
      usual_order_qty: row.usual_order_qty,
      current_stock: row.current_stock,
      cash_on_hand: cashOnHand,
      item_category: row.item_category,
      user_location: userLocation,
      is_perishable: row.is_perishable,
      expiry_date: row.expiry_date,
      barcode: row.barcode
    }));

    const ids = addMultipleItems(itemsToAdd);

    setImportResult({
      imported: ids.length,
      failed: parsedRows.length - ids.length,
    });

    setStep("success");
  };

  const downloadTemplate = () => {
    const template = `item_name,unit_price,cost_price,usual_order_qty,current_stock,category,is_perishable,expiry_date,barcode
Product Name,40,32,100,20,snacks,false,2026-12-31,8900000000000
Second Item,27,24,50,5,dairy,true,2026-06-30,
Sugar (1kg),45,38,50,15,grains,false,2027-01-01,
Rice (5kg),240,210,15,3,grains,false,2027-01-01,
Tea Powder,120,105,25,8,beverages,false,2027-01-01,
Coffee,80,68,15,3,beverages,false,2027-01-01,`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-2xl flex items-center justify-center p-6 z-[200]">
      <div className="bg-[var(--surface-container-high)] border border-white/5 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-2xl flex flex-col relative transition-all duration-500">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5 sticky top-0 bg-white/[0.01] z-10">
          <div>
            <h2 className="text-2xl font-display font-black flex items-center gap-4 text-white uppercase tracking-tight">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[var(--pes-orange)]">
                <FileText size={24} /> 
              </div>
              Matrix Injection
            </h2>
            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em] mt-2">Core Inventory Synchronization</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-white/20 hover:text-white transition-all">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {step === "upload" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group border-2 border-dashed rounded-[2.5rem] p-12 text-center transition-all duration-500 cursor-pointer ${
                  isDragging || file
                    ? "border-[var(--pes-orange)] bg-[var(--pes-orange)]/[0.03] scale-[0.98]"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex justify-center mb-6">
                  <div className={`p-6 rounded-[2rem] transition-all duration-500 ${isDragging || file ? 'bg-[var(--pes-orange)]/20 text-[var(--pes-orange)] scale-110' : 'bg-white/5 text-white/20'}`}>
                    <Folder size={56} strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="font-display font-black text-xl text-white mb-2 uppercase tracking-tight">
                  {file ? file.name : "Initiate Signal Feed"}
                </h3>
                <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em] mb-6">
                  {file ? "Feed latency optimized. Ready for extraction." : "Deposit CSV matrix or browse local nodes"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!file && (
                   <div className="inline-flex px-8 py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl transition-all group-hover:bg-[var(--pes-orange)] group-hover:text-white">
                     Select Matrix Stream
                   </div>
                )}
              </div>

              {error && (
                <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 duration-300">
                  <XCircle size={20} className="text-rose-400" /> 
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-rose-400">{error}</span>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/5"></div>
                  <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">Protocol Specification</p>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                   {["item_name", "unit_price", "usual_qty", "stock"].map((field) => (
                      <div key={field} className="bg-white/[0.02] border border-white/5 px-4 py-3 rounded-xl">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest text-center">{field.replace('_', ' ')}</p>
                      </div>
                   ))}
                </div>

                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-4 py-6 px-8 rounded-2xl border border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5 hover:text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all"
                >
                  <Download size={18} /> Retrieve Reference Template
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">Node Preview</h3>
                <span className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  {parsedRows.length} Neural Entries
                </span>
              </div>
              
              <div className="border border-white/5 rounded-[2.5rem] bg-black/20 overflow-hidden shadow-2xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="text-left p-6 text-[10px] font-black text-white/20 uppercase tracking-widest">Descriptor</th>
                      <th className="text-left p-6 text-[10px] font-black text-white/20 uppercase tracking-widest">Delta</th>
                      <th className="text-left p-6 text-[10px] font-black text-white/20 uppercase tracking-widest">Supply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedRows.slice(0, 8).map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-6">
                           <p className="text-sm font-black text-white">{row.item_name}</p>
                           <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.1em] mt-1">{row.item_category}</p>
                        </td>
                        <td className="p-6 font-display font-black text-white/60">₹{parseFloat(row.unit_price).toFixed(0)}</td>
                        <td className="p-6 font-display font-black text-[var(--pes-orange)]">{row.current_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep("upload")}
                  className="flex-1 py-6 px-8 rounded-2xl border border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5 font-black text-[10px] uppercase tracking-[0.3em] transition-all"
                >
                  Reject Cache
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-[2] py-6 px-8 rounded-2xl bg-white text-black hover:bg-[var(--pes-orange)] hover:text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
                >
                  ✓ Commit Injection
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-10 text-center py-8 animate-in zoom-in-95 duration-1000">
              <div className="flex justify-center">
                 <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 blur-3xl animate-pulse" />
                    <div className="relative p-10 bg-green-500/10 border border-green-500/20 rounded-[3rem] text-green-400">
                       <CheckCircle2 size={96} strokeWidth={1} />
                    </div>
                 </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-4xl font-display font-black text-white uppercase tracking-tight">Sync Complete</h3>
                <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.3em]">Neural Interface Fully Synchronized</p>
              </div>

              {importResult && (
                <div className="flex justify-center gap-6">
                  <div className="bg-white/[0.02] border border-white/5 px-8 py-6 rounded-[2rem]">
                    <p className="text-2xl font-display font-black text-white">{importResult.imported}</p>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-2">Active Nodes</p>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/10 px-8 py-6 rounded-[2rem]">
                      <p className="text-2xl font-display font-black text-rose-400">{importResult.failed}</p>
                      <p className="text-[9px] font-black text-rose-400/40 uppercase tracking-widest mt-2">Pruned Nodes</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-6 px-8 rounded-2xl bg-white text-black hover:bg-green-500 hover:text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-2xl"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
