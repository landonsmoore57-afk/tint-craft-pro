-- Add customer_type field to quotes table
ALTER TABLE public.quotes
ADD COLUMN customer_type text DEFAULT 'Residential' CHECK (customer_type IN ('Residential', 'Commercial'));

-- Add film_removal_fee_per_sqft to windows table
ALTER TABLE public.windows
ADD COLUMN film_removal_fee_per_sqft numeric DEFAULT 0;