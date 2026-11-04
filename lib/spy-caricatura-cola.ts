// =============================================================================
// spy-caricatura-cola — la cola de caricaturas: encolar, listar, guardar y anotar un fallo (4/11/2026)
// =============================================================================
// Martín, 4/11 (por el Cerebro): «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket
// para generar esa imagen y ya con eso se pone la imagen ahí». La genera el Runner con Canva desde la PC; en la nube no
// hay Canva. Las reglas puras están en `lib/spy-caricatura-reglas.ts`.
//
// ⚠️ SIN `server-only`, A PROPÓSITO: lo usan el servidor (al leer un competidor: `encolarCaricatura`) y los dos scripts
// del Runner (`scripts/spy-caricaturas-pendientes.mjs`, `scripts/spy-caricatura-guardar.mjs`), que corren en la PC. Lo
// que habla con la base y el Storage entra por `deps`, así el test corre la cadena entera con dobles y sin red.
//
// ⚠️ UNA CARICATURA POR PERSONA, NO POR NEGOCIO: el archivo se guarda por su cuenta (`spy/caricatura/instagram-x.png`)
// y al guardarla se marca lista en todo competidor de cualquier negocio con la misma red y el mismo usuario. Lo único
// que viaja entre negocios es esa imagen: nunca el nombre, ni quién lo mira.
// =============================================================================

import {
  CLAVE_CARICATURAS, FALLOS_HASTA_RENDIRSE, LADO_MINIMO_CARICATURA, PESO_MAXIMO_CARICATURA, colaDeCaricaturas, cuentasDe,
  estadoEnCola, fotoEsNuestra, leerRegistro, medidasDeImagen, mismaPersona, motivoLimpio, refDeCuenta,
  type CompetidorCola, type EntradaCaricatura, type ItemCola, type ItemRendido, type RegistroCaricaturas,
} from './spy-caricatura-reglas';
import { rutaDeMiniatura, tipoDeImagen } from './spy-miniaturas';

export { CLAVE_CARICATURAS };

/** El registro de un negocio, como lo leyó la base: su texto crudo y con qué compararlo al escribir. */
export type Leido = { crudo: string | null; version: string | null };

/** Leer y escribir el registro de UN negocio. `cambiarSi` es compare-and-set: escribe sólo si sigue en `version`. */
export type DepsRegistro = {
  leer: (ws: number) => Promise<Leido>;
  cambiarSi: (ws: number, version: string | null, nuevo: string) => Promise<boolean>;
};

/** Escribe en el registro de un negocio sin pisar lo de otro: compare-and-set, y otra vuelta si alguien escribió. */
async function anotarEn(deps: DepsRegistro, ws: number, cambios: ReadonlyMap<number, (e: EntradaCaricatura | undefined) => EntradaCaricatura | null>): Promise<boolean> {
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const l = await deps.leer(ws);
    const r: RegistroCaricaturas = leerRegistro(l.crudo);
    let cambio = false;
    for (const [id, f] of cambios) {
      const nuevo = f(r[String(id)]);
      if (nuevo == null) continue;
      r[String(id)] = nuevo;
      cambio = true;
    }
    if (!cambio) return true;
    if (await deps.cambiarSi(ws, l.version, JSON.stringify(r))) return true;
  }
  return false;
}

// ── 1. Encolar (el servidor, al leer un competidor) ──────────────────────────────────────────────────────────────────

export type DepsEncolar = DepsRegistro & {
  /** La caricatura ya hecha de alguna de estas cuentas, en nuestro Storage (`refDeCuenta`). null = no hay. */
  hecha: (refs: string[]) => Promise<string | null>;
};

/**
 * Deja la caricatura de un competidor en la cola, con su foto ya en NUESTRO Storage. Si la misma persona ya tiene
 * caricatura (de otro negocio), la usa en el acto y no encola nada. Idempotente: lo ya encolado o listo no se toca.
 * Devuelve dónde quedó, para el log.
 */
export async function encolarCaricatura(deps: DepsEncolar, c: CompetidorCola, ahora = Date.now()): Promise<'lista' | 'pendiente' | 'sin-cambio' | 'fuera'> {
  const antes = leerRegistro((await deps.leer(c.ws)).crudo)[String(c.id)];
  const estado = estadoEnCola(antes, c, ahora);
  if (estado === 'fuera' || estado === 'lista') return estado === 'lista' ? 'sin-cambio' : 'fuera';
  // ¿Ya existe su caricatura? Se pregunta también para una que espera: la pudo haber hecho otro negocio.
  const hecha = await deps.hecha(cuentasDe(c).map(refDeCuenta)).catch(() => null);
  if (!hecha && antes?.foto) return 'sin-cambio';
  const ok = await anotarEn(deps, c.ws, new Map([[c.id, (e: EntradaCaricatura | undefined) =>
    e?.url ? null
      : hecha ? { url: hecha }
        : e?.foto ? null
          : { foto: c.avatar as string, desde: new Date(ahora).toISOString() }]]));
  if (!ok) return 'sin-cambio';
  return hecha ? 'lista' : 'pendiente';
}

// ── 2. Listar (el Runner) ────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que el Runner lee: ws, id y la URL de la foto. Y lo rendido y la más vieja, para el super admin. */
export type Cola = { pendientes: ItemCola[]; rendidas: ItemRendido[]; masVieja: string | null };

export type DepsTodos = DepsRegistro & {
  /** Todos los competidores de todos los negocios (sin nombres: sólo cuentas, foto y si es un referente). */
  todos: () => Promise<CompetidorCola[]>;
};

export async function listarCola(deps: DepsTodos, ahora = Date.now()): Promise<Cola> {
  const todos = await deps.todos();
  const registros = new Map<number, RegistroCaricaturas>();
  for (const ws of new Set(todos.map((c) => c.ws))) registros.set(ws, leerRegistro((await deps.leer(ws)).crudo));
  return colaDeCaricaturas(todos, registros, ahora);
}

// ── 3. Guardar (el Runner, con la imagen que hizo en Canva) ─────────────────────────────────────────────────────────

export type DepsGuardar = DepsTodos & {
  /** Sube a nuestro Storage y devuelve la URL pública. Tira si no pudo. */
  subir: (ruta: string, bytes: Uint8Array, mime: string) => Promise<string>;
};

export type Guardada = { ok: true; url: string; lado: number; marcadas: Array<{ ws: number; id: number }> } | { ok: false; error: string };

/**
 * Sube la caricatura de un competidor y la marca lista en él y en la misma persona de cualquier otro negocio. La ruta
 * es por su cuenta, no por negocio: la próxima vez que alguien lo agregue, `encolarCaricatura` la encuentra y no se
 * genera otra.
 */
export async function guardarCaricatura(deps: DepsGuardar, ws: number, id: number, bytes: Uint8Array, ahora = Date.now()): Promise<Guardada> {
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, error: 'No es una imagen: tiene que ser JPG, PNG o WebP.' };
  if (bytes.length > PESO_MAXIMO_CARICATURA) return { ok: false, error: 'Pesa más de 2 MB: expórtala en JPG o más chica.' };
  // Se LEE su tamaño: el conector de Canva entrega 200 × 200 aunque el original mida 1264, y no se supone ninguno.
  const m = medidasDeImagen(bytes);
  if (!m) return { ok: false, error: 'No pude leer el tamaño de la imagen.' };
  if (Math.abs(m.ancho - m.alto) > Math.max(m.ancho, m.alto) * 0.05) return { ok: false, error: `No es cuadrada (${m.ancho} × ${m.alto}): la tarjeta es cuadrada.` };
  if (Math.min(m.ancho, m.alto) < LADO_MINIMO_CARICATURA) return { ok: false, error: `Es muy chica (${m.ancho} × ${m.alto}): hace falta al menos ${LADO_MINIMO_CARICATURA} × ${LADO_MINIMO_CARICATURA}.` };
  const lado = Math.min(m.ancho, m.alto);
  const todos = await deps.todos();
  const c = todos.find((x) => x.ws === ws && x.id === id);
  if (!c) return { ok: false, error: `No existe el competidor ${id} en el negocio ${ws}.` };
  const [cuenta] = cuentasDe(c);
  if (!cuenta) return { ok: false, error: 'Ese competidor no tiene ninguna red: no hay de quién guardarla.' };
  let url: string;
  try {
    // El `?v=` hace que una caricatura rehecha se vea al instante: el archivo se sirve con caché de un año.
    url = `${await deps.subir(rutaDeMiniatura('caricatura', refDeCuenta(cuenta), tipo.ext), bytes, tipo.mime)}?v=${ahora}`;
  } catch (e) {
    return { ok: false, error: `No pude subirla al Storage: ${e instanceof Error ? e.message : String(e)}` };
  }
  const misma = mismaPersona(c, todos);
  const porWs = new Map<number, number[]>();
  for (const o of misma) porWs.set(o.ws, [...(porWs.get(o.ws) ?? []), o.id]);
  const marcadas: Array<{ ws: number; id: number }> = [];
  for (const [w, ids] of porWs) {
    // Lista es lista: se borran la foto y los fallos de la cola.
    if (await anotarEn(deps, w, new Map(ids.map((i) => [i, () => ({ url, lado })])))) ids.forEach((i) => marcadas.push({ ws: w, id: i }));
  }
  if (!marcadas.some((m) => m.ws === ws && m.id === id)) return { ok: false, error: 'La subí, pero no pude marcarla lista: vuelve a correrlo.' };
  return { ok: true, url, lado, marcadas };
}

// ── 4. Un fallo (el Runner, cuando Canva no pudo) ────────────────────────────────────────────────────────────────────

/**
 * Anota que el Runner no pudo hacerla. NO se reintenta en cadena: la próxima lista no la trae hasta el día siguiente,
 * y a los `FALLOS_HASTA_RENDIRSE` queda rendida (la lista la muestra aparte, para el super admin).
 */
export async function anotarFallo(deps: DepsTodos, ws: number, id: number, motivo: string, ahora = Date.now()): Promise<{ ok: true; fallos: number; rendida: boolean } | { ok: false; error: string }> {
  const c = (await deps.todos()).find((x) => x.ws === ws && x.id === id);
  if (!c) return { ok: false, error: `No existe el competidor ${id} en el negocio ${ws}.` };
  let fallos = 0;
  const ok = await anotarEn(deps, ws, new Map([[id, (e: EntradaCaricatura | undefined) => {
    if (e?.url) return null;
    const foto = e?.foto ?? (fotoEsNuestra(c.avatar) ? c.avatar : null);
    if (!foto) return null;
    fallos = (e?.fallos ?? 0) + 1;
    return { ...e, foto, desde: e?.desde ?? new Date(ahora).toISOString(), fallos, ultimoFallo: new Date(ahora).toISOString(), ...(motivoLimpio(motivo) ? { motivo: motivoLimpio(motivo) } : {}) };
  }]]));
  if (!ok) return { ok: false, error: 'No pude anotar el fallo: vuelve a correrlo.' };
  return { ok: true, fallos, rendida: fallos >= FALLOS_HASTA_RENDIRSE };
}
