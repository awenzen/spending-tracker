import axios from 'axios';
import { getSpendingInRange } from './sheets.js';
import { formatIDR } from './parser.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_MODEL = 'gpt-4o-mini';

function getJakartaDate(offsetDays = 0) {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  jakarta.setUTCDate(jakarta.getUTCDate() + offsetDays);
  return jakarta.toISOString().slice(0, 10);
}

export async function generateWeeklyReport() {
  const thisWeekEnd = getJakartaDate(0);
  const thisWeekStart = getJakartaDate(-6);
  const lastWeekEnd = getJakartaDate(-7);
  const lastWeekStart = getJakartaDate(-13);

  const [thisWeek, lastWeek] = await Promise.all([
    getSpendingInRange(thisWeekStart, thisWeekEnd),
    getSpendingInRange(lastWeekStart, lastWeekEnd),
  ]);

  if (thisWeek.length === 0) {
    return `📊 *Weekly Report*\n${thisWeekStart} to ${thisWeekEnd}\n\nNo spending logged this week. Nice restraint! 💸`;
  }

  const totalThis = thisWeek.reduce((sum, r) => sum + r.amount, 0);
  const totalLast = lastWeek.reduce((sum, r) => sum + r.amount, 0);
  const deltaPct = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : null;

  const byCategory = {};
  for (const r of thisWeek) {
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  }

  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  ${cat}: ${formatIDR(amt)} (${Math.round((amt / totalThis) * 100)}%)`)
    .join('\n');

  const biggest = [...thisWeek]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((r, i) => `  ${i + 1}. ${formatIDR(r.amount)} — ${r.description} (${r.category})`)
    .join('\n');

  const insights = await generateInsights({ thisWeek, lastWeek, totalThis, totalLast, byCategory });

  const deltaLine = deltaPct !== null
    ? `   _${deltaPct >= 0 ? '📈 +' : '📉 '}${deltaPct}% vs last week (${formatIDR(totalLast)})_`
    : '';

  return [
    `📊 *Weekly Spending Report*`,
    `_${thisWeekStart} → ${thisWeekEnd}_`,
    ``,
    `💰 *Total:* ${formatIDR(totalThis)}`,
    deltaLine,
    `📝 ${thisWeek.length} transactions`,
    ``,
    `*By Category:*`,
    categoryRows,
    ``,
    `*Top 3 Biggest:*`,
    biggest,
    ``,
    `*Insights:*`,
    insights,
  ].filter(Boolean).join('\n');
}

async function generateInsights({ thisWeek, lastWeek, totalThis, totalLast, byCategory }) {
  try {
    const thisWeekSummary = Object.entries(byCategory)
      .map(([cat, amt]) => `${cat}: ${amt}`).join(', ');

    const lastByCategory = {};
    for (const r of lastWeek) {
      lastByCategory[r.category] = (lastByCategory[r.category] || 0) + r.amount;
    }
    const lastWeekSummary = Object.entries(lastByCategory)
      .map(([cat, amt]) => `${cat}: ${amt}`).join(', ');

    const response = await axios.post(
      'https://models.inference.ai.azure.com/chat/completions',
      {
        model: GITHUB_MODEL,
        messages: [{
          role: 'user',
          content: `You are reviewing weekly spending in IDR (Indonesian Rupiah).

This week (${thisWeek.length} transactions, total ${totalThis}): ${thisWeekSummary}
Last week (${lastWeek.length} transactions, total ${totalLast}): ${lastWeekSummary || 'no data'}

Give 2-3 brief, specific, actionable insights. Each = one short bullet, max 15 words. Be direct, not preachy. Start each line with "• ". No headers, no intro, just bullets.`,
        }],
        max_tokens: 200,
        temperature: 0.5,
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Failed to generate insights:', err.message);
    return '• (Insights unavailable)';
  }
}
