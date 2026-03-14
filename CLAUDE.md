# CLAUDE.md - Email Marketing Platform

## 🎯 Project Overview

Building a **self-hosted email marketing platform** similar to Mailchimp/Brevo with:
- Contact management & segmentation
- Campaign creation & scheduling
- Drag-and-drop email editor
- Email sending via self-hosted Haraka (Node.js SMTP)
- Open/click tracking & analytics
- Bounce/complaint handling
- API for integrations

## 📊 Scale Target
- **100K - 1M emails/month**
- **Up to 500K contacts**
- **~100 concurrent users**

---

## 🛠️ Technology Stack

### Core Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, Tailwind CSS, Zustand |
| **Backend** | Fastify (Node.js), TypeScript |
| **Database** | PostgreSQL 15, Drizzle ORM |
| **Cache/Queue** | Redis 7, BullMQ |
| **Mail Server** | Haraka (Node.js SMTP) |
| **Tracking** | Lightweight Fastify server |
| **Storage** | MinIO (S3-compatible) |
| **Monorepo** | Turborepo |

---

## 📁 Project Structure

```
email-platform/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api/                    # Fastify API server
│   ├── tracking/               # Tracking pixel server
│   └── workers/                # Background workers
├── packages/
│   ├── database/               # Drizzle schema
│   ├── shared/                 # Shared types
│   └── email-renderer/         # MJML to HTML
├── infrastructure/
│   ├── haraka/                 # Mail server
│   ├── docker/
│   └── nginx/
└── docker-compose.yml
```

---

## 🗄️ Database Tables

- **accounts** - Multi-tenant accounts
- **users** - User authentication
- **contacts** - Email subscribers
- **lists** - Contact lists/audiences
- **list_contacts** - Many-to-many
- **campaigns** - Email campaigns
- **templates** - Email templates
- **email_events** - Tracking events
- **suppression_list** - Bounced/complained emails
- **api_keys** - API authentication

---

## 🔌 API Endpoints

### Auth: `/api/auth/*`
- POST /register, /login, /refresh
- GET /me

### Contacts: `/api/contacts/*`
- GET / (list), POST / (create), POST /import
- GET /:id, PATCH /:id, DELETE /:id

### Campaigns: `/api/campaigns/*`
- CRUD + POST /:id/send, POST /:id/schedule

### Tracking: `/t/*` (separate server)
- GET /o/:cid/:uid (open pixel)
- GET /c/:cid/:uid (click redirect)
- GET /u/:token (unsubscribe)

---

## 📬 Queue Jobs

| Queue | Purpose |
|-------|---------|
| `campaign:process` | Process campaign, queue emails |
| `email:send` | Send single email via Haraka |
| `events:track` | Process tracking events |

---

## 🔧 Commands

```bash
pnpm install          # Install deps
pnpm dev              # Start all services
pnpm dev --filter=api # Start specific app
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
docker-compose up -d  # Start infrastructure
```

---

## ⚠️ Constraints

1. All sending via self-hosted Haraka
2. Multi-tenant (account_id on all tables)
3. Queue-based sending (never sync)
4. Compliance: CAN-SPAM, GDPR

---

## 📖 Documentation

See `/docs/` for detailed documentation:
- 01-architecture-overview.md
- 02-tech-stack.md
- 03-data-model-api.md
- 04-haraka-mail-server.md
- 05-tracking-analytics.md
- 06-development-roadmap.md
