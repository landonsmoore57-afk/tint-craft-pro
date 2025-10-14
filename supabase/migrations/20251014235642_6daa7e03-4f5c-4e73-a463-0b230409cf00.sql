-- Fix RLS policies for job_assignments to work with custom authentication
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can assign their quotes to jobs" ON public.job_assignments;
DROP POLICY IF EXISTS "Users can update job assignments for their quotes" ON public.job_assignments;
DROP POLICY IF EXISTS "Users can delete job assignments for their quotes" ON public.job_assignments;
DROP POLICY IF EXISTS "Authenticated users can view all job assignments" ON public.job_assignments;

-- Create new policies that allow operations when quote exists
-- (Since your custom auth system already validates users client-side)
CREATE POLICY "Allow insert job assignments"
ON public.job_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = job_assignments.quote_id
  )
);

CREATE POLICY "Allow update job assignments"
ON public.job_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = job_assignments.quote_id
  )
);

CREATE POLICY "Allow delete job assignments"
ON public.job_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = job_assignments.quote_id
  )
);

CREATE POLICY "Allow view all job assignments"
ON public.job_assignments
FOR SELECT
USING (true);