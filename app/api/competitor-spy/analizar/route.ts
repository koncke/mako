// =============================================================================
// /api/competitor-spy/analizar — la IA del negocio lee las piezas nuevas, sola y en segundo plano (4/11/2026)
// =============================================================================
// Martín, 4/11: «la IA ya debería analizar por sí sola todo, sin pedirlo. Obvio, jamás que el usuario tenga que esperar,
// que los procesos se ejecuten en segundo plano… y de última que en el detail de cada reel aparezca "Analizando"».
//
//   POST { id } → { ok, enMarcha, faltan }   o   { ok: false, sinIA: true }
//
// La pantalla la llama después de cada lectura y NO espera el análisis: contesta en el acto y el trabajo sigue en un
// `after()`, de a `PIEZAS_POR_ANALISIS` y hasta `TANDAS_POR_PEDIDO` tandas. Mientras tanto la pantalla vuelve a pedir
// las piezas y dibuja «Analizando…» en las que todavía no tienen análisis.
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION: las actions de una pantalla hacen FILA, y un análisis de un minuto dejaría
// esperando a la siguiente (cambiar de competidor, sumar un canal). Y no depende de que la pestaña siga abierta.
//
// ⚠️ LA IA ES LA DEL NEGOCIO (`analizarCompetidor` → `chatCheapCascade`). Sin ninguna conectada contesta `sinIA` y la
// pantalla no dibuja «Analizando»: muestra lo que tiene.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { claveDeIAPropia } from '@/lib/ia-del-negocio';
import { cheapDisponible } from '@/lib/ai-cheap';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { analizarCompetidor, listarPiezas } from '@/lib/spy';
import { cuantasFaltan } from '@/lib/spy-analisis-reglas';
import { getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Tres tandas de hasta 90 s cada una. */
export const maxDuration = 300;

/** Hasta cuántas tandas corre un pedido: 90 piezas. Lo que quede lo toma la próxima lectura. */
const TANDAS_POR_PEDIDO = 3;

// Uno a la vez por competidor y por instancia: dos pestañas (o una lectura que termina dos veces) no pagan dos veces la
// misma tanda. Entre instancias puede correr dos veces; lo que cuida eso es que cada tanda manda SÓLO lo pendiente.
const g = globalThis as unknown as { __spyAnalizando?: Set<string> };
const corriendo = (g.__spyAnalizando ??= new Set<string>());

export async function POST(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(cuerpo.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });

  const faltan = cuantasFaltan(await listarPiezas(id));
  if (!faltan) return Response.json({ ok: true, enMarcha: false, faltan: 0 });

  // Sin poder leer sus claves se intenta igual: lo peor es una tanda que contesta «sin IA».
  const hayIA = (await claveDeIAPropia(ws).catch(() => true)) || (await cheapDisponible().catch(() => false));
  if (!hayIA) return Response.json({ ok: false, sinIA: true, faltan });

  const clave = `${ws}|${id}`;
  if (corriendo.has(clave)) return Response.json({ ok: true, enMarcha: true, faltan });
  corriendo.add(clave);

  const trabajo = () => runWithWorkspace(ws, async () => {
    try {
      const brief = await perfilNegocioTexto().catch(() => '');
      for (let i = 0; i < TANDAS_POR_PEDIDO; i++) {
        const r = await analizarCompetidor(id, brief, { soloPendientes: true });
        if (!r.ok) { console.error(`[spy-analizar] ws=${ws} competidor=${id}: ${r.error}`); break; }
        if (!r.leidas) break;
      }
    } finally {
      corriendo.delete(clave);
    }
  });
  try { after(trabajo); } catch { void trabajo(); }
  return Response.json({ ok: true, enMarcha: true, faltan });
}
