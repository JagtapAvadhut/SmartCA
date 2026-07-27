-- Reverse BUG-0007 WM reports_to backfill (clears only WM-* seeded reports fields).
UPDATE users
SET data = data - 'reportsTo' - 'reports_to',
    updated_at = NOW()
WHERE id LIKE 'WM-%'
  AND (
    (id LIKE 'WM-CA-%' AND data->>'reportsTo' LIKE 'WM-MGR-%')
    OR (id LIKE 'WM-TL-%' AND data->>'reportsTo' LIKE 'WM-CA-%')
    OR (id LIKE 'WM-EMP-%' AND data->>'reportsTo' LIKE 'WM-TL-%')
    OR (id LIKE 'WM-MGR-%' AND COALESCE(data->>'reportsTo', '') = '')
  );
