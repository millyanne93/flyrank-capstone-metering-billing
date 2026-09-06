import { Request, Response } from 'express';
import { 
  verifyWebhookSignature,
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './stripe.service';
import { 
  updateTenantPlan, 
  updateTenantStripeCustomerId,
  getTenantById 
} from '../../repositories/tenants.repository';
import { getPlanByStripePriceId, getFreePlan } from '../../repositories/plans.repository';
import { 
  createWebhookEvent,
  hasWebhookEventBeenProcessed 
} from '../../repositories/webhookEvents.repository';
import { log } from '../../config';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      log('error', 'Missing Stripe-Signature header');
      res.status(400).json({ error: 'Missing Stripe-Signature header' });
      return;
    }
    const rawBody = req.body;

    let event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (error: any) {
      log('error', 'Webhook signature verification failed', { error: error.message });
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const eventId = event.id;
    const eventType = event.type;

    log('info', 'Webhook received', { eventId, eventType });

    const alreadyProcessed = await hasWebhookEventBeenProcessed(eventId);
    if (alreadyProcessed) {
      log('info', 'Webhook already processed, ignoring', { eventId });
      res.status(200).json({ received: true, already_processed: true });
      return;
    }

    let tenantId: string | null = null;

    switch (eventType) {
      case 'checkout.session.completed': {
        log('info', 'Processing checkout.session.completed');
        const data = handleCheckoutSessionCompleted(event);
        tenantId = data.tenantId;
        
        const proPlan = await getPlanByStripePriceId(
          process.env.STRIPE_PRO_PRICE_ID!
        );
        if (!proPlan) {
          throw new Error('Pro plan not found');
        }

        const updatedTenant = await updateTenantPlan(
          tenantId,
          proPlan.id,
          'active'
        );
        
        if (updatedTenant) {
          await updateTenantStripeCustomerId(tenantId, data.stripeCustomerId);
          log('info', 'Tenant upgraded to Pro', { tenantId });
        } else {
          log('warn', 'Tenant not found for upgrade', { tenantId });
        }
        break;
      }

      case 'customer.subscription.updated': {
        log('info', 'Processing customer.subscription.updated');
        const data = handleSubscriptionUpdated(event);
        tenantId = data.tenantId;
        
        const statusMap: Record<string, string> = {
          'active': 'active',
          'trialing': 'trialing',
          'past_due': 'past_due',
          'canceled': 'canceled',
          'incomplete': 'incomplete',
        };
        
        const mappedStatus = statusMap[data.status] || 'canceled';
        
        const tenant = await getTenantById(tenantId);
        if (tenant) {
          if (mappedStatus === 'canceled' || mappedStatus === 'past_due') {
            const freePlan = await getFreePlan();
            if (freePlan) {
              await updateTenantPlan(tenantId, freePlan.id, mappedStatus);
              log('info', 'Tenant reverted to Free', { tenantId, status: mappedStatus });
            }
          } else if (mappedStatus === 'active' || mappedStatus === 'trialing') {
            const proPlan = await getPlanByStripePriceId(
              process.env.STRIPE_PRO_PRICE_ID!
            );
            if (proPlan) {
              await updateTenantPlan(tenantId, proPlan.id, mappedStatus);
              log('info', 'Tenant status updated', { tenantId, status: mappedStatus });
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        log('info', 'Processing customer.subscription.deleted');
        const data = handleSubscriptionDeleted(event);
        tenantId = data.tenantId;
        
        const freePlan = await getFreePlan();
        if (freePlan) {
          await updateTenantPlan(tenantId, freePlan.id, 'canceled');
          log('info', 'Tenant subscription deleted, reverted to Free', { tenantId });
        }
        break;
      }

      default: {
        log('info', 'Unhandled webhook event type', { eventType });
        await createWebhookEvent(eventId, eventType);
        res.status(200).json({ received: true, unhandled: true });
        return;
      }
    }

    await createWebhookEvent(eventId, eventType);

    log('info', 'Webhook processed successfully', { eventId, eventType, tenantId });
    res.status(200).json({ received: true, processed: true });
    
  } catch (error: any) {
    log('error', 'Webhook processing error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
