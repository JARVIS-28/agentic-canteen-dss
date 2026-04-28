export interface MASResponse {
  session_id: string;
  recommended_qty: number;
  explanation_english: string;
  risk_status: "Safe" | "Unsafe";
  liquidity_ratio: number;
  mdp_action: "APPROVE" | "RECALCULATE" | "BLOCK";
  profit_impact: number;
  agent_thought_log: AgentThought[];
  forecast_confidence: number;
  trend_modifier: number;
  api_trend_signals?: Record<string, any>;  // NEW
  trend_sources?: string[];  // NEW
  horizons?: Record<string, HorizonAnalysis>; // NEW: Pre-calculated for Today, Tmrw, Week, Month
  is_working_day?: boolean;  // Whether the analysis date is a working day
}

export interface HorizonAnalysis {
  qty: number;
  explanation: string;
  risk_status: "Safe" | "Unsafe";
}

export interface AgentThought {
  agent: string;
  timestamp: string;
  thought: string;
  output: Record<string, unknown>;
}

export interface CalendarMeta {
  file_name: string;
  uploaded_at: string;
  expires_at?: string | null;
  public_url?: string | null;
  stream_type?: string;
}

export interface CalendarEvent {
  id?: string;
  date: string;
  label: string;
  type: string;
  details?: string;
}

export interface AdminCalendar {
  semester: string;
  working_days: string[];
  events: CalendarEvent[];
  notes: string;
}

export interface InventoryInput {
  user_id?: string;
  item_id?: string;
  item_name: string;
  unit_price: number;
  cost_price?: number;
  usual_order_qty: number;
  current_stock: number;
  cash_on_hand: number;
  item_category?: string;  // NEW
  user_location?: string;  // NEW
  is_perishable: boolean;
  barcode?: string;
  min_stock_level?: number;
  expiry_date?: string;
  horizon_days?: number; // 0=today, 1=tomorrow, 7, 15, 30
  monthly_revenue?: number;

  monthly_expenses?: number;
  current_date?: string;
}

export interface InventoryItem extends InventoryInput {
  id: string;
  analysis?: MASResponse;
  analysis_result?: any; // Stored DB result
  last_analyzed_at?: string;
  last_updated?: string;
  status: "idle" | "analyzing" | "done" | "error";
}

export interface Notification {
  id: string;
  type: "low_stock" | "out_of_stock" | "high_demand" | "risk_alert" | "profit_opportunity";
  title: string;
  message: string;
  item_name: string;
  timestamp: Date;
  read: boolean;
  severity: "info" | "warning" | "critical";
}

// ===========================
// USER & REGISTRATION TYPES (NEW)
// ===========================

export interface UserRegister {
  full_name: string;
  email: string;
  canteen_name: string;
  college_name: string;
  city: string;
  language: "english" | "hinglish" | "hindi" | "kannada";
  cash_on_hand: number;
  manager_password?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  canteen_name: string;
  college_name: string;
  city: string;
  language: "english" | "hinglish" | "hindi" | "kannada";
  cash_on_hand: number;
  created_at?: string;
}

// ===========================
// CATEGORY & ANALYTICS TYPES (NEW)
// ===========================

export interface Category {
  name: string;
  display_name: string;
  description: string;
  keywords: string[];
  color: string;
}

export interface CategoryAnalysis {
  category: string;
  total_items: number;
  total_current_stock: number;
  total_recommended_stock: number;
  total_spend_required: number;
  category_trend_modifier: number;
  category_risk_status: "Safe" | "Warning" | "Critical";
  items: ItemAnalysisShort[];
}

export interface ItemAnalysisShort {
  item_id: string;
  item_name: string;
  current_stock: number;
  recommended_qty: number;
  unit_price: number;
  risk_status: "Safe" | "Unsafe";
  trend_modifier: number;
}

export interface PortfolioAnalysis {
  user_id: string;
  total_items: number;
  total_cash_utilized: number;
  cash_available: number;
  utilization_percentage: number;
  portfolio_risk_status: "Safe" | "Warning" | "Critical";
  overall_modifier: number;
  category_analyses: Record<string, CategoryAnalysis>;
  priority_reorder_list: PriorityItem[];
}

export interface PriorityItem {
  item_id: string;
  item_name: string;
  category: string;
  current_stock: number;
  recommended_qty: number;
  urgency: "critical" | "high" | "medium" | "low";
}

export interface CSVImportResult {
  user_id: string;
  items_imported: number;
  items_failed: number;
  failed_rows: Array<{
    row: number;
    error: string;
    data?: Record<string, any>;
  }>;
  created_at: string;
  total_inventory_value: number;
}

// ===========================
// UPDATED INVENTORY ITEM (with category)
// ===========================

export interface InventoryItemWithCategory extends InventoryItem {
  item_category: string;
  user_location?: string;
}

// ===========================
// TOAST TYPES (NEW)
// ===========================

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: Date;
}
