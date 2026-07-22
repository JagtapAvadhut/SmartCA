-- AI runtime settings (provider, model, encrypted API key). Never expose raw keys via Settings UI.
CREATE TABLE IF NOT EXISTS ai_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_archived ON ai_settings (archived);
