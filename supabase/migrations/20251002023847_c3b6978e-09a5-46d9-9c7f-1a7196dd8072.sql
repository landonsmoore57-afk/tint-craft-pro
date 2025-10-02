-- Drop the old foreign key constraint
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_created_by_fkey;

-- Set created_by to NULL for quotes where the user doesn't exist in public.users
UPDATE public.quotes
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = quotes.created_by
  );

-- Add new foreign key constraint pointing to public.users
ALTER TABLE public.quotes 
ADD CONSTRAINT quotes_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;