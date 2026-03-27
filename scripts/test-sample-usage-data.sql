-- Sample Usage Data for Testing Dashboard
-- Run this to populate test data in the usage_tracking table

-- First, let's check if we have actors
SELECT 'Current Actors:' as info;
SELECT id, first_name, last_name, stage_name, email 
FROM actors 
LIMIT 5;

-- Check if we have any usage data
SELECT 'Current Usage Records:' as info;
SELECT COUNT(*) as total_records 
FROM usage_tracking;

-- If you need to create sample data for testing, uncomment below:
-- Note: Replace <actor-id-here> with an actual actor ID from your database

/*
-- Insert sample voice minutes
INSERT INTO usage_tracking (
  actor_id, usage_type, quantity, unit, project_name, generated_by, metadata
) VALUES 
(
  '<actor-id-here>', 
  'voice_minutes', 
  15.5, 
  'minutes', 
  'Sample Podcast Episode', 
  'synthetic-audition-tool',
  '{"quality": "high", "language": "en-US"}'::jsonb
),
(
  '<actor-id-here>', 
  'voice_minutes', 
  22.3, 
  'minutes', 
  'Audiobook Chapter 1', 
  'synthetic-audition-tool',
  '{"quality": "high", "language": "en-US"}'::jsonb
),
(
  '<actor-id-here>', 
  'image_generation', 
  10, 
  'images', 
  'Marketing Campaign', 
  'image-generator',
  '{"resolution": "1024x1024", "style": "professional"}'::jsonb
),
(
  '<actor-id-here>', 
  'video_seconds', 
  120, 
  'seconds', 
  'Commercial Video', 
  'video-generator',
  '{"resolution": "1080p", "fps": 30}'::jsonb
);

-- Verify insertion
SELECT 'Newly Created Usage Records:' as info;
SELECT 
  usage_type,
  quantity,
  unit,
  project_name,
  created_at
FROM usage_tracking
ORDER BY created_at DESC
LIMIT 10;
*/

-- Get current usage stats (what the dashboard will show)
SELECT 'Usage Stats by Type:' as info;
SELECT 
  usage_type,
  unit,
  COUNT(DISTINCT actor_id) as unique_actors,
  SUM(quantity) as total_quantity,
  AVG(quantity) as avg_quantity,
  COUNT(*) as total_records
FROM usage_tracking
GROUP BY usage_type, unit
ORDER BY usage_type;

-- Check recent activity
SELECT 'Recent Activity (Last 7 Days):' as info;
SELECT 
  DATE(created_at) as usage_date,
  usage_type,
  SUM(quantity) as daily_quantity,
  COUNT(*) as daily_records
FROM usage_tracking
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), usage_type
ORDER BY usage_date DESC, usage_type;
