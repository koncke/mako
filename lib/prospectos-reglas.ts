// =============================================================================
// prospectos-reglas — qué se busca, qué vuelve y cuánto vale cada prospecto (puro)
// =============================================================================
// El Leads Scraper (docs/diseno-leads-scraper.md §4 y §7): las fuentes que SE BUSCAN corren en
// Apify con la key del negocio y caen en la lista aparte `prospectos` (mig 0289). Acá vive todo lo
// que no toca la base, para que un test lo ejecute:
//   · los parámetros de una búsqueda y su validación (qué, dónde, cuántos);
//   · el input de cada actor y el techo de plata de la corrida;
//   · cómo se lee cada resultado de Apify (Google Maps, Instagram) → un prospecto;
//   · el PUNTAJE, por reglas a la vista (decisión 7: copia los «Apollo Scores»).
//
// ⚠️ LA FORMA DE LOS RESULTADOS SALE DE LA PÁGINA DE CADA ACTOR (consultadas el 15/10/2026), no
// de una corrida real: `compass/crawler-google-places` (title, categoryName, city, phone,
// phoneUnformatted, website, totalScore, reviewsCount, placeId, permanentlyClosed, y con
// `scrapeContacts` los links sociales y —no medido el nombre exacto— los emails) y
// `apify/instagram-search-scraper` (username, fullName, biography, externalUrl, followersCount,
// isBusinessAccount, businessCategoryName, private, verified). El lector es tolerante y la primera
// corrida real se compara contra esto.
//
// SIN `server-only`: lo prueban los tests (tests/prospectos-reglas.test.ts).

export type FuenteProspeccion = 'google_maps' | 'instagram';

export const FUENTES_PROSPECCION: Readonly<Record<FuenteProspeccion, {
  nombre: string;
  /** El actor de Apify, con el `~` que pide su API (`dueño~actor`). */
  actor: string;
  /** Lo que se le cobra al negocio cada 1.000 resultados, CON margen (techo, no promedio). */
  usdPorMil: number;
  /** Si «dónde» es obligatorio. */
  pideDonde: boolean;
}>> = {
  // US$1,50 cada 1.000 lugares + US$2 cada 1.000 por los contactos de la web (página del actor,
  // 15/10/2026). Se redondea para arriba: es el techo que se le promete al negocio.
  google_maps: { nombre: 'Google Maps', actor: 'compass~crawler-google-places', usdPorMil: 4, pideDonde: true },
  // US$1,50 a US$2,70 cada 1.000 según el plan de Apify del negocio: se toma el más caro.
  instagram: { nombre: 'Instagram', actor: 'apify~instagram-search-scraper', usdPorMil: 3, pideDonde: false },
};

export const esFuenteProspeccion = (v: unknown): v is FuenteProspeccion =>
  typeof v === 'string' && Object.hasOwn(FUENTES_PROSPECCION, v);

/** Cuántos se pueden pedir de una vez. El techo es el del importador del CRM (3.000) con aire. */
export const CANTIDADES = [25, 50, 100, 250, 500] as const;
export type Cantidad = (typeof CANTIDADES)[number];

export type ParametrosBusqueda = { fuente: FuenteProspeccion; que: string; donde: string | null; cuantos: Cantidad };

const txt = (v: unknown, tope: number): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
};

/** Valida lo que pide la persona. El error es una frase para la pantalla. */
export function parametrosDeBusqueda(crudo: unknown): ParametrosBusqueda | { error: string } {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  if (!esFuenteProspeccion(o.fuente)) return { error: 'Elige dónde buscar.' };
  const que = txt(o.que, 80);
  if (!que || que.length < 2) return { error: 'Escribe qué buscas.' };
  const donde = txt(o.donde, 80);
  if (FUENTES_PROSPECCION[o.fuente].pideDonde && !donde) return { error: 'Escribe dónde buscar: una ciudad o una zona.' };
  const n = Number(o.cuantos);
  const cuantos = (CANTIDADES as readonly number[]).includes(n) ? (n as Cantidad) : null;
  if (!cuantos) return { error: `Elige cuántos: ${CANTIDADES.join(', ')}.` };
  return { fuente: o.fuente, que, donde: FUENTES_PROSPECCION[o.fuente].pideDonde ? donde : null, cuantos };
}

/**
 * El TECHO de plata de una corrida, en USD. Viaja a Apify como `maxTotalChargeUsd`: la corrida se
 * corta ahí aunque el actor quiera seguir. Lo que se muestra antes de buscar es este número.
 */
export function techoUsd(p: Pick<ParametrosBusqueda, 'fuente' | 'cuantos'>): number {
  const crudo = (p.cuantos * FUENTES_PROSPECCION[p.fuente].usdPorMil) / 1000;
  return Math.max(0.1, Math.ceil(crudo * 100) / 100);
}

/** El input que recibe cada actor. */
export function inputDelActor(p: ParametrosBusqueda): Record<string, unknown> {
  if (p.fuente === 'google_maps') {
    return {
      searchStringsArray: [p.que],
      locationQuery: p.donde,
      maxCrawledPlacesPerSearch: p.cuantos,
      language: 'es',
      skipClosedPlaces: true,
      // Los emails y las redes de la web de cada lugar: lo que hace que un negocio local se pueda contactar.
      scrapeContacts: true,
    };
  }
  // Perfiles por palabra clave, sin entrar con ninguna cuenta (decisión 2). El actor topea en 250.
  return { search: p.que, searchType: 'user', searchLimit: Math.min(p.cuantos, 250) };
}

// ── Lo que vuelve ────────────────────────────────────────────────────────────

export type ProspectoNuevo = {
  fuente: FuenteProspeccion;
  id_externo: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  web: string | null;
  instagram: string | null;
  ciudad: string | null;
  rubro: string | null;
  /** Lo que mide el puntaje (y lo que se muestra al lado). Datos públicos del negocio, no el crudo entero. */
  datos: { resenas?: number; rating?: number; seguidores?: number; publicaciones?: number; empresa?: boolean; privado?: boolean; verificado?: boolean; url?: string };
};

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const email = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t.slice(0, 200) : null;
};

/** El primer email de una lista que puede venir como textos o como `{ value }`. */
function primerEmail(v: unknown): string | null {
  if (!Array.isArray(v)) return email(v);
  for (const x of v) {
    const e = email(typeof x === 'string' ? x : obj(x)?.value ?? obj(x)?.email);
    if (e) return e;
  }
  return null;
}

/** «https://www.instagram.com/inmobiliaria.perez/?hl=es» → «inmobiliaria.perez». */
export function usuarioDeInstagram(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(t);
  const u = (m ? m[1] : t.replace(/^@/, '')).toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(u) || ['p', 'reel', 'reels', 'explore', 'stories'].includes(u)) return null;
  return u;
}

/** Un teléfono escrito en un texto libre (la bio): 8 dígitos o más, con su + si lo tenía. */
function telefonoEnTexto(t: string): string | null {
  const m = /(\+?\d[\d\s().-]{7,}\d)/.exec(t);
  if (!m) return null;
  const digitos = m[1].replace(/\D/g, '');
  return digitos.length >= 8 && digitos.length <= 15 ? (m[1].trim().startsWith('+') ? `+${digitos}` : digitos) : null;
}

/** Un resultado de `compass/crawler-google-places`. null = no sirve (cerrado, sin id o sin nombre). */
export function prospectoDeGoogleMaps(item: unknown): ProspectoNuevo | null {
  const o = obj(item);
  if (!o || o.permanentlyClosed === true) return null;
  const id = txt(o.placeId, 200);
  const nombre = txt(o.title, 200);
  if (!id || !nombre) return null;
  const telefono = txt(o.phoneUnformatted, 40) ?? txt(o.phone, 40);
  const ig = Array.isArray(o.instagrams) ? o.instagrams.map(usuarioDeInstagram).find(Boolean) ?? null : null;
  return {
    fuente: 'google_maps', id_externo: id, nombre, empresa: nombre,
    email: primerEmail(o.emails) ?? primerEmail(obj(o.impressum)?.emails),
    telefono,
    web: txt(o.website, 300),
    instagram: ig,
    ciudad: txt(o.city, 120),
    rubro: txt(o.categoryName, 120),
    datos: {
      ...(num(o.reviewsCount) != null ? { resenas: num(o.reviewsCount) } : {}),
      ...(num(o.totalScore) != null ? { rating: num(o.totalScore) } : {}),
      ...(txt(o.url, 500) ? { url: txt(o.url, 500)! } : {}),
    },
  };
}

/** Un resultado de `apify/instagram-search-scraper` (o del de perfiles: los campos son los mismos). */
export function prospectoDeInstagram(item: unknown): ProspectoNuevo | null {
  const o = obj(item);
  if (!o) return null;
  const usuario = usuarioDeInstagram(o.username);
  if (!usuario) return null;
  const bio = txt(o.biography, 500) ?? '';
  return {
    fuente: 'instagram', id_externo: usuario,
    nombre: txt(o.fullName, 200) ?? usuario,
    empresa: o.isBusinessAccount === true ? (txt(o.fullName, 200) ?? null) : null,
    // La API pública no da el email ni el teléfono del perfil: sólo los que la persona escribió en su bio.
    email: email(EMAIL.exec(bio)?.[0]),
    telefono: telefonoEnTexto(bio),
    web: txt(o.externalUrl, 300),
    instagram: usuario,
    ciudad: null,
    rubro: txt(o.businessCategoryName, 120),
    datos: {
      ...(num(o.followersCount) != null ? { seguidores: num(o.followersCount) } : {}),
      ...(num(o.postsCount) != null ? { publicaciones: num(o.postsCount) } : {}),
      empresa: o.isBusinessAccount === true,
      privado: o.private === true,
      verificado: o.verified === true,
      url: `https://www.instagram.com/${usuario}/`,
    },
  };
}

export const LECTOR_DE: Readonly<Record<FuenteProspeccion, (item: unknown) => ProspectoNuevo | null>> = {
  google_maps: prospectoDeGoogleMaps,
  instagram: prospectoDeInstagram,
};

/** Lee el dataset entero: lo que no sirve se cuenta, no se esconde. */
export function leerResultados(fuente: FuenteProspeccion, items: unknown[]): { prospectos: ProspectoNuevo[]; descartados: number } {
  const vistos = new Set<string>();
  const prospectos: ProspectoNuevo[] = [];
  let descartados = 0;
  for (const it of items) {
    const p = LECTOR_DE[fuente](it);
    if (!p || vistos.has(p.id_externo)) { descartados++; continue; }
    vistos.add(p.id_externo);
    prospectos.push(p);
  }
  return { prospectos, descartados };
}

// ── El puntaje (decisión 7: reglas a la vista, como los Apollo Scores) ──────────

/**
 * Cada regla suma su peso y deja su pedazo de razón. EL CONTACTO MANDA: un teléfono o un email
 * valen 35 cada uno, y todo lo demás junto (web, redes, tamaño) suma 30 como mucho. Así un
 * prospecto que se puede contactar queda SIEMPRE arriba de uno que no, que es lo que decide si va
 * al CRM (el importador exige email o teléfono); el tamaño ordena dentro de cada grupo. Lo fija
 * tests/prospectos-reglas.test.ts. El total se topea en 100.
 */
export function puntuar(p: ProspectoNuevo): { puntaje: number; razon: string } {
  let puntos = 0;
  const por: string[] = [];
  const suma = (n: number, motivo: string) => { puntos += n; por.push(motivo); };

  if (p.telefono) suma(35, 'tiene teléfono');
  if (p.email) suma(35, 'tiene email');
  if (p.web) suma(10, 'tiene web');
  if (p.instagram && p.fuente !== 'instagram') suma(5, 'tiene Instagram');

  const d = p.datos;
  if (p.fuente === 'google_maps') {
    const r = d.resenas ?? 0;
    if (r >= 50) suma(10, `${r} reseñas`);
    else if (r >= 10) suma(5, `${r} reseñas`);
    if ((d.rating ?? 0) >= 4.2) suma(5, `${String(d.rating).replace('.', ',')} estrellas`);
  } else {
    const s = d.seguidores ?? 0;
    // El rango que se puede contactar: con menos casi no hay negocio, con más nadie lee los DMs.
    if (s >= 1_000 && s <= 100_000) suma(12, `${s.toLocaleString('es')} seguidores`);
    else if (s > 0) suma(4, `${s.toLocaleString('es')} seguidores`);
    if (d.empresa) suma(8, 'cuenta de empresa');
    if (d.privado) { puntos -= 20; por.push('cuenta privada'); }
  }

  const puntaje = Math.max(0, Math.min(100, puntos));
  const razon = por.length ? `${por[0].charAt(0).toUpperCase()}${por[0].slice(1)}${por.length > 1 ? `, ${por.slice(1).join(', ')}` : ''}.` : 'Sin datos para puntuar.';
  return { puntaje, razon: razon.slice(0, 300) };
}

/** ¿Puede ir al CRM? La regla del importador: email o teléfono (app/crm/leads-importar.ts, `sin-contacto`). */
export const contactable = (p: Pick<ProspectoNuevo, 'email' | 'telefono'>): boolean => !!(p.email || p.telefono);

/** Una búsqueda en una línea: «Google Maps · inmobiliarias en Tijuana · 100». */
export function rotuloDeBusqueda(p: Pick<ParametrosBusqueda, 'fuente' | 'que' | 'donde' | 'cuantos'>): string {
  return `${FUENTES_PROSPECCION[p.fuente].nombre} · ${p.que}${p.donde ? ` en ${p.donde}` : ''} · ${p.cuantos}`;
}
