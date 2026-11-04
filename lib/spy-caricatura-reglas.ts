// =============================================================================
// spy-caricatura-reglas — la caricatura de un competidor, por COLA: la genera el Runner con Canva (4/11/2026)
// =============================================================================
// Martín, 4/11 (por el Cerebro): «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket
// para generar esa imagen y ya con eso se pone la imagen ahí». Reemplaza el camino de antes (la IA del negocio
// describía la cara y el puente de Google Flow la generaba): ese camino no salió nunca en producción — todos los
// puentes estaban sin sesión — y le cobraba al negocio dos veces. Sin IA del negocio, sin Flow, sin fal ni Replicate.
//
// Lo puro, para que tenga test y para que lo usen el servidor Y los scripts del Runner (una sola definición de
// «pendiente»). El motor está en `lib/spy-caricatura-cola.ts`; los scripts, en `scripts/spy-caricatura*.mjs`.
//
// ⚠️ LA COLA, EN ORDEN:
//   1. al leer un competidor con su foto ya en NUESTRO Storage (`spy-miniaturas`), queda pendiente en `spy.caricaturas`
//      (la URL de Instagram vence: a la cola entra la nuestra);
//   2. el Runner lista lo pendiente de todos los negocios (sólo ws, id y la URL de la foto) y la genera con Canva;
//   3. el Runner la guarda: sube la imagen y la marca lista en ESE competidor y en todo competidor de cualquier negocio
//      con la misma red y el mismo usuario (una caricatura por persona, no por negocio);
//   4. la tarjeta la usa antes que la foto (`caraDeTarjeta`).
//
// ⚠️ NO SE ENCOLA: un referente (sus caricaturas ya están dibujadas y aprobadas), ni quien no tiene foto en nuestro
// Storage. Un fallo NO se reintenta en cadena: espera un día, y a los 3 queda «rendida», visible para el super admin.
// =============================================================================

/** Lo que se recuerda de la caricatura de UN competidor. Vive en `spy.caricaturas` (app_settings del negocio). */
export type EntradaCaricatura = {
  /** Su foto de perfil, ya en NUESTRO Storage: la referencia que usa el Runner. */
  foto?: string;
  /** Desde cuándo está en la cola (ISO). */
  desde?: string;
  /** La caricatura ya guardada en nuestro Storage. */
  url?: string;
  /** Su lado en píxeles (es cuadrada), leído del archivo. El conector de Canva entrega 200 × 200: no se asume más. */
  lado?: number;
  /** Cuántas veces el Runner no pudo generarla. */
  fallos?: number;
  /** Cuándo falló por última vez (ISO): no se vuelve a intentar hasta el día siguiente. */
  ultimoFallo?: string;
  /** Lo que dijo el Runner la última vez que falló. Texto nuestro, para el super admin. */
  motivo?: string;
};

export type RegistroCaricaturas = Record<string, EntradaCaricatura>;

/** Clave del setting: una por negocio, con una entrada por competidor. */
export const CLAVE_CARICATURAS = 'spy.caricaturas';

/** A los cuántos fallos deja de intentarse y queda «rendida» (visible para el super admin). */
export const FALLOS_HASTA_RENDIRSE = 3;

/** Cuánto se espera después de un fallo antes de volver a listarla: un fallo no se reintenta en cadena. */
export const ESPERA_TRAS_FALLO_MS = 24 * 60 * 60 * 1000;

/** El tope de una caricatura: el mismo del bucket de Spy. */
export const PESO_MAXIMO_CARICATURA = 2 * 1024 * 1024;

/** El lado más chico que se acepta: la tarjeta mide ~250 px, y una foto de Instagram ya llega en 150 o 320. */
export const LADO_MINIMO_CARICATURA = 128;

/**
 * El ancho y el alto de una imagen, leídos de su cabecera (PNG, JPEG o WebP), o null si no se pueden leer. El conector
 * de Canva entrega una vista de 200 × 200 aunque el original mida 1264: el tamaño se LEE, nunca se supone.
 */
export function medidasDeImagen(b: Uint8Array): { ancho: number; alto: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ancho: u32(16), alto: u32(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const m = b[i + 1];
      // SOF0..SOF15 menos DHT (C4), JPG (C8) y DAC (CC): ahí están las medidas.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { ancho: u16(i + 7), alto: u16(i + 5) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP') {
    const tipo = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tipo === 'VP8X') return { ancho: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), alto: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (tipo === 'VP8 ') return { ancho: le16(26) & 0x3fff, alto: le16(28) & 0x3fff };
    if (tipo === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { ancho: (bits & 0x3fff) + 1, alto: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/** Dónde vive una imagen nuestra de Spy. Lo mismo que `esNuestra` (lib/spy-miniaturas.ts), sin traer Supabase. */
const PUBLICA_SPY = '/storage/v1/object/public/spy-miniaturas/';
export const fotoEsNuestra = (url: string | null | undefined): url is string =>
  typeof url === 'string' && url.startsWith('https://') && url.includes(PUBLICA_SPY);

const fecha = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Un motivo de fallo, en una línea y corto. Lo escribe el Runner; se guarda limpio. */
export const motivoLimpio = (m: string | null | undefined): string =>
  String(m ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

/**
 * Lee el registro guardado. Lo que no tiene la forma se descarta: un setting roto no rompe la lista. Los campos del
 * camino de antes (`rasgos`, `trabajo`, `pedidaEn`, y los `fallos` de Flow sin foto) no sobreviven: una entrada sin
 * `foto` ni `url` vuelve a entrar a la cola nueva desde cero.
 */
export function leerRegistro(crudo: string | null | undefined): RegistroCaricaturas {
  let v: unknown;
  try { v = JSON.parse(crudo ?? '{}'); } catch { return {}; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: RegistroCaricaturas = {};
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d+$/.test(k) || !e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const entrada: EntradaCaricatura = {};
    if (typeof o.url === 'string' && /^https:\/\//.test(o.url)) entrada.url = o.url;
    if (entrada.url && Number.isInteger(o.lado) && (o.lado as number) > 0) entrada.lado = o.lado as number;
    if (fotoEsNuestra(o.foto as string)) entrada.foto = o.foto as string;
    if (fecha(o.desde)) entrada.desde = o.desde;
    if (entrada.foto) {
      if (Number.isInteger(o.fallos) && (o.fallos as number) > 0) entrada.fallos = o.fallos as number;
      if (fecha(o.ultimoFallo)) entrada.ultimoFallo = o.ultimoFallo;
      const m = motivoLimpio(o.motivo as string);
      if (m) entrada.motivo = m;
    }
    if (entrada.url || entrada.foto) out[k] = entrada;
  }
  return out;
}

/** La caricatura lista de cada competidor, para dibujar la tarjeta. */
export function caricaturasListas(r: RegistroCaricaturas): Map<number, string> {
  return new Map(Object.entries(r).filter(([, e]) => e.url).map(([k, e]) => [Number(k), e.url as string]));
}

/**
 * La imagen de la tarjeta: la caricatura que se hizo, la de un referente, o su foto. Nunca un cartel ni un spinner:
 * sin la caricatura, la tarjeta muestra su foto y nada más.
 */
export const caraDeTarjeta = (c: { caricatura?: string | null; avatar?: string | null }, dibujo: string | null): string | null =>
  c.caricatura || dibujo || c.avatar || null;

/** Lo que identifica a una persona en una red, para no generar dos veces la misma cara. */
export type CuentaCompetidor = { instagram?: string | null; youtube_id?: string | null; tiktok?: string | null };

/** Sus cuentas, comparables: `instagram:den.borgg`, `youtube:@denborg`, `tiktok:denborg`. */
export function cuentasDe(c: CuentaCompetidor): string[] {
  const out: string[] = [];
  const ig = String(c.instagram ?? '').trim().replace(/^@/, '').toLowerCase();
  const yt = String(c.youtube_id ?? '').trim();
  const tt = String(c.tiktok ?? '').trim().replace(/^@/, '').toLowerCase();
  if (ig) out.push(`instagram:${ig}`);
  // Un id de canal (UC…) distingue mayúsculas; un @ no.
  if (yt) out.push(`youtube:${yt.startsWith('@') ? yt.toLowerCase() : yt}`);
  if (tt) out.push(`tiktok:${tt}`);
  return out;
}

/** El nombre de archivo de su caricatura en el Storage: por su cuenta, para que la usen todos los negocios. */
export const refDeCuenta = (cuenta: string): string => cuenta.replace(':', '-');

/** El estado de UN competidor en la cola. */
export type EstadoCola = 'lista' | 'pendiente' | 'esperando' | 'rendida' | 'fuera';

/**
 * Dónde está la caricatura de un competidor. `fuera`: no entra a la cola (es un referente, o no tiene su foto en
 * nuestro Storage). Sin entrada todavía y con foto nuestra, está pendiente: así entran también los competidores que
 * se agregaron antes de la cola.
 */
export function estadoEnCola(
  e: EntradaCaricatura | undefined,
  c: { avatar?: string | null; referente: boolean },
  ahora: number,
): EstadoCola {
  if (e?.url) return 'lista';
  if (c.referente) return 'fuera';
  if (!fotoEsNuestra(e?.foto ?? c.avatar)) return 'fuera';
  if ((e?.fallos ?? 0) >= FALLOS_HASTA_RENDIRSE) return 'rendida';
  if (e?.ultimoFallo && ahora - Date.parse(e.ultimoFallo) < ESPERA_TRAS_FALLO_MS) return 'esperando';
  return 'pendiente';
}

/** Un competidor de un negocio, como lo ve la cola. */
export type CompetidorCola = CuentaCompetidor & { ws: number; id: number; avatar: string | null; referente: boolean };

/** Lo que lee el Runner: SÓLO ws, id y la URL de la foto (nuestra). Sin nombre ni nada traído de afuera. */
export type ItemCola = { ws: number; id: number; foto: string };
export type ItemRendido = ItemCola & { fallos: number; motivo?: string };

/**
 * La cola de todos los negocios. Una caricatura por PERSONA: los competidores que comparten una cuenta (misma red y
 * mismo usuario) son un grupo, y el grupo se lista una vez. Si alguien del grupo ya la tiene, no se lista (la toma el
 * resto al leerse); si alguien del grupo falló hace menos de un día o se rindió, el grupo espera o se rinde entero —
 * si no, un fallo en un negocio se reintentaría en cadena por el del lado.
 */
export function colaDeCaricaturas(
  competidores: readonly CompetidorCola[],
  registros: ReadonlyMap<number, RegistroCaricaturas>,
  ahora: number,
): { pendientes: ItemCola[]; rendidas: ItemRendido[]; masVieja: string | null } {
  // Agrupar por cuentas compartidas (unión de conjuntos: A comparte Instagram con B, y B YouTube con C → un grupo).
  const padre = new Map<number, number>();
  const raiz = (i: number): number => { let r = i; while (padre.get(r) !== r) r = padre.get(r) as number; return r; };
  const porCuenta = new Map<string, number>();
  competidores.forEach((c, i) => {
    padre.set(i, i);
    for (const k of cuentasDe(c)) {
      const j = porCuenta.get(k);
      if (j == null) porCuenta.set(k, i);
      else padre.set(raiz(i), raiz(j));
    }
  });
  const grupos = new Map<number, number[]>();
  competidores.forEach((_, i) => { const r = raiz(i); grupos.set(r, [...(grupos.get(r) ?? []), i]); });

  const pendientes: ItemCola[] = [];
  const rendidas: ItemRendido[] = [];
  // Desde cuándo espera la pendiente más vieja: si crece, el Runner no está generando (por ejemplo, corre en una cuenta
  // de Claude sin Canva). Es una fecha nuestra, para el super admin: en la pantalla no se dice nada.
  let masVieja: string | null = null;
  for (const miembros of grupos.values()) {
    const vistos = miembros.map((i) => {
      const c = competidores[i];
      const e = registros.get(c.ws)?.[String(c.id)];
      return { c, e, estado: estadoEnCola(e, c, ahora) };
    }).filter((x) => x.estado !== 'fuera');
    if (!vistos.length || vistos.some((x) => x.estado === 'lista')) continue;
    const rendido = vistos.find((x) => x.estado === 'rendida');
    if (rendido) {
      rendidas.push({ ws: rendido.c.ws, id: rendido.c.id, foto: (rendido.e?.foto ?? rendido.c.avatar) as string, fallos: rendido.e?.fallos ?? FALLOS_HASTA_RENDIRSE, ...(rendido.e?.motivo ? { motivo: rendido.e.motivo } : {}) });
      continue;
    }
    if (vistos.some((x) => x.estado === 'esperando')) continue;
    // ⚠️ EL QUE YA FALLÓ PRIMERO, después el que entró antes a la cola (sin entrada todavía, al final), y si empatan, el
    // negocio y el id más chicos. Con otro orden, el Runner le volvería a pedir la misma persona al competidor del
    // negocio del lado, que arranca en cero fallos: tres intentos por negocio en vez de tres por persona.
    const desde = (x: (typeof vistos)[number]) => Date.parse(x.e?.desde ?? '') || Number.POSITIVE_INFINITY;
    const [primero] = vistos.slice().sort((a, b) =>
      (b.e?.fallos ?? 0) - (a.e?.fallos ?? 0) || desde(a) - desde(b) || a.c.ws - b.c.ws || a.c.id - b.c.id);
    pendientes.push({ ws: primero.c.ws, id: primero.c.id, foto: (primero.e?.foto ?? primero.c.avatar) as string });
    for (const x of vistos) if (x.e?.desde && (!masVieja || x.e.desde < masVieja)) masVieja = x.e.desde;
  }
  pendientes.sort((a, b) => a.ws - b.ws || a.id - b.id);
  rendidas.sort((a, b) => a.ws - b.ws || a.id - b.id);
  return { pendientes, rendidas, masVieja };
}

/**
 * Los competidores (de cualquier negocio) que son la MISMA persona que éste, él incluido: comparten alguna cuenta,
 * directa o encadenada (A y B comparten Instagram, B y C YouTube). El mismo grupo que arma `colaDeCaricaturas`.
 */
export function mismaPersona(c: CuentaCompetidor, todos: readonly CompetidorCola[]): CompetidorCola[] {
  const cuentas = new Set(cuentasDe(c));
  if (!cuentas.size) return [];
  const dentro = new Set<number>();
  for (let crecio = true; crecio;) {
    crecio = false;
    todos.forEach((o, i) => {
      if (dentro.has(i)) return;
      const suyas = cuentasDe(o);
      if (!suyas.some((k) => cuentas.has(k))) return;
      dentro.add(i);
      for (const k of suyas) cuentas.add(k);
      crecio = true;
    });
  }
  return todos.filter((_, i) => dentro.has(i));
}
