-- Create table to store Jobber OAuth tokens
CREATE TABLE IF NOT EXISTS public.integration_jobber_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jobber_account_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index to ensure one Jobber connection per account
CREATE UNIQUE INDEX IF NOT EXISTS integration_jobber_tokens_account_idx
  ON public.integration_jobber_tokens(account_id);

-- Enable RLS
ALTER TABLE public.integration_jobber_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own Jobber tokens
CREATE POLICY "Users can view their own Jobber tokens"
  ON public.integration_jobber_tokens
  FOR SELECT
  USING (account_id = auth.uid());

-- Policy: Users can insert their own Jobber tokens
CREATE POLICY "Users can insert their own Jobber tokens"
  ON public.integration_jobber_tokens
  FOR INSERT
  WITH CHECK (account_id = auth.uid());

-- Policy: Users can update their own Jobber tokens
CREATE POLICY "Users can update their own Jobber tokens"
  ON public.integration_jobber_tokens
  FOR UPDATE
  USING (account_id = auth.uid());

-- Policy: Users can delete their own Jobber tokens
CREATE POLICY "Users can delete their own Jobber tokens"
  ON public.integration_jobber_tokens
  FOR DELETE
  USING (account_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_integration_jobber_tokens_updated_at
  BEFORE UPDATE ON public.integration_jobber_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();