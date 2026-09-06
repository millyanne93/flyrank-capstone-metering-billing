import Stripe from 'stripe';
import { config } from '../../config';
import { log } from '../../config';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(
  tenantId: string,
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSessionResult> {
  try {
    log('info', 'Creating Checkout session', { tenantId, customerEmail });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: config.stripe.proPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: {
        tenant_id: tenantId,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
        },
      },
    });

    log('info', 'Checkout session created', {
      sessionId: session.id,
      url: session.url,
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (error: any) {
    log('error', 'Failed to create Checkout session', { error: error.message });
    throw new Error(`Stripe Checkout error: ${error.message}`);
  }
}

export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string
): Stripe.Event {
  try {
    const webhookSecret = config.stripe.webhookSecret;
    
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    const payloadString = Buffer.isBuffer(payload) 
      ? payload.toString('utf8') 
      : payload;
     
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );

    return event;
  } catch (error: any) {
    log('error', 'Webhook signature verification failed', { 
      error: error.message 
    });
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
}

export function handleCheckoutSessionCompleted(event: Stripe.Event): {
  tenantId: string;
  stripeCustomerId: string;
  subscriptionId: string;
} {
  const session = event.data.object as Stripe.Checkout.Session;
  
  const tenantId = session.metadata?.tenant_id;
  if (!tenantId) {
    throw new Error('No tenant_id in session metadata');
  }

  const stripeCustomerId = session.customer as string;
  if (!stripeCustomerId) {
    throw new Error('No customer ID in session');
  }

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    throw new Error('No subscription ID in session');
  }

  return {
    tenantId,
    stripeCustomerId,
    subscriptionId,
  };
}

export function handleSubscriptionUpdated(event: Stripe.Event): {
  tenantId: string;
  stripeCustomerId: string;
  subscriptionId: string;
  status: string;
} {
  const subscription = event.data.object as Stripe.Subscription;
  
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    throw new Error('No tenant_id in subscription metadata');
  }

  return {
    tenantId,
    stripeCustomerId: subscription.customer as string,
    subscriptionId: subscription.id,
    status: subscription.status,
  };
}

export function handleSubscriptionDeleted(event: Stripe.Event): {
  tenantId: string;
  stripeCustomerId: string;
  subscriptionId: string;
} {
  const subscription = event.data.object as Stripe.Subscription;
  
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    throw new Error('No tenant_id in subscription metadata');
  }

  return {
    tenantId,
    stripeCustomerId: subscription.customer as string,
    subscriptionId: subscription.id,
  };
}

export { stripe };
