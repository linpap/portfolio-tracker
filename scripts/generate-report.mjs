import { readFileSync, writeFileSync } from 'fs';

// Portfolio v4 holdings (buy price + qty must match data.json keys / dashboard)
const HOLDINGS = [
  { ticker: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', buy: 1340, qty: 7 },
  { ticker: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', buy: 800, qty: 9 },
  { ticker: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', buy: 1842, qty: 3 },
  { ticker: 'LT', name: 'L&T', sector: 'Infrastructure', buy: 4098, qty: 1 },
  { ticker: 'TATAMOTORS', name: 'Tata Motors', sector: 'Auto/EV', buy: 442, qty: 17 },
  { ticker: 'BEL', name: 'BEL', sector: 'Defence', buy: 460, qty: 13 },
  { ticker: 'HINDALCO', name: 'Hindalco', sector: 'Metals', buy: 1039, qty: 4 },
  { ticker: 'SUNPHARMA', name: 'Sun Pharma', sector: 'Pharma', buy: 1676, qty: 2 },
  { ticker: 'INDHOTEL', name: 'Indian Hotels', sector: 'Tourism', buy: 654, qty: 11 },
  { ticker: 'COCHINSHIP', name: 'Cochin Shipyard', sector: 'Naval Defence', buy: 1560, qty: 4 },
  { ticker: 'MAXHEALTH', name: 'Max Healthcare', sector: 'Healthcare', buy: 1007, qty: 5 },
  { ticker: 'CHOLAFIN', name: 'Cholamandalam', sector: 'Vehicle NBFC', buy: 1579, qty: 4 },
  { ticker: 'KALYANKJIL', name: 'Kalyan Jewellers', sector: 'Retail', buy: 425, qty: 19 },
  { ticker: 'CDSL', name: 'CDSL', sector: 'Capital Markets', buy: 1395, qty: 4 },
  { ticker: 'SUZLON', name: 'Suzlon', sector: 'Green Energy', buy: 53.35, qty: 120 },
  { ticker: 'PGEL', name: 'PG Electroplast', sector: 'EMS', buy: 562, qty: 12 },
];

// Mechanical rebalancing thresholds (educational, not advice)
const DEEP_LOSS = -15; // review thesis / average-down candidate
const STRONG_GAIN = 12; // let-run / trim-if-overweight candidate

function fmtPct(p) { return (p >= 0 ? '+' : '') + p.toFixed(1) + '%'; }

function main() {
  const data = JSON.parse(readFileSync('data.json', 'utf8'));
  const prices = data.prices || {};

  const rows = [];
  let invested = 0, current = 0, missing = 0;
  for (const h of HOLDINGS) {
    const p = prices[h.ticker];
    const cur = p && typeof p.price === 'number' ? p.price : null;
    invested += h.buy * h.qty;
    if (cur == null) { missing++; continue; }
    current += cur * h.qty;
    const pct = (cur - h.buy) / h.buy * 100;
    rows.push({ ...h, cur, pct, pl: (cur - h.buy) * h.qty });
  }

  const totalPnl = current - invested;
  const totalPct = invested ? totalPnl / invested * 100 : 0;
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);

  // Dashboard renderer adds the +/% itself, so `change` is a bare number.
  const topGainers = sorted.filter(r => r.pct > 0).slice(0, 5)
    .map(r => ({ name: r.name, change: Number(r.pct.toFixed(1)) }));
  const topLosers = sorted.filter(r => r.pct < 0).slice(-5).reverse()
    .map(r => ({ name: r.name, change: Number(r.pct.toFixed(1)) }));

  // Mechanical rebalancing notes
  const reviewLosers = sorted.filter(r => r.pct <= DEEP_LOSS);
  const runners = sorted.filter(r => r.pct >= STRONG_GAIN);
  const rebalanceParts = [];
  if (reviewLosers.length) {
    rebalanceParts.push(
      `Review (down ≥15%): ${reviewLosers.map(r => `${r.name} ${fmtPct(r.pct)}`).join(', ')} — re-confirm thesis; average-down only if conviction holds, else trim.`
    );
  }
  if (runners.length) {
    rebalanceParts.push(
      `Let run / trim if overweight (up ≥12%): ${runners.map(r => `${r.name} ${fmtPct(r.pct)}`).join(', ')}.`
    );
  }
  if (!rebalanceParts.length) {
    rebalanceParts.push('No rebalancing flags this week — all holdings within normal range. Hold.');
  }

  const summary =
    `Portfolio ${totalPnl >= 0 ? 'up' : 'down'} ${fmtPct(totalPct)} ` +
    `(₹${Math.round(current).toLocaleString('en-IN')} vs ₹${Math.round(invested).toLocaleString('en-IN')} invested). ` +
    `${topGainers.length ? 'Leaders: ' + topGainers.slice(0, 2).map(g => g.name).join(', ') + '. ' : ''}` +
    `${topLosers.length ? 'Laggards: ' + topLosers.slice(0, 2).map(l => l.name).join(', ') + '.' : ''}`;

  const outlook =
    `${totalPct < 0 ? 'Drawdown' : 'Gain'} concentrated in ${(totalPct < 0 ? topLosers : topGainers)
      .slice(0, 3).map(r => r.name).join(', ')}. ` +
    `Mechanical view only — no news/macro overlay. Educational tracking, not investment advice.`;

  const report = {
    date: (data.lastUpdated || '').slice(0, 10) || null,
    summary,
    topGainers,
    topLosers,
    news: [],
    upcomingEarnings: [],
    outlook,
    rebalancing: rebalanceParts.join(' '),
  };

  if (missing) report.summary += ` (${missing} holding price unavailable.)`;

  writeFileSync('report.json', JSON.stringify(report, null, 2));
  console.log('Wrote report.json:', report.date, '|', report.summary);
}

main();
