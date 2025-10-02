-- Update RLS policies for films table to work with custom PIN auth
-- Since this app uses custom PIN authentication (not Supabase Auth),
-- auth.uid() will always be NULL, so we need to allow operations without it

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can insert films" ON public.films;
DROP POLICY IF EXISTS "Authenticated users can update films" ON public.films;
DROP POLICY IF EXISTS "Authenticated users can delete films" ON public.films;

-- Create new policies that allow all operations
-- (authentication is handled at the application level with PIN system)
CREATE POLICY "Anyone can insert films" 
ON public.films 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update films" 
ON public.films 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete films" 
ON public.films 
FOR DELETE 
USING (true);