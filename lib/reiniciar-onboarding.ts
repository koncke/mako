// =============================================================================
// REINICIAR EL ONBOARDING SIN TOCAR LO SUYO: qué se reinicia y qué queda (20/11/2026; puro, sin server-only: lo prueba un test)
// =============================================================================
// Martín, 20/11: «resetea al usuario de Leila para que ella pueda hacer todo el onboarding… y una opción en SuperAdmin para resetear
// al usuario sin que pierda su información: sus leads del CRM, si tiene curso cargado, si tiene automatizaciones creadas». Lo hace
// lib/reiniciar-onboarding-server.ts (el botón de la vista de administrador y scripts/reiniciar-onboarding.mts). RESET
// (lib/reset-workspace.ts) es otra cosa: vacía el negocio entero, y sólo en el Cliente de Prueba.
//
// Qué es estado del onboarding y qué es del negocio salió de un inventario de cada escritor y lector (docs/hallazgos-onboarding.md,
// «Reiniciar el onboarding»). Lo que NO se borra, aunque viva al lado:
//   · el WhatsApp verificado (`mako.contacto.verificacion`, `mako.numero_dueno`): con eso MaKo la reconoce por WhatsApp y el reto le
//     contesta. El paso del WhatsApp vuelve a salir con ese número escrito, y con el mismo número pasa sin código nuevo;
//   · lo que el onboarding dejó como dato: el plan del Funnel Coach, la conversación del Offer Coach, el canal, la encuesta, los
//     onboardings de cada pestaña, el clip de regalo (cuesta plata) y el pago;
//   · DENTRO de una clave que sí se reinicia: el bloqueo por troleo (`onboarding.guardia`: lo saca sólo «Desbloquear»), la BAJA del
//     WhatsApp del reto (`reto.avisos.baja`: pidió que no le escriban) y el cursor de la importación (`onboarding.state.extraction`:
//     sin él se vuelve a importar, con gasto de IA).
// =============================================================================
import { estadoDeLoGuardado, estadoInicial } from './onboarding-contrato';
import { CLAVE_EMPEZO_V2, CLAVE_PERFIL } from './recorridos';
import { CLAVE_REINICIO } from './reinicio-en-el-navegador';

/** Las claves de `app_settings` (del negocio) que se BORRAN: sin fila, cada una arranca de cero. */
export const SETTINGS_QUE_SE_BORRAN = [
  'onboarding.arranque', // la conversación del arranque (nombre, WhatsApp, oferta, CRM…): vuelve a «¿cómo te llamas?»
  'onboarding.historial', // el chat «Onboarding»: con el cierre adentro no se le suma nada nuevo
  'onboarding.cerrando', // el candado del cierre (vence solo a los 3 minutos)
  'reto.estado', // el reto de 7 días: el chat lo vuelve a empezar al abrirse (compare-and-set contra «no hay»: tiene que no haber fila)
] as const;

/** Las que se REESCRIBEN: de cero, pero conservando adentro lo que es de la persona (ver `planDeSettings`). */
export const SETTINGS_QUE_SE_REESCRIBEN = ['onboarding.state', 'onboarding.guardia', 'reto.avisos'] as const;

/** Las que se leen para reiniciar. Nada fuera de esta lista se toca. */
export const SETTINGS_QUE_MIRA: readonly string[] = [...SETTINGS_QUE_SE_BORRAN, ...SETTINGS_QUE_SE_REESCRIBEN];

/**
 * Lo que QUEDA, aunque tenga que ver con el onboarding o el reto. La lista existe para el test: si una de éstas aparece entre lo que se
 * borra o se reescribe, cae. Las tablas de datos ni se leen (el reinicio sólo toca `app_settings` y `usuarios.perfil`).
 */
export const LO_QUE_QUEDA = {
  settings: [
    'mako.contacto.verificacion', 'mako.numero_dueno', 'cuenta.whatsapp_del_pago', 'cuenta.origen', 'prueba.aviso_repetida',
    'funnel_coach.plan', 'onboarding_v2.offer_coach', 'onboarding.funnel_tipos', 'onboarding.encuesta', 'reto.clip-regalo',
    'mako.onboarding.answers', 'negocio.fase.diagnostico', 'media-buyer.arranque',
  ],
  /** Prefijos de claves que quedan enteras (los onboardings de cada pestaña: «WhatsApp conectado» no se vuelve a pedir). */
  prefijos: ['onboarding.tab.'],
  tablas: [
    'leads', 'crms', 'funnels', 'cursos', 'automatizaciones', 'guiones', 'ofertas', 'offer_sesiones', 'chart_sessions', 'chart_chats',
    'archivos', 'experimento_tareas', 'cobros', 'workspaces',
  ],
} as const;

/** Las únicas tablas que el reinicio toca (lo mira el test sobre el código del server). */
export const TABLAS_QUE_TOCA = ['app_settings', 'usuarios'] as const;

/** La marca que deja en `usuarios.perfil` del dueño (la lee el layout para limpiar el navegador: lib/reinicio-en-el-navegador.ts). */
export { CLAVE_REINICIO };
/** Los recorridos que se olvidan: los tutoriales del V2 (`tutorial-<pestaña>`, el del Ops Center incluido). Los viejos quedan. */
export const PREFIJO_TUTORIAL = 'tutorial-';

export type FilaSetting = { key: string; value: string };
/** `despues: null` = se borra la fila. */
export type CambioSetting = { key: string; antes: string; despues: string | null; nota: string };

const objeto = (raw: string): Record<string, unknown> | null => {
  try { const x = JSON.parse(raw) as unknown; return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null; } catch { return null; }
};

/** Qué pasa con cada clave del negocio que existe. Lo que no está en `SETTINGS_QUE_MIRA` no aparece nunca. */
export function planDeSettings(filas: readonly FilaSetting[]): CambioSetting[] {
  const out: CambioSetting[] = [];
  for (const f of filas) {
    if ((SETTINGS_QUE_SE_BORRAN as readonly string[]).includes(f.key)) {
      out.push({ key: f.key, antes: f.value, despues: null, nota: 'se borra' });
      continue;
    }
    if (f.key === 'onboarding.state') {
      // De cero (pendiente: la persona vuelve al onboarding), con el cursor de la importación de lo de antes.
      let extraction: ReturnType<typeof estadoInicial>['extraction'] | undefined;
      try { extraction = estadoDeLoGuardado(f.value).extraction; } catch { extraction = undefined; }
      const nuevo = { ...estadoInicial('pending'), ...(extraction ? { extraction } : {}) };
      out.push({ key: f.key, antes: f.value, despues: JSON.stringify(nuevo), nota: 'pendiente otra vez (queda el cursor de la importación)' });
      continue;
    }
    if (f.key === 'onboarding.guardia') {
      const o = objeto(f.value);
      // Con un bloqueo por troleo, la guardia queda ENTERA: el bloqueo lo saca sólo una persona («Desbloquear»).
      if (o?.bloqueo) out.push({ key: f.key, antes: f.value, despues: f.value, nota: 'queda: tiene un bloqueo por troleo' });
      else out.push({ key: f.key, antes: f.value, despues: null, nota: 'se borran los contadores' });
      continue;
    }
    if (f.key === 'reto.avisos') {
      const baja = objeto(f.value)?.baja;
      // La BAJA queda: pidió que el reto no le escriba más por WhatsApp.
      if (typeof baja === 'string' && baja) out.push({ key: f.key, antes: f.value, despues: JSON.stringify({ v: 1, dia: 1, baja }), nota: 'de cero, con su BAJA' });
      else out.push({ key: f.key, antes: f.value, despues: null, nota: 'se borra' });
    }
  }
  // Lo que queda igual no es un cambio.
  return out.filter((c) => c.despues !== c.antes);
}

/** El perfil del dueño sin el estado del onboarding: sin la marca del V2, sin los tutoriales vistos, con la marca del reinicio. */
export function perfilReiniciado(perfil: unknown, ahora: string): { perfil: Record<string, unknown>; quitados: string[] } {
  const base = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? { ...(perfil as Record<string, unknown>) } : {};
  const quitados: string[] = [];
  if (CLAVE_EMPEZO_V2 in base) { delete base[CLAVE_EMPEZO_V2]; quitados.push(CLAVE_EMPEZO_V2); }
  const vistos = base[CLAVE_PERFIL];
  if (vistos && typeof vistos === 'object' && !Array.isArray(vistos)) {
    const quedan: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vistos as Record<string, unknown>)) {
      if (k.startsWith(PREFIJO_TUTORIAL)) quitados.push(`${CLAVE_PERFIL}.${k}`);
      else quedan[k] = v;
    }
    base[CLAVE_PERFIL] = quedan;
  }
  base[CLAVE_REINICIO] = ahora;
  return { perfil: base, quitados };
}

