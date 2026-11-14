// =============================================================================
// tope-automations — «hasta 3 automatizaciones activas» del Esencial, al ACTIVAR una (23/10/2026)
// =============================================================================
// docs/ofertas-mako.md y lib/topes-plan.ts (`automations.activas`). Lo pregunta `setSecuenciaActiva` (lib/nutricion.ts), la
// única puerta que prende una automatización, y tira `TopeDelPlanError` (23/10/2026: estaba en cada puerta; ahí lo cubre
// cualquier camino nuevo). Las rutas lo contestan 403 con `tope: true` y MaKo lo dice en su resumen.
// ⚠️ SÓLO AL ESENCIAL DE LA PASARELA (lib/plan-esencial.ts): al ws1, a la plataforma, a los acuerdos a mano y al Pro, nunca.
// ⚠️ PRENDER UNA QUE YA ESTÁ PRENDIDA no cuenta como una más (el lienzo vuelve a mandar «activa» al publicar).
//
// EL SETTER CON IA ES DE MaKo PRO (14/11/2026, Martín: 'setter-ia', lib/topes-plan.ts). Lo que es el setter, puro y con test:
// lib/setter-ia-reglas.ts (lo que le contesta SOLO a un lead con IA). Dos candados, los dos con `TopeDelPlanError` y el texto de
// `textoSoloPro('setter-ia')`, para que las rutas y MaKo lo digan como ya dicen el tope:
//   · ACTIVAR (`topeAlActivar`): una automatización con el setter no se prende. Va ANTES que el tope de las 2 activas: si las
//     dos cosas frenan, lo que hay que saber es que el setter es de Pro (con una activa menos tampoco se prendería).
//   · GUARDAR LOS PASOS (`setterNuevoSoloPro`, desde `setSecuenciaPasos`): no se crea uno donde no estaba. Por ahí pasan el
//     lienzo, el teléfono, la API («agregar caso» con `contestaSolo`) y el hand-off que se enseña.
import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { esEsencialDe } from './plan-esencial';
import { cabeOtra, textoTope, topeDe } from './topes-plan';
import { TEXTO_SETTER_SOLO_PRO, filaConSetterIA, sumaSetterIA } from './setter-ia-reglas';
import { parseEstrategia } from './setting-estrategia';

/** null = se puede activar; un texto = el tope del plan (o el candado del setter), para mostrarle a la persona. */
export async function topeAlActivar(id: number, wsDado?: number): Promise<string | null> {
  // MaKo por WhatsApp corre sin sesión: el negocio lo pasa quien llama.
  const ws = wsDado ?? (await getWorkspaceActual());
  if (ws == null || !(await esEsencialDe(ws))) return null;
  const db = await getTenantDb();
  const { data: esta } = await db.from('nutricion_secuencias').select('activa, pasos, estrategia').eq('id', id).maybeSingle();
  const fila = esta as { activa?: boolean; pasos?: unknown; estrategia?: unknown } | null;
  if (fila?.activa === true) return null;
  // El setter con IA, con lo PUBLICADO (es lo que prende Activar; el borrador del lienzo no corre), y la forma de antes (los
  // casos de la estrategia que contestan solos, sin «Si responde»; sólo en modo asistido, el único que contesta).
  const est = parseEstrategia(fila?.estrategia);
  if (filaConSetterIA(fila?.pasos, est?.modo === 'asistido' ? est.escenarios : null)) return TEXTO_SETTER_SOLO_PRO;
  const tope = topeDe('completo', 'automations.activas');
  if (tope == null) return null;
  const { count, error } = await db.from('nutricion_secuencias').select('id', { count: 'exact', head: true })
    .eq('activa', true).is('archivada_at', null);
  // Ante la duda, se deja: un error de lectura no le frena el trabajo a quien paga.
  if (error) return null;
  return cabeOtra('completo', 'automations.activas', count ?? 0) ? null : textoTope(tope);
}

/**
 * ¿Guardar `nuevos` (sobre lo guardado, `antes`) le CREA el setter con IA a un Esencial? null = se puede; si no, el texto del
 * candado. Lo barato primero: sin un setter nuevo en los pasos, no se lee el plan. Ante la duda (sin negocio, o sin poder leer
 * el plan: `esEsencialDe` ya devuelve false), pasa.
 */
export async function setterNuevoSoloPro(antes: unknown, nuevos: unknown, wsDado?: number): Promise<string | null> {
  if (!sumaSetterIA(antes, nuevos)) return null;
  const ws = wsDado ?? (await getWorkspaceActual().catch(() => null));
  return ws != null && (await esEsencialDe(ws)) ? TEXTO_SETTER_SOLO_PRO : null;
}
