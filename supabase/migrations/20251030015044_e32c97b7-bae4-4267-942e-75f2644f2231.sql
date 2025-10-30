-- Make issue_date nullable in warranties table
ALTER TABLE public.warranties 
ALTER COLUMN issue_date DROP NOT NULL,
ALTER COLUMN issue_date DROP DEFAULT;