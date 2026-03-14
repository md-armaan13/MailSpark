# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│   Web App (Next.js) │ Mobile App │ External API                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LOAD BALANCER (Nginx)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   API Server    │ │   API Server    │ │ Tracking Server │
│   (Fastify)     │ │   (Fastify)     │ │   (Minimal)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE QUEUE (BullMQ + Redis)               │
│  campaign:process │ email:send │ events:track │ webhooks        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Campaign Worker │ │  Email Worker   │ │  Event Worker   │
│ (queue emails)  │ │  (send via MTA) │ │ (process events)│
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HARAKA MAIL SERVER (Node.js)                 │
│   auth_api │ dkim_sign │ rate_limit │ delivery_webhook          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      [ Internet / Recipients ]
```

## Data Flow

### Sending Campaign
1. User clicks "Send" → API queues `campaign:process`
2. Campaign Worker fetches contacts, queues `email:send` for each
3. Email Worker personalizes content, sends via Haraka SMTP
4. Haraka signs with DKIM, delivers to recipient MX
5. Haraka fires webhook on delivery/bounce
6. Webhook handler queues `events:track`
7. Event Worker logs event, updates stats

### Tracking Flow
1. Email contains tracking pixel and wrapped links
2. Recipient opens email → pixel request to Tracking Server
3. Tracking Server returns 1x1 GIF, queues event
4. Event Worker processes, updates campaign stats

## Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| API Server | REST API, business logic, auth |
| Tracking Server | Low-latency open/click tracking |
| Campaign Worker | Process campaigns, queue individual emails |
| Email Worker | Send emails via Haraka, handle retries |
| Event Worker | Process tracking events, update stats |
| Haraka | SMTP server, DKIM signing, delivery webhooks |
