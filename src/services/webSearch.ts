import dotenv from 'dotenv';
dotenv.config();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

/**
 * Searches for a food recipe/nutrition description using Tavily Search API.
 * Returns up to 3 text snippets from top results.
 */
export async function searchFoodRecipe(foodName: string): Promise<string[]> {
  if (!TAVILY_API_KEY) {
    console.warn('[webSearch] TAVILY_API_KEY not set, skipping web search');
    return [];
  }

  const query = `${foodName} traditional Indian recipe ingredients nutrition facts macros`;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('[webSearch] Tavily error:', response.status);
      return [];
    }

    const data = await response.json() as {
      answer?: string;
      results?: Array<{ content?: string; snippet?: string }>;
    };

    const snippets: string[] = [];

    // Prefer the AI-synthesised answer first
    if (data.answer && data.answer.length > 20) {
      snippets.push(data.answer);
    }

    // Then add result snippets
    for (const r of data.results || []) {
      const text = r.content || r.snippet || '';
      if (text.length > 30 && snippets.length < 3) {
        snippets.push(text.slice(0, 800)); // cap per snippet
      }
    }

    console.log(`[webSearch] Got ${snippets.length} snippets for "${foodName}"`);
    return snippets;
  } catch (error) {
    console.error('[webSearch] Search failed:', error);
    return [];
  }
}

/**
 * Searches for a packaged brand product's nutrition info.
 * Uses a more targeted query for packaged goods.
 */
export async function searchBrandedProductInfo(productName: string): Promise<string[]> {
  if (!TAVILY_API_KEY) return [];

  const query = `${productName} nutrition facts calories protein carbs fat per 100g India`;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      answer?: string;
      results?: Array<{ content?: string; snippet?: string }>;
    };

    const snippets: string[] = [];
    if (data.answer && data.answer.length > 20) snippets.push(data.answer);
    for (const r of data.results || []) {
      const text = r.content || r.snippet || '';
      if (text.length > 30 && snippets.length < 3) snippets.push(text.slice(0, 800));
    }

    return snippets;
  } catch {
    return [];
  }
}
