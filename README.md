# Builder Scaffold

Templates and tools for building on EVE Frontier.

## Quickstart

**1. Clone the repo**:

```bash
mkdir -p workspace && cd workspace
git clone https://github.com/evefrontier/builder-scaffold.git
cd builder-scaffold
```

**2. Follow one flow** (world deploy → build custom contract → interact):

| Path | When to use |
|------|--------------|
| **[Docker](./docs/builder-flow-docker.md)** | No Sui/Node on host; run everything in a container (local or testnet). |
| **[Host](./docs/builder-flow-host.md)** | Sui CLI + Node.js on your machine; target local or testnet. |

By the end you’ll have a deployed world, a published custom contract (e.g. `smart_gate`), and scripts that call it.

## Prerequisites

- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Docker](https://docs.docker.com/get-docker/) (for Docker path) **or** [Sui CLI](https://docs.sui.io/guides/developer/getting-started) + Node.js (for Host path)

## What's in this repo

| Area | Purpose |
|------|---------|
| [docker/](./docker/readme.md) | Dev container (Sui CLI + Node.js) — used by the Docker flow. |
| [move-contracts/](./move-contracts/readme.md) | Custom Smart Assembly examples (e.g. [smart_gate](./move-contracts/smart_gate/)); build & publish. |
| [ts-scripts/](./ts-scripts/readme.md) | TypeScript scripts to call your contracts; run after publishing. |
| [setup-world/](./setup-world/readme.md) | What “deploy world” does and what gets created (world flow steps are in the flow guides). |
| [dapps/](./dapps/readme.md) | Reference dApp template (optional next step). |
| [zklogin/](./zklogin/readme.md) | zkLogin CLI for OAuth-based signing (optional). |


## Toll Gate & P2P Marketplace

An on-chain extension that adds two mechanics to EVE Frontier:

- **Toll Gate** — Gate owners charge a SUI fee for passage. Travelers pay the toll to receive a single-use `JumpPermit`. Fees accumulate in a shared `TollVault` that the admin can withdraw from.
- **P2P Marketplace** — Players list in-game items for sale with a SUI price. Buyers pay to purchase; proceeds go directly to the seller. Listings have configurable expiry and can be cancelled.

### Move Modules

| Module | Description |
|--------|-------------|
| `toll_gate::config` | Shared `ExtensionConfig`, `AdminCap`, and `TollAuth` witness type |
| `toll_gate::toll_gate` | Toll fee logic, `TollVault`, `pay_toll_and_jump()`, `withdraw_all_fees()` |
| `toll_gate::marketplace` | Listing CRUD, `create_listing()`, `buy_listing()`, `cancel_listing()` |

### Testnet Deployment

| Object | ID |
|--------|-----|
| Toll Gate Package | `0x3b77f80c7e5688fa425d4e3f5ffe33485c0b81ca4e588982911496944e637da8` |
| ExtensionConfig | `0x50e1663a3effea4d25462afc8a11a1f42d1343fbaf288735395cfb1fbff9ae25` |
| TollVault | `0x6da5cd1f6a1dd89c91eb9184ebb0876a72eaeb03c8357be12710a797eb6d7a2f` |
| Marketplace | `0x0516f77ebda055382f8c21e9144fc19219ca3310dbaec5962a3391f009dcf00b` |

### Setup

**1. Install dependencies:**

```bash
pnpm install
```

**2. Copy and fill `.env`:**

```bash
cp .env.example .env
```

Fill in your private keys and set `SUI_NETWORK=testnet` (or `localnet`).

**3. Deploy world contracts** (if not already done — see [Docker flow](./docs/builder-flow-docker.md)):

```bash
# Inside the Docker container:
cd /workspace/world-contracts
pnpm deploy-world testnet
pnpm configure-world testnet
pnpm create-test-resources testnet
```

**4. Build & publish toll_gate:**

```bash
cd move-contracts/toll_gate
sui move build --build-env testnet
sui client publish --build-env testnet --gas-budget 200000000
```

After publishing, copy the object IDs into your `.env`:

```
TOLL_GATE_PACKAGE_ID=0x...
TOLL_EXTENSION_CONFIG_ID=0x...
TOLL_VAULT_ID=0x...
MARKETPLACE_ID=0x...
```

### Running the Scripts

**Step 1 — Configure toll rules & marketplace:**

```bash
pnpm toll:configure
```

Sets the toll fee (default 0.1 SUI) and marketplace listing expiry (default 24h).

**Step 2 — Authorise TollAuth on gates:**

```bash
pnpm toll:authorise-gate
```

Registers the `TollAuth` extension on both gates so the toll contract can issue jump permits.

**Step 3 — Pay toll (Player A jumps through a gate):**

```bash
pnpm toll:pay
```

Player A pays the toll fee in SUI and receives a `JumpPermit` to pass through the gate.

**Step 4 — Withdraw fees (Admin collects revenue):**

```bash
pnpm toll:withdraw
```

Admin withdraws all accumulated fees from the `TollVault`.

**Step 5 — Create a marketplace listing (Player A sells an item):**

```bash
pnpm market:create-listing
```

Player A lists an in-game item for sale at a set SUI price.

**Step 6 — Buy a listing (Player B purchases):**

```bash
pnpm market:buy
```

Player B pays the listing price; SUI goes to the seller.

**Step 7 — Cancel a listing (Seller takes it back):**

```bash
pnpm market:cancel
```

Seller cancels their own active listing.

### All Scripts

| Script | Description |
|--------|-------------|
| `pnpm toll:configure` | Set toll fee & marketplace config |
| `pnpm toll:authorise-gate` | Authorise TollAuth on gates |
| `pnpm toll:pay` | Pay toll & get JumpPermit |
| `pnpm toll:withdraw` | Admin withdraws collected fees |
| `pnpm market:create-listing` | List an item for sale |
| `pnpm market:buy` | Buy a listed item |
| `pnpm market:cancel` | Cancel your own listing |

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and open an issue or feature request before submitting PRs.
