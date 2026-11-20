import 'server-only';
// =============================================================================
// LA VUELTA DE CADA HORA DE LOS AVISOS DEL RETO (20/11/2026)
// =============================================================================
// Reemplaza al correo de las 10:00 de Argentina que salía desde el cron aviso-fin-de-prueba (borrado el 20/11): ahora corre cada hora
// (app/api/cron/reto-avisos) y manda lo que decide lib/reto/avisos.ts, a la hora que eligió cada persona. Recorre los negocios con
// reto (`reto.estado`), sólo a quien ve el onboarding V2 (lib/onboarding-v2/revision.ts).
//
//   · El WhatsApp va por la línea de MaKo, en el chat PRIVADO (`enviarAPersonaMaKo`: sólo a quien ya le escribió, nunca a un grupo),
//     al número que verificó en el onboarding V2. Sólo a los negocios de la revisión mientras el V2 no está para todos
//     (`porWhatsApp`): a un cliente real, recién cuando Martín prenda el V2.
//   · Antes de mandar se guarda lo que va a salir (`reto.avisos`, con compare-and-set): de dos vueltas a la vez, manda UNA. Si algo
//     no sale, no se reintenta: un aviso perdido es mejor que dos iguales. Nunca tira por un negocio.
// =============================================================================
import { getSupabaseServer } from '../supabase';
import { cambiarSettingSi } from '../settings';
import { runWithWorkspace } from '../workspace';
import { avisarDePlataforma } from '../invitaciones';
import { linkApp } from '../app-url';
import { crearNotificacion } from '../notificaciones';
import { enviarPush } from '../push';
import { enviarAPersonaMaKo } from '../mako-grupo';
import { PARA_TODOS, WS_REVISION_V2, veOnboardingV2 } from '../onboarding-v2/revision';
import { CLAVE_RETO, correoDelDia, diasDelReto, leerEstado } from './dias';
import {
  CLAVE_AVISOS, PREHEADER_DIA, RUTA_RETO, avisoDeLaNoche, avisoDelDia, hayQueGuardar, horaEnSuZona, leerAvisos, queMandar,
  whatsappDeAbandono, whatsappDelDia,
} from './avisos';

const KEY_VERIFICACION = 'mako.contacto.verificacion';
/** El plan de Funnel Coach: su funnel principal arma los días 4 a 6 (`diasDelReto`). */
const KEY_PLAN_FUNNEL = 'funnel_coach.plan';

function funnelDe(crudo: string | null): string | null {
  try { const p = JSON.parse(crudo ?? 'null') as { funnel?: unknown } | null; return typeof p?.funnel === 'string' ? p.funnel : null; } catch { return null; }
}

export type VueltaReto = { revisados: number; manana: number; noche: number; abandono: number; whatsapp: number; errores: number };

/** ¿Este negocio recibe el WhatsApp del reto? Los de la revisión, hasta que el V2 esté para todos. */
export const retoPorWhatsApp = (ws: number): boolean => PARA_TODOS || WS_REVISION_V2.includes(ws);

/** El número que verificó por el onboarding V2 (al que MaKo ya le contestó con el código) y su nombre. */
function delV2(crudo: string | null | undefined): { destino: string; nombre: string } | null {
  try {
    const v = JSON.parse(crudo ?? 'null') as { v2?: boolean; verificado?: boolean; destino?: string; telefono?: string; nombre?: string } | null;
    const destino = String(v?.destino || v?.telefono || '').replace(/\D/g, '');
    return v?.v2 === true && v.verificado === true && destino.length >= 8 ? { destino, nombre: v.nombre ?? '' } : null;
  } catch { return null; }
}

type Persona = { email: string | null; rol_ws: string | null; estado?: string | null; ultimo_login?: string | null; workspace_id: number };

export async function avisarDelReto(opts: { ahoraMs?: number; enSeco?: boolean } = {}): Promise<VueltaReto> {
  const ahora = opts.ahoraMs ?? Date.now();
  const db = getSupabaseServer();
  const { data, error } = await db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETO).limit(500);
  if (error) throw new Error(`No pude leer los retos: ${error.message}`);
  const retos = (data ?? []) as Array<{ workspace_id: number; value: unknown }>;
  const r: VueltaReto = { revisados: retos.length, manana: 0, noche: 0, abandono: 0, whatsapp: 0, errores: 0 };
  if (!retos.length) return r;
  const wss = retos.map((f) => Number(f.workspace_id));

  const [otras, gente] = await Promise.all([
    db.from('app_settings').select('workspace_id, key, value').in('workspace_id', wss).in('key', [CLAVE_AVISOS, KEY_VERIFICACION, KEY_PLAN_FUNNEL]),
    db.from('usuarios').select('workspace_id, email, rol_ws, estado, ultimo_login').in('workspace_id', wss).limit(2000),
  ]);
  if (otras.error) throw new Error(`No pude leer los avisos del reto: ${otras.error.message}`);
  if (gente.error) throw new Error(`No pude leer las personas de los retos: ${gente.error.message}`);
  const valor = (ws: number, key: string) => ((otras.data ?? []) as Array<{ workspace_id: number; key: string; value: string | null }>)
    .find((x) => Number(x.workspace_id) === ws && x.key === key)?.value ?? null;

  for (const fila of retos) {
    const ws = Number(fila.workspace_id);
    const e = leerEstado(fila.value);
    if (!e) continue;
    try {
      const admins = ((gente.data ?? []) as Persona[])
        .filter((u) => Number(u.workspace_id) === ws && (u.rol_ws === 'admin' || u.rol_ws == null) && u.estado !== 'suspendido');
      const para = [...new Set(admins.filter((u) => u.email).map((u) => u.email!.trim().toLowerCase()))].filter((email) => veOnboardingV2({ email, ws }));
      if (!para.length) continue;
      const visitas = admins.map((u) => Date.parse(u.ultimo_login ?? '')).filter((x) => !Number.isNaN(x));
      const crudoAvisos = valor(ws, CLAVE_AVISOS);
      const a = leerAvisos(crudoAvisos, e);
      const v2 = delV2(valor(ws, KEY_VERIFICACION));
      const plan = queMandar({ e, a, ahora, ultimaVisita: visitas.length ? Math.max(...visitas) : null, porWhatsApp: !!v2 && retoPorWhatsApp(ws) });
      if (!hayQueGuardar(a, plan.avisos)) continue;
      if (opts.enSeco) { contar(r, plan); continue; }
      // Primero se guarda: de dos vueltas a la vez, la que no gana no manda nada.
      const gane = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_AVISOS, crudoAvisos, JSON.stringify(plan.avisos)));
      if (!gane) continue;
      contar(r, plan);
      const link = linkApp(RUTA_RETO, ws);

      if (plan.manana) {
        const { dia } = plan.manana;
        const app = avisoDelDia(dia);
        await crearNotificacion({ ws, tipo: 'reto-dia', titulo: app.titulo, descripcion: app.texto, link: RUTA_RETO, entityType: 'reto', entityId: String(dia) });
        await enviarPush(ws, { tipo: 'reto-dia', titulo: app.titulo, cuerpo: app.texto, ruta: RUTA_RETO, tag: `reto-dia-${dia}`, soloAdmins: true });
        const m = { ...correoDelDia(dia, link, diasDelReto(funnelDe(valor(ws, KEY_PLAN_FUNNEL)))), preheader: PREHEADER_DIA };
        for (const to of para) {
          const c = await avisarDePlataforma({ to, tag: 'reto-dia', asunto: m.asunto, preheader: m.preheader, cuerpo: m.cuerpo, idempotencyKey: `reto-${ws}-${dia}-${to}` });
          if (!c.enviado) console.warn(`[reto] no salió el correo del día ${dia} a ${to} (ws ${ws}): ${c.error ?? 'sin detalle'}`);
        }
        if (plan.manana.whatsapp && v2) {
          const w = await enviarAPersonaMaKo(v2.destino, whatsappDelDia(v2.nombre, dia, Math.floor(horaEnSuZona(ahora, e.zona))));
          if (w.ok) r.whatsapp++; else { r.errores++; console.warn(`[reto] no salió el WhatsApp del día ${dia} (ws ${ws}): ${w.error}`); }
        }
      }
      if (plan.noche) {
        const n = avisoDeLaNoche(plan.noche.tarea);
        await crearNotificacion({ ws, tipo: 'reto-falta', titulo: n.titulo, descripcion: n.texto, link: RUTA_RETO, entityType: 'reto', entityId: String(plan.noche.dia) });
        await enviarPush(ws, { tipo: 'reto-falta', titulo: n.titulo, cuerpo: n.texto, ruta: RUTA_RETO, tag: 'reto-falta', soloAdmins: true });
      }
      if (plan.abandono && v2) {
        const w = await enviarAPersonaMaKo(v2.destino, whatsappDeAbandono(v2.nombre, plan.abandono.dia));
        if (w.ok) r.whatsapp++; else { r.errores++; console.warn(`[reto] no salió el WhatsApp de Martín por abandono (ws ${ws}): ${w.error}`); }
      }
    } catch (x) {
      r.errores++;
      console.error(`[reto] avisos (ws ${ws}):`, x instanceof Error ? x.message : String(x));
    }
  }
  return r;
}

function contar(r: VueltaReto, plan: ReturnType<typeof queMandar>): void {
  if (plan.manana) r.manana++;
  if (plan.noche) r.noche++;
  if (plan.abandono) r.abandono++;
}
