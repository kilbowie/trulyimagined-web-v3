# Cloudflare R2 Logo 403 Error - Fix Guide

**Issue:** Logo at `https://assets.trulyimagined.com/logo.png` returns 403 Forbidden  
**Cause:** R2 bucket not configured for public access via custom domain

---

## Solution Steps

### Step 1: Verify R2 Bucket Configuration

1. **Log into Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com/
   - Navigate to **R2** in the left sidebar

2. **Select Your Bucket**
   - Find the bucket containing `logo.png`
   - Click on the bucket name

### Step 2: Enable Public Access via Custom Domain

#### Option A: Connect Custom Domain (Recommended)

1. In your R2 bucket, go to **Settings** tab
2. Scroll to **Public Access** section
3. Click **Connect Domain** (or **Custom Domains**)
4. Add domain: `assets.trulyimagined.com`
5. Cloudflare will show you the required DNS records

#### DNS Configuration Required:

```
Type: CNAME
Name: assets.trulyimagined.com
Target: [Your R2 bucket public URL]
Proxy: Enabled (orange cloud)
```

**Important:** The domain `assets.trulyimagined.com` must be:
- On Cloudflare DNS (same account or zone)
- Have the CNAME record pointing to R2
- Have "Proxied" enabled (orange cloud)

### Step 3: Configure CORS Settings

1. In R2 bucket **Settings**
2. Find **CORS policy** section
3. Add the following configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://trulyimagined.com",
      "https://www.trulyimagined.com",
      "https://*.trulyimagined.com",
      "https://*.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 4: Verify Object Permissions

1. Navigate to your bucket
2. Find `logo.png` file
3. Click on the file
4. Ensure it's uploaded successfully
5. Check file size (should not be 0 bytes)

### Step 5: Test Access

After configuration, test these URLs:

1. **Direct R2 URL:** `https://[bucket-id].r2.cloudflarestorage.com/logo.png`
2. **Custom Domain:** `https://assets.trulyimagined.com/logo.png`

Wait 5-10 minutes for DNS propagation if you just configured the custom domain.

---

## Alternative Solutions

### Temporary Fix 1: Use Cloudflare Images

If you have Cloudflare Images:
1. Upload logo to Cloudflare Images
2. Get the delivery URL (format: `https://imagedelivery.net/[account-hash]/[image-id]/public`)
3. Update logo references

### Temporary Fix 2: Host in /public Directory

Upload logo to Next.js public folder:

1. **Save logo to:** `apps/web/public/logo.png`
2. **Update references to:** `/logo.png` (relative URL)
3. **Benefits:**
   - Immediate availability
   - No external dependencies
   - Cached by Vercel CDN

**Code changes needed:**
```tsx
// Instead of:
src="https://assets.trulyimagined.com/logo.png"

// Use:
src="/logo.png"
```

### Temporary Fix 3: Use Data URI or SVG

Convert PNG to inline SVG or base64 data URI for instant loading without external requests.

---

## Troubleshooting

### Still Getting 403?

1. **Check Domain Ownership:**
   - Verify `assets.trulyimagined.com` is in same Cloudflare account
   - Verify DNS is active and propagated

2. **Check R2 Custom Domain Status:**
   - Go to R2 bucket → Settings → Custom Domains
   - Should show "Active" status next to domain

3. **Browser Cache:**
   - Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - Clear browser cache
   - Try incognito/private window

4. **Check File Path:**
   - Ensure file is at root of bucket: `/logo.png` not `/folder/logo.png`
   - Case-sensitive: `logo.png` not `Logo.png`

5. **Cloudflare R2 Limits:**
   - Free tier: 10GB storage, 10 million Class A operations/month
   - Egress from custom domains is free

### Testing with cURL

```bash
# Test direct access
curl -I https://assets.trulyimagined.com/logo.png

# Expected response:
# HTTP/2 200 
# content-type: image/png
# ...
```

---

## Recommended Solution

**For Production:** Use R2 with custom domain (Steps 1-5 above)

**For Development (Quick Fix):** Move logo to `/public` directory

---

## Next Steps After Fix

1. ✅ Verify logo loads in browser
2. ✅ Check all email templates render correctly
3. ✅ Test social media previews (Open Graph)
4. ✅ Verify favicon displays
5. ✅ Clear CDN cache if using Vercel/Cloudflare

---

## Need Help?

If still experiencing issues:
1. Check R2 bucket region compatibility
2. Verify billing/account status
3. Contact Cloudflare support with:
   - Bucket name
   - Custom domain configuration
   - Error logs/screenshots
