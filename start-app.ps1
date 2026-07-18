# Start Aida Café Rewards locally
Set-Location $PSScriptRoot\production\api
Write-Host ""
Write-Host "  Starting Aida Cafe API..." -ForegroundColor Cyan
Write-Host "  Open in browser: http://localhost:3001" -ForegroundColor Green
Write-Host "  (Do NOT double-click index.html)" -ForegroundColor Yellow
Write-Host ""
npm start
