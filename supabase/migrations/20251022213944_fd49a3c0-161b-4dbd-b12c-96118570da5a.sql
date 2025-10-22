-- Add default introduction message column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN default_introduction_message text 
DEFAULT 'Thank you for choosing us for your window tinting needs! This quote includes professional installation of premium window film. All prices include materials, labor, and warranty. Please review the details below and let us know if you have any questions.';

-- Update RLS policies for company_settings to require authentication
DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Anyone can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Anyone can insert company settings" ON public.company_settings;

-- Create more secure policies
CREATE POLICY "Authenticated users can view company settings" 
ON public.company_settings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update company settings" 
ON public.company_settings 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert company settings" 
ON public.company_settings 
FOR INSERT 
TO authenticated
WITH CHECK (true);