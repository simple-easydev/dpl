# Premise Type Filtering Implementation

## Overview
Successfully implemented intelligent premise type filtering for the Depletions table, allowing users to filter sales records by account type (on-premise vs off-premise establishments). The system uses AI to automatically classify accounts and provides manual override capabilities.

## Features Implemented

### 1. Database Schema Enhancement
- **Migration Applied**: `add_premise_type_to_accounts`
- **New Columns**:
  - `premise_type`: Classification ('on_premise', 'off_premise', 'unclassified')
  - `premise_type_confidence`: AI classification confidence score (0-1)
  - `premise_type_updated_at`: Timestamp of last classification
  - `premise_type_manual_override`: Boolean flag for manual classifications
- **Indexes**: Created for efficient filtering on premise_type
- **Default Value**: 'unclassified' for all existing and new accounts

### 2. AI Classification Service
- **File**: `src/lib/premiseClassificationService.ts`
- **Capabilities**:
  - Uses OpenAI GPT-4o-mini to classify account names
  - Distinguishes on-premise (bars, restaurants, nightclubs) from off-premise (retail stores, liquor shops)
  - Fallback pattern-based classification when AI unavailable
  - Batch processing (10 accounts per batch with 500ms delays)
  - Confidence threshold: 70% minimum for classification

- **Key Functions**:
  - `classifyAccountPremiseType()`: Classify a single account
  - `batchClassifyAccounts()`: Process multiple accounts
  - `classifyUnclassifiedAccounts()`: Auto-classify unclassified accounts
  - `reclassifyAllAccounts()`: Re-run classification for all accounts
  - `updateAccountPremiseType()`: Manual override
  - `getPremiseTypeStats()`: Get classification statistics

### 3. Automatic Classification Integration
- **Data Upload Flow**: After sales data uploads and account aggregation, unclassified accounts are automatically classified
- **Manual Order Entry**: When orders are added through AddOrderModal, new accounts are classified immediately
- **Integration Points**:
  - `src/lib/dataProcessor.ts`: Auto-classifies after `updateAggregatedData()`
  - `src/components/AddOrderModal.tsx`: Classifies after order insertion

### 4. Depletions Table UI Enhancements
- **Filter Toggle**: Four-option control with:
  - **ALL**: Show all depletions (default)
  - **ON-PREMISE**: Bars, restaurants, nightclubs
  - **OFF-PREMISE**: Retail stores, liquor shops
  - **UNCLASSIFIED**: Accounts not yet classified

- **Design**:
  - Glass morphism styling consistent with app design
  - Blue/cyan gradients for active state (no purple/indigo per requirements)
  - Icons: Building2 (ALL), Wine (ON-PREMISE), Store (OFF-PREMISE), HelpCircle (UNCLASSIFIED)
  - Smooth transitions and hover states
  - Helpful description text

- **Account Badges**: Each account name displays a colored badge:
  - **On-premise**: Blue/cyan gradient with wine glass icon
  - **Off-premise**: Teal/emerald gradient with store icon
  - **Unclassified**: Gray badge with question mark

### 5. Filtering Logic
- Works in conjunction with existing search functionality
- Fetches accounts with premise types separately
- Maps premise types to sales records
- Client-side filtering for responsive UI
- Pagination respects active filters

## User Workflow

### Automatic Classification
1. User uploads sales data or adds manual order
2. System processes data and creates/updates accounts
3. AI automatically classifies new accounts in background
4. Accounts immediately available for filtering

### Manual Filtering
1. Navigate to Depletions table
2. Click desired premise type in toggle
3. Table instantly filters to matching records
4. Badges show classification on each account
5. Search works across filtered results

## Technical Details

### Classification Criteria

**On-Premise Indicators**:
- bar, restaurant, nightclub, tavern, brewery, pub, lounge, club
- hotel, casino, bistro, cafe, grill, steakhouse, diner, eatery
- pizzeria, cantina, taproom, gastropub

**Off-Premise Indicators**:
- liquor, wine shop, retail, store, market, grocery, supermarket
- convenience, package, spirits, bottle shop, beverage, distribut

### Confidence Threshold
- Minimum: 70%
- Below threshold: Marked as 'unclassified'
- AI provides reasoning for each classification
- Manual overrides always confidence = 1.0

### Performance Optimizations
- Batch processing (10 accounts per batch)
- 500ms delay between batches to respect API limits
- Indexed queries for fast filtering
- Client-side filtering after initial fetch
- Only classifies unclassified accounts (no redundant API calls)
- Classifications cached in database

## Files Created/Modified

### New Files
- `src/lib/premiseClassificationService.ts` - Core classification logic
- `PREMISE_TYPE_FILTERING.md` - This documentation

### Modified Files
- `src/lib/database.types.ts` - Added premise_type fields to accounts type
- `src/lib/dataProcessor.ts` - Integrated automatic classification
- `src/components/AddOrderModal.tsx` - Added classification for manual orders
- `src/pages/DataPage.tsx` - Added filter toggle UI, filtering logic, and badges

### Database
- Applied migration: `add_premise_type_to_accounts`
- Added 4 new columns to accounts table
- Created 3 new indexes

## API Usage

- Model: GPT-4o-mini
- Cost: ~$0.001 per account classification
- Batch processing minimizes API calls
- Fallback to pattern matching if API unavailable
- Organization-specific API keys supported

## Build Status
✅ Build completed successfully with no errors
✅ TypeScript compilation passed
✅ All files properly integrated

## Next Steps (Future Enhancements)

1. **Manual Reclassification**: Add button to manually reclassify accounts
2. **Settings Page Integration**: Add premise type management section
3. **Statistics Dashboard**: Show distribution of account types
4. **Confidence Tooltips**: Display confidence scores on badge hover
5. **Bulk Override Interface**: Allow manual batch reclassification
6. **Account Detail Page**: Show classification history and allow editing

## Testing

Users can test the implementation by:
1. Uploading sales data with various account types
2. Verifying accounts are automatically classified
3. Using the filter toggle to view different premise types
4. Checking that badges display correctly
5. Ensuring search works with filters
6. Adding manual orders and verifying classification

## Security

- Only account names sent to OpenAI (no sensitive data)
- Organization-specific API keys respected
- RLS policies ensure data isolation
- Manual overrides tracked separately
- Classification timestamps recorded
