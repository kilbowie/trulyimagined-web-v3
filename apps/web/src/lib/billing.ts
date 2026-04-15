import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export type BillingPlanId =
  | 'actor_professional'
  | 'agency_independent'
  | 'agency_boutique'
  | 'agency_sme'
  | 'studio_indie'
  | 'studio_midmarket';

export type BillingInterval = 'monthly' | 'yearly';

export type BillingPlanType = 'subscription' | 'addon';

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  description: string;
  priceLabel: string;
  featureHighlights: string[];
  allowedRoles: string[];
  priceEnvKeys: Partial<Record<BillingInterval, string>>;
  defaultInterval: BillingInterval;
  type: BillingPlanType;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'actor_professional',
    name: 'Actor Professional',
    description: 'For performers managing identity, consent, and professional credentials.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'Advanced identity verification workflows',
      'Verifiable credential issuance and lifecycle',
      'Consent and licensing audit visibility',
    ],
    allowedRoles: ['Actor'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY',
      yearly: 'STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
  {
    id: 'agency_independent',
    name: 'Agency Independent',
    description: 'For independent agencies managing a focused client portfolio.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'Agency-grade verification workflows',
      'Consent governance visibility for represented talent',
      'Seat expansion with add-on pricing',
    ],
    allowedRoles: ['Agent'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY',
      yearly: 'STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
  {
    id: 'agency_boutique',
    name: 'Agency Boutique',
    description: 'For boutique agencies coordinating premium talent and projects.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'Enhanced portfolio-level identity operations',
      'Consent and licensing governance controls',
      'Seat expansion with add-on pricing',
    ],
    allowedRoles: ['Agent'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY',
      yearly: 'STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
  {
    id: 'agency_sme',
    name: 'Agency SME',
    description: 'For scaling agencies that need operational assurance at higher volume.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'High-volume agency operations support',
      'Expanded governance tooling',
      'Seat expansion with add-on pricing',
    ],
    allowedRoles: ['Agent'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_AGENCY_SME_MONTHLY',
      yearly: 'STRIPE_PRICE_AGENCY_SME_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
  {
    id: 'studio_indie',
    name: 'Studio Indie',
    description: 'For studios with core governance and identity assurance requirements.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'Studio-focused identity trust controls',
      'Verification and assurance support',
      'Production workflow governance',
    ],
    allowedRoles: ['Enterprise', 'Admin'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_STUDIO_INDIE_MONTHLY',
      yearly: 'STRIPE_PRICE_STUDIO_INDIE_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
  {
    id: 'studio_midmarket',
    name: 'Studio Midmarket',
    description: 'For studios and enterprises with governance, scale, and assurance needs.',
    priceLabel: 'Monthly or yearly subscription',
    featureHighlights: [
      'Enterprise-grade identity trust controls',
      'Expanded verification and assurance support',
      'Operational support for high-volume environments',
    ],
    allowedRoles: ['Enterprise', 'Admin'],
    priceEnvKeys: {
      monthly: 'STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY',
      yearly: 'STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY',
    },
    defaultInterval: 'monthly',
    type: 'subscription',
  },
];

const PLAN_ID_ALIASES: Record<string, BillingPlanId> = {
  actor_pro: 'actor_professional',
  agent_pro: 'agency_independent',
  studio_enterprise: 'studio_midmarket',
};

export const AGENCY_SEAT_ADDON_ENV_KEY = 'STRIPE_PRICE_AGENCY_SEAT_ADDON';

export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPlanById(planId: string): BillingPlan | undefined {
  const canonicalId = PLAN_ID_ALIASES[planId] ?? planId;
  return BILLING_PLANS.find((plan) => plan.id === canonicalId);
}

export function getPlansForRoles(roles: string[]): BillingPlan[] {
  return BILLING_PLANS.filter((plan) =>
    plan.allowedRoles.length === 0 ? true : plan.allowedRoles.some((role) => roles.includes(role))
  );
}

export function getPlanPriceId(
  plan: BillingPlan,
  interval: BillingInterval = plan.defaultInterval
): string | null {
  const envKey = plan.priceEnvKeys[interval];
  if (!envKey) {
    return null;
  }

  const priceId = process.env[envKey];
  return priceId && priceId.trim() ? priceId.trim() : null;
}

export function getAgencySeatAddonPriceId(): string | null {
  const priceId = process.env[AGENCY_SEAT_ADDON_ENV_KEY];
  return priceId && priceId.trim() ? priceId.trim() : null;
}

export function getPlanByPriceId(priceId: string): {
  plan: BillingPlan;
  interval: BillingInterval;
} | null {
  for (const plan of BILLING_PLANS) {
    for (const [interval, envKey] of Object.entries(plan.priceEnvKeys)) {
      if (!envKey) {
        continue;
      }

      const configuredPriceId = process.env[envKey];
      if (configuredPriceId && configuredPriceId.trim() === priceId) {
        return {
          plan,
          interval: interval as BillingInterval,
        };
      }
    }
  }

  return null;
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
