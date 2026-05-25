/**
 * WebSearchService
 *
 * Provides real-time web search context for local (and cloud) LLMs.
 * When a queue item is tagged with 🌐 Web Search, the queue manager calls
 * search() before sending the prompt. The returned context is prepended to
 * the system prompt so any model — even those without tool-calling support —
 * receives up-to-date information.
 *
 * Supported backends (configurable in Settings → Web Search):
 *
 *   Tavily   — cloud API, 1,000 free searches/month, no credit card required.
 *              Best structured results — clean title + URL + excerpt per hit.
 *              Sign up at: https://app.tavily.com
 *
 *   SearXNG  — self-hosted Docker container, completely free and private.
 *              Aggregates results from Google, Bing, DuckDuckGo etc.
 *              Quick-start: docker run -p 8888:8080 searxng/searxng
 *              (Note: the container's internal port is 8080; we map it to 8888
 *              on the host to avoid conflicts with LocalAI.)
 *
 * Config is stored in electron-store under the following keys:
 *   searchBackend          — 'tavily' | 'searxng' | 'none'
 *   searchKey.tavily       — Tavily API key
 *   searchUrl.searxng      — SearXNG base URL (default: http://localhost:8888)
 */

'use strict';

const DEFAULT_SEARXNG_URL = 'http://localhost:8888';
const MAX_RESULTS         = 5;
// Maximum snippet length per result to keep context concise
const MAX_SNIPPET_CHARS   = 400;

class WebSearchService {
  constructor(store) {
    this.store = store;
  }

  // ── Config accessors ───────────────────────────────────────────────────────

  getBackend()    { return this.store?.get('searchBackend')    || 'none'; }
  getSearxngUrl() { return this.store?.get('searchUrl.searxng') || DEFAULT_SEARXNG_URL; }

  setBackend(backend) {
    if (!['tavily', 'searxng', 'none'].includes(backend)) {
      throw new Error(`Unknown search backend: ${backend}`);
    }
    this.store?.set('searchBackend', backend);
    return { success: true, backend };
  }

  setTavilyKey(key) {
    const k = (key || '').trim();
    if (!k) throw new Error('Tavily API key cannot be empty');
    if (!k.startsWith('tvly-')) {
      throw new Error('Tavily API keys start with "tvly-". Check your key at app.tavily.com.');
    }
    this.store?.set('searchKey.tavily', k);
    return { success: true };
  }

  removeTavilyKey() {
    this.store?.delete('searchKey.tavily');
    return { success: true };
  }

  setSearxngUrl(url) {
    const u = (url || '').trim().replace(/\/$/, '');
    if (!u.startsWith('http')) throw new Error('SearXNG URL must start with http:// or https://');
    this.store?.set('searchUrl.searxng', u);
    return { success: true, url: u };
  }

  isConfigured() {
    const backend = this.getBackend();
    if (backend === 'tavily')  return !!this.store?.get('searchKey.tavily');
    if (backend === 'searxng') return true;  // URL always has a default; server may or may not be running
    return false;
  }

  /**
   * IPC-safe config snapshot — never exposes the raw key, just presence.
   */
  getConfig() {
    const backend = this.getBackend();
    return {
      backend,
      tavilyConfigured: !!this.store?.get('searchKey.tavily'),
      searxngUrl:       this.getSearxngUrl(),
      configured:       this.isConfigured(),
    };
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Run a search and return up to MAX_RESULTS results.
   * Returns null if no backend is configured, or throws on API error.
   *
   * @param {string} query
   * @returns {Promise<Array<{title:string, url:string, snippet:string}> | null>}
   */
  async search(query) {
    const backend = this.getBackend();
    if (backend === 'none' || !this.isConfigured()) return null;

    // Trim query to a reasonable length
    const q = query.trim().slice(0, 300);

    if (backend === 'tavily')  return this._searchTavily(q);
    if (backend === 'searxng') return this._searchSearxng(q);
    return null;
  }

  async _searchTavily(query) {
    const key = this.store?.get('searchKey.tavily');
    if (!key) throw new Error('Tavily API key not configured');

    const res = await fetch('https://api.tavily.com/search', {
      method:  'POST',
      // Send the key as a Bearer token, not in the body — body fields appear
      // in server access logs and proxy inspection tools.
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        max_results:         MAX_RESULTS,
        search_depth:        'basic',
        include_answer:      false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.detail || ''; } catch (_) {}
      throw new Error(`Tavily search failed (${res.status}): ${detail || res.statusText}`);
    }

    const data = await res.json();
    return (data.results || []).slice(0, MAX_RESULTS).map(r => ({
      title:   r.title   || 'Untitled',
      url:     r.url     || '',
      snippet: (r.content || r.snippet || '').slice(0, MAX_SNIPPET_CHARS),
    }));
  }

  async _searchSearxng(query) {
    const baseUrl = this.getSearxngUrl();
    const url     = new URL('/search', baseUrl);
    url.searchParams.set('q',          query);
    url.searchParams.set('format',     'json');
    url.searchParams.set('categories', 'general');
    url.searchParams.set('language',   'en');

    let res;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        throw new Error(
          `SearXNG is not running at ${baseUrl}. ` +
          'Start it with: docker run -p 8888:8080 searxng/searxng'
        );
      }
      throw err;
    }

    if (!res.ok) {
      // SearXNG returns 400 if JSON format is not in its ALLOWED_OUTPUT_FORMATS.
      // Give a helpful message in that case.
      if (res.status === 400) {
        throw new Error(
          'SearXNG returned 400. Enable JSON output: ' +
          'set SEARXNG_SEARCH_FORMATS="html,json" in your Docker env, or edit settings.yml.'
        );
      }
      throw new Error(`SearXNG search failed (${res.status})`);
    }

    const data = await res.json();
    return (data.results || []).slice(0, MAX_RESULTS).map(r => ({
      title:   r.title   || 'Untitled',
      url:     r.url     || '',
      snippet: (r.content || r.snippet || '').slice(0, MAX_SNIPPET_CHARS),
    }));
  }

  // ── Context formatting ─────────────────────────────────────────────────────

  /**
   * Formats search results into a system-prompt block ready for injection.
   * Designed to work with any model — no tool-calling required.
   *
   * @param {Array<{title,url,snippet}>} results
   * @param {string} query
   * @returns {string}
   */
  formatContext(results, query) {
    if (!results || results.length === 0) return '';

    const lines = [
      `[Web search results — retrieved in real time]`,
      `Query: "${query}"`,
      '',
      ...results.map((r, i) => [
        `${i + 1}. ${r.title}`,
        `   Source: ${r.url}`,
        r.snippet ? `   ${r.snippet}` : '',
      ].filter(Boolean).join('\n')),
      '',
      'Use the above search results to answer the question where relevant.',
      'If the results are outdated or not applicable, answer from your training knowledge and say so.',
      '[End of web search results]',
    ];

    return lines.join('\n');
  }
}

module.exports = { WebSearchService };
