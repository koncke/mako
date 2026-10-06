// =============================================================================
// replay-leer — las grabaciones de ESTA persona, para la ficha del lead
// =============================================================================
// Dos lecturas y nada más: el ÍNDICE (`replay_sesiones`, una fila de ~200 bytes
// por sesión) y, cuando alguien abre una, el CUERPO (un objeto gzip del bucket
// privado `replays`). El cuerpo no baja nunca al dibujar la ficha: son hasta 2 MiB
// comprimidos por sesión, y la ficha se abre siempre.
//
// ⚠️ TODA LECTURA SE MIRA EL `error`, Y NO ES CELO. `replay_sesiones` no existe
// todavía —la migración 0191 está sin aplicar—, y un `select` de PostgREST contra
// una tabla que no existe devuelve `data: undefined` sin tirar: la lista queda en
// `[]` y «no hay grabación» se vuelve indistinguible de «no pude leer». Son dos
// frases distintas en la pantalla (ver `motivoDelVacio`), así que acá se
// distinguen.
//
// ⚠️ Y SE LEE CON `getTenantDb()`, que scopea `replay_sesiones` y `replay_lotes`
// por workspace (están en TENANT_TABLES, lib/workspace.ts). Sin esa línea el
// cliente es PASSTHROUGH —no «sin scope»— y la ficha de un lead listaría las
// grabaciones de los visitantes de cualquier otro cliente.
// =============================================================================

import 'server-only';
import { gunzipSync } from 'node:zlib';
import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';
import { getSetting } from './settings';
import { REPLAY_BUCKET, REPLAY_CONFIG_KEY, parsearReplay, sesionIdValido } from './replay-contrato';
import { motivoDelVacio, type ReplayEnLaFicha, type SesionDeLead } from './replay-ficha';
import { SNIPPET_VERSION_KEY } from './landing-token';

// ⚠️ LOS TIPOS QUE SALEN DE ACÁ (`ReplayEnLaFicha`, `SesionDeLead`) VIVEN EN
// `replay-ficha.ts`, que no tiene `server-only`, y NO se re-exportan desde acá a
// propósito: las dos pantallas que los dibujan son `'use client'` y tienen que
// tener UN solo lugar de donde importarlos, que no sea este archivo.

/** Tope de sesiones que se listan. Lo que se mira es lo último, no el historial. */
const TOPE_SESIONES = 20;

type FilaSesion = {
  id: string;
  inicio: string;
  segundos: number | null;
  eventos: number | null;
  corte: string | null;
  storage_path: string | null;
};

/**
 * Lo que la ficha necesita saber del replay de un lead, en UNA llamada.
 *
 * `ultimaActividadISO` lo trae quien llama: la ficha ya lo calcula para gatear el
 * link de Clarity (el último evento de tracking, o el alta del lead). No se vuelve
 * a consultar acá — y así las dos tarjetas de la misma pantalla no pueden
 * contradecirse sobre cuándo fue la última vez que esta persona entró.
 */
export async function replayDeLead(
  visitorId: string | null,
  ultimaActividadISO: string | null,
): Promise<ReplayEnLaFicha> {
  // El apagador primero: es lo único que se lee igual con o sin visitor_id, y su
  // retención es el número que la pantalla escribe en el caso «vencida».
  let leyoTodo = true;
  let crudo: string | null = null;
  try { crudo = await getSetting(REPLAY_CONFIG_KEY); } catch { leyoTodo = false; }
  const cfg = parsearReplay(crudo);

  const senales = {
    visitorId,
    leyoTodo,
    hayGrabaciones: false,
    activo: cfg.activo,
    snippetDelLead: null as number | null,
    ultimaActividadISO,
    ahoraISO: new Date().toISOString(),
    retencionDias: cfg.retencionDias,
  };

  // Sin identificador no hay a quién buscar: dos consultas que no pueden devolver
  // nada y una frase que ya está decidida.
  if (!visitorId) {
    return { sesiones: [], vacio: motivoDelVacio(senales), retencionDias: cfg.retencionDias };
  }

  const db = await getTenantDb();

  const [idx, sv] = await Promise.all([
    db.from('replay_sesiones')
      .select('id, inicio, segundos, eventos, corte, storage_path')
      .eq('visitor_id', visitorId)
      .order('inicio', { ascending: false })
      .limit(TOPE_SESIONES),
    // La versión del snippet con la que midió ESTE lead. `landing_visits.sv` existe
    // desde la mig 0135; las visitas anteriores lo traen en null, y null es «no se
    // sabe» —no «versión 0»—, así que no acusa a nadie.
    db.from('landing_visits')
      .select('sv')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (idx.error) leyoTodo = false;
  const filas = ((idx.data ?? []) as FilaSesion[]);

  // ⚠️ EL MÁXIMO DE LAS DOS FUENTES, nunca sólo la del lead: el setting del
  // workspace puede estar más adelantado si acaban de repegar el código y la visita
  // con la versión nueva todavía no llegó. Un «tenés el código viejo» sobre una
  // página recién actualizada es el mismo falso positivo, al revés.
  const svLead = sv.error
    ? null
    : ((sv.data ?? []) as Array<{ sv: number | null }>)
        .map((r) => (typeof r.sv === 'number' ? r.sv : 0))
        .reduce((a, b) => Math.max(a, b), 0);
  let svWs = 0;
  if (svLead != null) {
    try { svWs = Number(await getSetting(SNIPPET_VERSION_KEY)) || 0; } catch { svWs = 0; }
  }
  const instalada = svLead == null ? null : Math.max(svLead, svWs);

  const sesiones: SesionDeLead[] = filas.map((f) => ({
    id: f.id,
    inicio: f.inicio,
    segundos: Math.max(0, Number(f.segundos) || 0),
    eventos: Math.max(0, Number(f.eventos) || 0),
    corte: f.corte === 'tiempo' || f.corte === 'bytes' ? f.corte : null,
    lista: !!f.storage_path,
  }));

  const vacio = motivoDelVacio({
    ...senales,
    leyoTodo,
    hayGrabaciones: sesiones.length > 0,
    // 0 no es una versión: nadie midió nunca con la 0. Vuelve a ser «no se sabe».
    snippetDelLead: instalada && instalada > 0 ? instalada : null,
  });

  return { sesiones, vacio, retencionDias: cfg.retencionDias };
}

/**
 * La grabación de UNA prueba del Pixel, por su marcador (`?mko_test=…`).
 *
 * El grabador ya guarda el marcador en `replay_sesiones.prueba` —viaja en la URL
 * de la página— así que la prueba puede encontrar SU propia grabación sin que
 * nadie la busque entre las de todo el mundo. Eso es lo que antes resolvía la
 * etiqueta de Clarity.
 *
 * Devuelve `null` por las dos razones de siempre y NO las distingue a propósito:
 * acá «todavía no llegó» y «no se pudo leer» mandan a hacer lo mismo —esperar— y
 * el que decide qué frase sale es el chequeo, que mira además si el evento de
 * `pageview` llegó. Un replay sin `storage_path` sale igual, con `lista: false`:
 * esa sesión está grabando o esperando el sellado, y las dos son un estado
 * legítimo de una prueba que recién se hizo.
 */
export async function replayDePrueba(marcador: string | null): Promise<SesionDeLead | null> {
  if (!marcador) return null;
  const db = await getTenantDb();
  const { data, error } = await db
    .from('replay_sesiones')
    .select('id, inicio, segundos, eventos, corte, storage_path')
    .eq('prueba', marcador)
    .order('inicio', { ascending: false })
    .limit(1);
  if (error) return null;
  const f = ((data ?? []) as FilaSesion[])[0];
  if (!f) return null;
  return {
    id: f.id,
    inicio: f.inicio,
    segundos: Math.max(0, Number(f.segundos) || 0),
    eventos: Math.max(0, Number(f.eventos) || 0),
    corte: f.corte === 'tiempo' || f.corte === 'bytes' ? f.corte : null,
    lista: !!f.storage_path,
  };
}

/** Lo que puede salir mal al traer el cuerpo de una sesión. Cada uno, su frase. */
export type FalloDeCuerpo = 'id_invalido' | 'no_existe' | 'sin_sellar' | 'storage' | 'ilegible';

/**
 * El cuerpo de una sesión sellada, ya descomprimido, como JSON Lines.
 *
 * ⚠️ EL `id` SE VALIDA Y LA FILA SE BUSCA CON SCOPE antes de tocar Storage. La ruta
 * del objeto la decide `rutaDeSesion` al escribir, pero acá se lee la que quedó
 * GUARDADA: si alguien pide el id de una sesión de otro cliente, la consulta
 * scopeada no la encuentra y nunca se firma ni se baja nada. Es la misma defensa que
 * /api/doc, y hace falta igual porque el que baja de Storage es el service role y ahí
 * no hay RLS que ataje.
 */
export async function cuerpoDeSesion(
  sesionId: string,
): Promise<{ ok: true; texto: string } | { ok: false; motivo: FalloDeCuerpo }> {
  if (!sesionIdValido(sesionId)) return { ok: false, motivo: 'id_invalido' };

  const db = await getTenantDb();
  const { data, error } = await db
    .from('replay_sesiones')
    .select('storage_path')
    .eq('id', sesionId)
    .maybeSingle();
  // Un error de lectura NO es «no existe»: con la migración sin aplicar, los dos
  // casos devuelven lo mismo y mandarían a buscar cosas distintas.
  if (error) return { ok: false, motivo: 'storage' };
  const path = (data?.storage_path as string | null) ?? null;
  if (!data) return { ok: false, motivo: 'no_existe' };
  if (!path) return { ok: false, motivo: 'sin_sellar' };

  // El bucket es privado y lo lee el service role. No se firma una URL: el objeto
  // viene gzip y lo que la pantalla necesita son los eventos, así que se
  // descomprime acá y nunca se le entrega al navegador una URL de Storage que
  // pueda circular.
  const { data: blob, error: dErr } = await getSupabaseServer().storage.from(REPLAY_BUCKET).download(path);
  if (dErr || !blob) return { ok: false, motivo: 'storage' };

  try {
    const buf = Buffer.from(await blob.arrayBuffer());
    // `.jsonl.gz` por contrato, pero un objeto subido sin comprimir se lee igual:
    // los dos primeros bytes de un gzip son 0x1f 0x8b y no hay JSON que empiece así.
    const texto = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    return { ok: true, texto };
  } catch {
    return { ok: false, motivo: 'ilegible' };
  }
}
