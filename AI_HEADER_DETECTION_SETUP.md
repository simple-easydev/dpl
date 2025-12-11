# AI-Powered Detection Setup

## Overview

The detection system now uses **Supabase Edge Functions** to securely call OpenAI, keeping API keys server-side and preventing exposure in the browser.

## Architecture

```
Frontend (FileUpload.tsx)
    ↓
Column Detection (columnDetection.ts)
    ↓
Supabase Edge Functions
    ├─ detect-header-row (finds header row)
    └─ detect-column-mapping (maps columns to fields)
    ↓
OpenAI API (GPT-4o-mini)
```

## Files Changed

### 1. **Edge Functions Created**
- `supabase/functions/detect-header-row/index.ts` - AI header row detection
- `supabase/functions/detect-column-mapping/index.ts` - AI column mapping
- Both securely call OpenAI API with server-side key

### 2. **Frontend Updated**
- `src/lib/columnDetection.ts`
- Removed direct OpenAI calls from browser
- Now calls Supabase Edge Functions via `supabase.functions.invoke()`

## Deployment Steps

### 1. Set OpenAI API Key in Supabase

```bash
# Set the secret in Supabase (one-time setup)
npx supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Deploy Edge Functions

```bash
# Deploy both AI detection functions
npx supabase functions deploy detect-header-row
npx supabase functions deploy detect-column-mapping

# Or use the deployment script
.\deploy-header-detection.ps1

# Or deploy all functions at once
npx supabase functions deploy
```

### 3. Verify Deployment

```bash
# Test the function locally first
npx supabase functions serve detect-header-row

# Test with curl
curl -X POST 'http://localhost:54321/functions/v1/detect-header-row' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "rows": [
      {"rowIndex": 0, "values": ["Title", "Report", null]},
      {"rowIndex": 1, "values": ["Date", "Name", "Amount"]},
      {"rowIndex": 2, "values": ["2024-01-01", "John", "100.50"]}
    ]
  }'
```

## How It Works

### Request Flow

1. **Frontend** sends first 15 rows to Edge Function:
```typescript
const { data } = await supabase.functions.invoke('detect-header-row', {
  body: { 
    rows: [
      { rowIndex: 0, values: ["Invoice", "08/05/2025", "Gomer's", ...] },
      { rowIndex: 1, values: ["Type", "Date", "Name", ...] },
      // ... up to 15 rows
    ]
  }
});
```

2. **Edge Function** calls OpenAI with secure API key
3. **OpenAI** analyzes structure and returns detection
4. **Edge Function** validates and returns result:
```json
{
  "headerRowIndex": 5,
  "columnNames": ["Type", "Date", "Name", "Memo", "Qty", "Sales Price", "Amount"],
  "confidence": 95,
  "reasoning": "Row 5 contains field names, previous rows are metadata"
}
```

### Fallback Strategy

```typescript
// Try AI detection first
const aiResult = await detectHeaderRowWithAI(rows);

if (aiResult && aiResult.confidence >= 70) {
  // Use AI result
  return aiResult;
} else {
  // Fall back to rule-based detection
  return ruleBasedDetection(rows);
}
```

## Security Benefits

✅ **API Key Protected**: OpenAI key never exposed to browser  
✅ **Rate Limiting**: Can add limits in Edge Function  
✅ **Cost Control**: Monitor usage in Supabase dashboard  
✅ **Audit Trail**: Edge Function logs all requests  

## Testing

### Test with Your Hierarchical Spreadsheet

Upload your complex XLSX file and check the console:

```
🤖 Using AI to detect header row...
🔐 Calling Supabase Edge Function for secure AI header detection...
✅ AI detected header at row 5 (confidence: 95%)
📋 AI extracted columns: ['Type', 'Date', 'Name', 'Memo', 'Qty', 'Sales Price', 'Amount']
```

### Expected Results

For your inventory spreadsheet with metadata rows:
- **Detected Row**: 5-6 (where actual headers are)
- **Confidence**: 90-95%
- **Columns**: Type, Date, Name, Memo, Qty, Sales Price, Amount
- **Avoids**: Metadata, section titles, data rows, totals

## Monitoring

### Check Edge Function Logs

```bash
# View function logs
npx supabase functions logs detect-header-row

# View in real-time
npx supabase functions logs detect-header-row --follow
```

### Monitor API Usage

- Supabase Dashboard → Edge Functions → detect-header-row
- Check invocation count, errors, response times
- Monitor OpenAI API costs separately

## Cost Estimation

- **GPT-4o-mini**: ~$0.15 per 1M input tokens
- **Average request**: ~500 tokens (15 rows)
- **Cost per detection**: ~$0.000075 (less than 1 cent)
- **1000 uploads**: ~$0.075

Very affordable compared to rule-based maintenance costs!

## Troubleshooting

### Function Returns Error

**Check API key:**
```bash
npx supabase secrets list
# Should show OPENAI_API_KEY (value hidden)
```

**Check function logs:**
```bash
npx supabase functions logs detect-header-row
```

### Low Confidence Results

AI will fall back to rule-based detection automatically.
Check console for: `⚠️ AI confidence too low, falling back to rule-based detection`

### Function Not Found

Ensure function is deployed:
```bash
npx supabase functions list
# Should show detect-header-row
```

## Next Steps

1. Deploy the Edge Function
2. Test with your hierarchical XLSX files
3. Monitor accuracy and adjust confidence threshold if needed
4. Consider adding usage analytics

## Future Enhancements

- Cache results for identical file structures
- Add user feedback loop to improve prompts
- Support custom prompts per organization
- Batch processing for multiple files
