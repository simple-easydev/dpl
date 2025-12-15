import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HeaderDetectionRequest {
  rows: Array<{ rowIndex: number; values: any[] }>;
}

interface HeaderDetectionResponse {
  headerRowIndex: number;
  columnNames: string[];
  columnIndices: number[]; // Original position/index of each column in the row
  confidence: number;
  reasoning: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured in Supabase secrets");
    }

    const { rows }: HeaderDetectionRequest = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: rows array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Analyze this spreadsheet data and identify the header row.

Spreadsheet rows (first 15):
${JSON.stringify(rows, null, 2)}

Task:
1. Identify which row contains the column headers (not data, not metadata, not section titles)
2. Extract the exact column names from that row (skip empty/null values)
3. Track the original index/position of each extracted column in the row
4. Provide confidence level (0-100)

Common patterns:
- Headers often come after metadata rows (titles, dates, "By:", "Sort:", etc.)
- Headers contain field names like: Type, Date, Name, Customer, Product, Quantity, Amount, etc.
- Headers are usually short text (not long descriptive sentences)
- Data rows contain actual values (dates in MM/DD/YYYY format, decimal numbers, customer names)
- Avoid rows with "Total", "Subtotal", "Inventory" unless they're clearly column headers
- Some columns may be empty/null - skip them but track the positions of non-empty columns

Example: If row values are ["Customer_Name", null, "Product_Name", "", "Quantity"]
Then: columnNames should be ["Customer_Name", "Product_Name", "Quantity"]
And: columnIndices should be [0, 2, 4]

Return ONLY valid JSON (no markdown, no explanation):
{
  "headerRowIndex": <number>,
  "columnNames": [<array of exact column name strings from that row, excluding empty values>],
  "columnIndices": [<array of original position indices for each column name>],
  "confidence": <number 0-100>,
  "reasoning": "<brief 1-sentence explanation>"
}`;

    console.log("Calling OpenAI for header detection...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result: HeaderDetectionResponse = JSON.parse(content);

    // Validate result structure
    if (
      typeof result.headerRowIndex !== "number" ||
      !Array.isArray(result.columnNames) ||
      !Array.isArray(result.columnIndices) ||
      typeof result.confidence !== "number"
    ) {
      console.error("Invalid response structure:", result);
      throw new Error("Invalid response structure from OpenAI");
    }

    // Validate columnNames and columnIndices have same length
    if (result.columnNames.length !== result.columnIndices.length) {
      console.error("Mismatched array lengths:", result);
      throw new Error("columnNames and columnIndices must have same length");
    }

    console.log(`✅ Header detected at row ${result.headerRowIndex} with ${result.confidence}% confidence`);
    console.log(`📋 Found ${result.columnNames.length} columns at positions:`, result.columnIndices);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in detect-header-row function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
