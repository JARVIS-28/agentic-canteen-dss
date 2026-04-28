-- Table for Canteen Admins
CREATE TABLE IF NOT EXISTS public.canteen_admins (
  id uuid NOT NULL,
  full_name text,
  canteen_name text,
  college_name text,
  email text,
  manager_password_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT canteen_admins_pkey PRIMARY KEY (id),
  CONSTRAINT canteen_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Table for College Events
CREATE TABLE IF NOT EXISTS public.college_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  event_name text NOT NULL,
  event_date date NOT NULL,
  event_type text CHECK (event_type = ANY (ARRAY['Holiday'::text, 'Exam'::text, 'Festival'::text, 'Sports_Day'::text, 'Workshop'::text, 'Cultural'::text, 'Other'::text])),
  impact_factor numeric DEFAULT 1.0,
  description text,
  stream_type text DEFAULT 'General',
  CONSTRAINT college_events_pkey PRIMARY KEY (id),
  CONSTRAINT college_events_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.canteen_admins(id)
);

-- Table for Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  item_name text NOT NULL,
  item_category text,
  unit_price numeric NOT NULL,
  cost_price numeric DEFAULT 0.0,
  current_stock integer DEFAULT 0,
  usual_order_qty integer DEFAULT 0,
  min_stock_level integer DEFAULT 5,
  barcode text,
  is_perishable boolean DEFAULT false,
  user_location text DEFAULT 'PES EC Campus',
  cash_on_hand numeric DEFAULT 0,
  expiry_date date,
  analysis_result jsonb,
  last_analyzed_at timestamp with time zone,
  last_updated timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.canteen_admins(id)
);

-- Table for Sales
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  item_id uuid,
  quantity integer NOT NULL,
  total_price numeric NOT NULL,
  payment_type text CHECK (payment_type = ANY (ARRAY['Cash'::text, 'UPI'::text, 'Card'::text, 'Student_Wallet'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.canteen_admins(id),
  CONSTRAINT sales_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id)
);

-- Table for Calendar Assets (tracked files)
CREATE TABLE IF NOT EXISTS public.calendar_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  public_url text,
  stream_type text DEFAULT 'General',
  uploaded_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at date,
  CONSTRAINT calendar_assets_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_assets_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.canteen_admins(id)
);

-- Enable RLS
ALTER TABLE public.canteen_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage their own data" ON public.canteen_admins FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admins can manage their own events" ON public.college_events FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Admins can manage their own inventory" ON public.inventory FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Admins can manage their own sales" ON public.sales FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Admins can manage their own assets" ON public.calendar_assets FOR ALL USING (auth.uid() = admin_id);
