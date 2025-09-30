-- Set security_invoker option on views (PostgreSQL 15+ feature)
ALTER VIEW film_usage_ranking SET (security_invoker = true);
ALTER VIEW room_usage_ranking SET (security_invoker = true);