// =============================================================================
// Los DATOS que se pueden meter adentro de un mensaje — el catálogo del botón «{ }»
// =============================================================================
// Pedido textual (30/09/2026): «hace falta configurar llamados a datos dentro de
// MaKo... Por ejemplo, llamados al CRM, traer el nombre, el número, el email, etc...
// O llamados a los anuncios, traer el rendimiento, el presupuesto... Y revisa también
// que hoy en día tenemos varios LINKS dentro de MaKo que podrían ser de utilidad...
// Para evitar poner mucha info dentro de un mensaje y aprovechar este sistema».
//
// Y la sexta tanda (09/10/2026), los dos pedidos de Martín:
//   · WhatsApp 10: «Faltan datos que se pueden poner en el botón de "{}", estoy seguro que hay
//     muchos más que podrían ser útiles... Siempre recuerda los desplegables tipo arbol y con los
//     íconos al lado. Y no entiendo el dato "Tu negocio", si ya está el de "Empresa", el de "Tu
//     negocio" eliminalo. Y esto para todos los lugares donde usamos el botón de {}, siempre lo
//     mismo en todos lados.»
//   · MaKo en WhatsApp 4: «falta muchísimos datos posibles que enviar en el botón de {}... Como
//     datos de campaña, del second brain, de lo que sea... Para eso ya tenemos una API, hazlo bien
//     y siempre como arbol los desplegables.»
//
// ── UN CATÁLOGO PARA TODOS LOS «{ }» ───────────────────────────────────────────
// Hasta el 09/10 había DOS: éste (los avisos de MaKo al equipo, 42 datos) y el del motor de las
// automatizaciones (lib/template-vars.ts: nombre, nombre completo, apellido, empresa y «Tu
// negocio»). Cada editor ofrecía el suyo, así que un WhatsApp al lead no podía decir la etapa ni
// la fecha de la reunión. Ahora hay UNO, con dos preguntas por dato:
//   · `destino`: a quién le llega el mensaje. Un link a la ficha del CRM, el estado o las
//     etiquetas son del EQUIPO (un lead no tiene nada que hacer con «no_responde»); el link al
//     portal del curso es del LEAD (mandarlo al grupo reparte la llave de su portal).
//   · `alcance`: qué tiene que traer el mensaje para poder resolverlo (un lead, una cuota).
// El selector (app/_components/SelectorDatos.tsx) dibuja `datosOfrecidos(contexto)`: los grupos
// como ÁRBOL, cada uno con su ícono, con buscador.
//
// ── LA REGLA DE ADMISIÓN, Y ES LA QUE HACE QUE ESTO NO MIENTA ───────────────
// **UNA lectura por ENTIDAD que el texto NOMBRA, y sólo si la nombra. Cero proveedores.**
// Cada dato declara su `fuente` (la entidad de la que sale) y el resolvedor
// (lib/variables-resolver.ts) lee una entidad sólo si el texto trae un token de ella
// (`fuentesQueNombra`). Un aviso que espera 900 ms a Meta para resolver `{{presupuesto}}` es un
// aviso que no sale: para los números de anuncios está `{{link_anuncios}}`, que lleva a la
// pantalla donde el número está fresco.
//
// ── Y SÓLO LO QUE EL MOTOR RESUELVE DE VERDAD (AGENTS.md) ─────────────────────
// Cada fila de acá tiene quien la ponga, y los tests lo cruzan: lo que no se resuelve sale
// CRUDO al WhatsApp (a propósito: crudo se nota, borrado deja el mensaje cojo), así que una fila
// ofrecida sin resolvedor es exactamente el bug.
//
// ⚠️ Y EL TOKEN VIAJA COMO TEXTO PLANO, NUNCA COMO UN CHIP. `domAMarcas` del editor
// aplana todo lo que no sea b/i/s y NO avisa: un `<span>` bonito que diga «Nombre
// del lead» se serializa como ese texto y la variable desaparece entera. Lo que se
// escribe en el contenteditable es `{{lead_nombre}}`, y el color se lo pone el
// pintado, no la etiqueta.
//
// ⚠️ PURO, SIN IMPORTS Y SIN `server-only`: lo importan las pantallas, el motor y los tests.

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

/**
 * De qué ENTIDAD sale el dato: es lo que decide qué se lee (una lectura por entidad nombrada).
 *   · `nombre`    — el nombre del lead: lo trae el evento (o la fila del motor); sin lectura.
 *   · `ficha`     — la fila de `leads` (`valoresDelLead`, lib/variables-del-lead.ts).
 *   · `zona`      — la fila y la zona del negocio (la HORA de una reunión).
 *   · `producto`  — la fila y el producto (embudo) en el que vive: etapa y nombre del producto.
 *   · `etiquetas` — sus etiquetas del CRM.
 *   · `pagos`     — sus cuotas (`pagos`).
 *   · `curso`     — el curso de su producto y su avance (lo que lee `ver_avance_curso_cs`).
 *   · `perfil`    — el perfil del negocio, del Second Brain (lo que lee `ver_perfil_negocio`).
 *   · `lead_magnet` — el entregable del negocio (lo que lee `listar_lead_magnets`).
 *   · `momento`   — la fecha y la hora, en la zona del negocio.
 *   · `negocio`   — el nombre del negocio.
 *   · `links`     — una ruta de MaKo más la base. · `evento` — el link a la ficha (con el id).
 *   · `cuota`     — la cuota de la que habla el aviso: la trae el emisor en `datos`.
 */
export type FuenteDato = 'nombre' | 'ficha' | 'zona' | 'producto' | 'etiquetas' | 'pagos' | 'curso'
  | 'perfil' | 'lead_magnet' | 'momento' | 'negocio' | 'links' | 'evento' | 'cuota';

/** A quién le llega el mensaje: al lead (las automatizaciones) o al equipo (MaKo en WhatsApp). */
export type DestinoMensaje = 'lead' | 'equipo';

/** Un dato que se puede meter adentro del texto de un mensaje. */
export type VariableAviso = {
  key: string;
  label: string;
  ejemplo: string;
  /**
   * Qué hace falta para que se pueda resolver. Es lo que filtra el selector.
   *
   * · `siempre` — se calcula o es una constante más la base.
   * · `lead`    — necesita que el mensaje hable de UN lead. Los eventos del CRM lo
   *               traen (`dispararEvento` pasa `leadId`); un cron horario, no.
   * · `cuota`   — necesita la cuota de la que habla el aviso. La trae el emisor en
   *               `datos`, que es lo que el cron de cobranza ya tiene en la mano: no
   *               hay lectura extra, y por eso puede estar acá.
   */
  alcance: 'siempre' | 'lead' | 'cuota';
  /** En qué grupo (rama del árbol) lo muestra el selector. El orden lo fija `GRUPOS_VARIABLES`. */
  grupo: GrupoVariable;
  /** De qué entidad sale (ver `FuenteDato`). */
  fuente: FuenteDato;
  /** Sólo para mensajes a este destino. Sin esto, para los dos. */
  soloPara?: DestinoMensaje;
  /**
   * Se RESUELVE pero no se OFRECE: un nombre viejo de otro dato que ya está en el árbol. Los
   * mensajes guardados con él siguen saliendo bien, y el selector no lo dibuja dos veces.
   */
  oculta?: true;
  /**
   * Cómo se escribe el valor. Lo aplica el resolvedor, no la pantalla: el mismo token
   * sale al WhatsApp, al email y a la previa, y tres formateos distintos del mismo
   * número es cómo se arma una contradicción entre canales.
   */
  formato?: 'texto' | 'plata' | 'fecha' | 'si_no';
};

export type GrupoVariable =
  | 'lead' | 'crm' | 'reuniones' | 'pagos' | 'campana' | 'formulario' | 'curso' | 'cerebro' | 'momento' | 'links';

/**
 * Las ramas del árbol, en orden, con su ícono (el `name` de `<Icon>`, app/_components/icons.tsx).
 * Un ícono por GRUPO y no por dato: «pon íconos en todos los desplegables... algo sutil que sea
 * estándar» — cuarenta íconos distintos en una lista no dicen nada.
 */
export const GRUPOS_VARIABLES: ReadonlyArray<{ key: GrupoVariable; titulo: string; icono: string }> = [
  { key: 'lead', titulo: 'Lead', icono: 'perfil' },
  { key: 'crm', titulo: 'CRM', icono: 'funnel' },
  { key: 'reuniones', titulo: 'Reuniones', icono: 'closing' },
  { key: 'pagos', titulo: 'Pagos', icono: 'sales' },
  { key: 'campana', titulo: 'Campaña', icono: 'meta' },
  { key: 'formulario', titulo: 'Formulario', icono: 'notepencil' },
  { key: 'curso', titulo: 'Curso', icono: 'contexto' },
  { key: 'cerebro', titulo: 'Second Brain', icono: 'cerebro' },
  { key: 'momento', titulo: 'Fecha y hora', icono: 'bell' },
  { key: 'links', titulo: 'Links de MaKo', icono: 'web' },
];

/**
 * EL CATÁLOGO.
 *
 * ⚠️ LA ETAPA AHORA SÍ ESTÁ (09/10/2026), y el porqué de que antes no estuviera sigue valiendo:
 * la etapa que dibuja el tablero se deriva cruzando el override manual con la calculada y la lista
 * de etapas válidas del embudo (`stageMeta` miente). La que sale acá es `etapaVigenteDe`
 * (lib/funnel-etapas.ts) contra las etapas del producto del lead, la MISMA función que usan el
 * tablero, la ficha y el disparador por etapa: no es una derivación propia.
 */
// ⚠️ LOS EJEMPLOS SON FICTICIOS, Y ACÁ SE ESCRIBIERON MAL DOS VECES. El 04/10/2026 el
// catálogo salió con el closer «Mauricio», el setter «Leila» y el negocio «Código
// Inmobiliario»: un cliente, una clienta y otro cliente, dibujados como ejemplo en la
// pantalla que abre cualquiera de los demás. Lo caza `tests/variables-aviso.test.ts` con la
// lista de nombres reales.
//
// ⚠️ Y UN NOMBRE DE EJEMPLO NO PUEDE SER UN VERBO VOSEADO. «Tomás» duró un minuto: el
// guard del voseo lo leyó como la conjugación de «tomar» y frenó los tests.
export const VARIABLES_AVISO: VariableAviso[] = [
  // ── Lead. El nombre lo trae el evento (o la fila del motor); el resto, la fila de `leads`.
  //    `nombre`, `nombre_completo`, `apellido` y `empresa` son los del motor de siempre
  //    (lib/template-vars.ts): los mensajes guardados ya los usan.
  { key: 'nombre', label: 'Nombre', ejemplo: 'Sofía', alcance: 'lead', grupo: 'lead', fuente: 'nombre' },
  { key: 'nombre_completo', label: 'Nombre completo', ejemplo: 'Sofía Contreras', alcance: 'lead', grupo: 'lead', fuente: 'nombre' },
  { key: 'apellido', label: 'Apellido', ejemplo: 'Contreras', alcance: 'lead', grupo: 'lead', fuente: 'nombre' },
  { key: 'lead_email', label: 'Email', ejemplo: 'sofia@ejemplo.com', alcance: 'lead', grupo: 'lead', fuente: 'ficha' },
  { key: 'lead_telefono', label: 'Teléfono', ejemplo: '+52 1 55 1234 5678', alcance: 'lead', grupo: 'lead', fuente: 'ficha' },
  { key: 'empresa', label: 'Empresa', ejemplo: 'Inmobiliaria del Valle', alcance: 'lead', grupo: 'lead', fuente: 'ficha' },
  { key: 'lead_web', label: 'Web', ejemplo: 'inmobiliariadelvalle.com', alcance: 'lead', grupo: 'lead', fuente: 'ficha' },
  { key: 'lead_alta', label: 'Cuándo entró', ejemplo: '02/10', alcance: 'lead', grupo: 'lead', fuente: 'ficha', formato: 'fecha' },
  // Los nombres viejos de los avisos: se resuelven, no se ofrecen (ya están arriba).
  { key: 'lead_nombre', label: 'Nombre completo', ejemplo: 'Sofía Contreras', alcance: 'lead', grupo: 'lead', fuente: 'nombre', oculta: true },
  { key: 'lead_empresa', label: 'Empresa', ejemplo: 'Inmobiliaria del Valle', alcance: 'lead', grupo: 'lead', fuente: 'ficha', oculta: true },

  // ── CRM. La etapa y el producto salen de su producto; el resto, de la fila.
  { key: 'lead_etapa', label: 'Etapa', ejemplo: 'Agendado', alcance: 'lead', grupo: 'crm', fuente: 'producto' },
  { key: 'lead_producto', label: 'Producto', ejemplo: 'Mentoría 1:1', alcance: 'lead', grupo: 'crm', fuente: 'producto' },
  { key: 'lead_closer', label: 'Closer', ejemplo: 'Daniela', alcance: 'lead', grupo: 'crm', fuente: 'ficha' },
  { key: 'lead_setter', label: 'Setter', ejemplo: 'Valeria', alcance: 'lead', grupo: 'crm', fuente: 'ficha' },
  { key: 'lead_estado', label: 'Estado', ejemplo: 'abierto', alcance: 'lead', grupo: 'crm', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_etiquetas', label: 'Etiquetas', ejemplo: 'Cualificado, Seguimiento', alcance: 'lead', grupo: 'crm', fuente: 'etiquetas', soloPara: 'equipo' },
  { key: 'lead_calificado', label: '¿Está calificado?', ejemplo: 'sí', alcance: 'lead', grupo: 'crm', fuente: 'ficha', formato: 'si_no', soloPara: 'equipo' },
  { key: 'lead_motivo_perdida', label: 'Motivo de la pérdida', ejemplo: 'sin presupuesto', alcance: 'lead', grupo: 'crm', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'link_lead', label: 'Link a su ficha', ejemplo: '/crm/2498/resumen', alcance: 'lead', grupo: 'crm', fuente: 'evento', soloPara: 'equipo' },

  // ── Reuniones.
  { key: 'lead_fecha_agenda', label: 'Cuándo agendó', ejemplo: '12/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_fecha_r1', label: 'Fecha de la 1ª reunión', ejemplo: '14/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_hora_r1', label: 'Hora de la 1ª reunión', ejemplo: '17:30', alcance: 'lead', grupo: 'reuniones', fuente: 'zona' },
  { key: 'lead_link_r1', label: 'Link de la 1ª reunión', ejemplo: 'https://meet.google.com/abc-defg-hij', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha' },
  { key: 'lead_fecha_r2', label: 'Fecha de la 2ª reunión', ejemplo: '21/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_hora_r2', label: 'Hora de la 2ª reunión', ejemplo: '18:00', alcance: 'lead', grupo: 'reuniones', fuente: 'zona' },
  { key: 'lead_link_r2', label: 'Link de la 2ª reunión', ejemplo: 'https://meet.google.com/klm-nopq-rst', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha' },
  { key: 'lead_asistio_r1', label: '¿Asistió a la 1ª?', ejemplo: 'sí', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'si_no', soloPara: 'equipo' },
  { key: 'lead_asistio_r2', label: '¿Asistió a la 2ª?', ejemplo: 'no', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'si_no', soloPara: 'equipo' },

  // ── Pagos. El saldo se CALCULA de dos columnas: es la pregunta de cobranza. La próxima cuota
  //    y las pagadas salen de sus filas de `pagos` (la misma lectura que la ficha).
  { key: 'lead_monto_cierre', label: 'Monto del cierre', ejemplo: 'US$ 1.500', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'plata' },
  { key: 'lead_cobrado', label: 'Cuánto pagó ya', ejemplo: 'US$ 500', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'plata' },
  { key: 'lead_saldo', label: 'Cuánto le falta pagar', ejemplo: 'US$ 1.000', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'plata' },
  { key: 'lead_cuota', label: 'Monto de cada cuota', ejemplo: 'US$ 250', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'plata' },
  { key: 'lead_proxima_cuota', label: 'Próxima cuota', ejemplo: 'US$ 250', alcance: 'lead', grupo: 'pagos', fuente: 'pagos', formato: 'plata' },
  { key: 'lead_proxima_cuota_vence', label: 'Vencimiento de la próxima cuota', ejemplo: '10/11', alcance: 'lead', grupo: 'pagos', fuente: 'pagos', formato: 'fecha' },
  { key: 'lead_cuotas_pagadas', label: 'Cuotas pagadas', ejemplo: '2 de 4', alcance: 'lead', grupo: 'pagos', fuente: 'pagos' },
  { key: 'lead_dia_de_pago', label: 'Qué día del mes paga', ejemplo: '10', alcance: 'lead', grupo: 'pagos', fuente: 'ficha' },
  { key: 'lead_fecha_cierre', label: 'Cuándo cerró', ejemplo: '28/09', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_suscripcion', label: 'Suscripción mensual', ejemplo: 'US$ 500', alcance: 'lead', grupo: 'pagos', fuente: 'ficha', formato: 'plata' },
  // La CUOTA de la que habla el aviso. Las trae el emisor en `datos`: el cron de cobranza ya
  // leyó la fila de `pagos` para decidir que hay que avisar, así que pasarlas no cuesta una
  // lectura. Y van por CÓDIGO y no por el modelo, que es la regla de la casa para un dato
  // exacto: un monto que pasa por un LLM deja de ser exacto.
  { key: 'cuota_numero', label: 'Número de cuota', ejemplo: '2', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota' },
  { key: 'cuota_monto', label: 'Monto de esta cuota', ejemplo: 'US$ 1.700', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota', formato: 'plata' },
  { key: 'cuota_vence', label: 'Cuándo vence esta cuota', ejemplo: '10/10', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota', formato: 'fecha' },
  { key: 'cuota_dias', label: 'Hace cuánto venció (o en cuánto vence)', ejemplo: '3 días', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota' },

  // ── Campaña: de dónde vino. Son nombres internos (de la campaña, del anuncio): para el equipo.
  { key: 'lead_origen', label: 'Por dónde entró', ejemplo: 'instant_form', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_campana', label: 'Campaña de Meta', ejemplo: 'Inmobiliario · Octubre', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_conjunto', label: 'Conjunto de anuncios', ejemplo: 'Dueños 35-55', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_anuncio', label: 'Anuncio de Meta', ejemplo: 'Video testimonio 3', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_utm_source', label: 'UTM source', ejemplo: 'facebook', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_utm_medium', label: 'UTM medium', ejemplo: 'cpc', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_utm_campaign', label: 'UTM campaign', ejemplo: 'oct-leads', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },
  { key: 'lead_utm_content', label: 'UTM content', ejemplo: 'video-3', alcance: 'lead', grupo: 'campana', fuente: 'ficha', soloPara: 'equipo' },

  // ── Formulario: lo que contestó. Son SUS respuestas: se le pueden repetir a él.
  { key: 'lead_facturacion', label: 'Cuánto factura', ejemplo: 'US$ 10k - 30k', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  { key: 'lead_colaboradores', label: 'Cuántos colaboradores', ejemplo: '5 a 10', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  { key: 'lead_objetivo', label: 'Su objetivo', ejemplo: 'duplicar las ventas', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  { key: 'lead_cuando_empezar', label: 'Cuándo quiere empezar', ejemplo: 'este mes', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  { key: 'lead_inversion', label: 'Cuánto puede invertir', ejemplo: 'US$ 1k - 3k', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  { key: 'lead_decisor', label: '¿Decide él?', ejemplo: 'sí', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },
  // Las preguntas PROPIAS de un formulario de Meta (las que no son nombre, email, teléfono ni
  // empresa), una por renglón. Sale de `leads.meta_field_data` con `resumenRespuestas`.
  { key: 'lead_formulario', label: 'Todo lo que contestó en Meta', ejemplo: '• ¿Qué tipo de propiedad buscas vender?: Una casa\n• ¿En qué zona está?: Palermo', alcance: 'lead', grupo: 'formulario', fuente: 'ficha' },

  // ── Curso: el de su producto, con las MISMAS reglas que el portal (`claseCompleta`).
  { key: 'curso_avance', label: 'Clases completadas', ejemplo: '4 de 12', alcance: 'lead', grupo: 'curso', fuente: 'curso' },
  { key: 'curso_pct', label: 'Avance del curso', ejemplo: '33 %', alcance: 'lead', grupo: 'curso', fuente: 'curso' },
  { key: 'curso_proxima_clase', label: 'Próxima clase', ejemplo: 'Cómo armar tu oferta', alcance: 'lead', grupo: 'curso', fuente: 'curso' },
  // ⚠️ SÓLO AL LEAD: es la llave de SU portal. En el grupo del equipo, cualquiera entra como él.
  //    Y sólo si ya se la dieron: un mensaje automático no le abre una puerta a nadie.
  { key: 'curso_link', label: 'Link a su curso', ejemplo: 'https://hola-mako.com/compartido/curso/…', alcance: 'lead', grupo: 'curso', fuente: 'curso', soloPara: 'lead' },

  // ── Second Brain: lo que el negocio cargó de sí (el perfil del Archivero y el lead magnet).
  //    ⛔ SIN «Tu negocio»: Martín, «si ya está el de "Empresa", el de "Tu negocio" eliminalo».
  { key: 'negocio_oferta', label: 'Oferta', ejemplo: 'Mentoría para dueños de pyme', alcance: 'siempre', grupo: 'cerebro', fuente: 'perfil' },
  { key: 'negocio_precio', label: 'Precio de la oferta', ejemplo: 'US$ 5.000', alcance: 'siempre', grupo: 'cerebro', fuente: 'perfil', formato: 'plata' },
  { key: 'negocio_promesa', label: 'Promesa', ejemplo: 'De cuello de botella a dueño que escala', alcance: 'siempre', grupo: 'cerebro', fuente: 'perfil' },
  { key: 'negocio_garantia', label: 'Garantía', ejemplo: '30 días o devolución', alcance: 'siempre', grupo: 'cerebro', fuente: 'perfil' },
  { key: 'negocio_personaje', label: 'Personaje de marca', ejemplo: 'Sol', alcance: 'siempre', grupo: 'cerebro', fuente: 'perfil' },
  { key: 'negocio_lead_magnet', label: 'Lead magnet', ejemplo: 'Plantilla de precios', alcance: 'siempre', grupo: 'cerebro', fuente: 'lead_magnet' },
  { key: 'negocio_lead_magnet_link', label: 'Link del lead magnet', ejemplo: 'https://ejemplo.com/plantilla', alcance: 'siempre', grupo: 'cerebro', fuente: 'lead_magnet' },
  // El nombre del negocio («Tu negocio» en el motor, «El nombre del negocio» en los avisos): se
  // RESUELVE —hay mensajes guardados con él— y ya no se ofrece.
  { key: 'negocio', label: 'El nombre del negocio', ejemplo: 'Inmobiliaria del Valle', alcance: 'siempre', grupo: 'cerebro', fuente: 'negocio', oculta: true },

  // ── Fecha y hora, en la zona del negocio. Se calculan.
  { key: 'fecha', label: 'La fecha de hoy', ejemplo: '30/09', alcance: 'siempre', grupo: 'momento', fuente: 'momento', formato: 'fecha' },
  { key: 'dia_semana', label: 'El día de la semana', ejemplo: 'martes', alcance: 'siempre', grupo: 'momento', fuente: 'momento' },
  { key: 'hora', label: 'La hora', ejemplo: '09:00', alcance: 'siempre', grupo: 'momento', fuente: 'momento' },

  // ── Links a una pantalla de MaKo: una constante más la base. Son del EQUIPO (un lead no entra
  //    al CRM del negocio), y evitan pegar media pantalla adentro de un WhatsApp.
  { key: 'link_crm', label: 'El CRM', ejemplo: '/crm', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
  { key: 'link_anuncios', label: 'Los anuncios', ejemplo: '/ads-manager', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
  { key: 'link_plan', label: 'El plan', ejemplo: '/plan', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
  { key: 'link_chat', label: 'Las conversaciones', ejemplo: '/whatsapp', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
  { key: 'link_integraciones', label: 'Integraciones', ejemplo: '/integraciones', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
  { key: 'link_configuraciones', label: 'Configuraciones', ejemplo: '/configuraciones', alcance: 'siempre', grupo: 'links', fuente: 'links', soloPara: 'equipo' },
];

const POR_CLAVE: ReadonlyMap<string, VariableAviso> = new Map(VARIABLES_AVISO.map((v) => [v.key, v]));

/** El dato de una clave (en minúsculas), o `undefined` si no es del catálogo. */
export const datoDe = (key: string): VariableAviso | undefined => POR_CLAVE.get(key.toLowerCase());

/**
 * Las claves que necesitan la fila del lead y que pone `valoresDelLead` (lib/variables-del-lead.ts).
 * Se DERIVA del catálogo: una lista escrita al lado se queda vieja al próximo token, y el modo de
 * falla sería un token que sale crudo sin que nadie entienda por qué.
 *
 * El nombre (`fuente: 'nombre'`) y `link_lead` quedan afuera a propósito: se resuelven con lo que
 * el evento ya trae (`leadNombre` y `leadId`), así que pedir la fila por ellos sería una lectura
 * por un dato que estaba en la mano.
 */
export const CLAVES_DEL_LEAD: ReadonlySet<string> = new Set(
  VARIABLES_AVISO.filter((v) => v.fuente === 'ficha').map((v) => v.key),
);

/** Las ENTIDADES que nombra un texto: lo que el resolvedor tiene que leer, y nada más. */
export function fuentesQueNombra(texto: string): Set<FuenteDato> {
  const out = new Set<FuenteDato>();
  if (typeof texto !== 'string' || !texto.includes('{{')) return out;
  for (const hit of texto.matchAll(RE_VARIABLE)) {
    const d = datoDe(hit[0].slice(2, -2));
    if (d) out.add(d.fuente);
  }
  return out;
}

/**
 * ¿Este texto nombra algún dato que haya que ir a buscar a la ficha del lead? (La hora de una
 * reunión, la etapa, el producto y el curso también la necesitan: salen de su fila.)
 */
export function necesitaFichaDelLead(texto: string): boolean {
  const f = fuentesQueNombra(texto);
  return f.has('ficha') || f.has('zona') || f.has('producto') || f.has('curso');
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

/** Para qué mensaje se arma el selector. Sin `destino`, el equipo (los avisos de siempre). */
export type ContextoDatos = { conLead: boolean; conCuota?: boolean; destino?: DestinoMensaje };

/** ¿Este dato vale para un mensaje a este destino? (las claves `oculta` se resuelven igual). */
export const valePara = (v: VariableAviso, destino: DestinoMensaje): boolean => !v.soloPara || v.soloPara === destino;

/** Las que ese mensaje puede resolver de verdad. Ofrecer el resto es prometer un dato
 *  que no existe — y lo que sale al WhatsApp del cliente es el `{{token}}` crudo. */
export function variablesPara(opts: ContextoDatos): VariableAviso[] {
  const destino = opts.destino ?? 'equipo';
  return VARIABLES_AVISO.filter((v) => (
    !v.oculta && valePara(v, destino)
    && (v.alcance === 'siempre' || (v.alcance === 'lead' ? opts.conLead : opts.conCuota === true))
  ));
}

/** Una rama del árbol que dibuja el selector. */
export type GrupoDatos = { key: GrupoVariable; titulo: string; icono: string; items: VariableAviso[] };

/**
 * LO QUE EL SELECTOR DIBUJA: los datos que ESTE mensaje puede resolver, como árbol.
 *
 * ⚠️ LO QUE NO SE PUEDE PONER NO SE MUESTRA, Y ESTUVO AL REVÉS MEDIO DÍA. El 04/10 se
 * ofrecían TODOS con los no resolubles apagados y su motivo al lado. Al verlo, Martín: «si no
 * está disponible porque elegí por tiempo y no por acción, no lo muestres directamente, no que
 * esté en gris, eso confunde» (05/10). El dato no se pierde: lo que un mensaje PUEDE resolver
 * cuelga de su disparador, y eso se ve y se cambia en la tarjeta de entrada del lienzo.
 */
export function datosOfrecidos(opts: ContextoDatos): GrupoDatos[] {
  return agruparVariables(variablesPara(opts));
}

/** Lo mismo con el nombre de antes (los avisos al equipo). */
export function variablesOfrecidas(opts: ContextoDatos): GrupoDatos[] {
  return datosOfrecidos(opts);
}

/**
 * Agrupa una lista YA filtrada, en el orden de `GRUPOS_VARIABLES`. La pantalla recibe
 * las variables por prop (las que ese mensaje puede resolver) y agrupa con esto: que la
 * pantalla vuelva a filtrar sería la segunda implementación de la regla de alcance.
 * Los grupos vacíos no salen: un título sin filas es un grupo que promete algo.
 */
export function agruparVariables(vs: VariableAviso[]): GrupoDatos[] {
  return GRUPOS_VARIABLES
    .map((g) => ({ key: g.key, titulo: g.titulo, icono: g.icono, items: vs.filter((v) => v.grupo === g.key) }))
    .filter((g) => g.items.length > 0);
}

/** Lo mismo, con el contexto viejo (sólo `conLead`). */
export function variablesPorGrupo(opts: ContextoDatos): GrupoDatos[] {
  return agruparVariables(variablesPara(opts));
}

/**
 * La BÚSQUEDA del selector: los datos cuyo rótulo, ejemplo, token o grupo contienen lo tipeado,
 * sin importar tildes ni mayúsculas, en el orden del árbol. Vive acá (puro) para que el test la
 * EJECUTE: buscar «saldo» tiene que encontrar «Cuánto le falta pagar», y la palabra que uno tiene
 * en la cabeza es la del token, que no está escrita en ningún renglón.
 */
export function buscarDatos(grupos: readonly GrupoDatos[], q: string): Array<{ grupo: GrupoDatos; dato: VariableAviso }> {
  const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const palabras = norm(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const out: Array<{ grupo: GrupoDatos; dato: VariableAviso }> = [];
  for (const g of grupos) {
    for (const d of g.items) {
      const pajar = norm(`${d.label} ${d.ejemplo} ${d.key} ${g.titulo}`);
      if (palabras.every((p) => pajar.includes(p))) out.push({ grupo: g, dato: d });
    }
  }
  return out;
}

/**
 * Sustituye los tokens conocidos. Lo desconocido se DEJA INTACTO, a propósito: un
 * token que sale crudo se ve raro y se nota; uno borrado deja el mensaje cojo y nadie
 * se entera de que faltaba algo.
 *
 * ⚠️ NO reusa la función de la nutrición (lib/template-vars.ts): aquélla también acepta
 * `{una llave}`, porque la comparte con la sintaxis de Meta. Ampliar ésta para que acepte una
 * llave sola convertiría un `{1}` de un copy en un candidato. Dos preguntas distintas, dos regex.
 */
export function resolverVariables(texto: string, vars: Record<string, string>): string {
  if (typeof texto !== 'string' || !texto) return '';
  return texto.replace(RE_VARIABLE, (m) => {
    const k = m.slice(2, -2).toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : m;
  });
}

/** Con qué se dibuja la vista previa: el `ejemplo` de cada uno (también los ocultos). */
export function valoresDeEjemplo(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of VARIABLES_AVISO) out[v.key] = v.ejemplo;
  return out;
}
