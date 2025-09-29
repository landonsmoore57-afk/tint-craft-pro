-- Create rooms table for room/section name library
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_common BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms
CREATE POLICY "Anyone can view rooms"
  ON public.rooms FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update rooms"
  ON public.rooms FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete rooms"
  ON public.rooms FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create company_settings table
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'STL Window Tinting',
  brand_color_hex TEXT DEFAULT '#0891B2',
  logo_url TEXT,
  pdf_footer_terms TEXT DEFAULT 'Payment: 50% deposit due upon approval. Balance due upon completion. Valid for 30 days.',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings
CREATE POLICY "Anyone can view company settings"
  ON public.company_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update company settings"
  ON public.company_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company settings (single row)
INSERT INTO public.company_settings (company_name, brand_color_hex, pdf_footer_terms)
VALUES (
  'STL Window Tinting',
  '#0891B2',
  'Payment Terms: 50% deposit due upon approval. Balance due upon completion. This quote is valid for 30 days from the date of issue. All work is guaranteed for the life of the film under normal conditions. Film manufacturer warranty applies.'
);

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Storage policies for logos
CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

-- Migrate sections table
ALTER TABLE public.sections
  ADD COLUMN room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN custom_room_name TEXT;

-- Seed common rooms
INSERT INTO public.rooms (name, is_common) VALUES
  ('Living Room', true),
  ('Family Room', true),
  ('Kitchen', true),
  ('Dining Room', true),
  ('Primary Bedroom', true),
  ('Bedroom', true),
  ('Office', true),
  ('Nursery', true),
  ('Bathroom', true),
  ('Primary Bathroom', true),
  ('Sunroom', true),
  ('Basement', true),
  ('Foyer', true),
  ('Hallway', true),
  ('Loft', true),
  ('Garage', true)
ON CONFLICT (name) DO NOTHING;

-- Backfill existing sections with room mappings
DO $$
DECLARE
  section_record RECORD;
  room_record RECORD;
BEGIN
  FOR section_record IN SELECT id, name FROM public.sections LOOP
    -- Try to find matching room (case-insensitive)
    SELECT id INTO room_record FROM public.rooms 
    WHERE LOWER(name) = LOWER(section_record.name) 
    LIMIT 1;
    
    IF FOUND THEN
      -- Exact match found, use the room
      UPDATE public.sections 
      SET room_id = room_record.id, custom_room_name = NULL 
      WHERE id = section_record.id;
    ELSE
      -- No match, create new room and link it
      INSERT INTO public.rooms (name, is_common)
      VALUES (section_record.name, false)
      ON CONFLICT (name) DO NOTHING
      RETURNING id INTO room_record;
      
      IF FOUND THEN
        UPDATE public.sections 
        SET room_id = room_record.id, custom_room_name = NULL 
        WHERE id = section_record.id;
      ELSE
        -- Room already existed from conflict, get it
        SELECT id INTO room_record FROM public.rooms 
        WHERE name = section_record.name;
        
        UPDATE public.sections 
        SET room_id = room_record.id, custom_room_name = NULL 
        WHERE id = section_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;