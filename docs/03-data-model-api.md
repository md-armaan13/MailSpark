# Data Model & API Design

## Entity Relationship

```
account 1──n users
account 1──n contacts
account 1──n lists
account 1──n campaigns
account 1──n templates
account 1──n api_keys
list n──n contacts (via list_contacts)
campaign 1──n email_events
contact 1──n email_events
```

## Core Tables

### accounts
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_name | VARCHAR(255) | |
| plan | ENUM | free, starter, growth, pro |
| monthly_limit | INT | Email limit |
| emails_sent | INT | This billing cycle |
| created_at | TIMESTAMP | |

### contacts
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | FK |
| email | VARCHAR(255) | Unique per account |
| first_name | VARCHAR(100) | |
| last_name | VARCHAR(100) | |
| status | ENUM | subscribed, unsubscribed, bounced |
| metadata | JSONB | Custom fields |
| tags | TEXT[] | Array of tags |
| created_at | TIMESTAMP | |

### campaigns
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | FK |
| list_id | UUID | FK (nullable) |
| name | VARCHAR(255) | |
| subject | VARCHAR(500) | |
| from_name | VARCHAR(255) | |
| from_email | VARCHAR(255) | |
| html_content | TEXT | |
| status | ENUM | draft, scheduled, sending, sent |
| scheduled_at | TIMESTAMP | |
| sent_at | TIMESTAMP | |
| stats | JSONB | Denormalized stats |

### email_events
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| campaign_id | UUID | FK |
| contact_id | UUID | FK |
| event_type | ENUM | sent, opened, clicked, bounced |
| metadata | JSONB | URL, user agent, etc. |
| created_at | TIMESTAMP | |

## API Endpoints

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
```

### Contacts
```
GET    /api/contacts
POST   /api/contacts
POST   /api/contacts/import
GET    /api/contacts/:id
PATCH  /api/contacts/:id
DELETE /api/contacts/:id
```

### Lists
```
GET    /api/lists
POST   /api/lists
GET    /api/lists/:id
PATCH  /api/lists/:id
DELETE /api/lists/:id
POST   /api/lists/:id/contacts
DELETE /api/lists/:id/contacts
```

### Campaigns
```
GET    /api/campaigns
POST   /api/campaigns
GET    /api/campaigns/:id
PATCH  /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/send
POST   /api/campaigns/:id/schedule
GET    /api/campaigns/:id/stats
```

### Tracking (Separate Server)
```
GET    /t/o/:campaignId/:contactId     # Open pixel
GET    /t/c/:campaignId/:contactId     # Click redirect
GET    /u/:token                        # Unsubscribe
```

## Indexes

```sql
-- Contacts
CREATE INDEX idx_contacts_account_status ON contacts(account_id, status);
CREATE INDEX idx_contacts_account_email ON contacts(account_id, email);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- Events
CREATE INDEX idx_events_campaign ON email_events(campaign_id);
CREATE INDEX idx_events_campaign_type ON email_events(campaign_id, event_type);
CREATE INDEX idx_events_created ON email_events(created_at);
```
