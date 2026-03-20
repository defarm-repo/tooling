# Contributing

Thanks for contributing to DeFarm Tooling.

## Scope

This repository is for public developer tooling only:
- TypeScript SDK
- CLI
- public-facing examples and tests

Do not add:
- backend services
- private operational docs
- secrets, tokens, or internal environment details

## Development

```bash
npm install
npm run build
npm test
```

## Pull requests

- Keep changes focused and reviewable.
- Preserve backwards compatibility whenever possible.
- Add or update tests when behavior changes.
- Update package READMEs when public usage changes.

## Publishing

For now, npm publishing may still happen from another internal repository.
This repository is the public source-of-truth for tooling code and docs.
