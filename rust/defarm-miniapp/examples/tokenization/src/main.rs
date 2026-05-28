use std::env;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use defarm_miniapp::DefarmMiniapp;
use serde_json::{json, Value};

#[derive(Clone)]
struct AppState {
    app: DefarmMiniapp,
    circuit_id: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tokenization_miniapp=debug".into()),
        )
        .init();

    let api_key = env::var("DEFARM_API_KEY")
        .map_err(|_| "DEFARM_API_KEY is required (workspace ingestion key)")?;
    let circuit_id = env::var("DEFARM_CIRCUIT_ID")
        .map_err(|_| "DEFARM_CIRCUIT_ID is required")?;
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3030);

    let app = DefarmMiniapp::builder().api_key(api_key).build()?;

    let state = Arc::new(AppState {
        app,
        circuit_id,
    });

    let router = Router::new()
        .route("/health", get(health))
        .route("/token/:dfid", get(token_lookup))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "tokenization miniapp listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

async fn token_lookup(
    State(state): State<Arc<AppState>>,
    Path(dfid): Path<String>,
) -> Result<Json<Value>, AppError> {
    let items = state
        .app
        .items()
        .list(&state.circuit_id)
        .await
        .map_err(AppError::from)?;

    let item = items
        .into_iter()
        .find(|i| i.dfid.as_deref() == Some(dfid.as_str()))
        .ok_or_else(|| AppError::NotFound(format!("DFID {dfid} not found in circuit")))?;

    let disclosure = state
        .app
        .disclosures()
        .for_auditor(&item.id, Some("tokenization-miniapp"))
        .await
        .map_err(AppError::from)?;

    Ok(Json(json!({
        "dfid": dfid,
        "item": item,
        "provenance": {
            "receipt_id": disclosure.receipt_id,
            "proof_hash": disclosure.proof_hash,
            "preset": disclosure.preset,
            "audience": disclosure.audience,
            "disclosed_payload": disclosure.disclosed_payload,
        }
    })))
}

#[derive(Debug)]
enum AppError {
    NotFound(String),
    Upstream(defarm_miniapp::Error),
}

impl From<defarm_miniapp::Error> for AppError {
    fn from(e: defarm_miniapp::Error) -> Self {
        Self::Upstream(e)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, json!({"error": "not_found", "message": msg})),
            AppError::Upstream(e) => (
                StatusCode::BAD_GATEWAY,
                json!({"error": "defarm_upstream", "message": e.to_string()}),
            ),
        };
        (status, Json(body)).into_response()
    }
}
