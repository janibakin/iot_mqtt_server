use anyhow::Result;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error, debug};
use std::time::Duration;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::TelemetryMessage;

#[derive(Debug, Clone)]
pub struct Database {
    pool: PgPool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Reading {
    pub device_id: String,
    pub ts: DateTime<Utc>,
    pub temperature_c: Option<f64>,
    pub humidity_pct: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AggregatedReading {
    pub ts: DateTime<Utc>,
    pub avg_temperature_c: Option<f64>,
    pub avg_humidity_pct: Option<f64>,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        // Optionally tune pool here with PgPoolOptions if you want
        let pool = PgPool::connect(database_url).await?;
        Ok(Database { pool })
    }

    pub async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        // Optionally ensure useful indexes exist
        self.ensure_indexes().await?;
        Ok(())
    }

    pub async fn ensure_indexes(&self) -> Result<()> {
        // Helps both ingestion and time-window queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings (device_id, ts)")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn insert_reading(&self, message: &TelemetryMessage) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO readings (device_id, ts, temperature_c, humidity_pct)
            VALUES ($1, $2, $3, $4)
            "#
        )
        .bind(&message.device_id)
        .bind(&message.timestamp)    // Ensure message.timestamp is UTC; if optional, default on server
        .bind(&message.temperature_c)
        .bind(&message.humidity_pct)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_devices(&self) -> Result<Vec<String>> {
        let rows = sqlx::query("SELECT DISTINCT device_id FROM readings ORDER BY device_id")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| row.get::<String, _>("device_id")).collect())
    }

    pub async fn get_readings(&self, device_id: &str, range: &str) -> Result<Vec<AggregatedReading>> {
        // Map UI ranges to window + bucket
        // Using text -> interval cast in SQL for safe parameterization.
        let (window_interval, bucket_interval) = match range {
            "1d" => ("1 day", "5 minutes"),
            "1w" => ("7 days", "1 hour"),
            "1m" => ("30 days", "6 hours"),
            "6m" => ("180 days", "1 day"),
            "1y" => ("365 days", "1 week"),
            _ => ("1 day", "5 minutes"),
        };

        // Postgres 15+: date_bin for clean bucketing.
        // Note: This won’t generate empty buckets (only bins that have data).
        // If you need gap-filling, we can switch to generate_series.
        let rows = sqlx::query(
            r#"
            SELECT
                date_bin($2::interval, ts, '1970-01-01 00:00:00+00'::timestamptz) AS ts,
                AVG(temperature_c) AS avg_temperature_c,
                AVG(humidity_pct)  AS avg_humidity_pct
            FROM readings
            WHERE device_id = $3
              AND ts >= now() - $1::interval
            GROUP BY ts
            ORDER BY ts
            "#
        )
        .bind(window_interval)   // $1::interval
        .bind(bucket_interval)   // $2::interval
        .bind(device_id)         // $3
        .fetch_all(&self.pool)
        .await?;

        let readings = rows.into_iter().map(|row| AggregatedReading {
            ts: row.get::<DateTime<Utc>, _>("ts"),
            avg_temperature_c: row.get::<Option<f64>, _>("avg_temperature_c"),
            avg_humidity_pct: row.get::<Option<f64>, _>("avg_humidity_pct"),
        }).collect();

        Ok(readings)
    }

    pub async fn cleanup_old_data(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM readings WHERE ts < NOW() - INTERVAL '1 year'")
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    pub async fn health_check(&self) -> Result<()> {
        sqlx::query("SELECT 1").fetch_one(&self.pool).await?;
        Ok(())
    }
}

pub async fn writer_task(db: Arc<Database>, mut rx: mpsc::UnboundedReceiver<TelemetryMessage>) {
    info!("Database writer task started");

    while let Some(message) = rx.recv().await {
        debug!("Writing telemetry message: {:?}", message);

        if let Err(e) = db.insert_reading(&message).await {
            error!("Failed to insert reading: {}", e);
        }
    }

    error!("Database writer task ended");
}

pub async fn cleanup_task(db: Arc<Database>) {
    info!("Database cleanup task started");

    let mut interval = tokio::time::interval(Duration::from_secs(3600)); // Run every hour

    loop {
        interval.tick().await;

        match db.cleanup_old_data().await {
            Ok(deleted_count) => {
                if deleted_count > 0 {
                    info!("Cleaned up {} old readings", deleted_count);
                }
            }
            Err(e) => {
                error!("Failed to cleanup old data: {}", e);
            }
        }
    }
}
