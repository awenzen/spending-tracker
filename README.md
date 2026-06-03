# WhatsApp Spending Tracker (Twilio)

Personal WhatsApp bot that logs your spending to Google Sheets, categorizes automatically (keywords + Claude AI fallback), and sends a weekly report every Sunday morning.

You text:
```
50k kopi
```

Bot replies:
```
✅ Logged Rp 50.000
🍜 Food — kopi
```

…row lands in your Google Sheet. Every Sunday 9 AM Jakarta you get a full report with breakdown, biggest purchases, and AI insights.

## Stack

- Node.js + Express
- **Twilio WhatsApp** (sandbox is instant, no Meta approval BS)
- Claude Haiku 4.5 (category fallback + weekly insights)
- Google Sheets API (storage)
- node-cron (weekly scheduler)
- Railway (recommended hosting)

---

## Setup

### 1. Google Sheets

1. Create a new Google Sheet. Copy the ID from the URL (long string between `/d/` and `/edit`).
2. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project, enable **Google Sheets API**.
3. Create a **Service Account** (IAM & Admin → Service Accounts → Create). Skip the optional steps.
4. On the service account → **Keys → Add Key → Create new key → JSON**. Download.
5. Open the JSON file. Copy `client_email` and `private_key`.
6. **Share your Google Sheet with the service account email as Editor** (step everyone forgets).

If you used the template I gave you, also delete the sample rows in the Transactions tab before going live.

### 2. Twilio WhatsApp Sandbox

1. Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio) — just email and password, no SMS verification needed.
2. After login, go to **Messaging → Try it out → Send a WhatsApp message** in the left sidebar.
3. You'll see a sandbox number (`+1 415 523 8886`) and a join code like `join purple-elephant`.
4. From your phone, WhatsApp `+14155238886` and send exactly that join code (e.g. `join purple-elephant`). You'll get a confirmation.
5. From [console.twilio.com](https://console.twilio.com) → Account Dashboard, copy:
   - **Account SID** → your `TWILIO_ACCOUNT_SID`
   - **Auth Token** (click to reveal) → your `TWILIO_AUTH_TOKEN`

### 3. Anthropic API

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/).
2. Add $5 credit. Covers years of personal use at this volume.

### 4. Configure

```bash
cp .env.example .env
```

Fill in `.env`. For `ALLOWED_NUMBERS` and `WEEKLY_REPORT_RECIPIENTS`, use international format without `+` (Indonesia: `62` prefix, no leading 0 — so `08123...` → `628123...`).

For `GOOGLE_PRIVATE_KEY`, paste exactly as it appears in the JSON, with the `\n` literals.

### 5. Run locally

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`.

### 6. Connect Twilio webhook

Twilio needs to reach your server. For local testing, use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Copy the https URL (e.g. `https://abc123.ngrok.io`). In Twilio Console:

1. **Messaging → Try it out → Send a WhatsApp message → Sandbox settings** (tab at the top)
2. **When a message comes in:** `https://abc123.ngrok.io/webhook`
3. **Method:** `POST`
4. Save

### 7. Test

WhatsApp the sandbox number from your phone:
```
/help
```

You should get the help message. Then:
```
50k kopi
```

You should get the logged confirmation, and the row should appear in your Google Sheet.

---

## Deploy to Railway

1. Push this repo to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub → pick your repo
3. Settings → Variables → paste every line from your `.env`
4. Wait for deploy. Railway gives you a public URL like `https://xxx.up.railway.app`
5. Back to Twilio Sandbox settings → update webhook URL to `https://xxx.up.railway.app/webhook`

Railway free tier (~$5/month credit) handles this easily.

---

## Usage

### Logging spending

| Input              | Parsed as                    |
|--------------------|------------------------------|
| `50k kopi`         | Rp 50.000 — kopi             |
| `50rb kopi`        | Rp 50.000 — kopi             |
| `50000 kopi`       | Rp 50.000 — kopi             |
| `Rp 50.000 kopi`   | Rp 50.000 — kopi             |
| `2.5jt sewa kos`   | Rp 2.500.000 — sewa kos      |
| `1.250.000 service`| Rp 1.250.000 — service       |

### Commands
- `/help` — usage
- `/report` — this week's report on demand
- `/categories` — list categories

### Categories
Food, Transport, Groceries, Entertainment, Shopping, Bills, Health, Other.

Keyword matching first (free, instant), Claude fallback for unknowns. Reply messages note when AI was used.

Edit `services/categorizer.js` to add keywords or change categories.

---

## Sandbox limitations to know

The Twilio sandbox is free but has rules:
- **You must "join" each time the session expires** (every 72 hours of inactivity). Just send `join <code>` again from WhatsApp.
- **Only verified numbers can message the bot** — anyone you want to use it must send the join code first.
- **24-hour outbound window**: Twilio can only send you messages if you've messaged the bot within the last 24 hours. Since you'll log spending most days, this isn't a problem. If you skip a few days, send any message first before triggering `/report`.

For production with no limits, you'd upgrade to a paid Twilio WhatsApp Business profile (~$15/mo). For personal use the sandbox is genuinely fine.

---

## Costs

- Twilio sandbox: free
- Claude Haiku: ~$0.01/month (keywords catch most)
- Google Sheets: free
- Railway: free tier covers it

Total: essentially $0.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook not receiving messages | Check Twilio sandbox webhook URL is set + method is POST |
| Bot doesn't reply | Look at Railway/server logs for errors |
| Google Sheets "permission denied" | Share sheet with service account email as Editor |
| "Channel not found" Twilio error | You forgot to send the `join <code>` from your phone |
| Categories wrong | Add the term to `KEYWORDS` in `services/categorizer.js` |
| Numbers don't parse right | Test in `services/parser.js` — already handles k/rb/jt and Rp 50.000 |

---

## File structure

```
whatsapp-tracker/
├── server.js                    # Express app + Twilio webhook
├── package.json
├── .env.example
├── README.md
└── services/
    ├── whatsapp.js              # Twilio send/receive
    ├── parser.js                # Parse spending input
    ├── categorizer.js           # Hybrid keyword + AI categorization
    ├── sheets.js                # Google Sheets read/write
    ├── weekly-report.js         # Build weekly report
    └── scheduler.js             # Cron job for weekly notifications
```
