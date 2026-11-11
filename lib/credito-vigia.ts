// =============================================================================
// credito-vigia — el vigía del crédito de Claude: el % de cada cuenta y el aviso a Martín (11/11/2026)
// =============================================================================
// Desde el 11/11/2026 el espacio de MaKo y WhatsApp gastan PRIMERO el crédito de las cuentas Max (Martín: «gastemos eso para
// todo esto en lugar de Gemini, porque es mucho más estable»). Lo único que cortaba era Anthropic contestando «sin saldo», y
// nadie se enteraba antes. Esto corre desde /api/cron/alerta-critica (cada 10 minutos):
//   · lee lo registrado (`leerCreditoApi`, lib/credito-api-db.ts) y guarda el % de cada cuenta en `ia.credito.uso` de la
//     plataforma: con él el reparto va primero por la que menos gastó y la plataforma deja el último 10% para WhatsApp;
//   · avisa al 80% y al 100% de una cuenta, UNA vez por ciclo cada uno, al grupo de SuperAdmin y a la campanita del ws
//     SuperAdmin. El «una vez» se reclama con compare-and-set (`cambiarSettingSi`), sobre el molde de `avisarUnaVez`
//     (lib/agencia-mes.ts): de dos corridas a la vez gana UNA, y si el aviso no salió, se suelta el reclamo.
// Las reglas (qué avisar, qué % guardar) son puras: `avisosDelCredito`, lib/credito-api.ts, con su test.
// Nunca tira: un vigía que falla no puede tirar el cron de la guardia.
// =============================================================================

import 'server-only';
import { CLAVE_USO_DEL_CREDITO, PREFIJO_AVISO_DEL_CREDITO, avisosDelCredito, type AvisoDelCredito } from './credito-api';
import { leerCreditoApi } from './credito-api-db';
import { borrarSettingSi, cambiarSettingSi, getSettingsConPrefijo, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type CorridaDelVigia = {
  ok: boolean; error?: string;
  /** El % guardado, por nombre de clave. */
  uso?: Record<string, number>;
  avisos: Array<{ clave: string; r: 'avisado' | 'ya-estaba' | 'fallo' }>;
};

/** Al grupo de SuperAdmin y a la campanita del ws SuperAdmin. Llegó si salió por alguno de los dos. */
async function mandar(a: AvisoDelCredito, ws: number): Promise<boolean> {
  const { enviarAlGrupoSuperAdmin } = await import('./mako-grupo');
  const { crearNotificacion } = await import('./notificaciones');
  const grupo = await enviarAlGrupoSuperAdmin(`Crédito de Claude · ${a.texto}`).then((r) => r.ok, (e) => { console.error(`[credito-vigia] no salió al grupo: ${msg(e)}`); return false; });
  const campanita = await crearNotificacion({
    ws, tipo: 'credito-claude', severidad: a.nivel === '80' ? 'warn' : 'urgente', titulo: a.nivel === '80' ? 'El crédito de Claude se está acabando' : a.nivel === '100' ? 'Se acabó el crédito de Claude de una cuenta' : 'No pude leer el gasto del crédito de Claude',
    descripcion: a.texto.slice(0, 280), link: '/admin/operaciones', entityType: 'credito-claude', entityId: a.cuenta, payload: { nivel: a.nivel }, origen: 'sistema:credito-claude',
  }).then((id) => id != null, () => false);
  return grupo || campanita;
}

export async function vigilarCreditoClaude(ahora = Date.now()): Promise<CorridaDelVigia> {
  try {
    const lectura = await leerCreditoApi(ahora);
    if (!lectura.ok) return { ok: false, error: lectura.error, avisos: [] };
    const ws = await wsSuperAdmin();
    return await runWithWorkspace(ws, async () => {
      const ya = new Set((await getSettingsConPrefijo(PREFIJO_AVISO_DEL_CREDITO)).keys());
      const { avisos, uso } = avisosDelCredito(lectura.filas, ya, ahora);
      await setSetting(CLAVE_USO_DEL_CREDITO, JSON.stringify({ at: new Date(ahora).toISOString(), cuentas: uso }));
      const hechos: CorridaDelVigia['avisos'] = [];
      for (const a of avisos) {
        const v = JSON.stringify({ at: new Date(ahora).toISOString(), nivel: a.nivel, cuenta: a.cuenta });
        if (!(await cambiarSettingSi(a.clave, null, v))) { hechos.push({ clave: a.clave, r: 'ya-estaba' }); continue; }
        if (await mandar(a, ws)) { hechos.push({ clave: a.clave, r: 'avisado' }); continue; }
        // No salió por ningún lado: se suelta el reclamo, para que la corrida siguiente lo intente.
        await borrarSettingSi(a.clave, v).catch(() => false);
        hechos.push({ clave: a.clave, r: 'fallo' });
      }
      return { ok: true, uso, avisos: hechos };
    });
  } catch (e) {
    console.error(`[credito-vigia] no pude vigilar el crédito de Claude: ${msg(e)}`);
    return { ok: false, error: msg(e), avisos: [] };
  }
}
