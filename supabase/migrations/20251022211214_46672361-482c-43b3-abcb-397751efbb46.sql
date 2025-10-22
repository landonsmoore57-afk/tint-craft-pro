-- Add introduction_message field to quotes table
ALTER TABLE public.quotes 
ADD COLUMN introduction_message text DEFAULT 'Thank you for choosing us for your window tinting needs! This quote includes professional installation of premium window film. All prices include materials, labor, and warranty. Please review the details below and let us know if you have any questions.';