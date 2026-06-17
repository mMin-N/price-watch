---
name: price-watch-mvp
description: >-
  Defines architecture, data model, pipeline flow, and constraints for the
  cross-platform price tracking and wishlist MVP. Use when generating or
  reviewing architecture, backend API, frontend, ZenRows/scraping integration,
  price alerts, wishlists, or any price-watch feature in this project.
---

# Price Watch MVP — System Skills

The AI must strictly follow these skills when generating architecture, backend, or frontend code for this project.

## Core System Understanding

The system is a price tracking pipeline, not a general e-commerce platform.

Core flow:

```
User provides product URL
→ System fetches price
→ Stores snapshot
→ Compares with target price
→ Triggers alert if condition met
```

No additional domains (marketplace discovery, AI matching, etc.) are in scope.

## Required Skills

### API Integration

The system MUST treat external services as replaceable providers.

Required behavior:

- Abstract all external scraping logic behind a single interface: `fetchPrice(url)`
- Current provider: ZenRows API
- Future providers may replace it without modifying business logic

DO NOT hardcode provider-specific logic in core services.

See [reference.md](reference.md) for the provider interface pattern.

### Data Modeling

Design must prioritize long-term consistency and traceability.

Required entities:

- User
- WishlistItem (logical grouping)
- TrackedProduct (URL-level entity)
- PriceHistory (append-only)

Rules:

- Price data must NEVER overwrite previous values
- URL is not the same as product entity
- WishlistItem can contain multiple TrackedProducts

### System Flow Design

All implementations must follow this flow:

1. Input (URL)
2. Fetch price (external provider)
3. Normalize data
4. Persist to database
5. Evaluate alert condition
6. Emit notification event (if needed)

No deviation or additional layers unless explicitly required.

### Minimal Backend Design

Backend must remain simple.

Allowed patterns:

- REST API
- Stateless services
- Direct DB operations

Forbidden patterns:

- Microservices
- Event-driven architecture (unless explicitly required)
- Complex orchestration layers
- Over-engineered abstraction layers

### Cost Awareness

System must be designed with API cost constraints in mind.

Rules:

- Avoid unnecessary repeated scraping
- Avoid per-request real-time scraping loops
- Prefer scheduled or user-triggered updates

Every external API call has cost implications.

### Async Execution Awareness

System must support delayed execution via simple mechanisms.

Allowed:

- Cron jobs
- Scheduled polling
- Basic queue (optional in MVP)

Not required:

- Distributed queue systems
- Kafka / event streaming

### Frontend-Backend Separation

Frontend must NOT:

- Perform scraping
- Contain business logic for pricing
- Directly interact with scraping APIs

Frontend responsibilities:

- Input URL
- Display price data
- Show wishlist state

### Debuggability

Every step in the pipeline must be traceable.

Required logs:

- URL received
- Price fetched
- Provider response
- DB write result
- Alert evaluation result

## Architecture Constraints

The system must remain within a 3-layer architecture:

```
Frontend → Backend API → External Data Provider
```

No additional layers unless explicitly requested.

## Non-Goals (IMPORTANT)

The following are explicitly OUT OF SCOPE:

- Cross-platform product matching
- AI-based product understanding
- Market intelligence / predictions
- Recommendation systems
- Multi-tenant SaaS scaling architecture
- Real-time streaming systems

## Success Criteria

The system is considered correct if:

- A valid product URL can be added
- Price can be fetched via external provider
- Data is stored and retrievable
- Target price triggers an alert
- System remains simple and maintainable

## Implementation Checklist

Before proposing or shipping code, verify:

```
- [ ] Scraping isolated behind fetchPrice(url); ZenRows only in provider layer
- [ ] Pipeline follows 6 steps; no extra orchestration layers
- [ ] PriceHistory is append-only; no overwrites
- [ ] TrackedProduct vs URL vs WishlistItem modeled correctly
- [ ] No scraping or pricing logic in frontend
- [ ] Updates are scheduled/user-triggered, not per-request scrape loops
- [ ] Pipeline steps emit required logs
- [ ] No non-goals introduced (AI matching, recommendations, microservices, etc.)
```

## Additional Resources

- Entity relationships and provider interface: [reference.md](reference.md)
