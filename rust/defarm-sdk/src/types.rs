use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Item in a circuit.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Item {
    pub id: String,
    pub dfid: Option<String>,
    pub value_chain: Option<String>,
    pub country: Option<String>,
    pub year: Option<i32>,
    pub status: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

/// Circuit summary.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Circuit {
    pub id: String,
    pub name: Option<String>,
    pub visibility: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

/// Event record returned by `events list/show`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Event {
    pub id: String,
    pub event_type: String,
    pub status: Option<String>,
    pub item_id: Option<String>,
    pub circuit_id: Option<String>,
    #[serde(default)]
    pub payload: Option<Value>,
}

/// Payload accepted by `events add`.
#[derive(Debug, Clone, Serialize)]
pub struct EventInput {
    pub item_id: String,
    pub circuit_id: String,
    pub event_type: String,
    pub payload: Value,
}

/// Single item input row for the partner ingestion endpoint.
#[derive(Debug, Clone, Serialize)]
pub struct ItemIngestionInput {
    pub value_chain: String,
    pub country: String,
    pub year: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

/// Response from `POST /v1/partner/ingestions`.
#[derive(Debug, Clone, Deserialize)]
pub struct PartnerIntakeResponse {
    pub summary: Value,
    #[serde(default)]
    pub items: Vec<Value>,
    #[serde(default)]
    pub errors: Vec<Value>,
}

/// Request body for `POST /api/disclosures`.
#[derive(Debug, Clone, Serialize)]
pub struct DisclosureRequest {
    pub item_id: String,
    pub preset: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in_days: Option<i32>,
}

/// Response from `POST /api/disclosures`.
#[derive(Debug, Clone, Deserialize)]
pub struct DisclosureResponse {
    pub receipt_id: String,
    pub preset: String,
    #[serde(default)]
    pub audience: Option<String>,
    pub proof_hash: String,
    #[serde(default)]
    pub expires_at: Option<String>,
    pub disclosed_payload: Value,
}

/// Receipt summary as returned by `receipts list`.
#[derive(Debug, Clone, Deserialize)]
pub struct ReceiptSummary {
    pub receipt_id: String,
    pub receipt_type: String,
    pub status: String,
    pub created_at: String,
    #[serde(default)]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub circuit_id: Option<String>,
    #[serde(default)]
    pub item_id: Option<String>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub audience: Option<String>,
    #[serde(default)]
    pub proof_hash: Option<String>,
}
