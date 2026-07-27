-- BUG-0007: Backfill reports_to / reportsTo on WM-* users (Manager→CA→TL→Emp).
-- Pool sizes match wmseed: 5 managers, 20 CA, 50 TL, 300 employees.
-- Only fills when both reports fields are missing/empty (idempotent).

-- CA → Manager: WM-CA-XXXX reports to WM-MGR-(((XXXX-1)%5)+1)
UPDATE users
SET data = data
  || jsonb_build_object(
       'reportsTo', 'WM-MGR-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 5) + 1)::text, 4, '0'),
       'reports_to', 'WM-MGR-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 5) + 1)::text, 4, '0')
     ),
    updated_at = NOW()
WHERE id LIKE 'WM-CA-%'
  AND COALESCE(NULLIF(TRIM(data->>'reports_to'), ''), NULLIF(TRIM(data->>'reportsTo'), '')) IS NULL;

-- TL → CA: WM-TL-XXXX reports to WM-CA-(((XXXX-1)%20)+1)
UPDATE users
SET data = data
  || jsonb_build_object(
       'reportsTo', 'WM-CA-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 20) + 1)::text, 4, '0'),
       'reports_to', 'WM-CA-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 20) + 1)::text, 4, '0')
     ),
    updated_at = NOW()
WHERE id LIKE 'WM-TL-%'
  AND COALESCE(NULLIF(TRIM(data->>'reports_to'), ''), NULLIF(TRIM(data->>'reportsTo'), '')) IS NULL;

-- Emp → TL: WM-EMP-XXXX reports to WM-TL-(((XXXX-1)%50)+1)
UPDATE users
SET data = data
  || jsonb_build_object(
       'reportsTo', 'WM-TL-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 50) + 1)::text, 4, '0'),
       'reports_to', 'WM-TL-' || LPAD((((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int - 1) % 50) + 1)::text, 4, '0')
     ),
    updated_at = NOW()
WHERE id LIKE 'WM-EMP-%'
  AND COALESCE(NULLIF(TRIM(data->>'reports_to'), ''), NULLIF(TRIM(data->>'reportsTo'), '')) IS NULL;

-- Managers stay root (explicit empty reports fields for clarity on future seed diffs)
UPDATE users
SET data = data
  || jsonb_build_object('reportsTo', '', 'reports_to', ''),
    updated_at = NOW()
WHERE id LIKE 'WM-MGR-%'
  AND NOT (data ? 'reportsTo' OR data ? 'reports_to');
