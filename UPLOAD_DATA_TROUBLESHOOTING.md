# Upload Data Troubleshooting Guide

## Problem: Uploaded Data Not Appearing in Dashboard

If you've uploaded sales data but it's not showing up in your Dashboard or Month-over-Month pages, this guide will help you identify and fix the issue.

## Quick Diagnostic Tool

We've built a comprehensive diagnostic tool to help you identify the exact issue.

### How to Use It:

1. **Navigate to the Diagnostic Page** (Settings menu)
2. **Click "Check Uploads"** (red button)
3. **Review the results** to see exactly what's wrong

The diagnostic will check:
- Total sales records in your database
- Records missing dates
- Upload statuses (completed, needs review, failed, processing)
- Records that are ready for dashboard display
- Details about your most recent upload

## Common Issues and Solutions

### Issue 1: Records Missing Dates ⚠️

**Symptom:** You see a red banner on the Upload page saying "Data Not Appearing in Dashboard"

**Why this happens:** The analytics queries require records to have either an `order_date` or `default_period` value. Records without dates cannot be placed on monthly charts or timeline views.

**Solution:**
1. Go to the **Upload page**
2. Click the **"Assign Dates"** button in the red banner
3. Select the month these records should be assigned to
4. Click **"Assign to X Records"**
5. Your data will immediately appear in the Dashboard!

### Issue 2: Upload Needs Review 📋

**Symptom:** Upload shows "Needs Review" status with a yellow banner

**Why this happens:** Some records are missing dates and need manual assignment.

**Solution:**
1. Click the **"Add Dates"** button on the specific upload
2. Assign dates to the records
3. Upload status will change to "Completed"
4. Data will appear in Dashboard

### Issue 3: Upload Needs Product Review 🔀

**Symptom:** Upload shows "Needs Product Review" status with a purple banner

**Why this happens:** The system detected potential duplicate product names that need manual review.

**Solution:**
1. Click the **"Review Products"** button
2. Choose to merge duplicates or keep them separate
3. Upload status will change to "Completed"
4. Data will appear in Dashboard

### Issue 4: Upload Still Processing ⏳

**Symptom:** Upload shows "Processing" status for more than 5 minutes

**Why this happens:** The upload may have stalled or encountered an error.

**Solution:**
1. If processing for >5 minutes, the upload likely failed silently
2. Re-upload the file
3. Ensure you selected a distributor before uploading

### Issue 5: Wrong Organization Selected 🏢

**Symptom:** Data uploaded but Dashboard is empty

**Why this happens:** You're viewing a different organization than the one you uploaded to.

**Solution:**
1. Check the organization dropdown in the top navigation
2. Switch to the organization you uploaded data for
3. Data should now appear

## Understanding Upload Status

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| **Completed** ✅ | Successfully processed | None - data is in Dashboard |
| **Needs Review** ⚠️ | Missing dates | Click "Add Dates" button |
| **Needs Product Review** 🔀 | Duplicate products | Click "Review Products" button |
| **Processing** ⏳ | Currently being processed | Wait (or re-upload if >5 minutes) |
| **Failed** ❌ | Upload failed | Check error message and re-upload |

## How Data Flows to the Dashboard

Here's what happens when you upload a file:

1. **Upload Created** - File is saved and status set to "processing"
2. **Column Detection** - AI detects which columns contain account, product, quantity, date, etc.
3. **Data Transformation** - Rows are converted to standardized format
4. **Sales Data Insert** - Records are inserted into `sales_data` table with your `organization_id`
5. **Date Validation** - System checks if all records have dates
   - ✅ **All have dates** → Status = "Completed"
   - ⚠️ **Some missing dates** → Status = "Needs Review"
6. **Product Deduplication** - System checks for duplicate product names
   - ✅ **All unique** → Status = "Completed"
   - 🔀 **Duplicates found** → Status = "Needs Product Review"
7. **Aggregation** - Products and accounts tables are updated
8. **Dashboard Queries** - Dashboard fetches data with filter: `order_date IS NOT NULL OR default_period IS NOT NULL`

**Key Point:** If records don't have dates in step 8, they won't appear in the Dashboard!

## Dashboard Query Requirements

The Dashboard and analytics pages use these filters:

```sql
SELECT * FROM sales_data
WHERE organization_id = 'your-org-id'
AND (order_date IS NOT NULL OR default_period IS NOT NULL)
```

Records must pass BOTH conditions:
1. Match your organization ID
2. Have a date (either order_date or default_period)

## Bulk Date Assignment Tool

### When to Use It:

- You uploaded files without date columns
- Multiple uploads have records missing dates
- You want to quickly assign all dateless records to a specific month

### How It Works:

1. Finds all records where `order_date IS NULL AND default_period IS NULL`
2. Updates them to set `default_period = 'YYYY-MM'` (the month you select)
3. Records immediately become visible in Dashboard

### Why It's Safe:

- Only updates records that have NO date at all
- Doesn't modify records that already have dates
- Uses `default_period` field specifically designed for this purpose
- Reversible (you can change the month later if needed)

## Running the Diagnostic

### Upload Data Check Results:

**✅ Green (Success):** Everything is working correctly
- All records have dates
- Uploads completed successfully
- Data ready for dashboard

**⚠️ Yellow (Warning):** Needs attention but not critical
- Some uploads need review
- Uploads still processing (if <5 minutes)
- Records without dates found

**❌ Red (Error):** Requires immediate action
- Records missing dates (blocking dashboard display)
- Failed uploads
- No sales data found

### Example Diagnostic Output:

```
✅ Total Sales Records: Found 1,234 sales records
❌ Records with Missing Dates: Found 456 records without dates
   → These records will NOT appear in Dashboard or analytics
   → Go to Upload page and click "Add Dates" button to fix this
⚠️ Upload History: 3 recent uploads found
   → Completed: 1, Needs Review: 1, Processing: 1
❌ Dashboard-Ready Records: 778 records ready for dashboard
   → Only these records will appear in your analytics
```

## Prevention: Always Upload Files with Dates

### Best Practices:

1. **Include Date Column** - Ensure your CSV/Excel has a date column
2. **Use Standard Date Formats** - YYYY-MM-DD, MM/DD/YYYY, or similar
3. **Select Distributor** - Always select a distributor before uploading
4. **Check Upload Status** - Review the Upload page after uploading
5. **Fix Issues Immediately** - Don't ignore "Needs Review" banners

### If Your File Has No Dates:

If your source data truly has no dates (e.g., inventory snapshot):
1. Upload the file normally
2. Use the **Bulk Date Assignment** tool
3. Assign all records to the relevant month
4. Data will appear in Dashboard

## Need Help?

If you're still experiencing issues after following this guide:

1. Run the **"Check Uploads"** diagnostic
2. Take a screenshot of the results
3. Note your upload file name and when you uploaded it
4. Check if you selected the correct organization
5. Verify you clicked "Assign Dates" if prompted

## Technical Details

### Database Schema:

Records in `sales_data` table have:
- `organization_id` - Must match your current organization
- `order_date` - Primary date field (from your data)
- `default_period` - Fallback date field (YYYY-MM format)

### Query Logic:

Analytics queries use this pattern:
```sql
.or('order_date.not.is.null,default_period.not.is.null')
```

This means: Show records where `order_date` is not null OR `default_period` is not null.

Records with BOTH fields null are filtered out.

## Summary

**Most Common Issue:** Records missing dates
**Quickest Fix:** Click "Assign Dates" button on Upload page
**Diagnostic Tool:** Settings → Diagnostic → "Check Uploads"
**Prevention:** Always include date column in uploads

Your data is safe in the database. It's just not appearing in analytics because it lacks the required date field for timeline/monthly views.
