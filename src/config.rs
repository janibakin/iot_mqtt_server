
use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub app_addr: String,
    pub mqtt_broker_url: String,
    pub mqtt_client_id: String,
    pub mqtt_topic_filter: String,
    pub pg_url: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        
        let config = Config {
            app_addr: std::env::var("APP_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            mqtt_broker_url: std::env::var("MQTT_BROKER_URL").unwrap_or_else(|_| "mqtt://localhost:1883".to_string()),
            mqtt_client_id: std::env::var("MQTT_CLIENT_ID").unwrap_or_else(|_| "pi-telemetry".to_string()),
            mqtt_topic_filter: std::env::var("MQTT_TOPIC_FILTER").unwrap_or_else(|_| "sensors/+/telemetry".to_string()),
            pg_url: std::env::var("PG_URL").unwrap_or_else(|_| "postgres://pi:password@localhost:5432/telemetry".to_string()),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        };

        Ok(config)
    }
}
