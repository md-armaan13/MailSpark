# Tracking & Analytics System

## Tracking URLs

### Open Tracking
```
https://t.yourdomain.com/o/{campaign_id}/{contact_id}
→ Returns 1x1 transparent GIF
→ Queues "opened" event
```

### Click Tracking
```
https://t.yourdomain.com/c/{campaign_id}/{contact_id}?url={encoded}
→ Returns 302 redirect
→ Queues "clicked" event
```

### Unsubscribe
```
https://t.yourdomain.com/u/{signed_token}
→ Shows confirmation page
→ Updates contact status
```

## Tracking Server Design

### Requirements
- Ultra-low latency (< 10ms)
- High throughput (1000+ req/sec)
- Fire-and-forget (async queue)
- Minimal dependencies

### Flow
```
Request → Validate IDs → Return Response → Queue Event (async)
```

## Event Types

| Type | Trigger | Data |
|------|---------|------|
| sent | Email to Haraka | timestamp |
| delivered | Haraka webhook | timestamp |
| opened | Pixel loaded | user_agent, ip |
| clicked | Link clicked | url, user_agent |
| bounced | Delivery failed | bounce_type, reason |
| unsubscribed | User action | timestamp |

## Analytics Queries

### Campaign Stats
```sql
SELECT 
  event_type,
  COUNT(*) as total,
  COUNT(DISTINCT contact_id) as unique_count
FROM email_events
WHERE campaign_id = $1
GROUP BY event_type;
```

### Open Rate
```sql
unique_opens / delivered * 100
```

### Click Rate
```sql
unique_clicks / delivered * 100
```

## Privacy Considerations

- IP anonymization (first 3 octets only)
- Honor DNT header
- Data retention limits (90 days events)
- GDPR export capability
