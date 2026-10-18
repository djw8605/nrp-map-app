/*
 * Pure helpers for generate-wall.js: no network and no environment access, so
 * everything here is covered by test/wall-lib.test.js. The document built at the
 * end is described in docs/superpowers/specs/2026-10-18-nrp-live-wall-design.md
 * and in README.md.
 */
const { cleanInstitutionName, isUnattributed } = require('./usage-lib');

const DEFAULT_HOME = 'University of Nebraska–Lincoln';
/*
 * Pairs closer than this are local work, not a flow. ROR places an institution
 * at its city's point, so the same campus under two names lands on one point;
 * the margin also covers a city point (ROR) against a campus point (Netbox).
 */
const LOCAL_MILES = 10;
// A Netbox name match is used only if all of its sites are this close together.
const NETBOX_SPREAD_MILES = 50;
const HOURS_PER_YEAR = 8760;
// About one 90,000-word novel.
const TOKENS_PER_NOVEL = 120000;
// The longer window the tiles show beside the day, ending on the day.
const MONTH_DAYS = 30;
const EARTH_RADIUS_MILES = 3958.8;

const byName = (a, b) => a.localeCompare(b);
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/*
 * Matching key for names written differently for one place: "University of
 * California San Diego" and "University of California, San Diego", or an en dash
 * against a hyphen in "Nebraska–Lincoln".
 */
function normalizeName(name) {
  return (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the /, '');
}

// Great-circle distance between two { lat, lng } points.
function milesBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/*
 * Rows of { institution, node_institution, usage } into one entry per (user,
 * host). User names are cleaned of allocation suffixes; an `Unknown` or empty
 * name on either side becomes null and only counts toward the total.
 */
function collectPairs(rows) {
  const pairs = new Map();
  let gpuHours = 0;

  for (const row of rows) {
    const hours = Number(row.usage) || 0;
    if (hours <= 0) continue;
    gpuHours += hours;
    const user = isUnattributed(row.institution) ? null : cleanInstitutionName(row.institution) || null;
    const host = isUnattributed(row.node_institution) ? null : row.node_institution.trim();
    const key = JSON.stringify([user, host]);
    const pair = pairs.get(key);
    if (pair) pair.hours += hours;
    else pairs.set(key, { user, host, hours });
  }
  return { pairs: [...pairs.values()], gpuHours };
}

function sumTokens(rows) {
  return rows.reduce((total, row) => total + (Number(row.tokens_used) || 0), 0);
}

const toCoordinate = (value) => (value === null || value === undefined || value === '' ? NaN : Number(value));

/*
 * Netbox fallback for a host campus: the nodes.json sites whose `name` (the
 * Netbox region) or `siteName` matches. One campus often has several sites a
 * few hundred metres apart, so a match is used, at its mean point, only if all
 * of its sites are within NETBOX_SPREAD_MILES of each other.
 */
function netboxPlacement(name, sites) {
  const wanted = normalizeName(name);
  const points = (sites || [])
    .filter((site) => [site.name, site.siteName].some((value) => value && normalizeName(value) === wanted))
    .map((site) => ({ lat: toCoordinate(site.latitude), lng: toCoordinate(site.longitude) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length === 0) return null;
  if (!points.every((point) => milesBetween(points[0], point) <= NETBOX_SPREAD_MILES)) return null;

  const mean = (key) => points.reduce((total, point) => total + point[key], 0) / points.length;
  return { lat: round(mean('lat'), 5), lng: round(mean('lng'), 5), match: 'netbox' };
}

// "Lincoln, NE" for a US organization, "Daejeon, South Korea" otherwise.
function placeFromRorOrganization(org) {
  const location = org?.locations?.[0]?.geonames_details;
  if (!location?.name) return null;
  const area = location.country_code === 'US' ? location.country_subdivision_code : location.country_name;
  return area ? `${location.name}, ${area}` : location.name;
}

// First day of the MONTH_DAYS-day window ending on `day` (YYYY-MM-DD, UTC).
function windowStart(day, days = MONTH_DAYS) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

// The point of any name written like `key`, e.g. the home under either spelling.
function pointOf(locations, key) {
  return Object.keys(locations)
    .filter((name) => normalizeName(name) === key)
    .map((name) => locations[name])
    .find(Boolean) || null;
}

/*
 * One institution's work with others, the amber tile's numbers when it is picked
 * on the page. The institution itself is found by name (its spellings normalise
 * alike); the other side of each pair counts as "another institution" unless it
 * has the same name or is placed within LOCAL_MILES of it, the home rule of
 * buildWallDocument. An unplaced name that differs counts as another
 * institution; an unattributed side (null) counts toward neither.
 *
 *   served: hours run on its GPUs for others, and how many users that was
 *   away:   hours its researchers ran on others' GPUs, and how many hosts
 *   hosted: whether it ran any GPU hours at all
 */
function institutionFigures(pairs, locations, name) {
  const key = normalizeName(name);
  const point = pointOf(locations, key);
  const at = (other) => (other && locations[other]) || null;
  const isSelf = (other) =>
    normalizeName(other) === key || (Boolean(point && at(other)) && milesBetween(point, at(other)) < LOCAL_MILES);

  const partners = new Set();
  const hosts = new Set();
  let servedHours = 0;
  let awayHours = 0;
  let hosted = false;

  for (const { user, host, hours } of pairs) {
    if (host && normalizeName(host) === key) {
      hosted = true;
      if (user && !isSelf(user)) {
        servedHours += hours;
        partners.add(normalizeName(user));
      }
    }
    if (user && host && normalizeName(user) === key && !isSelf(host)) {
      awayHours += hours;
      hosts.add(normalizeName(host));
    }
  }
  return {
    hosted,
    figures: {
      served_hours: round(servedHours, 2),
      served_partners: partners.size,
      away_hours: round(awayHours, 2),
      away_hosts: hosts.size,
    },
  };
}

/*
 * `locations` maps every user and host name to { lat, lng } or null; `places`
 * maps placed host names to a place label or null. With `month` ({ start, end,
 * pairs, gpuHours, llmTokens }, located by the same `locations`), the document
 * also carries the month's totals and the per-institution figures for every dot
 * on the map. See the specs for the meaning of each field.
 */
function buildWallDocument({
  day, generatedAt, pairs, gpuHours, llmTokens, locations, places = {}, home = DEFAULT_HOME, month = null,
}) {
  const at = (name) => (name && locations[name]) || null;
  const homeKey = normalizeName(home);
  const homeAt = pointOf(locations, homeKey);
  const near = (a, b) => Boolean(a && b) && milesBetween(a, b) < LOCAL_MILES;
  const isLocal = (user, from, host, to) => normalizeName(user) === normalizeName(host) || near(from, to);
  const isHome = (user, from) => normalizeName(user) === homeKey || near(from, homeAt);

  const users = new Set();
  const hosts = new Set();
  const sites = new Map();
  const flows = new Map();
  const unmapped = new Map();
  const partners = new Set();
  let placedHours = 0;
  let awayHours = 0;
  let servedHours = 0;

  const addUnmapped = (name, side, hours) => {
    const key = `${side}\u0000${name}`;
    if (!unmapped.has(key)) unmapped.set(key, { name, side, gpu_hours: 0 });
    unmapped.get(key).gpu_hours += hours;
  };

  for (const { user, host, hours } of pairs) {
    const from = at(user);
    const to = at(host);
    if (user) {
      users.add(normalizeName(user));
      if (!from) addUnmapped(user, 'user', hours);
    }
    if (host) {
      hosts.add(normalizeName(host));
      if (!to) addUnmapped(host, 'host', hours);
    }

    if (to) {
      if (!sites.has(host)) {
        sites.set(host, { name: host, place: places[host] ?? null, lat: to.lat, lng: to.lng, hosted_hours: 0 });
      }
      sites.get(host).hosted_hours += hours;
    }

    if (from && to) {
      placedHours += hours;
      if (!isLocal(user, from, host, to)) {
        awayHours += hours;
        const key = JSON.stringify([user, host]);
        if (!flows.has(key)) {
          flows.set(key, {
            from: user,
            to: host,
            gpu_hours: 0,
            miles: Math.round(milesBetween(from, to)),
            from_lat: from.lat,
            from_lng: from.lng,
            to_lat: to.lat,
            to_lng: to.lng,
          });
        }
        flows.get(key).gpu_hours += hours;
      }
    }

    if (host && user && normalizeName(host) === homeKey && !isHome(user, from)) {
      servedHours += hours;
      partners.add(normalizeName(user));
    }
  }

  const byHours = (key) => (a, b) => b[key] - a[key];
  const roundHours = (entry, key) => ({ ...entry, [key]: round(entry[key], 2) });

  const doc = {
    generated_at: generatedAt,
    day,
    totals: {
      gpu_hours: round(gpuHours, 2),
      gpu_years: round(gpuHours / HOURS_PER_YEAR, 3),
      away_share: placedHours > 0 ? round(awayHours / placedHours, 4) : 0,
      host_sites: hosts.size,
      user_institutions: users.size,
      llm_tokens: Math.round(llmTokens),
      llm_novels: round(llmTokens / TOKENS_PER_NOVEL, 1),
    },
    home: {
      institution: home,
      served_hours: round(servedHours, 2),
      partner_count: partners.size,
    },
    sites: [...sites.values()]
      .sort((a, b) => byHours('hosted_hours')(a, b) || byName(a.name, b.name))
      .map((site) => roundHours(site, 'hosted_hours')),
    flows: [...flows.values()]
      .sort((a, b) => byHours('gpu_hours')(a, b) || byName(a.from, b.from) || byName(a.to, b.to))
      .map((flow) => roundHours(flow, 'gpu_hours')),
    unmapped: [...unmapped.values()]
      .sort((a, b) => byHours('gpu_hours')(a, b) || byName(a.name, b.name))
      .map((entry) => roundHours(entry, 'gpu_hours')),
  };
  if (!month) return doc;

  const { totals: monthTotals } = buildWallDocument({
    day: month.end, generatedAt, pairs: month.pairs, gpuHours: month.gpuHours, llmTokens: month.llmTokens, locations, home,
  });
  // Every name the page draws a dot for: placed hosts and the starts of arcs.
  const dots = [...new Set([...doc.sites.map((site) => site.name), ...doc.flows.map((flow) => flow.from)])].sort(byName);
  const institutions = {};
  for (const name of dots) {
    const dayFigures = institutionFigures(pairs, locations, name);
    const monthFigures = institutionFigures(month.pairs, locations, name);
    institutions[name] = {
      hosts: dayFigures.hosted || monthFigures.hosted,
      day: dayFigures.figures,
      month: monthFigures.figures,
    };
  }
  return {
    ...doc,
    month: { start: month.start, end: month.end, totals: monthTotals },
    institutions,
  };
}

// Why the document must not be published, or null if it can be.
function publishProblem(doc) {
  if (!(doc?.totals?.gpu_hours > 0)) return 'Total GPU hours is 0';
  if (!Array.isArray(doc.flows) || doc.flows.length === 0) return 'No mapped flows';
  return null;
}

module.exports = {
  DEFAULT_HOME,
  LOCAL_MILES,
  HOURS_PER_YEAR,
  TOKENS_PER_NOVEL,
  MONTH_DAYS,
  normalizeName,
  windowStart,
  institutionFigures,
  milesBetween,
  collectPairs,
  sumTokens,
  netboxPlacement,
  placeFromRorOrganization,
  buildWallDocument,
  publishProblem,
};
