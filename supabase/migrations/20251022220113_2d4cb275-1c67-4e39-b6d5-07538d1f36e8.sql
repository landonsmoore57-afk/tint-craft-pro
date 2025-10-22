-- Add column to track if quote was pushed to Jobber
ALTER TABLE public.quotes
ADD COLUMN pushed_to_jobber_at TIMESTAMP WITH TIME ZONE;

-- Drop the old status check constraint
ALTER TABLE public.quotes
DROP CONSTRAINT IF EXISTS quotes_status_chk;

-- Update existing 'draft' statuses to 'In-Progress'
UPDATE public.quotes
SET status = 'In-Progress'
WHERE status = 'draft';

-- Add new check constraint with updated values
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_status_chk CHECK (status IN ('In-Progress', 'done'));

-- Add comment explaining the status values
COMMENT ON COLUMN public.quotes.status IS 'Quote status: In-Progress or done';