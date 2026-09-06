import { query, queryOne } from '../db/client';

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: Date;
  created_at: Date;
}

export async function createWebhookEvent(
  stripeEventId: string,
  eventType: string
): Promise<WebhookEvent> {
  const rows = await query<WebhookEvent>(
    `INSERT INTO webhook_events (stripe_event_id, event_type)
     VALUES ($1, $2)
     RETURNING *`,
    [stripeEventId, eventType]
  );
  return rows[0];
}

export async function getWebhookEventByStripeId(
  stripeEventId: string
): Promise<WebhookEvent | null> {
  return await queryOne<WebhookEvent>(
    'SELECT * FROM webhook_events WHERE stripe_event_id = $1',
    [stripeEventId]
  );
}

export async function hasWebhookEventBeenProcessed(
  stripeEventId: string
): Promise<boolean> {
  const event = await getWebhookEventByStripeId(stripeEventId);
  return event !== null;
}
