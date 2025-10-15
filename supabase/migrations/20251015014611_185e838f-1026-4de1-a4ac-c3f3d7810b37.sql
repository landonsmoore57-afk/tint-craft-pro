-- Fix RLS policies on company_settings to work without Supabase Auth
-- Since this app uses custom PIN authentication, we need to allow updates without auth.uid()

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON public.company_settings;

-- Create new policies that allow anyone to update/insert company settings
-- This is appropriate since company_settings is a single-row configuration table
CREATE POLICY "Anyone can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can insert company settings"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (true);