// =============================================================================
// Pedirle a la extensión de MaKo las fichas de SU WhatsApp Web (24/10/2026) — lado de la página
// =============================================================================
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». La
// extensión (extension/wa-fichas.js) lee lo que el WhatsApp Web de la persona ya guardó en su navegador, sin clics ni red. Esto
// es el pedido desde la página de MaKo: un evento con los teléfonos (sólo los de leads que ya están en su CRM), y la respuesta
// por evento con el mismo `id` (extension/mako-puente.js hace de mensajero). Sin `server-only`: lo usa un client component.
//
// ⚠️ DESDE LA 0.71.0 (25/10/2026), Martín: «La extensión no contestó... no hay ninguna acción que el usuario vea para saber que
// está corriendo bien». El worker abre WhatsApp Web si no está, lo despierta, le pone el script y espera a que cargue, y cuenta
// cada paso (`MAKO_WA_FICHAS_AVANCE`): por eso esto ya no corta a los 20 s fijos, sino cuando pasan 30 s SIN noticias.

import { esMasVieja } from './version-comparar';
import { nombreUtil, perfilLimpio, type FichaWa } from './grupo-wa-reglas';

/**
 * La versión de la extensión que pide la pantalla para leer fichas. La 0.71.0 (25/10/2026) lee el nombre donde WhatsApp Web lo
 * guarda para un `@lid` (`displayNameLID`: en el WhatsApp de Martín, 6.252 nombres contra 786 en los campos de antes), busca por
 * `@lid` y por grupo, y abre WhatsApp Web sola. Con la 0.70 se completaba una fracción: se pide actualizarla.
 */
export const VERSION_FICHAS = '0.72.0';
// ⚠️ 0.72.0 (26/10/2026), Martín: «Quiero que el scraper, con la extensión me redirija a la tab de whatsapp y se vea que está
// interactuando o buscando... Y que se despliegue la extensión y que allí se vea la animación de la extracción». Con
// `visible`, la extensión pone al frente la pestaña de WhatsApp Web que ya está, abre su desplegable con el avance y el
// registro, y RECORRE el grupo (lo que se ve en la lista de miembros suma nombres que la base no tiene). La 0.71 ignoraba
// `visible`: se pide la 0.72.

/** ¿La extensión de ESTE navegador lee fichas? 'no' = no está; 'vieja' = está, sin esto (hay que actualizarla). */
export function extensionLeeFichas(): 'si' | 'vieja' | 'no' {
  if (typeof document === 'undefined') return 'no';
  const v = document.documentElement.getAttribute('data-mako-puente');
  if (!v) return 'no';
  return esMasVieja(v, VERSION_FICHAS) ? 'vieja' : 'si';
}

export type DiagnosticoFichas = { base: boolean; stores?: string[]; contactos?: number; grupos?: number; participantes?: number; pedidos?: number; conFicha?: number };
/** Un grupo que MaKo nombró, buscado en el WhatsApp Web de la persona: si está y cuántos son (nunca quiénes). */
export type GrupoEnWhatsapp = { nombre: string; encontrado: boolean; participantes: number | null; conNombre: number | null };
export type RespuestaFichas =
  | { ok: true; fichas: unknown[]; grupos: GrupoEnWhatsapp[]; diagnostico: DiagnosticoFichas | null }
  | { ok: false; motivo: string; error?: string };

/** Un teléfono, o un teléfono con el `@lid` del lead (con él se encuentra al que WhatsApp Web no tiene por su teléfono). */
export type PedidoFichaWa = string | { telefono: string; lid: string | null };

/** Sin noticias de la extensión por este tiempo, se da por muda (cada paso que cuenta el worker lo vuelve a contar). */
export const SILENCIO_FICHAS_MS = 30_000;
/** El tope total: abrir WhatsApp Web y esperar sus chats lleva hasta ~2 min en el peor caso del worker. */
export const TOPE_FICHAS_MS = 12 * 60_000;
// (Desde la 0.72 el recorrido de un grupo grande, a la vista, lleva minutos: el tope de verdad es el silencio, y cada fila que
// baja la lista es un aviso.)
/** Un «no encontré la extensión» se espera este rato antes de creerle: puede ser el puente huérfano de una versión vieja. */
const GRACIA_EXTENSION_MS = 1500;

/**
 * Le pide a la extensión las fichas de esos teléfonos. Nunca tira. `alAvanzar` recibe cada paso que cuenta el worker
 * («Abriendo WhatsApp Web…», «Buscando el grupo «X»…»); `grupos`, los nombres de los grupos de donde vinieron los leads.
 */
export function pedirFichasDeWhatsappWeb(
  pedidos: readonly PedidoFichaWa[],
  o: {
    grupos?: readonly string[]; alAvanzar?: (texto: string, paso: string) => void; silencioMs?: number;
    /** «Extraer» a la vista (0.72.0): la pestaña de WhatsApp al frente, el desplegable y su registro, con este título. */
    visible?: boolean; titulo?: string;
    /** El id del pedido (el mismo que después cuenta `avisarExtraccion`); sin él, uno nuevo. */
    id?: string;
  } = {},
): Promise<RespuestaFichas> {
  return new Promise((resolve) => {
    const id = o.id ?? nuevoIdExtraccion();
    const silencio = o.silencioMs ?? SILENCIO_FICHAS_MS;
    let terminado = false;
    let gracia: ReturnType<typeof setTimeout> | null = null;
    const fin = (r: RespuestaFichas) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(mudo); clearTimeout(total); if (gracia) clearTimeout(gracia);
      window.removeEventListener('MAKO_WA_FICHAS', al);
      window.removeEventListener('MAKO_WA_FICHAS_AVANCE', avance);
      resolve(r);
    };
    let mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
    const total = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), TOPE_FICHAS_MS);
    const avance = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== id || terminado) return;
      // Una extensión viva contó algo: el «no encontré la extensión» que haya llegado era del puente huérfano.
      if (gracia) { clearTimeout(gracia); gracia = null; }
      clearTimeout(mudo);
      mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
      if (typeof d.texto === 'string') o.alAvanzar?.(d.texto, typeof d.paso === 'string' ? d.paso : '');
    };
    const al = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== id || terminado) return;
      const r: RespuestaFichas = d.ok === true
        ? { ok: true, fichas: Array.isArray(d.fichas) ? d.fichas : [], grupos: gruposDe(d.grupos), diagnostico: (d.diagnostico as DiagnosticoFichas) ?? null }
        : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'error', ...(typeof d.error === 'string' ? { error: d.error } : {}) };
      if (!r.ok && r.motivo === 'extension') {
        if (!gracia) gracia = setTimeout(() => fin(r), GRACIA_EXTENSION_MS);
        return;
      }
      fin(r);
    };
    window.addEventListener('MAKO_WA_FICHAS', al);
    window.addEventListener('MAKO_WA_FICHAS_AVANCE', avance);
    const telefonos = pedidos.map((p) => (typeof p === 'string' ? p : p.telefono));
    const conLid = pedidos.map((p) => (typeof p === 'string' ? { telefono: p, lid: null } : p));
    window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_PIDO', {
      detail: { id, telefonos, pedidos: conLid, grupos: [...(o.grupos ?? [])], ...(o.visible ? { visible: true, titulo: o.titulo ?? '' } : {}) },
    }));
  });
}

/** Los grupos que contestó la extensión, leídos como texto ajeno. */
function gruposDe(v: unknown): GrupoEnWhatsapp[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    if (typeof o.nombre !== 'string') return [];
    return [{
      nombre: o.nombre.slice(0, 120), encontrado: o.encontrado === true, participantes: typeof o.participantes === 'number' ? o.participantes : null,
      conNombre: typeof o.conNombre === 'number' ? o.conNombre : null,
    }];
  });
}

/** Un id para un pedido a la extensión (y su fila del registro, si es a la vista). */
export function nuevoIdExtraccion(): string {
  return `w${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

/** Lo que una extracción a la vista cuenta de su lado de MaKo: números y textos cortos (nunca nombres de nadie). */
export type AvisoExtraccion = {
  fase?: 'guardando'; estado?: 'corriendo' | 'listo' | 'error' | 'parado'; texto?: string;
  guardados?: number; total?: number; nombres?: number; empresas?: number; nuevos?: number; perfiles?: number;
};

/**
 * Le cuenta al desplegable de la extensión cómo sigue una extracción (0.72.0): «guardando N de M» y el final. Así el avance y
 * el resultado viven en la extensión y no en un aviso de MaKo (Martín, 26/10: «no me gusta que salga el cartel negro abajo y
 * el "extrayendo" arriba... quiero que todo eso salga en la extensión, en el desplegable»).
 */
export function avisarExtraccion(id: string, a: AvisoExtraccion): void {
  if (typeof window === 'undefined' || !id) return;
  window.dispatchEvent(new CustomEvent('MAKO_WA_EXTRACCION', { detail: { id, ...a } }));
}

/** El «Parar» del desplegable para ESTA extracción. Devuelve cómo dejar de escuchar. */
export function alPararExtraccion(id: string, fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const al = (ev: Event) => { if (((ev as CustomEvent).detail as { id?: unknown } | null)?.id === id) fn(); };
  window.addEventListener('MAKO_WA_PARAR', al);
  return () => window.removeEventListener('MAKO_WA_PARAR', al);
}

// ── LOS PERFILES, de a tandas (0.73.2) ──────────────────────────────────────────────────────────────────────────────────
// Martín, 26/10/2026: «podría entrar a cada perfil y fijarse si tiene links, redes sociales, email, etc...». La extensión abre
// la información de cada uno en su WhatsApp Web (extension/wa-recorrer.js `leerPerfiles`). ⚠️ De a TANDAS y pedidas desde
// acá: un solo pedido de 60 perfiles pasa los 5 minutos y Chrome mata el service worker de la extensión (medido en vivo el
// 26/10: «La extensión no contestó»). Cada tanda es un pedido corto, con el mismo id de la extracción (el desplegable la
// muestra como una sola).

/** A lo sumo, cuántos perfiles se abren por extracción (de a uno y con pausas, ~5 s cada uno), y cuántos por pedido. */
export const TOPE_PERFILES = 60;
export const TANDA_PERFILES = 12;

/** A quiénes: los pedidos, sin repetir, primero las cuentas de EMPRESA (web, correo, dirección), después los que tienen nombre. */
export function candidatosDePerfil(
  pedidos: ReadonlyArray<string | { telefono: string }>, fichas: ReadonlyArray<Partial<FichaWa> & { telefono: string }>,
): Array<{ telefono: string; nombre: string | null }> {
  const suf = (t: string) => t.replace(/\D/g, '').slice(-10);
  const porTel = new Map(fichas.map((f) => [suf(f.telefono), f]));
  const vistos = new Set<string>();
  const out: Array<{ telefono: string; nombre: string | null; orden: number }> = [];
  for (const p of pedidos) {
    const tel = (typeof p === 'string' ? p : p.telefono).replace(/\D/g, '');
    if (tel.length < 8 || vistos.has(suf(tel))) continue;
    vistos.add(suf(tel));
    const f = porTel.get(suf(tel));
    const nombre = f ? f.agenda ?? f.empresa ?? f.pushname ?? null : null;
    // Las empresas primero (web, correo, dirección), después los que NO tienen nombre (la fila del buscador lo dice: lo de
    // Leandro), al final los que ya lo tienen.
    out.push({ telefono: tel, nombre, orden: f?.esEmpresa ? 0 : nombre ? 2 : 1 });
  }
  return out.sort((a, b) => a.orden - b.orden).map(({ telefono, nombre }) => ({ telefono, nombre }));
}

/** Los perfiles que leyó la extensión (no confiables: `perfilLimpio`), sumados a su ficha por los últimos 10; sin ficha, la gana. */
export function sumarPerfiles(fichas: readonly FichaWa[], perfiles: unknown): FichaWa[] {
  const suf = (t: string) => t.replace(/\D/g, '').slice(-10);
  const out = fichas.map((f) => ({ ...f }));
  const porTel = new Map(out.map((f) => [suf(f.telefono), f]));
  for (const x of Array.isArray(perfiles) ? perfiles : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const tel = String(o.telefono ?? '').replace(/\D/g, '');
    const perfil = perfilLimpio(o.perfil);
    // El nombre que mostró la fila al buscarlo (0.73.8): el de la agenda o el que la persona se puso. Sólo donde no hay.
    const nf = (o.nombre ?? {}) as Record<string, unknown>;
    const agenda = nombreUtil(nf.agenda);
    const pushname = nombreUtil(nf.pushname);
    if (tel.length < 8 || tel.length > 15 || (!perfil && !agenda && !pushname)) continue;
    let f = porTel.get(suf(tel));
    if (!f) { f = { telefono: tel, agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: [] }; out.push(f); porTel.set(suf(tel), f); }
    if (perfil) f.perfil = perfil;
    if (!f.agenda && !f.pushname && !f.empresa) { if (agenda) f.agenda = agenda; else if (pushname) f.pushname = pushname; }
  }
  return out;
}

export type RespuestaPerfiles = { ok: true; perfiles: unknown[]; diag: Record<string, unknown> | null } | { ok: false; motivo: string };

/** UNA tanda de perfiles a la extensión. Nunca tira; contesta por el mismo canal que las fichas (`MAKO_WA_FICHAS`, con el id). */
export function pedirPerfilesDeWhatsappWeb(
  candidatos: ReadonlyArray<{ telefono: string; nombre: string | null }>,
  o: { grupo: string; id: string; desde: number; total: number; silencioMs?: number },
): Promise<RespuestaPerfiles> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve({ ok: false, motivo: 'extension' }); return; }
    let terminado = false;
    const fin = (r: RespuestaPerfiles) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(mudo);
      window.removeEventListener('MAKO_WA_FICHAS', al);
      window.removeEventListener('MAKO_WA_FICHAS_AVANCE', avance);
      resolve(r);
    };
    const silencio = o.silencioMs ?? SILENCIO_FICHAS_MS;
    let mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
    const avance = (ev: Event) => {
      if (((ev as CustomEvent).detail as { id?: unknown } | null)?.id !== o.id) return;
      clearTimeout(mudo);
      mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
    };
    const al = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== o.id) return;
      fin(d.ok === true
        ? { ok: true, perfiles: Array.isArray(d.perfiles) ? d.perfiles : [], diag: (d.diag as Record<string, unknown>) ?? null }
        : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'error' });
    };
    window.addEventListener('MAKO_WA_FICHAS', al);
    window.addEventListener('MAKO_WA_FICHAS_AVANCE', avance);
    window.dispatchEvent(new CustomEvent('MAKO_WA_PERFILES_PIDO', { detail: { id: o.id, grupo: o.grupo, candidatos: [...candidatos], desde: o.desde, total: o.total } }));
  });
}

/**
 * LOS PERFILES DE UNA EXTRACCIÓN, de a tandas: elige a quiénes (`candidatosDePerfil`, con tope), los pide de a
 * `TANDA_PERFILES` y los suma a las fichas. Para con `parar()` entre una tanda y la siguiente, y con la primera que falla
 * (dice por qué en `corte`). `pedir` se puede cambiar (los tests).
 */
export async function perfilesEnTandas(
  pedidos: ReadonlyArray<string | { telefono: string }>, fichas: readonly FichaWa[],
  o: { grupo: string; id: string; parar: () => boolean; pedir?: typeof pedirPerfilesDeWhatsappWeb; tope?: number },
): Promise<{ fichas: FichaWa[]; leidos: number; conDatos: number; corte: string | null }> {
  const pedir = o.pedir ?? pedirPerfilesDeWhatsappWeb;
  const candidatos = candidatosDePerfil(pedidos, fichas).slice(0, o.tope ?? TOPE_PERFILES);
  let out = [...fichas];
  let leidos = 0, conDatos = 0;
  let corte: string | null = null;
  for (let i = 0; i < candidatos.length; i += TANDA_PERFILES) {
    if (o.parar()) { corte = 'parado'; break; }
    const r = await pedir(candidatos.slice(i, i + TANDA_PERFILES), { grupo: o.grupo, id: o.id, desde: i, total: candidatos.length });
    if (!r.ok) { corte = r.motivo; break; }
    out = sumarPerfiles(out, r.perfiles);
    leidos += Number(r.diag?.abiertos) || 0;
    conDatos += Number(r.diag?.conDatos) || 0;
  }
  return { fichas: out, leidos, conDatos, corte };
}

/** «Ir a WhatsApp Web»: la extensión pone esa pestaña al frente, o abre una (para iniciar la sesión). */
export function enfocarWhatsappWeb(): void {
  window.dispatchEvent(new CustomEvent('MAKO_WA_ENFOCAR'));
}

/** Qué hacer, dicho, para cada motivo de la extensión. */
export function motivoDeFichas(motivo: string): string {
  switch (motivo) {
    case 'sin_whatsapp_web': return 'Abre WhatsApp Web en otra pestaña de este navegador y vuelve a tocar.';
    case 'recargar_whatsapp_web': return 'Recarga la pestaña de WhatsApp Web (la extensión se actualizó) y vuelve a tocar.';
    case 'sin_base': return 'WhatsApp Web todavía no terminó de cargar tus chats: espera un momento y vuelve a tocar.';
    // Desde la 0.72.3 la extensión espera el QR cinco minutos con la pestaña al frente: llegar acá es que no se escaneó.
    case 'sin_sesion': return 'No se escaneó el QR de WhatsApp Web: escanéalo (te dejé esa pestaña al frente) y vuelve a tocar.';
    case 'sin_respuesta_wa': return 'WhatsApp Web no contestó. Recarga esa pestaña y vuelve a tocar.';
    case 'extension': return 'No encontré la extensión de MaKo en este navegador.';
    case 'sin_respuesta': return 'La extensión no contestó. Recarga esta página y vuelve a tocar.';
    case 'ocupado': return 'WhatsApp Web todavía está terminando otra extracción: espera un minuto y vuelve a tocar.';
    case 'parado': return 'La paraste.';
    default: return 'No pude leer tu WhatsApp Web.';
  }
}

/** ¿El motivo se arregla en la pestaña de WhatsApp Web? (La pantalla ofrece «Ir a WhatsApp Web».) */
export const motivoEnWhatsapp = (motivo: string): boolean => motivo === 'sin_sesion' || motivo === 'sin_respuesta_wa' || motivo === 'sin_whatsapp_web';
