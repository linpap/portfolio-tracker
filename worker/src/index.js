const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const TICKER_MAP = {
  'TATAMOTORS.NS': 'TMCV.NS',
};

async function fetchQuote(symbol) {
  const resolved = TICKER_MAP[symbol] || symbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${resolved}?interval=1d&range=1d`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioTracker/1.0)' },
  });
  if (!resp.ok) return { symbol, error: `HTTP ${resp.status}` };
  const json = await resp.json();
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return { symbol, error: 'No price data' };
  return {
    symbol,
    price: meta.regularMarketPrice,
    name: meta.longName || meta.shortName || symbol,
    dayHigh: meta.regularMarketDayHigh || null,
    dayLow: meta.regularMarketDayLow || null,
    prevClose: meta.chartPreviousClose || null,
    volume: meta.regularMarketVolume || null,
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/quote') {
      return new Response(JSON.stringify({ error: 'Use /quote?symbols=TICKER.NS,TICKER.NS' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const symbolsParam = url.searchParams.get('symbols') || '';
    const symbols = symbolsParam.split(',').filter(s => s.endsWith('.NS') || s.endsWith('.BO'));

    if (symbols.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid symbols. Use ?symbols=ICICIBANK.NS,BEL.NS' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (symbols.length > 20) {
      return new Response(JSON.stringify({ error: 'Max 20 symbols per request' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const quotes = [];
    for (const sym of symbols) {
      quotes.push(await fetchQuote(sym));
      if (symbols.length > 1) await new Promise(r => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({ quotes, timestamp: new Date().toISOString() }), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};
