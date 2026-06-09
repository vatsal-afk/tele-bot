import { searchBrandedProductInfo } from './webSearch.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

export interface BrandMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  per: string; // e.g. "100g" or "per serving (150g)"
  source: 'brand_openfoodfacts' | 'brand_llm_estimate';
}

/**
 * Stage 1: Query Open Food Facts API.
 * Has 10,000+ Indian products including Epigamia, Amul, MTR, Britannia, etc.
 * No API key required.
 */
export async function lookupOpenFoodFacts(productName: string): Promise<BrandMacros | null> {
  try {
    const query = encodeURIComponent(productName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&fields=product_name,nutriments,serving_size,countries_tags&page_size=5`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'IITR-Hostel-NutritionBot/1.0 (github.com/vatsal-afk/tele-bot)' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn('[brandLookup] Open Food Facts returned', res.status);
      return null;
    }

    const data = await res.json() as {
      count: number;
      products: Array<{
        product_name?: string;
        countries_tags?: string[];
        nutriments?: {
          'energy-kcal_100g'?: number;
          'proteins_100g'?: number;
          'carbohydrates_100g'?: number;
          'fat_100g'?: number;
          'energy-kcal_serving'?: number;
          'proteins_serving'?: number;
          'carbohydrates_serving'?: number;
          'fat_serving'?: number;
        };
        serving_size?: string;
      }>;
    };

    if (!data.products || data.products.length === 0) return null;

    // Prefer Indian products; fall back to first result
    const nameLower = productName.toLowerCase();
    let best = data.products.find(p => {
      const tags = p.countries_tags || [];
      return tags.some(t => t.includes('india'));
    }) || data.products[0];

    // Also prefer products whose name is closer to the query
    const betterMatch = data.products.find(p =>
      p.product_name?.toLowerCase().includes(nameLower) ||
      nameLower.includes((p.product_name || '').toLowerCase())
    );
    if (betterMatch) best = betterMatch;

    const n = best.nutriments;
    if (!n) return null;

    const cal = n['energy-kcal_100g'];
    const prot = n['proteins_100g'];
    const carbs = n['carbohydrates_100g'];
    const fat = n['fat_100g'];

    if (!cal && !prot) return null; // no usable data

    console.log(`[brandLookup] OFF found: ${best.product_name} — ${cal} kcal, ${prot}g protein per 100g`);

    return {
      calories: Math.round(cal || 0),
      protein: Math.round((prot || 0) * 10) / 10,
      carbs: Math.round((carbs || 0) * 10) / 10,
      fats: Math.round((fat || 0) * 10) / 10,
      per: '100g',
      source: 'brand_openfoodfacts',
    };
  } catch (err) {
    console.error('[brandLookup] OFF error:', err);
    return null;
  }
}

/**
 * Stage 2: Tavily search + Groq extraction fallback.
 * Used when Open Food Facts has no match.
 */
export async function estimateBrandMacrosFromWeb(productName: string): Promise<BrandMacros | null> {
  const snippets = await searchBrandedProductInfo(productName);
  if (snippets.length === 0) return null;

  const prompt = `Extract macros per 100g (or per serving) for "${productName}" from these snippets:

${snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

Reply ONLY with valid JSON:
{ "calories": number, "protein": number, "carbs": number, "fats": number, "per": "100g|per serving", "confidence": 0.0-1.0 }
If you cannot determine macros with reasonable confidence, return { "confidence": 0 }.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.calories || (parsed.confidence ?? 0) < 0.3) return null;

    console.log(`[brandLookup] LLM estimated for "${productName}": ${parsed.calories} kcal`);
    return {
      calories: Math.round(parsed.calories),
      protein: Math.round((parsed.protein || 0) * 10) / 10,
      carbs: Math.round((parsed.carbs || 0) * 10) / 10,
      fats: Math.round((parsed.fats || 0) * 10) / 10,
      per: parsed.per || '100g',
      source: 'brand_llm_estimate',
    };
  } catch {
    return null;
  }
}

/**
 * Heuristic: is this likely a branded/packaged product rather than a home-cooked dish?
 * True if the name sounds like a brand (proper noun, known brand keyword, or "yogurt/biscuit/protein" pattern).
 */
export function isLikelyBrandedProduct(foodName: string): boolean {
  const lower = foodName.toLowerCase().trim();

  // Known branded product keywords
  const brandKeywords = [
    'epigamia', 'amul', 'britannia', 'parle', 'nestlé', 'nestle', 'maggi',
    'horlicks', 'bournvita', 'boost', 'complan', 'ensure', 'protinex',
    'mtr', 'gits', 'haldirams', 'haldiram', 'bikano', 'lays', 'kurkure',
    'hide & seek', 'good day', 'marie', 'sunfeast', 'mcvities',
    'nature valley', 'kind bar', 'clif', 'myprotein', 'muscleblaze',
    'yoga bar', 'yogabar', 'the whole truth', 'ritebite', 'max protein',
    'true elements', 'farmley', 'act ii', 'bingo', 'uncle chipps',
  ];
  if (brandKeywords.some(k => lower.includes(k))) return true;

  // Packaged product type words
  const packagedTypes = [
    'greek yogurt', 'yoghurt', 'protein bar', 'energy bar', 'granola',
    'oats packet', 'instant oats', 'flavoured milk', 'tetrapack',
    'whey protein', 'peanut butter', 'almond butter', 'muesli',
    'cornflakes packet', 'chocos', 'kelloggs', 'kellogs',
  ];
  if (packagedTypes.some(k => lower.includes(k))) return true;

  // Multi-word with capital-ish patterns (e.g., "Epigamia Greek Yogurt")
  const words = foodName.trim().split(/\s+/);
  const hasMultipleCapitals = words.filter(w => w.length > 2 && w[0] === w[0].toUpperCase()).length >= 2;
  if (hasMultipleCapitals && words.length >= 2) return true;

  return false;
}
