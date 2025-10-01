-- Add is_featured column to films table
ALTER TABLE public.films 
ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Add is_featured column to rooms table
ALTER TABLE public.rooms 
ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Add index for faster featured queries on films
CREATE INDEX idx_films_featured_active ON public.films(is_featured, active) WHERE active = true;

-- Add index for faster featured queries on rooms
CREATE INDEX idx_rooms_featured ON public.rooms(is_featured);