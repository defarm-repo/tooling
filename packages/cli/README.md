# @defarm/cli

CLI da DeFarm para operações de Tranche 1 (auth/workspace/circuits/items/events).

## Instalação (npm)

```bash
npx @defarm/cli --help
```

ou instalação global:

```bash
npm install -g @defarm/cli
defarm --help
```

## Uso

```bash
defarm workspace init --gateway https://gateway.defarm.net
defarm auth login --email <email> --password <senha>
defarm auth whoami
defarm circuits list
defarm items list --circuit <circuit_id>

# ou autenticação por API key
defarm auth api-key --key <api_key>
defarm circuits list

# saída JSON para automação
defarm circuits list --json
```

## Desenvolvimento local

```bash
cd tooling/defarm-sdk && npm install && npm run build
cd ../defarm-cli && npm install && npm run build
node dist/index.js --help
```

## Comandos

- `auth`: `login`, `api-key`, `logout`, `whoami`, `refresh`
- `workspace`: `init`, `status`, `config`, `reset`
- `circuits`: `list`, `show`, `join`, `members`
- `items`: `new`, `list`, `show`, `update`
- `events`: `add`, `list`, `show`, `update`
- `disclosures`: `create`
- `receipts`: `list`, `show`

## Formato de saída

- Por padrão, a CLI usa saída humana (tabelas/resumo + links web quando aplicável).
- Para integração em scripts, use `--json`.

## Testes

```bash
npm test
```

## Publicação no npm

Publicar primeiro `@defarm/sdk`, depois `@defarm/cli`.

```bash
npm publish --access public
```
