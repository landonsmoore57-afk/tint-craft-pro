-- Create job_assignments table for scheduling quotes
CREATE TABLE IF NOT EXISTS public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  job_date DATE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (quote_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_assignments_date ON public.job_assignments(job_date);
CREATE INDEX IF NOT EXISTS idx_job_assignments_quote ON public.job_assignments(quote_id);

-- Enable RLS
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view job assignments for their quotes"
  ON public.job_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = job_assignments.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can assign their quotes to jobs"
  ON public.job_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = job_assignments.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update job assignments for their quotes"
  ON public.job_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = job_assignments.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete job assignments for their quotes"
  ON public.job_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = job_assignments.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_job_assignments_updated_at
  BEFORE UPDATE ON public.job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();