# Depletion Mode Implementation

## Overview
This document describes the implementation of flexible depletion report support, where Date and Revenue fields are now **optional**. The system now supports quantity-only depletion tracking where only Account/Customer and Product information are required.

## Key Changes

### 1. Database Schema Updates
**File:** `supabase/migrations/20251011180000_make_date_and_revenue_optional.sql`

- Made `order_date` nullable in the `sales_data` table
- Made `revenue` nullable in the `sales_data` table
- Added `has_revenue_data` boolean field to track which records include revenue
- Added `default_period` text field for bulk-assigned periods (format: YYYY-MM)
- Added `unit_type` text field to specify quantity units (bottles, cases, etc.)
- Created indexes for efficient querying of revenue-enabled records

**Migration Status:** Ready to apply. Run through Supabase migration system.

### 2. Type Definitions
**File:** `src/lib/database.types.ts`

Updated the `sales_data` table types:
- `order_date`: Changed from `string` to `string | null`
- `revenue`: Changed from `number` to `number | null`
- Added `has_revenue_data: boolean | null`
- Added `default_period: string | null`
- Added `unit_type: string | null`

### 3. Bulk Date Entry Component
**File:** `src/components/DatePeriodSelector.tsx` (NEW)

Created a modal component that allows users to:
- Select a month and year for all records in a file
- Bulk-assign a period to records without specific dates
- Skip period assignment if desired (records remain undated)
- Shows the count of records that will be affected

### 4. Column Mapping Updates
**File:** `src/components/ColumnMappingPreview.tsx`

- Moved Date and Revenue from **Required Fields** to **Optional Fields**
- Only Account/Customer and Product/SKU are now required
- Added informational text explaining depletion report flexibility
- Updated field descriptions to mention they're optional for depletion reports

### 5. Data Processing Layer
**File:** `src/lib/dataProcessor.ts`

Major updates to the `transformRow` function:
- Removed requirement for date and revenue columns
- Only validates that account and product are present
- Added `defaultPeriod` parameter support
- Sets `has_revenue_data` flag based on whether revenue exists
- Handles null dates and null revenue gracefully
- Updated error messages to reflect only Account and Product are required
- PDF extraction now supports records without dates or revenue

### 6. Column Detection Intelligence
**File:** `src/lib/columnDetection.ts`

- Updated AI prompts to explain that date and revenue are optional
- AI is now instructed to accept files without these columns
- Pattern detection handles missing date/revenue gracefully

### 7. Analytics Layer Updates
**File:** `src/lib/revenueAnalytics.ts`

**New Function:**
- `checkHasRevenueData()`: Checks if organization has any revenue data

**Updated Functions:**
- `getMonthlyRevenueData()`:
  - Now queries for `default_period` and `has_revenue_data`
  - Uses `default_period` when `order_date` is null
  - Only includes revenue in calculations when `has_revenue_data` is true

- `getRevenueByCategory()`: Filters to records with `has_revenue_data = true`
- `getRevenueByRepresentative()`: Filters to records with `has_revenue_data = true`
- `getRevenueByRegion()`: Filters to records with `has_revenue_data = true`

All revenue-based queries now explicitly filter for records that have revenue data, preventing null values from breaking calculations.

### 8. Dashboard UI Updates
**File:** `src/pages/Dashboard.tsx`

- Added `hasRevenueData` state variable
- Calls `checkHasRevenueData()` during data fetch
- Displays informational banner when revenue data is not available:
  > "Note: Not all depletion reports include revenue data. Metrics shown reflect available information based on product movement and account activity."

### 9. Upload Flow Integration
**File:** `src/components/FileUpload.tsx`

- Integrated `DatePeriodSelector` component
- Added logic to detect when date mapping is missing
- Shows date period selector modal after column mapping confirmation
- Allows users to bulk-assign a month/year to all records
- Updated upload description text to mention optional date/revenue
- Passes `defaultPeriod` to data processor when specified

## User Flow

### Uploading a Depletion Report (Without Dates or Revenue)

1. User selects a distributor
2. User uploads a CSV/Excel file containing only Account and Product columns
3. System detects columns automatically
4. **Column Mapping Preview** shows:
   - Account and Product as **Required** (marked with checkmarks)
   - Date and Revenue as **Optional** (in optional fields section)
   - Info text: "For depletion reports: Only Account and Product are required. Date and Revenue are optional."
5. User confirms mapping
6. **Date Period Selector** appears:
   - Shows: "This file doesn't include specific dates for each record"
   - User selects month and year (e.g., "January 2025")
   - Or user clicks "Skip (Leave Undated)"
7. System processes records with the selected period
8. Success message shows: "✓ Processed 200 of 200 rows for 2025-01"

### Dashboard Behavior

When viewing data:
- If organization has ANY records with revenue: Dashboard works normally
- If organization has NO records with revenue: Blue banner appears explaining revenue data is not available
- Revenue-based charts show "No data" when revenue is missing
- Quantity-based metrics work regardless of revenue presence

## Data Integrity

### Required Fields (Always)
- `account_name` (from account/customer column)
- `product_name` (from product/SKU column)
- At least one of: `order_date` OR `default_period` (for time-based grouping)

### Optional Fields
- `revenue` (can be null for depletion-only reports)
- `order_date` (can be null if default_period is set)
- `quantity` (defaults to 1 if not provided)
- `representative`, `category`, `region`, etc.

### Data Validation
- Records are rejected if missing account or product
- Records are rejected if account/product names are less than 2 characters
- Revenue-based analytics automatically exclude records where `has_revenue_data = false`

## Benefits

1. **Flexibility**: Supports depletion reports from distributors who only track product movement
2. **Bulk Date Entry**: No need to manually add dates to 200+ records
3. **Backwards Compatible**: Existing records with dates and revenue continue to work normally
4. **Smart Analytics**: Revenue charts automatically filter to revenue-enabled data
5. **Clear Communication**: Users are informed when revenue data is not available
6. **Progressive Enhancement**: System works with minimal data, enhances with more complete data

## Testing Recommendations

1. Upload a CSV with only Account, Product, and Quantity columns
2. Verify date period selector appears
3. Assign a month/year and confirm import succeeds
4. Check dashboard displays the blue info banner
5. Verify quantity-based metrics still display correctly
6. Upload a complete file with dates and revenue
7. Verify banner disappears and revenue charts populate

## Notes

- The `has_revenue_data` field is automatically set during import based on whether revenue exists
- The `default_period` field uses YYYY-MM format for consistency with date parsing
- All existing records will have `has_revenue_data = TRUE` after migration
- Revenue queries use `WHERE has_revenue_data = TRUE AND revenue IS NOT NULL` for safety
