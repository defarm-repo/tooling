# DeFarm Tooling

Public-facing source repository for DeFarm developer tooling.

This workspace is intentionally narrow:
- `packages/sdk`: TypeScript SDK for DeFarm gateway integrations.
- `packages/cli`: CLI built on top of the SDK.

What is included:
- source code
- minimal tests with mocked servers
- package manifests and TypeScript configs

What is intentionally excluded:
- backend services
- internal docs
- private assistant/config files
- live E2E scripts and operational secrets

## Workspace

```bash
npm install
npm run build
npm test
```

## Layout

```text
tooling/
  packages/
    sdk/
    cli/
```

## Notes

- `engines` remains the private product/backend repository.
- This repo exists to present and evolve the public tooling code separately.
- npm publishing can continue from `engines` for now, then move here later if desired.
