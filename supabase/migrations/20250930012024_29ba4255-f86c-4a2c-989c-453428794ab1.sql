-- Add security_film flag to films table
ALTER TABLE films
  ADD COLUMN security_film BOOLEAN NOT NULL DEFAULT FALSE;

-- Create materials table for gasket/caulk pricing by linear foot
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'linear_foot',
  cost_per_linear_ft NUMERIC(10,2) NOT NULL,
  sell_per_linear_ft NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on materials
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Anyone can view active materials
CREATE POLICY "Anyone can view materials"
  ON materials FOR SELECT
  USING (true);

-- Authenticated users can manage materials
CREATE POLICY "Authenticated users can insert materials"
  ON materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update materials"
  ON materials FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete materials"
  ON materials FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Seed materials data
INSERT INTO materials (key, name, unit, cost_per_linear_ft, sell_per_linear_ft, active)
VALUES 
  ('gasket', 'Gasket', 'linear_foot', 2.00, 3.00, true),
  ('caulk', 'Caulk', 'linear_foot', 1.00, 1.50, true)
ON CONFLICT (key) DO NOTHING;

-- Add materials_option to quotes table
ALTER TABLE quotes
  ADD COLUMN materials_option TEXT NOT NULL DEFAULT 'N/A',
  ADD CONSTRAINT quotes_materials_option_chk
    CHECK (materials_option IN ('N/A','Gasket','Caulk','Both'));

-- Add trigger for materials updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();