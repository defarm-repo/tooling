use defarm_sdk::{
    DefarmClient, DisclosureRequest, DisclosureResponse, Event, EventInput, Item,
    ItemIngestionInput, PartnerIntakeResponse, ReceiptSummary,
};
use serde_json::Value;

use crate::Result;

pub struct ItemHelpers {
    client: DefarmClient,
}

impl ItemHelpers {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self, circuit_id: &str) -> Result<Vec<Item>> {
        self.client.items().list(Some(circuit_id)).await
    }

    pub async fn show(&self, id: &str) -> Result<Item> {
        self.client.items().show(id).await
    }

    /// Create a BEEF item carrying a SISBOV canonical identifier.
    ///
    /// The backend enforces SISBOV format (14-15 digits). If `country` is
    /// omitted, `"BR"` is used. If `year` is omitted, the current UTC year
    /// is used.
    pub async fn create_beef_with_sisbov(
        &self,
        circuit_id: &str,
        sisbov: &str,
        country: Option<&str>,
        year: Option<i32>,
        extra_metadata: Option<Value>,
    ) -> Result<PartnerIntakeResponse> {
        let mut metadata = serde_json::Map::new();
        metadata.insert("sisbov".to_string(), Value::String(sisbov.to_string()));
        if let Some(Value::Object(extras)) = extra_metadata {
            for (k, v) in extras {
                metadata.insert(k, v);
            }
        }

        let now_year = chrono_year_fallback();
        let input = ItemIngestionInput {
            value_chain: "BEEF".to_string(),
            country: country.unwrap_or("BR").to_string(),
            year: year.unwrap_or(now_year),
            metadata: Some(Value::Object(metadata)),
        };
        self.client
            .items()
            .create_via_ingestion(circuit_id, vec![input])
            .await
    }
}

pub struct EventHelpers {
    client: DefarmClient,
}

impl EventHelpers {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn add(&self, input: &EventInput) -> Result<Value> {
        self.client.events().add(input).await
    }

    pub async fn list(&self, circuit_id: &str) -> Result<Vec<Event>> {
        self.client.events().list(Some(circuit_id)).await
    }

    /// Records an `item_movement` event with the required `gta_number` field.
    pub async fn record_movement(
        &self,
        item_id: &str,
        circuit_id: &str,
        from_lot: &str,
        to_lot: &str,
        gta_number: &str,
    ) -> Result<Value> {
        let payload = serde_json::json!({
            "from_lot": from_lot,
            "to_lot": to_lot,
            "gta_number": gta_number,
        });
        self.add(&EventInput {
            item_id: item_id.to_string(),
            circuit_id: circuit_id.to_string(),
            event_type: "item_movement".to_string(),
            payload,
        })
        .await
    }
}

pub struct DisclosureHelpers {
    client: DefarmClient,
}

impl DisclosureHelpers {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn create(&self, request: &DisclosureRequest) -> Result<DisclosureResponse> {
        self.client.disclosures().create(request).await
    }

    pub async fn for_bank(
        &self,
        item_id: &str,
        audience: Option<&str>,
    ) -> Result<DisclosureResponse> {
        self.create(&DisclosureRequest {
            item_id: item_id.to_string(),
            preset: "finance_basic".to_string(),
            audience: Some(audience.unwrap_or("bank_partner").to_string()),
            expires_in_days: None,
        })
        .await
    }

    pub async fn for_auditor(
        &self,
        item_id: &str,
        audience: Option<&str>,
    ) -> Result<DisclosureResponse> {
        self.create(&DisclosureRequest {
            item_id: item_id.to_string(),
            preset: "audit_basic".to_string(),
            audience: Some(audience.unwrap_or("certifier").to_string()),
            expires_in_days: None,
        })
        .await
    }

    pub async fn for_public(
        &self,
        item_id: &str,
        audience: Option<&str>,
    ) -> Result<DisclosureResponse> {
        self.create(&DisclosureRequest {
            item_id: item_id.to_string(),
            preset: "public_basic".to_string(),
            audience: Some(audience.unwrap_or("public").to_string()),
            expires_in_days: None,
        })
        .await
    }
}

pub struct ReceiptHelpers {
    client: DefarmClient,
}

impl ReceiptHelpers {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self, circuit_id: &str) -> Result<Vec<ReceiptSummary>> {
        self.client.receipts().list(Some(circuit_id)).await
    }

    pub async fn show(&self, id: &str) -> Result<Value> {
        self.client.receipts().show(id).await
    }
}

/// Approximates the current UTC year without pulling in a date library.
/// Good enough for ingestion year defaulting.
fn chrono_year_fallback() -> i32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // 1970-01-01 is year 1970. Approximate using 365.25 days/year.
    let years_since_epoch = (now as f64 / (365.25 * 86_400.0)).floor() as i32;
    1970 + years_since_epoch
}
