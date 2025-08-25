
-- Create readings table
CREATE TABLE readings (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    temperature_c DOUBLE PRECISION,
    humidity_pct DOUBLE PRECISION
);

-- Create indexes for efficient queries
CREATE INDEX idx_readings_device_ts ON readings (device_id, ts DESC);
CREATE INDEX idx_readings_ts ON readings (ts DESC);
