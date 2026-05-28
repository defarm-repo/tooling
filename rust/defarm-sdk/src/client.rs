use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Method, RequestBuilder};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use url::Url;

use crate::error::{DefarmError, Result};
use crate::modules::{CircuitsApi, DisclosuresApi, EventsApi, ItemsApi, ReceiptsApi};

const DEFAULT_GATEWAY: &str = "https://gateway.defarm.net";
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const USER_AGENT: &str = concat!("defarm-sdk-rust/", env!("CARGO_PKG_VERSION"));

/// HTTP client for the DeFarm public gateway.
///
/// Thread-safe. Clone freely — the inner state is shared via `Arc`.
#[derive(Debug, Clone)]
pub struct DefarmClient {
    inner: Arc<ClientInner>,
}

#[derive(Debug)]
struct ClientInner {
    http: reqwest::Client,
    gateway: Url,
    api_key: Option<String>,
    access_token: Option<String>,
}

#[derive(Debug, Default)]
pub struct DefarmClientBuilder {
    gateway: Option<String>,
    api_key: Option<String>,
    access_token: Option<String>,
    timeout: Option<Duration>,
}

impl DefarmClientBuilder {
    pub fn gateway<S: Into<String>>(mut self, gateway: S) -> Self {
        self.gateway = Some(gateway.into());
        self
    }

    /// Workspace ingestion API key (sent as `X-API-Key`).
    pub fn api_key<S: Into<String>>(mut self, api_key: S) -> Self {
        self.api_key = Some(api_key.into());
        self
    }

    /// JWT access token (sent as `Authorization: Bearer …`).
    pub fn access_token<S: Into<String>>(mut self, access_token: S) -> Self {
        self.access_token = Some(access_token.into());
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn build(self) -> Result<DefarmClient> {
        if self.api_key.is_none() && self.access_token.is_none() {
            return Err(DefarmError::MissingCredential);
        }

        let gateway_str = self
            .gateway
            .unwrap_or_else(|| DEFAULT_GATEWAY.to_string());
        let gateway = Url::parse(&gateway_str)
            .map_err(|e| DefarmError::InvalidGatewayUrl(format!("{gateway_str}: {e}")))?;

        let http = reqwest::Client::builder()
            .timeout(self.timeout.unwrap_or(Duration::from_secs(DEFAULT_TIMEOUT_SECS)))
            .user_agent(USER_AGENT)
            .build()
            .map_err(|source| DefarmError::Transport {
                url: gateway.to_string(),
                source,
            })?;

        Ok(DefarmClient {
            inner: Arc::new(ClientInner {
                http,
                gateway,
                api_key: self.api_key,
                access_token: self.access_token,
            }),
        })
    }
}

impl DefarmClient {
    pub fn builder() -> DefarmClientBuilder {
        DefarmClientBuilder::default()
    }

    pub fn gateway(&self) -> &str {
        self.inner.gateway.as_str()
    }

    pub fn items(&self) -> ItemsApi {
        ItemsApi::new(self.clone())
    }

    pub fn circuits(&self) -> CircuitsApi {
        CircuitsApi::new(self.clone())
    }

    pub fn events(&self) -> EventsApi {
        EventsApi::new(self.clone())
    }

    pub fn disclosures(&self) -> DisclosuresApi {
        DisclosuresApi::new(self.clone())
    }

    pub fn receipts(&self) -> ReceiptsApi {
        ReceiptsApi::new(self.clone())
    }

    pub(crate) async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = self.url(path)?;
        self.send_no_body(Method::GET, &url).await
    }

    pub(crate) async fn post<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = self.url(path)?;
        let req = self.request_builder(Method::POST, &url).json(body);
        self.send(req, &url).await
    }

    fn url(&self, path: &str) -> Result<String> {
        let base = self.inner.gateway.as_str().trim_end_matches('/');
        let p = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{path}")
        };
        Ok(format!("{base}{p}"))
    }

    fn request_builder(&self, method: Method, url: &str) -> RequestBuilder {
        let mut headers = HeaderMap::new();
        if let Some(token) = &self.inner.access_token {
            if let Ok(v) = HeaderValue::from_str(&format!("Bearer {token}")) {
                headers.insert(AUTHORIZATION, v);
            }
        }
        if let Some(key) = &self.inner.api_key {
            if let Ok(v) = HeaderValue::from_str(key) {
                headers.insert("X-API-Key", v);
            }
        }
        self.inner.http.request(method, url).headers(headers)
    }

    async fn send_no_body<T: DeserializeOwned>(&self, method: Method, url: &str) -> Result<T> {
        let req = self.request_builder(method, url);
        self.send(req, url).await
    }

    async fn send<T: DeserializeOwned>(&self, req: RequestBuilder, url: &str) -> Result<T> {
        let resp = req.send().await.map_err(|source| DefarmError::Transport {
            url: url.to_string(),
            source,
        })?;
        let status = resp.status();
        let bytes = resp.bytes().await.map_err(|source| DefarmError::Transport {
            url: url.to_string(),
            source,
        })?;

        if !status.is_success() {
            let body = String::from_utf8_lossy(&bytes).to_string();
            return Err(DefarmError::Api {
                status: status.as_u16(),
                url: url.to_string(),
                body,
            });
        }

        serde_json::from_slice::<T>(&bytes).map_err(|source| DefarmError::Decode {
            url: url.to_string(),
            source,
        })
    }
}
