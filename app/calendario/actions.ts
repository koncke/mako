'use server';

// =============================================================================
// Server actions del Calendario — lo PROPIO (`calendario_eventos`) y, desde el 14/10/2026, lo de Google
// =============================================================================
// ⚠️ TODAS EMPIEZAN CON EL GUARD DE LA PÁGINA: una server action es la API de esta pantalla, y esconder la tab no
//    impide invocarla. El aislamiento entre negocios lo pone `getTenantDb()` abajo (la tabla está en TENANT_TABLES).
// ⚠️ La zona es la del NEGOCIO, resuelta en el server: lo que manda el navegador es la fecha y la hora de pared.
// ⚠️ Un archivo `'use server'` sólo exporta funciones async: los tipos de entrada viven en lib/calendario-modelo.ts.

import { revalidatePath } from 'next/cache';
import { requireRolWs } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import {
  crearEventos, cambiarEvento, marcarEvento, borrarEvento, restaurarEvento, zonaDelCalendario, BloqueadaEnLaRed, type EventoBorrado,
} from '@/lib/calendario';
import type { EntradaEvento } from '@/lib/calendario-modelo';
import { crearEventoGoogle, cambiarEventoGoogle, borrarEventoGoogle, restaurarEventoGoogle, type ResultadoEscrituraGoogle } from '@/lib/calendario-google';
import type { EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { linkDeAgenda, type LinkDeAgenda } from '@/lib/agenda-link';
import {
  cancelarPublicacion, cuentasParaPublicar, FALTA_MIGRACION_PUBLICAR, guardarPublicacion, leerPublicaciones, listasParaProgramar, noQuedoProgramada,
  programadaConOtraClave, programarPublicaciones, releerPublicaciones, resolverEnZernio, subidaDelArchivo, type ResultadoProgramar,
} from '@/lib/calendario-publicar';
import type { DatosPublicacion } from '@/lib/calendario-publicar-reglas';
import { publicacionDesdeCrear } from '@/lib/calendario-desde-crear';
import { guardarRepeticion, repeticionDelEvento } from '@/lib/calendario-recurrentes';
import { hoyEnWorkspace } from '@/lib/timezone';
import { wsObligatorio } from '@/lib/workspace';
import { canalKeyDe } from '@/lib/api-mako/canal';
import type { Ctx } from '@/lib/api-mako/tipos';
import { emailDelEvento, ejecutarEnlace, prepararEnlace, reprogramarSiEnlazado, soltarEnlace, type EmailDelEvento } from '@/lib/calendario-email';

const guard = () => requireRolWs([], { nav: 'calendario' });

/** Quien programa un email desde el modal: el admin de esta pantalla (las reglas de `programar_broadcast` corren con él). */
async function ctxDeLaPantalla(): Promise<Ctx> {
  const ws = await wsObligatorio();
  const quien = await autor();
  return { ws, canal: 'app', canalKey: canalKeyDe('app', `calendario:${quien ?? 'admin'}`), alcance: 'ejecutar', rol: 'admin', actor: `${quien ?? 'Admin'} · Calendario` };
}

async function autor(): Promise<string | null> {
  try { const s = await getUsuarioActual(); return s?.email ?? s?.sub ?? null; } catch { return null; }
}

/** Crea uno o varios eventos (uno a mano o una plantilla). */
export async function crearEventosAction(entradas: EntradaEvento[], origen: 'user' | 'plantilla'): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  await guard();
  const o = origen === 'plantilla' ? origen : 'user';
  try {
    const r = await crearEventos(Array.isArray(entradas) ? entradas : [], await zonaDelCalendario(), { origen: o, autor: await autor() });
    if (r.ok) {
      // «Tu primera semana» (el onboarding de la tab) se cierra al agendar algo. Que falle la marca no tumba lo agendado.
      try { const t = await getEstadoTab('calendario'); if (!t.steps.cal_semana?.done) await marcarPasoTab('calendario', 'cal_semana'); } catch { /* la marca se reintenta en el próximo */ }
      revalidatePath('/calendario');
    }
    return r;
  } catch (e) {
    console.error('[calendario] crear:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

export async function cambiarEventoAction(id: string, entrada: EntradaEvento): Promise<{ ok: true; aviso?: string } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await cambiarEvento(String(id), entrada, await zonaDelCalendario());
    if (!r.ok) return r;
    // Un Email enlazado se mueve con su evento (6/11/2026, lib/calendario-email.ts). Que falle no deshace el cambio del evento:
    // se dice qué pasó con el email.
    const aviso = await reprogramarSiEnlazado(String(id), await ctxDeLaPantalla()).catch((e) => `No pude mover el email enlazado: ${e instanceof Error ? e.message : String(e)}`);
    revalidatePath('/calendario');
    return aviso ? { ok: true, aviso } : { ok: true };
  } catch (e) {
    console.error('[calendario] cambiar:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

export async function marcarEventoAction(id: string, hecho: boolean): Promise<boolean | { error: string }> {
  await guard();
  const ok = await marcarEvento(String(id), !!hecho);
  // Uno que espera a Zernio no se tilda acá (la verificación del 28/10): se dice por qué, según su estado, no se traga.
  if (typeof ok === 'object') return { error: ok.bloqueo };
  if (ok) revalidatePath('/calendario');
  return ok;
}

/** Borra y devuelve lo que borró: el «Deshacer» del toast lo vuelve a poner con el MISMO id. */
export async function borrarEventoAction(id: string): Promise<EventoBorrado | null | { error: string }> {
  await guard();
  try {
    const b = await borrarEvento(String(id));
    revalidatePath('/calendario');
    return b;
  } catch (e) {
    // El motivo de uno programado llega a la persona (antes el toast decía «No se pudo borrar» y nada más).
    if (e instanceof BloqueadaEnLaRed) return { error: e.message };
    throw e;
  }
}

export async function restaurarEventoAction(b: EventoBorrado): Promise<void> {
  await guard();
  await restaurarEvento(b);
  revalidatePath('/calendario');
}

// ── Google (14/10/2026, decisión de Martín: lo que se crea, mueve o borra desde MaKo se escribe en Google) ─────────
// Las escrituras van a lib/calendario-google.ts, que valida el calendario (existe en la cuenta y se puede editar) y
// el permiso del token antes de pegarle a Google. Nada de esto pasa por la IA.

const textoCorto = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');

export async function crearEventoGoogleAction(calendarioId: string, entrada: EntradaEventoGoogle): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await crearEventoGoogle(textoCorto(calendarioId, 300), entrada, await zonaDelCalendario());
  if (r.ok) revalidatePath('/calendario');
  return r;
}

export async function cambiarEventoGoogleAction(calendarioId: string, eventoId: string, entrada: EntradaEventoGoogle, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await cambiarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300), entrada, await zonaDelCalendario(), !!avisar);
  if (r.ok) revalidatePath('/calendario');
  return r;
}

/** Borra en Google. El «Deshacer» llama a `restaurarEventoGoogleAction` con el MISMO id. */
export async function borrarEventoGoogleAction(calendarioId: string, eventoId: string, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await borrarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300), !!avisar);
  if (r.ok) revalidatePath('/calendario');
  return r;
}

export async function restaurarEventoGoogleAction(calendarioId: string, eventoId: string): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await restaurarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300));
  if (r.ok) revalidatePath('/calendario');
  return r;
}

// ── Agendar una llamada (14/10/2026, Martín: «agregar el calendly o cal, para agendar llamadas») ──────────────────
// Devuelve el link de la página de reserva del negocio (lib/agenda-link.ts): Calendly o Cal.com, nunca el de otro. La
// reserva la hace una persona en esa página y entra al CRM por el webhook; el Calendario la lee de ahí (capa Llamadas).

export async function linkDeAgendaAction(cual: 'R1' | 'R2'): Promise<LinkDeAgenda> {
  await guard();
  try {
    return await linkDeAgenda(cual === 'R2' ? 'R2' : 'R1');
  } catch (e) {
    console.error('[calendario] link de agenda:', e instanceof Error ? e.message : e);
    return { ok: false, motivo: 'No pude leer tus integraciones.', faltan: [] };
  }
}

// ── Publicar en las redes (28/10/2026, Martín a Teo: «publicás reels e historias desde el Calendar los días y a la hora que
// elijas») ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Una Publicación del Calendario se programa en la red por Zernio (lib/calendario-publicar.ts). El archivo lo sube el
// navegador a una URL firmada que arma el server; programar escribe AFUERA y la pantalla lo confirma antes.

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const idDe = (x: unknown) => (typeof x === 'string' ? x.slice(0, 40) : '');

/** La publicación de un evento y las cuentas donde se puede publicar. `datos: null` = la base no tiene la mig 0342. */
export async function publicacionAction(id: string): Promise<{ datos: DatosPublicacion | null; cuentas: Awaited<ReturnType<typeof cuentasParaPublicar>>; otraClave: boolean }> {
  await guard();
  const [m, cuentas] = await Promise.all([leerPublicaciones([idDe(id)]), cuentasParaPublicar()]);
  const datos = m.get(idDe(id)) ?? null;
  // Una programada con OTRA clave de Zernio no se cancela ni se relee desde acá: la pantalla ofrece «Ya lo resolví en Zernio».
  return { datos, cuentas, otraClave: await programadaConOtraClave(datos) };
}

export async function guardarPublicacionAction(id: string, cambio: { red?: string | null; cuentaRed?: string | null; texto?: string; archivo?: string | null; archivoTipo?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const c = cambio && typeof cambio === 'object' ? cambio : {};
    const r = await guardarPublicacion(idDe(id), {
      ...(c.red !== undefined ? { red: typeof c.red === 'string' ? c.red : null } : {}),
      ...(c.cuentaRed !== undefined ? { cuentaRed: typeof c.cuentaRed === 'string' ? c.cuentaRed : null } : {}),
      ...(c.texto !== undefined ? { texto: typeof c.texto === 'string' ? c.texto : '' } : {}),
      ...(c.archivo !== undefined ? { archivo: typeof c.archivo === 'string' ? c.archivo : null, archivoTipo: typeof c.archivoTipo === 'string' ? c.archivoTipo : null } : {}),
    });
    if (r.ok) revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] guardar publicación:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

/**
 * «Publicar» desde el Video Editor, el Image Editor o el Copywriter (29/10/2026): arma la Publicación (mañana a las 10:00, con el
 * texto) y, si trae archivo, la subida firmada de SIEMPRE (`subidaDelArchivo`). No programa nada: la red, el día y la hora se
 * eligen en el Calendario (lib/calendario-desde-crear.ts). Con el guard del Calendario: quien no lo ve, no publica desde un editor.
 */
export async function publicacionDesdeCrearAction(p: { origen: string; titulo?: string | null; texto?: string | null; mime?: string | null }): Promise<
  | { ok: true; id: string; fecha: string; subida: { ruta: string; url: string; apikey: string | null; tipo: 'image' | 'video' } | null }
  | { ok: false; error: string }
> {
  await guard();
  try {
    const q = p && typeof p === 'object' ? p : { origen: '' };
    const armada = publicacionDesdeCrear({
      origen: q.origen, titulo: typeof q.titulo === 'string' ? q.titulo : null, texto: typeof q.texto === 'string' ? q.texto.slice(0, 20_000) : null,
      mime: typeof q.mime === 'string' ? q.mime.slice(0, 60) : null, hoy: await hoyEnWorkspace(),
    });
    if (!armada.ok) return armada;
    const { entrada, texto } = armada.publicacion;
    const creado = await crearEventos([entrada], await zonaDelCalendario(), { origen: 'user', autor: await autor() });
    if (!creado.ok) return creado;
    const id = creado.ids[0];
    if (texto) {
      const g = await guardarPublicacion(id, { texto });
      if (!g.ok) return g;
    }
    let subida = null;
    if (q.origen !== 'texto') {
      const s = await subidaDelArchivo(id, typeof q.mime === 'string' ? q.mime : '');
      if (!s.ok) return s;
      subida = { ruta: s.ruta, url: s.url, apikey: s.apikey, tipo: s.tipo };
    }
    revalidatePath('/calendario');
    return { ok: true, id, fecha: entrada.fecha, subida };
  } catch (e) {
    console.error('[calendario] publicar desde Create:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo llevar al Calendario.' };
  }
}

/** La regla de una Publicación que se repite (29/10/2026, mig 0349). `disponible: false` = la base todavía no la tiene. */
export async function repeticionAction(id: string): Promise<{ regla: string | null; disponible: boolean; serieHref: string | null }> {
  await guard();
  try { return await repeticionDelEvento(idDe(id)); } catch (e) {
    console.error('[calendario] repetición:', e instanceof Error ? e.message : e);
    return { regla: null, disponible: false, serieHref: null };
  }
}

/** Pone o saca la regla (null = deja de repetirse; lo que ya nació y está programado, queda). */
export async function guardarRepeticionAction(id: string, regla: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await guardarRepeticion(idDe(id), typeof regla === 'string' ? regla.slice(0, 200) : null);
    if (r.ok) revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] guardar repetición:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

/** La URL firmada para SUBIR el archivo de una publicación (la ruta la arma el server). */
export async function subidaArchivoAction(id: string, mime: string): Promise<Awaited<ReturnType<typeof subidaDelArchivo>>> {
  await guard();
  try {
    return await subidaDelArchivo(idDe(id), typeof mime === 'string' ? mime.slice(0, 60) : '');
  } catch (e) {
    console.error('[calendario] subida:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo preparar la subida.' };
  }
}

/** Programa en la red una o varias publicaciones (en serie). Escribe AFUERA: la pantalla lo confirma antes. */
export async function programarAction(ids: string[]): Promise<ResultadoProgramar | { error: string }> {
  await guard();
  try {
    const r = await programarPublicaciones((Array.isArray(ids) ? ids : []).map(idDe).filter(Boolean));
    revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] programar:', e instanceof Error ? e.message : e);
    return { error: 'No se pudo programar.' };
  }
}

/** Las publicaciones listas (con cuenta y archivo, sin programar) entre dos días: lo que «Programar las listas» ofrece. */
export async function listasParaProgramarAction(desde: string, hasta: string): Promise<string[] | { error: string }> {
  await guard();
  if (!FECHA_RE.test(String(desde)) || !FECHA_RE.test(String(hasta)) || hasta < desde) return { error: 'Las fechas no son válidas.' };
  try {
    const r = await listasParaProgramar(desde, hasta, await zonaDelCalendario());
    return r === 'sin-migracion' ? { error: FALTA_MIGRACION_PUBLICAR } : r;
  } catch (e) {
    console.error('[calendario] listas:', e instanceof Error ? e.message : e);
    return { error: 'No pude leer las publicaciones.' };
  }
}

export async function cancelarPublicacionAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await cancelarPublicacion(idDe(id));
    if (r.ok) revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] cancelar publicación:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo cancelar.' };
  }
}

/** «No quedó programada»: la persona revisó en Zernio una publicación en duda y no está. Vuelve a poder programarse. */
export async function noQuedoProgramadaAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  const r = await noQuedoProgramada(idDe(id));
  if (r.ok) revalidatePath('/calendario');
  return r;
}

/** «Ya lo resolví en Zernio»: una en duda que sí quedó, o una programada con otra clave. MaKo deja de seguirla. */
export async function resolverEnZernioAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await resolverEnZernio(idDe(id));
    if (r.ok) revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] resolver en Zernio:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

/** Relee en Zernio lo programado cuya hora ya pasó (al abrir el Calendario). Devuelve cuántas cambiaron. */
export async function releerPublicacionesAction(): Promise<number> {
  await guard();
  try {
    const n = await releerPublicaciones();
    if (n > 0) revalidatePath('/calendario');
    return n;
  } catch {
    return 0;
  }
}

// ── El Email del Calendario, enlazado a Email Marketing (6/11/2026, lib/calendario-email.ts) ─────────────────────────────

export async function emailDelEventoAction(id: string): Promise<EmailDelEvento> {
  await guard();
  try { return await emailDelEvento(String(id)); }
  catch (e) { console.error('[calendario] email del evento:', e instanceof Error ? e.message : e); return { ok: false, error: 'No pude leer el email de este evento.' }; }
}

/** Lo que va a pasar al enlazarlo (el segmento, cuántos, a qué hora sale), sin tocar nada. */
export async function revisarEmailAction(id: string, broadcastId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  await guard();
  try {
    const p = await prepararEnlace(String(id), Number(broadcastId), await ctxDeLaPantalla());
    return 'error' in p ? { ok: false, error: p.error } : { ok: true, resumen: p.resumen };
  } catch (e) { console.error('[calendario] revisar email:', e instanceof Error ? e.message : e); return { ok: false, error: 'No pude revisar el email.' }; }
}

/** Enlaza y programa. Vuelve a revisar todo antes de escribir. */
export async function enlazarEmailAction(id: string, broadcastId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  await guard();
  try {
    const ctx = await ctxDeLaPantalla();
    const p = await prepararEnlace(String(id), Number(broadcastId), ctx);
    if ('error' in p) return { ok: false, error: p.error };
    const r = await ejecutarEnlace(p.payload, ctx);
    revalidatePath('/calendario');
    return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.resumen };
  } catch (e) { console.error('[calendario] enlazar email:', e instanceof Error ? e.message : e); return { ok: false, error: 'No se pudo programar el email.' }; }
}

export async function soltarEmailAction(id: string): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await soltarEnlace(String(id), await ctxDeLaPantalla());
    revalidatePath('/calendario');
    return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.resumen };
  } catch (e) { console.error('[calendario] soltar email:', e instanceof Error ? e.message : e); return { ok: false, error: 'No se pudo soltar el email.' }; }
}
