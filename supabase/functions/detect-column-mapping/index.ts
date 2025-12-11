import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ColumnMappingRequest {
  columns: string[];
  sampleData: any[];
  synonymsByField?: Record<string, string[]>;
  aiTrainingConfig?: {
    field_mappings?: Record<string, any>;
    parsing_instructions?: string;
    orientation?: string;
  };
}

interface ColumnMappingResponse {
  mapping: Record<string, string | null>;
  confidence: number;
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

    const { columns, sampleData, synonymsByField, aiTrainingConfig }: ColumnMappingRequest = await req.json();

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: columns array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: sampleData array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build synonyms examples
    const synonymExamples = synonymsByField
      ? Object.entries(synonymsByField)
          .map(([field, syns]) => `  ${field}: ${syns.slice(0, 10).join(', ')}`)
          .join('\n')
      : "No synonyms provided";

    let prompt = `You are an expert at analyzing sales data files and identifying column mappings.

Available columns in this file:
${columns.join(', ')}

Sample data (first 5 rows):
${JSON.stringify(sampleData, null, 2)}

Common synonyms for each field type:
${synonymExamples}

IMPORTANT: For depletion reports, only "account" and "product" are REQUIRED fields.
"date" and "revenue" are OPTIONAL - many depletion reports only track product movement (quantity) without financial data.

Your task: Identify which columns correspond to each field type. Consider:
1. Exact matches with synonyms (e.g., "Cases" = quantity, "Units" = quantity)
2. Partial matches (e.g., "Total Amount" contains "amount")
3. The actual data values in the sample rows
4. Context clues from other columns
5. If date or revenue columns are not clearly present, it's acceptable to leave them null`;

    if (aiTrainingConfig?.parsing_instructions) {
      prompt += `\n\nIMPORTANT - DISTRIBUTOR-SPECIFIC AI TRAINING INSTRUCTIONS:
${aiTrainingConfig.parsing_instructions}

Please apply these instructions when mapping columns. These instructions describe the specific format and conventions used by this distributor.`;
    }

    if (aiTrainingConfig?.field_mappings && Object.keys(aiTrainingConfig.field_mappings).length > 0) {
      prompt += `\n\nFIELD MAPPING HINTS FROM AI TRAINING:
${JSON.stringify(aiTrainingConfig.field_mappings, null, 2)}

Use these learned patterns to help identify column mappings.`;
    }

    prompt += `

Return a JSON object with this structure:
{
  "mapping": {
    "date": "column_name_or_null",
    "revenue": "column_name_or_null",
    "account": "column_name_or_null",
    "product": "column_name_or_null",
    "quantity": "column_name_or_null",
    "order_id": "column_name_or_null",
    "category": "column_name_or_null",
    "region": "column_name_or_null",
    "representative": "column_name_or_null"
  },
  "confidence": confidence
}

Rules:
- Only include fields you can confidently identify
- Set confidence between 0.0 and 1.0 based on how certain you are
- For quantity: "Cases", "Units", "Qty", "Boxes", "·" (bullet) all mean quantity
- For revenue: "Amount", "Total", "Sales", "Extended Price" all mean revenue
- Return ONLY the JSON object, no explanation`;

    console.log("Calling OpenAI for column mapping detection...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a precise data mapping assistant. Return only valid JSON with no additional text.",
          },
          { role: "user", content: prompt },
        ],
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

    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    // Validate result structure
    if (!parsed.mapping || typeof parsed.mapping !== 'object') {
      console.error("Invalid response structure:", parsed);
      throw new Error("Invalid response structure from OpenAI");
    }

    const result: ColumnMappingResponse = {
      mapping: parsed.mapping || {},
      confidence: parsed.confidence || 0.8,
    };

    console.log(`✅ Column mapping detected with ${(result.confidence * 100).toFixed(0)}% confidence`);
    console.log(`   Mapped fields:`, Object.keys(result.mapping).filter(k => result.mapping[k]));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in detect-column-mapping function:", error);
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
