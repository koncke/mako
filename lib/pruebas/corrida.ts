// =============================================================================
// pruebas/corrida — la lectura diaria de cada prueba: medir, juzgar, guardar y, si toca, cortar o concluir (25/10/2026)
// =============================================================================
// La llama UN cron por día (app/api/cron/pruebas). Por cada prueba corriendo, adentro de SU negocio (`runWithWorkspace`:
// un medidor puede leer con getTenantDb):
//   1. las asignaciones de la época;
//   2. el MEDIDOR de su métrica (y los de sus guardrails) devuelve el resultado de cada una. Se le pasan TODAS, no sólo las
//      maduras: así congela el PRIMER resultado el día que pasa («agendó» no tiene hora propia: la hora es la de la lectura
//      que lo vio, y una lectura por día la deja a menos de un día del hecho);
//   3. `conteosPorRama` (que cuenta sólo las maduras) → `juzgar` → se guardan los números del día → se corta o se concluye.
// ⚠️ UNA LECTURA QUE FALLA NO DECIDE: sin medidor, con un medidor que tira o que no devolvió a alguien, la prueba queda con
// su `ultima_lectura_error` y el juez no corre (el Analyst se traga los errores a propósito; acá las lecturas son estrictas).
// Los medidores los pone quien llama, POR SUPERFICIE Y MÉTRICA («agendó» de una automatización no se mide como el de una
// landing): Automations los suyos, Landings los de la landing. Así el motor no depende de nutrición ni de las landings.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { juzgar } from './juez';
import { diaDeLaPrueba, finDeAyer } from './lectura';
import { conteosPorRama, type Medidor, type Superficie } from './metricas';
import {
  asignacionesDe, concluirPrueba, cortarRamas, guardarLectura, leerPrueba, marcarLecturaFallida, pruebasVivas, vencerPropuestas,
  type PruebaGuardada,
} from './store';

/** Los medidores de cada superficie, por clave de métrica. */
export type Medidores = Readonly<Partial<Record<Superficie, Readonly<Partial<Record<string, Medidor>>>>>>;
export type ResultadoLectura =
  | { id: number; ws: number; hecho: 'seguir' | 'cortar' | 'concluir'; detalle: string }
  | { id: number; ws: number; hecho: 'fallida' | 'salteada'; detalle: string };

/** Mide una métrica de la prueba; el error en palabras si no se pudo. */
async function medir(p: PruebaGuardada, metrica: string, medidores: Medidores, hasta: string) {
  const medidor = medidores[p.superficie]?.[metrica];
  if (!medidor) return { error: `No hay medidor para «${metrica}» en ${p.superficie}: la lectura no cuenta.` } as const;
  const asignaciones = await asignacionesDe(p.ws, p.id, p.epoca);
  let resultados;
  try {
    resultados = await medidor({ ws: p.ws, pruebaId: p.id, metrica, definicion: metrica === p.metrica ? p.metricaDef : {}, lugar: p.lugar, asignaciones, hasta });
  } catch (e) {
    return { error: `El medidor de «${metrica}» falló: ${e instanceof Error ? e.message : String(e)}` } as const;
  }
  const c = conteosPorRama(asignaciones, resultados, { ramas: p.ramas, ventanaDias: p.ventanaDias, hasta, metrica });
  if (!c.ok) return { error: `«${metrica}»: ${c.error}` } as const;
  return c;
}

/** UNA prueba: su lectura del día. */
export async function leerUnaPrueba(ws: number, id: number, medidores: Medidores, ahora: Date): Promise<ResultadoLectura> {
  return runWithWorkspace(ws, async () => {
    const p = await leerPrueba(ws, id);
    if (!p || p.estado !== 'corriendo') return { id, ws, hecho: 'salteada', detalle: p ? `está ${p.estado}` : 'ya no existe' };
    const hasta = finDeAyer(ahora);
    const principal = await medir(p, p.metrica, medidores, hasta);
    if ('error' in principal) { await marcarLecturaFallida(ws, id, principal.error); return { id, ws, hecho: 'fallida', detalle: principal.error }; }
    const guardrails = [];
    for (const g of p.guardrails) {
      const c = await medir(p, g.metrica, medidores, hasta);
      if ('error' in c) { await marcarLecturaFallida(ws, id, c.error); return { id, ws, hecho: 'fallida', detalle: c.error }; }
      guardrails.push({ metrica: g.metrica, toleranciaRel: g.toleranciaRel, ramas: c.ramas });
    }
    const dia = diaDeLaPrueba(p.epocaAt ?? p.iniciadaAt, hasta);
    const j = juzgar({ dia, ramas: principal.ramas, guardrails }, { nPorRama: p.nPorRama, minDias: p.minDias, maxDias: p.maxDias, mdeRel: p.mdeRel }, { detalle: true });
    await guardarLectura(ws, p, hasta.slice(0, 10), dia, j, principal.asignados);
    if (j.accion === 'cortar') await cortarRamas(ws, id, j.cortar, j.porque, j.numeros);
    if (j.accion === 'concluir') await concluirPrueba(ws, p, j, ahora);
    return { id, ws, hecho: j.accion, detalle: j.porque };
  });
}

/** TODAS: vencer las propuestas viejas y leer cada prueba corriendo, con un techo de tiempo. */
export async function correrPruebas(medidores: Medidores, o: { ahora?: Date; techoMs?: number } = {}): Promise<{ vencidas: number; lecturas: ResultadoLectura[]; sinTurno: number }> {
  const ahora = o.ahora ?? new Date();
  const inicio = Date.now();
  const vencidas = await vencerPropuestas(ahora);
  const vivas = await pruebasVivas();
  const lecturas: ResultadoLectura[] = [];
  let sinTurno = 0;
  for (const v of vivas) {
    if (o.techoMs != null && Date.now() - inicio > o.techoMs) { sinTurno++; continue; }
    try {
      lecturas.push(await leerUnaPrueba(v.ws, v.id, medidores, ahora));
    } catch (e) {
      // Una prueba que tira no frena a las demás; la próxima corrida la vuelve a leer.
      lecturas.push({ id: v.id, ws: v.ws, hecho: 'fallida', detalle: e instanceof Error ? e.message : String(e) });
    }
  }
  return { vencidas, lecturas, sinTurno };
}
