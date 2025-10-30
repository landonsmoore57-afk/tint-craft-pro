-- Create warranties table
CREATE TABLE public.warranties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  effective_date DATE NOT NULL,
  project_name TEXT NOT NULL,
  project_address TEXT,
  body_copy TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recipient_name TEXT,
  recipient_address TEXT,
  footer_note TEXT,
  show_logo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own warranties" 
ON public.warranties 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own warranties" 
ON public.warranties 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own warranties" 
ON public.warranties 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own warranties" 
ON public.warranties 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_warranties_updated_at
BEFORE UPDATE ON public.warranties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();