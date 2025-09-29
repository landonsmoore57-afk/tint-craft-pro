-- Add theme_style and tagline to company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS theme_style TEXT DEFAULT 'Modern',
  ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Update existing row with defaults if exists
UPDATE public.company_settings
SET theme_style = COALESCE(theme_style, 'Modern')
WHERE theme_style IS NULL;