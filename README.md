# BidHouse

Online auction platform for high-value assets (watches, art, classic cars, real
estate) with identity verification, escrow-style custody of payments and an
on-chain record of every deal.

Academic project for the *Innovación* course, semester 2026-03. The premium
tier of the product is branded **BidLuxury**.

## Features

- **Sign-up with email verification** — 8-digit code sent by Supabase Auth
  (with a resend button), international phone input with country prefix, and
  country/city selection. Then login, profile (photo, description) and
  category preferences.
- **Three listing modes** — classic auction, fixed price, and mixed (auction
  with a "Buy it now" price that disappears after the first bid).
- **Bidding and instant purchase** — validated atomically in Postgres
  functions, so two simultaneous bids can never both win.
- **Automatic auction closing** — a scheduled job closes expired auctions,
  picks the winner, creates the contract and sends notifications.
- **Escrow contract** — `pending` (payment, 48 h) → `in custody` (shipping,
  5 days) → `shipped` (confirm receipt, 7 days) → `completed`, with
  cancellation, refunds and disputes. The seller is credited the amount minus a
  1 % platform fee as in-app balance.
- **Payments** — pay with in-app balance or with Mercado Pago Checkout Pro
  (sandbox); top up balance; account statement of every movement.
- **Delivery and logistics** — the buyer can coordinate delivery with an
  external carrier (FedEx, DHL, …) or directly with the seller.
- **Buyer–seller chat** for each contract.
- **BidLuxury membership** — monthly (USD 19.99) or yearly (USD 199.99) plan,
  paid with in-app balance or Mercado Pago, that unlocks premium auctions.
- **Blockchain registry** — a single Solidity contract on Sepolia records each
  milestone (payment, shipment, release, cancellation, dispute). No money and no
  personal data go on-chain; the UI links every milestone to Etherscan.

## Architecture

```
┌──────────────┐  HTTPS + JWT  ┌──────────────┐  REST / RPC  ┌──────────────────────────┐
│   Frontend   │ ────────────▶ │   Backend    │ ───────────▶ │ Supabase                 │
│ React + Vite │               │ Spring Boot  │              │ Postgres, Auth, Storage  │
└──────────────┘               │              │              └──────────────────────────┘
                               │              │  REST API    ┌──────────────────────────┐
                               │              │ ───────────▶ │ Mercado Pago             │
                               │              │              └──────────────────────────┘
                               │              │  JSON-RPC    ┌──────────────────────────┐
                               │              │ ───────────▶ │ Sepolia (web3j)          │
                               └──────────────┘              └──────────────────────────┘
```

The backend is the only component that holds secret keys. It validates the
Supabase JWT (ES256) on every protected route, builds PostgREST queries and
calls Postgres functions for anything that must be atomic (bids, purchases,
closing, payments, releases, membership purchases). The only direct call from
the browser to Supabase is the public email-verification step of sign-up.

## Tech stack

| Part | Stack |
| --- | --- |
| `frontend/` | React 19, TypeScript, Vite 8, React Router 7, libphonenumber-js |
| `backend/` | Java 21, Spring Boot 4.1, Spring Security (OAuth2 resource server), web3j, Maven |
| Database | Supabase (Postgres, Auth, Storage) |
| Payments | Mercado Pago Checkout Pro and subscriptions (sandbox, Colombian account / COP) |
| `blockchain/` | Solidity contract `RegistroBidHouse`, compiled and deployed to Sepolia with Bun + ethers |
| `docs/` | Course documentation (PDF) and email templates |

## Getting started

### Prerequisites

- Java 21
- [Bun](https://bun.sh) (the frontend and blockchain scripts use `bun.lock`)
- A Supabase project (ask a team member for access)
- Optional: Mercado Pago sandbox credentials, a public HTTPS tunnel to the
  frontend, and a Sepolia wallet

### 1. Environment variables

Each app has its own `.env`, and neither is committed. Copy the templates and
fill them in with the values from the Supabase dashboard
(*Project Settings → API*):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Keep them separate: `backend/.env` holds `SUPABASE_SECRET_KEY` (the
*service_role* key, which bypasses all RLS policies), while every `VITE_*`
variable in `frontend/.env` is compiled into the bundle and is public.

Optional backend variables:

| Variable | Purpose |
| --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Mercado Pago sandbox credentials. Without them the app starts and only payments fail. |
| `MERCADOPAGO_USD_TO_COP_RATE` | Rate used to charge memberships in COP (demo default: 4000). |
| `MERCADOPAGO_TEST_PAYER_EMAIL` | Sandbox test buyer email. Leave empty with real credentials. |
| `BIDHOUSE_FRONT_URL` | Public HTTPS URL of the frontend for Mercado Pago return URLs. Locally, use a tunnel to port 5173; Mercado Pago rejects `localhost`. |
| `BLOCKCHAIN_*` | Operator wallet, RPC node and contract address. Without them nothing is written on-chain. |

Only **one** backend in the team should have the `BLOCKCHAIN_*` values: two
backends signing with the same wallet collide.

### 2. Database

The base schema is managed from the Supabase dashboard. The changes made by the
team live in `backend/sql/`; run them in order in the Supabase SQL Editor:

```
fase1_pujas.sql          bids
fase2_cierre.sql         auction closing
fase3_compra.sql         instant purchase
fase4_pagos.sql          balance and payments
fase4b_entrega.sql       shipping and release
fase4c_blockchain.sql    on-chain milestones
fase5_preferencias.sql   category preferences
fase6_membresias.sql     memberships and premium auctions (fase6b if the table is missing)
fase6c_membresia_saldo.sql  membership purchase
fase7_chat.sql           buyer–seller chat
```

The `fase6_seed_*.sql` files load optional test data.

### 3. Run

```bash
# Backend — must be started from backend/ (the .env is read relative to the working directory)
cd backend && ./mvnw spring-boot:run          # http://localhost:8080

# Frontend
cd frontend && bun install && bun dev         # http://localhost:5173
```

On Windows use `.\mvnw.cmd spring-boot:run`. On Linux/macOS you may need
`chmod +x mvnw` the first time.

### 4. Blockchain (optional)

```bash
cd blockchain && bun install
bun run compilar      # compile the contract
bun run billetera     # create the operator wallet
bun run desplegar     # deploy to Sepolia
bun run verificar     # read wallet balance and all recorded deals from the chain
```

The wallet needs Sepolia test ETH from a faucet. It must never hold real money.

## Checks

```bash
cd frontend && bun run lint     # ESLint
cd frontend && bun run build    # type check (tsc -b) + production build
cd backend  && ./mvnw test      # backend tests
```

The test `supabaseEnvVarsAreLoadedFromDotenv` fails in any environment without
a `backend/.env` (CI included).

## Project structure

```
backend/
  sql/                     Schema changes and Postgres functions, run in order
  src/main/java/com/bidhouse/demo/
    Controladores/         REST controllers (all under /api)
    Modelos/               Input records with their own validation
    Servicios/             Business logic, Supabase / Mercado Pago / blockchain clients, scheduled jobs
    Config/                Security, CORS, scheduling
frontend/
  src/pages/               One page per file, with a sibling .css
  src/components/          Shared components (bids, payment panel, balance, chat, delivery, …)
  src/lib/                 Session handling and helpers
  src/api.ts               Single entry point for backend calls
blockchain/
  contratos/               RegistroBidHouse.sol
  scripts/                 Compile, wallet, deploy and verify scripts
docs/                      Course documentation and email templates
```

## Main API endpoints

| Area | Endpoints |
| --- | --- |
| Users | `POST /api/usuarios/registro`, `/existe`, `/login`, `/perfil/registro`, `/perfil/foto` · `GET/PATCH /api/usuarios/perfil` · `GET/PUT /api/usuarios/preferencias` |
| Auctions | `GET /api/subastas`, `/subastas/premium`, `/subastas/{id}`, `/subastas/{id}/pujas`, `/categorias` · `POST /api/subastas`, `/subastas/{id}/pujas`, `/subastas/{id}/compra`, `/activos/imagenes` |
| Payments | `POST /api/pagos/contratos/{id}/saldo`, `/contratos/{id}/mercadopago`, `/recargas`, `/confirmar`, `/sincronizar` · `GET /api/pagos/saldo` |
| Contracts | `POST /api/contratos/{id}/envio`, `/recepcion`, `/problema` · `GET/POST /api/contratos/{id}/mensajes` |
| Membership | `GET /api/membresias/planes`, `/estado` · `POST /api/membresias/comprar-con-saldo`, `/checkout-mercadopago`, `/checkout`, `/confirmar`, `/cancelar` |
| Webhooks | `/api/webhooks/mercadopago` |

Public routes: catalog, categories and status `GET`s, plus sign-up, exists and
login. Everything else requires `Authorization: Bearer <jwt>`. Errors are
returned as RFC 7807 Problem Details.

## Known limitations

- Without a public URL, Mercado Pago cannot redirect back or send webhooks:
  the user returns with the "Back to site" button, and the profile and payment
  panel sync approved payments when they open.
- The site shows USD. Contracts and top-ups are charged in COP using the same
  number; memberships are converted with `MERCADOPAGO_USD_TO_COP_RATE`.
- Payouts to sellers are not available in Colombia, so released funds stay as
  in-app balance; withdrawals are not implemented yet.
- Disputes are recorded but there is no resolution flow yet.
- The session token lasts one hour and is not refreshed.
- The catalog search box is not connected yet.

## Contributing

- Backend code, comments and commit messages are written in Spanish; prefix
  commits with the area when it applies (`Backend: …`, `Frontend: …`).
- Never commit `.env` files or real keys.
- See [AGENTS.md](AGENTS.md) for detailed architecture notes, database
  constraints and known pitfalls.
