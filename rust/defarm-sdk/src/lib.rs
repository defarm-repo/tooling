//! Official DeFarm SDK for Rust.
//!
//! Wraps the public DeFarm gateway (`https://gateway.defarm.net` by default)
//! and exposes typed access to the same endpoints used by `@defarm/sdk` and
//! `@defarm/cli`.
//!
//! # Quickstart
//!
//! ```no_run
//! use defarm_sdk::DefarmClient;
//!
//! # async fn run() -> Result<(), defarm_sdk::DefarmError> {
//! let client = DefarmClient::builder()
//!     .api_key("defarm_xxxxxxxxxxxx")
//!     .build()?;
//!
//! let circuits = client.circuits().list().await?;
//! println!("Found {} circuits", circuits.len());
//! # Ok(()) }
//! ```

mod client;
mod error;
mod modules;
mod types;

pub use client::{DefarmClient, DefarmClientBuilder};
pub use error::{DefarmError, Result};
pub use modules::{CircuitsApi, DisclosuresApi, EventsApi, ItemsApi, ReceiptsApi};
pub use types::{
    Circuit, DisclosureRequest, DisclosureResponse, Event, EventInput, Item, ItemIngestionInput,
    PartnerIntakeResponse, ReceiptSummary,
};
