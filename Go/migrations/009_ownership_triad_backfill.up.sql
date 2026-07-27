-- 009: Backfill ownership triad (owner_ca_id / tl_id / assignee_id) on wm_work_items.
-- BUG-0006 / BC-P0-11. Additive; does not overwrite non-empty triad slots.
--
-- Heuristics (documented):
-- H0  assignee_id ← assigned_to when assignee_id empty.
-- H1  Role-aware from users.data role (or WM-* / PRACTICE-* id prefix):
--     - assigned_to is CA/senior_ca → owner_ca_id = assigned_to
--     - assigned_by is CA/senior_ca → owner_ca_id = assigned_by (if still empty)
--     - assigned_to is team_leader  → tl_id = assigned_to
--     - assigned_by is team_leader  → tl_id = assigned_by (if still empty)
-- H2  Engagement: if engagement_id set and owner still empty → wm_engagements.owner_ca_id.
-- H3  WM-* seed pool (wmseed 20 CA / 50 TL): when still empty, derive stable pool ids from
--     trailing digits of assigned_to (fallback assigned_by):
--       owner_ca_id = WM-CA-XXXX  where XXXX = ((n-1) % 20) + 1
--       tl_id       = WM-TL-YYYY  where YYYY = ((n-1) % 50) + 1
--     Matches wmseed loop pairing (ca := cas[i%20], tl := tls[i%50]) for load realism.
-- H4  PRACTICE-* already seeded with triad; left untouched when non-empty.

-- H0
UPDATE wm_work_items
SET assignee_id = assigned_to,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND COALESCE(assignee_id, '') = ''
  AND COALESCE(assigned_to, '') <> '';

-- Role helper CTE for H1
WITH user_role AS (
    SELECT
        u.id,
        LOWER(REPLACE(COALESCE(NULLIF(u.data->>'role', ''), u.data->>'roleName', ''), '-', '_')) AS role
    FROM users u
),
classified AS (
    SELECT
        w.id,
        w.assigned_by,
        w.assigned_to,
        w.owner_ca_id,
        w.tl_id,
        w.engagement_id,
        COALESCE(
            NULLIF(by_u.role, ''),
            CASE
                WHEN w.assigned_by LIKE 'WM-CA-%' OR w.assigned_by LIKE 'PRACTICE-CA-%' THEN 'ca'
                WHEN w.assigned_by LIKE 'WM-TL-%' OR w.assigned_by LIKE 'PRACTICE-TL-%' THEN 'team_leader'
                WHEN w.assigned_by LIKE 'WM-MGR-%' OR w.assigned_by LIKE 'PRACTICE-MGR-%' THEN 'manager'
                WHEN w.assigned_by LIKE 'WM-EMP-%' THEN 'employee'
                ELSE ''
            END
        ) AS by_role,
        COALESCE(
            NULLIF(to_u.role, ''),
            CASE
                WHEN w.assigned_to LIKE 'WM-CA-%' OR w.assigned_to LIKE 'PRACTICE-CA-%' THEN 'ca'
                WHEN w.assigned_to LIKE 'WM-TL-%' OR w.assigned_to LIKE 'PRACTICE-TL-%' THEN 'team_leader'
                WHEN w.assigned_to LIKE 'WM-MGR-%' OR w.assigned_to LIKE 'PRACTICE-MGR-%' THEN 'manager'
                WHEN w.assigned_to LIKE 'WM-EMP-%' OR w.assigned_to LIKE 'PRACTICE-%' THEN 'employee'
                ELSE ''
            END
        ) AS to_role
    FROM wm_work_items w
    LEFT JOIN user_role by_u ON by_u.id = w.assigned_by
    LEFT JOIN user_role to_u ON to_u.id = w.assigned_to
    WHERE w.deleted_at IS NULL
)
UPDATE wm_work_items w
SET
    owner_ca_id = CASE
        WHEN COALESCE(w.owner_ca_id, '') <> '' THEN w.owner_ca_id
        WHEN c.to_role IN ('ca', 'senior_ca') THEN w.assigned_to
        WHEN c.by_role IN ('ca', 'senior_ca') THEN w.assigned_by
        ELSE w.owner_ca_id
    END,
    tl_id = CASE
        WHEN COALESCE(w.tl_id, '') <> '' THEN w.tl_id
        WHEN c.to_role = 'team_leader' THEN w.assigned_to
        WHEN c.by_role = 'team_leader' THEN w.assigned_by
        ELSE w.tl_id
    END,
    updated_at = NOW()
FROM classified c
WHERE w.id = c.id
  AND (
    (COALESCE(w.owner_ca_id, '') = '' AND (
        c.to_role IN ('ca', 'senior_ca') OR c.by_role IN ('ca', 'senior_ca')
    ))
    OR
    (COALESCE(w.tl_id, '') = '' AND (
        c.to_role = 'team_leader' OR c.by_role = 'team_leader'
    ))
  );

-- H2 engagement owner
UPDATE wm_work_items w
SET owner_ca_id = e.owner_ca_id,
    updated_at = NOW()
FROM wm_engagements e
WHERE w.engagement_id = e.id
  AND w.deleted_at IS NULL
  AND COALESCE(w.owner_ca_id, '') = ''
  AND COALESCE(e.owner_ca_id, '') <> '';

-- H3 WM-* deterministic pool fill for remaining gaps
UPDATE wm_work_items w
SET
    owner_ca_id = CASE
        WHEN COALESCE(w.owner_ca_id, '') <> '' THEN w.owner_ca_id
        WHEN (w.assigned_by LIKE 'WM-%' OR w.assigned_to LIKE 'WM-%') THEN
            'WM-CA-' || LPAD((
                (GREATEST(
                    COALESCE(NULLIF(SUBSTRING(COALESCE(NULLIF(w.assigned_to, ''), w.assigned_by) FROM '([0-9]+)$')::INT, 0), 1) - 1
                ) % 20) + 1
            )::TEXT, 4, '0')
        ELSE w.owner_ca_id
    END,
    tl_id = CASE
        WHEN COALESCE(w.tl_id, '') <> '' THEN w.tl_id
        WHEN (w.assigned_by LIKE 'WM-%' OR w.assigned_to LIKE 'WM-%') THEN
            'WM-TL-' || LPAD((
                (GREATEST(
                    COALESCE(NULLIF(SUBSTRING(COALESCE(NULLIF(w.assigned_to, ''), w.assigned_by) FROM '([0-9]+)$')::INT, 0), 1) - 1
                ) % 50) + 1
            )::TEXT, 4, '0')
        ELSE w.tl_id
    END,
    updated_at = NOW()
WHERE w.deleted_at IS NULL
  AND (COALESCE(w.owner_ca_id, '') = '' OR COALESCE(w.tl_id, '') = '')
  AND (w.assigned_by LIKE 'WM-%' OR w.assigned_to LIKE 'WM-%');
