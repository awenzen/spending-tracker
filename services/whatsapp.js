import twilio from 'twilio';
import { parseMessage, formatIDR } from './parser.js';
import { categorize, CATEGORIES } from './categorizer.js';
import { logSpending, deleteLastEntry, updateLastEntry, getLastEntry } from './sheets.js';
import { generateWeeklyReport } from './weekly-report.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_NUMBER;

export async function sendMessage(to, text) {
  try {
    await client.messages.create({
      from: FROM,
      to: `whatsapp:${to}`,
      body: text,
    });
  } catch (err) {
    console.error('Failed to send message:', err.message);
  }
}

export async function handleIncomingMessage(from, text) {
  const parsed = parseMessage(text);

  if (parsed.type === 'command') {
    return handleCommand(from, parsed);
  }

  if (parsed.type === 'invalid') {
    const reasons = {
      no_amount: 'Hmm, I couldn\'t find an amount. Try: "50k kopi" or "150rb bensin"',
      no_description: 'Missing description. Try: "50k kopi"',
      invalid_amount: 'Amount must be greater than zero.',
    };
    await sendMessage(from, reasons[parsed.reason] || 'Couldn\'t parse that. Try: "50k kopi"');
    return;
  }

  const { category, method } = await categorize(parsed.description);

  await logSpending({
    amount: parsed.amount,
    category,
    description: parsed.description,
    method,
    raw: parsed.raw,
  });

  const emoji = {
    Food: '🍜', Transport: '🚗', Groceries: '🛒', Entertainment: '🎬',
    Shopping: '🛍️', Bills: '💡', Health: '💊', Other: '📌',
  }[category];

  const reply = `✅ Logged ${formatIDR(parsed.amount)}\n${emoji} ${category} — ${parsed.description}${method === 'ai' ? '\n_(AI-categorized — reply with /fix CategoryName to correct)_' : ''}`;
  await sendMessage(from, reply);
}

async function handleCommand(from, { command, args }) {
  switch (command) {
    case 'help':
    case 'start':
      await sendMessage(from,
        `💰 *Spending Tracker*\n\n` +
        `Just send: amount description\n` +
        `Examples:\n` +
        `• 50k kopi\n` +
        `• 150rb bensin\n` +
        `• 2.5jt sewa kos\n\n` +
        `*Commands:*\n` +
        `/report — this week's report\n` +
        `/undo — delete last entry\n` +
        `/edit 60k — change last entry's amount\n` +
        `/fix Food — change last entry's category\n` +
        `/categories — list categories\n` +
        `/last — show last entry\n` +
        `/help — show this message`
      );
      break;

    case 'report':
      await sendMessage(from, '📊 Generating report...');
      const report = await generateWeeklyReport();
      await sendMessage(from, report);
      break;

    case 'undo':
    case 'delete': {
      const deleted = await deleteLastEntry();
      if (deleted) {
        await sendMessage(from,
          `🗑️ Deleted: ${formatIDR(deleted.amount)} — ${deleted.description} (${deleted.category})`
        );
      } else {
        await sendMessage(from, 'Nothing to undo.');
      }
      break;
    }

    case 'edit': {
      // /edit 60k — change amount of last entry
      if (!args.length) {
        await sendMessage(from, 'Usage: /edit 60k');
        break;
      }
      const newAmount = parseAmount(args[0]);
      if (!newAmount) {
        await sendMessage(from, `Couldn't parse amount: "${args[0]}". Try: /edit 60k`);
        break;
      }
      const updated = await updateLastEntry({ amount: newAmount });
      if (updated) {
        await sendMessage(from,
          `✏️ Updated: ${formatIDR(updated.amount)} — ${updated.description} (${updated.category})`
        );
      } else {
        await sendMessage(from, 'No entry to edit.');
      }
      break;
    }

    case 'fix': {
      // /fix Food — change category of last entry
      if (!args.length) {
        await sendMessage(from, `Usage: /fix CategoryName\nCategories: ${CATEGORIES.join(', ')}`);
        break;
      }
      const newCategory = args[0];
      const matched = CATEGORIES.find(c => c.toLowerCase() === newCategory.toLowerCase());
      if (!matched) {
        await sendMessage(from, `Unknown category: "${newCategory}"\nValid: ${CATEGORIES.join(', ')}`);
        break;
      }
      const fixed = await updateLastEntry({ category: matched });
      if (fixed) {
        await sendMessage(from,
          `✏️ Fixed: ${formatIDR(fixed.amount)} — ${fixed.description} → ${fixed.category}`
        );
      } else {
        await sendMessage(from, 'No entry to fix.');
      }
      break;
    }

    case 'last': {
      const last = await getLastEntry();
      if (last) {
        await sendMessage(from,
          `📝 Last entry: ${formatIDR(last.amount)} — ${last.description} (${last.category})`
        );
      } else {
        await sendMessage(from, 'No entries yet.');
      }
      break;
    }

    case 'categories':
      await sendMessage(from,
        `📁 *Categories:*\n` +
        `🍜 Food\n🚗 Transport\n🛒 Groceries\n🎬 Entertainment\n` +
        `🛍️ Shopping\n💡 Bills\n💊 Health\n📌 Other`
      );
      break;

    default:
      await sendMessage(from, `Unknown command: /${command}. Try /help`);
  }
}

// Parse amount from command args like "60k", "150rb"
function parseAmount(str) {
  const suffixes = { k: 1000, rb: 1000, ribu: 1000, jt: 1000000, juta: 1000000 };
  const match = str.match(/^(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta)?$/i);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  const suffix = (match[2] || '').toLowerCase();
  return Math.round(num * (suffixes[suffix] || 1));
}
