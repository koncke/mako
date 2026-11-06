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
// Toda escritura a la lista pasa por `cambiarEntregables` (lib/entregable.ts): un compare-and-set sobre lo leído ESTRICTO, la
// misma puerta que el paso Entregable del onboarding. Con una lectura caída no se escribe, y dos pestañas no se pisan.
//
// El ORDEN de un lead magnet, y por qué cada paso exige el anterior (la revisión del 6/11/2026, docs/hallazgos-lead-magnets.md):
//   · la página de captura lleva al link en su botón de gracias: sin link, el botón quedaba en `#` y el estado decía «listo»;
//   · «Ponerlo primero» exige un link: las automatizaciones mandan el del primero, y uno sin link las dejaba sin el dato;
//   · la clase grabada es una landing: su link es el de la página publicada, y se usa con «Usar su link» (link_publico_magnet).
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { cambiarEntregables, getEntregablesEstricto, type Entregable } from '../entregable';
import { crear as crearPaginaCopy, abrir as abrirPaginaCopy } from '../copywriter/server';
import * as landings from '../editor-landing/server';
import { pedidoDeCrear } from '../api-mako/areas/landing-editor.helpers';
import { crearShare, leerTokenShare, listarShares, revocarShare } from '../shares';
import { RECURSO_LEAD_MAGNET } from '../share-nombre';
import { APP_BASE_URL, urlPublicaLanding } from '../app-url';
import { wsObligatorio } from '../workspace';
import { plantillaLeadMagnet, nombreInicial, NOMBRE_HERRAMIENTA, type PlantillaLeadMagnet } from './plantillas';
import { esqueletoLeadMagnet, guiasQueQuedan, tieneContenidoPropio } from './esqueleto';
import { enlaceParaBoton, personalizarLanding, conLinkNuevo } from './landing';
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

/** La lista, por la puerta de lib/entregable.ts (el mismo compare-and-set que el onboarding). */
const cambiarLista = cambiarEntregables;

export type Armado = { ok: true; id: string | null; nombre: string; pieza: PiezaLM; ruta: string; aviso: string | null };

/** Crea la pieza de una plantilla en su herramienta y la suma a la lista. */
export async function armarLeadMagnet(plantillaId: unknown, nombrePedido?: string | null): Promise<Armado | Falla> {
  const pl = plantillaLeadMagnet(plantillaId);
  if (!pl) return falla(404, 'Esa plantilla no existe.');
  const nombre = nombreInicial(pl, nombrePedido);
  // La lista se lee ANTES de crear la pieza: con la base caída, cada clic dejaba una página huérfana.
  const antes = await listarLeadMagnets();
  if (!antes.ok) return antes;
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

/**
 * ¿Existe la landing? true / false (se borró o está en la PAPELERA) / null (no se pudo leer). `landings.abrir` devuelve también
 * las de la papelera, sin decirlo, y una landing en la papelera no se sirve: para el lead es una página que no existe. Por eso
 * se pregunta a la lista, que trae la marca (revisión del 6/11/2026).
 */
async function existeLanding(id: number): Promise<boolean | null> {
  try {
    const r = await landings.listar();
    if (!r.ok) return null;
    const l = r.docs.find((d) => d.id === id);
    return !!l && !l.papelera;
  } catch { return null; }
}

/**
 * Crea la landing que capta un lead magnet (o devuelve la que ya tiene). Exige su link: la página de gracias lleva a él. Si la
 * que tenía se borró, crea otra. Con dos clics a la vez, la segunda landing se manda a la papelera y vuelve la que quedó atada.
 */
export async function crearPaginaDeCaptura(id: string): Promise<{ ok: true; pagina: number; nueva: boolean } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  const lm = leido.lm;
  // La clase grabada YA es una landing con su registro: su página de captura es ella misma.
  if (lm.pieza?.herramienta === 'web') return falla(409, 'Esta ya es una página con su formulario: ábrela en el Web Generator.');
  const vieja = lm.pagina ?? null;
  if (vieja) {
    const existe = await existeLanding(vieja);
    if (existe === null) return falla(503, 'No pude revisar su página: vuelve a intentarlo.');
    if (existe) return { ok: true, pagina: vieja, nueva: false };
  }
  const enlace = enlaceParaBoton(lm.enlace);
  if (!enlace) return falla(409, 'Primero dale su link: la página lleva a él.');
  const pedido = pedidoDeCrear(DISENO_DESCARGA, 'lead-magnet', `${lm.nombre} (gratis)`);
  if (!pedido?.contenido) return falla(500, 'No encontré la plantilla de la landing.');
  let pagina: number;
  try {
    const contenido = personalizarLanding(pedido.contenido, { nombre: lm.nombre, enlace });
    const r = await landings.crear({ ...pedido, contenido });
    if (!r.ok) return falla(r.status ?? 500, `No pude crear la landing (${r.error}).`);
    pagina = r.doc.id;
  } catch (e) {
    return falla(500, `No pude crear la landing (${mensaje(e)}).`);
  }
  // Se ata sólo si sigue sin página (o con la que se borró): si otro clic ganó, ésta sobra.
  const g = await cambiarUno(id, (e) => ((e.pagina ?? null) !== vieja ? null : { ...e, pagina }));
  if (!g.ok) return falla(g.status, `La landing quedó creada (#${pagina}), pero no la pude atar al lead magnet: ${g.error}`);
  if (!g.lm) {
    try { await landings.mandarAPapelera(pagina); } catch { /* queda en el Web Generator, sin atar: no rompe nada */ }
    const otra = await leerUno(id);
    if (otra.ok && otra.lm.pagina) return { ok: true, pagina: otra.lm.pagina, nueva: false };
    return falla(409, 'Alguien cambió este lead magnet al mismo tiempo. Vuelve a intentarlo.');
  }
  return { ok: true, pagina, nueva: true };
}

/**
 * ¿Se puede compartir la página del Copywriter de este lead magnet? Lo que se sabe sin escribir (la API lo pregunta en
 * `preparar`, antes del «sí»): que sea una página de Copywriting, que exista, que no tenga una guía de la plantilla y que no
 * esté vacía.
 */
export async function revisarParaCompartir(lm: Entregable): Promise<{ ok: true; piezaId: string } | Falla> {
  if (!lm.pieza) return falla(409, 'Este lead magnet no tiene una página en MaKo: pega su link.');
  if (lm.pieza.herramienta !== 'copywriter') return falla(409, 'Una landing se comparte con su link publicado.');
  const pagina = await abrirPaginaCopy(lm.pieza.id);
  if (!pagina.ok) return falla(pagina.status ?? 404, 'No encontré la página en Copywriting.');
  const pl = plantillaLeadMagnet(lm.plantilla);
  const quedan = pl ? guiasQueQuedan(pagina.doc.contenido, pl) : [];
  if (quedan.length) {
    const nombres = quedan.map((e) => e.charAt(0) + e.slice(1).toLowerCase()).join(', ');
    return falla(422, `Antes de compartirla, cambia la guía de: ${nombres}.`);
  }
  if (!tieneContenidoPropio(pagina.doc.contenido, pl)) return falla(422, 'Todavía está vacía: escríbela antes de compartirla.');
  return { ok: true, piezaId: lm.pieza.id };
}

/** ¿El link es uno de solo lectura de MaKo (`/compartido/<token>`)? */
const esLinkCompartido = (u: string | undefined): boolean => !!u && u.startsWith(`${APP_BASE_URL}/compartido/`);

/**
 * Cuando cambia el link de un lead magnet que ya tiene su página de captura, el botón de gracias de esa página pasa al link
 * nuevo (el que llevaba al viejo, o el que quedó sin destino). Devuelve si la página está publicada: la publicada es una foto,
 * y hay que volver a publicarla para que lleve el link nuevo.
 */
async function moverLinkDeLaPagina(pagina: number | undefined, viejo: string | undefined, nuevo: string | null): Promise<string | null> {
  if (!pagina) return null;
  try {
    const r = await landings.abrir(pagina);
    if (!r.ok) return null;
    const contenido = conLinkNuevo(r.doc.contenido, viejo ?? null, nuevo);
    if (!contenido) return null;
    const g = await landings.guardar({ accion: 'guardar', id: pagina, version: r.doc.version, contenido });
    if (!g.ok) return 'No pude cambiar el link en su página: cámbialo en el Web Generator.';
    if (!r.doc.publicadoAt) return null;
    return nuevo
      ? 'Su página ya lleva el link nuevo: vuelve a publicarla en el Web Generator.'
      : 'Su página ya no lleva el link: vuelve a publicarla en el Web Generator para que no mande a uno que no abre.';
  } catch { return 'No pude cambiar el link en su página: cámbialo en el Web Generator.'; }
}

/**
 * El link que recibe el lead. Para una página del Copywriter, su link público de solo lectura (si ya tiene uno vigente, ése).
 * Para la clase grabada (una landing), el de la página publicada. Queda como su `enlace`, y su página de captura lo toma.
 */
export async function linkPublico(id: string, quien: string | null): Promise<{ ok: true; url: string; nuevo: boolean; aviso: string | null } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  const lm = leido.lm;
  let url: string | null = null;
  let nuevo = false;
  if (lm.pieza?.herramienta === 'web') {
    const existe = await existeLanding(Number(lm.pieza.id));
    if (existe === null) return falla(503, 'No pude leer su página: vuelve a intentarlo.');
    if (!existe) return falla(404, 'Su página ya no está en el Web Generator (o está en la papelera).');
    const l = await landings.abrir(Number(lm.pieza.id)).catch(() => null);
    if (!l?.ok) return falla(l?.status === 404 ? 404 : 503, l?.status === 404 ? 'Su página ya no está en el Web Generator.' : 'No pude leer su página: vuelve a intentarlo.');
    if (!l.doc.slug || !l.doc.publicadoAt) return falla(409, 'Publícala primero en el Web Generator: su link es el de la página publicada.');
    url = urlPublicaLanding(l.doc.slug);
  } else {
    const rev = await revisarParaCompartir(lm);
    if (!rev.ok) return rev;
    let ws: number;
    try { ws = await wsObligatorio(); } catch (e) { return falla(401, mensaje(e)); }
    try {
      for (const s of await listarShares(ws, RECURSO_LEAD_MAGNET, rev.piezaId)) {
        if (s.revocado_at) continue;
        const token = await leerTokenShare(ws, Number(s.id));
        if (token) { url = `${APP_BASE_URL}/compartido/${token}`; break; }
      }
      if (!url) {
        const { token } = await crearShare({
          ws, recurso: RECURSO_LEAD_MAGNET, alcance: 'item', recursoId: rev.piezaId, modo: 'link', permiso: 'ver',
          etiqueta: lm.nombre, creadoPor: quien,
        });
        url = `${APP_BASE_URL}/compartido/${token}`;
        nuevo = true;
      }
    } catch (e) {
      return falla(500, `No pude crear el link (${mensaje(e)}).`);
    }
  }
  const link = url;
  let aviso: string | null = null;
  if (lm.enlace !== link) {
    const g = await cambiarUno(id, (e) => ({ ...e, enlace: link }));
    if (!g.ok) return falla(g.status, `El link quedó listo, pero no lo pude guardar en el lead magnet: ${g.error}`);
    aviso = await moverLinkDeLaPagina(lm.pagina, lm.enlace, link);
  }
  return { ok: true, url: link, nuevo, aviso };
}

/** Lo que se dice cuando una acción dejaría sin link al primero de la lista (el que mandan las automatizaciones). */
const ES_EL_PRIMERO = 'Es el primero de tu lista: las automatizaciones mandan su link. Pon otro primero, o quítalo de la lista.';

/**
 * Deja de compartir la página: el link público deja de abrirse (se revocan TODOS los de su página, también uno que ya no es su
 * link) y, si era su link, se le saca y su página de captura deja de llevar a él. A quien ya lo recibió se le deja de abrir:
 * por eso lo pide la persona, con un botón que lo dice. Al primero de la lista no se le saca el link: las automatizaciones
 * mandarían el mensaje sin él (el renglón con el dato se borra).
 */
export async function dejarDeCompartir(id: string): Promise<{ ok: true; revocados: number; aviso: string | null } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  const lm = leido.lm;
  const sacaElLink = esLinkCompartido(lm.enlace);
  if (sacaElLink) {
    const l = await listarLeadMagnets();
    if (!l.ok) return l;
    if (l.lista[0]?.id === id) return falla(409, ES_EL_PRIMERO);
  }
  const rev = await revocarShares(lm);
  if (!rev.ok) return rev;
  let aviso: string | null = null;
  if (sacaElLink) {
    let primero = false;
    const g = await cambiarLista<true>((lista) => {
      const i = lista.findIndex((e) => e.id === id);
      if (i < 0 || !esLinkCompartido(lista[i].enlace)) return null;
      if (i === 0) { primero = true; return null; }
      const resto: Entregable = { ...lista[i] };
      delete resto.enlace;
      const nueva = [...lista];
      nueva[i] = resto;
      return { lista: nueva, valor: true };
    });
    if (!g.ok) return g;
    // Pasó a ser el primero entre la lectura y la escritura: el link ya no abre, y queda dicho (no se puede dejar al primero
    // sin link, y revocar no se deshace).
    if (primero) return { ok: true, revocados: rev.revocados, aviso: 'Su link ya no abre, y es el primero de tu lista: pon otro primero o crea su link de nuevo.' };
    aviso = await moverLinkDeLaPagina(lm.pagina, lm.enlace, null);
  }
  return { ok: true, revocados: rev.revocados, aviso };
}

/** Revoca los links de solo lectura vigentes de la página del Copywriter de un lead magnet. */
async function revocarShares(lm: Entregable): Promise<{ ok: true; revocados: number } | Falla> {
  if (lm.pieza?.herramienta !== 'copywriter') return { ok: true, revocados: 0 };
  let ws: number;
  try { ws = await wsObligatorio(); } catch (e) { return falla(401, mensaje(e)); }
  let revocados = 0;
  try {
    for (const s of await listarShares(ws, RECURSO_LEAD_MAGNET, lm.pieza.id)) {
      if (s.revocado_at) continue;
      await revocarShare(ws, Number(s.id));
      revocados++;
    }
  } catch (e) {
    return falla(500, `No pude dejar de compartirla (${mensaje(e)}).`);
  }
  return { ok: true, revocados };
}

/**
 * Cuántos links de solo lectura vigentes tiene cada página del Copywriter que es un lead magnet (por id de página). La pantalla
 * ofrece «Dejar de compartir» con esto, no mirando su link: uno que se cambió por la API deja el anterior abierto. null si no se
 * pudo leer (la pantalla no ofrece lo que no sabe).
 */
export async function compartidosPorPieza(): Promise<Map<string, number> | null> {
  try {
    const ws = await wsObligatorio();
    const m = new Map<string, number>();
    for (const s of await listarShares(ws, RECURSO_LEAD_MAGNET)) {
      if (s.revocado_at || !s.recurso_id) continue;
      m.set(String(s.recurso_id), (m.get(String(s.recurso_id)) ?? 0) + 1);
    }
    return m;
  } catch { return null; }
}

/** Cambia el link que recibe el lead (el de una landing publicada, un Drive, lo que sea): sólo http(s). Vacío lo quita. */
export async function guardarEnlace(id: string, enlaceCrudo: unknown): Promise<{ ok: true; aviso?: string | null } | Falla> {
  const t = typeof enlaceCrudo === 'string' ? enlaceCrudo.trim() : '';
  let enlace: string | null = null;
  if (t) {
    try {
      const u = new URL(t);
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || t.length > 2_000) throw new Error('x');
      enlace = u.toString();
    } catch { return falla(422, 'Ese link no es válido: empieza con https://'); }
  }
  let antes: Entregable | null = null;
  let primero = false;
  let estaba = false;
  const g = await cambiarLista<true>((lista) => {
    const i = lista.findIndex((e) => e.id === id);
    estaba = i >= 0;
    if (i < 0 || (lista[i].enlace ?? null) === enlace) return null;
    // Sin link, el primero deja a las automatizaciones mandando el mensaje sin él.
    if (!enlace && i === 0) { primero = true; return null; }
    antes = lista[i];
    const resto: Entregable = { ...lista[i] };
    delete resto.enlace;
    const nueva = [...lista];
    nueva[i] = enlace ? { ...resto, enlace } : resto;
    return { lista: nueva, valor: true };
  });
  if (!g.ok) return g;
  if (!estaba) return falla(404, 'Ese lead magnet ya no está en tu lista.');
  if (primero) return falla(409, ES_EL_PRIMERO);
  const previo = antes as Entregable | null;
  const aviso = previo ? await moverLinkDeLaPagina(previo.pagina, previo.enlace, enlace) : null;
  return { ok: true, aviso };
}

/**
 * Saca un lead magnet de la lista. La pieza (la página, la landing) NO se borra: sigue en su herramienta. Su link público SÍ
 * deja de abrirse: fuera de la lista no queda pantalla que lo apague (la confirmación lo dice).
 */
export async function quitarDeLaLista(id: string): Promise<{ ok: true } | Falla> {
  const leido = await leerUno(id);
  if (!leido.ok) return leido;
  // Primero sale de la lista y DESPUÉS se revoca: al revés, una escritura que falla deja en la lista (quizás primero) un lead
  // magnet con un link que ya no abre. Si revocar falla, vuelve a su lugar: fuera de la lista no hay pantalla que lo apague.
  let quitado: { lm: Entregable; i: number } | null = null;
  const r = await cambiarLista<true>((lista) => {
    const i = lista.findIndex((e) => e.id === id);
    if (i < 0) return null;
    quitado = { lm: lista[i], i };
    return { lista: lista.filter((e) => e.id !== id), valor: true };
  });
  if (!r.ok) return r;
  const q = quitado as { lm: Entregable; i: number } | null;
  if (!q) return falla(404, 'Ese lead magnet ya no está en tu lista.');
  const rev = await revocarShares(q.lm);
  if (rev.ok) return { ok: true };
  const vuelta = await cambiarLista<true>((lista) => {
    if (lista.some((e) => e.id === id)) return null;
    const nueva = [...lista];
    nueva.splice(Math.min(q.i, nueva.length), 0, q.lm);
    return { lista: nueva, valor: true };
  });
  return falla(rev.status, vuelta.ok
    ? `No pude cortar su link público, así que lo dejé en tu lista: vuelve a intentarlo (${rev.error}).`
    : `Lo saqué de la lista, pero su link público sigue abriéndose: ${rev.error}`);
}

/** Lo pone primero de la lista: las automatizaciones mandan el link del primero (`{{negocio_lead_magnet_link}}`). */
export async function ponerPrimero(id: string): Promise<{ ok: true } | Falla> {
  let estaba = false;
  let sinLink = false;
  const r = await cambiarLista<true>((lista) => {
    const i = lista.findIndex((e) => e.id === id);
    estaba = i >= 0;
    if (i >= 0 && !lista[i].enlace) { sinLink = true; return null; }
    if (i <= 0) return null;
    const [lm] = lista.splice(i, 1);
    return { lista: [lm, ...lista], valor: true };
  });
  if (!r.ok) return r;
  if (sinLink) return falla(409, 'Primero dale su link: las automatizaciones mandan el link del primero.');
  return estaba ? { ok: true } : falla(404, 'Ese lead magnet ya no está en tu lista.');
}

/** Las landings del negocio, por id: su título y su link público si está publicada. null si no se pudieron leer. */
export async function landingsDelNegocio(): Promise<Map<number, { titulo: string; url: string | null }> | null> {
  try {
    const r = await landings.listar();
    if (!r.ok) return null;
    // Las de la papelera no cuentan: no se sirven, y una página de captura ahí es una que hay que volver a crear.
    return new Map(r.docs.filter((l) => !l.papelera).map((l) => [l.id, { titulo: l.titulo, url: l.slug && l.publicadoAt ? urlPublicaLanding(l.slug) : null }]));
  } catch { return null; }
}
