import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';
import { sendFeedbackNotificationEmail } from '@/lib/email';

/**
 * GET /api/feedback
 * Get all feedback (Admin only) or user's own feedback
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const sentiment = searchParams.get('sentiment');
    const unreadOnly = searchParams.get('unread') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get user's profile ID
    const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
      user.sub,
    ]);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileId = profileResult.rows[0].id;

    let feedbackResult;
    let statsResult = null;
    let topicsResult = null;

    if (isAdmin) {
      // Admins can filter and see all feedback
      feedbackResult = await query(queries.feedback.getByFilters, [
        topic || null,
        sentiment || null,
        unreadOnly ? false : null,
        limit,
        offset,
      ]);

      // Get stats for admins
      statsResult = await query(queries.feedback.getStats, []);
      topicsResult = await query(queries.feedback.getTopicBreakdown, []);
    } else {
      // Users see only their feedback
      feedbackResult = await query(queries.feedback.getByUser, [profileId, limit, offset]);
    }

    return NextResponse.json({
      success: true,
      feedback: feedbackResult.rows,
      stats: statsResult?.rows[0] || null,
      topicBreakdown: topicsResult?.rows || null,
      isAdmin,
      pagination: {
        page,
        limit,
        total: feedbackResult.rowCount || 0,
      },
    });
  } catch (error) {
    console.error('[FEEDBACK_GET_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback
 * Submit new feedback
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic, text, emoji } = body;

    // Validation
    if (!topic || !text) {
      return NextResponse.json({ error: 'Topic and feedback text are required' }, { status: 400 });
    }

    if (text.length < 10) {
      return NextResponse.json(
        { error: 'Feedback must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Feedback must be less than 5000 characters' },
        { status: 400 }
      );
    }

    const validTopics = [
      'General',
      'Profile',
      'Consent Preferences',
      'Consent History',
      'Register Identity',
      'Verify Identity',
      'Verifiable Credentials',
      'License Tracker',
    ];

    if (!validTopics.includes(topic)) {
      return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });
    }

    const validSentiments = ['angry', 'sad', 'neutral', 'happy', 'love'];
    if (emoji && !validSentiments.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid sentiment' }, { status: 400 });
    }

    // Get user's profile ID
    const profileResult = await query(
      'SELECT id, username, email FROM user_profiles WHERE auth0_user_id = $1',
      [user.sub]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    // Create feedback entry
    const feedbackResult = await query(queries.feedback.create, [
      profile.id,
      topic,
      text,
      emoji || null,
    ]);

    const feedback = feedbackResult.rows[0];

    // Send email notification to admins
    try {
      await sendFeedbackNotificationEmail(
        profile.email,
        profile.username || user.name || 'User',
        topic,
        text,
        emoji || null
      );
    } catch (emailError) {
      console.error('[FEEDBACK_EMAIL_ERROR]', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully. Thank you!',
      feedback: {
        id: feedback.id,
        topic: feedback.topic,
        created_at: feedback.created_at,
      },
    });
  } catch (error) {
    console.error('[FEEDBACK_POST_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
