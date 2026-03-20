# @defarm/cli

CLI for common DeFarm gateway operations.

## Install

```bash
npx @defarm/cli --help
```

or install globally:

```bash
npm install -g @defarm/cli
defarm --help
```

## Uso

```bash
defarm workspace init --gateway https://gateway.defarm.net
defarm auth login --email <email> --password <password>
defarm auth whoami
defarm circuits list
defarm items list --circuit <circuit_id>

# or API key authentication
defarm auth api-key --key <api_key>
defarm circuits list

# JSON output for scripts
defarm circuits list --json
```

## Local development

```bash
npm install
npm run build
node packages/cli/dist/index.js --help
```

## Commands

- `auth`: `login`, `api-key`, `logout`, `whoami`, `refresh`
- `workspace`: `init`, `status`, `config`, `reset`
- `circuits`: `list`, `show`, `join`, `members`
- `items`: `new`, `list`, `show`, `update`
- `events`: `add`, `list`, `show`, `update`
- `disclosures`: `create`
- `receipts`: `list`, `show`

## Output format

- Human-readable output by default.
- Use `--json` for script integration.

## Testes

```bash
npm test
```

## Publish

Publish `@defarm/sdk` before `@defarm/cli`.

```bash
npm publish --access public
```
