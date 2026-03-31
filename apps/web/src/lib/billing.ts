import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export type BillingPlanId = 'actor_pro' | 'agent_pro' | 'studio_enterprise';

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  description: string;
  priceLabel: string;
  featureHighlights: string[];
  allowedRoles: string[];
  priceEnvKey: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'actor_pro',
    name: 'Actor Pro',
    description: 'For performers managing identity, consent, and professional credentials.',
    priceLabel: 'Monthly subscription',
    featureHighlights: [
      'Advanced identity verification workflows',
      'Verifiable credential issuance and lifecycle',
      'Consent and licensing audit visibility',
    ],
    allowedRoles: ['Actor'],
    priceEnvKey: 'STRIPE_PRICE_ACTOR_MONTHLY',
  },
  {
    id: 'agent_pro',
    name: 'Agent Pro',
    description: 'For representatives managing multiple identities and client workflows.',
    priceLabel: 'Monthly subscription',
    featureHighlights: [
      'Representative-focused verification workflows',
      'Consent governance visibility',
      'Portfolio-level identity operations',
    ],
    allowedRoles: ['Agent'],
    priceEnvKey: 'STRIPE_PRICE_AGENT_MONTHLY',
  },
  {
    id: 'studio_enterprise',
    name: 'Studio Enterprise',
    description: 'For studios and enterprises with governance, scale, and assurance needs.',
    priceLabel: 'Monthly subscription',
    featureHighlights: [
      'Enterprise-grade identity trust controls',
      'Expanded verification and assurance support',
      'Operational support for high-volume environments',
    ],
    allowedRoles: ['Enterprise', 'Admin'],
    priceEnvKey: 'STRIPE_PRICE_STUDIO_MONTHLY',
  },
];

export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPlanById(planId: string): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.id === planId);
}

export function getPlansForRoles(roles: string[]): BillingPlan[] {
  return BILLING_PLANS.filter((plan) =>
    plan.allowedRoles.length === 0 ? true : plan.allowedRoles.some((role) => roles.includes(role))
  );
}

export function getPlanPriceId(plan: BillingPlan): string | null {
  const priceId = process.env[plan.priceEnvKey];
  return priceId && priceId.trim() ? priceId.trim() : null;
}

export async function findStripeCustomerByAuth0User(
  auth0UserId: string,
  email?: string | null
): Promise<Stripe.Customer | null> {
  if (!email) {
    return null;
  }

  const customerSearch = await stripe.customers.list({ email, limit: 20 });
  const exact = customerSearch.data.find(
    (customer) => customer.metadata?.auth0_user_id === auth0UserId
  );

  return exact || customerSearch.data[0] || null;
}

export async function getOrCreateStripeCustomer(input: {
  auth0UserId: string;
  email?: string | null;
  name?: string | null;
}): Promise<Stripe.Customer> {
  const existing = await findStripeCustomerByAuth0User(input.auth0UserId, input.email);
  if (existing) {
    return existing;
  }

  return stripe.customers.create({
    email: input.email || undefined,
    name: input.name || undefined,
    metadata: {
      auth0_user_id: input.auth0UserId,
      source: 'trulyimagined-dashboard',
    },
  });
}
