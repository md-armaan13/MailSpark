# Development Roadmap

## Timeline Overview

| Phase | Focus | Duration |
|-------|-------|----------|
| 0 | Project Setup | 3 days |
| 1 | Foundation | 1.5 weeks |
| 2 | Core Features | 2 weeks |
| 3 | Email Infrastructure | 2 weeks |
| 4 | Tracking | 1.5 weeks |
| 5 | Frontend | 3 weeks |
| 6 | Polish | 1 week |
| **Total** | | **~12 weeks** |

## Phase 0: Setup (Days 1-3)
- [x] Initialize Turborepo
- [x] Docker Compose (Postgres, Redis, MinIO)
- [x] Base TypeScript config
- [x] ESLint + Prettier

## Phase 1: Foundation (Week 1-2)
- [ ] Database schema (accounts, users, contacts)
- [ ] Auth module (register, login, JWT)
- [ ] API key management
- [ ] Base Fastify plugins

## Phase 2: Core Features (Week 3-4)
- [ ] Contact CRUD + import
- [ ] List management
- [ ] Campaign CRUD
- [ ] Template management

## Phase 3: Email Infrastructure (Week 5-6)
- [ ] Haraka setup + plugins
- [ ] BullMQ workers
- [ ] Campaign sending flow
- [ ] DKIM signing

## Phase 4: Tracking (Week 7-8)
- [ ] Tracking server
- [ ] Open/click tracking
- [ ] Bounce handling
- [ ] Analytics endpoints

## Phase 5: Frontend (Week 9-11)
- [ ] Dashboard
- [ ] Contact management
- [ ] Campaign builder
- [ ] Email editor
- [ ] Analytics views

## Phase 6: Polish (Week 12)
- [ ] Testing
- [ ] Documentation
- [ ] Deployment
- [ ] Monitoring

## MVP Features Checklist

### Must Have
- [ ] User auth
- [ ] Contact management
- [ ] Lists
- [ ] Campaign create/send
- [ ] Email sending (Haraka)
- [ ] Open/click tracking
- [ ] Unsubscribe
- [ ] Bounce handling
- [ ] Basic analytics
- [ ] Web dashboard

### Post-MVP
- [ ] Drag-drop editor
- [ ] Automation
- [ ] A/B testing
- [ ] Advanced segments
- [ ] Team members
