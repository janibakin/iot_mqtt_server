
use axum::Router;
use std::sync::Arc;
use tower_http::services::ServeDir;
use tracing::{info, error};

use crate::{Config, db::Database, api};

pub async fn serve(config: Config, db: Arc<Database>) {
    let app = Router::new()
        .merge(api::create_router(db))
        .nest_service("/", ServeDir::new("static"));

    let listener = match tokio::net::TcpListener::bind(&config.app_addr).await {
        Ok(listener) => listener,
        Err(e) => {
            error!("Failed to bind to {}: {}", config.app_addr, e);
            return;
        }
    };

    info!("Web server listening on {}", config.app_addr);

    if let Err(e) = axum::serve(listener, app).await {
        error!("Web server error: {}", e);
    }
}
