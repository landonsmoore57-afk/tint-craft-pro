-- Create films table
CREATE TABLE public.films (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  series TEXT NOT NULL,
  name TEXT NOT NULL,
  vlt INTEGER CHECK (vlt >= 0 AND vlt <= 100),
  sku TEXT,
  cost_per_sqft NUMERIC(10,2) NOT NULL CHECK (cost_per_sqft >= 0),
  sell_per_sqft NUMERIC(10,2) NOT NULL CHECK (sell_per_sqft >= 0),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  site_address TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Declined')),
  global_film_id UUID REFERENCES public.films(id),
  discount_flat NUMERIC(10,2) DEFAULT 0 CHECK (discount_flat >= 0),
  discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tax_percent NUMERIC(5,2) DEFAULT 0 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  travel_fee NUMERIC(10,2) DEFAULT 0 CHECK (travel_fee >= 0),
  deposit_percent NUMERIC(5,2) DEFAULT 0 CHECK (deposit_percent >= 0 AND deposit_percent <= 100),
  travel_taxable BOOLEAN DEFAULT false,
  notes_internal TEXT,
  notes_customer TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sections table
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  section_film_id UUID REFERENCES public.films(id),
  section_notes TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create windows table
CREATE TABLE public.windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  width_in INTEGER NOT NULL CHECK (width_in > 0),
  height_in INTEGER NOT NULL CHECK (height_in > 0),
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  waste_factor_percent NUMERIC(5,2) DEFAULT 0 CHECK (waste_factor_percent >= 0),
  window_film_id UUID REFERENCES public.films(id),
  override_sell_per_sqft NUMERIC(10,2) CHECK (override_sell_per_sqft >= 0),
  notes TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.windows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for films (all authenticated users can read, only authenticated can write)
CREATE POLICY "Anyone can view active films" ON public.films
  FOR SELECT USING (active = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert films" ON public.films
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update films" ON public.films
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete films" ON public.films
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for quotes (users can only access their own quotes)
CREATE POLICY "Users can view their own quotes" ON public.quotes
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own quotes" ON public.quotes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own quotes" ON public.quotes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own quotes" ON public.quotes
  FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for sections (via quote ownership)
CREATE POLICY "Users can view sections of their quotes" ON public.sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = sections.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert sections to their quotes" ON public.sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = sections.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update sections of their quotes" ON public.sections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = sections.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete sections of their quotes" ON public.sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = sections.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

-- RLS Policies for windows (via section/quote ownership)
CREATE POLICY "Users can view windows of their quotes" ON public.windows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sections
      JOIN public.quotes ON quotes.id = sections.quote_id
      WHERE sections.id = windows.section_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert windows to their quotes" ON public.windows
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sections
      JOIN public.quotes ON quotes.id = sections.quote_id
      WHERE sections.id = windows.section_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update windows of their quotes" ON public.windows
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sections
      JOIN public.quotes ON quotes.id = sections.quote_id
      WHERE sections.id = windows.section_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete windows of their quotes" ON public.windows
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sections
      JOIN public.quotes ON quotes.id = sections.quote_id
      WHERE sections.id = windows.section_id
      AND quotes.created_by = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_films_updated_at BEFORE UPDATE ON public.films
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_windows_updated_at BEFORE UPDATE ON public.windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert seed data for films
INSERT INTO public.films (brand, series, name, vlt, sku, cost_per_sqft, sell_per_sqft, notes, active) VALUES
  ('3M', 'Ceramic IR', 'CIR 35', 35, '3M-CIR-35', 3.25, 7.50, 'Popular ceramic film with excellent heat rejection', true),
  ('LLumar', 'DR', 'DR 15', 15, 'LL-DR-15', 2.85, 6.95, 'Dark tint for maximum privacy', true),
  ('SunTek', 'CXP', 'CXP 45', 45, 'ST-CXP-45', 3.10, 7.25, 'Carbon film with good clarity', true),
  ('3M', 'Crystalline', 'CR 70', 70, '3M-CR-70', 4.50, 9.95, 'Premium clear film with superior heat rejection', true),
  ('Formula One', 'Pinnacle', 'PIN 20', 20, 'F1-PIN-20', 3.75, 8.50, 'High-performance ceramic blend', true);