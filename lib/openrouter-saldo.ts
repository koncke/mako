// =============================================================================
// openrouter-saldo — el saldo de OpenRouter, leído de la API y no cargado a mano
// =============================================================================
// POR QUÉ EXISTE Y POR QUÉ ES DISTINTO AL RESTO. El saldo de los demás proveedores se
// carga A MANO (`setSaldo`, en app_settings) porque sus APIs no lo publican: la de
// Anthropic no da el prepago, y la de Google tampoco. OpenRouter SÍ lo da, en
// `GET /api/v1/credits`, así que pedirle al usuario que lo escriba sería pedirle que
// copie a mano un número que la máquina puede leer — y que va a quedar viejo al día
// siguiente, que es el problema real de todo saldo manual.
//
// EL CASO: un cliente cargó US$5 en OpenRouter y MaKo no se enteraba. Peor: lo seguía
// tratando como «tier gratis, 50 pedidos por día» (ver LIMITES_PROVEEDOR), así que
// después de 50 llamadas lo marcaba agotado y lo mandaba al fondo de la cascada
// TENIENDO CRÉDITO. Pagar para que te sigan racionando es la peor cara del bug.
//
// ⚠️ EL SALDO ES POR CUENTA, NO POR PROVEEDOR, y eso no es un detalle de presentación:
// es la regla que AGENTS.md llama «un total solo se puede sumar si el recurso se puede
// MOVER DE LUGAR». Dos keys de OpenRouter son dos billeteras separadas; si una tiene
// US$5 y la otra 0, el total «US$5» es cierto y la conclusión «te queda plata» es falsa
// para la mitad de las llamadas. Por eso se devuelve una fila por cuenta.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { clavesDe } from './ia-keys';

/** Lo que contesta OpenRouter, ya en la forma que nos sirve. Todo en dólares. */
export type SaldoCuentaOR = {
  /** 1, 2, 3… en el mismo orden que las claves del proveedor. */
  cuenta: number;
  /** Lo cargado en total, histórico. */
  creditos: number;
  /** Lo consumido, histórico. */
  usados: number;
  /** Lo que queda. Es el único número accionable. */
  restante: number;
};

/**
 * El saldo de cada cuenta de OpenRouter del workspace actual.
 *
 * NUNCA tira: si la API no contesta se devuelve la lista sin esa cuenta. Un panel de
 * gasto que rompe la pantalla porque un proveedor no respondió es peor que un panel
 * incompleto — y este dato es informativo, no gobierna ninguna decisión de envío.
 *
 * Sin cuentas cargadas devuelve `[]`, que es distinto de «saldo cero» y por eso no se
 * colapsan: el llamador tiene que poder distinguir «no conectó OpenRouter» de «lo
 * conectó y no le queda nada».
 */
export async function saldoOpenRouter(): Promise<SaldoCuentaOR[]> {
  const out: SaldoCuentaOR[] = [];
  const claves = clavesDe('openrouter');
  await Promise.all(claves.map(async (clave, i) => {
    const key = await credWs(clave).catch(() => null);
    if (!key) return;
    try {
      const r = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return;
      const j = await r.json().catch(() => null) as { data?: { total_credits?: number; total_usage?: number } } | null;
      const creditos = Number(j?.data?.total_credits ?? 0);
      const usados = Number(j?.data?.total_usage ?? 0);
      if (!Number.isFinite(creditos) || !Number.isFinite(usados)) return;
      out.push({ cuenta: i + 1, creditos, usados, restante: Math.max(0, creditos - usados) });
    } catch { /* el saldo es informativo: si no se puede leer, no se muestra */ }
  }));
  return out.sort((a, b) => a.cuenta - b.cuenta);
}

/**
 * ¿Alguna cuenta de OpenRouter tiene crédito de verdad?
 *
 * Es lo que decide si se lo sigue tratando como «tier gratis» —50 pedidos por día, y al
 * pasar ese número se lo saltea— o como una cuenta paga, que no tiene ese techo. Igual
 * que `GEMINI_PAGO` en lib/ia-cuotas.ts, y por el mismo motivo.
 *
 * Alcanza con UNA cuenta con saldo: la cascada rota entre cuentas antes de cambiar de
 * proveedor, así que mientras una tenga nafta el proveedor sirve.
 */
export async function openrouterConCredito(): Promise<boolean> {
  const saldos = await saldoOpenRouter().catch(() => []);
  return saldos.some((s) => s.restante > 0);
}
