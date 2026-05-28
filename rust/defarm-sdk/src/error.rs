use thiserror::Error;

/// Crate-level Result alias.
pub type Result<T> = std::result::Result<T, DefarmError>;

#[derive(Debug, Error)]
pub enum DefarmError {
    #[error("missing credential: provide api_key or access_token via the builder")]
    MissingCredential,

    #[error("invalid gateway URL: {0}")]
    InvalidGatewayUrl(String),

    #[error("transport error talking to {url}: {source}")]
    Transport {
        url: String,
        #[source]
        source: reqwest::Error,
    },

    #[error("gateway returned HTTP {status} for {url}: {body}")]
    Api {
        status: u16,
        url: String,
        body: String,
    },

    #[error("failed to decode response from {url}: {source}")]
    Decode {
        url: String,
        #[source]
        source: serde_json::Error,
    },
}
