# Example: livestock partnership tracker (runnable)

The "parceria pecuaria" is everywhere in Brazilian cattle raising: an investor
brings the animal at an entry weight, a rancher raises it, and they split the
**weight gained**. Today it runs on trust and paper. This miniapp reads the
animal's verified weighing history from DeFarm and computes the split — every
number backed by a typed, anchored event.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

```bash
curl "http://localhost:3002/partnership/<DFID>?split=0.5"
```

`split` is the rancher's share of the gain (default 0.5). Response: entry vs
current weight, gain in kg and arrobas, and the settlement split, plus the full
weighing history and a public `verify_yourself` URL.

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `PORT` (see `.env.example`).
