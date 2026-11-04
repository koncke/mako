// =============================================================================
// Revertir la cuenta de revisión de las tiendas (4/11/2026) — ⚠️ ESCRIBE EN PRODUCCIÓN (la base de .env.local)
// =============================================================================
// La creó scripts/tiendas-cuenta-revision.mts (docs/relevo/nube-tiendas.md). Dos salidas, y hay que elegir una:
//
//   --corte  La cuenta deja de entrar YA: su fila pasa a «suspendido» (la sesión abierta muere en el próximo pedido, porque
//            `getUsuarioActual` relee la fila, y la contraseña ya no entra), se borran sus avisos del teléfono y se revocan las
//            computadoras de su negocio. No borra nada más. Para volver a abrirla: --total y crearla de nuevo.
//   --total  Borra la persona y después el negocio 900001 entero, con lo que tenga adentro (`eliminarWorkspace`, el mismo borrado del
//            panel de SuperAdmin). Sólo si el negocio sigue siendo el de demostración: se llama «Negocio de demostración», no hay
//            nadie más adentro y todos sus leads son @example.com. Si no, no borra nada y avisa.
//
// Lo corre el Cerebro desde la PC, con el sí de Martín:
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision-revertir.mts --corte
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision-revertir.mts --total
// Y después se saca la cuenta de Play Console y de App Store Connect: si no, el revisor prueba una que ya no entra.
//
// Termina con error (código 1) si algo no salió, y relee la base antes de decir ✓: un borrado que contestó ok no es un borrado hecho.
// tests/cuenta-revision.test.ts lo corre entero sobre el PostgREST de mentira (tests/_cuenta-revision-script-hijo.ts).
// =============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const corte = process.argv.includes('--corte');
const total = process.argv.includes('--total');
if (corte === total) {
  console.error('⛔ Elige una: --corte (deja de entrar, no borra nada) o --total (borra la persona y su negocio).');
  process.exit(1);
}

const { CUENTA_DE_REVISION, WS_REVISION, NOMBRE_NEGOCIO_REVISION, esCorreoDeEjemplo } = await imp('lib/cuenta-revision-reglas.ts');
const { WS_PRUEBAS, OWNER_WS } = await imp('lib/auth-session.ts');
if (WS_PRUEBAS.includes(WS_REVISION) || WS_REVISION === OWNER_WS) { console.error('⛔ El negocio de la cuenta de revisión no puede ser uno de prueba ni el ws 1.'); process.exit(1); }

const { getSupabaseServer } = await imp('lib/supabase.ts');
const { getWorkspace } = await imp('lib/workspace.ts');
const db = getSupabaseServer();

type Persona = { id: number; email: string | null; estado: string | null; workspace_id: number | null };
async function leerPersonas(): Promise<{ laCuenta: Persona | null; delNegocio: Persona[] }> {
  const [porCorreo, porNegocio] = await Promise.all([
    db.from('usuarios').select('id, email, estado, workspace_id').eq('email', CUENTA_DE_REVISION.email),
    db.from('usuarios').select('id, email, estado, workspace_id').eq('workspace_id', WS_REVISION),
  ]);
  const error = porCorreo.error ?? porNegocio.error;
  if (error) { console.error(`⛔ No pude leer las personas (${error.message}). No toqué nada.`); process.exit(1); }
  return { laCuenta: ((porCorreo.data ?? []) as Persona[])[0] ?? null, delNegocio: (porNegocio.data ?? []) as Persona[] };
}

const { laCuenta, delNegocio } = await leerPersonas();

// ── --corte ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (corte) {
  if (!laCuenta) { console.log('✓ No hay cuenta de revisión: no hay nada que cortar.'); process.exit(0); }
  const fallaron: string[] = [];
  const pasos: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
    ['su entrada', db.from('usuarios').update({ estado: 'suspendido' }).eq('id', laCuenta.id)],
    ['sus avisos del teléfono', db.from('push_suscripciones').delete().eq('usuario_id', laCuenta.id)],
    ['las computadoras de su negocio', db.from('ia_pc_dispositivos').update({ revocado_at: new Date().toISOString() }).eq('workspace_id', WS_REVISION).is('revocado_at', null)],
  ];
  for (const [que, q] of pasos) {
    const { error } = await q;
    if (error) fallaron.push(`${que} (${error.message})`);
  }
  const { data: releida, error: eRelectura } = await db.from('usuarios').select('estado').eq('id', laCuenta.id).maybeSingle();
  if (eRelectura || (releida as { estado?: string } | null)?.estado !== 'suspendido') fallaron.push('releer que quedó suspendida');
  if (fallaron.length) { console.error(`⛔ No pude cortar ${fallaron.join(' · ')}. Vuelve a correrlo.`); process.exit(1); }
  console.log(`✓ Cortada: la cuenta ${laCuenta.id} ya no entra y su sesión muere en el próximo pedido. Sácala de Play Console y de App Store Connect.`);
  process.exit(0);
}

// ── --total ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// En POSITIVO: se borra sólo si todo dice que es el negocio de demostración. Cualquier otra cosa adentro, y no se toca nada.
const negocio = await getWorkspace(WS_REVISION) as { id: number; nombre: string } | null;
if (!negocio) {
  if (laCuenta) { console.error(`⛔ El negocio ${WS_REVISION} no existe y la cuenta ${laCuenta.id} sí, en el negocio ${laCuenta.workspace_id}: alguien la movió. No la borro: revísala a mano.`); process.exit(1); }
  console.log('✓ No hay negocio ni cuenta de revisión: no hay nada que borrar.');
  process.exit(0);
}
const frenos: string[] = [];
if (negocio.nombre !== NOMBRE_NEGOCIO_REVISION) frenos.push(`el negocio ${WS_REVISION} se llama «${negocio.nombre}», no «${NOMBRE_NEGOCIO_REVISION}»`);
const otros = delNegocio.filter((p) => p.email !== CUENTA_DE_REVISION.email);
if (otros.length) frenos.push(`hay ${otros.length} ${otros.length === 1 ? 'persona más' : 'personas más'} adentro`);
if (laCuenta && laCuenta.workspace_id !== WS_REVISION) frenos.push(`la cuenta ${laCuenta.id} está en el negocio ${laCuenta.workspace_id}, no en el ${WS_REVISION}`);
const { data: leads, error: eLeads } = await db.from('leads').select('email').eq('workspace_id', WS_REVISION);
if (eLeads) frenos.push(`no pude leer sus leads (${eLeads.message})`);
else {
  const deVerdad = ((leads ?? []) as Array<{ email: string | null }>).filter((l) => !esCorreoDeEjemplo(l.email)).length;
  if (deVerdad) frenos.push(`${deVerdad} ${deVerdad === 1 ? 'lead no es' : 'leads no son'} de ejemplo`);
}
if (frenos.length) { console.error(`⛔ No borré nada: ${frenos.join(' · ')}. Revísalo a mano.`); process.exit(1); }

const { eliminarWorkspace } = await imp('lib/eliminar-workspace.ts');
const r = await eliminarWorkspace(WS_REVISION, negocio.nombre, null) as { ok: boolean; error?: string; avisos?: string[]; usuarios?: number };
for (const a of r.avisos ?? []) console.error(`⚠️ ${a}`);
if (!r.ok) { console.error(`⛔ No pude borrar el negocio: ${r.error}. Lo que ya se vació queda vacío; vuelve a correrlo.`); process.exit(1); }
// Releer: el negocio y la persona tienen que no estar.
const despues = await leerPersonas();
const sigueElNegocio = await getWorkspace(WS_REVISION);
if (sigueElNegocio || despues.laCuenta || despues.delNegocio.length) {
  console.error('⛔ El borrado contestó ok, pero el negocio o la persona siguen en la base. Vuelve a correrlo.');
  process.exit(1);
}
console.log(`✓ Borrados la cuenta de revisión y el negocio ${WS_REVISION}. Sácala de Play Console y de App Store Connect.`);
