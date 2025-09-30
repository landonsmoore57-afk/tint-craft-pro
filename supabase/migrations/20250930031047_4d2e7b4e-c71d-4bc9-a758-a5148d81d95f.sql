-- Add roll configuration to company settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS roll_config JSONB DEFAULT jsonb_build_object(
  'roll_widths_in', jsonb_build_array(48, 60, 72),
  'allow_equal_splits', true,
  'trim_allowance_in', 0.5,
  'allow_rotation', true
);