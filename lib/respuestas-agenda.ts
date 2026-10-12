// =============================================================================
// respuestas-agenda — «Lo que contestó al agendar», en renglones para un WhatsApp (puro)
// =============================================================================
// Vivía adentro de lib/calcom.ts (`cortar`, `rotuloCorto`, `TOPE_AVISO`): sólo lo usaba el aviso «Nuevo
// agendado» de Cal.com (`detalleDelAviso`). La undécima tanda (11/10/2026, punto 4: «{{mensaje_mako}}… ese dato
// NO existe») lo vuelve un DATO del «{ }» (`{{lead_respuestas_agenda}}`, lib/variables-aviso.ts), y el dato lo
// arma el resolvedor con la última fila de `lead_respuestas` (`valoresDeRespuestasAgenda`,
// lib/variables-del-lead.ts). Las dos salidas cuelgan de ESTA función: con el renglón armado en dos lugares,
// el aviso de hoy y la tarjeta nueva dirían la misma respuesta de dos formas.
//
// Se mudó SIN cambiar lo que arma `textoNuevoAgendado` (lo fija tests/calcom-respuestas.test.ts).
//
// ⚠️ PURO, SIN `server-only` Y SIN `node:crypto`: lib/calcom.ts trae `crypto` (la firma) y el resolvedor y
// los tests no tienen por qué cargarlo.

/**
 * Topes del aviso. Es un WhatsApp al grupo del negocio que se lee en el celular: un renglón por
 * respuesta, con el rótulo ABREVIADO (los del formulario de ws13 llegan a 230 caracteres: «Valoramos
 * mucho nuestro tiempo tanto como el suyo, si selecciona un dia…») y el valor cortado. Lo completo
 * queda en el RESUMEN del lead (/crm/<id>/resumen), que es adonde lleva el link del final: desde el
 * 09/10/2026 esa pantalla lee `lead_respuestas` (`respuestasDelResumen`, lib/lead-respuestas.ts);
 * antes sólo leía las columnas respuesta_* de Calendly, y para un lead de Cal.com «Lo que contestó
 * al agendar» no salía nunca.
 */
export const TOPE_AVISO = { respuestas: 6, rotulo: 40, valor: 60 } as const;

/**
 * Corta a `n` unidades UTF-16 sin dejar MEDIO emoji al final.
 *
 * ⚠️ `slice` cuenta unidades UTF-16, no caracteres: un emoji son dos (un par sustituto), y cortar
 * entre las dos deja un sustituto alto suelto. `JSON.stringify` lo saca como «\ud83d» y Postgres
 * rechaza ese jsonb ENTERO («invalid input syntax for type json», medido el 09/10/2026 contra prod
 * en una transacción read only; el par completo pasa). Como `saveLeadRespuestas` guarda el set de
 * una reserva en UN insert, una sola respuesta mal cortada tiraba TODAS las de esa reserva, y si el
 * emoji caía en el RÓTULO —que es fijo por formulario— las de todas las reservas de ese event type.
 */
export const recortar = (s: string, n: number): string => s.slice(0, n).replace(/[\uD800-\uDBFF]$/, '');

/** Corta en el último espacio antes del tope y marca el corte con «…». */
export function cortar(s: string, tope: number): string {
  if (s.length <= tope) return s;
  // `recortar` y no `slice`: sin un espacio después de la mitad, el corte cae donde cae y puede
  // partir un emoji (el aviso saldría con un «�» suelto delante del «…»).
  const dentro = recortar(s, tope - 1);
  const espacio = dentro.lastIndexOf(' ');
  return (espacio > tope / 2 ? dentro.slice(0, espacio) : dentro).replace(/[\s,;:.-]+$/, '') + '…';
}

/**
 * El rótulo de una respuesta, abreviado para un renglón: hasta la primera pausa (una coma, un
 * punto, el signo de pregunta), sin el «Tu»/«Su» del principio y con un tope de largo.
 * «¿Hace cuánto que formas parte del rubro inmobiliario?» → «Hace cuánto que formas parte del rubro…».
 */
export function rotuloCorto(rotulo: string): string {
  let r = rotulo.replace(/\s+/g, ' ').trim().replace(/^[¿¡?!.,;:\s]+/, '');
  const pausa = r.search(/[,;.:?!(]/);
  if (pausa > 0) r = r.slice(0, pausa);
  r = r.trim().replace(/^(tu|tus|su|sus)\s+(?=\S)/i, '');
  r = cortar(r, TOPE_AVISO.rotulo);
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Respuesta';
}

/**
 * Un renglón por respuesta («• Rótulo corto: valor cortado»), hasta `TOPE_AVISO.respuestas`, y si hay
 * más, «• +N en el resumen». Vacío sin respuestas. Es LA forma: la usan el aviso de Cal.com
 * (`detalleDelAviso`, lib/calcom.ts) y el dato `{{lead_respuestas_agenda}}`.
 */
export function renglonesDeRespuestas(respuestas: ReadonlyArray<{ rotulo: string; valor: string }>): string[] {
  const visibles = respuestas.slice(0, TOPE_AVISO.respuestas);
  const lineas = visibles.map((r) => `• ${rotuloCorto(r.rotulo)}: ${cortar(r.valor, TOPE_AVISO.valor)}`);
  const resto = respuestas.length - visibles.length;
  if (resto > 0) lineas.push(`• +${resto} en el resumen`);
  return lineas;
}
