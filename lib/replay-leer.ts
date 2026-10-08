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
import {
  motivoDelVacio, paginaGrabaHoy, ultimaVisita, visitaSinGrabador,
  type ReplayEnLaFicha, type SesionDeLead, type VisitaDelLead,
} from './replay-ficha';
import { SNIPPET_VERSION_KEY } from './landing-token';
import { VERSIONES_POR_PAGINA_KEY, parsearMapaVersiones } from './pixel-aviso';

// ⚠️ LOS TIPOS QUE SALEN DE ACÁ (`ReplayEnLaFicha`, `SesionDeLead`) VIVEN EN
// `replay-ficha.ts`, que no tiene `server-only`, y NO se re-exportan desde acá a
// propósito: las dos pantallas que los dibujan son `'use client'` y tienen que
// tener UN solo lugar de donde importarlos, que no sea este archivo.

/** Tope de sesiones que se listan. Lo que se mira es lo último, no el historial. */
const TOPE_SESIONES = 20;

/**
 * Cuántas visitas suyas se leen para el vacío. Son las más NUEVAS: si alguna pudo
 * grabarse, es una de ésas (el grabador es del 05/10/2026 y las versiones suben).
 */
const TOPE_VISITAS = 10;

type FilaSesion = {
  id: string;
  inicio: string;
  segundos: number | null;
  eventos: number | null;
  corte: string | null;
  storage_path: string | null;
};

/**
 * La grabación de una PRUEBA, que sabe además de quién es y en qué página se
 * hizo. Son los dos datos que convierten una grabación en algo que se puede
 * MIRAR: el `visitorId` es la llave con la que la ficha del lead la busca
 * (`replayDeLead`), y la `landingUrl` es la que dice a qué producto entra el lead
 * de prueba (`funnelDeLanding`). Sin ellos, la prueba puede afirmar que grabó y
 * no puede llevar a ningún lado — que es exactamente donde quedó el 06/10/2026.
 */
export type SesionDePrueba = SesionDeLead & {
  visitorId: string;
  landingUrl: string | null;
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
  // La configuración primero: es lo único que se lee igual con o sin visitor_id, y su
  // retención es el número que la pantalla escribe en el caso «vencida».
  let leyoTodo = true;
  let crudo: string | null = null;
  try { crudo = await getSetting(REPLAY_CONFIG_KEY); } catch { leyoTodo = false; }
  const cfg = parsearReplay(crudo);

  const senales = {
    visitorId,
    leyoTodo,
    hayGrabaciones: false,
    visitas: null as VisitaDelLead[] | null,
    suPaginaGrabaHoy: null as boolean | null,
    ultimaActividadISO,
    ahoraISO: new Date().toISOString(),
    retencionDias: cfg.retencionDias,
  };

  // Sin identificador no hay a quién buscar: dos consultas que no pueden devolver
  // nada y una frase que ya está decidida.
  if (!visitorId) {
    return { sesiones: [], vacio: motivoDelVacio(senales), retencionDias: cfg.retencionDias, visita: null };
  }

  const db = await getTenantDb();

  const [idx, vis] = await Promise.all([
    // ⚠️ SIN LAS DESCARTADAS (06/10/2026). Una sesión `corta` o `vacia` no se sella
    // nunca (storage_path null), así que la ficha la dibujaba «Se está guardando»
    // PARA SIEMPRE, sin botón, y contaba como grabación: un lead con una sola sesión
    // descartada veía esa fila en vez de la frase del vacío. Medido: 2 de 15 en el ws1.
    db.from('replay_sesiones')
      .select('id, inicio, segundos, eventos, corte, storage_path')
      .eq('visitor_id', visitorId)
      .is('descarte', null)
      .order('inicio', { ascending: false })
      .limit(TOPE_SESIONES),
    // Las visitas de ESTE lead: con qué versión del Pixel entró cada una (`sv`,
    // desde la mig 0135; antes, null), cuándo, y a qué página.
    db.from('landing_visits')
      .select('sv, created_at, landing_url')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false })
      .limit(TOPE_VISITAS),
  ]);

  if (idx.error) leyoTodo = false;
  const filas = ((idx.data ?? []) as FilaSesion[]);

  // ⚠️ EL VEREDICTO ES DE LA VISITA, Y NO SE MEZCLA CON EL WORKSPACE (08/10/2026).
  // Hasta acá se comparaba `Math.max(versión del lead, landing.snippet_version)`, y
  // el setting del negocio —el ÚLTIMO evento que llegó, venga de la página que
  // venga— tapaba el código viejo de la visita: el #2593 de ws1 entró el 30/09 con
  // la v14, el negocio ya estaba en la 22, max = 22 ≥ 21, y la ficha le dijo a
  // Martín «duró menos de 10 segundos» de una visita de 4 minutos. Pasaba lo mismo
  // en ws11: el #2598 entró con la v15 a una página que sigue en la v15.
  //
  // (El máximo existía para no acusar a una página recién repegada cuya visita nueva
  // todavía no llegó. Eso es otra pregunta —¿graba HOY?— y se contesta aparte,
  // abajo, sin tocar lo que trajo la visita.)
  //
  // Y un `sv` null NO es 0: es «no se sabe» (visitas anteriores a la mig 0135). El
  // mapeo a 0 hacía que un lead sin ninguna visita también terminara en la 22.
  // Sin visitas es su propio caso; qué hacer con un null lo decide `visitaSinGrabador`
  // (por la fecha, que sí se sabe).
  const visitas: VisitaDelLead[] | null = vis.error
    ? null
    : ((vis.data ?? []) as Array<{ sv: unknown; created_at: unknown; landing_url: unknown }>).map((r) => ({
        iso: typeof r.created_at === 'string' ? r.created_at : null,
        sv: typeof r.sv === 'number' && Number.isFinite(r.sv) ? r.sv : null,
        url: typeof r.landing_url === 'string' ? r.landing_url : null,
      }));
  const ultima = visitas ? ultimaVisita(visitas) : null;

  // ¿Su página graba HOY? Sólo importa cuando ninguna de sus visitas pudo grabarse
  // —elige entre «es de antes» y «actualiza el código»—, así que sólo entonces se
  // leen los dos settings. Por PÁGINA, con el mapa del beacon (`paginaGrabaHoy`);
  // la versión del negocio queda de respaldo para una página que no está en el mapa,
  // y ahí sólo decide si sale el link, nunca el veredicto de la visita.
  let suPaginaGrabaHoy: boolean | null = null;
  if (filas.length === 0 && visitas && visitas.length > 0 && visitas.every(visitaSinGrabador)) {
    const [mapa, negocio] = await Promise.all([
      getSetting(VERSIONES_POR_PAGINA_KEY).catch(() => null),
      getSetting(SNIPPET_VERSION_KEY).catch(() => null),
    ]);
    suPaginaGrabaHoy = paginaGrabaHoy(parsearMapaVersiones(mapa), ultima?.url ?? null, negocio);
  }

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
    visitas,
    suPaginaGrabaHoy,
  });

  const visita = ultima?.iso ? { iso: ultima.iso, varias: (visitas?.length ?? 0) > 1 } : null;
  return { sesiones, vacio, retencionDias: cfg.retencionDias, visita };
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
export async function replayDePrueba(marcador: string | null): Promise<SesionDePrueba | null> {
  if (!marcador) return null;
  const db = await getTenantDb();
  const { data, error } = await db
    .from('replay_sesiones')
    // ⚠️ `visitor_id` y `landing_url` NO son para dibujar: son para poder ABRIR
    // la grabación. El reproductor vive en la ficha de un lead y busca por
    // `visitor_id`; sin traerlo acá, la única forma de ver una prueba sería
    // sacar el reproductor del CRM. Y `landing_url` dice a qué producto entra
    // ese lead, que es la página en la que se hizo la prueba y no la que esté
    // elegida en la pantalla cuando alguien toque el botón.
    .select('id, inicio, segundos, eventos, corte, storage_path, visitor_id, landing_url')
    .eq('prueba', marcador)
    .order('inicio', { ascending: false })
    .limit(1);
  if (error) return null;
  const f = ((data ?? []) as Array<FilaSesion & { visitor_id: string | null; landing_url: string | null }>)[0];
  if (!f) return null;
  // Sin `visitor_id` no hay grabación que se pueda atar a nadie. La columna es
  // `not null` en la migración 0191, así que esto no debería pasar nunca — y por
  // eso mismo sale como «no hay», que es lo único honesto que se puede decir.
  if (!f.visitor_id) return null;
  return {
    id: f.id,
    inicio: f.inicio,
    segundos: Math.max(0, Number(f.segundos) || 0),
    eventos: Math.max(0, Number(f.eventos) || 0),
    corte: f.corte === 'tiempo' || f.corte === 'bytes' ? f.corte : null,
    lista: !!f.storage_path,
    visitorId: f.visitor_id,
    landingUrl: f.landing_url,
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
