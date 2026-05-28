use std::env;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use defarm_miniapp::{DefarmMiniapp, Item};
use serde::Serialize;
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
                .unwrap_or_else(|_| "info,marketplace_miniapp=debug".into()),
        )
        .init();

    let api_key = env::var("DEFARM_API_KEY")
        .map_err(|_| "DEFARM_API_KEY is required (workspace ingestion key)")?;
    let circuit_id = env::var("DEFARM_CIRCUIT_ID")
        .map_err(|_| "DEFARM_CIRCUIT_ID is required")?;
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3031);

    let app = DefarmMiniapp::builder().api_key(api_key).build()?;

    let state = Arc::new(AppState {
        app,
        circuit_id,
    });

    let router = Router::new()
        .route("/health", get(health))
        .route("/listings", get(listings))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "marketplace miniapp listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

#[derive(Serialize)]
struct Listing {
    dfid: String,
    price_brl: Value,
    provenance: ListingProvenance,
}

#[derive(Serialize)]
struct ListingProvenance {
    receipt_id: String,
    proof_hash: String,
    preset: String,
}

async fn listings(State(state): State<Arc<AppState>>) -> Result<Json<Value>, AppError> {
    let items = state
        .app
        .items()
        .list(&state.circuit_id)
        .await
        .map_err(AppError::from)?;

    let for_sale: Vec<Item> = items
        .into_iter()
        .filter(|i| {
            i.metadata
                .as_ref()
                .and_then(|m| m.get("price_brl"))
                .is_some()
        })
        .collect();

    let mut listings = Vec::with_capacity(for_sale.len());
    for item in for_sale {
        let dfid = match item.dfid.clone() {
            Some(d) => d,
            None => continue,
        };
        let price = item
            .metadata
            .as_ref()
            .and_then(|m| m.get("price_brl"))
            .cloned()
            .unwrap_or(Value::Null);
        let disclosure = state
            .app
            .disclosures()
            .for_bank(&item.id, Some("marketplace"))
            .await
            .map_err(AppError::from)?;

        listings.push(Listing {
            dfid,
            price_brl: price,
            provenance: ListingProvenance {
                receipt_id: disclosure.receipt_id,
                proof_hash: disclosure.proof_hash,
                preset: disclosure.preset,
            },
        });
    }

    Ok(Json(json!({
        "listings": listings,
        "count": listings.len(),
        "circuit_id": state.circuit_id,
    })))
}

#[derive(Debug)]
enum AppError {
    Upstream(defarm_miniapp::Error),
}

impl From<defarm_miniapp::Error> for AppError {
    fn from(e: defarm_miniapp::Error) -> Self {
        Self::Upstream(e)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let AppError::Upstream(e) = self;
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": "defarm_upstream", "message": e.to_string()})),
        )
            .into_response()
    }
}
