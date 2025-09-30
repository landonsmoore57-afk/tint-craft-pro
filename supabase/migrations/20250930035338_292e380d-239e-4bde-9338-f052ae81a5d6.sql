-- Update company_settings roll_config to use new format
UPDATE company_settings
SET roll_config = jsonb_build_object(
  'roll_widths_in', jsonb_build_array(48, 60, 72),
  'allow_equal_splits', true,
  'cross_trim_in', 0.5,
  'allow_rotation', true,
  'exact_base_match_has_no_cross_trim', true
)
WHERE roll_config IS NOT NULL;