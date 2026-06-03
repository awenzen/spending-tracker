import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

let docCache = null;
let credentials = null;

function getCredentials() {
  if (credentials) return credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return credentials;
  } catch { return null; }
}

const sheetsConfigured = () => process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHEET_ID;

async function getDoc() {
  if (docCache) return docCache;
  if (!sheetsConfigured()) throw new Error('Google Sheets not configured');
  const creds = getCredentials();
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
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
  if (!sheetsConfigured()) { console.log('[NO SHEETS]', amount, '|', category, '|', description); return; }
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

export async function getLastEntry() {
  if (!sheetsConfigured()) return null;
  const doc = await getDoc();
  const sheet = doc.sheetsByIndex[0];
  await ensureHeaderRow(sheet);
  const rows = await sheet.getRows();
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return {
    row: last,
    amount: parseFloat(last.get('Amount')) || 0,
    category: last.get('Category'),
    description: last.get('Description'),
  };
}

export async function deleteLastEntry() {
  const entry = await getLastEntry();
  if (!entry) return null;
  await entry.row.delete();
  return entry;
}

export async function updateLastEntry({ amount, category }) {
  const entry = await getLastEntry();
  if (!entry) return null;
  if (amount !== undefined) entry.row.set('Amount', amount);
  if (category !== undefined) entry.row.set('Category', category);
  await entry.row.save();
  return {
    amount: parseFloat(entry.row.get('Amount')) || 0,
    category: entry.row.get('Category'),
    description: entry.row.get('Description'),
  };
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
