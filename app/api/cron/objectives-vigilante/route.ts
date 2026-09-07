// =============================================================================
// Cron: el objetivo del Q, mirado sin que nadie abra la app
// =============================================================================
// Tres avisos, uno por vez y por workspace:
//
//   · objetivo-en-riesgo   lo acumulado está 20% debajo de lo prorrateado a hoy
//   · meta-alcanzada       cruzó su meta (una sola vez por objetivo)
//   · quarter-planificar   faltan ≤21 días para el fin del Q y el siguiente
//                          no tiene ni un objetivo cargado
//
// ⚠️ POR QUÉ ES UN CRON Y NO UN PEDAZO DEL RENDER. Un objetivo que se cae no
// avisa: se descubre cuando alguien entra. Y quien más necesita el aviso es
// justamente el que dejó de entrar. Es la misma razón por la que el auto-completado
// de tareas se sacó del render de /plan y se le hizo su propio cron.
//
// ⚠️ Y POR QUÉ RECORRE `listarWorkspaces` Y NO `correrPorWorkspace`: ese helper
// filtra por integración conectada, y acá el punto es mirar TAMBIÉN a los que no
// conectaron nada — un objetivo `libre`, cargado a mano, no necesita ninguna
// integración para estar en riesgo.
//
// COSTO: cero tokens. Son lecturas de la base y la aritmética de `objectives-modelo`.
//
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { runWithWorkspace, listarWorkspaces } from '@/lib/workspace';
import { emitirAviso } from '@/lib/avisos';
import { hoyEnWorkspace } from '@/lib/timezone';
import { listObjectives, avanceDeObjetivo } from '@/lib/objectives';
import {
  quarterDe, progresoQuarter, siguienteQuarter, rangoQuarter, quarterKey,
} from '@/lib/objectives-modelo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Cuánto por debajo del ritmo se considera «en riesgo».
 *
 * ⚠️ ES UN PROXY, NO UNA VERDAD. Prorratea lineal, y un negocio con estacionalidad
 * no factura parejo. El 20% se eligió para que el ruido de un fin de semana flojo no
 * dispare nada y un mes malo sí — y los 14 días de gracia evitan avisar el 3 de
 * enero, cuando el prorrateo todavía no significa nada. Si alguna vez se mide la
 * curva real del negocio, esto se reemplaza; hasta entonces el mensaje dice «a esta
 * altura deberías ir por», que es exactamente lo que está calculando.
 */
const DESVIO_RIESGO = 0.20;
const DIAS_DE_GRACIA = 14;
/** Cuántos días antes del fin del Q se recuerda planificar el siguiente. Lo fijó el dueño. */
const DIAS_AVISO_PLANIFICAR = 21;

const usd = (n: number) => `US$${Math.round(n).toLocaleString('es-MX')}`;
const cantidad = (n: number) => String(Math.round(n));

export async function GET(req: NextRequest) {
  const no = checkCronAuth(req);
  if (no) return no;

  const dry = new URL(req.url).searchParams.get('dry') === '1';

  let workspaces: Array<{ id: number; nombre: string; estado?: string }> = [];
  try {
    workspaces = (await listarWorkspaces()) as typeof workspaces;
  } catch (e) {
    console.error('[cron:objectives-vigilante] no pude listar workspaces:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }

  const activos = workspaces.filter((w) => (w.estado ?? 'activo') === 'activo');
  const detalle: Array<{ ws: number; nombre: string; avisos: string[]; error?: string }> = [];

  // Uno por uno y con su propio try: que un workspace roto no le apague la corrida
  // a los demás. Es la regla que sigue el resto de los crons del repo.
  for (const w of activos) {
    const avisos: string[] = [];
    try {
      await runWithWorkspace(w.id, async () => {
        const hoy = await hoyEnWorkspace();
        const qt = quarterDe(hoy);
        const prog = progresoQuarter(qt, hoy);

        const objetivos = await listObjectives(qt);

        // ── 1 y 2. Riesgo y meta alcanzada, por objetivo ──
        for (const base of objetivos) {
          const o = await avanceDeObjetivo(base, hoy);

          // ⚠️ SI NO SE PUDO LEER, NO SE AFIRMA NADA. Un aviso automático llega con
          // la autoridad del sistema y quien lo lee no tiene cómo chequearlo. Decir
          // «vas 20% abajo» porque una consulta falló es exactamente el modo de
          // falla del aviso que le dijo a un cliente que su cuenta estaba frenada
          // cuando estaba activa. Sin dato, no hay mensaje.
          if (o.actual === null || !(o.metaValor > 0)) continue;

          const fmt = o.unidad === 'usd' ? usd : cantidad;

          if (o.actual >= o.metaValor) {
            // `dedupKey` con el id del objetivo: dos objetivos que se cumplen la
            // misma semana salen los dos, y el mismo objetivo no felicita todos los
            // días. Sin la clave, el dedup por tipo se tragaría el segundo.
            if (!dry) {
              await emitirAviso({
                tipo: 'meta-alcanzada',
                dedupKey: o.id,
                dedupTtlMin: 60 * 24 * 90,   // una vez por objetivo, el Q dura 90 días
                titulo: `Meta cumplida: ${o.titulo}`,
                texto: `🏆 *¡Meta cumplida!* Llegaste a ${fmt(o.actual)} sobre ${fmt(o.metaValor)} en «${o.titulo}», y todavía quedan ${prog.diasRestantes} días del trimestre. Tremendo. ¿Subimos la vara? — MaKo`,
                categoria: 'aviso', semaforo: 'verde', link: '/general', ws: w.id,
              });
            }
            avisos.push(`meta-alcanzada:${o.id}`);
            continue;
          }

          if (prog.diasTranscurridos < DIAS_DE_GRACIA) continue;
          if (!o.ritmo || o.ritmo.esperado <= 0) continue;
          const desvio = (o.ritmo.esperado - o.actual) / o.ritmo.esperado;
          if (desvio < DESVIO_RIESGO) continue;

          if (!dry) {
            await emitirAviso({
              tipo: 'objetivo-en-riesgo',
              dedupKey: o.id,
              dedupTtlMin: 60 * 24 * 7,      // como mucho una vez por semana por objetivo
              titulo: `«${o.titulo}» va atrasado`,
              texto: `🟡 Vas *${Math.round(desvio * 100)}% abajo* de «${o.titulo}»: llevas ${fmt(o.actual)} de ${fmt(o.metaValor)} y a esta altura deberías ir por ${fmt(o.ritmo.esperado)}. Quedan ${prog.diasRestantes} días. ¿Armamos un plan para acelerar? — MaKo`,
              categoria: 'accion', semaforo: 'amarillo', link: '/general', ws: w.id,
            });
          }
          avisos.push(`objetivo-en-riesgo:${o.id}`);
        }

        // ── 3. Planificar el Q siguiente ──
        if (prog.diasRestantes <= DIAS_AVISO_PLANIFICAR) {
          const sig = siguienteQuarter(qt);
          const yaHay = (await listObjectives(sig)).some((o) => o.quarter === sig.q);
          // ⚠️ `o.quarter === sig.q` y no `.length > 0`: `listObjectives` devuelve
          // también los ANUALES del año, así que un objetivo anual vivo haría creer
          // que el Q siguiente ya está planificado y el aviso no saldría nunca.
          if (!yaHay) {
            const { desde } = rangoQuarter(sig);
            if (!dry) {
              await emitirAviso({
                tipo: 'quarter-planificar',
                dedupKey: quarterKey(sig),
                dedupTtlMin: 60 * 24 * 7,
                titulo: `Falta planificar el Q${sig.q}`,
                texto: `🗓️ Se está terminando el *Q${qt.q}* — quedan ${prog.diasRestantes} días. Todavía no hay ningún objetivo cargado para el Q${sig.q}, que arranca el ${desde}. ¿Lo planificamos? — MaKo`,
                categoria: 'pregunta', semaforo: 'na', link: '/general', ws: w.id,
              });
            }
            avisos.push(`quarter-planificar:${quarterKey(sig)}`);
          }
        }
      });
      detalle.push({ ws: w.id, nombre: w.nombre, avisos });
    } catch (e) {
      console.error(`[cron:objectives-vigilante] ws${w.id}:`, msg(e));
      detalle.push({ ws: w.id, nombre: w.nombre, avisos, error: msg(e) });
    }
  }

  return Response.json({
    ok: true,
    dry,
    workspaces: activos.length,
    emitidos: detalle.reduce((s, d) => s + d.avisos.length, 0),
    detalle,
  });
}
