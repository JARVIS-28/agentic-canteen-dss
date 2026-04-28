import {
  InventoryInput,
  MASResponse,
  UserRegister,
  UserProfile,
  CSVImportResult,
  PortfolioAnalysis,
  Category,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://agentic-canteen-dss.onrender.com";
const API_BASE = API_BASE_URL;

// ===========================
// INVENTORY ANALYSIS
// ===========================

export async function analyzeInventory(input: InventoryInput): Promise<MASResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      current_date: input.current_date || new Date().toISOString().split("T")[0],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

// ===========================
// USER MANAGEMENT
// ===========================

export async function registerUser(data: UserRegister): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${userId}/profile`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to get user profile");
  }
  return res.json();
}

// ===========================
// CSV IMPORT
// ===========================

export async function uploadCSV(
  userId: string,
  file: File
): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/users/${userId}/csv-import`, {
    method: "POST",
    body: formData,
    // Note: Don't set Content-Type header - browser will set it with boundary
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "CSV import failed");
  }
  return res.json();
}

export async function getCSVTemplate(): Promise<{
  template: string;
  format: string;
  required_columns: string[];
  optional_columns: string[];
}> {
  const res = await fetch(`${API_BASE}/csv-template`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error("Failed to get CSV template");
  }
  return res.json();
}

// ===========================
// CATEGORY MANAGEMENT
// ===========================

export async function getCategories(): Promise<{
  predefined: string[];
  category_details: Record<string, Category>;
}> {
  const res = await fetch(`${API_BASE}/categories/list`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to get categories");
  }
  return res.json();
}

// ===========================
// PORTFOLIO & CATEGORY ANALYTICS
// ===========================

export async function analyzeAllItems(userId: string): Promise<PortfolioAnalysis> {
  const res = await fetch(`${API_BASE}/analyze/all-items?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to analyze all items");
  }
  return res.json();
}

export async function analyzeCategoryItems(
  userId: string,
  category: string
): Promise<any> {
  const params = new URLSearchParams({ user_id: userId, category });
  const res = await fetch(`${API_BASE}/analyze/category?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to analyze category");
  }
  return res.json();
}

export async function getAnalyticsSummary(userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/analytics/summary?user_id=${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to get analytics summary");
  }
  return res.json();
}

// ===========================
// PRODUCT & BARCODE INTELLIGENCE
// ===========================

export async function lookupProduct(barcode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/product/lookup/${barcode}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Product lookup failed");
  }
  return res.json();
}

export async function identifyBarcode(payload: { code?: string; file?: File }): Promise<any> {
  const formData = new FormData();
  if (payload.code) formData.append("code", payload.code);
  if (payload.file) formData.append("file", payload.file);

  const res = await fetch(`${API_BASE}/barcode/identify`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Identification failed" }));
    throw new Error(err.detail || "Barcode identification failed");
  }
  return res.json();
}

export async function lookupInventoryProduct(barcode: string, token: string): Promise<any> {
  if (!barcode) return null;
  const res = await fetch(`${API_BASE}/admin/inventory/lookup/${encodeURIComponent(barcode)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to lookup inventory barcode");
  }
  return res.json();
}

// ===========================
// INVENTORY CRUD
// ===========================

export async function getInventory(token: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/inventory`, {
    method: "GET",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
  });
  if (!res.ok) {
    throw new Error("Failed to get inventory");
  }
  return res.json();
}

export async function addInventoryItem(token: string, item: any): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/inventory`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to add inventory item");
  }
  return res.json();
}

export async function updateInventoryItem(token: string, itemId: string, updates: any): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/inventory/${itemId}`, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error("Failed to update inventory item");
  }
  return res.json();
}

export async function deleteInventoryItem(token: string, itemId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/admin/inventory/${itemId}`, {
    method: "DELETE",
    headers: { 
      "Authorization": `Bearer ${token}`
    },
  });
  if (!res.ok) {
    throw new Error("Failed to delete inventory item");
  }
  const status = await res.json();
  return status.ok === true;
}

export async function recordSale(token: string, sale: { item_id: string; quantity: number; payment_type?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/sales`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(sale),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to record sale");
  }
  return res.json();
}

export async function getAdminMe(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/me`, {
    method: "GET",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
  });
  if (!res.ok) {
    throw new Error("Failed to get self profile");
  }
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
