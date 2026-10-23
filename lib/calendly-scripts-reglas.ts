// =============================================================================
// calendly-scripts-reglas — los argumentos de los scripts de Calendly, y cuándo pueden borrar un aviso (23/10/2026)
// =============================================================================
// Puro: lo usan scripts/backfill-calendly.ts, scripts/arreglar-webhook-calendly.ts y tests/calendly-scripts.test.ts.
//
// Los dos scripts nacieron para UN negocio (el ws 1 de Mauricio, con el token de `.env.local`). El 23/10/2026 hizo falta
// correrlos sobre la agenda de MaKo (el ws 9: docs/hallazgos-integraciones.md). Sin `--ws` hacen EXACTAMENTE lo de antes;
// con `--ws=N` el token sale de las credenciales de ESE negocio y nunca de `.env.local`: con el de otro, el backfill
// metería la agenda de una cuenta ajena en el CRM de N.
// =============================================================================

export type ArgsScriptCalendly = {
  /** El negocio pedido con `--ws=N`; null = sin el flag (el comportamiento de siempre). */
  ws: number | null;
  /** `--dry` o `--simulacro`: lee y cuenta, no escribe. */
  simulacro: boolean;
  /** `--reemplazar`: el arreglo del aviso puede borrar uno que quizá le trae las reservas a otro negocio. */
  reemplazar: boolean;
};

/**
 * Los argumentos de un script de Calendly. ⚠️ ESTRICTO a propósito (revisión adversarial, 23/10/2026): un flag que no se
 * reconoce NO se ignora, porque ignorarlo es caer al comportamiento de siempre (el ws 1, el token de Mauricio, y escribir
 * de verdad). `--ws 9` (con espacio), `--WS=9`, `-ws=9`, `--dry-run` y `--simulacro=1` hubieran corrido sobre el negocio
 * equivocado o escrito en lugar de medir. Cada script dice cuáles más acepta (`--reemplazar`, `--desde=`: el que termina
 * en `=` lleva valor). Sólo se miran los que empiezan con `-`: lo demás (la ruta de node, la del script) no es un flag.
 */
export function argsDeScriptCalendly(
  argv: readonly string[],
  permitidos: readonly string[] = [],
): { ok: true; args: ArgsScriptCalendly } | { ok: false; error: string } {
  const sueltos = new Set(['--dry', '--simulacro', ...permitidos.filter((p) => !p.endsWith('='))]);
  const conValor = new Set(['--ws=', ...permitidos.filter((p) => p.endsWith('='))]);
  const vistos = new Set<string>();
  for (const a of argv.filter((x) => x.startsWith('-'))) {
    const igual = a.indexOf('=');
    const nombre = igual >= 0 && conValor.has(a.slice(0, igual + 1)) ? a.slice(0, igual + 1) : a;
    if (!sueltos.has(nombre) && !conValor.has(nombre)) {
      const pista = a.startsWith('--ws') || a.startsWith('-ws') ? ' (el negocio se escribe junto: --ws=9)' : '';
      return { ok: false, error: `${a}: no es un argumento de este script${pista}. Acepta: ${[...conValor, ...sueltos].join(' ')}` };
    }
    if (vistos.has(nombre)) return { ok: false, error: `${nombre}: repetido` };
    vistos.add(nombre);
  }
  const crudo = argv.find((a) => a.startsWith('--ws='))?.slice(5);
  let ws: number | null = null;
  if (crudo != null) {
    if (!/^[1-9]\d{0,6}$/.test(crudo)) return { ok: false, error: `--ws=${crudo}: tiene que ser el número del negocio (--ws=9)` };
    ws = Number(crudo);
  }
  return { ok: true, args: { ws, simulacro: vistos.has('--dry') || vistos.has('--simulacro'), reemplazar: vistos.has('--reemplazar') } };
}

/**
 * ¿El arreglo del aviso puede borrar las suscripciones a MaKo que ya tiene la organización de Calendly? No deja dos con la
 * misma dirección (409), así que crear una nueva es borrar la vieja, y la nueva trae una clave nueva que se guarda en UN
 * negocio. Sin `--ws` se borra como siempre.
 *
 * ⚠️ Con `--ws`, «el negocio tiene una clave guardada» NO prueba que el aviso sea suyo (Calendly no devuelve la clave, y una
 * organización puede tener usuarios o tipos de evento de dos negocios de MaKo): se decide con datos de Calendly.
 *   · el aviso lo creó otro usuario que el del token → no es de esta cuenta;
 *   · algún tipo de evento de la organización rutea a OTRO negocio → ese aviso le trae las reservas, y con la clave nueva
 *     guardada sólo en N, las suyas se verifican contra la vieja y reciben 401 (se pierden las de los dos);
 *   · no se pudo leer los tipos de evento → no se adivina.
 * Sólo con `--reemplazar`, sabiéndolo.
 */
export function puedeBorrarAvisos(p: {
  porWs: boolean;
  ws: number;
  /** Las suscripciones a MaKo que se borrarían. */
  avisos: readonly { creator?: string | null }[];
  /** El URI del usuario dueño del token (`/users/me`). */
  yo: string | null;
  /** A qué negocios rutean los tipos de evento de la organización; null = no se pudo leer. */
  negociosDeLosTipos: readonly number[] | null;
  reemplazar: boolean;
}): { puede: boolean; motivo: string | null } {
  if (!p.porWs || p.avisos.length === 0 || p.reemplazar) return { puede: true, motivo: null };
  if (p.avisos.some((a) => !a.creator || a.creator !== p.yo)) {
    return { puede: false, motivo: 'lo creó otro usuario de Calendly que el dueño de este token' };
  }
  if (p.negociosDeLosTipos == null) return { puede: false, motivo: 'no pude leer los tipos de evento de la organización' };
  const otros = [...new Set(p.negociosDeLosTipos.filter((n) => n !== p.ws))];
  if (otros.length) return { puede: false, motivo: `la organización también tiene tipos de evento de ${otros.length === 1 ? 'el ws' : 'los ws'} ${otros.join(', ')}: ese aviso les trae sus reservas` };
  return { puede: true, motivo: null };
}
