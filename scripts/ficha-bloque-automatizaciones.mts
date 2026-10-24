// =============================================================================
// ficha-bloque-automatizaciones — sumar el bloque «Automatizaciones» a la ficha de los funnels activos de UN negocio
// =============================================================================
// Martín (23/10/2026, por el Cerebro): «Y pon ese bloque con los CRM de Mauricio». Con su OK para ESTA escritura en el
// ws1, una vez que el bloque esté en producción. La config de la ficha es POR FUNNEL, así que va una vez por cada uno.
//
// POR EL CAMINO DE LA PANTALLA: `cambiarFichaDeFunnel` con `{ op: 'poner' }`, el mismo que usa «Agregar bloque» (con su
// línea en el historial de la ficha y su compare-and-set). Se suma el bloque y no se toca nada más:
//   · un funnel cuyo Resumen ya lo dibuja (la plantilla de entrada lo trae desde el 23/10, o alguien lo puso) no se
//     escribe: se cuenta como «ya estaba»;
//   · uno que lo tiene en otra tab o en una hoja propia, tampoco (el bloque va una vez por ficha);
//   · donde falta, va al Resumen después de «Siguiente acción» y «Posibles duplicados» (arriba, como en las plantillas).
// ⚠️ CORRERLO ANTES DEL DEPLOY CONGELA EL RESUMEN de los funnels que siguen a su plantilla: sin el bloque en la plantilla
//    de producción, `poner` guarda la lista entera y la tab deja de seguir a su plantilla. Por eso pide `--desplegado`.
//
// Antes de escribir guarda un RESPALDO de `funnels.data.ficha` y `data.fichaHistorial` de cada funnel (fuera del repo,
// en ~/OneDrive/Escritorio/dashboard-marketing-main/backups/ o `--respaldo <carpeta>`), y después RELEE cada uno y compara la ficha que se dibuja con la de antes: sólo puede haber
// cambiado el bloque nuevo.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/ficha-bloque-automatizaciones.mts \
//     --ws 1 [--desplegado --escribir]
// Sin `--escribir` es EN SECO: dice qué haría en cada funnel y no escribe nada.
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const escribir = process.argv.includes('--escribir');
const desplegado = process.argv.includes('--desplegado');
const WS = Number(arg('ws'));
if (!Number.isInteger(WS) || WS <= 0) throw new Error('Falta --ws <id del negocio>.');
if (escribir && !desplegado) throw new Error('Escribir antes del deploy congela el Resumen de los funnels que siguen a su plantilla: pasá --desplegado cuando el bloque esté en producción.');

const BLOQUE = 'automatizaciones-en-curso';
const ARRIBA = ['siguiente-accion', 'posibles-duplicados'];
const AUTOR = 'MaKo (pedido de Martín, 23/10)';

const { runWithWorkspace, getTenantDb } = await import(`file:///${base}/lib/workspace.ts`);
const { listarFunnels } = await import(`file:///${base}/lib/funnels.ts`);
const { leerFichaDeFunnel, cambiarFichaDeFunnel } = await import(`file:///${base}/lib/ficha/config-server.ts`);

type Puesto = { id: string; ancho: number; diseno: string; icono?: string; opciones?: unknown };
type Efectiva = { tabs: Record<string, Puesto[]>; hojas: Array<{ id: string; nombre: string; bloques: Puesto[]; epica: boolean }>; [k: string]: unknown };

/** La ficha que se dibuja, sin el bloque nuevo: lo que tiene que quedar IGUAL después de escribir. */
const sinElBloque = (ef: Efectiva) => JSON.stringify({
  ...ef,
  tabs: Object.fromEntries(Object.entries(ef.tabs).map(([t, l]) => [t, l.filter((b) => b.id !== BLOQUE)])),
  hojas: ef.hojas.map((h) => ({ ...h, bloques: h.bloques.filter((b) => b.id !== BLOQUE) })),
  // Lo que cambia por escribir y no es la ficha: si la tab quedó «tocada» y «configurada».
  tocadas: undefined, configuradas: undefined,
});
const loTiene = (ef: Efectiva) => Object.values(ef.tabs).some((l) => l.some((b) => b.id === BLOQUE)) || ef.hojas.some((h) => h.bloques.some((b) => b.id === BLOQUE));

await runWithWorkspace(WS, async () => {
  const funnels = await listarFunnels();
  if (!funnels.length) throw new Error(`El ws${WS} no tiene funnels activos (o no se pudieron leer).`);
  const db = await getTenantDb();
  const { data: filas, error } = await db.from('funnels').select('id, nombre, updated_at, data').in('id', funnels.map((f: { id: number }) => f.id));
  if (error) throw new Error(`No pude leer los funnels: ${error.message}`);
  const respaldo = (filas ?? []).map((f: { id: number; nombre: string; updated_at: string; data: Record<string, unknown> | null }) => ({
    id: f.id, nombre: f.nombre, updated_at: f.updated_at, ficha: f.data?.ficha ?? null, fichaHistorial: f.data?.fichaHistorial ?? null,
  }));
  // Fuera del repo (no se commitea): la carpeta de respaldos de siempre, o la que se pase.
  const carpeta = arg('respaldo') ?? path.join(homedir(), 'OneDrive', 'Escritorio', 'dashboard-marketing-main', 'backups');
  if (escribir) {
    mkdirSync(carpeta, { recursive: true });
    const archivo = path.join(carpeta, `ficha-ws${WS}-${BLOQUE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(archivo, JSON.stringify({ ws: WS, cuando: new Date().toISOString(), funnels: respaldo }, null, 2));
    console.log(`Respaldo: ${archivo}`);
  }

  const lineas: string[] = [];
  for (const f of funnels as Array<{ id: number; nombre: string }>) {
    const antes = await leerFichaDeFunnel(f.id);
    if (!antes) { lineas.push(`✖ ${f.id} «${f.nombre}»: no es de este negocio o no se pudo leer`); continue; }
    const ef = antes.efectiva as unknown as Efectiva;
    const deDonde = antes.efectiva.tocadas.includes('resumen') ? 'Resumen armado a mano' : `Resumen de su plantilla «${antes.efectiva.plantillasTab.resumen}»`;
    if (loTiene(ef)) { lineas.push(`= ${f.id} «${f.nombre}»: ya lo dibuja (${ef.tabs.resumen.some((b) => b.id === BLOQUE) ? deDonde : 'en otra tab u hoja'})`); continue; }
    const resumen = ef.tabs.resumen.map((b) => b.id);
    const lugar = Math.max(0, ...ARRIBA.map((id) => resumen.indexOf(id) + 1)) + 1;
    if (!escribir) { lineas.push(`+ ${f.id} «${f.nombre}»: lo sumaría al Resumen en el lugar ${lugar} (${deDonde})`); continue; }
    const r = await cambiarFichaDeFunnel(f.id, { op: 'poner', tab: 'resumen', bloque: BLOQUE, lugar }, { autor: AUTOR });
    if (!r.ok) { lineas.push(`✖ ${f.id} «${f.nombre}»: ${r.error}`); continue; }
    const despues = await leerFichaDeFunnel(f.id);
    const efd = despues?.efectiva as unknown as Efectiva | undefined;
    const ok = !!efd && efd.tabs.resumen.some((b) => b.id === BLOQUE) && sinElBloque(efd) === sinElBloque(ef);
    lineas.push(`${ok ? '✔' : '✖ REVISAR'} ${f.id} «${f.nombre}»: ${ok ? `puesto en el Resumen, lugar ${lugar}; nada más cambió` : 'la relectura no coincide con lo de antes más el bloque'}`);
  }
  console.log(`ws${WS} · ${funnels.length} funnels activos · ${escribir ? 'ESCRITO' : 'EN SECO (no escribió nada)'}`);
  for (const l of lineas) console.log(l);
});
