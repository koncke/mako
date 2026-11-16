// =============================================================================
// dolar-blue — pone el precio en pesos de los planes al dólar blue del día: lo de verdad (16/11/2026)
// =============================================================================
// La cuenta y los frenos viven en ./dolar-blue-reglas.ts (puro, con su porqué) y la corrida en ./dolar-blue-corrida.ts (con todo
// lo que toca el mundo por parámetro). Acá, lo de verdad: la red (dolarapi.com y, si no contesta, bluelytics: Mercado Pago no
// publica el blue), los settings del negocio de la plataforma y el aviso. La corre una vez por día app/api/cron/dolar-blue.
// Si salta un freno, no se toca nada y queda el aviso: la campanita de la plataforma y un correo a equipo@hola-mako.com
// (EMAIL_MAKO: las notificaciones del super admin van ahí, nunca al Gmail de Martín). Un cambio GRANDE que sí se aplica (los dos
// servicios lo confirmaron) también se avisa, siempre. El freno de emergencia es el estado con `apagada: true`
// (`CLAVE_ESTADO_BLUE`, ./dolar-blue-reglas.ts): con eso no lee ni escribe nada. Cada aviso lo dice.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { crearNotificacion } from './notificaciones';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import type { DepsBlue } from './dolar-blue-corrida';
import type { AvisoBlue } from './dolar-blue-reglas';

export { actualizarPesosAlBlue, leerCotizacion, leerCotizaciones, type CorridaBlue, type DepsBlue } from './dolar-blue-corrida';

/**
 * El aviso de un freno o de un cambio grande (los textos, puros, en ./dolar-blue-reglas.ts: `avisoDelFreno`, `avisoDelCambio`): la
 * campanita de la plataforma y un correo a equipo@hola-mako.com, con el link a Planes en Mercado Pago. Nunca tira. El correo va con
 * `idempotencyKey` (el tipo y el día: la corrida es una por día): le da tope de tiempo al envío (sin clave, un Resend colgado frenaba la ruta hasta su
 * `maxDuration`) y Resend no lo duplica si el cron se reintenta el mismo día.
 */
async function avisarBlue(a: AvisoBlue): Promise<void> {
  const plataforma = await wsSuperAdmin().catch(() => null);
  const cuerpo = [a.texto, `Planes en Mercado Pago: ${linkApp('/admin/cobros', plataforma)}`].join('\n\n');
  try {
    if (plataforma == null) throw new Error('no pude leer el negocio de la plataforma');
    await crearNotificacion({ ws: plataforma, tipo: 'dolar-blue', severidad: a.tipo === 'freno' ? 'warn' : 'info', titulo: a.titulo, descripcion: a.resumen.slice(0, 280), link: '/admin/cobros', entityType: 'dolar-blue', payload: {}, origen: 'sistema:dolar-blue' });
  } catch (e) { console.error('[dolar-blue] no pude dejar la campanita:', e instanceof Error ? e.message : String(e)); }
  const dia = new Date().toISOString().slice(0, 10);
  const mail = await avisarDePlataforma({ to: EMAIL_MAKO, asunto: a.titulo, preheader: a.resumen.slice(0, 140), cuerpo, tag: 'dolar-blue', idempotencyKey: `dolar-blue-${a.tipo}-${dia}` })
    .catch((e) => ({ enviado: false, error: String(e) }));
  if (!mail.enviado) console.error(`[dolar-blue] no salió el correo del aviso: ${'error' in mail ? mail.error : ''}`);
}

/** Lo de verdad: la red, los settings del negocio de la plataforma y el aviso. */
export function depsDeProduccion(): DepsBlue {
  const enLaPlataforma = async <T>(f: () => Promise<T>): Promise<T> => runWithWorkspace(await wsSuperAdmin(), f);
  return {
    consultar: async (url) => {
      const r = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    leer: (clave) => enLaPlataforma(() => getSettingEstricto(clave)),
    cambiarSi: (clave, esperado, nuevo) => enLaPlataforma(() => cambiarSettingSi(clave, esperado, nuevo)),
    guardar: (clave, valor) => enLaPlataforma(() => setSetting(clave, valor)),
    avisar: avisarBlue,
    ahoraMs: () => Date.now(),
  };
}
