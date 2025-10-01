-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'tinter');

-- Create users table for PIN authentication
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Anyone can view active users for login"
  ON public.users FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (
        SELECT id FROM public.users WHERE pin = current_setting('app.current_user_pin', true)
      )
      AND role = 'admin'::app_role
    )
  );

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Anyone can view roles for authentication"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(
    (SELECT id FROM public.users WHERE pin = current_setting('app.current_user_pin', true)),
    'admin'::app_role
  ));

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample users
INSERT INTO public.users (name, pin) VALUES
  ('Admin User', '1234'),
  ('Tinter 1', '5678'),
  ('Tinter 2', '9012');

-- Assign roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.users WHERE pin = '1234'
UNION ALL
SELECT id, 'tinter'::app_role FROM public.users WHERE pin = '5678'
UNION ALL
SELECT id, 'tinter'::app_role FROM public.users WHERE pin = '9012';