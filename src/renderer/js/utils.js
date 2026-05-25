export const DOMAIN_SUFFIXES = ['.local', '.test', '.localhost', '.co.local', '.co.test'];
export const DEFAULT_SUFFIX = '.local';

export function validateDomainPart(value) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(value) || /^[a-zA-Z0-9]$/.test(value);
}

export function splitDomain(fullDomain) {
  let base = fullDomain;
  let suffix = DEFAULT_SUFFIX;
  // Sort longest first so '.co.local' is preferred over '.local'
  for (const s of [...DOMAIN_SUFFIXES].sort((a, b) => b.length - a.length)) {
    if (fullDomain.endsWith(s)) {
      base = fullDomain.slice(0, -s.length);
      suffix = s;
      break;
    }
  }
  const dot = base.indexOf('.');
  if (dot === -1) return { subdomain: '', domain: base, suffix };
  return { subdomain: base.slice(0, dot), domain: base.slice(dot + 1), suffix };
}

export function getExpiryInfo(isoString) {
  if (!isoString) return null;
  const expiry = new Date(isoString);
  const now = Date.now();
  const msLeft = expiry - now;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const threeMonths = 90 * 24 * 60 * 60 * 1000;
  const label = msLeft <= 0 ? 'Expired' : 'Expires';
  let urgency = null;
  if (msLeft <= oneWeek) urgency = 'danger';
  else if (msLeft <= threeMonths) urgency = 'warning';
  return { text: `${label} ${expiry.toLocaleString()}`, urgency };
}
