# Technology Stack

## Core Technologies

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14.x |
| Styling | Tailwind CSS | 3.x |
| State | Zustand | 4.x |
| Forms | React Hook Form + Zod | |
| Charts | Recharts | |
| Email Editor | Unlayer or GrapesJS | |

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| Validation | Zod | 3.x |
| ORM | Drizzle ORM | |
| Auth | JWT (jsonwebtoken) | |

### Infrastructure
| Component | Technology | Version |
|-----------|------------|---------|
| Database | PostgreSQL | 15 |
| Cache/Queue | Redis | 7.x |
| Queue Library | BullMQ | 5.x |
| Mail Server | Haraka | latest |
| Object Storage | MinIO | |
| Reverse Proxy | Nginx | |

### DevOps
| Component | Technology |
|-----------|------------|
| Containers | Docker + Docker Compose |
| Monorepo | Turborepo |
| Package Manager | pnpm |

## Server Requirements

### Minimum (100K emails/month)
| Server | Specs | Cost |
|--------|-------|------|
| App | 4 vCPU, 8GB RAM | ~$40/mo |
| Database | 2 vCPU, 4GB RAM | ~$30/mo |
| Mail | 2 vCPU, 4GB RAM | ~$20/mo |
| **Total** | | **~$90/mo** |

### Recommended (1M emails/month)
| Server | Specs | Cost |
|--------|-------|------|
| App x2 | 4 vCPU, 8GB RAM | ~$80/mo |
| DB Primary | 4 vCPU, 16GB RAM | ~$80/mo |
| DB Replica | 2 vCPU, 8GB RAM | ~$50/mo |
| Redis | 2 vCPU, 4GB RAM | ~$20/mo |
| Mail x2 | 2 vCPU, 4GB RAM | ~$40/mo |
| **Total** | | **~$270/mo** |

## Key Dependencies

```json
{
  "backend": {
    "fastify": "^4.0.0",
    "drizzle-orm": "^0.30.0",
    "bullmq": "^5.0.0",
    "zod": "^3.22.0",
    "jsonwebtoken": "^9.0.0",
    "argon2": "^0.31.0"
  },
  "frontend": {
    "next": "^14.0.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.5.0",
    "react-hook-form": "^7.50.0",
    "recharts": "^2.12.0"
  },
  "email": {
    "haraka": "^3.0.0",
    "nodemailer": "^6.9.0"
  }
}
```
