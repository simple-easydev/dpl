# Deploy AI Detection Edge Functions (Header Detection + Column Mapping)
# Run this script after setting up OPENAI_API_KEY secret

Write-Host "🚀 Deploying AI Detection Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
if (!(Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if OPENAI_API_KEY is set
Write-Host "🔑 Checking for OPENAI_API_KEY secret..." -ForegroundColor Yellow
$secrets = supabase secrets list 2>&1
if ($secrets -notmatch "OPENAI_API_KEY") {
    Write-Host "⚠️  OPENAI_API_KEY not found in Supabase secrets" -ForegroundColor Yellow
    Write-Host ""
    $setKey = Read-Host "Would you like to set it now? (y/n)"
    if ($setKey -eq "y") {
        $apiKey = Read-Host "Enter your OpenAI API key (sk-...)"
        if ($apiKey) {
            supabase secrets set OPENAI_API_KEY=$apiKey
            Write-Host "✅ API key set successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ No API key provided. Exiting." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Cannot deploy without OPENAI_API_KEY. Exiting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ OPENAI_API_KEY found" -ForegroundColor Green
}

Write-Host ""
Write-Host "📦 Deploying AI detection functions..." -ForegroundColor Yellow

# Deploy both functions
Write-Host "   Deploying detect-header-row..." -ForegroundColor Gray
supabase functions deploy detect-header-row

Write-Host "   Deploying detect-column-mapping..." -ForegroundColor Gray
supabase functions deploy detect-column-mapping

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Edge Functions deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Deployed functions:" -ForegroundColor Cyan
    Write-Host "   • detect-header-row (AI header detection)" -ForegroundColor White
    Write-Host "   • detect-column-mapping (AI column mapping)" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Test the functions with your XLSX files" -ForegroundColor White
    Write-Host "   2. Monitor logs: supabase functions logs --follow" -ForegroundColor White
    Write-Host "   3. Check invocations in Supabase Dashboard" -ForegroundColor White
    Write-Host ""
    Write-Host "🔍 To test locally first:" -ForegroundColor Cyan
    Write-Host "   supabase functions serve" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check the error above." -ForegroundColor Red
    exit 1
}
