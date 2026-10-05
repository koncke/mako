// =============================================================================
// Los DATOS que se pueden meter adentro de un mensaje
// =============================================================================
// Pedido textual (30/09/2026): «hace falta configurar llamados a datos dentro de
// MaKo... Por ejemplo, llamados al CRM, traer el nombre, el número, el email, etc...
// O llamados a los anuncios, traer el rendimiento, el presupuesto... Y revisa también
// que hoy en día tenemos varios LINKS dentro de MaKo que podrían ser de utilidad...
// Para evitar poner mucha info dentro de un mensaje y aprovechar este sistema».
//
// ── LA REGLA DE ADMISIÓN, Y ES LA QUE HACE QUE ESTO NO MIENTA ───────────────
// Sólo entra lo que quien EMITE ya tiene en la mano: cero queries nuevas, cero
// llamadas a un proveedor. Un aviso que espera 900 ms a Meta para resolver
// `{{presupuesto}}` es un aviso que no sale — y el webhook que lo dispara tiene un
// `maxDuration`. Para los números de anuncios está `{{link_anuncios}}`, que lleva a
// la pantalla donde el número está fresco; ésa es la mitad del pedido que dice
// «para evitar poner mucha info dentro de un mensaje».
//
// ⚠️ Y EL TOKEN VIAJA COMO TEXTO PLANO, NUNCA COMO UN CHIP. `domAMarcas` del editor
// aplana todo lo que no sea b/i/s y NO avisa: un `<span>` bonito que diga «Nombre
// del lead» se serializa como ese texto y la variable desaparece entera. Lo que se
// escribe en el contenteditable es `{{lead_nombre}}`, y el color se lo pone el
// pintado, no la etiqueta.

/** El molde de un token. Se escribe UNA vez y lo usan el editor, el pintado y el saneo. */
export const RE_VARIABLE = /\{\{[a-z0-9_]+\}\}/gi;

/**
 * Parte un texto en tramos, separando los tokens del resto.
 *
 * ⚠️ EXISTE PORQUE LAS MARCAS DE WHATSAPP SE COMEN LOS TOKENS. La itálica es
 * `_texto_`, y `{{lead_nombre}}` tiene un guión bajo adentro: con dos tokens en la
 * misma línea, `Hola {{lead_nombre}}, mirá {{link_crm}}` se dibuja
 * «Hola {{leadnombre}}, mirá {{linkcrm}}» en itálica — el `_` de uno cierra con el
 * del otro. Y con una negrita en el medio salen etiquetas cruzadas, que el navegador
 * reparenta y el serializador devuelve con `_` de más: el texto guardado cambia solo.
 *
 * Los dos renderers parten por acá y aplican las marcas SÓLO a los tramos de afuera.
 */
export function tramosConVariables(linea: string): Array<{ txt: string; esVar: boolean }> {
  const out: Array<{ txt: string; esVar: boolean }> = [];
  let i = 0;
  for (const hit of linea.matchAll(RE_VARIABLE)) {
    const at = hit.index ?? 0;
    if (at > i) out.push({ txt: linea.slice(i, at), esVar: false });
    out.push({ txt: hit[0], esVar: true });
    i = at + hit[0].length;
  }
  if (i < linea.length) out.push({ txt: linea.slice(i), esVar: false });
  return out;
}

// ──────────────────────────────────────────────────────────────────────────

/** Un dato que se puede meter adentro del texto de un mensaje. */
export type VariableAviso = {
  key: string;
  label: string;
  ejemplo: string;
  /**
   * Qué hace falta para que se pueda resolver. Es lo que filtra el selector.
   *
   * · `siempre` — se calcula o es una constante más la base.
   * · `lead`    — necesita que el aviso hable de UN lead. Los eventos del CRM lo
   *               traen (`dispararEvento` pasa `leadId`); un cron horario, no.
   * · `cuota`   — necesita la cuota de la que habla el aviso. La trae el emisor en
   *               `datos`, que es lo que el cron de cobranza ya tiene en la mano: no
   *               hay lectura extra, y por eso puede estar acá.
   */
  alcance: 'siempre' | 'lead' | 'cuota';
  /** En qué grupo lo muestra el selector. El orden lo fija `GRUPOS_VARIABLES`. */
  grupo: GrupoVariable;
  /**
   * Cómo se escribe el valor. Lo aplica el resolvedor, no la pantalla: el mismo token
   * sale al WhatsApp, al email y a la previa, y tres formateos distintos del mismo
   * número es cómo se arma una contradicción entre canales.
   */
  formato?: 'texto' | 'plata' | 'fecha' | 'si_no';
};

export type GrupoVariable =
  | 'lead' | 'estado' | 'agenda' | 'plata' | 'origen' | 'formulario' | 'momento' | 'links';

/** El orden y el nombre de cada grupo en el desplegable. */
export const GRUPOS_VARIABLES: ReadonlyArray<{ key: GrupoVariable; titulo: string }> = [
  { key: 'lead', titulo: 'Quién es' },
  { key: 'estado', titulo: 'Dónde está' },
  { key: 'agenda', titulo: 'Su agenda' },
  { key: 'plata', titulo: 'Su plata' },
  { key: 'origen', titulo: 'De dónde vino' },
  { key: 'formulario', titulo: 'Lo que contestó' },
  { key: 'momento', titulo: 'El momento' },
  { key: 'links', titulo: 'Links a MaKo' },
];

/**
 * EL CATÁLOGO.
 *
 * ── LA REGLA DE ADMISIÓN, Y CAMBIÓ EL 04/10/2026 ───────────────────────────
 * La vieja decía «cero queries nuevas», y era la vara equivocada por dos razones. La
 * primera: ya no era cierta — `valoresDeVariables` hacía dos lecturas a Supabase (la
 * zona horaria y el nombre del negocio) el día que se escribió. La segunda: lo que el
 * pedido quería era el CRM, y el CRM no viaja en ningún evento.
 *
 * La regla que queda, que es la que protege lo que protegía la otra:
 *
 *   **UNA lectura por ENTIDAD que el texto NOMBRA, y sólo si la nombra. Cero
 *   proveedores.**
 *
 * O sea: un `select` indexado por id del lead, disparado únicamente cuando el texto
 * trae un token de este catálogo que lo necesite. Lo que sigue prohibido es lo que
 * motivó la regla vieja: traer un número de Meta son ~900 ms medidos y las lecturas de
 * ads están marcadas `lenta` en el registro, así que un webhook con `maxDuration` que
 * espere eso es un aviso que no sale. Para esos números está `{{link_anuncios}}`, que
 * lleva a la pantalla donde el dato está FRESCO — que es, textual, «para evitar poner
 * mucha info dentro de un mensaje y aprovechar este sistema».
 *
 * ⚠️ Y NO ESTÁ LA ETAPA DEL KANBAN, a propósito. Se deriva en el navegador
 * (`app/crm/crm-map.ts`) cruzando el override manual con la etapa calculada y la lista
 * de etapas válidas del embudo; este repo ya tiene escrito que `stageMeta` miente. Un
 * token que dijera una etapa equivocada en un WhatsApp es peor que no tenerlo, así que
 * va `{{lead_estado}}`, que es una COLUMNA, y el que quiera la etapa tiene el link.
 */
export const VARIABLES_AVISO: VariableAviso[] = [
  // ── Quién es. Una sola lectura de `leads` por id los trae todos.
  { key: 'lead_nombre', label: 'Nombre', ejemplo: 'Sofía Contreras', alcance: 'lead', grupo: 'lead' },
  { key: 'lead_email', label: 'Email', ejemplo: 'sofia@ejemplo.com', alcance: 'lead', grupo: 'lead' },
  { key: 'lead_telefono', label: 'Teléfono', ejemplo: '+52 1 55 1234 5678', alcance: 'lead', grupo: 'lead' },
  { key: 'lead_empresa', label: 'Empresa', ejemplo: 'Inmobiliaria del Valle', alcance: 'lead', grupo: 'lead' },

  // ── Dónde está. `estado_lead` y los asignados son columnas, no derivaciones.
  { key: 'lead_estado', label: 'Estado', ejemplo: 'abierto', alcance: 'lead', grupo: 'estado' },
  { key: 'lead_motivo_perdida', label: 'Motivo de la pérdida', ejemplo: 'sin presupuesto', alcance: 'lead', grupo: 'estado' },
  { key: 'lead_closer', label: 'Closer asignado', ejemplo: 'Mauricio', alcance: 'lead', grupo: 'estado' },
  { key: 'lead_setter', label: 'Setter asignado', ejemplo: 'Leila', alcance: 'lead', grupo: 'estado' },
  { key: 'lead_calificado', label: '¿Está calificado?', ejemplo: 'sí', alcance: 'lead', grupo: 'estado', formato: 'si_no' },

  // ── Su agenda.
  { key: 'lead_fecha_agenda', label: 'Cuándo agendó', ejemplo: '12/10', alcance: 'lead', grupo: 'agenda', formato: 'fecha' },
  { key: 'lead_fecha_r1', label: 'Fecha de la primera reunión', ejemplo: '14/10', alcance: 'lead', grupo: 'agenda', formato: 'fecha' },
  { key: 'lead_fecha_r2', label: 'Fecha de la segunda reunión', ejemplo: '21/10', alcance: 'lead', grupo: 'agenda', formato: 'fecha' },
  { key: 'lead_asistio_r1', label: '¿Asistió a la primera?', ejemplo: 'sí', alcance: 'lead', grupo: 'agenda', formato: 'si_no' },
  { key: 'lead_asistio_r2', label: '¿Asistió a la segunda?', ejemplo: 'no', alcance: 'lead', grupo: 'agenda', formato: 'si_no' },

  // ── Su plata. El saldo se CALCULA de dos columnas: es la pregunta de cobranza.
  { key: 'lead_monto_cierre', label: 'Monto del cierre', ejemplo: 'US$ 1.500', alcance: 'lead', grupo: 'plata', formato: 'plata' },
  { key: 'lead_cobrado', label: 'Cuánto pagó ya', ejemplo: 'US$ 500', alcance: 'lead', grupo: 'plata', formato: 'plata' },
  { key: 'lead_saldo', label: 'Cuánto falta cobrarle', ejemplo: 'US$ 1.000', alcance: 'lead', grupo: 'plata', formato: 'plata' },
  { key: 'lead_cuota', label: 'Monto de la cuota', ejemplo: 'US$ 250', alcance: 'lead', grupo: 'plata', formato: 'plata' },
  { key: 'lead_dia_de_pago', label: 'Qué día del mes paga', ejemplo: '10', alcance: 'lead', grupo: 'plata' },
  { key: 'lead_fecha_cierre', label: 'Cuándo cerró', ejemplo: '28/09', alcance: 'lead', grupo: 'plata', formato: 'fecha' },
  { key: 'lead_suscripcion', label: 'Suscripción mensual', ejemplo: 'US$ 500', alcance: 'lead', grupo: 'plata', formato: 'plata' },

  // ── De dónde vino.
  { key: 'lead_origen', label: 'Por dónde entró', ejemplo: 'instant_form', alcance: 'lead', grupo: 'origen' },
  { key: 'lead_campana', label: 'Campaña de Meta', ejemplo: 'Inmobiliario · Octubre', alcance: 'lead', grupo: 'origen' },
  { key: 'lead_anuncio', label: 'Anuncio de Meta', ejemplo: 'Video testimonio 3', alcance: 'lead', grupo: 'origen' },
  { key: 'lead_utm_source', label: 'UTM source', ejemplo: 'facebook', alcance: 'lead', grupo: 'origen' },
  { key: 'lead_utm_campaign', label: 'UTM campaign', ejemplo: 'oct-leads', alcance: 'lead', grupo: 'origen' },

  // ── Lo que contestó en el formulario. Son las columnas `respuesta_*`.
  { key: 'lead_facturacion', label: 'Cuánto factura', ejemplo: 'US$ 10k - 30k', alcance: 'lead', grupo: 'formulario' },
  { key: 'lead_colaboradores', label: 'Cuántos colaboradores', ejemplo: '5 a 10', alcance: 'lead', grupo: 'formulario' },
  { key: 'lead_objetivo', label: 'Su objetivo', ejemplo: 'duplicar las ventas', alcance: 'lead', grupo: 'formulario' },
  { key: 'lead_cuando_empezar', label: 'Cuándo quiere empezar', ejemplo: 'este mes', alcance: 'lead', grupo: 'formulario' },
  { key: 'lead_inversion', label: 'Cuánto puede invertir', ejemplo: 'US$ 1k - 3k', alcance: 'lead', grupo: 'formulario' },
  { key: 'lead_decisor', label: '¿Decide él?', ejemplo: 'sí', alcance: 'lead', grupo: 'formulario' },

  // ── La CUOTA de la que habla el aviso. Las trae el emisor en `datos`: el cron de
  //    cobranza ya leyó la fila de `pagos` para decidir que hay que avisar, así que
  //    pasarlas no cuesta una lectura. Y van por CÓDIGO y no por el modelo, que es la
  //    regla de la casa para un dato exacto: un monto que pasa por un LLM deja de ser
  //    exacto, y acá el dato exacto es plata que alguien debe.
  { key: 'cuota_numero', label: 'Número de cuota', ejemplo: '2', alcance: 'cuota', grupo: 'plata' },
  { key: 'cuota_monto', label: 'Monto de esta cuota', ejemplo: 'US$ 1.700', alcance: 'cuota', grupo: 'plata', formato: 'plata' },
  { key: 'cuota_vence', label: 'Cuándo vence esta cuota', ejemplo: '10/10', alcance: 'cuota', grupo: 'plata', formato: 'fecha' },
  { key: 'cuota_dias', label: 'Hace cuánto venció (o en cuánto vence)', ejemplo: '3 días', alcance: 'cuota', grupo: 'plata' },

  // ── El momento, en la zona del negocio. Se calculan.
  { key: 'fecha', label: 'La fecha de hoy', ejemplo: '30/09', alcance: 'siempre', grupo: 'momento', formato: 'fecha' },
  { key: 'hora', label: 'La hora', ejemplo: '09:00', alcance: 'siempre', grupo: 'momento' },
  { key: 'negocio', label: 'El nombre del negocio', ejemplo: 'Código Inmobiliario', alcance: 'siempre', grupo: 'momento' },

  // ── Los links a una pantalla: una constante más la base. Son los que evitan pegar
  //    media pantalla adentro de un WhatsApp.
  { key: 'link_lead', label: 'Ficha del lead', ejemplo: '/crm/2498/resumen', alcance: 'lead', grupo: 'links' },
  { key: 'link_crm', label: 'El CRM', ejemplo: '/crm', alcance: 'siempre', grupo: 'links' },
  { key: 'link_anuncios', label: 'Los anuncios', ejemplo: '/ads-manager', alcance: 'siempre', grupo: 'links' },
  { key: 'link_plan', label: 'El plan', ejemplo: '/plan', alcance: 'siempre', grupo: 'links' },
  { key: 'link_chat', label: 'Las conversaciones', ejemplo: '/whatsapp', alcance: 'siempre', grupo: 'links' },
  { key: 'link_integraciones', label: 'Integraciones', ejemplo: '/integraciones', alcance: 'siempre', grupo: 'links' },
  { key: 'link_configuraciones', label: 'Configuraciones', ejemplo: '/configuraciones', alcance: 'siempre', grupo: 'links' },
];

/**
 * Las claves que necesitan la fila del lead. Es lo que decide si se hace la lectura, y
 * se DERIVA del catálogo: una lista escrita al lado se queda vieja al próximo token, y
 * el modo de falla sería un token que sale crudo sin que nadie entienda por qué.
 *
 * `link_lead` y `lead_nombre` quedan afuera a propósito: los dos se resuelven con lo
 * que el evento ya trae (`leadId` y `leadNombre`), así que pedir la fila para ellos
 * sería una lectura por un dato que estaba en la mano.
 */
export const CLAVES_DEL_LEAD: ReadonlySet<string> = new Set(
  VARIABLES_AVISO.filter((v) => v.alcance === 'lead' && v.key !== 'link_lead' && v.key !== 'lead_nombre')
    .map((v) => v.key),
);

/** ¿Este texto nombra algún dato que haya que ir a buscar a la ficha del lead? */
export function necesitaFichaDelLead(texto: string): boolean {
  if (typeof texto !== 'string' || !texto.includes('{{')) return false;
  for (const hit of texto.matchAll(RE_VARIABLE)) {
    if (CLAVES_DEL_LEAD.has(hit[0].slice(2, -2).toLowerCase())) return true;
  }
  return false;
}

/** Las rutas de los links, sin la base. Se arma en el server, que sabe la base. */
export const RUTA_DE_LINK: Readonly<Record<string, string>> = {
  link_crm: '/crm',
  link_anuncios: '/ads-manager',
  link_plan: '/plan',
  link_chat: '/whatsapp',
  link_integraciones: '/integraciones',
  link_configuraciones: '/configuraciones',
};

/** Las que ese mensaje puede resolver de verdad. Ofrecer el resto es prometer un dato
 *  que no existe — y lo que sale al WhatsApp del cliente es el `{{token}}` crudo. */
export function variablesPara(opts: { conLead: boolean; conCuota?: boolean }): VariableAviso[] {
  return VARIABLES_AVISO.filter((v) => (
    v.alcance === 'siempre' || (v.alcance === 'lead' ? opts.conLead : opts.conCuota === true)
  ));
}

/** El motivo por el que un dato no se puede poner en ESTE mensaje. Sale en el renglón
 *  apagado del desplegable, que es donde alguien lo va a leer. */
export const PORQUE_NO_SE_PUEDE = 'sólo si el mensaje lo dispara una acción';
/** Y para los datos de una cuota, que no se consiguen cambiando el disparador: los
 *  aporta el cron de cobranza y nada más. Decir «cambiá el disparador» acá sería mandar
 *  a hacer algo que no lo arregla, que es el candado sin llave de siempre. */
export const PORQUE_NO_HAY_CUOTA = 'sólo en los mensajes de cobranza';
/** El motivo que corresponde a cada alcance que falta. */
export const porqueNoSePuede = (a: VariableAviso['alcance']): string =>
  (a === 'cuota' ? PORQUE_NO_HAY_CUOTA : PORQUE_NO_SE_PUEDE);

/**
 * LO QUE EL SELECTOR DIBUJA: el catálogo ENTERO, agrupado, con cada fila diciendo si
 * este mensaje la puede resolver.
 *
 * ⚠️ Y SE OFRECEN TAMBIÉN LAS QUE NO, APAGADAS Y CON EL MOTIVO. La versión anterior las
 * FILTRABA, y la regla que lo justificaba es correcta pero no era esta pregunta: lo que
 * no se puede hacer es prometer un valor que va a salir crudo. Medido en el navegador el
 * 04/10/2026: un mensaje con disparador por tiempo —que son casi todos— ofrecía NUEVE
 * datos de 42, así que el catálogo extenso que se pidió no existía para quien lo abría.
 *
 * Apagada con su motivo, la fila es información y además dice cómo conseguirla (cambiar
 * el disparador a «por una acción»), que es la diferencia entre un control roto y un
 * guard que se arregla haciendo lo que pide. Un `disabled` del `Dropdown` no se puede
 * elegir, así que el token no puede entrar al texto.
 */
export function variablesOfrecidas(opts: { conLead: boolean; conCuota?: boolean }): Array<{ titulo: string; items: Array<VariableAviso & { resoluble: boolean }> }> {
  const puede = (a: VariableAviso['alcance']): boolean =>
    a === 'siempre' || (a === 'lead' ? opts.conLead : opts.conCuota === true);
  const marcadas = VARIABLES_AVISO.map((v) => ({ ...v, resoluble: puede(v.alcance) }));
  return GRUPOS_VARIABLES
    .map((g) => ({ titulo: g.titulo, items: marcadas.filter((v) => v.grupo === g.key) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Agrupa una lista YA filtrada, en el orden de `GRUPOS_VARIABLES`. La pantalla recibe
 * las variables por prop (las que ese mensaje puede resolver) y agrupa con esto: que la
 * pantalla vuelva a filtrar sería la segunda implementación de la regla de alcance.
 */
export function agruparVariables(vs: VariableAviso[]): Array<{ titulo: string; items: VariableAviso[] }> {
  return GRUPOS_VARIABLES
    .map((g) => ({ titulo: g.titulo, items: vs.filter((v) => v.grupo === g.key) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Lo mismo, agrupado y en el orden de `GRUPOS_VARIABLES`, que es lo que el selector
 * dibuja. Los grupos vacíos no salen: un título sin filas es un grupo que promete algo.
 *
 * Devuelve una forma NEUTRA (`{ titulo, items }`) y no el tipo del `Dropdown`: este
 * módulo no tiene `server-only` justamente para que lo importe la pantalla, y hacerlo
 * depender de un componente lo ataría al navegador en la otra dirección.
 */
export function variablesPorGrupo(opts: { conLead: boolean }): Array<{ titulo: string; items: VariableAviso[] }> {
  const vs = variablesPara(opts);
  return GRUPOS_VARIABLES
    .map((g) => ({ titulo: g.titulo, items: vs.filter((v) => v.grupo === g.key) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Sustituye los tokens conocidos. Lo desconocido se DEJA INTACTO, a propósito: un
 * token que sale crudo se ve raro y se nota; uno borrado deja el mensaje cojo y nadie
 * se entera de que faltaba algo.
 *
 * ⚠️ NO reusa `aplicarVariables` de lib/template-vars.ts: aquélla acepta `{una llave}`
 * y su regex es `[a-z_]+` sin dígitos, porque la comparte la NUTRICIÓN con la sintaxis
 * de Meta. Ampliarla para que acepte estos tokens convertiría un `{1}` de un copy de
 * nutrición en un candidato, y esa función además decide qué parámetros se registran
 * en Meta. Dos preguntas distintas, dos regex.
 */
export function resolverVariables(texto: string, vars: Record<string, string>): string {
  if (typeof texto !== 'string' || !texto) return '';
  return texto.replace(RE_VARIABLE, (m) => {
    const k = m.slice(2, -2).toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : m;
  });
}

/** Con qué se dibuja la vista previa: el `ejemplo` de cada uno. */
export function valoresDeEjemplo(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of VARIABLES_AVISO) out[v.key] = v.ejemplo;
  return out;
}
