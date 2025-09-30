-- Remove materials_option column and constraint from quotes table
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_materials_option_chk;
ALTER TABLE quotes DROP COLUMN IF EXISTS materials_option;