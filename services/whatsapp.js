import twilio from 'twilio';
import { parseMessage, formatIDR } from './parser.js';
import { categorize } from './categorizer.js';
import { logSpending } from './sheets.js';
import { generateWeeklyReport } from './weekly-report.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886

/**
 * Send a WhatsApp message via Twilio
 */
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

/**
 * Main handler: parses, categorizes, logs, replies.
 */
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

async function handleCommand(from, { command }) {
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
        `/report — get this week's report\n` +
        `/categories — list categories\n` +
        `/help — show this message`
      );
      break;

    case 'report':
      await sendMessage(from, '📊 Generating report...');
      const report = await generateWeeklyReport();
      await sendMessage(from, report);
      break;

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
