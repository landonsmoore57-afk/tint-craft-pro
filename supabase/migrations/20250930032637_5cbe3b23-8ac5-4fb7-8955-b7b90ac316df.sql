-- Update trim allowance to 0.5 inches in company_settings
UPDATE company_settings
SET roll_config = jsonb_set(
  COALESCE(roll_config, '{}'::jsonb),
  '{trim_allowance_in}',
  '0.0'::jsonb
)
WHERE roll_config IS NOT NULL OR roll_config IS NULL;