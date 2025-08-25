
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};

mod config;
mod mqtt;
mod db;
mod api;
mod web;

use config::Config;
use db::Database;

#[derive(Debug, Clone)]
pub struct TelemetryMessage {
    pub device_id: String,
    pub temperature_c: Option<f64>,
    pub humidity_pct: Option<f64>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting IoT MQTT Server");

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded");

    // Initialize database
    let db = Database::new(&config.pg_url).await?;
    db.migrate().await?;
    info!("Database initialized and migrated");

    let db = Arc::new(db);

    // Create channel for MQTT messages
    let (tx, rx) = mpsc::unbounded_channel::<TelemetryMessage>();

    // Start database writer task
    let db_writer = {
        let db = Arc::clone(&db);
        tokio::spawn(async move {
            db::writer_task(db, rx).await;
        })
    };

    // Start cleanup task
    let cleanup_task = {
        let db = Arc::clone(&db);
        tokio::spawn(async move {
            db::cleanup_task(db).await;
        })
    };

    // Start MQTT client
    let mqtt_task = {
        let config = config.clone();
        tokio::spawn(async move {
            mqtt::client_task(config, tx).await;
        })
    };

    // Start web server
    let web_task = {
        let config = config.clone();
        let db = Arc::clone(&db);
        tokio::spawn(async move {
            web::serve(config, db).await;
        })
    };

    info!("All services started");

    // Wait for any task to complete (they should run forever)
    tokio::select! {
        _ = db_writer => error!("Database writer task ended"),
        _ = cleanup_task => error!("Cleanup task ended"),
        _ = mqtt_task => error!("MQTT task ended"),
        _ = web_task => error!("Web task ended"),
    }

    Ok(())
}
