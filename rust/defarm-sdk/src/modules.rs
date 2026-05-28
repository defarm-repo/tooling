use serde::Deserialize;
use serde_json::{json, Value};

use crate::client::DefarmClient;
use crate::error::Result;
use crate::types::{
    Circuit, DisclosureRequest, DisclosureResponse, Event, EventInput, Item, ItemIngestionInput,
    PartnerIntakeResponse, ReceiptSummary,
};

#[derive(Deserialize)]
#[serde(untagged)]
enum CollectionResponse<T> {
    Wrapped {
        #[serde(alias = "items", alias = "circuits", alias = "events", alias = "receipts")]
        items: Vec<T>,
    },
    Bare(Vec<T>),
}

impl<T> CollectionResponse<T> {
    fn into_inner(self) -> Vec<T> {
        match self {
            Self::Wrapped { items } => items,
            Self::Bare(items) => items,
        }
    }
}

pub struct CircuitsApi {
    client: DefarmClient,
}

impl CircuitsApi {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self) -> Result<Vec<Circuit>> {
        let resp: CollectionResponse<Circuit> = self.client.get("/api/circuits").await?;
        Ok(resp.into_inner())
    }

    pub async fn show(&self, id: &str) -> Result<Circuit> {
        self.client.get(&format!("/api/circuits/{id}")).await
    }
}

pub struct ItemsApi {
    client: DefarmClient,
}

impl ItemsApi {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self, circuit_id: Option<&str>) -> Result<Vec<Item>> {
        let path = match circuit_id {
            Some(cid) => format!("/api/items?circuit_id={}", urlencoded(cid)),
            None => "/api/items".to_string(),
        };
        let resp: CollectionResponse<Item> = self.client.get(&path).await?;
        Ok(resp.into_inner())
    }

    pub async fn show(&self, id: &str) -> Result<Item> {
        self.client.get(&format!("/api/items/{id}")).await
    }

    pub async fn create_via_ingestion(
        &self,
        source_circuit_id: &str,
        items: Vec<ItemIngestionInput>,
    ) -> Result<PartnerIntakeResponse> {
        let body = json!({
            "source_circuit_id": source_circuit_id,
            "items": items,
        });
        self.client.post("/v1/partner/ingestions", &body).await
    }
}

pub struct EventsApi {
    client: DefarmClient,
}

impl EventsApi {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self, circuit_id: Option<&str>) -> Result<Vec<Event>> {
        let path = match circuit_id {
            Some(cid) => format!("/api/events?circuit_id={}", urlencoded(cid)),
            None => "/api/events".to_string(),
        };
        let resp: CollectionResponse<Event> = self.client.get(&path).await?;
        Ok(resp.into_inner())
    }

    pub async fn show(&self, id: &str) -> Result<Event> {
        self.client.get(&format!("/api/events/{id}")).await
    }

    pub async fn add(&self, input: &EventInput) -> Result<Value> {
        self.client.post("/api/events", input).await
    }
}

pub struct DisclosuresApi {
    client: DefarmClient,
}

impl DisclosuresApi {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn create(&self, request: &DisclosureRequest) -> Result<DisclosureResponse> {
        self.client.post("/api/disclosures", request).await
    }
}

pub struct ReceiptsApi {
    client: DefarmClient,
}

impl ReceiptsApi {
    pub(crate) fn new(client: DefarmClient) -> Self {
        Self { client }
    }

    pub async fn list(&self, circuit_id: Option<&str>) -> Result<Vec<ReceiptSummary>> {
        let path = match circuit_id {
            Some(cid) => format!("/api/receipts?circuit_id={}", urlencoded(cid)),
            None => "/api/receipts".to_string(),
        };
        let resp: CollectionResponse<ReceiptSummary> = self.client.get(&path).await?;
        Ok(resp.into_inner())
    }

    pub async fn show(&self, id: &str) -> Result<Value> {
        self.client.get(&format!("/api/receipts/{id}")).await
    }
}

fn urlencoded(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}
