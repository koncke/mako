// =============================================================================
// tab-onboarding-catalogo — QUÉ pasos tiene el onboarding de cada tab
// =============================================================================
//
// ⚠️ SIN `server-only`, Y ES EL MISMO CRITERIO QUE `onboarding-orden`.
//
// Vivía adentro de `tab-onboarding-state.ts`, que sí lo tiene — así que el
// catálogo no lo podía importar ningún test. Y este catálogo tiene DOS reglas
// que fallan en silencio y que ya se cometieron:
//
//   · El PREFIJO de las keys. `contexto`/`ensayo` pelados colisionan vía
//     `KEY_PASOS_COMPARTIDOS` entre tabs: terminar el ensayo de una marca el de
//     otra como hecho. Está documentado en tres entradas del catálogo porque ya
//     pasó dos veces.
//   · El ORDEN. La regla de la skill —lo aburrido al final, salvo lo que
//     bloquea— vive hoy en la prosa de cada comentario y en ningún control.
//
// Acá no hay nada de ningún workspace: son los pasos que ofrecemos. Lo que sí
// es del inquilino —qué pasos cerró— sigue en `tab-onboarding-state.ts`, con su
// `server-only` puesto.

/** Definición del onboarding de UNA tab: sus pasos, en orden. */
export type TabOnboardingDef = {
  key: string;          // 'setting' — la key del nav
  titulo: string;       // "Dejemos tu setting listo"
  /**
   * El nombre CORTO de la tab, para cuando hay que nombrarla dentro de una frase
   * ("Te falta configurar: Copy Generator · Video Generator · WhatsApp").
   *
   * ⚠️ EXISTE PORQUE RECORTARLE EL PREFIJO AL `titulo` NO ALCANZA. Se probó con un
   * regex que sacaba "Configuración del/de la/de" y el resultado, medido contra el
   * catálogo real, era una lista con dos nombres rotos en minúscula: «generador de
   * video» y «email». Un nombre de producto no se deriva de una frase — se declara.
   *
   * Ausente = se usa el `titulo` tal cual, que es feo pero nunca es incorrecto.
   */
  nombre?: string;
  /**
   * `opcional`: el paso se muestra y se puede hacer, pero NO bloquea la tab. El
   * método oficial de WhatsApp y el email son mejoras, no requisitos — obligar a
   * pasar por ellos dejaba a un cliente con su número ya vinculado sin poder
   * entrar a su propio inbox.
   */
  pasos: Array<{ key: string; label: string; opcional?: boolean }>;
  /**
   * Tabs que DEPENDEN de esta: entrar ahí sin haber terminado este onboarding
   * no tiene sentido, así que se las manda acá. Ej.: /whatsapp y /email no
   * necesitan su propio onboarding — su configuración (canal probado, voz,
   * secuencias) se hace entera en /setting. Una sola puerta de entrada en vez
   * de tres recorridos que piden lo mismo.
   */
  cubre?: string[];
  /**
   * La tab que hay que configurar ANTES que esta. Distinto de `cubre`, y la
   * diferencia importa: `cubre` es «esta tab no tiene recorrido propio, el mío la
   * cubre»; `requiere` es «los dos tienen recorrido, y el mío va segundo».
   *
   * El caso que lo trajo: el Video Generator filma un guion, y el guion se escribe
   * en el Copy Generator. Alguien que llega al Video Generator sin haber pasado por
   * el Copy no tiene NADA que filmar — la tab lo recibe con una lista vacía y ningún
   * cartel que explique de dónde salen los guiones. Decisión de Martín, textual:
   * «primero va el guion y luego el video… si no está hecho el primero, no debería
   * dejarte hacer el segundo».
   *
   * ⚠️ SE MIRA ANTES QUE EL PROPIO (ver `onboardingRequeridoPara`). Mirarlo después
   * sería no mirarlo nunca: la tab de atrás siempre tiene su propio onboarding
   * pendiente también, así que el propio ganaría siempre y el requisito no ataría nada.
   */
  requiere?: string;
  /** Href al que se manda (default `/${key}`). */
  href?: string;
};

/**
 * Catálogo de onboardings por tab. Agregar una tab = agregar una entrada acá
 * (mismo espíritu que lib/tab-activacion.ts y lib/capas.ts: el dato manda, no
 * un `if` desparramado).
 */
export const TAB_ONBOARDINGS: Record<string, TabOnboardingDef> = {
  // ── WhatsApp: conectar y probar los dos métodos ──
  // Vive en su tab porque es donde el cliente llega buscando WhatsApp. Los
  // mismos pasos aparecen dentro del Chatbot cuando elige "configurar todo":
  // no se repiten, se comparten (ver PASOS_COMPARTIDOS).
  whatsapp: {
    key: 'whatsapp',
    titulo: 'Configuración de WhatsApp',
    nombre: 'WhatsApp',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      // Los tres pasos del OFICIAL se fueron con la tarea #832: Meta cobra por mensaje y
      // el no oficial no tiene esa restricción, así que el producto deja de ofrecerlo.
      // Quien ya lo tenga conectado lo sigue viendo; nadie nuevo lo configura.
    ],
  },

  // ── Email: el canal de los que no contestan por WhatsApp ──
  email: {
    key: 'email',
    titulo: 'Configuración del email',
    nombre: 'Email',
    // Acá NO son opcionales: son los únicos pasos de la tab. Lo son dentro del
    // Chatbot, donde el email es una mejora sobre un canal que ya funciona.
    pasos: [
      { key: 'email_conectar', label: 'Tu email' },
      { key: 'email_prueba', label: 'Verificación del email' },
    ],
  },

  // ── Automations (ex Chatbot): la cabeza. Necesita al menos un canal vivo ──
  // ORDEN (regla en .claude/skills/tab-onboarding): lo aburrido al final,
  // EXCEPTO lo que bloquea. El WhatsApp de empresa sí bloquea: el paso de
  // contexto lee las conversaciones reales de ese número, así que sin él no hay
  // nada que leer.
  //
  // ⚠️ La KEY `setting` y las de los pasos NO cambian con el nombre (09/10/2026): están
  // escritas en `onboarding.tab.setting` y en el registro compartido de cada workspace.
  // Cambiarlas reabre el onboarding de todos los clientes. Lo que cambia es lo que se LEE.
  setting: {
    key: 'setting',
    titulo: 'Configuración de Automations',
    nombre: 'Automations',
    // ⚠️ UN SOLO PASO, Y ES EL QR. La tab dejó de ser un wizard: es el lienzo donde se
    // dibujan las secuencias, y lo único que hay que tener antes es la línea vinculada
    // (Martín, 05/10: «esa pestaña ya no requeriría un onboarding al menos que no tengas
    // vinculado WhatsApp todavía; lo único que tiene que salir es el QR»).
    //
    // Dónde fue a parar cada paso viejo, para que nadie lo busque:
    //  · «Verificación» — la pantalla del QR detecta sola cuando engancha.
    //  · «Tus audios» — el editor graba el audio DE CADA PASO (`PasoAudioControl`).
    //  · «Ensayo» — el simulador vive adentro de la tab.
    //  · «Tus secuencias» — Publicar y Activar están en el lienzo.
    //  · «WhatsApp oficial» ×3 — el oficial salió del producto (tarea #832).
    //  · «Tu email» ×2 — /email tiene su propia tab y su propio onboarding.
    //  · «Tu forma de escribir» — es el único que produce un dato sin otra casa (la guía
    //    de voz). Decisión de Martín (05/10): «que ese tutorial se habilite la primera vez
    //    que se intente poner una tarjeta de chat y activar la opción de "IA"». Vuelve a
    //    la lista OPCIONAL —no decide el `status`, así que la tab no vuelve a pedir
    //    onboarding al entrar— y la abre el lienzo con `soloPaso` al tildar «Lo adapta
    //    MaKo» (app/automations/SecuenciaPerfil.tsx). Tiene que estar ACÁ igual: sin la key
    //    en la lista, `marcarPasoTab` la rechaza y el paso no se puede cerrar nunca.
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'contexto', label: 'Tu forma de escribir', opcional: true },
    ],
    href: '/automations',
  },

  // ── Instagram: la tab se RETIRÓ el 06/10/2026 (decisión de Martín) ──
  // No hay def: una tab que no existe no tiene onboarding que terminar, y una def
  // viva la haría aparecer en «te falta configurar» (tabsPorConfigurar itera este
  // catálogo). Lo que queda en app_settings (`onboarding.tab.instagram` del ws11 y
  // del ws13) no lo lee nadie. Sus keys llevaban prefijo `ig_` por la colisión que
  // documenta tests/onboarding-keys-colision.test.ts; se fueron con la tab.

  // ── Carousels (Content Machine): se configura usándose ──
  // El ensayo se marca solo desde la primera pieza generada (patrón landing-an: la
  // tab se configura usándola). Hasta el 06/10/2026 había un paso opcional
  // `carousels_instagram` («Tu cuenta de Instagram»): salió con la tab Instagram,
  // porque ya no hay dónde conectarla ni a dónde mandar la pieza.
  // ⚠️ Keys con prefijo `carousels_` a propósito: 'contexto'/'ensayo' a secas
  // COLISIONAN vía KEY_PASOS_COMPARTIDOS con el Chatbot (gotcha conocido) — un paso
  // que NO es la misma configuración no comparte key.
  carousels: {
    key: 'carousels',
    titulo: 'Configuración de Carousels',
    nombre: 'Carousels',
    pasos: [
      { key: 'carousels_contexto', label: 'Contexto del negocio' },
      { key: 'carousels_ensayo', label: 'Tu primer carrusel' },
    ],
  },

  // ── Reels: el writer de guiones se configura usándose ──
  // Las keys van namespaced (`reels_*`) a propósito: las peladas `contexto`/`ensayo`
  // COLISIONAN con el Chatbot vía el registro compartido (gotcha conocido) y no son
  // la misma configuración que esta tab. Hasta el 06/10/2026 había un tercer paso
  // opcional, `conectar` («Tu cuenta de Instagram», compartido con la tab Instagram):
  // salió con ella.
  // `reels_contexto` se deriva del perfil del negocio (estado vivo, lo marca la
  // page al detectarlo); `reels_ensayo` lo marca la primera pieza generada.
  reels: {
    key: 'reels',
    titulo: 'Configuración de Reels',
    nombre: 'Reels',
    pasos: [
      { key: 'reels_contexto', label: 'Contexto del negocio' },
      { key: 'reels_ensayo', label: 'Tu primer guion' },
    ],
  },

  // ── Copy Generator: la FÁBRICA DE CREATIVOS, que antes vivía en el onboarding global ──
  //
  // Estos cinco pasos estaban en `lib/capas.ts` → capa 'completo', o sea que se le
  // pedían a todo cliente nuevo antes de dejarlo entrar a nada. Salieron de ahí (ver el
  // comentario largo en ese archivo) y aterrizan acá, que es la tab donde se USAN: la
  // matriz avatar × razón es literalmente la entrada del Copy Generator.
  //
  // ORDEN, y es el encadenamiento de la fábrica, no una preferencia de lectura:
  //   entregable → qué se ofrece a cambio del contacto (el lead magnet).
  //   avatares   → A QUIÉN se le habla (los 3 subnichos).
  //   persona    → la CARA de la marca (fotos + descripción).
  //   personalidad → CÓMO habla (el quiz de voz del creador).
  //   angulos    → la MATRIZ, que es el producto de los cuatro anteriores.
  //
  // Por eso `angulos` es el ensayo de esta tab y va último: es la única pantalla donde
  // el cliente VE salir algo, y sale de lo que acaba de contestar. Ninguno es opcional
  // —cada uno alimenta al siguiente, y la matriz sin avatares es una grilla vacía.
  //
  // ⚠️ Keys con prefijo `cg_` a propósito, igual que `vg_` y `carousels_`: las peladas
  // colisionan vía KEY_PASOS_COMPARTIDOS (gotcha documentado tres veces en este archivo).
  //
  // ⚠️ `cg_persona` y `vg_cara` se PARECEN y no son el mismo paso: acá se define la cara
  // de la marca (quién aparece y cómo se lo describe, que es material de copy); allá se
  // suben las fotos con las que se arma el avatar del video. No comparten key a
  // propósito — si mañana se decide fundirlos, es una decisión, no un renombre.
  'ads-writer': {
    key: 'ads-writer',
    titulo: 'Configuración del Copy Generator',
    nombre: 'Copy Generator',
    pasos: [
      { key: 'cg_entregable', label: 'Tu lead magnet' },
      { key: 'cg_avatares', label: 'Tus avatares' },
      { key: 'cg_persona', label: 'La cara de tu marca' },
      { key: 'cg_personalidad', label: 'Tu personalidad' },
      { key: 'cg_angulos', label: 'Tu matriz de anuncios' },
    ],
  },

  // ── Video Generator: la cara, la voz, el navegador y el primer anuncio ──
  //
  // ORDEN (regla de la skill): lo aburrido AL FINAL, excepto lo que bloquea. Acá
  // lo aburrido es el navegador con Flow —instalar una extensión y emparejarla—
  // y bloquea de verdad: sin puente no se genera NADA, ni siquiera las imágenes
  // que son gratis. Por eso va anteúltimo, pegado a lo único que bloquea (el
  // ensayo) y después de los tres pasos que sí se pueden hacer sin él.
  //
  // Los tres primeros son los que deciden si el anuncio se parece a la persona:
  // su cara (sin foto no hay identidad y el avatar sale siendo otro), su acento
  // y sus muletillas. Ninguno se REDACTA: la cara se sube, y el acento y las
  // muletillas se eligen de una lista — con el acento ya pre-marcado por la
  // inferencia de la zona horaria, que es lo que se venía usando en silencio.
  //
  // ⚠️ Keys con prefijo `vg_` a propósito: `contexto`/`ensayo` pelados COLISIONAN
  // vía KEY_PASOS_COMPARTIDOS con el Chatbot (gotcha ya documentado arriba) — un
  // paso que no es la misma configuración no comparte key.
  'video-generator': {
    key: 'video-generator',
    titulo: 'Configuración del generador de video',
    nombre: 'Video Generator',
    // PRIMERO EL GUION, DESPUÉS EL VIDEO. Sin el Copy Generator configurado no hay
    // guiones que filmar, y esta tab abre con una lista vacía que no explica nada.
    requiere: 'ads-writer',
    pasos: [
      // ⚠️ EL ORDEN DE ESTA LISTA ES UNA GUARDA, no una preferencia de lectura.
      //
      // `marcarPasoTab` no deja marcar un paso si falta uno ANTERIOR de acá, así
      // que este array y el `PASOS` de la pantalla tienen que decir lo mismo. El
      // 02/09/2026 se movió el puente al primer lugar en la pantalla y no acá: el
      // paso 1 quedó pidiendo «antes falta completar Tu cara», que es el paso 2.
      // Con un cliente delante, y sin forma de avanzar.
      //
      // El puente va primero porque hay que bajar e instalar la extensión: es lo
      // único con espera propia, y ponerlo al arranque deja que se instale
      // mientras la persona contesta lo demás.
      { key: 'vg_puente', label: 'Instala la extensión de MaKo' },
      { key: 'vg_cara', label: 'Tus fotos' },
      { key: 'vg_acento', label: 'Cómo hablas' },
      { key: 'vg_muletillas', label: 'Tus muletillas' },
      // ⚠️ OPCIONAL, y la decisión no es de comodidad. `marcarPasoTab` recalcula
      // el `status` contra el catálogo ACTUAL: agregar un paso NO opcional
      // devuelve a «pendiente» a todos los que ya tenían la tab cerrada, y les
      // reabre el wizard encima de un anuncio a medio hacer.
      //
      // Y además clonar la voz no puede ser un requisito: sin clon el anuncio se
      // monta igual, con la voz que genera Flow. Lo que se pierde es que suene a
      // la persona, no que funcione.
      { key: 'vg_voz', label: 'Tu voz', opcional: true },
      { key: 'vg_ensayo', label: 'Tu primer escenario' },
    ],
  },

  // ── Landing Analyst: la única tab que se configura USÁNDOLA ──
  // No hay credencial que pedir ni contexto que redactar: el funnel y el perfil
  // ya están cargados, y el "ensayo" ES el primer análisis. Por eso el paso que
  // bloquea es analizar una página, y se marca solo desde analizarLanding().
  // El seguimiento es opcional a propósito: sin él MaKo diagnostica el copy
  // igual — lo que suma es poder cruzarlo con lo que hace la gente.
  'landing-an': {
    key: 'landing-an',
    titulo: 'Configuración del Landing Analyst',
    nombre: 'Landing Analyst',
    pasos: [
      { key: 'analizar', label: 'Tu primera página analizada' },
      { key: 'seguimiento', label: 'Seguimiento puesto en la landing', opcional: true },
    ],
    // La tab se retiró el 11/10/2026: el diagnóstico vive en Landing Generator. La key y los
    // pasos NO cambian (están escritos en la base: cambiarlos reabre el onboarding).
    href: '/landing-generator/analizar',
  },

  // ── Landing Generator: se prende escribiendo la primera página ──
  'landing-writer': {
    key: 'landing-writer',
    titulo: 'Configuración del Landing Generator',
    nombre: 'Landing Generator',
    pasos: [
      { key: 'generar', label: 'Tu primera versión escrita' },
      { key: 'guardar', label: 'Una versión guardada', opcional: true },
      // El editor copiado de Gamma (11/10/2026). OPCIONAL a propósito: un paso obligatorio nuevo
      // le reabriría la tab a todo el que ya la tenía cerrada. Lo marca publicar
      // (lib/editor-landing/publicar.ts); `generar` lo marca la IA (ia.ts) y `guardar` el primer
      // guardado de una landing (server.ts). Prefijo `lg_`: el registro de pasos es COMPARTIDO entre
      // tabs y «publicar» suelto chocaría con el de otra.
      { key: 'lg_publicar', label: 'Tu primera landing publicada', opcional: true },
    ],
    href: '/landing-generator',
  },

  // ── Offer: se prende USÁNDOLA (patrón landing-an), y el chat ES el onboarding ──
  // Desde el 11/10/2026: Offer Analyst + Offer Generator en una sola tab (/offer). No hay
  // wizard delante: el primer paso se cierra contándole a MaKo qué se vende, y el segundo
  // cuando la oferta queda armada. Los marca el MOTOR (app/api/offer/route.ts) con
  // marcarPasoTab('offer', 'of_contar' | 'of_conclusion'), en ese orden — marcarPasoTab
  // no deja cerrar el segundo antes que el primero.
  //
  // ⚠️ La key es la del nav ('offer', la de siempre: contrato con capas). Las de los pasos
  // llevan el prefijo of_ a propósito: «contar» o «conclusion» a secas podrían colisionar
  // por KEY_PASOS_COMPARTIDOS con otra tab y darle por hecho un paso que nadie vio
  // (tests/onboarding-keys-colision.test.ts). Y como cualquier tab de este catálogo, la
  // pendiente aparece en la lista de «falta configurar» del cierre del onboarding global y
  // en el resumen que lee MaKo: con href /offer, que es justo donde se configura.
  offer: {
    key: 'offer',
    titulo: 'Configuración de Offer',
    nombre: 'Offer',
    pasos: [
      { key: 'of_contar', label: 'Contar qué vendes' },
      { key: 'of_conclusion', label: 'Ver la oferta armada' },
    ],
    href: '/offer',
  },

  // ── Clientes (Customer Success): la cartera y la entrega de cada servicio ──
  //
  // ⚠️ LOS TRES PASOS SE DERIVAN DE LOS DATOS, como los del Curso (#109, 06/10/2026). El ws1
  // llegó a esta tab con sus productos, sus nueve etapas y catorce clientes: un paso que sólo se
  // cerrara «haciéndolo acá» le taparía a Mauricio su propia cartera. La página los marca sola al
  // dibujarse (app/customer-success/onboarding-clientes-sync.ts) y la regla de qué dato cierra
  // cada uno vive en app/customer-success/onboarding-clientes.ts, con test.
  //
  // Y NO TAPA LA TAB: es una lista arriba de la cartera mientras falte algo, no un wizard.
  //
  //   cs_servicio → hay al menos un producto con etapas de entrega (el kanban se puede dibujar).
  //                 Va primero porque es configuración del negocio y existe antes del primer
  //                 cliente; sin él la tab es una lista plana.
  //   cs_clientes → hay al menos un cliente ganado (del CRM, o cargado acá).
  //   cs_ficha    → el ENSAYO: alguien abrió la ficha de un cliente, o ya movió a alguien de etapa
  //                 (una fila en `cliente_entrega`, que es usar la tab más a fondo todavía).
  //
  // ⚠️ Prefijo `cs_` por la colisión de KEY_PASOS_COMPARTIDOS (ver arriba). Y el ORDEN es una
  // guarda (`marcarPasoTab` no marca un paso con uno obligatorio anterior pendiente): tiene que
  // coincidir con PASOS_CLIENTES (el test lo compara).
  'customer-success': {
    key: 'customer-success',
    titulo: 'Configuración de Clientes',
    nombre: 'Clientes',
    pasos: [
      { key: 'cs_servicio', label: 'Tu servicio' },
      { key: 'cs_clientes', label: 'Tus clientes' },
      { key: 'cs_ficha', label: 'Ficha de un cliente' },
    ],
    href: '/customer-success',
  },

  // ── Curso (Customer Success): el programa que ven los clientes en su portal ──
  //
  // ⚠️ LOS CUATRO PASOS SE DERIVAN DE LOS DATOS, no de un recorrido. El ws1 ya tenía 107
  // clases cargadas por script cuando la tab estrenó su onboarding: un paso que exigiera
  // «hacerlo acá» le habría pedido a Mauricio cargar lo que ya está. La página los marca
  // sola al dibujarse (app/customer-success/curso/onboarding-sync.ts) y la regla de qué dato
  // cierra cada paso vive en app/customer-success/curso/onboarding-curso.ts, con test.
  //
  // Y NO TAPA LA TAB: no es un wizard, el curso se arma usándolo. Desde el 08/10/2026 la tab no
  // dibuja la lista de estos pasos sino un RECORRIDO (app/_ui/Recorrido.tsx, `cs-curso`): «Elimina
  // el recuadro de "Configura tu curso"... haz el típico tutorial de app» (Martín, item 3). Los
  // pasos siguen anotándose igual: los lee MaKo y la pantalla final del onboarding.
  //
  //   curso_programa → hay al menos una clase EN EL WORKSPACE. ⚠️ Decisión, no descuido: ni una
  //                    por etapa ni una por producto, porque las dos traban la tab para siempre.
  //                    Las etapas default terminan en «Entregado», donde no va ninguna clase, y
  //                    el ws1 tiene dos productos con el curso en uno solo. Lo que falta por
  //                    etapa lo dice la tab («Sin clases.», «No avanza sola»), y la LISTA cuenta
  //                    el producto elegido (`checklistCurso`). El porqué, en `pasosDeLosDatos`.
  //   curso_videos   → alguna clase tiene video. Opcional: un curso de puros formularios existe.
  //   curso_vista    → el ENSAYO: el equipo abrió la vista del alumno (una vista previa SIN
  //                    lead, que no crea accesos de clientes reales), o un cliente ya entró.
  //   curso_invitar  → ya se invitó a alguien. AL FINAL Y OPCIONAL: manda un email real por
  //                    Resend, así que lo dispara una persona («Invitar alumnos» del editor, la
  //                    ficha o la tarjeta del kanban), nunca el onboarding.
  //
  // ⚠️ Prefijo `curso_` por la colisión de KEY_PASOS_COMPARTIDOS (ver arriba). Y el ORDEN es
  // una guarda (`marcarPasoTab` no marca un paso con uno obligatorio anterior pendiente), así
  // que tiene que coincidir con PASOS_CURSO (el test lo compara).
  'cs-curso': {
    key: 'cs-curso',
    titulo: 'Configuración del curso',
    nombre: 'Curso',
    pasos: [
      { key: 'curso_programa', label: 'Tu programa' },
      { key: 'curso_videos', label: 'Tus videos', opcional: true },
      { key: 'curso_vista', label: 'Vista del alumno' },
      { key: 'curso_invitar', label: 'Tu primer alumno', opcional: true },
    ],
    href: '/customer-success/curso',
  },

  // ── Comunidad (Customer Success): el feed tipo Skool de cada producto (07/10/2026) ──
  //
  // ⚠️ LOS PASOS SE DERIVAN DE LOS DATOS, como los del Curso: la página los marca sola al dibujarse
  // (app/customer-success/comunidad/onboarding-sync.ts) y la regla de qué dato cierra cada uno vive en
  // app/customer-success/comunidad/onboarding-comunidad.ts, con test. Y NO TAPA LA TAB: es una línea
  // arriba del feed mientras falte el primer post.
  //
  //   comunidad_categorias → hay alguna categoría. Opcional (Skool las ofrece, no las exige).
  //   comunidad_post       → el ENSAYO: el primer post. Es el único obligatorio.
  //   comunidad_alumnos    → un alumno ya participó. Opcional y al final: depende de otros.
  //
  // ⚠️ Prefijo `comunidad_` por la colisión de KEY_PASOS_COMPARTIDOS (ver arriba). Y el ORDEN es una
  // guarda (`marcarPasoTab`), así que coincide con PASOS_COMUNIDAD (el test lo compara).
  'cs-comunidad': {
    key: 'cs-comunidad',
    titulo: 'Configuración de la comunidad',
    nombre: 'Comunidad',
    pasos: [
      { key: 'comunidad_categorias', label: 'Tus categorías', opcional: true },
      { key: 'comunidad_post', label: 'Tu primer post' },
      { key: 'comunidad_alumnos', label: 'Un alumno participa', opcional: true },
    ],
    href: '/customer-success/comunidad',
  },

  // ── Stories: el writer de secuencias de stories ──
  // Hasta el 06/10/2026 el primer paso era `conectar` («Tu cuenta de Instagram»,
  // opcional y compartido con la tab Instagram): salió con ella, porque ya no hay
  // dónde conectar la cuenta ni a dónde mandar los frames.
  // Los dos pasos van namespaced (stories_*) adrede: unos `contexto` / `ensayo`
  // pelados colisionarían vía el registro compartido con el Chatbot, y terminar el
  // ensayo de Stories marcaría «Ensayo de conversación» del Chatbot como hecho (el
  // gotcha ya documentado de KEY_PASOS_COMPARTIDOS).
  stories: {
    key: 'stories',
    titulo: 'Configuración de Stories',
    nombre: 'Stories',
    pasos: [
      { key: 'stories_contexto', label: 'Contexto del negocio' },
      { key: 'stories_ensayo', label: 'Tu primera secuencia' },
    ],
  },
};
