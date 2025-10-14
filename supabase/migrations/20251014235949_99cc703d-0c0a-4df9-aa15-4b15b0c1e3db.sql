-- Create a security definer function to check if a quote exists
-- This bypasses RLS policies to allow job_assignments validation
CREATE OR REPLACE FUNCTION public.quote_exists(_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quotes
    WHERE id = _quote_id
  )
$$;

-- Update job_assignments RLS policies to use the security definer function
DROP POLICY IF EXISTS "Allow insert job assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "Allow update job assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "Allow delete job assignments" ON public.job_assignments;

CREATE POLICY "Allow insert job assignments"
ON public.job_assignments
FOR INSERT
WITH CHECK (public.quote_exists(quote_id));

CREATE POLICY "Allow update job assignments"
ON public.job_assignments
FOR UPDATE
USING (public.quote_exists(quote_id));

CREATE POLICY "Allow delete job assignments"
ON public.job_assignments
FOR DELETE
USING (public.quote_exists(quote_id));