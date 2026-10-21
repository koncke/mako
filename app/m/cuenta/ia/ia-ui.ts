// =============================================================================
// /m/cuenta/ia — «Tus cuentas de IA» en el teléfono: lo que se decide, puro y con test
// =============================================================================
// La pantalla (IaM.tsx) sólo dibuja. Qué dice el estado de cada computadora, qué barra se pinta y cuándo se
// muestra la hora de reinicio se decide acá, para fijarlo con tests/m-cuenta-ia.test.ts sin montar nada.
// Lo mismo que muestra app/integraciones/TusCuentasIA.tsx (la de la computadora), destilado.
//
// Dos reglas NO se escriben acá: son de la computadora y del teléfono por igual y viven en lib/ia-pc-reglas.ts
// (`estadoDeLaPc`: qué dice la fila de una PC; `yaPaso`: si la hora de reinicio ya pasó). Acá sólo se pegan a lo que
// dibuja el teléfono (el color del punto, la barra, la frase «Se reinicia a las HH:MM»).
//
// ⚠️ UNA HORA DE REINICIO QUE YA PASÓ NO SE MUESTRA: un «Se reinicia a las 15:30» pasadas las 15:30 es mentira. Igual
// que en la computadora, el % se sigue mostrando: lo mide la PC después de cada turno y es lo último que se supo.
// =============================================================================

import { estadoDeLaPc, yaPaso, type CuentaPc } from '@/lib/ia-pc-reglas';
import { hace } from '@/lib/progreso-reglas';
import { horaCorta } from '../../_ui/formato';

/** Una computadora tal cual la devuelve GET /api/ia-pc/estado (el admin ve las de todo el negocio y `de` dice de quién es). */
export type PcIA = {
  id: number;
  nombre: string;
  esMia: boolean;
  de?: string;
  enLinea: boolean;
  ultimoLatido: string | null;
  version: string | null;
  cuentas: CuentaPc[];
  /** Su último latido dijo que no tiene Claude Code (mig 0322): «Falta instalar Claude», no «Sin sesión». */
  sinClaude?: boolean;
};
export type EstadoIA = { ok: boolean; esAdmin: boolean; modelo: string; pcs: PcIA[] };

/** Cada cuánto vuelve a mirar, igual que la computadora. */
export const REFRESCO_MS = 20_000;

export type TonoPc = 'linea' | 'atencion' | 'apagada';

/**
 * Qué dice la fila de estado de una computadora (el texto es `estadoDeLaPc`, el de la computadora) y de qué color va su
 * punto. «En línea» sin ninguna cuenta no es «En línea»: el programa late pero Claude no tiene sesión y el chat no tiene
 * con qué contestar (punto de atención, no verde).
 */
export function estadoDePc(pc: Pick<PcIA, 'enLinea' | 'ultimoLatido' | 'cuentas' | 'sinClaude'>, ahora: number): { texto: string; tono: TonoPc } {
  const tono: TonoPc = pc.enLinea ? (pc.cuentas.length === 0 ? 'atencion' : 'linea') : 'apagada';
  return { texto: estadoDeLaPc(pc, ahora, hace), tono };
}

export type TonoBarra = 'bien' | 'ojo' | 'mal' | 'apagado';
export type BarraUso = {
  /** 0 a 100, o null si la computadora todavía no midió («Sin medir»). */
  pct: number | null;
  tono: TonoBarra;
  /** «Se reinicia a las 15:30», o null: sin medida, sin hora, o una hora que ya pasó. */
  reinicio: string | null;
};

/** El color de la barra según cuánto va usado (los cortes de la computadora: 75 y 90). */
export function tonoDeBarra(pct: number | null): TonoBarra {
  if (pct == null) return 'apagado';
  return pct >= 90 ? 'mal' : pct >= 75 ? 'ojo' : 'bien';
}

/**
 * Una de las dos barras de una cuenta («Sesión de 5 horas» lleva `repone`; «Semana» no). La hora de reinicio se muestra
 * sólo con una medida y mientras no haya pasado (`yaPaso`, la regla de la computadora).
 */
export function barraDeUso(pct: number | undefined, repone: string | undefined, ahora: number): BarraUso {
  const medido = typeof pct === 'number' && Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : null;
  return {
    pct: medido,
    tono: tonoDeBarra(medido),
    reinicio: medido != null && repone && !yaPaso(repone, ahora) ? `Se reinicia a las ${horaCorta(Date.parse(repone))}` : null,
  };
}

/** El nombre de una cuenta en su fila: el correo, o de qué es si la computadora no lo supo leer. */
export function nombreDeCuenta(c: Pick<CuentaPc, 'proveedor' | 'email'>): string {
  return c.email ?? (c.proveedor === 'chatgpt' ? 'Tu cuenta de ChatGPT' : 'Tu cuenta de Claude');
}

/**
 * La pregunta de la hoja de «Desconectar». La de la computadora dice «Tu chat deja de usarla»; cuando el admin mira la
 * computadora de otra persona del negocio, el chat que deja de usarla es el de ELLA.
 */
export function preguntaDesconectar(pc: Pick<PcIA, 'esMia' | 'de'>): string {
  return pc.esMia || !pc.de ? '¿Desconectarla? Tu chat deja de usarla.' : `¿Desconectarla? El chat de ${pc.de} deja de usarla.`;
}
