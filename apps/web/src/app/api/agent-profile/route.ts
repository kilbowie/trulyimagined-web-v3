import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { ensureAgentRegistryId } from '@/lib/registry-id';

interface AgentProfilePayload {
  agencyName?: string;
  bio?: string;
  profileImageUrl?: string;
  location?: string;
  websiteUrl?: string;
  registeredCompanyName?: string;
  companyRegistrationNumber?: string;
  vatNumber?: string;
  registeredAddressLine1?: string;
  registeredAddressLine2?: string;
  registeredAddressCity?: string;
  registeredAddressPostcode?: string;
  registeredAddressCountry?: string;
}

function normalizeText(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidOptionalUrl(value?: string): boolean {
  if (!value || value.trim().length === 0) return true;
  return /^https?:\/\//i.test(value.trim());
}

function computeProfileCompleted(payload: AgentProfilePayload): boolean {
  return Boolean(
    normalizeText(payload.agencyName) &&
      normalizeText(payload.registeredCompanyName) &&
      normalizeText(payload.companyRegistrationNumber) &&
      normalizeText(payload.registeredAddressLine1) &&
      normalizeText(payload.registeredAddressCity) &&
      normalizeText(payload.registeredAddressPostcode) &&
      normalizeText(payload.registeredAddressCountry)
  );
}

async function requireAgentUser() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const roles = await getUserRoles();
  if (!roles.includes('Agent')) {
    return {
      error: NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 }),
    };
  }

  const profileResult = await query(
    'SELECT id, auth0_user_id, email FROM user_profiles WHERE auth0_user_id = $1',
    [user.sub]
  );

  if (profileResult.rows.length === 0) {
    return { error: NextResponse.json({ error: 'User profile not found' }, { status: 404 }) };
  }

  return { user, userProfile: profileResult.rows[0] };
}

/**
 * GET /api/agent-profile
 * Returns the current user's agent profile.
 */
export async function GET() {
  try {
    const auth = await requireAgentUser();
    if ('error' in auth) return auth.error;

    const agentResult = await query(
      `SELECT
        a.id,
        a.user_profile_id,
        a.auth0_user_id,
        a.registry_id,
        a.agency_name,
        a.bio,
        a.profile_image_url,
        a.location,
        a.website_url,
        a.registered_company_name,
        a.company_registration_number,
        a.vat_number,
        a.registered_address_line1,
        a.registered_address_line2,
        a.registered_address_city,
        a.registered_address_postcode,
        a.registered_address_country,
        a.profile_completed,
        a.verification_status,
        a.verified_at,
        a.verified_by,
        a.billing_plan,
        a.created_at,
        a.updated_at
      FROM agents a
      WHERE a.auth0_user_id = $1
        AND a.deleted_at IS NULL`,
      [auth.user.sub]
    );

    return NextResponse.json({
      profile: agentResult.rows[0] || null,
      needsSetup: agentResult.rows.length === 0,
    });
  } catch (error) {
    console.error('[AGENT_PROFILE] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/agent-profile
 * Creates a new agent profile.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAgentUser();
    if ('error' in auth) return auth.error;

    const payload = (await request.json()) as AgentProfilePayload;

    if (!normalizeText(payload.agencyName)) {
      return NextResponse.json({ error: 'Agency name is required' }, { status: 400 });
    }

    if (!isValidOptionalUrl(payload.websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must start with http:// or https://' }, { status: 400 });
    }

    const existing = await query('SELECT id, registry_id FROM agents WHERE auth0_user_id = $1', [
      auth.user.sub,
    ]);

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Agent profile already exists. Use PUT to update your profile.' },
        { status: 409 }
      );
    }

    const profileCompleted = computeProfileCompleted(payload);

    const insertResult = await query(
      `INSERT INTO agents (
        user_profile_id,
        auth0_user_id,
        agency_name,
        bio,
        profile_image_url,
        location,
        website_url,
        registered_company_name,
        company_registration_number,
        vat_number,
        registered_address_line1,
        registered_address_line2,
        registered_address_city,
        registered_address_postcode,
        registered_address_country,
        profile_completed
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *`,
      [
        auth.userProfile.id,
        auth.user.sub,
        normalizeText(payload.agencyName),
        normalizeText(payload.bio),
        normalizeText(payload.profileImageUrl),
        normalizeText(payload.location),
        normalizeText(payload.websiteUrl),
        normalizeText(payload.registeredCompanyName),
        normalizeText(payload.companyRegistrationNumber),
        normalizeText(payload.vatNumber),
        normalizeText(payload.registeredAddressLine1),
        normalizeText(payload.registeredAddressLine2),
        normalizeText(payload.registeredAddressCity),
        normalizeText(payload.registeredAddressPostcode),
        normalizeText(payload.registeredAddressCountry),
        profileCompleted,
      ]
    );

    const created = insertResult.rows[0];
    const registryId = await ensureAgentRegistryId(created.id, created.registry_id);

    return NextResponse.json({
      success: true,
      profile: {
        ...created,
        registry_id: registryId,
      },
      message: profileCompleted
        ? 'Agent profile created successfully.'
        : 'Agent profile created. Complete all business details to appear in representation search.',
    });
  } catch (error) {
    console.error('[AGENT_PROFILE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/agent-profile
 * Updates existing agent profile.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAgentUser();
    if ('error' in auth) return auth.error;

    const payload = (await request.json()) as AgentProfilePayload;

    if (payload.agencyName !== undefined && !normalizeText(payload.agencyName)) {
      return NextResponse.json({ error: 'Agency name cannot be empty' }, { status: 400 });
    }

    if (!isValidOptionalUrl(payload.websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must start with http:// or https://' }, { status: 400 });
    }

    const existingResult = await query(
      `SELECT *
       FROM agents
       WHERE auth0_user_id = $1
         AND deleted_at IS NULL`,
      [auth.user.sub]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent profile not found. Create your profile first.' },
        { status: 404 }
      );
    }

    const existing = existingResult.rows[0];

    const mergedPayload: AgentProfilePayload = {
      agencyName: payload.agencyName ?? existing.agency_name,
      bio: payload.bio ?? existing.bio,
      profileImageUrl: payload.profileImageUrl ?? existing.profile_image_url,
      location: payload.location ?? existing.location,
      websiteUrl: payload.websiteUrl ?? existing.website_url,
      registeredCompanyName: payload.registeredCompanyName ?? existing.registered_company_name,
      companyRegistrationNumber:
        payload.companyRegistrationNumber ?? existing.company_registration_number,
      vatNumber: payload.vatNumber ?? existing.vat_number,
      registeredAddressLine1: payload.registeredAddressLine1 ?? existing.registered_address_line1,
      registeredAddressLine2: payload.registeredAddressLine2 ?? existing.registered_address_line2,
      registeredAddressCity: payload.registeredAddressCity ?? existing.registered_address_city,
      registeredAddressPostcode:
        payload.registeredAddressPostcode ?? existing.registered_address_postcode,
      registeredAddressCountry:
        payload.registeredAddressCountry ?? existing.registered_address_country,
    };

    const profileCompleted = computeProfileCompleted(mergedPayload);

    const updated = await query(
      `UPDATE agents
       SET agency_name = $2,
           bio = $3,
           profile_image_url = $4,
           location = $5,
           website_url = $6,
           registered_company_name = $7,
           company_registration_number = $8,
           vat_number = $9,
           registered_address_line1 = $10,
           registered_address_line2 = $11,
           registered_address_city = $12,
           registered_address_postcode = $13,
           registered_address_country = $14,
           profile_completed = $15,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        existing.id,
        normalizeText(mergedPayload.agencyName),
        normalizeText(mergedPayload.bio),
        normalizeText(mergedPayload.profileImageUrl),
        normalizeText(mergedPayload.location),
        normalizeText(mergedPayload.websiteUrl),
        normalizeText(mergedPayload.registeredCompanyName),
        normalizeText(mergedPayload.companyRegistrationNumber),
        normalizeText(mergedPayload.vatNumber),
        normalizeText(mergedPayload.registeredAddressLine1),
        normalizeText(mergedPayload.registeredAddressLine2),
        normalizeText(mergedPayload.registeredAddressCity),
        normalizeText(mergedPayload.registeredAddressPostcode),
        normalizeText(mergedPayload.registeredAddressCountry),
        profileCompleted,
      ]
    );

    const profile = updated.rows[0];
    const registryId = await ensureAgentRegistryId(profile.id, profile.registry_id);

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        registry_id: registryId,
      },
      message: profileCompleted
        ? 'Agent profile updated successfully.'
        : 'Agent profile updated. Complete all business details to appear in representation search.',
    });
  } catch (error) {
    console.error('[AGENT_PROFILE] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
