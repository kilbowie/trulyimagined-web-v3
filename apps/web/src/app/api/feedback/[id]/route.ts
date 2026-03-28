import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * PATCH /api/feedback/[id]
 * Mark feedback as read or update admin notes (Admin only)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const feedbackId = params.id;
    const body = await request.json();
    const { is_read, admin_notes } = body;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(feedbackId)) {
      return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 });
    }

    // Build update query dynamically based on provided fields
    let updateQuery = 'UPDATE user_feedback SET ';
    const values: unknown[] = [];
    let paramCount = 1;

    if (typeof is_read === 'boolean') {
      updateQuery += `is_read = $${paramCount}, `;
      values.push(is_read);
      paramCount++;
    }

    if (admin_notes !== undefined) {
      updateQuery += `admin_notes = $${paramCount}, `;
      values.push(admin_notes);
      paramCount++;
    }

    if (values.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Remove trailing comma and add WHERE clause
    updateQuery = updateQuery.slice(0, -2);
    updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`;
    values.push(feedbackId);

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error('[FEEDBACK_PATCH_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to update feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
