import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { uploadToS3 } from '@/lib/s3';
import { getAgentByAuth0Id } from '@/lib/representation';

// DB-OWNER: TI

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Agent')) {
      return NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 });
    }

    const agent = await getAgentByAuth0Id(user.sub);
    if (!agent) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WEBP images are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'File must be 10MB or smaller' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `agents/${agent.id}/profile/${Date.now()}-${safeName}`;

    const uploaded = await uploadToS3({
      key,
      body: buffer,
      contentType: file.type,
      metadata: {
        agentId: agent.id,
        uploadedBy: user.sub,
        type: 'profile-photo',
      },
    });

    const updateResult = await query(
      `UPDATE agents
       SET profile_image_url = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, profile_image_url`,
      [agent.id, uploaded.url]
    );

    return NextResponse.json({
      success: true,
      profileImageUrl: updateResult.rows[0]?.profile_image_url || uploaded.url,
    });
  } catch (error) {
    console.error('[AGENT_PROFILE_UPLOAD_PHOTO] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
