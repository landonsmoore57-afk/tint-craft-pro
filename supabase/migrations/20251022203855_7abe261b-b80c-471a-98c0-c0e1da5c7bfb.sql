-- Add manual pricing override fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS is_price_overridden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_override_total numeric DEFAULT NULL;

COMMENT ON COLUMN public.quotes.is_price_overridden IS 'When true, use manual_override_total instead of calculated price';
COMMENT ON COLUMN public.quotes.manual_override_total IS 'Manually entered price that overrides the calculated total';