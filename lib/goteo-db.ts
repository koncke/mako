// =============================================================================
// goteo-db — cuánto subió ya cada automatización con arranque gradual (las reglas, en lib/goteo.ts)
// =============================================================================
// Lo leen el motor (`procesarEnvios`) y aprobar un borrador (lib/borrador-camino.ts). Sale de lo que salió de verdad, no de una fecha guardada: una pausada que vuelve
// después de dos semanas vuelve a empezar (`subidasDelArranque`). ⚠️ Sólo lo que SALIÓ (`enviado`), no el goteo entero (`ESTADOS_DEL_GOTEO` cuenta también los borradores:
// tres días de borradores sin aprobar no calientan un número). Un borrador aprobado cuenta en el día que nació: `anotarPasoEnviado` no cambia su `created_at`.
// =============================================================================
import type { getTenantDb } from './workspace';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { diasQueMiraElArranque, rampaDeEmail, subidasDelArranque, topeConRampa, type ArranqueGoteo, type Goteo } from './goteo';

/** Por automatización, de las que tienen arranque. Sólo lee. TIRA si no puede leer: quien llama decide. */
export async function subidasPorAutomatizacion(db: Awaited<ReturnType<typeof getTenantDb>>, goteos: ReadonlyMap<number, Goteo>, zona: string, ahoraMs = Date.now()): Promise<Map<number, number>> {
  const con = new Map<number, { dia: number; arranque: ArranqueGoteo }>();
  for (const [id, g] of goteos) if (g.arranque && g.dia != null) con.set(id, { dia: g.dia, arranque: g.arranque });
  if (!con.size) return new Map();
  const desde = new Date(ahoraMs - Math.max(...[...con.values()].map(diasQueMiraElArranque)) * 86_400_000).toISOString();
  const filas = await leerTodo<{ id: number; secuencia_id: number | string; created_at: string }>(db, 'nutricion_envios', 'id, secuencia_id, created_at', {
    orden: 'id',
    filtros: (q) => q.in('secuencia_id', [...con.keys()]).eq('canal', 'whatsapp').eq('estado', 'enviado').gte('created_at', desde) as ConsultaPaginada,
  });
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona });
  const porSecuencia = new Map<number, Map<string, number>>();
  for (const f of filas) {
    const ms = Date.parse(f.created_at);
    if (!Number.isFinite(ms)) continue;
    const id = Number(f.secuencia_id);
    const dias = porSecuencia.get(id) ?? new Map<string, number>();
    const d = dia.format(new Date(ms));
    dias.set(d, (dias.get(d) ?? 0) + 1);
    porSecuencia.set(id, dias);
  }
  const hoy = dia.format(new Date(ahoraMs));
  return new Map([...con].map(([id, g]) => [id, subidasDelArranque(porSecuencia.get(id) ?? new Map(), hoy, g)]));
}

/**
 * EL TOPE DE EMAIL DE HOY DEL NEGOCIO, con la rampa del dominio (4/11/2026, `topeConRampa`, lib/goteo.ts). Cuenta los emails
 * de las automatizaciones que SALIERON por día, en la zona del negocio. Sin rampa no lee nada. TIRA si no puede leer: el motor
 * usa entonces el del primer día (manda menos, nunca más).
 */
export async function topeEmailDeHoy(db: Awaited<ReturnType<typeof getTenantDb>>, email: { dia: number; arranqueDia: number; arranqueSube: number }, zona: string, ahoraMs = Date.now()): Promise<number> {
  const g = rampaDeEmail(email);
  if (!g) return email.dia;
  const desde = new Date(ahoraMs - diasQueMiraElArranque(g) * 86_400_000).toISOString();
  const filas = await leerTodo<{ id: number; created_at: string }>(db, 'nutricion_envios', 'id, created_at', {
    orden: 'id',
    filtros: (q) => q.eq('canal', 'email').eq('estado', 'enviado').gte('created_at', desde) as ConsultaPaginada,
  });
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona });
  const dias = new Map<string, number>();
  for (const f of filas) {
    const ms = Date.parse(f.created_at);
    if (!Number.isFinite(ms)) continue;
    const d = dia.format(new Date(ms));
    dias.set(d, (dias.get(d) ?? 0) + 1);
  }
  return topeConRampa(email, dias, dia.format(new Date(ahoraMs)));
}
