# Multi-Format File Upload Support

## Overview

Your application now supports intelligent data extraction from PDF, CSV, and XLSX files. The system automatically identifies and extracts the following fields:

- **Date** (order date, sale date, invoice date)
- **Account** (customer name, account name, client)
- **Product** (product name, item, SKU)
- **Quantity** (QTY, units, cases, boxes)
- **Revenue** (amount, total, extended price)
- **Representative** (sales rep, salesperson, agent) - Optional

## Supported File Formats

### 1. CSV Files (.csv)
- Parsed using PapaParse library
- Automatic header detection
- Handles various delimiters and encodings
- Smart column mapping with fuzzy matching

### 2. Excel Files (.xlsx, .xls)
- Parsed using XLSX library
- Reads first sheet by default
- Supports both legacy and modern Excel formats
- Automatic data type detection

### 3. PDF Files (.pdf)
- Extracted using pdf-parse library
- AI-powered content extraction with OpenAI
- Support for distributor-specific templates
- Pattern-based fallback extraction
- Handles both tabular and unstructured data

## Field Detection Methods

The system uses multiple detection methods in order of preference:

### 1. Learned Mappings (Highest Priority)
- Uses historical upload data from your organization
- Remembers column mappings from similar files
- 70% confidence threshold for reuse
- Distributor-specific learning

### 2. AI-Powered Detection (OpenAI)
- Uses GPT-4o-mini for intelligent column mapping
- Context-aware field identification
- Handles abbreviations and variations
- Provides confidence scores

### 3. Synonym-Based Detection
- Matches against database of field synonyms
- Organization-specific and global synonyms
- Exact and partial matching
- Weighted confidence scoring

### 4. Pattern-Based Detection
- Regex patterns for common field names
- Data value analysis (date patterns, numeric patterns)
- Fallback method when others fail

### 5. Hybrid Approach
- Combines results from all methods
- Weighted confidence scoring
- Selects best match for each field

## Field Name Variations Supported

### Quantity
- quantity, qty, qnty
- units, cases, boxes
- pcs, pieces, cs
- count, volume

### Representative
- rep, representative
- sales rep, salesperson, sales person
- account manager, territory manager
- sold by, sales agent
- agent, manager

### Account
- account, customer, client
- acct name, cust name, customer name
- ship to, sold to, bill to
- buyer, purchaser

### Product
- product, item, sku
- part number, item number
- prod name, item desc
- description, material, part

### Revenue
- revenue, amount, total
- extended price, sale amount, net amount
- line total, ext price, line amt
- amt, value, cost

### Date
- date, order date, invoice date
- sale date, ship date, transaction date
- created, day

## Data Validation

All uploaded data goes through comprehensive validation:

### Required Fields
- Date (must be valid date format)
- Account (minimum 2 characters)
- Product (minimum 2 characters)
- Revenue (must be positive number)

### Optional Fields
- Quantity (validated if present)
- Representative (no validation)

### Validation Checks
- Date format validation
- Date range checks (warns if future or pre-1900)
- String length validation
- Numeric value validation
- Zero/negative value warnings
- Duplicate row detection

### Quality Scoring
- Overall quality score (0-100%)
- Per-field confidence scores
- Success rate tracking
- Error and warning summaries

## PDF Extraction Features

### Template-Based Extraction
- Distributor-specific parsing templates
- Custom field mappings per distributor
- Parsing instructions for unique formats
- Template auto-learning from successful uploads

### Pattern Recognition
- Date pattern extraction (multiple formats)
- Currency and numeric extraction
- Quantity unit detection
- Representative name extraction
- Account/customer identification

### Table Detection
- Automatic table structure detection
- Column header identification
- Multi-row data extraction
- Handles various table layouts

### Fallback Mechanisms
- Pattern-based extraction when AI unavailable
- Line-by-line content analysis
- Keyword-based field detection

## User Interface Enhancements

### Upload Interface
- Clear file format indicators with icons
- Shows supported formats: CSV, XLSX, PDF
- Lists extracted fields automatically
- Drag-and-drop support for all formats

### Progress Feedback
- Real-time processing status
- Extraction confidence scores
- Success rate display
- Record count updates

### Error Handling
- Detailed error messages
- Field-level validation feedback
- Suggested corrections
- Retry options

## Technical Implementation

### Libraries Added
- `jspdf` - PDF generation (for future export features)
- `jspdf-autotable` - Table generation in PDFs

### New Modules
- `/src/lib/dataValidation.ts` - Comprehensive data validation
- Enhanced `/src/lib/pdfParser.ts` - Advanced PDF extraction patterns
- Enhanced `/src/lib/columnDetection.ts` - Improved field detection
- Enhanced `/src/lib/openai.ts` - Better AI prompts

### Enhanced Existing Modules
- `/src/components/FileUpload.tsx` - Better UI feedback
- `/src/lib/dataProcessor.ts` - Already supports all formats
- `/src/lib/columnDetection.ts` - Multi-method detection

## Usage

1. **Select Distributor**: Choose from the dropdown (required)
2. **Upload File**: Drag and drop or click to browse
3. **Automatic Processing**:
   - File is parsed based on format
   - Fields are automatically detected
   - Data is validated
   - Records are saved to database
4. **Review Results**: Success message shows:
   - Number of records processed
   - Success rate percentage
   - Confidence score

## Best Practices

### For Best Results
1. Ensure file has clear column headers (CSV/XLSX)
2. Use consistent date formats
3. Include all required fields: date, account, product, revenue
4. Label quantity fields clearly (QTY, Units, Cases, etc.)
5. Include representative names when available

### PDF Tips
1. Use distributor templates when available
2. Ensure text is selectable (not scanned images)
3. Structured tables extract better than prose
4. Create templates for recurring formats

### Column Naming
- Use standard field names when possible
- Abbreviations are supported (QTY, Rep, Amt)
- System learns from successful uploads
- Consistent naming improves future uploads

## Confidence Scoring

### High Confidence (80-100%)
- All required fields detected
- Exact column name matches
- Clean data with no warnings
- Learned from previous uploads

### Medium Confidence (60-79%)
- Most required fields detected
- Partial column name matches
- Some data warnings
- Pattern-based detection

### Low Confidence (Below 60%)
- Missing required fields
- Ambiguous column mappings
- Multiple validation errors
- Manual review recommended

## Future Enhancements

Potential improvements for consideration:
- Export data to PDF/CSV/XLSX formats
- Manual column mapping interface
- Template creation wizard
- Batch file processing
- Data preview before import
- Field mapping suggestions
- Historical upload comparison
