/**
 * Locally generated travel imagery (SVG data URIs).
 *
 * Hotel photos from the mock provider are external Unsplash CDN URLs. If that
 * host is unreachable (offline, blocked network), images would fail to load.
 * These functions generate professional, deterministic poster images locally
 * so every card ALWAYS shows a real-looking image — no broken-image icons,
 * no network dependency.
 */

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const GRADIENTS = [
  ['#0f9488', '#134e4a'],
  ['#0ea5e9', '#1e3a8a'],
  ['#f59e0b', '#92400e'],
  ['#8b5cf6', '#4c1d95'],
  ['#14b8a6', '#0f766e'],
  ['#f43f5e', '#881337'],
  ['#6366f1', '#312e81'],
  ['#0d9488', '#155e75'],
];

const escapeXml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** Deterministic poster URL for a hotel — gradient, skyline, name + city. */
export function hotelPosterUrl(hotel) {
  const name = String(hotel?.name || 'Hotel').slice(0, 30);
  const city = hotel?.city || '';
  const stars = Math.max(1, Math.min(5, Number(hotel?.starRating) || 3));
  const [c1, c2] = GRADIENTS[hashCode(name + city) % GRADIENTS.length];

  // Skyline rectangles + a few lit windows, drawn in white with low opacity.
  const skyline = [
    [30, 230, 70, 170], [110, 260, 50, 140], [170, 200, 80, 200],
    [260, 250, 60, 150], [330, 220, 70, 180], [410, 270, 50, 130],
    [470, 240, 80, 160], [560, 210, 60, 190],
  ].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`).join('');
  const windows = [
    [190, 216], [206, 216], [222, 216], [190, 240], [206, 240], [222, 240],
    [490, 256], [506, 256], [522, 256], [490, 280], [522, 280],
  ].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="10" rx="1"/>`).join('');
  const starsSvg = '★'.repeat(stars);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <circle cx="560" cy="60" r="110" fill="rgba(255,255,255,0.09)"/>
  <circle cx="70" cy="380" r="150" fill="rgba(255,255,255,0.07)"/>
  <g fill="rgba(255,255,255,0.13)">${skyline}</g>
  <g fill="#ffe9a3" opacity="0.85">${windows}</g>
  <text x="32" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
  <text x="32" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.92)">${escapeXml(city)} · ${escapeXml(starsSvg)} · Hotel</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Deterministic poster for a city (used on the public home page). */
export function cityPosterUrl(city, tag = '') {
  return hotelPosterUrl({ name: String(city || 'Destination').slice(0, 20), city, starRating: 4 });
}
