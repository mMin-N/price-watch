# Phase 1 Public Beta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public beta in three waves (risk-first), starting with rate limits, monitoring, and legal compliance.

**Architecture:** Next.js monolith + Supabase; site parsers behind `PriceProvider`; Supabase RPC for rate limits; cron jobs for refresh, health-check, and stats.

**Tech Stack:** Next.js 16, Supabase, ZenRows, Resend, Vitest, Playwright (Wave 3)

**Spec:** `docs/superpowers/specs/2026-06-17-phase1-public-beta-design.md`

---

## Wave 1 — Risk + Launch (in progress)

- [x] Migration `007_phase1_observability_rate_limits.sql`
- [x] `lib/api/rate-limit.ts` + wire preview / add / refresh
- [x] Middleware API 401 for `/api/*`
- [x] `pipeline_events`, `cron_runs`, `daily_stats` tables
- [x] Health-check + aggregate-stats crons
- [x] Operator alerts (`OPERATOR_ALERT_EMAIL`, `SLACK_WEBHOOK_URL`)
- [x] Privacy + Terms pages + register consent + footer
- [x] `detect-site.ts` (foundation for Wave 2)
- [x] Preview returns `site` / `siteName`
- [ ] Install `@sentry/nextjs` + `instrumentation.ts` (optional until `SENTRY_DSN` set)
- [ ] Production deploy checklist (env vars documented in spec §8)

## Wave 2 — Site Parsers (complete)

- [x] Flipkart / Meesho / eBay parsers in `lib/providers/sites/`
- [x] `isAvailable` on `PriceFetchResult` + pipeline skip alerts when OOS
- [x] Amazon `is_available` passed through
- [x] Site badge + `alertActive` on product list (server-computed)
- [x] Migration `008_availability_status.sql`

## Wave 3 — Auth + UX + E2E (complete)

- [x] Forgot password + reset password pages
- [x] Google OAuth on login/register + `/auth/callback`
- [x] Email verification gate on preview/add APIs
- [x] Price history pagination (`limit`/`offset`)
- [x] Notification bell refetch on route change + 60s interval
- [x] Product detail delete button
- [x] Dashboard error banner + disable add form on list error
- [x] Playwright E2E + GitHub Actions CI
