# Media Management Development Guide

## S3 Upload Error Resolution

The error "Failed to upload to S3: The authorization header is malformed; a non-empty Access Key (AKID) must be provided in the credential" occurs when AWS credentials are not properly configured or the S3 bucket doesn't exist yet.

## Development Mode Solution

Instead of requiring production AWS credentials during development, we've implemented a **development mode** that uses the local file system to simulate S3 storage.

### How It Works

1. **DEV_MODE Detection**: When `NODE_ENV=development` AND `USE_MOCK_S3=true`, the S3 library uses local file storage
2. **Local Storage**: Files are saved to `apps/web/public/dev-uploads/`
3. **Local URLs**: Files are accessible via `/dev-uploads/{filename}` URLs
4. **Automatic Fallback**: All S3 operations (upload, delete, get signed URL) automatically use local mode

### Setup Instructions

1. **Enable Development Mode** (already configured in `.env.local`):
   ```bash
   USE_MOCK_S3=true
   ```

2. **Run the Test Headshot Seed**:
   ```bash
   node scripts/seed-test-headshot.js
   ```
   
   This will:
   - Copy `c:\Users\adamr\Downloads\a-r-greene_headshot.webp` to `apps/web/public/dev-uploads/`
   - Create a database record with metadata:
     - **Title**: Adam Ross Greene 001
     - **Photo Credit**: Michael Shelford
     - **Description**: Main headshot.
   - Set it as the primary headshot (display_order=0)

3. **Start Development Server**:
   ```bash
   cd apps/web
   pnpm dev
   ```

4. **Test the Implementation**:
   - Navigate to: http://localhost:3000/dashboard/profile
   - You should see the seeded headshot
   - Click it to open the gallery modal
   - Test the headshot selector (choosing primary/secondary)
   - Upload new headshots via: http://localhost:3000/dashboard/upload-media

## File Structure

### Development Mode Files
```
apps/web/public/dev-uploads/
├── actors_1_headshots_1234567890_a-r-greene_headshot.webp
└── (other uploaded files with sanitized names)
```

### Database Records
The `actor_media` table stores metadata with `s3_url` pointing to local URLs:
- **Production**: `https://trimg-actor-media.s3.eu-west-1.amazonaws.com/actors/1/headshots/...`
- **Development**: `/dev-uploads/actors_1_headshots_1234567890_filename.webp`

## Testing Upload Flow

1. **Navigate to Upload Media**: http://localhost:3000/dashboard/upload-media
2. **Select a headshot file** (JPEG, PNG, or WebP)
3. **Fill in metadata**:
   - Title: e.g., "Professional Headshot"
   - Photo Credit: Photographer name
   - Description: Optional notes
4. **Click "Upload Headshots"**
5. **Verify**:
   - File saved to `apps/web/public/dev-uploads/`
   - Database record created in `actor_media`
   - Redirected to profile page showing the new headshot

## Testing Gallery Features

1. **View Profile**: http://localhost:3000/dashboard/profile
2. **Click primary headshot** → Gallery modal opens
3. **Navigate with chevron buttons** (left/right arrows)
4. **Close gallery** with X button
5. **Click "Change Headshot"** → Headshot selector opens
6. **Select different headshot** → Updates primary and display order
7. **Verify secondary thumbnails** displayed below primary

## Testing Profile Edit

1. **Click "Edit Profile" button**
2. **Modify fields**:
   - First Name
   - Last Name
   - Stage Name
   - Location
   - Bio
3. **Click "Save Changes"**
4. **Verify** page refreshes with updated data

## Switching to Production S3

When ready to deploy to production:

1. **Create S3 Bucket**:
   - Bucket name: `trimg-actor-media`
   - Region: `eu-west-1`
   - Enable versioning (optional)
   - Configure CORS for Next.js origin

2. **Update Environment Variables**:
   ```bash
   USE_MOCK_S3=false
   AWS_ACCESS_KEY_ID=<your-production-key>
   AWS_SECRET_ACCESS_KEY=<your-production-secret>
   AWS_S3_BUCKET_NAME=trimg-actor-media
   AWS_REGION=eu-west-1
   ```

3. **Configure IAM Permissions**:
   Required S3 actions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
   - `s3:ListBucket`

4. **Migrate Existing Files** (if needed):
   - Upload files from `dev-uploads/` to S3
   - Update `s3_url` in `actor_media` table to S3 URLs

## Architecture Notes

### S3 Library Features
- **Automatic mode detection**: Checks `DEV_MODE` flag
- **Consistent interface**: Same API for dev and production
- **File validation**: Type checking (image/jpeg, png, webp)
- **Size limits**: 10MB for images, 50MB audio, 500MB video
- **Sanitized keys**: Replaces slashes with underscores for local storage

### Database Schema
The `actor_media` table supports:
- **Multiple media types**: headshot, audio_reel, video_reel
- **Primary constraint**: Only one primary per media type per actor
- **Display order**: 0=primary, 1=secondary, 2=tertiary1, 3=tertiary2
- **Soft delete**: `deleted_at` column (S3 files deleted immediately)

### API Endpoints
- `POST /api/media/upload` - Upload new media
- `GET /api/media?type=headshot` - Get media by type
- `PUT /api/media/[id]` - Update media metadata
- `DELETE /api/media/[id]` - Delete media (soft delete DB, hard delete S3)
- `PUT /api/media/[id]/set-primary` - Set as primary headshot
- `PUT /api/actors/[id]` - Update actor profile

## Troubleshooting

### Error: "No actors found in database"
Run the seed script to create an actor:
```bash
node scripts/seed-test-headshot.js
```

### Error: "File not found"
Ensure the source file exists:
```
c:\Users\adamr\Downloads\a-r-greene_headshot.webp
```

### Files not displaying
1. Check `USE_MOCK_S3=true` in `.env.local`
2. Verify files exist in `apps/web/public/dev-uploads/`
3. Check browser console for 404 errors
4. Restart dev server: `pnpm dev`

### Can't upload new files
1. Check actor record exists in database
2. Verify user has Actor role in Auth0
3. Check file type (must be jpeg, png, or webp for headshots)
4. Check file size (max 10MB for images)
5. Check browser console for errors

## Production Deployment Checklist

Before deploying to production with real S3:

- [ ] Create S3 bucket in AWS Console
- [ ] Configure bucket CORS policy
- [ ] Create IAM user with S3 permissions
- [ ] Set `USE_MOCK_S3=false` in production environment
- [ ] Add production AWS credentials to environment
- [ ] Test upload flow in production
- [ ] Verify signed URLs work correctly
- [ ] Monitor S3 costs and usage
- [ ] Set up CloudFront CDN (optional, for better performance)
- [ ] Enable S3 bucket encryption
- [ ] Configure S3 lifecycle policies for old files

## Next Steps

1. ✅ Run seed script to test with provided headshot
2. ✅ Test upload flow with new files
3. ✅ Test gallery and selector functionality
4. ✅ Test profile edit functionality
5. ⏳ Create S3 bucket when ready for production
6. ⏳ Deploy with production credentials
