-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own quotes or assigned jobs" ON public.quotes;

-- Create new policy that allows admins to see all quotes
CREATE POLICY "Admins can view all quotes, others see own or assigned"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1
    FROM job_assignments
    WHERE job_assignments.quote_id = quotes.id
  )
);