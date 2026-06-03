import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

let docCache = null;
const sheetsConfigured = () =>
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.GOOGLE_SHEET_ID;

async function getDoc() {
  if (docCache) return docCache;
  if (!sheetsConfigured()) throw new Error('Google Sheets not configured');
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

async function ensureHeaderRow(sheet) {
  await sheet.loadHeaderRow().catch(async () => {
    await sheet.setHeaderRow(['Timestamp','Date','Amount','Category','Description','Method','Raw']);
  });
}

export async function logSpending({ amount, category, description, method, raw }) {
  if (!sheetsConfigured()) {
    console.log(`[NO SHEETS] ${amount} | ${category} | ${description}`);
    return;
  }
  const doc = await getDoc();
  const sheet = doc.sheetsByIndex[0];
  await ensureHeaderRow(sheet);
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  await sheet.addRow({
    Timestamp: jakarta.toISOString().replace('T',' ').slice(0,19),
    Date: jakarta.toISOString().slice(0,10),
    Amount: amount, Category: category,
    Description: description, Method: method, Raw: raw,
  });
}

export async function getSpendingInRange(startDate, endDate) {
  if (!sheetsConfigured()) return [];
  const doc = await getDoc();
  const sheet = doc.sheetsByIndex[0];
  await ensureHeaderRow(sheet);
  const rows = await sheet.getRows();
  return rows
    .map(row => ({
      date: row.get('Date'),
      amount: parseFloat(row.get('Amount')) || 0,
      category: row.get('Category'),
      description: row.get('Description'),
    }))
    .filter(r => r.date >= startDate && r.date <= endDate && r.amount > 0);
}
