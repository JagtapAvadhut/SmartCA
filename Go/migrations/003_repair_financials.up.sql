-- 003: Repair invoice paid/remaining/status from completed payments + client outstanding
-- Idempotent financial reconciliation for seed integrity.

WITH pay AS (
  SELECT invoice_id AS id,
         COALESCE(SUM((data->>'amount')::numeric), 0) AS paid_sum
  FROM payments
  WHERE archived = false
    AND invoice_id IS NOT NULL
    AND LOWER(COALESCE(data->>'status', '')) = 'completed'
  GROUP BY invoice_id
),
recalc AS (
  SELECT
    i.id,
    COALESCE(p.paid_sum, 0) AS paid,
    COALESCE((i.data->>'total')::numeric, 0) AS total,
    GREATEST(0, COALESCE((i.data->>'total')::numeric, 0) - COALESCE(p.paid_sum, 0)) AS remaining,
    CASE
      WHEN COALESCE(p.paid_sum, 0) <= 0 AND LOWER(COALESCE(i.data->>'status','')) = 'draft' THEN 'draft'
      WHEN COALESCE(p.paid_sum, 0) <= 0 THEN
        CASE WHEN COALESCE(i.data->>'dueDate','') <> '' AND (i.data->>'dueDate')::date < CURRENT_DATE THEN 'overdue' ELSE 'sent' END
      WHEN COALESCE(p.paid_sum, 0) + 0.009 >= COALESCE((i.data->>'total')::numeric, 0) THEN 'paid'
      WHEN COALESCE(i.data->>'dueDate','') <> '' AND (i.data->>'dueDate')::date < CURRENT_DATE THEN 'overdue'
      ELSE 'partially_paid'
    END AS new_status
  FROM invoices i
  LEFT JOIN pay p ON p.id = i.id
  WHERE i.archived = false
)
UPDATE invoices i
SET data = jsonb_set(
      jsonb_set(
        jsonb_set(i.data, '{paidAmount}', to_jsonb(r.paid), true),
        '{remainingAmount}', to_jsonb(r.remaining), true
      ),
      '{status}', to_jsonb(r.new_status), true
    ),
    updated_at = NOW()
FROM recalc r
WHERE i.id = r.id;

-- Recalculate client outstanding from outstanding invoice statuses
WITH client_out AS (
  SELECT
    client_id AS id,
    COALESCE(SUM(GREATEST(0, COALESCE((data->>'remainingAmount')::numeric, 0))), 0) AS outstanding,
    COALESCE(SUM(CASE WHEN LOWER(data->>'status') = 'paid' THEN COALESCE((data->>'total')::numeric, 0) ELSE 0 END), 0) AS revenue
  FROM invoices
  WHERE archived = false
    AND client_id IS NOT NULL
    AND LOWER(COALESCE(data->>'status','')) IN ('sent','partially_paid','overdue','paid')
  GROUP BY client_id
)
UPDATE clients c
SET data = jsonb_set(
      jsonb_set(c.data, '{outstanding}', to_jsonb(COALESCE(o.outstanding, 0)), true),
      '{revenue}', to_jsonb(COALESCE(o.revenue, 0)), true
    ),
    updated_at = NOW()
FROM (SELECT id FROM clients) ids
LEFT JOIN client_out o ON o.id = ids.id
WHERE c.id = ids.id;
