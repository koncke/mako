// =============================================================================
// migrar-cron-de-antes — los CRON «de antes» → «Cualquier etapa» + CONDITION de entrada (SIMULACRO)
// =============================================================================
// Décima tanda, CRON 2 (11/10/2026). Pedido literal de Martín: «Sospecho que muchas tarjetas quedaron viejas,
// de versiones anteriores... Siempre que se hacen modificaciones las automatizaciones ya creadas deben acompañar
// eso. Nunca nada debe quedar en una versión vieja...». El diseño, con lo medido y las tres fases, en
// docs/diseno-automations-configuraciones.md §4; la propuesta de cada automatización la arma
// `propuestaCronDeAntes` (lib/cron-de-antes.ts, puro y con test).
//
//   npx tsx scripts/migrar-cron-de-antes.mts             → SIMULACRO de las vivas: sólo lee e imprime
//   npx tsx scripts/migrar-cron-de-antes.mts --todas     → también las archivadas (y lo que el conversor haría con las listas)
//   npx tsx scripts/migrar-cron-de-antes.mts --aplicar   → SE NIEGA (ver abajo), antes de leer el .env
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id> (un solo negocio)
//
// QUÉ IMPRIME, por automatización con un CRON de antes: el CRON que quedaría, la entrada (tarjeta nueva AL FINAL
// del array, apuntada por el CRON), `validarGrafo` sobre lo que quedaría, y —sobre los leads de HOY del negocio—
// si la regla nueva le sale a los MISMOS que la cohorte de antes («en los dos / sólo antes / sólo ahora»). La
// cohorte de antes está TRANSCRIPTA de `cohorteDeTrigger` (lib/nutricion.ts, que lleva `server-only`): si el
// motor cambia, esto se relee. Lo que no se transcribió (la exclusión de la familia post-agenda, «¿ya le
// hablamos?») lo dice la línea «NO ES 1:1».
//
// ⚠️ SÓLO LEE, Y LO ASEGURA LA BASE: todo corre adentro de una transacción `read only` (postgres.js con
// DATABASE_URL). Un `insert` o un `update` que alguien le agregue a este script falla en la base.
//
// ⚠️ `--aplicar` SE NIEGA HASTA LA FASE 1 DEL MOTOR, y la escritura (fase 2) todavía no está escrita, a propósito.
// Con el motor de hoy la propuesta cambia a quién le sale qué sin un error (lib/cron-de-antes.ts, la cabecera):
// «Cualquier etapa» (`etapas: ['*']`) no inscribe a nadie, una CONDITION después del CRON se evalúa DESPUÉS de
// inscribir (y la inscripción es única por lead y automatización), y las guardas atadas al `trigger_tipo` dejan de
// valer. La fase 2 escribe con compare-and-set sobre `updated_at` (molde: scripts/novena-tanda-ws1.mts), con
// respaldo previo, y NO escribe una fila si este simulacro mide una sola diferencia.
//
// ⚠️ LAS FECHAS SE LEEN COMO LAS DA SUPABASE-JS (`types` de abajo), no como `Date` de postgres.js: con `Date`,
// `String(fecha).slice(0, 10)` daba «Tue Aug 11» y la comparación contra «2026-10-11» contestaba true SIEMPRE
// (la primera corrida del simulacro, 11/10/2026, acusó 12 leads «sólo con la regla de antes» que no existían).
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};

/** Lo que dice `--aplicar` (lo fija tests/cron-de-antes.test.ts, que corre el script). */
const NO_APLICA = 'migrar-cron-de-antes: --aplicar se niega. Falta la fase 1 del motor (docs/diseno-automations-configuraciones.md §4): '
  + '«Cualquier etapa» en la cohorte de etapa_actual y en lead_nuevo/agenda_nueva, la condición de entrada evaluada AL INSCRIBIR, '
  + 'y las guardas de la reunión mirando la entrada. Corre sin --aplicar para el simulacro.';
if (process.argv.includes('--aplicar')) {
  console.error(NO_APLICA);
  process.exit(1);
}

const TODAS = process.argv.includes('--todas');
const SOLO_WS = arg('ws') != null ? Number(arg('ws')) : null;
config({ path: arg('env') ?? '.env.local' });

const { propuestaCronDeAntes, ENTRADA_DE_ANTES } = await import('../lib/cron-de-antes');
const { disparadoresDe, esEventoDeAntes } = await import('../lib/disparadores');
const { cumpleRama } = await import('../lib/flujo-grafo');
const { hechosDeLead, catalogoDeLead } = await import('../lib/nutricion-grafo-motor');
const { abrirFlujo } = await import('../lib/flujo-legado');
const postgres = (await import('postgres')).default;

const DB = process.env.DATABASE_URL ?? '';
if (!DB) throw new Error('falta DATABASE_URL (pasa --env=<ruta del .env.local>)');

const AHORA = Date.now();
const HOY = new Date(AHORA).toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(AHORA - n * 86_400_000).toISOString();

type Lead = Record<string, unknown> & {
  id: number; funnel_id: number | null; estado_lead: string | null; meta_lead_id: string | null; fecha_agenda: string | null;
  fecha_junta_1: string | null; fecha_junta_2: string | null; asistio_j1: boolean | null; created_at: string;
};

/**
 * LA COHORTE DE ANTES, transcripta de `cohorteDeTrigger` (lib/nutricion.ts), una por evento con mapa. Se
 * buscan por el nombre del evento en esa función. Las dos mitades de la post-agenda son su base
 * (`agendado_sin_confirmar`): la exclusión de familia y «¿ya le hablamos?» leen envíos y no se transcriben.
 */
const AGENDADO = (l: Lead) => !!l.fecha_junta_1 && String(l.fecha_junta_1).slice(0, 10) >= HOY && l.asistio_j1 == null && l.estado_lead === 'abierto';
const COHORTE_DE_ANTES: Record<string, (l: Lead) => boolean> = {
  instant_form_sin_agenda: (l) => !!l.meta_lead_id && !l.fecha_agenda && l.estado_lead === 'abierto' && l.created_at >= diasAtras(30),
  agendado_sin_confirmar: AGENDADO,
  agendado_primer_contacto: AGENDADO,
  agendado_ya_contactado: AGENDADO,
  no_show_j1: (l) => l.asistio_j1 === false && l.estado_lead === 'abierto' && !!l.fecha_junta_1 && String(l.fecha_junta_1).slice(0, 10) >= diasAtras(45).slice(0, 10),
};
// Un evento con mapa y sin cohorte transcripta no se puede medir: el script no sigue (y el test lo cruza).
const sinCohorte = Object.keys(ENTRADA_DE_ANTES).filter((t) => !COHORTE_DE_ANTES[t]);
if (sinCohorte.length) throw new Error(`eventos con mapa y sin cohorte transcripta: ${sinCohorte.join(', ')}`);

/** La ventana del barrido de `etapa_actual` (`cohorteDeTrigger`): el último hito del lead en 90 días. */
function hitoEn90(l: Lead): boolean {
  const ms = [l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2].filter(Boolean).map((x) => Date.parse(String(x))).filter(Number.isFinite);
  return Math.max(0, ...ms) >= AHORA - 90 * 86_400_000;
}

/** ¿Pasa la entrada? Con las funciones PURAS del motor (`hechosDeLead`, `catalogoDeLead`, `cumpleRama`). */
function cumpleEntrada(filas: unknown[], l: Lead): boolean {
  const h = hechosDeLead(l as never, { etapaCasa: null, yaContactado: false, respondio: false, catalogo: { lead: catalogoDeLead(l as never, AHORA) } } as never, AHORA);
  return cumpleRama({ id: 'entrada', modo: 'todas', filas: filas as never, siguiente: null }, h);
}

/** Un sorteo con semilla (mulberry32): el simulacro muestra el MISMO id que escribiría la fase 2. */
function sorteoDe(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sql = postgres(DB, {
  ssl: 'require', max: 1, connect_timeout: 60,
  types: {
    fecha: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    instante: { to: 1184, from: [1184], serialize: (x: string) => x, parse: (x: string) => new Date(x).toISOString() },
  },
});

const salida: string[] = [];
const p = (s: string) => salida.push(s);
let nViejas = 0; let nPropuestas = 0; let nDiferencias = 0; let nErrores = 0;
try {
  await sql.begin('read only', async (tx) => {
    const secs = await tx`select id, workspace_id, clave, nombre, activa, archivada_at, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id,
      cron, cron_proxima_at, disparadores, pasos, estrategia from nutricion_secuencias
      where (${SOLO_WS}::bigint is null or workspace_id = ${SOLO_WS}) order by workspace_id, id`;
    const leadsPorWs = new Map<number, Lead[]>();
    const leadsDe = async (ws: number): Promise<Lead[]> => {
      if (!leadsPorWs.has(ws)) leadsPorWs.set(ws, (await tx`select * from leads where workspace_id = ${ws}`) as unknown as Lead[]);
      return leadsPorWs.get(ws)!;
    };
    for (const s of secs) {
      const arch = !!s.archivada_at;
      if (arch && !TODAS) continue;
      if (!disparadoresDe(s as never).some(esEventoDeAntes)) continue;
      nViejas++;
      // Los ids que la historia de la automatización ya vio: la entrada no puede reusar ninguno.
      const historia = await tx`select nodo_actual, hilos from nutricion_inscripciones where secuencia_id = ${s.id}`;
      const envios = await tx`select distinct nodo_id from nutricion_envios where secuencia_id = ${s.id} and nodo_id is not null`;
      const usados = new Set<string>([
        ...historia.flatMap((i) => [i.nodo_actual, ...(Array.isArray(i.hilos) ? i.hilos.map((h: { nodo?: unknown }) => h?.nodo) : [])]),
        ...envios.map((e) => e.nodo_id),
      ].filter((x): x is string => typeof x === 'string'));
      // Una lista de antes se convierte como al abrirla en el lienzo: «Sigue con» busca la otra por su CLAVE,
      // en el mismo negocio (como `SecuenciaPerfil`, que lo hace con las de la pantalla).
      const idDeClave = (clave: string): number | null =>
        (secs.find((x) => Number(x.workspace_id) === Number(s.workspace_id) && x.clave === clave)?.id as number | undefined) ?? null;
      const pr = propuestaCronDeAntes(s as never, { usados, rnd: sorteoDe(Number(s.id)), idDeClave });
      p(`\n#${s.id} ws${s.workspace_id} «${s.nombre}» ${s.activa ? 'ACTIVA' : 'pausada'}${arch ? ' (archivada)' : ''} · embudo ${s.funnel_id ?? 'todos'}`);
      if (pr.estado !== 'propuesta') {
        p(`  CRON de antes: ${pr.estado === 'sin_propuesta' ? pr.eventos.join(' + ') : '—'}`);
        p(`  → SIN PROPUESTA: ${pr.estado === 'sin_propuesta' ? pr.motivo : 'nada'}. Queda «de antes» en el panel.`);
        continue;
      }
      nPropuestas++;
      p(`  CRON de antes: ${pr.eventos.join(' + ')}`);
      p(`  → CRON: Producto › Adquisición › «Cualquier etapa» ${JSON.stringify(pr.disparadores[0])}`);
      p(`  → ENTRADA (tarjeta ${pr.entrada.id}, al final del array, antes de «${pr.entrada.antes}»): ${JSON.stringify(pr.entrada.filas)}`);
      p(`  → validarGrafo: ${pr.errores.length ? pr.errores.join(' · ') : 'sin errores'} · pasos ${Array.isArray(s.pasos) ? s.pasos.length : 0} → ${pr.pasos.length} · antigüedad al inscribir (motor de hoy): ${pr.antiguedad ?? 'nada'}`);
      if (pr.errores.length) nErrores++;
      for (const f of pr.falta) p(`  NO ES 1:1: ${f}`);
      // Una LISTA de antes se convierte primero (`abrirFlujo`): sus índices cambian, y eso sólo vale si nadie la
      // está recibiendo. Una viva convertida con inscripciones activas cuenta como una diferencia: no se escribe.
      if (pr.convertida) p('  ERA UNA LISTA DE ANTES: se convierte como al abrirla en el lienzo (sus índices cambian)');
      if (arch) continue;
      if (pr.convertida) {
        const [{ n }] = await tx`select count(*)::int n from nutricion_inscripciones where secuencia_id = ${s.id} and estado = 'activa'`;
        if (n > 0) { nDiferencias++; p(`  ⚠️ CONVERTIDA CON ${n} INSCRIPCIONES ACTIVAS: sus paso_actual dejarían de apuntar a lo mismo`); }
      }
      // ¿Le sale a los mismos? Sobre los leads de hoy del negocio y de su embudo.
      const todos = (await leadsDe(Number(s.workspace_id))).filter((l) => s.funnel_id == null || Number(l.funnel_id) === Number(s.funnel_id));
      const antes = (l: Lead) => pr.eventos.some((t) => COHORTE_DE_ANTES[t]?.(l));
      let ambos = 0; let soloAntes = 0; let soloAhora = 0;
      const ej: string[] = [];
      for (const l of todos) {
        const v = antes(l);
        const n = cumpleEntrada(pr.entrada.filas, l) && hitoEn90(l);
        if (v && n) ambos++;
        else if (v) { soloAntes++; if (ej.length < 3) ej.push(`lead ${l.id} (sólo antes)`); }
        else if (n) { soloAhora++; if (ej.length < 3) ej.push(`lead ${l.id} (sólo ahora)`); }
      }
      if (soloAntes || soloAhora) nDiferencias++;
      p(`  MEDIDO sobre ${todos.length} leads: en los dos ${ambos} · sólo antes ${soloAntes} · sólo ahora ${soloAhora}${ej.length ? ` · ej: ${ej.join(', ')}` : ''}`);
      const vivas = await tx`select estado, count(*)::int n from nutricion_inscripciones where secuencia_id = ${s.id} group by 1 order by 1`;
      p(`  inscripciones: ${vivas.map((r) => `${r.estado} ${r.n}`).join(', ') || 'ninguna'}`);
    }
    if (TODAS) {
      // Las listas de antes que siguen archivadas: lo que haría el conversor del lienzo al abrirlas.
      let conv = 0;
      for (const s of secs.filter((x) => x.archivada_at)) if (abrirFlujo(Array.isArray(s.pasos) ? s.pasos : [], s.estrategia ?? null).convertida) conv++;
      p(`\nARCHIVADAS en forma de LISTA que el conversor (abrirFlujo) pasaría a tarjetas al abrirlas: ${conv}`);
    }
  });
} finally {
  await sql.end();
}
console.log(salida.join('\n'));
console.log(`\nRESUMEN ${HOY}: ${nViejas} con un CRON de antes${TODAS ? ' (con archivadas)' : ' (vivas)'} · ${nPropuestas} con propuesta · `
  + `${nErrores} con errores de validarGrafo · ${nDiferencias} con diferencias medidas · NADA ESCRITO (simulacro, read only)`);
