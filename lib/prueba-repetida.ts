// =============================================================================
// prueba-repetida — ¿esta cuenta en prueba ya tuvo una prueba gratis en OTRA cuenta? El aviso al super admin (16/11/2026)
// =============================================================================
// Martín: «la opción C de email y WhatsApp sin mirar la tarjeta… O incluso también podríamos agregar ahí por nombre y negocio». En
// el checkout, el email y el WhatsApp ya cortan la prueba (lib/compra-plan.ts, `puedeEmpezarPrueba`: la compra sigue sin ella). Acá,
// lo que el checkout no ve: quien empezó la prueba con OTRO email y otro WhatsApp, y en el onboarding dice el mismo nombre y el mismo
// negocio que una cuenta que ya tuvo la suya, o confirma un WhatsApp que ya la usó. Eso NO corta nada (un nombre y un negocio
// pueden ser de dos socios): le avisa al super admin, con las dos cuentas, y lo decide una persona.
// Lo llama el onboarding al guardar el nombre o el negocio, o al confirmar el WhatsApp (lib/onboarding-arranque-server.ts,
// `guardarEstadoArranque` → `programarAvisoDePrueba`), después de contestar. Lo puro (cómo se compara), en lib/compra-plan-reglas.ts.
// =============================================================================

import 'server-only';
import { EMAIL_MAKO, linkApp } from './app-url';
import { getSupabaseServer } from './supabase';
import { getSetting, setSetting } from './settings';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { avisarDePlataforma } from './invitaciones';
import { huellaDeNombreYNegocio, whatsappsDeLaPrueba } from './compra-plan-reglas';
import type { EstadoArranque } from './onboarding-arranque';

/** Donde el onboarding guarda lo que contestó (lib/onboarding-arranque-server.ts). */
const CLAVE_ARRANQUE = 'onboarding.arranque';

function parseEstado(raw: string | null): EstadoArranque {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as EstadoArranque) : {};
  } catch { return {}; }
}

/** Las coincidencias que ya se avisaron en este negocio («<otro negocio>:<motivo>»): el mismo aviso no sale dos veces. */
const CLAVE_AVISO_PRUEBA = 'prueba.aviso_repetida';

type FilaDePrueba = { alta_ws: number; email: string | null; nombre: string | null; origen: { whatsapp?: unknown } | null; created_at: string };

/**
 * ¿Este negocio, que está en su prueba gratis, coincide con OTRA cuenta que ya tuvo la suya, por el nombre y el negocio que dijo
 * en el onboarding o por el WhatsApp que confirmó? Si sí, un correo a equipo@hola-mako.com con las dos cuentas (una vez por cuenta y
 * motivo). Quién tuvo prueba: los cobros de la plataforma «planes:<plan>:prueba» que se autorizaron, con la cuenta que crearon
 * (`alta_ws`); lo que dijo cada una, su `onboarding.arranque`. Un negocio que no empezó con la prueba no se mira: pagó.
 */
export async function avisarSiYaTuvoPrueba(ws: number, e: Pick<EstadoArranque, 'nombre' | 'negocio' | 'telefono' | 'telefonoNumero'>): Promise<'sin-prueba' | 'nada' | 'ya-avisado' | 'avisado' | 'no-salio'> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma) return 'sin-prueba';
  const db = getSupabaseServer();
  const pruebas = () => db.from('cobros').select('alta_ws, email, nombre, origen, created_at')
    .eq('workspace_id', plataforma).like('creado_por', 'planes:%:prueba').not('suscripcion_estado', 'is', null).not('alta_ws', 'is', null);
  const { data: propias, error: e1 } = await pruebas().eq('alta_ws', ws).order('created_at', { ascending: false }).limit(1);
  if (e1) throw new Error(`no pude leer la prueba del negocio ${ws}: ${e1.message}`);
  const propia = (propias ?? [])[0] as FilaDePrueba | undefined;
  if (!propia) return 'sin-prueba';
  const huella = huellaDeNombreYNegocio(e.nombre, e.negocio);
  const numeros = e.telefono === 'verificado' ? whatsappsDeLaPrueba(e.telefonoNumero) : null;
  if (!huella && !numeros) return 'nada';

  const { data: otrasFilas, error: e2 } = await pruebas().neq('alta_ws', ws).order('created_at', { ascending: false }).limit(2000);
  if (e2) throw new Error(`no pude leer las otras pruebas: ${e2.message}`);
  const otras = new Map<number, FilaDePrueba>();
  for (const f of (otrasFilas ?? []) as FilaDePrueba[]) if (!otras.has(Number(f.alta_ws))) otras.set(Number(f.alta_ws), f);
  const coinciden = new Map<number, Set<string>>();
  const sumar = (w: number, motivo: string) => { const m = coinciden.get(w) ?? new Set<string>(); m.add(motivo); coinciden.set(w, m); };
  const mismoNumero = (x: unknown) => !!numeros && !!whatsappsDeLaPrueba(typeof x === 'string' ? x : null)?.some((n) => numeros.includes(n));
  // El WhatsApp que dio al empezar la otra prueba (el `origen` de su cobro).
  for (const [w, f] of otras) if (mismoNumero(f.origen?.whatsapp)) sumar(w, 'el WhatsApp');
  // Lo que dijo la otra cuenta en SU onboarding: el nombre y el negocio, y el WhatsApp que confirmó.
  const ids = [...otras.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_ARRANQUE).in('workspace_id', ids.slice(i, i + 200));
    if (error) throw new Error(`no pude leer el onboarding de las otras cuentas: ${error.message}`);
    for (const r of (data ?? []) as Array<{ workspace_id: number; value: string | null }>) {
      const o = parseEstado(r.value);
      if (huella && huellaDeNombreYNegocio(o.nombre, o.negocio) === huella) sumar(Number(r.workspace_id), 'el nombre y el negocio');
      if (o.telefono === 'verificado' && mismoNumero(o.telefonoNumero)) sumar(Number(r.workspace_id), 'el WhatsApp');
    }
  }
  if (!coinciden.size) return 'nada';

  // Una vez por cuenta y motivo: el onboarding guarda el nombre y el negocio más de una vez.
  const crudo = await runWithWorkspace(ws, () => getSetting(CLAVE_AVISO_PRUEBA)).catch(() => null);
  let ya: string[] = [];
  try { const v = JSON.parse(crudo ?? '[]'); if (Array.isArray(v)) ya = v.filter((x): x is string => typeof x === 'string'); } catch { /* sin lista, se avisa */ }
  const nuevas = [...coinciden].flatMap(([w, ms]) => [...ms].map((m) => `${w}:${m}`)).filter((k) => !ya.includes(k));
  if (!nuevas.length) return 'ya-avisado';

  const nombreDe = async (w: number) => (await getWorkspace(w).catch(() => null))?.nombre?.trim() || `negocio ${w}`;
  const dia = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  const esta = await nombreDe(ws);
  const lineas: string[] = [];
  for (const [w, ms] of coinciden) {
    const f = otras.get(w);
    lineas.push(`La otra (negocio ${w}): «${await nombreDe(w)}» · su prueba la empezó ${f?.nombre || 'alguien'} con ${f?.email || 'un email que no está'}${f?.created_at ? ` el ${dia(f.created_at)}` : ''}. Coincide ${[...ms].join(' y ')}.`);
  }
  const asunto = `Una prueba gratis repetida: «${esta}» coincide con otra cuenta`;
  const cuerpo = [
    `La cuenta «${esta}» (negocio ${ws}) está en su prueba gratis, y lo que dijo en el onboarding coincide con ${coinciden.size === 1 ? 'una cuenta que ya tuvo la suya' : `${coinciden.size} cuentas que ya tuvieron la suya`}.`,
    `Esta (negocio ${ws}): ${e.nombre || 'sin nombre'} · «${e.negocio || 'sin negocio'}»${e.telefono === 'verificado' && e.telefonoNumero ? ` · WhatsApp ${e.telefonoNumero}` : ''} · su prueba la empezó ${propia.email || 'un email que no está'} el ${dia(propia.created_at)}.`,
    ...lineas,
    'No se cortó nada: un nombre y un negocio pueden ser de dos socios. Si es la misma persona, se decide a mano en Cobros:',
    linkApp('/admin/cobros', plataforma),
  ].join('\n\n');
  const r = await avisarDePlataforma({ to: EMAIL_MAKO, asunto, preheader: `Coincide ${[...new Set([...coinciden.values()].flatMap((m) => [...m]))].join(' y ')} con otra cuenta.`, cuerpo, tag: 'prueba-repetida', idempotencyKey: `prueba-repetida-${ws}-${nuevas.join('-')}`.replace(/[^a-z0-9-]/gi, '').slice(0, 200) });
  // Si el correo no salió, no se anota: el próximo guardado lo vuelve a intentar.
  if (!r.enviado) { console.error(`[arranque] no salió el aviso de la prueba repetida del negocio ${ws}: ${r.error ?? 'sin detalle'}`); return 'no-salio'; }
  await runWithWorkspace(ws, () => setSetting(CLAVE_AVISO_PRUEBA, JSON.stringify([...ya, ...nuevas])));
  return 'avisado';
}
