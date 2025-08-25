
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, debug};

use crate::db::{Database, AggregatedReading};

#[derive(Debug, Deserialize)]
pub struct ReadingsQuery {
    device_id: String,
    range: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

pub fn create_router(db: Arc<Database>) -> Router {
    Router::new()
        .route("/api/devices", get(get_devices))
        .route("/api/readings", get(get_readings))
        .route("/api/health", get(health_check))
        .with_state(db)
}

async fn get_devices(
    State(db): State<Arc<Database>>,
) -> Result<Json<ApiResponse<Vec<String>>>, StatusCode> {
    debug!("GET /api/devices");
    
    match db.get_devices().await {
        Ok(devices) => Ok(Json(ApiResponse::success(devices))),
        Err(e) => {
            error!("Failed to get devices: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_readings(
    Query(params): Query<ReadingsQuery>,
    State(db): State<Arc<Database>>,
) -> Result<Json<ApiResponse<Vec<AggregatedReading>>>, StatusCode> {
    debug!("GET /api/readings?device_id={}&range={:?}", params.device_id, params.range);
    
    let range = params.range.as_deref().unwrap_or("1d");
    
    // Validate range parameter
    if !["1d", "1w", "1m", "6m", "1y"].contains(&range) {
        return Ok(Json(ApiResponse::error(
            "Invalid range. Must be one of: 1d, 1w, 1m, 6m, 1y".to_string()
        )));
    }
    
    match db.get_readings(&params.device_id, range).await {
        Ok(readings) => Ok(Json(ApiResponse::success(readings))),
        Err(e) => {
            error!("Failed to get readings: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn health_check(
    State(db): State<Arc<Database>>,
) -> Result<Json<ApiResponse<HashMap<String, String>>>, StatusCode> {
    debug!("GET /api/health");
    
    match db.health_check().await {
        Ok(_) => {
            let mut status = HashMap::new();
            status.insert("status".to_string(), "healthy".to_string());
            status.insert("timestamp".to_string(), chrono::Utc::now().to_rfc3339());
            Ok(Json(ApiResponse::success(status)))
        }
        Err(e) => {
            error!("Health check failed: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}
