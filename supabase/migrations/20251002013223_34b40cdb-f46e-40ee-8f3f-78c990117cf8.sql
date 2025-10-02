-- Add quote dimension overrides to windows table
-- These are used only for pricing calculations and quote displays
-- Jobs pages will continue to show exact (measured) dimensions

ALTER TABLE windows
  ADD COLUMN quote_width_in INTEGER NULL,
  ADD COLUMN quote_height_in INTEGER NULL;

COMMENT ON COLUMN windows.quote_width_in IS 'Optional width override for pricing calculations (used in quotes/PDFs only, not in Jobs)';
COMMENT ON COLUMN windows.quote_height_in IS 'Optional height override for pricing calculations (used in quotes/PDFs only, not in Jobs)';