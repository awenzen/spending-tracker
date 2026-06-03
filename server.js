import 'dotenv/config';
import express from 'express';
import { handleIncomingMessage } from './services/whatsapp.js';
import { startWeeklyScheduler } from './services/scheduler.js';

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded, not JSON
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('WhatsApp Spending Tracker is running ✅');
});

// Twilio webhook — receives incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  // Respond 200 immediately so Twilio doesn't retry
  res.type("text/xml").send("<Response></Response>");

  try {
    const text = req.body.Body;
    const from = req.body.From?.replace('whatsapp:', '').replace('+', ''); // strip "whatsapp:" prefix

    if (!text || !from) return;

    // Optional: only allow your own number
    const allowedNumbers = (process.env.ALLOWED_NUMBERS || '').split(',').map(n => n.trim());
    if (allowedNumbers.length && allowedNumbers[0] && !allowedNumbers.includes(from)) {
      console.log(`Ignored message from unauthorized number: ${from}`);
      return;
    }

    console.log(`[${new Date().toISOString()}] From ${from}: ${text}`);
    await handleIncomingMessage(from, text);
  } catch (err) {
    console.error('Webhook handler error:', err);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startWeeklyScheduler();
});
