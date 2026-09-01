# Example: lender credit pre-check (runnable)

The socket a bank or investor plugs into. Given a DFID, it returns a
`finance_basic` disclosure (the fields a lender is entitled to see) plus a
transparent, non-binding risk signal computed from the animal's **verified**
history — weight-gain trend, monotonicity, movement/GTA compliance, on-chain
anchor. It is the verifiable input to underwriting, not a credit decision.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

```bash
curl http://localhost:3003/credit/<DFID>
```

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `PORT` (see `.env.example`).
