//! DeFarm miniapp framework for Rust.
//!
//! Wraps [`defarm_sdk`] with helpers tuned to the most common miniapp shapes:
//! item creation with regulatory identifier enforcement, typed-event helpers,
//! preset-based disclosure helpers, and receipt access.
//!
//! ```no_run
//! use defarm_miniapp::DefarmMiniapp;
//!
//! # async fn run() -> Result<(), defarm_miniapp::Error> {
//! let app = DefarmMiniapp::builder()
//!     .api_key("defarm_xxxxxxxxxxxx")
//!     .build()?;
//!
//! let items = app.items().list("<circuit_id>").await?;
//! let proof = app.disclosures().for_bank(&items[0].id, None).await?;
//! println!("proof_hash: {}", proof.proof_hash);
//! # Ok(()) }
//! ```

use std::time::Duration;

use defarm_sdk::{DefarmClient, DefarmClientBuilder};

pub use defarm_sdk::{
    Circuit, DisclosureRequest, DisclosureResponse, Event, EventInput, Item, ItemIngestionInput,
    PartnerIntakeResponse, ReceiptSummary,
};

pub type Error = defarm_sdk::DefarmError;
pub type Result<T> = std::result::Result<T, Error>;

mod helpers;
pub use helpers::{DisclosureHelpers, EventHelpers, ItemHelpers, ReceiptHelpers};

/// High-level entry point. Holds a configured `DefarmClient` and exposes
/// helper namespaces.
#[derive(Clone, Debug)]
pub struct DefarmMiniapp {
    client: DefarmClient,
}

#[derive(Default)]
pub struct MiniappBuilder {
    inner: DefarmClientBuilder,
}

impl MiniappBuilder {
    pub fn gateway<S: Into<String>>(mut self, gateway: S) -> Self {
        self.inner = self.inner.gateway(gateway);
        self
    }

    pub fn api_key<S: Into<String>>(mut self, api_key: S) -> Self {
        self.inner = self.inner.api_key(api_key);
        self
    }

    pub fn access_token<S: Into<String>>(mut self, access_token: S) -> Self {
        self.inner = self.inner.access_token(access_token);
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.inner = self.inner.timeout(timeout);
        self
    }

    pub fn build(self) -> Result<DefarmMiniapp> {
        Ok(DefarmMiniapp {
            client: self.inner.build()?,
        })
    }
}

impl DefarmMiniapp {
    pub fn builder() -> MiniappBuilder {
        MiniappBuilder::default()
    }

    /// Escape hatch: full SDK access for flows the helpers don't cover.
    pub fn sdk(&self) -> &DefarmClient {
        &self.client
    }

    pub fn items(&self) -> ItemHelpers {
        ItemHelpers::new(self.client.clone())
    }

    pub fn events(&self) -> EventHelpers {
        EventHelpers::new(self.client.clone())
    }

    pub fn disclosures(&self) -> DisclosureHelpers {
        DisclosureHelpers::new(self.client.clone())
    }

    pub fn receipts(&self) -> ReceiptHelpers {
        ReceiptHelpers::new(self.client.clone())
    }
}
