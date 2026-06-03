import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_MODEL = 'gpt-4o-mini';   

export const CATEGORIES = ['Food', 'Transport', 'Groceries', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Other'];

const KEYWORDS = {
  Food: [
    'kopi', 'coffee', 'starbucks', 'kopken', 'fore', 'janji jiwa', 'tuku',
    'makan', 'lunch', 'breakfast', 'dinner', 'sarapan', 'siang', 'malam',
    'nasi', 'mie', 'ayam', 'bakso', 'soto', 'sate', 'gado', 'padang',
    'pizza', 'burger', 'sushi', 'ramen', 'mcd', 'kfc', 'cfc',
    'restoran', 'restaurant', 'cafe', 'kafe', 'warung', 'kantin',
    'grabfood', 'gofood', 'shopeefood', 'foodpanda',
    'snack', 'cemilan', 'bubble tea', 'boba', 'es teh', 'teh', 'jus', 'juice',
  ],
  Transport: [
    'gojek', 'grab', 'gocar', 'grabcar', 'goride', 'grabbike',
    'uber', 'bluebird', 'taxi', 'taksi', 'ojek',
    'bensin', 'pertamax', 'pertalite', 'solar', 'fuel', 'gas',
    'parkir', 'parking', 'tol', 'toll', 'e-toll', 'etoll',
    'mrt', 'lrt', 'krl', 'transjakarta', 'busway', 'bus',
    'kereta', 'train', 'pesawat', 'flight', 'tiket pesawat',
    'service mobil', 'oli', 'ban', 'cuci mobil', 'bengkel',
  ],
  Groceries: [
    'belanja bulanan', 'indomaret', 'alfamart', 'alfamidi',
    'supermarket', 'hypermart', 'giant', 'carrefour', 'transmart',
    'ranch market', 'kemchicks', 'farmers market', 'lottemart',
    'sayur', 'buah', 'daging', 'ikan', 'telur', 'beras', 'minyak goreng',
    'detergen', 'sabun', 'shampoo', 'pasta gigi', 'tissue',
  ],
  Entertainment: [
    'bioskop', 'cinema', 'xxi', 'cgv', 'movie', 'film',
    'netflix', 'spotify', 'youtube premium', 'disney', 'hbo', '1x','bet',
    'game', 'steam', 'playstation', 'ps store', 'xbox', 'nintendo',
    'konser', 'concert', 'tiket', 'event',
    'tennis', 'gym', 'fitness', 'olahraga', 'futsal', 'badminton', 'golf',
    'karaoke', 'bar', 'club', 'beer', 'wine',
  ],
  Shopping: [
    'baju', 'celana', 'kemeja', 'kaos', 'jaket', 'sepatu', 'sandal',
    'uniqlo', 'zara', 'h&m', 'nike', 'adidas', 'puma', 'mall',
    'tokopedia', 'shopee', 'lazada', 'blibli', 'bukalapak', 'tiktok shop',
    'elektronik', 'electronics', 'gadget', 'hp', 'laptop', 'headphone', 'earphone',
    'parfum', 'kosmetik', 'skincare', 'makeup',
    'buku', 'book', 'gramedia',
  ],
  Bills: [
    'listrik', 'pln', 'air', 'pdam', 'gas', 'pgn',
    'internet', 'wifi', 'indihome', 'biznet', 'myrepublic', 'first media',
    'pulsa', 'paket data', 'telkomsel', 'xl', 'indosat', 'smartfren', 'tri',
    'iuran', 'maintenance', 'rt', 'rw', 'kebersihan',
    'asuransi', 'insurance', 'bpjs',
    'sewa', 'rent', 'kos', 'kontrakan',
    'kartu kredit', 'credit card', 'cicilan', 'kredit',
    'pajak', 'tax', 'stnk',
  ],
  Health: [
    'dokter', 'doctor', 'rumah sakit', 'rs ', 'klinik', 'clinic', 'hospital',
    'obat', 'medicine', 'apotek', 'pharmacy', 'guardian', 'watsons', 'kimia farma',
    'vitamin', 'suplemen', 'supplement',
    'dentist', 'gigi', 'dental',
    'lab', 'tes darah', 'mcu', 'medical checkup',
    'pijat', 'massage', 'spa',
  ],
};

function matchByKeywords(description) {
  const desc = description.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (desc.includes(kw)) return category;
    }
  }
  return null;
}

async function categorizeWithAI(description) {
  try {
    const response = await axios.post(
      'https://models.inference.ai.azure.com/chat/completions',
      {
        model: GITHUB_MODEL,
        messages: [{
          role: 'user',
          content: `Classify this spending into exactly ONE category from: ${CATEGORIES.join(', ')}.
Spending: "${description}"
Reply with ONLY the category name. Nothing else.`,
        }],
        max_tokens: 20,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content.trim().replace(/[.,!?]/g, '');
    const matched = CATEGORIES.find(c => c.toLowerCase() === text.toLowerCase());
    return matched || 'Other';
  } catch (err) {
    console.error('AI categorization failed:', err.message);
    return 'Other';
  }
}

export async function categorize(description) {
  const keywordMatch = matchByKeywords(description);
  if (keywordMatch) return { category: keywordMatch, method: 'keyword' };

  const aiCategory = await categorizeWithAI(description);
  return { category: aiCategory, method: 'ai' };
}
