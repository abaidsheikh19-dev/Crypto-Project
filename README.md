# Secure Crypto-Payment Product Store

This repository contains the initial scaffolding for a privacy-focused crypto storefront built with Next.js, PostgreSQL, Prisma, and BTCPay.

## Local development

1. Copy `.env.example` to `.env` and adjust the values.
2. Start the local services:
   `docker compose -f docker-compose.local.yml up -d`
3. Install dependencies:
   `npm install`
4. Run the app:
   `npm run dev`
5. Open http://localhost:3000

## Project structure

- `app/` – storefront routes and API endpoints
- `src/` – domain logic, validation, encryption, BTCPay integration, auth, pricing
- `prisma/` – Prisma schema and migrations
- `infra/` – server provisioning and backup scripts
- `docs/` – operations and security docs
- `tests/` – unit, integration, and end-to-end tests

## First milestone status

The repository includes the hardened baseline, Cloudflare documentation, local stack, CI workflow, and a health endpoint. Human-only setup steps remain for the live VPS, domain, Cloudflare, and BTCPay account creation.
