-- Drop existing policies on company_settings
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON public.company_settings;

-- Create new policies with proper authentication checks
CREATE POLICY "Authenticated users can view company settings"
  ON public.company_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update company settings"
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert company settings"
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);