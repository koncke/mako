// =============================================================================
// lead-magnets/server — lo que hace la tab Lead Magnet Generator (y su área de la API de MaKo)
// =============================================================================
// La tab no tiene datos propios: un lead magnet es una fila de la lista de siempre (`mako.entregable`, lib/entregable.ts: la
// que leen las secuencias, el Second Brain y las variables `{{negocio_lead_magnet}}`), y su pieza vive en su herramienta.
//   · armar: crea la pieza con la plantilla (una página del Copywriter con su estructura, o una landing del Web Generator) y la
//     suma a la lista con `pieza` y `plantilla`. La pieza PRIMERO: si sumarla falla, la pieza existe y se dice dónde;
//   · captar: crea su landing de captura (el objetivo «Lead magnet / descarga»), con el nombre puesto, el formulario llevando a
//     la página de gracias y su botón al link del lead magnet. El formulario entra al CRM (el Pixel → /api/track/optin);
//   · compartir: el link PÚBLICO de solo lectura de una página del Copywriter (`/compartido/<token>`, recurso `lead-magnet`),
//     que queda como su `enlace`. No sale con una guía de la plantilla adentro: la vería el lead.
// Toda escritura a la lista es un compare-and-set sobre lo leído ESTRICTO (`getEntregablesEstricto`): con una lectura caída no
// se escribe, y dos pestañas no se pisan.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { cambiarSettingSi } from '../settings';
import { getEntregablesEstricto, CLAVE_ENTREGABLES, type Entregable } from '../entregable';
import { crear as crearPaginaCopy, abrir as abrirPaginaCopy } from '../copywriter/server';
import * as landings from '../editor-landing/server';
import { pedidoDeCrear } from '../api-mako/areas/landing-editor.helpers';
import { crearShare, leerTokenShare, listarShares } from '../shares';
import { RECURSO_LEAD_MAGNET } from '../share-nombre';
import { APP_BASE_URL, urlPublicaLanding } from '../app-url';
import { wsObligatorio } from '../workspace';
import { plantillaLeadMagnet, nombreInicial, NOMBRE_HERRAMIENTA, type PlantillaLeadMagnet } from './plantillas';
import { esqueletoLeadMagnet, guiasQueQuedan, tieneContenidoPropio } from './esqueleto';
import { personalizarLanding } from './landing';
import { rutaDePieza, type PiezaLM } from './pieza';

export type Falla = { ok: false; error: string; status: number };
const falla = (status: number, error: string): Falla => ({ ok: false, error, status });
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** El diseño con que nacen las landings de la tab: sin video para la descarga (Minimal), con video para la clase. */
export const DISENO_DESCARGA = 'minimal';
export const DISENO_CLASE = 'claro-clasico';

/** La lista de lead magnets, ESTRICTA: «no pude leerla» no es «no tienes ninguno». */
export async function listarLeadMagnets(): Promise<{ ok: true; lista: Entregable[] } | Falla> {
  try {
    return { ok: true, lista: (await getEntregablesEstricto()).lista };
  } catch (e) {
    return falla(503, `No pude leer tus lead magnets (${mensaje(e)}).`);
  }
}

/**
 * Cambia la lista con un compare-and-set: lee estricto, aplica `cambio` y escribe sólo si nadie la tocó en el medio. Tres
 * vueltas como mucho; `cambio` devuelve null si no hay nada que escribir.
 */
async function cambiarLista<T>(cambio: (lista: Entregable[]) => { lista: Entregable[]; valor: T } | null): Promise<{ ok: true; valor: T | null } | Falla> {
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let leido: { lista: Entregable[]; crudo: string | null };
    try { leido = await getEntregablesEstricto(); } catch (e) { return falla(503, `No pude leer tus lead magnets (${mensaje(e)}).`); }
    const r = cambio(leido.lista.map((e) => ({ ...e })));
    if (!r) return { ok: true, valor: null };
    try {
      if (await cambiarSettingSi(CLAVE_ENTREGABLES, leido.crudo, JSON.stringify(r.lista))) return { ok: true, valor: r.valor };
    } catch (e) {
      return falla(503, `No pude guardar la lista (${mensaje(e)}).`);
    }
  }
  return falla(409, 'Alguien cambió tus lead magnets al mismo tiempo. Vuelve a intentarlo.');
}

export type Armado = { ok: true; id: string | null; nombre: string; pieza: PiezaLM; ruta: string; aviso: string | null };

/** Crea la pieza de una plantilla en su herramienta y la suma a la lista. */
export async function armarLeadMagnet(plantillaId: unknown, nombrePedido?: string | null): Promise<Armado | Falla> {
  const pl = plantillaLeadMagnet(plantillaId);
  if (!pl) return falla(404, 'Esa plantilla no existe.');
  const nombre = nombreInicial(pl, nombrePedido);
  const creada = await crearPieza(pl, nombre);
  if (!creada.ok) return creada;
  const pieza = creada.pieza;
  const id = randomUUID();
  const nuevo: Entregable = { id, nombre, tipo: pl.tipo, queEs: '', fomo: '', pieza, plantilla: pl.id };
  const r = await cambiarLista((lista) => ({ lista: [...lista, nuevo], valor: id }));
  const ruta = rutaDePieza(pieza);
  // La pieza ya existe: si sumarla a la lista falló, se dice dónde quedó (no se borra lo que la persona ya puede abrir).
  if (!r.ok) return { ok: true, id: null, nombre, pieza, ruta, aviso: `Quedó creada en ${NOMBRE_HERRAMIENTA[pieza.herramienta]}, pero no la pude sumar a tu lista: ${r.error}` };
  return { ok: true, id, nombre, pieza, ruta, aviso: null };
}

async function crearPieza(pl: PlantillaLeadMagnet, nombre: string): Promise<{ ok: true; pieza: PiezaLM } | Falla> {
  try {
    if (pl.herramienta === 'copywriter') {
      const r = await crearPaginaCopy({ tipo: 'pagina', titulo: nombre, emoji: pl.emoji, contenido: esqueletoLeadMagnet(pl) });
      if (!r.ok) return falla(r.status ?? 500, `No pude crear la página (${r.error}).`);
      return { ok: true, pieza: { herramienta: 'copywriter', id: r.pagina.id } };
    }
    const pedido = pl.objetivoLanding ? pedidoDeCrear(DISENO_CLASE, pl.objetivoLanding, nombre) : null;
    if (!pedido?.contenido) return falla(500, 'No encontré la plantilla de la landing.');
    const contenido = personalizarLanding(pedido.contenido, { nombre });
    const r = await landings.crear({ ...pedido, contenido });
    if (!r.ok) return falla(r.status ?? 500, `No pude crear la landing (${r.error}).`);
    return { ok: true, pieza: { herramienta: 'web', id: String(r.doc.id) } };
  } catch (e) {
    return falla(500, `No pude crear la pieza (${mensaje(e)}).`);
  }
}

/** Cambia UN lead magnet de la lista (por id). `patch` devuelve null si no hay nada que cambiar (y entonces `lm` es null). */
async function cambiarUno(id: string, patch: (e: Entregable) => Entregable | null): Promise<{ ok: true; lm: Entregable | null } | Falla> {
  let noEsta = false;
  const r = await cambiarLista<Entregable>((lista) => {
    const i = lista.findIndex((e) => e.id === id);
    if (i < 0) { noEsta = true; return null; }
    const nuevo = patch(lista[i]);
    if (!nuevo) return null;
    lista[i] = nuevo;
    return { lista, valor: nuevo };
  });
  if (!r.ok) return r;
  if (noEsta) return falla(404, 'Ese lead magnet ya no está en tu lista.');
  return { ok: true, lm: r.valor };
}

async function leerUno(id: string): Promise<{ ok: true; lm: Entregable } | Falla> {
  const l = await listarLeadMagnets();
  if (!l.ok) return l;
  const lm = l.lista.find((e) => e.id === id);
  return lm ? { ok: true, lm } : falla(404, 'Ese lead magnet ya no está en tu lista.');
}

/** Crea la landing que capta un lead magnet (o devuelve la que ya tiene). */
export async function crearPaginaDeCaptura(id: string): Promise<{ ok: true; pagina: number; nueva: boolean } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  const lm = leido.lm;
  if (lm.pagina) return { ok: true, pagina: lm.pagina, nueva: false };
  // La clase grabada YA es una landing con su registro: su página de captura es ella misma.
  if (lm.pieza?.herramienta === 'web') return falla(409, 'Esta ya es una página con su formulario: ábrela en el Web Generator.');
  const pedido = pedidoDeCrear(DISENO_DESCARGA, 'lead-magnet', `${lm.nombre} (gratis)`);
  if (!pedido?.contenido) return falla(500, 'No encontré la plantilla de la landing.');
  let pagina: number;
  try {
    const contenido = personalizarLanding(pedido.contenido, { nombre: lm.nombre, enlace: lm.enlace ?? null });
    const r = await landings.crear({ ...pedido, contenido });
    if (!r.ok) return falla(r.status ?? 500, `No pude crear la landing (${r.error}).`);
    pagina = r.doc.id;
  } catch (e) {
    return falla(500, `No pude crear la landing (${mensaje(e)}).`);
  }
  const g = await cambiarUno(id, (e) => (e.pagina ? null : { ...e, pagina }));
  if (!g.ok) return falla(g.status, `La landing quedó creada (#${pagina}), pero no la pude atar al lead magnet: ${g.error}`);
  return { ok: true, pagina, nueva: true };
}

/** El link público de solo lectura de la página del Copywriter; si ya tiene uno vigente, ése. Queda como su `enlace`. */
export async function linkPublico(id: string, quien: string | null): Promise<{ ok: true; url: string; nuevo: boolean } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  const lm = leido.lm;
  if (!lm.pieza) return falla(409, 'Este lead magnet no tiene una página en MaKo: pega su link.');
  if (lm.pieza.herramienta !== 'copywriter') return falla(409, 'Las landings se publican desde el Web Generator.');
  const pagina = await abrirPaginaCopy(lm.pieza.id);
  if (!pagina.ok) return falla(pagina.status ?? 404, 'No encontré la página en Copywriting.');
  const pl = plantillaLeadMagnet(lm.plantilla);
  const quedan = pl ? guiasQueQuedan(pagina.doc.contenido, pl) : [];
  if (quedan.length) {
    const nombres = quedan.map((e) => e.charAt(0) + e.slice(1).toLowerCase()).join(', ');
    return falla(422, `Antes de compartirla, cambia la guía de: ${nombres}.`);
  }
  if (!tieneContenidoPropio(pagina.doc.contenido, pl)) return falla(422, 'Todavía está vacía: escríbela antes de compartirla.');

  let ws: number;
  try { ws = await wsObligatorio(); } catch (e) { return falla(401, mensaje(e)); }
  let url: string | null = null;
  let nuevo = false;
  try {
    for (const s of await listarShares(ws, RECURSO_LEAD_MAGNET, lm.pieza.id)) {
      if (s.revocado_at) continue;
      const token = await leerTokenShare(ws, Number(s.id));
      if (token) { url = `${APP_BASE_URL}/compartido/${token}`; break; }
    }
    if (!url) {
      const { token } = await crearShare({
        ws, recurso: RECURSO_LEAD_MAGNET, alcance: 'item', recursoId: lm.pieza.id, modo: 'link', permiso: 'ver',
        etiqueta: lm.nombre, creadoPor: quien,
      });
      url = `${APP_BASE_URL}/compartido/${token}`;
      nuevo = true;
    }
  } catch (e) {
    return falla(500, `No pude crear el link (${mensaje(e)}).`);
  }
  const link = url;
  if (lm.enlace !== link) {
    const g = await cambiarUno(id, (e) => ({ ...e, enlace: link }));
    if (!g.ok) return falla(g.status, `El link quedó creado, pero no lo pude guardar en el lead magnet: ${g.error}`);
  }
  return { ok: true, url: link, nuevo };
}

/** Cambia el link que recibe el lead (el de una landing publicada, un Drive, lo que sea): sólo http(s). Vacío lo quita. */
export async function guardarEnlace(id: string, enlaceCrudo: unknown): Promise<{ ok: true } | Falla> {
  const t = typeof enlaceCrudo === 'string' ? enlaceCrudo.trim() : '';
  let enlace: string | null = null;
  if (t) {
    try {
      const u = new URL(t);
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || t.length > 2_000) throw new Error('x');
      enlace = u.toString();
    } catch { return falla(422, 'Ese link no es válido: empieza con https://'); }
  }
  const g = await cambiarUno(id, (e) => {
    if ((e.enlace ?? null) === enlace) return null;
    const resto: Entregable = { ...e };
    delete resto.enlace;
    return enlace ? { ...resto, enlace } : resto;
  });
  return g.ok ? { ok: true } : g;
}

/** Saca un lead magnet de la lista. La pieza (la página, la landing) NO se borra: sigue en su herramienta. */
export async function quitarDeLaLista(id: string): Promise<{ ok: true } | Falla> {
  let estaba = false;
  const r = await cambiarLista<true>((lista) => {
    const resto = lista.filter((e) => e.id !== id);
    estaba = resto.length !== lista.length;
    return estaba ? { lista: resto, valor: true } : null;
  });
  if (!r.ok) return r;
  return estaba ? { ok: true } : falla(404, 'Ese lead magnet ya no está en tu lista.');
}

/** Lo pone primero de la lista: las automatizaciones mandan el link del primero (`{{negocio_lead_magnet_link}}`). */
export async function ponerPrimero(id: string): Promise<{ ok: true } | Falla> {
  let estaba = false;
  const r = await cambiarLista<true>((lista) => {
    const i = lista.findIndex((e) => e.id === id);
    estaba = i >= 0;
    if (i <= 0) return null;
    const [lm] = lista.splice(i, 1);
    return { lista: [lm, ...lista], valor: true };
  });
  if (!r.ok) return r;
  return estaba ? { ok: true } : falla(404, 'Ese lead magnet ya no está en tu lista.');
}

/** El link público de una landing publicada (para el detalle): null si todavía no se publicó o no se pudo leer. */
export async function urlDeLanding(id: number): Promise<{ titulo: string; url: string | null } | null> {
  try {
    const r = await landings.listar();
    if (!r.ok) return null;
    const l = r.docs.find((x) => x.id === id);
    if (!l) return null;
    return { titulo: l.titulo, url: l.slug && l.publicadoAt ? urlPublicaLanding(l.slug) : null };
  } catch { return null; }
}
