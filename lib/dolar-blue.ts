// =============================================================================
// dolar-blue — pone el precio en pesos de los planes al dólar blue del día: lo de verdad (16/11/2026)
// =============================================================================
// La cuenta y los frenos viven en ./dolar-blue-reglas.ts (puro, con su porqué) y la corrida en ./dolar-blue-corrida.ts (con todo
// lo que toca el mundo por parámetro). Acá, lo de verdad: la red (dolarapi.com y, si no contesta, bluelytics: Mercado Pago no
// publica el blue), los settings del negocio de la plataforma y el aviso. La corre una vez por día app/api/cron/dolar-blue.
// Si salta un freno, no se toca nada y queda el aviso: la campanita de la plataforma y un correo a equipo@hola-mako.com
// (EMAIL_MAKO: las notificaciones del super admin van ahí, nunca al Gmail de Martín). Un cambio de más de un 5 % que sí se aplica
// también se avisa, y uno grande siempre; un precio cambiado a mano apaga la automatización y se avisa. El freno de emergencia es
// el estado con `apagada: true` (`CLAVE_ESTADO_BLUE`, ./dolar-blue-reglas.ts): con eso no lee ni escribe nada. Cada aviso lo dice.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { crearNotificacion } from './notificaciones';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import { claveDelAviso, type DepsBlue } from './dolar-blue-corrida';
import { RUTA_DE_LOS_PRECIOS, type AvisoBlue } from './dolar-blue-reglas';

export { actualizarPesosAlBlue, leerCotizacion, leerCotizaciones, type CorridaBlue, type DepsBlue } from './dolar-blue-corrida';

/**
 * El aviso (los textos, puros, en ./dolar-blue-reglas.ts): la campanita de la plataforma y un correo a equipo@hola-mako.com, con el
 * link a Settings › Payments (donde se cambian los precios en pesos; /admin/cobros es un redirect a Sales). Nunca tira. El correo va
 * con `idempotencyKey` (`claveDelAviso`: el tipo, el día y la huella de lo que se manda): le da tope de tiempo al envío (sin clave, un
 * Resend colgado frenaba la ruta hasta su `maxDuration`), Resend no duplica el MISMO aviso si el cron se reintenta, y uno distinto
 * del mismo día sale con su propia clave.
 */
async function avisarBlue(a: AvisoBlue): Promise<void> {
  const plataforma = await wsSuperAdmin().catch(() => null);
  const cuerpo = [a.texto, `Los precios en pesos: ${linkApp(RUTA_DE_LOS_PRECIOS, plataforma)}`].join('\n\n');
  try {
    if (plataforma == null) throw new Error('no pude leer el negocio de la plataforma');
    await crearNotificacion({ ws: plataforma, tipo: 'dolar-blue', severidad: a.tipo === 'freno' ? 'warn' : 'info', titulo: a.titulo, descripcion: a.resumen.slice(0, 280), link: RUTA_DE_LOS_PRECIOS, entityType: 'dolar-blue', payload: {}, origen: 'sistema:dolar-blue' });
  } catch (e) { console.error('[dolar-blue] no pude dejar la campanita:', e instanceof Error ? e.message : String(e)); }
  const correo = { to: EMAIL_MAKO, asunto: a.titulo, preheader: a.resumen.slice(0, 140), cuerpo, tag: 'dolar-blue' };
  const dia = new Date().toISOString().slice(0, 10);
  const mail = await avisarDePlataforma({ ...correo, idempotencyKey: claveDelAviso({ ...correo, tipo: a.tipo, dia }) })
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
