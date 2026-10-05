// =============================================================================
// replay-ingesta — recibir un lote, sellar la sesión, y que no crezca para siempre
// =============================================================================
// Las tres escrituras del replay viven acá y no en sus rutas, por el mismo
// motivo de siempre: la ruta es la puerta (CORS, token, ruteo) y esto es el
// trabajo. Así el cron y el receptor comparten el sellador en vez de tener uno
// cada uno.
//
// EL REPARTO, que es la decisión de diseño que más cuesta ver:
//
//   · `recibirLote`      guarda el lote y nada más. NO sella.
//   · `sellarPendientes` convierte los lotes en UN objeto gzip. Corre en el cron.
//   · `purgarVencidas`   borra lo que pasó la retención. Corre en el cron.
//
// ⚠️ POR QUÉ EL RECEPTOR NO SELLA, aunque el lote traiga `fin: 1`. Dos razones y
// las dos son medidas, no estéticas:
//
//   1. EL ORDEN DE LLEGADA NO ESTÁ GARANTIZADO. Es la razón por la que `n` existe
//      y es parte de la clave primaria: un `sendBeacon` y un POST con `keepalive`
//      salen sin esperar respuesta y el navegador los entrega cuando puede, así
//      que el lote con `fin` puede llegar ANTES que el anterior. Sellar en ese
//      mismo request tira el lote que todavía venía en camino — y lo tira del
//      final de la grabación, que es justo el momento en que la persona se fue.
//      Por eso el `fin` sólo anota `fin_at` y el cron sella un par de minutos
//      después.
//   2. SELLAR ES CARO Y EL BEACON NO. Sellar es leer hasta 2 MiB de la base,
//      descomprimir N lotes, parsearlos, re-comprimir con gzip nivel 9 y subir un
//      objeto. Eso adentro de un request que dispara el `pagehide` de la página de
//      un tercero es latencia que paga el visitante de nuestro cliente.
//
// Y el mismo sellador cierra las HUÉRFANAS: las sesiones cuyo `fin` no llegó
// nunca porque el navegador se cerró de golpe. Sin eso, sus filas se quedan en
// `replay_lotes` para siempre, que es exactamente lo que «el almacenamiento no es
// el problema; lo que no tiene techo es no tener retención» viene a evitar.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb } from './workspace';
import { getSetting } from './settings';
import {
  cabeEnLaSesion,
  grabaA,
  grabacionVencio,
  motivoDeDescarte,
  parsearReplay,
  REPLAY_BUCKET,
  REPLAY_CONFIG_KEY,
  REPLAY_PISO_EVENTOS,
  REPLAY_PISO_SEGUNDOS,
  REPLAY_TOPE_SEGUNDOS,
  rutaDeSesion,
  sesionIdValido,
  type ReplayConfig,
  type ReplayCorte,
} from './replay-contrato';
import {
  aBytea,
  armarSellado,
  cuerpoDeLote,
  deBytea,
  lineaDeLote,
  REPLAY_LOTES_MAX,
  textoDeLote,
} from './replay-sellado';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECIBIR UN LOTE
// ─────────────────────────────────────────────────────────────────────────────
export type LoteEntrante = {
  v: number;
  visitorId: string;
  sesionId: string;
  n: number;
  e: unknown;
  z: unknown;
  /** Milisegundos de grabación ACUMULADOS al cerrar este lote (no del lote solo). */
  ms: number;
  landingUrl: string | null;
  prueba: string | null;
  fin: boolean;
};

/**
 * Qué pasó con el lote. `ignorado` NUNCA es silencioso: el motivo sale en la
 * respuesta y, cuando corresponde, queda contado en `replay_sesiones.descartados`.
 */
export type ResultadoLote =
  | { ok: true; guardado: true }
  | { ok: true; guardado: false; ignorado: string; corte?: ReplayCorte };

type FilaSesion = {
  id: string;
  inicio: string;
  segundos: number;
  bytes: number;
  corte: ReplayCorte;
  descarte: string | null;
  storage_path: string | null;
  sellada_at: string | null;
  descartados: number;
};

const COLS_SESION =
  'id, inicio, segundos, bytes, corte, descarte, storage_path, sellada_at, descartados';

/** Suma uno al contador de descartes de una sesión. Best-effort: nunca tumba el beacon. */
async function contarDescarte(sesionId: string, previos: number): Promise<void> {
  try {
    const supabase = await getTenantDb();
    await supabase
      .from('replay_sesiones')
      .update({ descartados: previos + 1 })
      .eq('id', sesionId);
  } catch (e) {
    console.error(`[replay] no se pudo contar el descarte de ${sesionId}: ${msg(e)}`);
  }
}

/**
 * Guarda un lote. Corre SIEMPRE dentro de `runWithWorkspace(ws)`.
 *
 * El orden de las puertas no es casual: primero el apagador (lo más barato y lo
 * que más veces va a decir no), después el estado de la sesión, después los topes,
 * y recién al final la escritura.
 */
export async function recibirLote(lote: LoteEntrante): Promise<ResultadoLote> {
  // ── 0. El apagador. Apagado por default y sólo un `true` literal prende. ──
  const cfg = parsearReplay(await getSetting(REPLAY_CONFIG_KEY));
  if (!grabaA(cfg, lote.visitorId)) {
    // Sin log: con el apagador en false esto contesta a CADA lote de CADA
    // visitante, y un `console.warn` por evento es ruido que además tapa los
    // avisos que sí importan. El grabador tiene que parar cuando lee esto.
    return { ok: true, guardado: false, ignorado: cfg.activo ? 'fuera del muestreo' : 'apagado' };
  }

  if (!sesionIdValido(lote.sesionId)) return { ok: true, guardado: false, ignorado: 'sesion invalida' };
  if (!Number.isSafeInteger(lote.n) || lote.n < 0 || lote.n > REPLAY_LOTES_MAX) {
    return { ok: true, guardado: false, ignorado: 'lote fuera de rango' };
  }

  const decodificado = cuerpoDeLote(lote.e, lote.z);
  if ('rechazo' in decodificado) {
    // ESTO SÍ SE LOGUEA: un cuerpo que no se puede decodificar significa que el
    // grabador y el receptor no están de acuerdo en la forma del lote, y ése es
    // el contrato roto entre dos piezas que no se ven. Con el motivo adentro se
    // puede distinguir «el navegador no comprime bien» de «llegó basura».
    console.warn(`[replay] lote rechazado (${decodificado.rechazo}) sesion=${lote.sesionId} n=${lote.n}`);
    return { ok: true, guardado: false, ignorado: `cuerpo: ${decodificado.rechazo}` };
  }
  const { cuerpo, z } = decodificado;

  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('replay_sesiones')
    .select(COLS_SESION)
    .eq('id', lote.sesionId)
    .maybeSingle();
  if (error) {
    console.error(`[replay] no se pudo leer la sesion ${lote.sesionId}: ${error.message}`);
    return { ok: true, guardado: false, ignorado: 'no se pudo leer la sesion' };
  }
  const fila = (data as FilaSesion | null) ?? null;

  // ── 1. ¿Esta sesión ya se cerró? ──
  // Un lote que llega tarde a una sesión sellada no se puede meter: el objeto ya
  // está escrito. Se cuenta y se contesta, para que el grabador deje de mandar.
  if (fila && (fila.sellada_at || fila.storage_path || fila.descarte)) {
    await contarDescarte(fila.id, fila.descartados);
    return { ok: true, guardado: false, ignorado: 'sesion ya cerrada' };
  }
  // Y una que ya cortamos nosotros tampoco acepta más: el corte es la decisión,
  // no una sugerencia.
  if (fila?.corte) {
    await contarDescarte(fila.id, fila.descartados);
    return { ok: true, guardado: false, ignorado: 'sesion cortada', corte: fila.corte };
  }

  // ── 2. Los topes ──
  // ⚠️ `ms` ES ACUMULADO, no el largo de este lote. Eso lo vuelve IDEMPOTENTE:
  // dos lotes en vuelo a la vez no se pisan el contador, porque el valor nuevo es
  // el máximo y no una suma. El delta que se le pasa al contrato sale de la resta.
  const yaSeg = Math.max(0, fila?.segundos ?? 0);
  const yaBytes = Math.max(0, fila?.bytes ?? 0);
  const segAcum = Math.max(yaSeg, Math.round(Math.max(0, lote.ms) / 1000));
  const cupo = cabeEnLaSesion(
    { segundos: yaSeg, bytes: yaBytes },
    { segundos: segAcum - yaSeg, bytes: cuerpo.length },
  );

  if (!cupo.cabe) {
    // ⚠️ EL EXCESO SE DESCARTA Y QUEDA ESCRITO. El `corte` es lo que el
    // reproductor necesita para no afirmar un abandono que no pasó, y
    // `descartados` es lo que dice si el tope quedó corto. Un rechazo sin rastro
    // hace indistinguibles «no llegó» de «lo tiramos nosotros».
    try {
      await supabase
        .from('replay_sesiones')
        .upsert(
          {
            id: lote.sesionId,
            visitor_id: lote.visitorId,
            corte: cupo.corte,
            // Se CIERRA acá mismo: una sesión cortada no va a recibir un `fin`
            // útil, y sin esta marca el sellador la trataría como huérfana y
            // esperaría media hora de gracia para nada.
            fin_at: new Date().toISOString(),
            segundos: Math.min(segAcum, REPLAY_TOPE_SEGUNDOS),
            descartados: (fila?.descartados ?? 0) + 1,
          },
          { onConflict: 'workspace_id,id' },
        );
    } catch (e) {
      console.error(`[replay] no se pudo marcar el corte de ${lote.sesionId}: ${msg(e)}`);
    }
    console.warn(
      `[replay] sesion ${lote.sesionId} cortada por ${cupo.corte} ` +
      `(${yaSeg}s, ${yaBytes}B acumulados; el lote n=${lote.n} de ${cuerpo.length}B se descarta)`,
    );
    return { ok: true, guardado: false, ignorado: `tope: ${cupo.corte}`, corte: cupo.corte };
  }

  // ── 3. El lote ──
  // `upsert` con la clave (ws, sesion, n): el reintento del MISMO lote no
  // duplica, y dos lotes distintos de la misma sesión no se pisan. Idempotencia
  // en la punta que recibe, que es la única que puede garantizarla.
  const { error: errLote } = await supabase
    .from('replay_lotes')
    .upsert(
      {
        sesion_id: lote.sesionId,
        n: lote.n,
        cuerpo: aBytea(cuerpo),
        z,
        ms: Math.max(0, Math.trunc(lote.ms)),
      },
      { onConflict: 'workspace_id,sesion_id,n' },
    );
  if (errLote) {
    console.error(`[replay] insert del lote ${lote.sesionId}#${lote.n} falló: ${errLote.message}`);
    return { ok: true, guardado: false, ignorado: 'no se pudo guardar el lote' };
  }

  // ── 4. La fila índice ──
  // ⚠️ `inicio` NO VIAJA EN EL UPSERT, y es a propósito: PostgREST sólo escribe
  // las columnas que uno manda, así que omitirlo deja el `default now()` del
  // primer lote y no lo pisa en los siguientes. La fecha de la sesión es la de su
  // PRIMER lote, y es la que arma la ruta del objeto y la que decide la purga —
  // si cada lote la corriera, una sesión larga no vencería nunca.
  const { error: errSesion } = await supabase
    .from('replay_sesiones')
    .upsert(
      {
        id: lote.sesionId,
        visitor_id: lote.visitorId,
        landing_url: lote.landingUrl,
        prueba: lote.prueba,
        v: lote.v,
        segundos: segAcum,
        bytes: yaBytes + cuerpo.length,
        ...(lote.fin ? { fin_at: new Date().toISOString() } : {}),
      },
      { onConflict: 'workspace_id,id' },
    );
  if (errSesion) {
    console.error(`[replay] upsert de la sesion ${lote.sesionId} falló: ${errSesion.message}`);
    // El lote ya está guardado: el sellador lo va a encontrar igual por el
    // barrido de huérfanos. No se contesta error.
  }

  return { ok: true, guardado: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SELLAR
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cuánto se espera después del `fin` antes de sellar.
 *
 * Son los stragglers: el lote anterior que el navegador entregó después del
 * último. Dos minutos es holgado para un POST que ya salió del dispositivo y es
 * invisible para quien mira la grabación, que la va a abrir horas o días después.
 */
const GRACIA_FIN_MIN = 2;

/**
 * Cuánto se espera sin lotes nuevos antes de dar una sesión por HUÉRFANA.
 *
 * ⚠️ SE MIDE SOBRE EL ÚLTIMO LOTE, no sobre `inicio`. Una pestaña puede quedar
 * abierta horas: el tope de 10 minutos es de tiempo GRABADO y una pestaña
 * escondida no genera eventos, así que `inicio` no dice nada sobre si la persona
 * sigue ahí. Treinta minutos sin un solo lote sí.
 */
const GRACIA_HUERFANA_MIN = 30;

export type ResultadoSellado = {
  selladas: number;
  descartadas: number;
  /** Lotes que no se pudieron abrir y quedaron afuera del objeto. */
  lotesIlegibles: number;
  /** Líneas que el tope de bytes recortó del final. */
  lineasRecortadas: number;
  errores: string[];
};

/**
 * Sella una sesión: sus lotes se vuelven UN objeto gzip y las filas se borran.
 *
 * Devuelve qué se hizo. `null` cuando todavía no le toca (llegó un lote hace
 * menos que la gracia), que no es un error.
 */
async function sellarSesion(
  ws: number,
  fila: FilaSesion & { fin_at: string | null },
  ahora: number,
): Promise<'sellada' | 'descartada' | null | { error: string }> {
  const supabase = await getTenantDb();
  const sb = getSupabaseServer();

  const { data: lotes, error } = await supabase
    .from('replay_lotes')
    .select('n, cuerpo, z, created_at')
    .eq('sesion_id', fila.id)
    .order('n', { ascending: true })
    .limit(REPLAY_LOTES_MAX);
  if (error) return { error: `lotes de ${fila.id}: ${error.message}` };

  const filas = (lotes ?? []) as Array<{ n: number; cuerpo: unknown; z: number; created_at: string }>;

  // ⚠️ ¿SIGUE VIVA? El candidato se eligió por `inicio`, que no dice nada; lo que
  // decide es el ÚLTIMO lote. Sin esto, una pestaña que lleva una hora abierta y
  // sigue grabando se sella a mitad de camino, y los lotes que vengan después
  // caen en una sesión cerrada.
  if (!fila.fin_at) {
    const ultimo = filas.reduce((max, f) => Math.max(max, Date.parse(f.created_at) || 0), 0);
    if (ultimo && ahora - ultimo < GRACIA_HUERFANA_MIN * 60_000) return null;
    // Sin un solo lote y sin `fin`: una sesión que se anunció y nunca mandó nada.
    // Se descarta por vacía, igual que un rebote.
    if (!filas.length && ahora - (Date.parse(fila.inicio) || 0) < GRACIA_HUERFANA_MIN * 60_000) return null;
  }

  // ── El cuerpo ──
  const lineas: string[] = [];
  const eventos: number[] = [];
  let ilegibles = 0;
  for (const f of filas) {
    const bytes = deBytea(f.cuerpo);
    const texto = bytes ? textoDeLote(bytes, f.z === 1 ? 1 : 0) : null;
    const linea = texto ? lineaDeLote(texto) : null;
    if (!linea) { ilegibles++; continue; }
    lineas.push(linea.linea);
    eventos.push(linea.eventos);
  }
  if (ilegibles) {
    console.warn(`[replay:sellar] ws${ws} ${fila.id}: ${ilegibles} de ${filas.length} lotes ilegibles`);
  }

  const totalEventos = eventos.reduce((a, b) => a + b, 0);

  // ── El PISO, en la punta del servidor ──
  // El grabador también lo aplica —ahí se ahorra el request, que es lo único que
  // de verdad se ahorra— pero el reloj del navegador no es confiable y una sesión
  // que llegó por un lote suelto fuera de orden puede quedar por debajo del piso
  // sin que nadie lo haya decidido.
  const motivo = motivoDeDescarte(fila.segundos, totalEventos);
  if (motivo) {
    const { error: errD } = await supabase
      .from('replay_sesiones')
      .update({ descarte: motivo, eventos: totalEventos })
      .eq('id', fila.id);
    if (errD) return { error: `descarte de ${fila.id}: ${errD.message}` };
    await supabase.from('replay_lotes').delete().eq('sesion_id', fila.id);
    return 'descartada';
  }

  const ruta = rutaDeSesion(ws, fila.id, fila.inicio);
  if (!ruta) return { error: `ruta invalida para ${fila.id} (inicio=${fila.inicio})` };

  const sellado = armarSellado(lineas, eventos);
  const { error: errUp } = await sb.storage
    .from(REPLAY_BUCKET)
    .upload(ruta, sellado.gz, { contentType: 'application/gzip', upsert: true });
  if (errUp) return { error: `subida de ${ruta}: ${errUp.message}` };

  // ⚠️ EL OBJETO PRIMERO Y LA FILA DESPUÉS, igual que al borrar y por el mismo
  // motivo invertido: si la fila dijera que está sellada y el objeto no estuviera,
  // el reproductor abriría una grabación que no existe. Al revés —objeto sin
  // fila— lo encuentra la purga por prefijo, que es justo por qué el día va en la
  // ruta.
  const { error: errFila } = await supabase
    .from('replay_sesiones')
    .update({
      storage_path: ruta,
      sellada_at: new Date().toISOString(),
      eventos: sellado.eventos,
      bytes: sellado.bytes,
      // Si el tope de bytes recortó el final, el reproductor TIENE que poder
      // decir que la cortamos nosotros.
      ...(sellado.recortadas > 0 ? { corte: 'bytes' as const } : {}),
    })
    .eq('id', fila.id);
  if (errFila) return { error: `sellar ${fila.id}: ${errFila.message}` };

  await supabase.from('replay_lotes').delete().eq('sesion_id', fila.id);
  if (sellado.recortadas > 0) {
    console.warn(
      `[replay:sellar] ws${ws} ${fila.id}: ${sellado.recortadas} lineas recortadas por el tope de bytes ` +
      `(${sellado.bytes}B en el objeto)`,
    );
  }
  return 'sellada';
}

/**
 * Sella todo lo que haya para sellar en el workspace en curso.
 *
 * `tope` acota el trabajo por corrida: el cron tiene `maxDuration` y es mejor
 * sellar 40 sesiones cada 10 minutos que morir a los 60 segundos en la primera
 * corrida grande. Lo que queda se sella en la vuelta siguiente.
 */
export async function sellarPendientes(ws: number, tope = 40): Promise<ResultadoSellado> {
  const out: ResultadoSellado = {
    selladas: 0, descartadas: 0, lotesIlegibles: 0, lineasRecortadas: 0, errores: [],
  };
  const ahora = Date.now();
  const supabase = await getTenantDb();

  // Las candidatas son dos poblaciones distintas y van en DOS consultas, no en un
  // `.or()` con un `and(...)` adentro: ese filtro lleva marcas de tiempo ISO con
  // puntos y dos puntos dentro de una expresión que PostgREST parsea por
  // separadores, y una consulta mal armada ahí no da filas MAL — da un error que
  // el cron reporta como «no había nada que sellar». Dos consultas indexadas
  // cuestan lo mismo y se entienden leyéndolas.
  const corteFin = new Date(ahora - GRACIA_FIN_MIN * 60_000).toISOString();
  const corteHuerfana = new Date(ahora - GRACIA_HUERFANA_MIN * 60_000).toISOString();

  const candidatas: Array<FilaSesion & { fin_at: string | null }> = [];

  // 1. Las que avisaron que terminaron y ya pasó la gracia de los stragglers.
  const { data: conFin, error: errFin } = await supabase
    .from('replay_sesiones')
    .select(`${COLS_SESION}, fin_at`)
    .is('sellada_at', null)
    .is('descarte', null)
    .lt('fin_at', corteFin)
    .order('inicio', { ascending: true })
    .limit(tope);
  if (errFin) out.errores.push(`candidatas con fin: ${errFin.message}`);
  else candidatas.push(...((conFin ?? []) as Array<FilaSesion & { fin_at: string | null }>));

  // 2. Las HUÉRFANAS: nunca avisaron. El filtro fino —¿llegó un lote hace un
  //    rato?— lo hace `sellarSesion`, que es el único que mira los lotes.
  if (candidatas.length < tope) {
    const { data: sinFin, error: errSin } = await supabase
      .from('replay_sesiones')
      .select(`${COLS_SESION}, fin_at`)
      .is('sellada_at', null)
      .is('descarte', null)
      .is('fin_at', null)
      .lt('inicio', corteHuerfana)
      .order('inicio', { ascending: true })
      .limit(tope - candidatas.length);
    if (errSin) out.errores.push(`candidatas huerfanas: ${errSin.message}`);
    else candidatas.push(...((sinFin ?? []) as Array<FilaSesion & { fin_at: string | null }>));
  }

  for (const fila of candidatas) {
    try {
      const r = await sellarSesion(ws, fila, ahora);
      if (r === 'sellada') out.selladas++;
      else if (r === 'descartada') out.descartadas++;
      else if (r && typeof r === 'object') out.errores.push(r.error);
    } catch (e) {
      out.errores.push(`${fila.id}: ${msg(e)}`);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PURGAR
// ─────────────────────────────────────────────────────────────────────────────
export type ResultadoPurga = {
  /** Filas índice borradas. */
  filas: number;
  /** Objetos borrados del bucket. */
  objetos: number;
  /** Las que vencían por los 30 días y se quedan porque ese visitante es un lead. */
  conservadasPorLead: number;
  errores: string[];
};

/**
 * Borra las grabaciones vencidas del workspace en curso.
 *
 * ⚠️ LA RETENCIÓN SE DECIDE ACÁ Y NO AL GRABAR. Cuando la sesión se graba todavía
 * no se sabe si esa persona va a dejar sus datos —el `visitor_id` se cose al lead
 * después, por Calendly o por el Camino 1 del beacon—, así que un vencimiento
 * guardado en la fila sería congelar una respuesta que todavía no existía. Se
 * pregunta en el momento.
 */
export async function purgarVencidas(ws: number, cfg: ReplayConfig, tope = 200): Promise<ResultadoPurga> {
  const out: ResultadoPurga = { filas: 0, objetos: 0, conservadasPorLead: 0, errores: [] };
  const supabase = await getTenantDb();
  const sb = getSupabaseServer();
  const ahoraISO = new Date().toISOString();

  // Se piden las que pasaron la retención CORTA. Las que además sean de un lead
  // se filtran después con `grabacionVencio`, que es quien sabe de los 180 días:
  // traerlas igual es lo que permite contarlas y decir cuántas se conservaron.
  const corte = new Date(Date.now() - cfg.retencionDias * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('replay_sesiones')
    .select('id, visitor_id, inicio, storage_path')
    .lt('inicio', corte)
    .order('inicio', { ascending: true })
    .limit(tope);
  if (error) {
    out.errores.push(`vencidas: ${error.message}`);
    return out;
  }
  const filas = (data ?? []) as Array<{ id: string; visitor_id: string; inicio: string; storage_path: string | null }>;
  if (!filas.length) return out;

  // ¿Cuáles de estos visitantes terminaron en un lead? Una consulta para todos,
  // no una por sesión. Scopeada por `getTenantDb`: los leads de otro cliente no
  // pueden salvar una grabación de este.
  const visitantes = [...new Set(filas.map((f) => f.visitor_id).filter(Boolean))];
  const conLead = new Set<string>();
  for (let i = 0; i < visitantes.length; i += 200) {
    const { data: leads, error: errLeads } = await supabase
      .from('leads')
      .select('visitor_id')
      .in('visitor_id', visitantes.slice(i, i + 200));
    if (errLeads) {
      // ⚠️ FAIL-CLOSED HACIA NO BORRAR. No poder contestar «¿es un lead?» no es
      // «no es un lead»: con la consulta caída, borrar sería tirar justo las
      // grabaciones que la retención larga existe para guardar. Se corta la purga
      // y se reintenta en la vuelta siguiente.
      out.errores.push(`leads: ${errLeads.message} — no se borró nada en esta vuelta`);
      return out;
    }
    for (const l of (leads ?? []) as Array<{ visitor_id: string | null }>) {
      if (l.visitor_id) conLead.add(l.visitor_id);
    }
  }

  const aBorrar = filas.filter((f) => {
    const vencio = grabacionVencio(f.inicio, ahoraISO, conLead.has(f.visitor_id), cfg.retencionDias);
    if (!vencio) out.conservadasPorLead++;
    return vencio;
  });
  if (!aBorrar.length) return out;

  // ── 1. El objeto PRIMERO ──
  // El contrato lo dice y la razón es la factura: si la fila muere antes, el
  // objeto no aparece en ninguna consulta y queda pagándose para siempre. Un
  // bucket que no se puede cruzar contra su índice es una factura sin nombre.
  //
  // ⚠️ Y SE COMPRUEBA EL PREFIJO. El scoping por workspace intercepta `.from()`
  // y NO `.storage`: cualquier ruta llega al service_role sin filtro. Una fila con
  // un `storage_path` apuntando a la carpeta de otro cliente borraría el archivo
  // de ese otro cliente.
  const rutas = aBorrar
    .map((f) => f.storage_path)
    .filter((p): p is string => !!p && p.startsWith(`${ws}/`));
  const ajenas = aBorrar.filter((f) => f.storage_path && !f.storage_path.startsWith(`${ws}/`));
  if (ajenas.length) {
    out.errores.push(`${ajenas.length} filas con storage_path fuera de ${ws}/ — no se tocó el objeto`);
  }
  for (let i = 0; i < rutas.length; i += 100) {
    const tanda = rutas.slice(i, i + 100);
    const { error: errRm } = await sb.storage.from(REPLAY_BUCKET).remove(tanda);
    if (errRm) {
      out.errores.push(`borrado de objetos: ${errRm.message}`);
      // Si el objeto no se pudo borrar, la fila NO se borra: es lo único que
      // permite volver a intentarlo.
      return out;
    }
    out.objetos += tanda.length;
  }

  // ── 2. Las filas, y los lotes que hubieran quedado ──
  const ids = aBorrar.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 100) {
    const tanda = ids.slice(i, i + 100);
    await supabase.from('replay_lotes').delete().in('sesion_id', tanda);
    const { data: borradas, error: errDel } = await supabase
      .from('replay_sesiones')
      .delete()
      .in('id', tanda)
      .select('id');
    if (errDel) {
      out.errores.push(`borrado de filas: ${errDel.message}`);
      return out;
    }
    out.filas += (borradas ?? []).length;
  }
  return out;
}

/**
 * Barre los lotes que quedaron sin dueño.
 *
 * Es la red de seguridad del sellador: si una sesión se selló y el borrado de sus
 * lotes falló, o si una fila índice se perdió, las filas de `replay_lotes` no
 * aparecen en ninguna consulta y se quedan ahí.
 *
 * ⚠️ TRES DÍAS Y NO UNO, y el número sale de una cuenta: el sellador hace hasta
 * 40 sesiones cada 10 minutos, o sea **5.760 por día**, contra las 8.893 visitas
 * del MES pico. Para que un lote legítimo llegue a los tres días sin sellarse
 * haría falta un atraso de 17.000 sesiones — y si eso pasa, el problema no es
 * este barrido. Con un día de margen, en cambio, un atraso de medio día le
 * borraría el buffer a sesiones que todavía esperaban turno: el barrido de
 * huérfanos pasaría a ser el que PIERDE grabaciones.
 */
export async function barrerLotesHuerfanos(dias = 3): Promise<{ lotes: number; error?: string }> {
  const supabase = await getTenantDb();
  const corte = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('replay_lotes')
    .delete()
    .lt('created_at', corte)
    .select('sesion_id');
  if (error) return { lotes: 0, error: error.message };
  return { lotes: (data ?? []).length };
}

/** La config del replay del workspace en curso. Lo usa el cron. */
export async function configDeReplay(): Promise<ReplayConfig> {
  return parsearReplay(await getSetting(REPLAY_CONFIG_KEY));
}

/** Para el log del cron: el piso y el tope, de una sola fuente. */
export const RESUMEN_TOPES = `piso ${REPLAY_PISO_SEGUNDOS}s/${REPLAY_PISO_EVENTOS}ev · tope ${REPLAY_TOPE_SEGUNDOS}s`;
