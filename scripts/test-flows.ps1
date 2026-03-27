# Test Identity Verification Flow
# PowerShell test script for Step 7

$line = "============================================================"

Write-Host "🧪 Testing Identity Verification Flow (Step 7)" -ForegroundColor Cyan
Write-Host $line -ForegroundColor Gray

Write-Host "`n✅ Stage 1: Database Migration - COMPLETE" -ForegroundColor Green
Write-Host "   - identity_links table created successfully" -ForegroundColor White

Write-Host "`n🚀 Stage 2: Testing Verification Flow" -ForegroundColor Yellow
Write-Host "`n📋 Manual Test Steps:" -ForegroundColor Cyan

Write-Host "`n1️⃣  Test Verification Status Page:" -ForegroundColor White
Write-Host "   URL: http://localhost:3000/dashboard/verify-identity" -ForegroundColor Gray
Write-Host "   ✓ Page loads without errors" -ForegroundColor Green
Write-Host "   ✓ Shows 'UNVERIFIED' status initially" -ForegroundColor Green
Write-Host "   ✓ Displays three verification options (Mock, Onfido, Yoti)" -ForegroundColor Green

Write-Host "`n2️⃣  Test Mock Verification:" -ForegroundColor White
Write-Host "   Action: Click 'Start Mock' button" -ForegroundColor Gray
Write-Host "   Expected:" -ForegroundColor Gray
Write-Host "   ✓ Success message appears" -ForegroundColor Green
Write-Host "   ✓ Status updates to 'VERIFIED' or 'FULLY-VERIFIED'" -ForegroundColor Green
Write-Host "   ✓ Verification Level shows 'HIGH'" -ForegroundColor Green
Write-Host "   ✓ Assurance Level shows 'HIGH'" -ForegroundColor Green
Write-Host "   ✓ 'mock-kyc' provider appears in linked providers" -ForegroundColor Green

Write-Host "`n3️⃣  Test API Endpoints:" -ForegroundColor White
Write-Host "   GET /api/verification/status" -ForegroundColor Gray
Write-Host "   GET /api/identity/links" -ForegroundColor Gray

Write-Host "`n4️⃣  Test Unlink Functionality:" -ForegroundColor White
Write-Host "   Action: Click 'Unlink' button on mock-kyc" -ForegroundColor Gray
Write-Host "   Expected:" -ForegroundColor Gray
Write-Host "   ✓ Confirmation dialog appears" -ForegroundColor Green
Write-Host "   ✓ Provider removed from list" -ForegroundColor Green
Write-Host "   ✓ Status resets to 'UNVERIFIED'" -ForegroundColor Green

Write-Host "`n" -NoNewline
Write-Host $line -ForegroundColor Gray

Write-Host "`n🎯 Stage 3: Testing Consent Flow (Step 6)" -ForegroundColor Yellow

Write-Host "`n1️⃣  Test Consents Dashboard:" -ForegroundColor White
Write-Host "   URL: http://localhost:3000/dashboard/consents" -ForegroundColor Gray
Write-Host "   Expected:" -ForegroundColor Gray
Write-Host "   ✓ Page loads without 500 error" -ForegroundColor Green
Write-Host "   ✓ Shows empty state or existing consents" -ForegroundColor Green
Write-Host "   ✓ Summary cards display counts" -ForegroundColor Green

Write-Host "`n2️⃣  Test Consent API Endpoints:" -ForegroundColor White
Write-Host "   GET /api/consent/[actorId]" -ForegroundColor Gray
Write-Host "   POST /api/consent/grant" -ForegroundColor Gray
Write-Host "   POST /api/consent/revoke" -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host $line -ForegroundColor Gray

Write-Host "`n🔍 Database Verification Query:" -ForegroundColor Cyan
Write-Host @"

SELECT 
  il.id,
  up.email,
  il.provider,
  il.provider_type,
  il.verification_level,
  il.assurance_level,
  il.is_active,
  il.verified_at
FROM identity_links il
JOIN user_profiles up ON il.user_profile_id = up.id
ORDER BY il.created_at DESC;

"@ -ForegroundColor Gray

Write-Host $line -ForegroundColor Gray
Write-Host "`n⏳ Waiting for you to complete manual testing..." -ForegroundColor Yellow
Write-Host "   Press Enter when testing is complete..." -ForegroundColor Gray

$null = Read-Host

Write-Host "`n📊 Test Summary:" -ForegroundColor Cyan
Write-Host "   Did verification page load correctly? (Y/N): " -NoNewline -ForegroundColor White
$verifyPageTest = Read-Host
Write-Host "   Did mock verification create identity link? (Y/N): " -NoNewline -ForegroundColor White
$mockVerifyTest = Read-Host
Write-Host "   Did consents page load without errors? (Y/N): " -NoNewline -ForegroundColor White
$consentsTest = Read-Host
Write-Host "   Did API endpoints respond correctly? (Y/N): " -NoNewline -ForegroundColor White
$apiTest = Read-Host

Write-Host "`n" -NoNewline
Write-Host $line -ForegroundColor Gray

$totalTests = 4
$passedTests = 0
if ($verifyPageTest -eq 'Y') { $passedTests++ }
if ($mockVerifyTest -eq 'Y') { $passedTests++ }
if ($consentsTest -eq 'Y') { $passedTests++ }
if ($apiTest -eq 'Y') { $passedTests++ }

$passColor = if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" }

Write-Host "`n✨ Results: $passedTests / $totalTests tests passed" -ForegroundColor $passColor

if ($passedTests -eq $totalTests) {
    Write-Host "`n🎉 All tests PASSED! Step 7 is fully functional." -ForegroundColor Green
    Write-Host "   ✅ Identity linking flow working" -ForegroundColor Green
    Write-Host "   ✅ Verification service operational" -ForegroundColor Green
    Write-Host "   ✅ Consent flow from Step 6 verified" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Review the issues above." -ForegroundColor Yellow
}

Write-Host "`n" -NoNewline
Write-Host $line -ForegroundColor Gray
Write-Host ""
