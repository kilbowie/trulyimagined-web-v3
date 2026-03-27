# Clean Restart Script for Next.js
# Clears build cache and restarts dev server

Write-Host "🧹 Clearing Next.js Build Cache..." -ForegroundColor Cyan

# Navigate to web app directory
Set-Location "apps/web"

# Check if .next exists
if (Test-Path ".next") {
    Write-Host "📁 Found .next directory, clearing contents..." -ForegroundColor Yellow
    Get-ChildItem -Path ".next" -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "✅ Cache cleared!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No .next cache found (first run)" -ForegroundColor Gray
}

Write-Host "`n🚀 Starting fresh dev server..." -ForegroundColor Cyan
Write-Host "   Once started, test at:" -ForegroundColor Gray
Write-Host "   - http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "   - http://localhost:3000/dashboard/verifiable-credentials`n" -ForegroundColor White

# Start dev server
pnpm dev
