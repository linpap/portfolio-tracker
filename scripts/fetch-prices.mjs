import { readFileSync, writeFileSync } from 'fs';

const TICKERS = [
  { ticker: 'ICICIBANK', yahoo: 'ICICIBANK.NS' },
  { ticker: 'HDFCBANK', yahoo: 'HDFCBANK.NS' },
  { ticker: 'BHARTIARTL', yahoo: 'BHARTIARTL.NS' },
  { ticker: 'LT', yahoo: 'LT.NS' },
  { ticker: 'TATAMOTORS', yahoo: 'TMCV.NS' },
  { ticker: 'BEL', yahoo: 'BEL.NS' },
  { ticker: 'INDHOTEL', yahoo: 'INDHOTEL.NS' },
  { ticker: 'POLYCAB', yahoo: 'POLYCAB.NS' },
  { ticker: 'COCHINSHIP', yahoo: 'COCHINSHIP.NS' },
  { ticker: 'MAXHEALTH', yahoo: 'MAXHEALTH.NS' },
  { ticker: 'CHOLAFIN', yahoo: 'CHOLAFIN.NS' },
  { ticker: 'KALYANKJIL', yahoo: 'KALYANKJIL.NS' },
  { ticker: 'CDSL', yahoo: 'CDSL.NS' },
  { ticker: 'SUZLON', yahoo: 'SUZLON.NS' },
  { ticker: 'PGEL', yahoo: 'PGEL.NS' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

let fallback = {};
try {
  const existing = JSON.parse(readFileSync('data.json', 'utf8'));
  fallback = existing.prices || {};
} catch { }

async function fetchPrice(yahooTicker, retries = 3) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (resp.status === 429) {
        const wait = Math.pow(2, i + 1) * 1000;
        console.warn(`Rate limited on ${yahooTicker}, waiting ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const meta = json.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) throw new Error('No price in response');
      return {
        price: meta.regularMarketPrice,
        name: meta.longName || meta.shortName || yahooTicker,
        dayHigh: meta.regularMarketDayHigh || null,
        dayLow: meta.regularMarketDayLow || null,
        prevClose: meta.chartPreviousClose || null,
      };
    } catch (e) {
      console.warn(`Attempt ${i + 1}/${retries} failed for ${yahooTicker}: ${e.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function main() {
  const prices = {};
  let success = 0, failed = 0;

  for (const { ticker, yahoo } of TICKERS) {
    const result = await fetchPrice(yahoo);
    if (result) {
      prices[ticker] = result;
      success++;
      console.log(`✓ ${ticker}: ₹${result.price}`);
    } else {
      if (fallback[ticker]) {
        prices[ticker] = fallback[ticker];
        console.warn(`✗ ${ticker}: using cached price ₹${fallback[ticker].price}`);
      } else {
        console.error(`✗ ${ticker}: no price available`);
      }
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const data = {
    lastUpdated: new Date().toISOString(),
    prices,
  };

  writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log(`\nDone: ${success} fetched, ${failed} failed. Wrote data.json`);
}

main();
