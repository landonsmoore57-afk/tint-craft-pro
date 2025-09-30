-- Fix security definer views by recreating them properly
-- Views default to SECURITY INVOKER unless explicitly set otherwise

-- Drop and recreate film_usage_ranking view
DROP VIEW IF EXISTS film_usage_ranking;
CREATE VIEW film_usage_ranking AS
WITH ranges AS (
  SELECT (now() - interval '180 days') AS since
),
w AS (
  SELECT window_film_id AS film_id, COUNT(*) AS c
  FROM windows, ranges
  WHERE window_film_id IS NOT NULL AND updated_at >= ranges.since
  GROUP BY 1
),
s AS (
  SELECT section_film_id AS film_id, COUNT(*) AS c
  FROM sections, ranges
  WHERE section_film_id IS NOT NULL AND updated_at >= ranges.since
  GROUP BY 1
),
g AS (
  SELECT global_film_id AS film_id, COUNT(*) AS c
  FROM quotes, ranges
  WHERE global_film_id IS NOT NULL AND updated_at >= ranges.since
  GROUP BY 1
)
SELECT f.id,
       f.brand, f.series, f.name, f.vlt, f.sku, f.active,
       f.cost_per_sqft, f.sell_per_sqft, f.security_film, f.notes,
       COALESCE(w.c,0) AS window_usage,
       COALESCE(s.c,0) AS section_usage,
       COALESCE(g.c,0) AS global_usage,
       (COALESCE(w.c,0)*3 + COALESCE(s.c,0)*2 + COALESCE(g.c,0)) AS usage_score
FROM films f
LEFT JOIN w ON w.film_id = f.id
LEFT JOIN s ON s.film_id = f.id
LEFT JOIN g ON g.film_id = f.id;

-- Drop and recreate room_usage_ranking view
DROP VIEW IF EXISTS room_usage_ranking;
CREATE VIEW room_usage_ranking AS
WITH ranges AS (
  SELECT (now() - interval '180 days') AS since
),
usage AS (
  SELECT room_id, COUNT(*) AS c
  FROM sections, ranges
  WHERE room_id IS NOT NULL AND updated_at >= ranges.since
  GROUP BY 1
)
SELECT r.id, r.name, r.is_common, 
       COALESCE(u.c,0) AS usage_score
FROM rooms r
LEFT JOIN usage u ON u.room_id = r.id;

-- Fix the existing update_updated_at_column function to have immutable search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;