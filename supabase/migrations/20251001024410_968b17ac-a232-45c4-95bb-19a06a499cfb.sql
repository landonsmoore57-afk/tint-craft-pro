-- Allow tinters to view quotes that are assigned to jobs
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;
CREATE POLICY "Users can view their own quotes or assigned jobs"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by 
  OR EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_assignments.quote_id = quotes.id
  )
);

-- Allow all authenticated users to view job assignments
DROP POLICY IF EXISTS "Users can view job assignments for their quotes" ON public.job_assignments;
CREATE POLICY "Authenticated users can view all job assignments"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (true);

-- Allow tinters to view sections for assigned jobs
DROP POLICY IF EXISTS "Users can view sections of their quotes" ON public.sections;
CREATE POLICY "Users can view sections of their quotes or assigned jobs"
ON public.sections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = sections.quote_id 
    AND (
      quotes.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_assignments.quote_id = quotes.id
      )
    )
  )
);

-- Allow tinters to view windows for assigned jobs
DROP POLICY IF EXISTS "Users can view windows of their quotes" ON public.windows;
CREATE POLICY "Users can view windows of their quotes or assigned jobs"
ON public.windows
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sections
    JOIN public.quotes ON quotes.id = sections.quote_id
    WHERE sections.id = windows.section_id
    AND (
      quotes.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_assignments.quote_id = quotes.id
      )
    )
  )
);