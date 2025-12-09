import { supabase } from './supabase';
import { getOrganizationOpenAI } from './openai';

export type PremiseType = 'on_premise' | 'off_premise' | 'unclassified' | 'online';

export interface PremiseClassificationResult {
  premise_type: PremiseType;
  confidence: number;
  reasoning?: string;
}

export interface AccountToClassify {
  id: string;
  account_name: string;
}

const CONFIDENCE_THRESHOLD = 0.7;

const ON_PREMISE_INDICATORS = [
  'bar', 'restaurant', 'nightclub', 'tavern', 'brewery', 'pub', 'lounge',
  'club', 'hotel', 'casino', 'bistro', 'cafe', 'grill', 'steakhouse',
  'diner', 'eatery', 'pizzeria', 'cantina', 'taproom', 'gastropub'
];

const OFF_PREMISE_INDICATORS = [
  'liquor', 'wine shop', 'retail', 'store', 'market', 'grocery', 'supermarket',
  'convenience', 'package', 'spirits', 'bottle shop', 'beverage', 'distribut'
];

const ONLINE_INDICATORS = [
  'online', 'e-commerce', 'ecommerce', 'web', 'website', 'digital', 'internet',
  'direct', 'dtc', 'direct-to-consumer', '.com', 'shop', 'mashbill'
];

export async function classifyAccountPremiseType(
  accountName: string,
  organizationId?: string
): Promise<PremiseClassificationResult> {
  const aiClient = organizationId ? await getOrganizationOpenAI(organizationId) : null;

  if (!aiClient) {
    return fallbackClassification(accountName);
  }

  try {
    const prompt = `Classify this business account as "on_premise", "off_premise", or "online" based on its name.

Account Name: "${accountName}"

DEFINITIONS:

ON-PREMISE: Establishments where alcohol is consumed on the premises
- Bars, taverns, pubs, lounges
- Restaurants, bistros, cafes, diners, steakhouses, pizzerias
- Nightclubs, dance clubs, music venues
- Breweries with taprooms, brewpubs, gastropubs
- Hotels, casinos, resorts (with bars/restaurants)
- Sports bars, wine bars, cocktail bars
- Country clubs, golf clubs

OFF-PREMISE: Physical retail establishments where alcohol is purchased for consumption elsewhere
- Liquor stores, package stores, bottle shops
- Wine shops, wine stores
- Grocery stores, supermarkets
- Convenience stores, gas stations with retail
- Specialty beverage retailers
- Big box stores with liquor sections

ONLINE: E-commerce and direct-to-consumer web-based sales
- Online wine shops, e-commerce platforms
- Direct-to-consumer web sales
- Brand websites with shopping capabilities
- Digital marketplaces
- Names containing "online", ".com", "web", "mashbill", or similar indicators

Return a JSON object with:
{
  "premise_type": "on_premise", "off_premise", or "online",
  "confidence": 0.0 to 1.0 (how confident you are),
  "reasoning": "brief explanation"
}

IMPORTANT:
- Be very confident in your classification (confidence should be high)
- If unsure or the name is ambiguous, set confidence below 0.7
- Consider common business naming patterns
- Look for keywords like "bar", "grill", "restaurant" (on-premise), "liquor", "store", "market" (off-premise), or "online", "web", ".com" (online)`

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a business classification expert specializing in alcoholic beverage retail channels. Return only valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));

    if (confidence < CONFIDENCE_THRESHOLD) {
      return {
        premise_type: 'unclassified',
        confidence,
        reasoning: result.reasoning || 'Low confidence classification'
      };
    }

    return {
      premise_type: result.premise_type === 'on_premise' ? 'on_premise' :
                    result.premise_type === 'off_premise' ? 'off_premise' :
                    result.premise_type === 'online' ? 'online' : 'unclassified',
      confidence,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('Error classifying account with AI:', error);
    return fallbackClassification(accountName);
  }
}

function fallbackClassification(accountName: string): PremiseClassificationResult {
  const nameLower = accountName.toLowerCase();

  let onPremiseScore = 0;
  let offPremiseScore = 0;
  let onlineScore = 0;

  for (const indicator of ON_PREMISE_INDICATORS) {
    if (nameLower.includes(indicator)) {
      onPremiseScore += 1;
    }
  }

  for (const indicator of OFF_PREMISE_INDICATORS) {
    if (nameLower.includes(indicator)) {
      offPremiseScore += 1;
    }
  }

  for (const indicator of ONLINE_INDICATORS) {
    if (nameLower.includes(indicator)) {
      onlineScore += 2;
    }
  }

  if (onlineScore > onPremiseScore && onlineScore > offPremiseScore && onlineScore > 0) {
    return {
      premise_type: 'online',
      confidence: Math.min(0.85, 0.6 + (onlineScore * 0.1)),
      reasoning: 'Pattern-based classification (fallback) - online indicators detected'
    };
  } else if (onPremiseScore > offPremiseScore && onPremiseScore > 0) {
    return {
      premise_type: 'on_premise',
      confidence: Math.min(0.8, 0.5 + (onPremiseScore * 0.15)),
      reasoning: 'Pattern-based classification (fallback)'
    };
  } else if (offPremiseScore > onPremiseScore && offPremiseScore > 0) {
    return {
      premise_type: 'off_premise',
      confidence: Math.min(0.8, 0.5 + (offPremiseScore * 0.15)),
      reasoning: 'Pattern-based classification (fallback)'
    };
  }

  return {
    premise_type: 'unclassified',
    confidence: 0,
    reasoning: 'Unable to determine from name patterns'
  };
}

export async function batchClassifyAccounts(
  accounts: AccountToClassify[],
  organizationId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const batchSize = 10;

  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, Math.min(i + batchSize, accounts.length));

    await Promise.all(
      batch.map(async (account) => {
        try {
          const result = await classifyAccountPremiseType(account.account_name, organizationId);

          const { error } = await supabase
            .from('accounts')
            .update({
              premise_type: result.premise_type,
              premise_type_confidence: result.confidence,
              premise_type_updated_at: new Date().toISOString(),
              premise_type_manual_override: false
            })
            .eq('id', account.id);

          if (error) {
            console.error(`Error updating account ${account.id}:`, error);
            failed++;
          } else {
            success++;
          }
        } catch (err) {
          console.error(`Error classifying account ${account.id}:`, err);
          failed++;
        }
      })
    );

    if (onProgress) {
      onProgress(Math.min(i + batchSize, accounts.length), accounts.length);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { success, failed };
}

export async function classifyUnclassifiedAccounts(
  organizationId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, account_name')
    .eq('organization_id', organizationId)
    .eq('premise_type', 'unclassified')
    .eq('premise_type_manual_override', false);

  if (error || !accounts) {
    console.error('Error fetching unclassified accounts:', error);
    return { success: 0, failed: 0 };
  }

  if (accounts.length === 0) {
    return { success: 0, failed: 0 };
  }

  return batchClassifyAccounts(accounts, organizationId, onProgress);
}

export async function reclassifyAllAccounts(
  organizationId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, account_name')
    .eq('organization_id', organizationId)
    .eq('premise_type_manual_override', false);

  if (error || !accounts) {
    console.error('Error fetching accounts for reclassification:', error);
    return { success: 0, failed: 0 };
  }

  if (accounts.length === 0) {
    return { success: 0, failed: 0 };
  }

  return batchClassifyAccounts(accounts, organizationId, onProgress);
}

export async function updateAccountPremiseType(
  accountId: string,
  premiseType: PremiseType,
  manualOverride: boolean = true
): Promise<boolean> {
  const { error } = await supabase
    .from('accounts')
    .update({
      premise_type: premiseType,
      premise_type_manual_override: manualOverride,
      premise_type_updated_at: new Date().toISOString(),
      premise_type_confidence: manualOverride ? 1.0 : 0
    })
    .eq('id', accountId);

  if (error) {
    console.error('Error updating account premise type:', error);
    return false;
  }

  return true;
}

export async function getPremiseTypeStats(organizationId: string): Promise<{
  total: number;
  on_premise: number;
  off_premise: number;
  unclassified: number;
}> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('premise_type')
    .eq('organization_id', organizationId);

  if (error || !accounts) {
    return { total: 0, on_premise: 0, off_premise: 0, unclassified: 0 };
  }

  const stats = {
    total: accounts.length,
    on_premise: 0,
    off_premise: 0,
    unclassified: 0
  };

  accounts.forEach(account => {
    if (account.premise_type === 'on_premise') {
      stats.on_premise++;
    } else if (account.premise_type === 'off_premise') {
      stats.off_premise++;
    } else {
      stats.unclassified++;
    }
  });

  return stats;
}
