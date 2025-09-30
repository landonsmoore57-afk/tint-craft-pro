-- Part 1: Add integer quote number sequence
CREATE SEQUENCE IF NOT EXISTS quote_no_seq START 1;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_no BIGINT;

-- Backfill existing quotes deterministically by created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM quotes
  WHERE quote_no IS NULL
)
UPDATE quotes q
SET quote_no = o.rn
FROM ordered o
WHERE q.id = o.id;

-- Make it NOT NULL with default
ALTER TABLE quotes ALTER COLUMN quote_no SET NOT NULL;
ALTER TABLE quotes ALTER COLUMN quote_no SET DEFAULT nextval('quote_no_seq');

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_quote_no ON quotes(quote_no);

-- Part 2: Drop any existing status constraints
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_chk;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

-- Normalize status values (handle capitalized defaults)
UPDATE quotes SET status = 'done' 
WHERE lower(status) IN ('sent','approved','declined','won','lost','ready','complete','completed','closed','done');

UPDATE quotes SET status = 'draft' 
WHERE lower(status) IN ('draft') OR status IS NULL OR lower(status) NOT IN ('draft', 'done');

-- Now add the new constraint
ALTER TABLE quotes ADD CONSTRAINT quotes_status_chk CHECK (status IN ('draft','done'));

-- Part 3: Add search indexes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_name ON quotes (lower(customer_name));
CREATE INDEX IF NOT EXISTS idx_quotes_email ON quotes (lower(customer_email));
CREATE INDEX IF NOT EXISTS idx_quotes_phone ON quotes (customer_phone);