// =============================================================================
// plan-a-mano — dar el plan a mano con vencimiento (Customers) y avisar al vencer (28/10/2026)
// =============================================================================
// Lo puro (el valor guardado, cuándo toca avisar, los textos) está en lib/plan-a-mano-reglas.ts. Acá, el setting del negocio y
// la vuelta diaria del aviso (la corre app/api/cron/aviso-fin-de-prueba, junto con el aviso de las pruebas por la pasarela).
// ⚠️ Un plan a mano vencido no se corta: el corte de acceso general está apagado (lib/plan-acceso-reglas.ts), y el día que se
// prenda, este plan cae en el corte como cualquier otro (la decisión del Cerebro, 28/10).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { borrarSettingSi, getSetting, setSetting } from './settings';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import { emailDuenoWorkspace } from './usuarios';
import { nombreDePlan } from './clientes-plataforma-reglas';
import { avisosFinDeRegaloCerca, avisosPlanAManoVencido, CLAVE_PLAN_A_MANO, fechaConAnio, leerPlanAMano, planAManoNuevo, tocaAvisarFinDeRegalo, tocaAvisarPlanAMano, type PlanAMano } from './plan-a-mano-reglas';
import { estadoDePrueba, pagaSuPlan } from './prueba-uso';

/** El plan a mano del negocio, o null si no tiene (o si no se pudo leer). */
export async function planAManoDe(ws: number): Promise<PlanAMano | null> {
  return leerPlanAMano(await runWithWorkspace(ws, () => getSetting(CLAVE_PLAN_A_MANO)).catch(() => null));
}

/**
 * Le da al negocio el plan que ya tiene con un vencimiento a los `dias` (7, 14, 30 o los 6 meses gratis, desde Customers). 0 = sin vencimiento (se
 * quita). Nunca a la plataforma. Tira si no se pudo guardar: quien llama lo dice.
 */
export async function ponerPlanAMano(ws: number, dias: number): Promise<PlanAMano | null> {
  if (ws === (await wsSuperAdmin())) throw new Error('La plataforma no tiene plan.');
  return runWithWorkspace(ws, async () => {
    if (dias === 0) {
      const actual = await getSetting(CLAVE_PLAN_A_MANO);
      if (actual != null) await borrarSettingSi(CLAVE_PLAN_A_MANO, actual);
      return null;
    }
    const p = planAManoNuevo(dias, Date.now());
    await setSetting(CLAVE_PLAN_A_MANO, JSON.stringify(p));
    return p;
  });
}

/** Los planes a mano de todos los negocios (Customers y Accounts los muestran). Tira si no se pudo leer: quien llama lo dice. */
export async function planesAManoPorNegocio(): Promise<Map<number, PlanAMano>> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', CLAVE_PLAN_A_MANO).limit(500);
  if (error) throw new Error(`No pude leer los planes a mano: ${error.message}`);
  const out = new Map<number, PlanAMano>();
  for (const f of (data ?? []) as Array<{ workspace_id: number; value: string | null }>) {
    const p = leerPlanAMano(f.value);
    if (p) out.set(Number(f.workspace_id), p);
  }
  return out;
}

/** La fecha en que terminan sus 6 meses gratis, si los tiene vigentes («Tu plan» y la API, sólo a quien no tiene suscripción). */
export async function gratisHastaDe(ws: number): Promise<string | null> {
  const p = await planAManoDe(ws);
  return p?.regalo && Date.parse(p.hasta) > Date.now() ? fechaConAnio(p.hasta) : null;
}

export type VueltaPlanesAMano = { revisados: number; avisados: number; errores: number };

/**
 * Los planes a mano que VENCIERON y no se avisaron, y los 6 meses gratis que TERMINAN PRONTO (`DIAS_AVISO_REGALO`, 30/10/2026): un
 * mail a la persona (el dueño del negocio) y otro a Martín, y la marca para no repetir. Si el de Martín no salió, no se marca:
 * se intenta en la próxima vuelta. Nunca tira por un negocio.
 */
export async function avisarPlanesAManoVencidos(opts: { ahoraMs?: number; enSeco?: boolean } = {}): Promise<VueltaPlanesAMano> {
  const ahoraMs = opts.ahoraMs ?? Date.now();
  const plataforma = await wsSuperAdmin();
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', CLAVE_PLAN_A_MANO).limit(500);
  if (error) throw new Error(`No pude leer los planes a mano: ${error.message}`);
  let avisados = 0, errores = 0;
  for (const f of (data ?? []) as Array<{ workspace_id: number; value: string | null }>) {
    const ws = Number(f.workspace_id);
    if (ws === plataforma) continue;
    const p = leerPlanAMano(f.value);
    if (!p) continue;
    const antes = tocaAvisarFinDeRegalo(p, ahoraMs);
    if (!antes && !tocaAvisarPlanAMano(p, ahoraMs)) continue;
    try {
      // ⚠️ UN NEGOCIO QUE YA PAGA NO RECIBE «TERMINÓ TU PRUEBA» (29/10/2026, la verificación de ddfa645d4): «le doy 7 días, paga el
      //    día 3» es el final esperado, y el aviso le llegaba igual (y a Martín le decía «sigue con los topes de la prueba», sin
      //    topes). Si ya no está en prueba (pagó por la pasarela, o con su email), no se avisa. Sin poder leerlo, tampoco: se mira
      //    de nuevo en la próxima vuelta.
      //    Los 6 meses vigentes no están «en prueba» (no llevan topes): ahí se pregunta directo si ya paga.
      if (antes ? await pagaSuPlan(ws) : !(await estadoDePrueba(ws)).enPrueba) continue;
      if (opts.enSeco) { avisados++; continue; }
      const w = await getWorkspace(ws);
      if (!w) continue;
      // El link de Martín va a donde se resuelve: la ficha de ESE negocio en Admin (la copia de Polar, 6/11/2026: «Editar» da o
      // quita el plan a mano). Antes era Admin › Accounts (`/admin?tab=accounts`), que hoy redirige a la lista de negocios.
      const datos = { negocio: w.nombre, plan: nombreDePlan(w.capa), hasta: p.hasta, linkPlan: linkApp('/configuraciones/plan', ws), linkCustomers: linkApp(`/admin/customers/${ws}`, plataforma) };
      const a = antes ? avisosFinDeRegaloCerca(datos) : avisosPlanAManoVencido({ ...datos, regalo: p.regalo });
      const tag = antes ? 'plan-a-mano-antes' : 'plan-a-mano-fin';
      const duenio = (await emailDuenoWorkspace(ws)).trim().toLowerCase();
      const aLaPersona = duenio
        ? await avisarDePlataforma({ to: duenio, tag, asunto: a.persona.asunto, preheader: antes ? 'Tus 6 meses gratis de MaKo terminan pronto.' : p.regalo ? 'Tus 6 meses gratis de MaKo terminaron.' : 'Tu prueba de MaKo terminó.', cuerpo: a.persona.cuerpo })
        : { enviado: false, error: 'el negocio no tiene dueño con email' };
      const aMartin = await avisarDePlataforma({ to: EMAIL_MAKO, tag, asunto: a.martin.asunto, preheader: antes ? 'Unos 6 meses gratis terminan pronto.' : 'Una prueba dada a mano venció.', cuerpo: a.martin.cuerpo });
      if (!aMartin.enviado) { errores++; console.warn(`[plan-a-mano] no salió el aviso a Martín del negocio ${ws}: ${aMartin.error ?? 'sin detalle'}`); continue; }
      if (!aLaPersona.enviado) console.warn(`[plan-a-mano] no salió el aviso a la persona del negocio ${ws}: ${aLaPersona.error ?? 'sin detalle'}`);
      const marca = new Date(ahoraMs).toISOString();
      await runWithWorkspace(ws, () => setSetting(CLAVE_PLAN_A_MANO, JSON.stringify(antes ? { ...p, avisoPrevioAt: marca } : { ...p, avisadoAt: marca })));
      avisados++;
    } catch (e) {
      errores++;
      console.error(`[plan-a-mano] aviso del negocio ${ws}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { revisados: (data ?? []).length, avisados, errores };
}
