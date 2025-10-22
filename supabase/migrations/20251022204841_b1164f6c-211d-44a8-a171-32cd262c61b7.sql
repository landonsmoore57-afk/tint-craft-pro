-- Add manual price override fields to windows table
ALTER TABLE public.windows
ADD COLUMN IF NOT EXISTS is_price_overridden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_price numeric;

-- Add manual price override fields to sections table
ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS is_price_overridden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_override_total numeric;

COMMENT ON COLUMN public.windows.is_price_overridden IS 'Flag indicating if this window price has been manually overridden';
COMMENT ON COLUMN public.windows.manual_price IS 'Manual price override for this window';
COMMENT ON COLUMN public.sections.is_price_overridden IS 'Flag indicating if this section price has been manually overridden';
COMMENT ON COLUMN public.sections.manual_override_total IS 'Manual price override for this entire section';