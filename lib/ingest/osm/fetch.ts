/**
 * Overpass access for the OSM adapter. The only module in the ingestion path
 * that talks to the network.
 *
 * Follows `docs/contracts/osm-toilets-source.md` sections 2 and 3: a bounded
 * query inside the Warsaw administrative boundary, the boundary resolved at
 * run time and reported, one retry on overload, and a User-Agent that names
 * the project. Usernames are stripped from every element before the response
 * is returned or saved.
 */

export interface OverpassOptions {
  endpoint?: string;
  userAgent?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface BoundaryCandidate {
  id: number;
  name: string;
  adminLevel: string;
}

export interface OverpassResponse {
  /** Elements with `user` and `uid` removed. */
  elements: unknown[];
  /** The response body after stripping, suitable for saving. */
  body: string;
  status: number;
}

const DEFAULTS = {
  endpoint: 'https://overpass-api.de/api/interpreter',
  userAgent: 'GdzieKibel.pl ingestion (https://github.com/Bienos/GDZIEKIBEL)',
  timeoutMs: 180_000,
  retryDelayMs: 20_000,
};

const RETRY_STATUSES = [429, 503, 504];

/** Overpass area ids for relations are the relation id offset by this. */
export const OVERPASS_AREA_OFFSET = 3_600_000_000;

export const BOUNDARY_QUERY = `[out:json][timeout:60];
relation["boundary"="administrative"]["name"="Warszawa"]["admin_level"~"^(4|5|6|7|8)$"];
out ids tags;`;

export function toiletsQuery(boundaryRelationId: number): string {
  const area = OVERPASS_AREA_OFFSET + boundaryRelationId;
  return `[out:json][timeout:180];
area(${area})->.warsaw;
(
  node["amenity"="toilets"](area.warsaw);
  way["amenity"="toilets"](area.warsaw);
  relation["amenity"="toilets"](area.warsaw);
);
out center meta;`;
}

/** Removes OSM account identifiers. They are never persisted, per the contract. */
export function stripUserFields(element: unknown): unknown {
  if (typeof element !== 'object' || element === null || Array.isArray(element)) return element;
  const rest: Record<string, unknown> = { ...(element as Record<string, unknown>) };
  delete rest.user;
  delete rest.uid;
  return rest;
}

async function post(query: string, options: OverpassOptions): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  return fetchImpl(options.endpoint ?? DEFAULTS.endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': options.userAgent ?? DEFAULTS.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULTS.timeoutMs),
  });
}

/** Posts one query, retrying once when the server reports overload. */
export async function runOverpassQuery(
  query: string,
  options: OverpassOptions = {},
): Promise<OverpassResponse> {
  let response = await post(query, options);

  if (!response.ok && RETRY_STATUSES.includes(response.status)) {
    await new Promise((resolve) =>
      setTimeout(resolve, options.retryDelayMs ?? DEFAULTS.retryDelayMs),
    );
    response = await post(query, options);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Overpass answered HTTP ${response.status}: ${text.replace(/\s+/g, ' ').slice(0, 240)}`,
    );
  }

  const parsed: unknown = await response.json();
  const elements =
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as { elements?: unknown }).elements)
      ? ((parsed as { elements: unknown[] }).elements as unknown[]).map(stripUserFields)
      : [];

  const stripped = { ...(parsed as Record<string, unknown>), elements };
  return { elements, body: JSON.stringify(stripped, null, 2), status: response.status };
}

/**
 * Finds the Warsaw administrative boundary relations by tags. Returns every
 * candidate so the caller can report them; choosing among more than one is a
 * recorded operator decision, never a guess in code.
 */
export async function resolveBoundaryCandidates(
  options: OverpassOptions = {},
): Promise<{ candidates: BoundaryCandidate[]; body: string }> {
  const { elements, body } = await runOverpassQuery(BOUNDARY_QUERY, options);

  const candidates: BoundaryCandidate[] = [];
  for (const element of elements) {
    const record = element as { id?: unknown; tags?: Record<string, string> };
    if (typeof record.id !== 'number' || !record.tags) continue;
    candidates.push({
      id: record.id,
      name: record.tags.name ?? '',
      adminLevel: record.tags.admin_level ?? '',
    });
  }
  return { candidates, body };
}

export async function fetchToiletsInBoundary(
  boundaryRelationId: number,
  options: OverpassOptions = {},
): Promise<OverpassResponse> {
  return runOverpassQuery(toiletsQuery(boundaryRelationId), options);
}
