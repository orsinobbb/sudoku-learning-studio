export const MARKETING_KEY = 'sudoku-learning-marketing';

function safeParse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

function clean(value, max = 80) {
  return String(value || '').replace(/[^\p{L}\p{N}._~-]/gu, '').slice(0, max);
}

export function dateKeyFor(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return dateKeyFor(new Date());
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

export function dailyChallenge(dateOrKey = new Date()) {
  const dateKey = typeof dateOrKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrKey)
    ? dateOrKey
    : dateKeyFor(dateOrKey);
  const checksum = [...dateKey].reduce((total, character) => total + character.charCodeAt(0), 0);
  const difficulty = ['easy', 'medium', 'hard'][checksum % 3];
  return { dateKey, difficulty, seed: `DAILY-${dateKey.replaceAll('-', '')}` };
}

export function getMarketingState(storage = localStorage) {
  const raw = safeParse(storage.getItem(MARKETING_KEY)) || {};
  return {
    referralCode: clean(raw.referralCode, 16),
    marketingConsent: raw.marketingConsent === true,
    campaign: raw.campaign && typeof raw.campaign === 'object' ? raw.campaign : null,
    events: Array.isArray(raw.events) ? raw.events.slice(0, 80) : []
  };
}

export function saveMarketingState(next, storage = localStorage) {
  storage.setItem(MARKETING_KEY, JSON.stringify({ version: 1, ...next, updatedAt: new Date().toISOString() }));
}

export function ensureReferralCode(storage = localStorage, random = Math.random) {
  const state = getMarketingState(storage);
  if (!state.referralCode) {
    state.referralCode = `S${Math.floor(random() * 36 ** 8).toString(36).padStart(8, '0').toUpperCase()}`;
    saveMarketingState(state, storage);
  }
  return state.referralCode;
}

export function captureCampaign(url, storage = localStorage) {
  const parsed = new URL(url, 'https://example.invalid');
  const campaign = {
    ref: clean(parsed.searchParams.get('ref'), 16),
    source: clean(parsed.searchParams.get('utm_source')),
    medium: clean(parsed.searchParams.get('utm_medium')),
    name: clean(parsed.searchParams.get('utm_campaign'))
  };
  if (!Object.values(campaign).some(Boolean)) return null;
  const state = getMarketingState(storage);
  state.campaign = { ...campaign, firstSeenAt: state.campaign?.firstSeenAt || new Date().toISOString() };
  saveMarketingState(state, storage);
  return state.campaign;
}

export function trackMarketingEvent(name, details = {}, storage = localStorage) {
  const state = getMarketingState(storage);
  state.events.unshift({ name: clean(name, 40), details, at: new Date().toISOString() });
  state.events = state.events.slice(0, 80);
  saveMarketingState(state, storage);
}

export function setMarketingConsent(consent, storage = localStorage) {
  const state = getMarketingState(storage);
  state.marketingConsent = consent === true;
  saveMarketingState(state, storage);
  return state.marketingConsent;
}

export function buildChallengeUrl(baseUrl, { dateKey, puzzle = '', difficulty = '', referralCode = '' } = {}) {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  if (dateKey) url.searchParams.set('daily', clean(dateKey, 10));
  if (puzzle && /^[0-9.]{81}$/.test(puzzle)) url.searchParams.set('p', puzzle.replaceAll('.', '0'));
  if (difficulty) url.searchParams.set('d', clean(difficulty, 12));
  if (referralCode) url.searchParams.set('ref', clean(referralCode, 16));
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', dateKey ? 'daily_challenge' : 'puzzle_challenge');
  return url.toString();
}
