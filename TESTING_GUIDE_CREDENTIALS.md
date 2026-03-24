# Quick Testing Guide - Credential Issuance

## ✅ Automated Verification (Already Complete)

All automated tests passed:
```bash
node verify-credential-issuance.js
# Result: ✅ ALL CHECKS PASSED! (7/7)
```

---

## 🧪 Manual UI Testing

### 1. Start Development Server
```bash
cd apps/web
pnpm dev
```

### 2. Login as Actor
- URL: http://localhost:3000/auth/login
- Email: `adamrossgreene@gmail.com`
- Password: [your password]

### 3. Navigate to Dashboard
- URL: http://localhost:3000/dashboard
- Scroll down to "Verifiable Credentials" section

### 4. Issue Credential
1. Click **"Issue Credential"** button
2. Wait 1-2 seconds for processing
3. Expected result:
   ```
   ✅ Credential issued successfully!
   ```

### 5. Verify Credential Appears
- New credential card displays with:
  - Type: **"ActorCredential"**  
  - Status: **Active** (green badge)
  - Issuer: `did:web:trulyimagined.com`
  - Issued date: Today's date
  - Expires: 1 year from now

### 6. Download Credential
1. Click **"Download"** button on credential card
2. File downloads as: `credential-[UUID].json`
3. Open file in text editor to verify W3C VC 2.0 format

---

## 🎯 Expected Behavior

### Success Path
1. ✅ "Verifiable Credentials" card visible on dashboard
2. ✅ "Issue Credential" button is enabled (not greyed out)
3. ✅ Button shows "Issuing..." while processing
4. ✅ Success alert appears: "Credential issued successfully!"
5. ✅ Credential appears in list immediately
6. ✅ Download works without errors

### If Error Occurs
- Red error box appears with specific error message
- Common errors and solutions in [CREDENTIAL_ISSUANCE_FIX.md](CREDENTIAL_ISSUANCE_FIX.md#troubleshooting)

---

## 📊 What Was Fixed

**Problem**: Missing actor record in `actors` table

**Solution**: 
1. Created actor record for adamrossgreene@gmail.com
2. Linked actor to user profile
3. Set verification status to "verified"

**Files**: 
- Actor ID: `d0364e6c-a3e3-462d-9a25-9bd5ef5d9499`
- Profile ID: `7145aebf-0af7-47c6-88dd-0938748c3918`
- Email: `adamrossgreene@gmail.com`

---

## 🔍 Diagnostic Commands

If testing reveals issues:

```bash
# Check all prerequisites
node verify-credential-issuance.js

# Check identity links
node check-actor-identity-links.js

# Recreate actor record (if needed)
node create-actor-record.js
```

---

## ✅ Test Checklist

- [ ] Dev server starts without errors
- [ ] Can log in as adamrossgreene@gmail.com
- [ ] Dashboard loads successfully
- [ ] Email shows as verified (✅ Yes)
- [ ] "Verifiable Credentials" section is visible
- [ ] "Issue Credential" button is enabled
- [ ] Clicking button shows "Issuing..." state
- [ ] Success message appears
- [ ] Credential appears in list
- [ ] Credential shows ActorCredential type
- [ ] Credential has green "Active" badge
- [ ] Download button works
- [ ] Downloaded file is valid JSON

---

**Status**: Ready for Manual Testing  
**All Prerequisites**: ✅ Verified  
**Expected Result**: Credential issuance should work successfully
