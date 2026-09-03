// =============================================================================
// GET /api/agente/consultar — las lecturas VIVAS de MaKo, para el agente externo
// =============================================================================
// La skill tenía el negocio (`/contexto`) y el tablero (`/plan`), y las dos
// devuelven configuración. Esto abre los datos que cambian solos: los leads con
// su etapa, las conversaciones reales de WhatsApp, las reuniones con su
// asistencia, el funnel del workspace, lo que los experimentos ya validaron.
//
// Son las MISMAS herramientas que corre MaKo adentro de la app (`runMakoTool`),
// no una segunda implementación — ver el porqué en lib/agente-consultas.ts.
//
// Dos formas de usarlo, y la primera existe para que el agente NO tenga que
// adivinar:
//   GET /api/agente/consultar                    → el catálogo de lo que se puede pedir
//   GET /api/agente/consultar?que=buscar_leads&texto=ana
//
// ⚠️ SOLO LECTURA, y el guard está en POSITIVO: la lista blanca vive en
// `CONSULTAS_AGENTE` y se verifica en un test. Derivarla de «todas las tools de
// MaKo» dejaría expuesta la primera de escritura que alguien agregue allá.
//
// ⚠️ Y va en `lib/rutas-publicas.ts`, o el middleware la corta antes de que nadie
// mire el bearer — y en local no se nota.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { runWithWorkspace } from '@/lib/workspace';
import { runMakoTool, MAKO_TOOLS } from '@/lib/mako-tools';
import { CONSULTAS_AGENTE, consultaPermitida, inputDeConsulta, PARAMS_CONSULTA } from '@/lib/agente-consultas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// `historial_whatsapp` sale a Chatwoot y `reuniones_lead` a Calendly/Fathom.
export const maxDuration = 60;

/** El catálogo, con la descripción REAL de cada tool. Se saca de `MAKO_TOOLS` en
 *  vez de reescribirse: es el texto que MaKo ya usa para decidir cuándo llamarla,
 *  así que el agente externo recibe el mismo criterio y no uno paralelo. */
function catalogo() {
  return CONSULTAS_AGENTE.map((nombre) => {
    const def = MAKO_TOOLS.find((t) => t.name === nombre);
    return {
      que: nombre,
      para_que: def?.description ?? '',
      parametros: PARAMS_CONSULTA[nombre].map((p) => ({
        nombre: p.nombre, tipo: p.tipo, obligatorio: Boolean(p.obligatorio),
      })),
    };
  });
}

export async function GET(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const que = (q.get('que') ?? '').trim();

  // Sin `?que=`, el catálogo. Es la respuesta útil y no un 400: quien llega acá
  // sin parámetros está preguntando qué puede pedir.
  if (!que) return NextResponse.json({ ok: true, consultas: catalogo() });

  if (!consultaPermitida(que)) {
    return NextResponse.json(
      { ok: false, error: `consulta desconocida: ${que}`, disponibles: CONSULTAS_AGENTE },
      { status: 400 },
    );
  }

  const armado = inputDeConsulta(que, (k) => q.get(k));
  if ('error' in armado) {
    return NextResponse.json({ ok: false, error: armado.error, parametros: PARAMS_CONSULTA[que] }, { status: 400 });
  }

  try {
    // El runner devuelve STRING: a veces JSON, a veces prosa ya armada (el
    // historial de WhatsApp, los tutoriales). Se pasa tal cual y se dice cuál es
    // cuál — reparsear para «normalizar» rompería los que no son JSON, y adivinar
    // por si parsea es cómo un texto que arranca con `{` se convierte en otra cosa.
    // ⚠️ Un `ToolRunner` puede devolver STRING o `{ content, isError }`. El
    // segundo caso es una herramienta diciendo «esto salió mal» POR ADENTRO de un
    // resultado válido — si se pasara tal cual, el agente recibiría el objeto y lo
    // leería como el dato. Se desarma acá y el fallo sale como fallo.
    const cruda = await runWithWorkspace(ws, () => runMakoTool(que, armado.input));
    const salida = typeof cruda === 'string' ? cruda : cruda.content;
    if (typeof cruda !== 'string' && cruda.isError) {
      return NextResponse.json({ ok: false, que, error: salida }, { status: 400 });
    }
    return NextResponse.json({ ok: true, que, formato: esJson(salida) ? 'json' : 'texto', resultado: salida });
  } catch (err) {
    // Una herramienta lanza cuando el pedido está mal (un leadId que no existe en
    // este workspace), y ese mensaje ya está escrito para que lo lea alguien. Va
    // como 400 y no como 500: el agente puede corregirlo, no es una caída nuestra.
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, que, error: msg }, { status: 400 });
  }
}

/** ¿La salida es JSON? Se prueba parseando, no mirando el primer carácter. */
function esJson(s: string): boolean {
  const t = (s ?? '').trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}
