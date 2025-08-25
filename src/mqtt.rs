
use anyhow::Result;
use rumqttc::{AsyncClient, MqttOptions, QoS, Event, Packet};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tracing::{info, error, warn, debug};
use std::time::Duration;

use crate::{Config, TelemetryMessage};

#[derive(Debug, Deserialize, Serialize)]
struct MqttPayload {
    temperature_c: Option<f64>,
    humidity_pct: Option<f64>,
    ts: Option<String>,
}

pub async fn client_task(config: Config, tx: mpsc::UnboundedSender<TelemetryMessage>) {
    loop {
        if let Err(e) = run_mqtt_client(&config, &tx).await {
            error!("MQTT client error: {}", e);
            warn!("Retrying MQTT connection in 5 seconds...");
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

async fn run_mqtt_client(config: &Config, tx: &mpsc::UnboundedSender<TelemetryMessage>) -> Result<()> {
    let mut mqttoptions = MqttOptions::new(&config.mqtt_client_id, "localhost", 1883);
    mqttoptions.set_keep_alive(Duration::from_secs(30));
    mqttoptions.set_clean_session(true);

    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
    
    info!("Connecting to MQTT broker...");
    
    // Subscribe to the topic
    client.subscribe(&config.mqtt_topic_filter, QoS::AtMostOnce).await?;
    info!("Subscribed to topic: {}", config.mqtt_topic_filter);

    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                debug!("Received MQTT message on topic: {}", publish.topic);
                
                // Extract device_id from topic (sensors/{device_id}/telemetry)
                let device_id = extract_device_id(&publish.topic);
                
                match serde_json::from_slice::<MqttPayload>(&publish.payload) {
                    Ok(payload) => {
                        let timestamp = if let Some(ts_str) = &payload.ts {
                            chrono::DateTime::parse_from_rfc3339(ts_str)
                                .map(|dt| dt.with_timezone(&chrono::Utc))
                                .unwrap_or_else(|_| chrono::Utc::now())
                        } else {
                            chrono::Utc::now()
                        };

                        let message = TelemetryMessage {
                            device_id,
                            temperature_c: payload.temperature_c,
                            humidity_pct: payload.humidity_pct,
                            timestamp,
                        };

                        if let Err(e) = tx.send(message) {
                            error!("Failed to send message to database writer: {}", e);
                        }
                    }
                    Err(e) => {
                        warn!("Failed to parse MQTT payload: {}", e);
                    }
                }
            }
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                info!("Connected to MQTT broker");
            }
            Ok(_) => {}
            Err(e) => {
                error!("MQTT connection error: {}", e);
                return Err(e.into());
            }
        }
    }
}

fn extract_device_id(topic: &str) -> String {
    // Extract device_id from "sensors/{device_id}/telemetry"
    topic.split('/')
        .nth(1)
        .unwrap_or("unknown")
        .to_string()
}
