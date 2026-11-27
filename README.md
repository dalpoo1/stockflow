# StockFlow

Inventory and sales management for a warehouse supervisor. StockFlow tracks products, records stock in/out with a permanent movement ledger, and creates sales orders that consume inventory — with concurrency-safe stock and transactional cancellation that restores stock exactly once.

A full vertical slice: PostgreSQL → Go API → React + TypeScript UI.

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Data model](#data-model)
- [How orders work](#how-orders-work)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [Known limitations](#known-limitations)
- [Time spent](#time-spent)

## What it does

- Product catalog: list, search (debounced), filter, paginate, create, update, delete.
- Stock adjustment (in/out) with validation and a permanent movement history.
- Multi-item sales orders where prices and totals come from the server, never the client.
- Order detail and cancellation that restores stock exactly once.
- Dashboard summary cards (total products, active products, total stock value, low-stock count).

## Architecture

```
React + TypeScript (Vite)          Go (chi + pgx)               PostgreSQL 16
─────────────────────────          ────────────────              ─────────────
  Pages / components  ──HTTP──►  handlers (JSON, status) ──►  store (transactions)
        │                              │                             │
        └── TanStack Query ── axios ──┘   error envelope         migrations + seed
```

The frontend calls the API through a single axios client (`/api` base URL, resolved by the Vite dev proxy in development and by nginx in Docker). Every request returns the same JSON error envelope, which the client parses in one place and surfaces in the UI.

All business rules that touch stock live in the `store` package and run inside database transactions. The HTTP layer only parses input, maps errors to status codes, and serializes responses.

## Tech stack

| Layer    | Technology                                                        |
|----------|-------------------------------------------------------------------|
| Database | PostgreSQL 16                                                     |
| Backend  | Go 1.22 module, `net/http` + `chi` v5, `pgx/v5` (built in Docker with Go 1.24) |
| Frontend | React 18, TypeScript (strict), Vite 5, Tailwind CSS, TanStack Query v5, axios, React Router 6 |
| Tests    | Go `testing` + testcontainers (integration), Vitest (unit)        |
| Runtime  | Docker Compose (Postgres + backend + frontend served by nginx)    |

## Repository layout

```
stockflow/
├── backend/
│   ├── cmd/server/            # entrypoint; -migrate flag applies migrations and exits
│   ├── internal/
│   │   ├── config/            # environment config
│   │   ├── model/             # domain types and JSON contract
│   │   ├── store/             # data access + transactional business rules
│   │   ├── httpapi/           # chi router, handlers, error envelope
│   │   └── migrate/           # in-process migration runner
│   ├── migrations/            # 0001_schema.sql, 0002_seed.sql (also mounted into Postgres)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # types, client (error parsing), endpoint functions, query keys
│   │   ├── components/        # table, modals, badges, cards, states
│   │   ├── pages/             # Products, Orders, Order detail
│   │   ├── hooks/             # useDebounce
│   │   └── utils/             # format, validation, errorMessage (unit-tested)
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Prerequisites

- **Docker** with the Compose plugin — for the one-command run and the backend integration tests.
- **Go 1.22+** — for local backend development and tests.
- **Node 18+** — for local frontend development.

## Quick start (Docker)

```bash
docker compose up -d --build
```

This builds and starts all three services. Migrations and seed data are applied automatically on first boot.

| Service   | URL                   |
|-----------|-----------------------|
| Frontend  | http://localhost:5173 |
| Backend   | http://localhost:8080 |
| Postgres  | localhost:5432 (user/password/database: `stockflow`) |

The frontend container (nginx) proxies `/api` to the backend, and the backend connects to `db`. No further configuration is needed.

**Stop:** `docker compose down`

**Reset the database:** `docker compose down -v` (wipes the volume; migrations and seed re-apply on the next `up`).

## Local development

Run the database in Docker and the backend and frontend on your machine:

```bash
# 1. Database (migrations + seed apply automatically on first boot)
docker compose up -d db

# 2. Backend
cd backend
go run ./cmd/server

# 3. Frontend (Vite proxies /api to localhost:8080, so no CORS setup)
cd frontend
npm install
npm run dev
```

The backend applies migrations at startup when running this way. You can also apply them standalone:

```bash
cd backend
go run ./cmd/server -migrate
```

> **Windows note:** `go test -race` needs a C compiler (cgo). Install MinGW-w64/TDM-GCC, or run it under WSL2/Linux.

## Environment variables

| Variable          | Default                                                                      | Purpose                                   |
|-------------------|------------------------------------------------------------------------------|-------------------------------------------|
| `PORT`            | `8080`                                                                       | Backend listen port                       |
| `DATABASE_URL`    | `postgres://stockflow:stockflow@localhost:5432/stockflow?sslmode=disable`    | PostgreSQL connection string              |
| `TEST_DATABASE_URL` | *(unset)*                                                                   | Optional; runs integration tests against an existing database instead of spinning up a test container |

## API reference

All responses are JSON. Every error uses one envelope:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "sku": "SKU-0002", "available": 6 } }
```

### Endpoints

| Method | Path                            | Description                                                        |
|--------|---------------------------------|--------------------------------------------------------------------|
| GET    | `/api/summary`                  | Dashboard summary counters                                        |
| GET    | `/api/products`                 | List products; `?search=&status=&page=&limit=`                     |
| POST   | `/api/products`                 | Create product (sku unique, name required, price ≥ 0); returns `201` |
| GET    | `/api/products/{id}`            | Single product                                                     |
| PUT    | `/api/products/{id}`            | Partial update (sku/name/price/is_active); `404` if missing        |
| DELETE | `/api/products/{id}`            | Delete; `204`, or `409 PRODUCT_HAS_HISTORY` if it has movement history |
| POST   | `/api/products/{id}/stock`      | Adjust stock; `{"type":"in"|"out","qty":n,"note":"..."}`           |
| GET    | `/api/products/{id}/movements`  | Movement history, newest first (`{"data":[...]}`)                  |
| GET    | `/api/orders`                   | List orders; `?page=&limit=`                                       |
| POST   | `/api/orders`                   | Create order (see rules); `201`                                    |
| GET    | `/api/orders/{id}`              | Order, items, status, total                                       |
| POST   | `/api/orders/{id}/cancel`       | Cancel and restore stock; `409 ORDER_ALREADY_CANCELLED` if already cancelled |

`/api/summary` and `GET /api/orders` are additions beyond the core product/order contract; the rest match the assignment specification.

### Product list filters

The `status` parameter accepts `all`, `active`, `inactive`, and `low`.

- `low` means active products with stock ≤ 10 (same rule as the summary's low-stock counter).
- `search` matches SKU or name case-insensitively.

### Error codes

| HTTP | Code                      | Context                                      |
|------|---------------------------|----------------------------------------------|
| 400  | `VALIDATION`              | Bad input, with `message` and/or `fields`    |
| 404  | `NOT_FOUND`               | Missing product/order                        |
| 409  | `INSUFFICIENT_STOCK`      | Overdraw; `sku` and `available`              |
| 409  | `PRODUCT_HAS_HISTORY`     | Delete on a product with movement history    |
| 409  | `ORDER_ALREADY_CANCELLED` | Cancel on an already-cancelled order         |
| 500  | `INTERNAL`                | Unexpected server error                      |

### curl examples

```bash
# List products (search + filter + page)
curl 'http://localhost:8080/api/products?search=beras&status=active&page=1&limit=20'

# Create a product
curl -X POST http://localhost:8080/api/products \
  -H 'Content-Type: application/json' \
  -d '{"sku":"SKU-0100","name":"New Item","price":50000}'

# Adjust stock out beyond available stock (returns 409)
curl -X POST http://localhost:8080/api/products/2/stock \
  -H 'Content-Type: application/json' \
  -d '{"type":"out","qty":999,"note":"damaged"}'

# Movement history
curl http://localhost:8080/api/products/1/movements

# Create an order (server computes the total and unit prices)
curl -X POST http://localhost:8080/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customer":"Toko Maju","items":[{"sku":"SKU-0001","qty":2},{"sku":"SKU-0006","qty":1}]}'

# Get an order
curl http://localhost:8080/api/orders/1

# Cancel an order (restores stock)
curl -X POST http://localhost:8080/api/orders/1/cancel

# Delete a product (409 if it has history)
curl -X DELETE http://localhost:8080/api/products/12

# Idempotent order creation (retries return the same order instead of double-ordering)
curl -X POST http://localhost:8080/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 8b4f9c2e-...' \
  -d '{"customer":"Toko Maju","items":[{"sku":"SKU-0001","qty":1}]}'
```

## Data model

| Table               | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| `products`          | SKU, name, price (integer IDR), stock, active flag, timestamps |
| `stock_movements`   | Immutable ledger of every stock change (`in`/`out`)            |
| `sales_orders`      | Customer, status (`CREATED`/`CANCELLED`), server-computed total, idempotency key |
| `sales_order_items` | Order lines with a `unit_price` snapshot at order time         |

Constraints are enforced in the database: `stock` and `price` cannot be negative, `qty` must be positive, `sku` is unique, and movement `type` is restricted to `in`/`out`.

## How orders work

1. The request is validated before anything is written: unknown SKU, quantity ≤ 0, duplicate SKUs, and empty items are rejected with `400`.
2. Prices are read from the `products` table; the client never supplies a price, and the total is computed server-side.
3. Stock for all items is decremented in one transaction. Each decrement uses a guarded update:

   ```sql
   UPDATE products SET stock = stock - $1 WHERE sku = $2 AND stock >= $1 RETURNING sku;
   ```

   If any line would overdraw, the whole transaction rolls back and returns `409 INSUFFICIENT_STOCK` with the failing `sku` and `available` stock. No order, item, or stock change is left behind.

4. On success the order, its items (with price snapshots), and one `out` movement per line are committed together.

Cancellation reverses this in a single transaction: the order row is locked (`SELECT ... FOR UPDATE`), its status changes to `CANCELLED` with `cancelled_at`, and each line's stock is restored with a matching `in` movement. A second cancel returns `409` and never restores stock twice.

## Testing

### Backend

```bash
cd backend
go test ./...                    # unit + integration (testcontainers; needs Docker)
go test -race ./internal/store/  # concurrency test (needs cgo on Windows)
```

Integration tests run against a real Postgres and cover: insufficient stock writes nothing, the stock-adjustment happy path, order happy path with server-computed totals, concurrent orders (10 workers against stock of 5 → exactly 5 succeed, stock ends at 0, never negative), cancellation, repeated cancellation, and product deletion with/without history.

Set `TEST_DATABASE_URL` to run these against an already-running database (for example `docker compose up db`) instead of a throwaway container.

### Frontend

```bash
cd frontend
npm test   # Vitest unit tests for validation and formatting
```

## Design decisions

- **Money is integer IDR.** No floating point; the UI formats with `Rp 1.234.567`.
- **`last_movement_at` is derived**, not stored — it is `MAX(created_at)` from `stock_movements`. The ledger is the single source of truth, so there is no redundant column to drift.
- **`stock_movements` is an immutable ledger.** It is never deleted (deleting a product with history is refused). Manual adjustments, order lines, and cancellations all write movements, so the ledger always reconciles with `products.stock`.
- **Order creation writes `out` movements** (note `"Order #n"`) and cancellation writes `in` movements (note `"Cancel order #n"`), keeping a complete audit trail.
- **Concurrency safety.** Stock decrements use a guarded `UPDATE` rather than a `SELECT`-then-`UPDATE`. Cancellation serializes concurrent cancels with `SELECT ... FOR UPDATE` on the order row.
- **`unit_price` is a snapshot** at order time, so historical orders keep their original pricing even if a product's price later changes.
- **Product creation starts at stock 0.** The creation API does not accept an initial stock, so initial stock is entered as a stock `in` adjustment, which also records a movement.
- **Summary semantics.** Total products and total stock value include inactive products (inventory may still physically exist); active and low-stock counts apply to active products only.

## Known limitations

- **Inactive products can still be ordered.** The API does not reject orders for inactive products; the UI marks them but does not block them.
- **No authentication or rate limiting.** The API is unauthenticated and unthrottled — acceptable for a test, not for production.
- **No daily sales report** (`GET /api/reports/daily-sales`) and no movement-history pagination.
- **In-process migration runner** works, but a dedicated tool (golang-migrate, goose) would add down-migrations and versioned rollback.
- **No CI pipeline**; `go test -race` and `vitest` are run manually.

## Time spent

Roughly 3 hours of focused work end-to-end (schema → Go API → tests → React UI → Docker → docs). The concurrency test, error-envelope mapping, and one-command Docker run took most of that time.
