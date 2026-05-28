use defarm_sdk::{DefarmClient, DefarmError, DisclosureRequest, ItemIngestionInput};
use httpmock::{Method, MockServer};
use serde_json::json;

#[tokio::test]
async fn builder_requires_credentials() {
    let err = DefarmClient::builder().build().expect_err("must error");
    assert!(matches!(err, DefarmError::MissingCredential));
}

#[tokio::test]
async fn builder_accepts_api_key() {
    let client = DefarmClient::builder()
        .api_key("k")
        .gateway("https://example.invalid")
        .build()
        .expect("must build");
    assert!(client.gateway().starts_with("https://example.invalid"));
}

#[tokio::test]
async fn circuits_list_handles_wrapped_response() {
    let server = MockServer::start_async().await;
    let _m = server
        .mock_async(|when, then| {
            when.method(Method::GET).path("/api/circuits");
            then.status(200)
                .header("content-type", "application/json")
                .json_body(json!({
                    "circuits": [
                        {"id": "c-1", "name": "Demo"}
                    ]
                }));
        })
        .await;

    let client = DefarmClient::builder()
        .gateway(server.base_url())
        .api_key("test")
        .build()
        .unwrap();

    let list = client.circuits().list().await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, "c-1");
}

#[tokio::test]
async fn items_create_via_ingestion_posts_expected_body() {
    let server = MockServer::start_async().await;
    let _m = server
        .mock_async(|when, then| {
            when.method(Method::POST)
                .path("/v1/partner/ingestions")
                .header("X-API-Key", "test")
                .json_body_partial(
                    r#"{"source_circuit_id":"c-1","items":[{"value_chain":"BEEF","country":"BR","year":2026}]}"#,
                );
            then.status(200).json_body(json!({
                "summary": {"status":"completed"},
                "items": [{"dfid":"DFID-BEEF-BR-2026-000001-aaaaaa"}],
                "errors": []
            }));
        })
        .await;

    let client = DefarmClient::builder()
        .gateway(server.base_url())
        .api_key("test")
        .build()
        .unwrap();

    let resp = client
        .items()
        .create_via_ingestion(
            "c-1",
            vec![ItemIngestionInput {
                value_chain: "BEEF".into(),
                country: "BR".into(),
                year: 2026,
                metadata: Some(json!({"sisbov":"105500497533895"})),
            }],
        )
        .await
        .unwrap();

    assert_eq!(resp.items.len(), 1);
}

#[tokio::test]
async fn disclosure_returns_typed_response() {
    let server = MockServer::start_async().await;
    let _m = server
        .mock_async(|when, then| {
            when.method(Method::POST).path("/api/disclosures");
            then.status(200).json_body(json!({
                "receipt_id": "r-1",
                "preset": "finance_basic",
                "audience": "bank_partner",
                "proof_hash": "deadbeef",
                "disclosed_payload": {"item": {"id":"i-1"}}
            }));
        })
        .await;

    let client = DefarmClient::builder()
        .gateway(server.base_url())
        .api_key("test")
        .build()
        .unwrap();

    let resp = client
        .disclosures()
        .create(&DisclosureRequest {
            item_id: "i-1".into(),
            preset: "finance_basic".into(),
            audience: Some("bank_partner".into()),
            expires_in_days: None,
        })
        .await
        .unwrap();

    assert_eq!(resp.receipt_id, "r-1");
    assert_eq!(resp.proof_hash, "deadbeef");
}

#[tokio::test]
async fn api_error_surfaces_status_and_body() {
    let server = MockServer::start_async().await;
    let _m = server
        .mock_async(|when, then| {
            when.method(Method::GET).path("/api/circuits");
            then.status(403).body(r#"{"error":"api_key_scope_forbidden"}"#);
        })
        .await;

    let client = DefarmClient::builder()
        .gateway(server.base_url())
        .api_key("test")
        .build()
        .unwrap();

    let err = client.circuits().list().await.expect_err("must error");
    match err {
        DefarmError::Api { status, body, .. } => {
            assert_eq!(status, 403);
            assert!(body.contains("api_key_scope_forbidden"));
        }
        other => panic!("expected Api error, got {other:?}"),
    }
}
