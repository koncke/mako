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
 *   · `cobro`     — su cobro PENDIENTE más nuevo de Stripe o Mercado Pago (`cobros`, mig 0255): el
 *                   link de pago. De la tabla, nunca de la pasarela.
 *   · `proxima`   — su PRÓXIMA reunión (undécima tanda, 11/10/2026): la fila, la zona del negocio y el momento
 *                   de mandar (`proximaReunion` estricta, lib/nutricion-reinscripcion.ts). Se lee con la ficha.
 *   · `respuestas`— lo que contestó al agendar: la ÚLTIMA fila de `lead_respuestas` (una lectura aparte).
 *   · `pago`      — el pago del que habla el aviso «Entró un pago»: lo trae el emisor en `datos`
 *                   (`avisarPagoRecibido`, lib/cobros.ts), por código, como la cuota. Ojo: NO es `pagos` (sus
 *                   cuotas del CRM) ni `cobro` (su link pendiente).
 *   · `escrito`   — lo que el lead escribió y MaKo no contestó: lo trae el emisor en `datos` (la charla).
 */
export type FuenteDato = 'nombre' | 'ficha' | 'zona' | 'producto' | 'etiquetas' | 'pagos' | 'curso'
  | 'perfil' | 'lead_magnet' | 'momento' | 'negocio' | 'links' | 'evento' | 'cuota' | 'cobro'
  | 'proxima' | 'respuestas' | 'pago' | 'escrito' | 'analisis' | 'cuenta' | 'linea' | 'grabacion';

/**
 * A quién le llega el mensaje: al lead (las automatizaciones), al equipo (MaKo en WhatsApp) o a un USUARIO de MaKo
 * (15/10/2026: «Email a la persona» de un evento de una persona, `EventoMako.persona`).
 */
export type DestinoMensaje = 'lead' | 'equipo' | 'usuario';

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
   * · `mensaje` — necesita el TEXTO que arma el código del aviso (11/10/2026: un evento de MaKo cuyo
   *               aviso es `textoDelCodigo`). Lo pone el emisor (`ejecutarPaso`, lib/flujos.ts).
   * · `pago`    — necesita el PAGO del que habla el aviso (sólo el evento `pago_recibido`): lo pasa el emisor
   *               en `datos`, por código (es plata).
   * · `escrito` — necesita lo que el lead ESCRIBIÓ (sólo el evento `lead_contesta`): lo pasa el emisor.
   * · `analisis` — necesita el ANÁLISIS que terminó el AI Analyst del Dashboard (sólo el evento `analisis_listo`): lo
   *               pasa el emisor (`analizarHoja`, lib/graficos-analisis-server.ts) armado con `valoresDelAnalisis`.
   * · `linea`   — necesita la LÍNEA de WhatsApp de un negocio que se cayó o volvió (los eventos de la plataforma
   *               `whatsapp_caido` y `whatsapp_volvio`): lo pasa lib/lineas-vigilante.ts (`datosCaida`), por código.
   * · `grabacion` — necesita la REUNIÓN QUE TERMINÓ y quedó grabada (el evento de la plataforma `reunion_grabada`):
   *               lo pasa el webhook de Fathom (`datosPostLlamada`, lib/reunion-grabada.ts).
   */
  alcance: 'siempre' | 'lead' | 'cuota' | 'mensaje' | 'pago' | 'escrito' | 'analisis' | 'restablecer' | 'linea' | 'grabacion';
  /**
   * UN DATO SECRETO (15/10/2026, docs/diseno-2fa-obligatorio.md §3 y §8): el link de restablecer la contraseña (y
   * después el código del 2FA por correo). Sale SÓLO en el mail a la persona y NUNCA se guarda: `sinSecretos` lo saca
   * del contexto de toda corrida que se guarda (lib/flujo-corridas.ts), y un evento que lo trae no lleva DELAY
   * (`pasosDelEvento`, lib/aviso-evento.ts). No va al feed, al push ni al doer: la tarjeta que lo manda no pasa por
   * `emitirAviso`.
   */
  secreto?: true;
  /** En qué grupo (rama del árbol) lo muestra el selector. El orden lo fija `GRUPOS_VARIABLES`. */
  grupo: GrupoVariable;
  /**
   * Una SUB-RAMA dentro del grupo (undécima tanda: «Próxima reunión» adentro de «Reuniones»). Sin esto, el dato
   * cuelga directo del grupo. Es dato: lo dibuja el selector (app/_components/SelectorDatos.tsx) y lo encuentra
   * la búsqueda (`buscarDatos`).
   */
  rama?: string;
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
  | 'lead' | 'crm' | 'reuniones' | 'pagos' | 'campana' | 'formulario' | 'curso' | 'cerebro' | 'dashboard' | 'momento' | 'links' | 'cuenta' | 'linea';

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
  { key: 'dashboard', titulo: 'Dashboard', icono: 'graphics' },
  { key: 'momento', titulo: 'Fecha y hora', icono: 'bell' },
  { key: 'links', titulo: 'Links de MaKo', icono: 'web' },
  { key: 'cuenta', titulo: 'Cuenta de MaKo', icono: 'perfil' },
  { key: 'linea', titulo: 'WhatsApp del negocio', icono: 'whatsapp' },
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
/**
 * «LO QUE ARMA MAKO» (11/10/2026, docs/diseno-mako-en-whatsapp-unificado.md §2): el texto que el código de un
 * aviso arma con lo que tiene en la mano —la reunión con su link, lo que contestó el lead y qué le dejó
 * preparado—. En un evento de MaKo con ese texto (`datosDelEvento`, lib/aviso-evento.ts) la tarjeta «MaKo en
 * WhatsApp» lo pone con este dato, así sale EXACTAMENTE lo de siempre. Lo pone el emisor (`ejecutarPaso`,
 * lib/flujos.ts), no una lectura: es del evento, como el link a la ficha.
 */
export const CLAVE_MENSAJE_MAKO = 'mensaje_mako';

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
  // LO QUE ESCRIBIÓ (undécima tanda, 11/10/2026, punto 4): el mensaje del lead que MaKo no contestó, en el evento
  // «Un lead contesta» (`ContextoDatos.conEscrito`). Es lo que el aviso de la charla pegaba adentro de
  // `{{mensaje_mako}}`; ahora es un dato que se cita. Al equipo: al lead no se le repite lo que dijo.
  { key: 'lead_escribio', label: 'Lo que escribió', ejemplo: '¿Puedo cambiar la hora de la reunión?', alcance: 'escrito', grupo: 'lead', fuente: 'escrito', soloPara: 'equipo' },
  // Lo que arma MaKo: sólo en un evento de MaKo con texto del código (`ContextoDatos.conMensaje`).
  // ⚠️ UNDÉCIMA TANDA (11/10/2026, punto 4: «ese dato NO existe... No es trackeable»): OCULTO. No se ofrece en ningún
  // «{ }» y Publicar lo rechaza (`RETIRADOS`, lib/tokens-del-flujo.ts); se sigue RESOLVIENDO para las filas vivas que lo
  // tienen (#239, #240) hasta la limpieza, después del script de la ola 4 (docs/diseno-undecima-tanda.md §8.7).
  { key: CLAVE_MENSAJE_MAKO, label: 'Lo que arma MaKo', ejemplo: '⏰ En 30 min tienes la R1 con Laura Gil.', alcance: 'mensaje', grupo: 'lead', fuente: 'evento', soloPara: 'equipo', oculta: true },
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
  //    «PRÓXIMA REUNIÓN» (undécima tanda, 11/10/2026, puntos 4, 6 y 8): la que viene, sea la 1ª o la 2ª. Es lo que
  //    dicen un recordatorio y el aviso «Nuevo agendado», que hasta hoy salían de un emisor aparte con su catálogo
  //    de CINCO («el desplegable de datos solo me muestra 5 opciones… Eso está mal»). Salen de
  //    `proximaReunion(…, { estricta: true })` (lib/nutricion-reinscripcion.ts), la MISMA reunión que ancla el
  //    DELAY «antes de la reunión»: hora puesta, fecha en pie que coincide y sin asistencia. Sin una así, ninguno
  //    tiene valor y su renglón se va (`sinRenglonesVacios`). «Cuánto falta» se calcula AL MANDAR.
  { key: 'reunion_cuando', label: 'Cuándo es', ejemplo: 'mañana', alcance: 'lead', grupo: 'reuniones', rama: 'Próxima reunión', fuente: 'proxima' },
  { key: 'reunion_hora', label: 'Hora', ejemplo: '10:00 a. m.', alcance: 'lead', grupo: 'reuniones', rama: 'Próxima reunión', fuente: 'proxima' },
  { key: 'reunion_faltan', label: 'Cuánto falta', ejemplo: 'en 1 hora', alcance: 'lead', grupo: 'reuniones', rama: 'Próxima reunión', fuente: 'proxima' },
  { key: 'reunion_link', label: 'Link para entrar', ejemplo: 'https://meet.google.com/abc-defg-hij', alcance: 'lead', grupo: 'reuniones', rama: 'Próxima reunión', fuente: 'proxima' },
  { key: 'reunion_cual', label: 'Qué reunión', ejemplo: '1ª reunión', alcance: 'lead', grupo: 'reuniones', rama: 'Próxima reunión', fuente: 'proxima' },
  { key: 'lead_fecha_agenda', label: 'Cuándo agendó', ejemplo: '12/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_fecha_r1', label: 'Fecha de la 1ª reunión', ejemplo: '14/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_hora_r1', label: 'Hora de la 1ª reunión', ejemplo: '5:30 p. m.', alcance: 'lead', grupo: 'reuniones', fuente: 'zona' },
  { key: 'lead_link_r1', label: 'Link de la 1ª reunión', ejemplo: 'https://meet.google.com/abc-defg-hij', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha' },
  { key: 'lead_fecha_r2', label: 'Fecha de la 2ª reunión', ejemplo: '21/10', alcance: 'lead', grupo: 'reuniones', fuente: 'ficha', formato: 'fecha' },
  { key: 'lead_hora_r2', label: 'Hora de la 2ª reunión', ejemplo: '6:00 p. m.', alcance: 'lead', grupo: 'reuniones', fuente: 'zona' },
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
  // El LINK PARA PAGAR (11/10/2026, la pasarela de pagos): el /pagar/<token> de su cobro PENDIENTE
  // más nuevo, el que dejó «Cobrar con link» en la ficha o un paso «⚡ Acción» de crear un link de
  // pago. Sale de la tabla `cobros` y de nada más (la regla de admisión: cero proveedores al
  // resolver). Para los dos destinos. ⚠️ En una venta de MaKo con alta automática, ese link también deja
  // cambiar el email de acceso en las primeras 48 h (app/pagar/cambio-email.ts): no es «sólo pagar».
  // Sin cobro pendiente NO queda crudo: dice que no hay
  // (`valoresDelCobro`, lib/variables-del-lead.ts), como «ninguna» en las etiquetas.
  { key: 'link_pago', label: 'Link para pagar', ejemplo: 'https://hola-mako.com/pagar/…', alcance: 'lead', grupo: 'pagos', fuente: 'cobro' },
  // La CUOTA de la que habla el aviso. Las trae el emisor en `datos`: el cron de cobranza ya
  // leyó la fila de `pagos` para decidir que hay que avisar, así que pasarlas no cuesta una
  // lectura. Y van por CÓDIGO y no por el modelo, que es la regla de la casa para un dato
  // exacto: un monto que pasa por un LLM deja de ser exacto.
  { key: 'cuota_numero', label: 'Número de cuota', ejemplo: '2', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota' },
  { key: 'cuota_monto', label: 'Monto de esta cuota', ejemplo: 'US$ 1.700', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota', formato: 'plata' },
  { key: 'cuota_vence', label: 'Cuándo vence esta cuota', ejemplo: '10/10', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota', formato: 'fecha' },
  { key: 'cuota_dias', label: 'Hace cuánto venció (o en cuánto vence)', ejemplo: '3 días', alcance: 'cuota', grupo: 'pagos', fuente: 'cuota' },
  // EL PAGO de «Entró un pago» (undécima tanda, 11/10/2026, punto 4 sobre el evento `pago_recibido`): lo que el
  // aviso pegaba adentro de `{{mensaje_mako}}`, en datos que se citan. Los pasa `avisarPagoRecibido`
  // (lib/cobros.ts) en `datos`, armados por `valoresDelPago` (lib/variables-del-lead.ts): por CÓDIGO, es plata.
  // Al equipo. «Prueba» sólo en un cobro de prueba, y el alta sólo en una venta de MaKo: si no, no tienen valor y
  // su renglón se va.
  { key: 'pago_monto', label: 'Monto del pago', ejemplo: 'US$ 2.300', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo', formato: 'plata' },
  { key: 'pago_concepto', label: 'Qué pagó', ejemplo: 'Mentoría 1:1', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo' },
  { key: 'pago_pasarela', label: 'Por dónde pagó', ejemplo: 'Stripe', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo' },
  { key: 'pago_tipo', label: 'Primer pago o renovación', ejemplo: 'Primer pago', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo' },
  { key: 'pago_modo', label: 'Pago de prueba', ejemplo: 'Prueba', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo' },
  { key: 'pago_alta', label: 'Su cuenta de MaKo', ejemplo: 'Cuenta creada', alcance: 'pago', grupo: 'pagos', fuente: 'pago', soloPara: 'equipo' },

  // EL ANÁLISIS de «El AI Analyst terminó» (13/10/2026, la tarea del Dashboard en Automations: «que se pueda configurar
  // en automations y consumir esto»). Lo pasa el emisor (`analizarHoja`, lib/graficos-analisis-server.ts) armado con
  // `valoresDelAnalisis` (lib/variables-del-lead.ts). NO es `{{mensaje_mako}}`: son datos citables, cada uno en su renglón
  // (un dato sin valor se lleva el renglón). Los hallazgos llegan SIN nombres de personas (los filtra el Dashboard).
  { key: 'analisis_hoja', label: 'Hoja analizada', ejemplo: 'Marketing', alcance: 'analisis', grupo: 'dashboard', fuente: 'analisis', soloPara: 'equipo' },
  { key: 'analisis_resumen', label: 'Resumen del análisis', ejemplo: 'Las agendas subieron 18% y el costo por lead bajó a US$ 4,10.', alcance: 'analisis', grupo: 'dashboard', fuente: 'analisis', soloPara: 'equipo' },
  { key: 'analisis_hallazgos', label: 'Hallazgos', ejemplo: '• El anuncio «Testimonio 3» trae la mitad de las agendas\n• Los martes se agenda el doble', alcance: 'analisis', grupo: 'dashboard', fuente: 'analisis', soloPara: 'equipo' },
  { key: 'analisis_origen', label: 'Programado o a mano', ejemplo: 'Programado', alcance: 'analisis', grupo: 'dashboard', fuente: 'analisis', soloPara: 'equipo' },
  { key: 'analisis_link', label: 'Link al análisis', ejemplo: 'https://hola-mako.com/dashboard?hoja=marketing', alcance: 'analisis', grupo: 'dashboard', fuente: 'analisis', soloPara: 'equipo' },
  // ── La cuenta de MaKo de una PERSONA (15/10/2026): lo trae el evento de Seguridad en `datos`, armado por código.
  //    El link es de UN uso y vence en 30 minutos: SECRETO, sólo en el mail a esa persona.
  { key: 'link_restablecer', label: 'Link para restablecer', ejemplo: 'https://hola-mako.com/restablecer?t=…', alcance: 'restablecer', grupo: 'cuenta', fuente: 'cuenta', soloPara: 'usuario', secreto: true },
  // ── La LÍNEA de WhatsApp de un negocio que se cayó o volvió (15/10/2026, los Mensajes de MaKo a sus clientes mudados a
  //    automatizaciones de la plataforma): lo arma lib/linea-vigilancia.ts (`datosCaida`) con lo que se midió.
  { key: 'linea_numero', label: 'Qué línea', ejemplo: '+52 55 1234 5678', alcance: 'linea', grupo: 'linea', fuente: 'linea', soloPara: 'equipo' },
  { key: 'linea_titulo', label: 'Qué le pasó', ejemplo: 'Se desconectó tu WhatsApp', alcance: 'linea', grupo: 'linea', fuente: 'linea', soloPara: 'equipo' },
  { key: 'linea_motivo', label: 'Qué pasa y qué hacer', ejemplo: 'WhatsApp cerró la sesión del dispositivo vinculado el 3 de octubre: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR:', alcance: 'linea', grupo: 'linea', fuente: 'linea', soloPara: 'equipo' },
  { key: 'linea_link', label: 'Link para reconectarla', ejemplo: 'https://hola-mako.com/whatsapp', alcance: 'linea', grupo: 'linea', fuente: 'linea', soloPara: 'equipo' },
  // ── La reunión que TERMINÓ y quedó grabada (15/10/2026, el evento de la plataforma `reunion_grabada`): la pasa el
  //    webhook de Fathom. No es la «Próxima reunión»: ésa todavía no pasó.
  { key: 'grabacion_reunion', label: 'Qué reunión terminó', ejemplo: 'R1', alcance: 'grabacion', grupo: 'reuniones', rama: 'La que terminó', fuente: 'grabacion', soloPara: 'equipo' },
  { key: 'grabacion_duracion', label: 'Cuánto duró', ejemplo: '42 min', alcance: 'grabacion', grupo: 'reuniones', rama: 'La que terminó', fuente: 'grabacion', soloPara: 'equipo' },

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
  // Lo que contestó al AGENDAR (undécima tanda, 11/10/2026): la última fila de `lead_respuestas` (Calendly y
  // Cal.com), un renglón por respuesta con los MISMOS topes que el aviso de Cal.com (`renglonesDeRespuestas`,
  // lib/respuestas-agenda.ts). Era lo único del aviso «Nuevo agendado» que no se podía citar. Al equipo: el rótulo
  // va abreviado y lo que no entra dice «+N en el resumen», que es la ficha del CRM.
  { key: 'lead_respuestas_agenda', label: 'Lo que contestó al agendar', ejemplo: '• Hace cuánto que está en el rubro: 5 años\n• Tiene equipo: Sí', alcance: 'lead', grupo: 'formulario', fuente: 'respuestas', soloPara: 'equipo' },

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
  { key: 'hora', label: 'La hora', ejemplo: '9:00 a. m.', alcance: 'siempre', grupo: 'momento', fuente: 'momento' },

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

/** Las claves de los datos SECRETOS (`VariableAviso.secreto`). Salen del catálogo: un secreto nuevo se marca ahí. */
export const CLAVES_SECRETAS: ReadonlySet<string> = new Set(VARIABLES_AVISO.filter((v) => v.secreto).map((v) => v.key));

/**
 * LOS DATOS SIN LO SECRETO, para todo lo que se GUARDA (el contexto de una corrida, lib/flujo-corridas.ts). Sin
 * secretos devuelve el MISMO objeto. Un secreto que se guardó una vez ya no es de un solo uso: vive en la base.
 */
export function sinSecretos<C extends { datos?: Record<string, string> }>(ctx: C): C {
  if (!ctx.datos || !Object.keys(ctx.datos).some((k) => CLAVES_SECRETAS.has(k))) return ctx;
  return { ...ctx, datos: Object.fromEntries(Object.entries(ctx.datos).filter(([k]) => !CLAVES_SECRETAS.has(k))) };
}

/** ¿Este texto cita un dato secreto? (`{{link_restablecer}}`). Es lo que Publicar mira en cada tarjeta. */
export const citaSecreto = (texto: string): boolean => tokensDe(texto).some((t) => CLAVES_SECRETAS.has(t.key));

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
  return f.has('ficha') || f.has('zona') || f.has('producto') || f.has('curso') || f.has('proxima');
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

/**
 * Para qué mensaje se arma el selector. Sin `destino`, el equipo (los avisos de siempre). `conMensaje`: el
 * mensaje tiene el texto que arma el código del aviso (`{{mensaje_mako}}`, sólo un evento de MaKo). `conPago`:
 * el pago del aviso «Entró un pago». `conEscrito`: lo que el lead escribió (la charla). Es el MISMO contexto con
 * el que el motor resuelve y Publicar valida (`tokensFueraDe`).
 */
export type ContextoDatos = {
  conLead: boolean; conCuota?: boolean; conMensaje?: boolean; conPago?: boolean; conEscrito?: boolean; conAnalisis?: boolean; destino?: DestinoMensaje;
  /** La línea de WhatsApp de un negocio (los eventos de la plataforma `whatsapp_caido` y `whatsapp_volvio`). */
  conLinea?: boolean;
  /** La reunión que terminó y quedó grabada (el evento de la plataforma `reunion_grabada`). */
  conGrabacion?: boolean;
  /** El link de restablecer la contraseña (sólo el evento `contrasena_restablecer`, y sólo al mail a la persona). */
  conRestablecer?: boolean;
};

/** ¿Este dato vale para un mensaje a este destino? (las claves `oculta` se resuelven igual). */
export const valePara = (v: VariableAviso, destino: DestinoMensaje): boolean => !v.soloPara || v.soloPara === destino;

/** Las que ese mensaje puede resolver de verdad. Ofrecer el resto es prometer un dato
 *  que no existe — y lo que sale al WhatsApp del cliente es el `{{token}}` crudo. */
export function variablesPara(opts: ContextoDatos): VariableAviso[] {
  const destino = opts.destino ?? 'equipo';
  return VARIABLES_AVISO.filter((v) => !v.oculta && valePara(v, destino) && alcanzaPara(v.alcance, opts));
}

/**
 * ¿Ese mensaje trae lo que el dato necesita? UNA rama por alcance y en positivo: hasta el 11/10/2026 todo lo
 * que no era `lead` caía en `conCuota`, así que un alcance nuevo se ofrecía en cualquier cobranza sin que
 * nadie lo decidiera.
 */
function alcanzaPara(a: VariableAviso['alcance'], opts: ContextoDatos): boolean {
  if (a === 'siempre') return true;
  if (a === 'lead') return opts.conLead;
  if (a === 'cuota') return opts.conCuota === true;
  if (a === 'mensaje') return opts.conMensaje === true;
  if (a === 'pago') return opts.conPago === true;
  if (a === 'escrito') return opts.conEscrito === true;
  if (a === 'analisis') return opts.conAnalisis === true;
  if (a === 'restablecer') return opts.conRestablecer === true;
  if (a === 'linea') return opts.conLinea === true;
  if (a === 'grabacion') return opts.conGrabacion === true;
  return false;
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
 * Las SUB-RAMAS de un grupo (`VariableAviso.rama`, undécima tanda: «Próxima reunión» adentro de «Reuniones»), en
 * el orden en que aparecen; `rama: null` = los datos que cuelgan directo del grupo. Pura, para que el selector
 * (app/_components/SelectorDatos.tsx) dibuje la sub-rama sin decidir nada por su cuenta.
 */
export function ramasDelGrupo(items: readonly VariableAviso[]): Array<{ rama: string | null; items: VariableAviso[] }> {
  const out: Array<{ rama: string | null; items: VariableAviso[] }> = [];
  for (const v of items) {
    const rama = v.rama ?? null;
    const r = out.find((x) => x.rama === rama);
    if (r) r.items.push(v);
    else out.push({ rama, items: [v] });
  }
  return out;
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
      const pajar = norm(`${d.label} ${d.ejemplo} ${d.key} ${g.titulo} ${d.rama ?? ''}`);
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

// ── Los tokens de un texto: dónde están, cuáles no se pueden resolver y qué renglón se va ───────────────
// Undécima tanda (11/10/2026). Puras, para que el editor (punto 7: «los datos, al momento de EDITAR, también se
// deben marcar en azul y ser clickeables… y que se pueda cambiar allí mismo por otro dato»), Publicar
// (`problemasDeTokens`, lib/tokens-del-flujo.ts) y el motor pregunten lo MISMO y con el mismo molde
// (`RE_VARIABLE`), que es el que pinta la burbuja.

/** Un token de un texto: `[ini, fin)` en el texto tal cual, y su clave en minúsculas (sin las llaves). */
export type TokenEnTexto = { ini: number; fin: number; key: string };

/** Los tokens de un texto, en orden, con sus offsets (para pintarlos y para reemplazar uno con un clic). */
export function tokensDe(texto: string): TokenEnTexto[] {
  if (typeof texto !== 'string' || !texto.includes('{{')) return [];
  const out: TokenEnTexto[] = [];
  for (const m of texto.matchAll(RE_VARIABLE)) {
    const ini = m.index ?? 0;
    out.push({ ini, fin: ini + m[0].length, key: m[0].slice(2, -2).toLowerCase() });
  }
  return out;
}

/**
 * Pone `{{key}}` en `[ini, fin)` (el token que se tocó) y dice dónde queda el cursor: lo mismo que
 * `insertarEnCursor` (app/whatsapp/_shared/ComposerWhatsApp.tsx) con el token como texto. Los offsets fuera de
 * rango se recortan al texto, así un clic sobre un texto que cambió no rompe nada.
 */
export function reemplazarToken(texto: string, ini: number, fin: number, key: string): { valor: string; cursor: number } {
  const t = typeof texto === 'string' ? texto : '';
  const n = t.length;
  const a = Number.isFinite(ini) ? Math.max(0, Math.min(n, ini)) : n;
  const b = Number.isFinite(fin) ? Math.max(a, Math.min(n, fin)) : a;
  const token = `{{${key}}}`;
  return { valor: t.slice(0, a) + token + t.slice(b), cursor: a + token.length };
}

/**
 * Los tokens de este texto que ESTE mensaje no puede resolver (`{{clave}}`, sin repetir, en orden): los que no
 * son del catálogo y los que no valen para su destino o su alcance. Los `oculta` (nombres viejos) valen si valen
 * para el destino y el alcance: se resuelven igual. Es la pregunta de Publicar (`problemasDeTokens`) y la del
 * rojo del editor, con el MISMO contexto con el que el selector ofrece (`variablesPara`).
 */
export function tokensFueraDe(texto: string, ctx: ContextoDatos): string[] {
  const destino = ctx.destino ?? 'equipo';
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const t of tokensDe(texto)) {
    if (vistos.has(t.key)) continue;
    vistos.add(t.key);
    const d = POR_CLAVE.get(t.key);
    if (!d || !valePara(d, destino) || !alcanzaPara(d.alcance, ctx)) out.push(`{{${t.key}}}`);
  }
  return out;
}

/**
 * EL RENGLÓN OPCIONAL: un renglón que nombra un dato DEL CATÁLOGO sin valor para este lead se va ENTERO.
 * «📱 {{lead_telefono}}» de un lead sin teléfono no sale; «Para entrar: {{reunion_link}}» de una reunión sin link,
 * tampoco (medido el 11/10/2026: sin esta regla, 52 de 55 recordatorios del ws1 saldrían con el link crudo).
 *
 * ⚠️ LO DESCONOCIDO NO SE TOCA: un renglón con un token que no es del catálogo se queda entero y el token sale
 * CRUDO (crudo se nota; Publicar ya lo frena con `problemasDeTokens`). Borrarlo escondería el error.
 *
 * ⚠️ «SIN VALOR» = LA CLAVE NO ESTÁ EN `valores`. Una clave puesta en '' es un valor (vacío) que alguien decidió:
 * es lo que pone el motor en `nombre` o `empresa` de un lead que no los tiene (`valoresVariablesLead`,
 * lib/template-vars.ts), y borrar por eso «Hola {{nombre}}, te recuerdo tu reunión…» se comería el mensaje
 * entero. El resolvedor ya deja afuera lo que está en null (`valoresDelLead`) y lo que el emisor pasa vacío.
 *
 * Sólo texto: el HTML del email no se recorta (queda anotado en docs/diseno-undecima-tanda.md §10).
 */
export function sinRenglonesVacios(texto: string, valores: Record<string, string>): string {
  if (typeof texto !== 'string') return '';
  if (!texto.includes('{{')) return texto;
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(valores, k);
  return texto.split('\n').filter((renglon) => {
    let falta = false;
    for (const t of tokensDe(renglon)) {
      if (!POR_CLAVE.has(t.key)) return true;   // desconocido: el renglón se queda, con el token crudo
      if (!tiene(t.key)) falta = true;
    }
    return !falta;
  }).join('\n');
}
