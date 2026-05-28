use defarm_miniapp::{DefarmMiniapp, Error};

#[tokio::test]
async fn builder_requires_credentials() {
    let err = DefarmMiniapp::builder().build().expect_err("must error");
    assert!(matches!(err, Error::MissingCredential));
}

#[tokio::test]
async fn builder_with_api_key_exposes_helpers() {
    let app = DefarmMiniapp::builder()
        .api_key("test")
        .build()
        .expect("must build");

    // All helper namespaces should be reachable.
    let _ = app.items();
    let _ = app.events();
    let _ = app.disclosures();
    let _ = app.receipts();
    let _ = app.sdk();
}
