-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON public.company_settings;

-- Allow anyone to view company settings (needed for PDFs, quotes, etc.)
CREATE POLICY "Anyone can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (true);

-- Allow anyone to update company settings (internal tool)
CREATE POLICY "Anyone can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to insert company settings (for initial setup)
CREATE POLICY "Anyone can insert company settings"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (true);