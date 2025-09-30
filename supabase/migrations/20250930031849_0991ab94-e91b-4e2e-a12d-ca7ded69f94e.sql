-- Update trim allowance to 1.0 inch
UPDATE company_settings 
SET roll_config = jsonb_set(
  COALESCE(roll_config, '{}'::jsonb),
  '{trim_allowance_in}',
  '1.0'
)
WHERE roll_config IS NOT NULL OR roll_config IS NULL;