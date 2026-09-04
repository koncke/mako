// =============================================================================
// veto-claude — la ÚNICA puerta a api.anthropic.com/v1/messages
// =============================================================================
// El pedido, textual (13/8/2026): «que ya no se pueda gastar con Claude directamente,
// que se prohíba».
//
// HAY CINCO PUERTAS, Y CERRAR CUATRO DEJA LA QUINTA. Es exactamente lo que pasó ayer:
// `fallback: []` tapó dos y las otras tres siguieron cobrando US$12,79.
//
//   1. `def` pago del catálogo ............. closing US$23,96 · experimentos · lead_insights
//   2. fallback pago de `chatClaude` ....... plan-fathom 38,02 + Perro 14,13 + coach 3,53
//   3. fallback pago de `chatClaudeTools` .. ni siquiera consultaba `fallbackDeFeature`
//   4. `opts.model` explícito .............. US$8,67; saltea el registro ENTERO
//   5. el `MODEL` del módulo ............... feature fuera del catálogo → Opus, el más caro
//
// Las cinco terminan en el mismo `fetch`. El veto vive ahí y en ningún otro lado.
//
// ⚠️ Y LA ASIMETRÍA ES EL DISEÑO: el default es BLOQUEAR, y bloquear es instantáneo —una
// feature nueva ya está vetada el día que se escribe—. Desbloquear necesita commit,
// pre-push, push y deploy: lento y revisable. Por eso la lista blanca vive en CÓDIGO y no
// en `app_settings`: un veto que se apaga con la misma palanca que gobierna se apaga solo.
//
// SIN `server-only` a propósito: un módulo con server-only no lo puede importar ningún
// test, y la guarda del gasto quedaría sin red justo donde más duele.
// =============================================================================

import { CATALOGO_MODELOS } from '@/lib/model-catalogo';

const ENDPOINT = 'https://api.anthropic.com/v1/messages' as const;

/**
 * LA MARCA. El símbolo NO se exporta: ningún otro módulo puede FABRICAR un
 * `PermisoClaude`. Y como el `fetch` de `lib/anthropic.ts` saca la URL de
 * `permiso.endpoint` —ya no de una constante propia—, escribir una llamada a Claude sin
 * pasar por acá no tipa.
 *
 * No es a prueba de balas: `{} as PermisoClaude` la saltea, y el typecheck NO corre en el
 * build de Vercel. Esta capa es para el que agrega código nuevo y NO sabe que hay un veto:
 * se entera al escribirlo, no en la factura. Al que castea a propósito lo caza el test.
 */
declare const marcaDeVeto: unique symbol;

export type PermisoClaude = {
  readonly endpoint: typeof ENDPOINT;
  readonly model: string;
  readonly feature: string;
  readonly porque: string;
  readonly [marcaDeVeto]: true;
};

export type PermisoDeclarado = {
  feature: string;
  /** los ÚNICOS modelos que esta feature puede comprar. Uno de más es plata de más. */
  modelos: string[];
  /** YYYY-MM-DD. Vencido = vetado (el test avisa 14 días antes). */
  hasta: string;
  porque: string;
  /** quién lo autorizó y cuándo. Un permiso sin dueño no lo revisa nadie. */
  pidio: string;
};

export const CLAUDE_PERMITIDO: PermisoDeclarado[] = [
  {
    feature: 'closing',
    // ⚠️ SONNET, no Opus. El 13/8 el dueño bajó el `def` de closing de Opus a Sonnet
    // («~60% menos»). Declarar Opus acá rompería closing el día 1: el modelo que resuelve
    // el registro no estaría permitido y la feature se apagaría sola.
    modelos: ['claude-sonnet-5'],
    hasta: '2026-11-13',
    porque:
      'Transcript completo de una llamada de venta + juicio comercial sobre PII. Es el '
      + 'análisis insignia y lo que el cliente compra: la diferencia de criterio se nota.',
    pidio: 'Martín, 13/8/2026 — la única excepción declarada al aplicar el veto.',
  },
];

// `experimentos` y `lead_insights` NO están, y no es un olvido: las dos tenían
// `def: CLAUDE()` con su `pagoPorque` escrito y ninguna corre desde julio (US$0,88 el 16/7
// y US$0 desde el 5/7). Una autorización que nadie usa es una que nadie revisa, y es la
// forma exacta del «default que cobra en silencio». Su `def` pasó a Gemini en el MISMO
// commit. Volverlas es una fila acá y una fecha.

export type Veredicto =
  | { ok: true; permiso: PermisoClaude }
  | { ok: false; razon: string };

const diaISO = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * ¿Esta llamada puede pagarle a Anthropic? Puro y síncrono: no lee la base, no hace red.
 * Por eso lo puede correr un test y también la UI de /modelos-ia.
 *
 * `pausa` va como PARÁMETRO y no como lectura interna: quien la lee es el llamador, y así
 * este módulo queda testeable y sin `server-only`.
 */
export function evaluarPermiso(p: {
  feature?: string; model?: string; pausa?: boolean; hoy?: Date;
}): Veredicto {
  const feature = (p.feature ?? '').trim();

  if (p.pausa) {
    return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`). Se despausa desde /modelos-ia.' };
  }

  // 1) SIN FEATURE NO SE PAGA. Hoy los call-sites la pasan por disciplina y nada los
  //    obligaba: esto no rompe nada y cierra la puerta para el que viene.
  if (!feature) {
    return { ok: false, razon: 'llamada a Claude sin `feature`: no hay forma de saber qué se está comprando.' };
  }

  // 2) FUERA DEL CATÁLOGO NO ES «USÁ EL DEFAULT», ES UN DATO QUE FALTA.
  //    `modeloDeFeature` devolvía null igual si no había feature que si la feature no
  //    existía; los dos caían en el mismo `else` y compraban OPUS.
  const enCatalogo = CATALOGO_MODELOS.find((f) => f.feature === feature);
  if (!enCatalogo) {
    return { ok: false, razon: `«${feature}» no está en CATALOGO_MODELOS (lib/model-catalogo.ts). Regístrala con un \`def\` gratis — una feature sin registrar no compra Opus.` };
  }

  const permiso = CLAUDE_PERMITIDO.find((x) => x.feature === feature);
  if (!permiso) {
    return { ok: false, razon: `«${feature}» no está en la lista blanca de lib/veto-claude.ts. Claude está prohibido salvo excepción explícita (pedido del dueño, 13/8/2026).` };
  }

  const hoy = diaISO(p.hoy ?? new Date());
  if (hoy > permiso.hasta) {
    return { ok: false, razon: `el permiso de «${feature}» venció el ${permiso.hasta}. Renuévalo con una fecha nueva o déjalo vencido — vencer es la decisión por default.` };
  }

  // 3) EL MODELO. `opts.model` deja de ser un parámetro y pasa a ser un permiso: es la
  //    única ruta que no consultaba nada (el lookup entero se cortaba con
  //    `if (!opts.model && opts.feature)`) y es la #4 en plata.
  //
  //    Si no vino modelo se cae al `def` DEL CATÁLOGO —import estático, no la base— y
  //    igual tiene que estar declarado abajo. Sin esto, un blip de Supabase deja
  //    `model: ''` y apaga la única feature autorizada. Un default POSITIVO y acotado a lo
  //    ya permitido no abre nada; la ausencia de regla sí.
  const model = (p.model ?? '').trim() || enCatalogo.def.model;
  if (!model) {
    return { ok: false, razon: `«${feature}»: no se resolvió ningún modelo. Antes esto caía al \`MODEL\` del módulo, que era Opus.` };
  }
  if (!permiso.modelos.includes(model)) {
    return { ok: false, razon: `«${feature}» tiene permiso para ${permiso.modelos.join(', ')}, no para «${model}».` };
  }

  // El ÚNICO cast a PermisoClaude de todo el repo. El test lo verifica.
  return { ok: true, permiso: { endpoint: ENDPOINT, model, feature, porque: permiso.porque } as PermisoClaude };
}

export class VetoClaude extends Error {
  constructor(readonly feature: string, readonly model: string, readonly razon: string) {
    super(`Claude vetado — ${razon}`);
    this.name = 'VetoClaude';
  }
}

/** La versión que usa el runtime: devuelve el permiso o CORTA. */
export function permisoDeGasto(p: { feature?: string; model?: string; pausa?: boolean; hoy?: Date }): PermisoClaude {
  const v = evaluarPermiso(p);
  if (!v.ok) throw new VetoClaude(p.feature ?? '', p.model ?? '', v.razon);
  return v.permiso;
}

/** Los modelos de Claude que una feature puede elegir en /modelos-ia. Vacío = ninguno. */
export function modelosPermitidos(feature: string): string[] {
  return CLAUDE_PERMITIDO.find((p) => p.feature === feature)?.modelos ?? [];
}

/** Los permisos que vencen dentro de N días. Los miran el test y /modelos-ia. */
export function permisosPorVencer(dias = 14, hoy = new Date()): PermisoDeclarado[] {
  const limite = diaISO(new Date(hoy.getTime() + dias * 86_400_000));
  return CLAUDE_PERMITIDO.filter((p) => p.hasta <= limite);
}
