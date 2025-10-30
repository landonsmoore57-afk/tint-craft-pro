-- Add show_signature column to warranties table
ALTER TABLE public.warranties 
ADD COLUMN show_signature BOOLEAN DEFAULT false;