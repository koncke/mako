export const meta = {
  name: 'crm-ficha-bloques-tanda-b1',
  description: 'Tanda B1 del CRM: motor y armador de la ficha por bloques, escritura de Pagos por campo, Nuevo CRM, captura de datos y plantillas del CRM automático',
  phases: [
    { title: 'Implementar', detail: '5 frentes en paralelo, cada uno en su worktree; el motor sigue con el armador' },
    { title: 'Revisar', detail: 'lo que no se ve: config y avisos, plata, ingestas y el motor de Automations' },
  ],
}

const REGLAS = (n) => `REGLAS (obligatorias):
- Trabajás SOLO en el worktree C:/Users/marti/wtc-b${n} (rama crm-bloques-b${n}, sale de crm-bloques = origin/main de MaKo + la tanda A del CRM + el catálogo). Usá rutas absolutas o 'git -C C:/Users/marti/wtc-b${n}'. No toques el clon C:/Users/marti/OneDrive/..., ni C:/Users/marti/wtcrm5, ni otros worktrees.
- Editá SOLO los archivos de tu alcance (abajo). Si hace falta algo de afuera, NO lo toques: anotalo en «pendientes» con el archivo y la línea exacta.
- El diseño que manda es docs/diseno-ficha-bloques.md: leelo ENTERO antes de empezar, con sus decisiones de la §1, que ya están TOMADAS. Si el código contradice el documento, gana lo medido: decilo en hallazgos.
- AGENTS.md del repo manda (lo tenés en contexto). En particular: el texto que se dibuja es corto, en español neutro con tuteo (nada de voseo: ni «probá» ni «tocá»), los íconos salen de app/_ui/iconos-menu.tsx, borrar es el tacho rojo de la casa, los links van con app/_ui/Link (nada de next/link), y conectar una integración NUNCA saca de la tab.
- Toda capacidad nueva va a la API de MaKo (lib/api-mako/areas/*.def.ts y *.run.ts): lecturas y acciones, con confirmación 'chat' en las que escriben, y su fila en lib/api-mako/rest.ts si sale por http. Después regenerá con 'node --import tsx scripts/generar-api-doc.mjs' (docs/api-mako.md y tests/api-mako-http.snapshot.txt) y 'node --import tsx scripts/generar-plugin.mjs'. Otro frente puede estar tocando el mismo .def.ts: agregá tus ops en un bloque propio y contiguo, sin reordenar lo que ya está.
- Server actions: el corte de sesión (haySesion; lo exige tests/acciones-sin-sesion.test.ts), el rol cuando escribe config (admin) y el workspace del lead, nunca getWorkspaceActual pelado (sin sesión cae al ws1, que es un cliente real). Lo que escribe en un lead deja su línea en el historial (lead_audit / logLeadEvent) con el actor.
- Migraciones: sólo si no hay otra forma. Nombralas 'supabase/migrations/XXXX_<nombre>.sql' (el número lo pone quien integra) y con la cabecera que pide AGENTS.md: qué hace y en qué orden se despliega.
- Tests: todo guard nuevo se prueba ROMPIÉNDOLO, y el resultado va en el comentario del test con números («verificado rompiéndolo: …, 1 fallo»). Preferí funciones PURAS con tests que las EJECUTEN antes que regex sobre el fuente. Los tests que leen el fuente normalizan \\r\\n y sacan los comentarios antes de buscar (mirá otros tests). Corré sólo los tests que leen tus archivos: 'cd C:/Users/marti/wtc-b${n} && npx tsx --test --test-concurrency=1 <archivos>' (con grep -l del nombre del archivo en tests/ los encontrás), más los guards que barren el repo (grep -lE "ls-files" tests/*.ts), después de 'git add -N' de los archivos nuevos. NO corras tsc, ni npm test entero, ni builds, ni servidores: la máquina tiene ~3 GB libres y se cae.
- Si un test existente fija el comportamiento viejo que se pidió cambiar, cambialo A PROPÓSITO y decilo en el comentario.
- Para editar con scripts usá el Write tool: el Bash se come las barras invertidas y ejecuta las comillas invertidas. Respetá el CRLF: detectalo y conservalo.
- Commiteá en tu worktree por RUTA EXPLÍCITA ('git commit <rutas> -F <archivo-de-mensaje>'; 'git add -N' para los nuevos), nunca 'git add -A' ni un commit pelado. El mensaje va en español, con qué cambió y por qué, y al final estas dos líneas PEGADAS, sin línea en blanco entre ellas:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Cuenta: claude2
- Commiteá de a pasos (un commit por pieza que ande), así un corte de la app no se lleva todo.
- No pushees. No escribas en docs/hallazgos-*.md ni en la bitácora: devolvé los hallazgos en tu salida, y los cosecha el chat del CRM.
- No consultes ni escribas la base de datos.`

const SALIDA = {
  type: 'object',
  properties: {
    hecho: { type: 'string', description: 'qué quedó, en 5-20 líneas' },
    contrato: { type: 'string', description: 'SOLO el motor y el armador: los nombres EXACTOS que van a usar los frentes de la tanda B2 (archivos, tipos, funciones y la forma de un registro de bloque), en 10-40 líneas' },
    commits: { type: 'array', items: { type: 'object', properties: { sha: { type: 'string' }, msg: { type: 'string' } }, required: ['sha', 'msg'] } },
    archivos: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'object', properties: { archivo: { type: 'string' }, resultado: { type: 'string' }, roturas: { type: 'string' } }, required: ['archivo', 'resultado'] } },
    apiMako: { type: 'array', items: { type: 'string' }, description: 'ops nuevas o cambiadas' },
    migraciones: { type: 'array', items: { type: 'string' } },
    pendientes: { type: 'array', items: { type: 'string' } },
    hallazgos: { type: 'array', items: { type: 'string' }, description: 'síntoma → causa → dónde vive → regla; sobre todo cuando el diagnóstico obvio era el equivocado' },
    riesgos: { type: 'array', items: { type: 'string' } },
  },
  required: ['hecho', 'commits', 'archivos', 'tests', 'pendientes', 'hallazgos', 'riesgos'],
}

const PEDIDO = `Pedido de Martín (el dueño de MaKo), 14/10/2026 03:06, textual en app/admin/dev/crm/bitacora.ts (el hito 'prompt' de esa hora): «Que Pagos sea personalizable... edita todo en la misma tab y depreca "Editar deal →" en todos lados... Todas las personalizables, no los hagas con un modal diferente... Que replique la edición que tenemos en "Dashboard" y "Landing Generator", que sea un constructor por bloques... con templates... que pueda elegir que bloques poner, que diseño, tamaño... y que ahí mismo se configure qué datos sin marcar notifica». Y después: «piensa en todos los bloques que un usuario, con los diferentes funnels que tenemos... podría llegar a querer ver», «también los funnels orgánico, de Instagram, LinkedIn, DM Funnel, YouTube, lead magnet», y al ver el catálogo: «Si, avanza con todo y pushea». El diseño completo es docs/diseno-ficha-bloques.md.`

const MOTOR = `${PEDIDO}

TU FRENTE: el MOTOR de la ficha por bloques (sólo lib y server, nada de pantalla todavía; la pantalla la hace la segunda etapa de este mismo frente, en este mismo worktree, con lo que dejes). Es la base que van a usar otros cinco frentes en la tanda B2, así que los NOMBRES que elijas son un contrato: elegilos bien y devolvelos en «contrato».

QUÉ HACER:
1. lib/ficha/catalogo.ts (puro, sin server-only): el catálogo ENTERO de la §3 del documento (Resumen, Reuniones, Tracking, Pagos y CS, con los bloques compartidos): id (el del documento, tal cual), tab principal y tabs donde también se puede poner, título corto, tamaños permitidos (¼ ⅓ ½ completo = 3 4 6 12 columnas de 12), tamaño y diseño por defecto, diseños (id + nombre corto), los StepId que completa («Avisa si falta», contra lib/stage-requirements.ts), si se puede quitar (contacto no), y un ícono del set. Tipos: TabFicha, BloqueId, BloqueDef. Con un test que verifique contra el documento que no falta ni sobra ningún id (parseá las tablas del .md) y que cada StepId exista.
2. lib/ficha/plantillas.ts (puro): las plantillas de la §4 (respaldo, llamada con R1 y R2, una llamada, evento, formulario de Meta, landing con opt-in, te escriben, prospección, carrito, y la fija de CS), cada una con su lista por tab y los avisos que nacen apagados; y elegirPlantilla(funnel) con la regla de la §4 (cuenta de etapas de reunión con tieneEtapaDeReunion/etapas kind reunion de lib/etapa-reunion.ts, evento con fechaFijaDelEvento(canalEfectivo(...)), entrada con tipoDeFunnel y el canal 'carrito'; NUNCA funnels.canal pelado, que estaba en NULL en producción). Test que la EJECUTE con funnels de cada tipo, incluidos los de ws1, ws11, ws13, ws15 y ws17 como los describe el documento.
3. lib/ficha/config.ts (puro): la config de la ficha POR FUNNEL (decisión 1), guardada en funnels.data.ficha, con SÓLO lo que alguien cambió: por tab, la lista de bloques puestos {id, ancho, diseño, ícono?} (si nadie tocó esa tab, vale la de la plantilla, y así un bloque nuevo del catálogo les llega a todos); los avisos prendidos/apagados a mano; y el estilo de toda la ficha: el TemaHoja del Dashboard (lib/graficos-temas.ts: plantilla, acento, tipografía, con sanearTema; no inventes otro tema) más una densidad de tarjetas (compacta, normal o amplia) que es el «tamaño de las cards» que pidió Martín el 13/10. sanearFicha(raw) tolerante (ids que no existen se tiran, tamaños fuera de los permitidos caen al default). fichaEfectiva(plantilla, guardada, respaldoNegocio) devuelve, por tab, la lista final, los avisos apagados y el tema. EL RESPALDO DEL NEGOCIO: lo que el negocio ya eligió en crm.resumen.campos (lib/resumen-ficha.ts: web, instagram, youtube, linkedin, direccion, sexo, ingreso, cohorte, form_meta, form_landing) se respeta en las tabs que nadie tocó en ese funnel (por ejemplo, instagram apagado → redes-y-web sin Instagram; form_meta apagado → lo-que-contesto sin esa fuente; dirección apagada → sin el bloque direccion), y crm.datos_aviso.apagados (lib/datos-aviso-config.ts) se suma a los apagados de la plantilla. Los NO_IGNORABLES de lib/datos-aviso.ts (las asistencias) NUNCA se apagan. Sacar un bloque a mano NO apaga su aviso (regla de la §4). Tests que lo ejecuten.
4. Servidor: lib/ficha/config-server.ts (server-only) para leer la ficha efectiva de un funnel y guardar cambios (merge sobre funnels.data, sin pisar el resto de data, y sin pisar el cambio de otro admin: leé lo de hoy y aplicá el parche). Server actions en app/crm/ficha-actions.ts: leer (cualquier rol del workspace) y guardar (sólo admin, con haySesion y el workspace del funnel). El guardado deja historial del funnel si existe algo así (si no, decilo en pendientes).
5. LOS AVISOS POR FUNNEL EN TODOS LADOS. Hoy los apagados son del negocio y se leen en lib/datos-aviso-config.ts (apagadosDelNegocio, estadoDatosDeLead) y en lib/queries.ts:~2363 (getPendientesDeMarcar, que alimenta el worklist, el badge de «A revisar» y los avisos de MaKo), más app/crm/datos-sin-marcar-actions.ts:~108. Pasalos a POR FUNNEL del lead, con una sola lectura de los funnels del workspace por llamada (nada de una consulta por lead): un lead cuenta y avisa según la ficha efectiva de SU funnel. Mantené apagadosDelNegocio como respaldo. «N sin marcar» de la cabecera, «A revisar» y el worklist tienen que dar el MISMO número para el mismo lead: un test que lo fije.
6. EL ARREGLO DE LOS DOS IGNORADOS (docs/hallazgos-crm.md, la entrada de las dos columnas, ~línea 63): el panel de «A revisar» ignora con leads.datos_ignorados (por dato, mig 0270) y la op ignorar_datos_sin_marcar de la API escribe leads.pendientes_ignorados (el lead entero, mig 0109), así que lo que ignora MaKo no aparece en «Ver más» y no se puede volver a mostrar desde el panel. Hacé que la API ignore igual que el panel (los datos ignorables del lead en datos_ignorados, con la misma función que usa app/crm/datos-sin-marcar-actions.ts) y que reactivar_datos_sin_marcar haga lo inverso; los leads que ya tienen pendientes_ignorados siguen contando como ignorados (no los «despiertes»), y decí en hallazgos qué hacer con esa columna.
7. API de MaKo: ver_ficha_funnel (lectura: plantilla elegida y por qué, bloques por tab, avisos y tema) y cambiar_ficha_funnel (acción con confirmación chat: poner/quitar/mover/redimensionar un bloque, cambiar diseño, prender/apagar un aviso, cambiar el tema, volver a la plantilla), en lib/api-mako/areas/crm.def.ts y crm.run.ts, en un bloque propio. Y los cambios de las ops de ignorar del punto 6.
ALCANCE: lib/ficha/** (nuevo), app/crm/ficha-actions.ts (nuevo), lib/datos-aviso-config.ts, lib/datos-aviso.ts sólo si hace falta, lib/queries.ts (sólo la parte de los apagados de getPendientesDeMarcar), app/crm/datos-sin-marcar-actions.ts, app/api/datos-sin-marcar-count/route.ts sólo si cambia la firma, lib/api-mako/areas/crm.def.ts, lib/api-mako/areas/crm.run.ts, lib/api-mako/areas/crm.helpers.ts, lib/api-mako/rest.ts, docs/api-mako.md, tests/api-mako-http.snapshot.txt, plugin/, y tests nuevos o los que lean esos archivos. NO toques app/crm/LeadSheet.tsx, app/crm/[id]/** ni app/crm/lead-view/** (eso es la segunda etapa).`

const ARMADOR = (motor) => `${PEDIDO}

TU FRENTE, SEGUNDA ETAPA: la PANTALLA de la ficha por bloques, sobre el motor que ya quedó commiteado en este mismo worktree (C:/Users/marti/wtc-b1). Lo que reportó la primera etapa:
${JSON.stringify(motor)}

QUÉ HACER:
1. UN SOLO ARMADOR PARA LAS DOS PUERTAS. Hoy app/crm/LeadSheet.tsx (el pop-up del tablero, que recibe LeadFullData de getLeadFullAction, app/crm/actions.ts:~271) y app/crm/[id]/page.tsx (la ruta, que arma todo a mano y le pasa las tabs a LeadDetailBody) repiten el armado y ya divergieron: «N sin marcar» se calcula distinto en cada una (actions.ts:~318 contra page.tsx:~168). Hacé que la ruta use los MISMOS datos (llamando a getLeadFullAction o a una función de servidor extraída de ahí) y que las dos monten el MISMO componente de tabs y bloques. Cabecera, MaKo Analyst e Historial quedan como están (§3, «Lo que no se personaliza»).
2. app/crm/lead-view/ficha/Armador.tsx: dibuja una tab como una grilla de 12 columnas (el COLS del Dashboard, lib/graficos-catalogo.ts), con el ancho de cada bloque y el alto que da el contenido (sin alto fijo: §5, descartes). Un bloque que no tiene qué mostrar NO deja hueco: cada registro dice si está vacío para ese lead (estaVacio(ctx)), y el armador lo saltea; un bloque editable sin dato se dibuja con «—» para que lo llenen (regla de la §3). Aplica el tema y la densidad de la config (varsDeTema de lib/graficos-temas.ts).
3. LOS REGISTROS POR TAB, uno por archivo, para que en la tanda B2 cada frente sea dueño del suyo sin chocar: app/crm/lead-view/ficha/registro-resumen.tsx, registro-reuniones.tsx, registro-tracking.tsx, registro-pagos.tsx y registro-cs.tsx, más un registro.ts que los junta. Cada entrada: BloqueId → { Componente(props), estaVacio?(ctx) } con props = { ctx (los datos del lead de LeadFullData, las etapas, la etapa vigente, releer(), el rol, si es admin), diseno, ancho, editando }. HOY llenalos con las tarjetas que YA existen, envueltas, para que la ficha se vea igual que antes con la plantilla de respaldo: contacto = InfoPrincipalCard (con su resumen), calificacion = CalificacionCard, lo-que-contesto = las dos RespuestasFormulario, notas = NotasCard, motivo-de-salida = MotivoCard, plazo-nutricion = PlazoNutricionCard, proxima-reunion = el banner «Va bien» (nutricionPositivaDe), origen = OrigenCard, visitas + video-visto + actividad-en-pagina + grabacion-de-visita = ComportamientoCard (un solo bloque por ahora, decilo), reunion-1 = ReunionesCard entera por ahora, oferta = OfertaDelLead, y la parte de Pagos = DealDetailsCard entera por ahora (el «Editar deal →» SIGUE hasta la tanda B2, que lo saca cuando cada bloque escriba su campo). Un bloque del catálogo sin componente todavía NO se ofrece en «Agregar bloque» (no muestres «pronto»). Decí en «contrato» exactamente cómo se registra un bloque nuevo, cómo pide datos que no vienen en LeadFullData (con su PROPIA server action, en su propio archivo, que corre al montarse y sólo si el bloque está puesto: así ningún frente toca getLeadFullAction) y cómo avisa que cambió algo (useRefrescarFicha de lead-view/ficha-cambio.tsx).
4. EL MODO EDICIÓN, copiando la edición del Dashboard (app/dashboard/EditorInforme.tsx: estudiá cómo se agrega un elemento, cómo se elige, la barra del elemento elegido y el panel de la derecha; Martín pidió que REPLIQUE eso, no un modal distinto). Un botón «Personalizar» (sólo admin) en la fila de las tabs, NO un engranaje. En edición: cada bloque con su marco, su barra (ancho ¼ ⅓ ½ completo, diseño, ícono, quitar, arrastrar para reordenar) y «Agregar bloque» que abre el catálogo de esa tab con buscador; un panel con la PLANTILLA en uso y por qué («Llamada con R1 y R2: el funnel tiene dos reuniones»), con «Volver a la plantilla»; el ESTILO de toda la ficha (tema, acento, tipografía, densidad); y los AVISOS de «datos sin marcar» de ese funnel con sus interruptores (las asistencias, sin interruptor), que reemplazan al modal de avisos. Guarda solo, por funnel, como el Dashboard (sin botón Guardar), con «Deshacer» del último cambio. Y un aviso corto de que cambia la ficha de todo el equipo para ese funnel.
5. FUERA LO VIEJO: ResumenModal.tsx, AvisosDatosModal.tsx y su engranaje (en DatosSinMarcarCard, el onConfigurar; en InfoPrincipalCard, el del Resumen) se borran con sus imports y acciones que queden sin uso (app/crm/resumen-actions.ts si nadie más lo usa; la API puede seguir leyendo crm.resumen.campos como respaldo). Grep de cada nombre antes de borrar.
6. Tests: el armador saltea los vacíos, las dos puertas usan el mismo componente (un test que lo fije leyendo las dos), el modo edición sólo para admin, los registros cubren todos los bloques de la plantilla de respaldo, y que no vuelvan ResumenModal ni AvisosDatosModal. Corré los tests que leen LeadSheet.tsx, [id]/page.tsx, InfoPrincipalCard, DatosSinMarcarCard y LeadDetailBody: varios fijan el montaje viejo y hay que cambiarlos A PROPÓSITO.
ALCANCE: app/crm/lead-view/ficha/** (nuevo), app/crm/LeadSheet.tsx, app/crm/[id]/page.tsx, app/crm/[id]/LeadDetailBody.tsx, app/crm/lead-view/LeadTabs.tsx, app/crm/lead-view/DatosSinMarcarCard.tsx, app/crm/lead-view/InfoPrincipalCard.tsx (sólo el engranaje), app/crm/lead-view/ResumenModal.tsx y AvisosDatosModal.tsx (a borrar), app/crm/resumen-actions.ts, app/crm/actions.ts (sólo getLeadFullAction, si extraés la función de servidor), lib/ficha/** si hace falta ajustar el motor, y tests.`

const FRENTES = [
  { n: 1, key: 'motor-y-armador', etapas: [MOTOR, ARMADOR] },
  { n: 2, key: 'pagos-escritura', etapas: [`${PEDIDO}

TU FRENTE: la ESCRITURA campo por campo de Pagos, sin pantalla nueva (los bloques de Pagos los arma la tanda B2 con lo que dejes). Hoy todo pasa por «Editar deal» (app/crm/[id]/EditarDeal.tsx, ?edit=1), y el documento (§3 Pagos, «Para implementar») marca las trampas: saveDealSectionsAction (app/crm/[id]/deal-actions.ts:~146) reemplaza los jsonb enteros; saveCuotasAction (:~253) pasa por saveLeadPlanManual, que GANA el lead en cada guardado (lib/pagos.ts:~224) y borra e inserta todas las impagas (:~247-263), lo que rompe cobros.pago_id, el corte de la cobranza por ctx.cuotaId (lib/flujo-corridas.ts:~188-201) y el dedup cuota:\${pago_id} (lib/cobranza.ts:~110-114). Leelo y verificalo antes de tocar: es PLATA de clientes reales.

QUÉ HACER (server actions en un archivo nuevo app/crm/[id]/pagos-campo-actions.ts y lógica pura en lib/, cada una con haySesion, workspace del lead, historial con el diff y el actor, y Deshacer donde el historial lo soporte):
1. guardar un campo de una sección del deal (deal_fiscal, deal_servicio + fecha_inicio_servicio, deal_promesa, deal_obligaciones) con MERGE: sólo cambia lo que llega y lo demás queda; obligaciones por renglón (agregar, editar, quitar). La venta (monto, fecha, tipo: pago único, suscripción o becado) campo por campo, con compare-and-set sobre venta_tipo como hoy (deal-actions.ts:~169-178), y salir de becado por quitarSinCobroAction.
2. Cuotas por id: editarCuota(pagoId, {monto, fecha}) sin borrar ni reinsertar; armar o ajustar el plan (inicial, cuota, cantidad, día de pago) insertando sólo las nuevas, actualizando por id las impagas que quedan y borrando sólo las que sobran y NO tienen cobro ni corrida de cobranza; sin GANAR el lead al guardar (ganarlo es mover de etapa, no guardar un plan). Decidí qué hacer con saveCuotasAction/saveLeadPlanManual para que EditarDeal siga andando hasta que lo saquen (o pasalo a usar lo nuevo) y explicalo.
3. Cobrar una cuota con un link: crearCobro ya acepta pagoId (lib/cobros.ts:~202, 267) y crearCobroAction lo bloquea A PROPÓSITO (app/crm/[id]/cobros-actions.ts:~220-224): leé por qué, y abrilo sólo si queda seguro (que pagar el link marque ESA cuota y corte su cobranza); si no, dejalo en pendientes con el motivo.
4. Lo cobrado, en una función PURA nueva (lib/cobrado-lead.ts) que usen la ficha, CS y la API: «$X cobrado de $Y», %, pendiente, semáforo, y en una mensualidad activa «Al día · próxima el …» en vez de «Pagada por completo» (corrección de DealDetailsCard.tsx:~358-359); una renovación rechazada NO se pinta en verde (hoy queda en cobros.motivo de un cobro que sigue «Pagado», lib/cobros.ts:~594-597); un becado no tiene cobrado. Leé montos con montoDeTarjeta/suscripcionDeFila (lib/venta-tipo.ts), nunca monto_cierre_usd pelado (en ws11 infló el MRR un 85%: docs/hallazgos-crm.md). El estado de la suscripción: cobros.suscripcion_estado y el último rechazo, y un «cancelada» para la suscripción manual (si necesita columna, migración con XXXX).
5. La moneda (decisión 7): va por negocio, y cada pago guarda la moneda en que se cobró. registrarPagoSueltoAction y marcarPagoManualAction (deal-actions.ts:~326, 348) hoy sólo aceptan USD: que acepten la moneda (por defecto, la del negocio; mirá dónde vive la moneda del negocio y si no existe, decilo), el concepto y el método, guardando pagos.moneda y monto_original como hace la pasarela (mig 0255). Sin romper los totales en USD que leen el Dashboard y la cobranza.
6. API de MaKo: las ops de escritura nuevas en lib/api-mako/areas/cobros.def.ts / cobros.run.ts (confirmación chat), y que la lectura de cobranza del lead (cobranza_lead) devuelva lo cobrado de la función pura.
ALCANCE: app/crm/[id]/pagos-campo-actions.ts (nuevo), app/crm/[id]/deal-actions.ts, app/crm/[id]/cobros-actions.ts, lib/pagos.ts, lib/cobros.ts, lib/cobrado-lead.ts (nuevo), lib/venta-tipo.ts sólo si hace falta, app/crm/[id]/EditarDeal.tsx sólo para seguir andando con lo nuevo, lib/api-mako/areas/cobros.def.ts, cobros.run.ts, lib/api-mako/areas/crm.run.ts SÓLO la lectura cobranza_lead, rest.ts, docs/api-mako.md, el snapshot, plugin/, una migración si hace falta, y tests. NO toques app/crm/[id]/DealDetailsCard.tsx, app/crm/LeadSheet.tsx ni app/crm/[id]/page.tsx: la pantalla es de otros frentes.`] },
  { n: 3, key: 'nuevo-crm', etapas: [`${PEDIDO}

TU FRENTE: los TIPOS que faltan en «Nuevo CRM» (§2 del documento). Hoy NuevoProductoModal (app/crm/CrmToolbar.tsx:~858-976) pregunta el nombre, cómo lo vendés (CANALES, lib/fase-diagnostico.ts:~365-371 → TEMPLATE_POR_CANAL, lib/pipeline.ts:~1250) y cómo te llega la gente (ENTRADAS_OFRECIDAS, lib/pipeline.ts:~836).

QUÉ HACER:
1. Los tipos de la tabla de la §2 que faltan: DM funnel (comentan una palabra clave), orgánico de Instagram, LinkedIn, YouTube, recurso gratis (lead magnet), llamada con dos reuniones (high-ticket: la plantilla 'highticket' existe en FUNNEL_TEMPLATES y ningún canal la siembra) y anuncio con formulario de Meta (la entrada existe en el editor del funnel y «Nuevo CRM» no la ofrece). Cada uno es un PRESET = canal + entradas + etapas renombradas, NO un CanalId nuevo (CanalId es la clave de Records en ENCUENTRO_POR_CANAL, TEMPLATE_POR_CANAL y VOLUMEN_POR_CANAL). Las etapas usan las claves canónicas renombradas (lead, agenda, agendaj2, facturando, ganado, conversando), como hace 'presencial' (lib/pipeline.ts:~1193-1219): una clave nueva queda fuera de deriveStageKey y el lead cae a la primera etapa (la falla de la plantilla 'vsl'). Un test que EJECUTE cada preset y verifique que deriveStageKey ubica bien a un lead en cada etapa, y que la plantilla de ficha que elegiría la §4 es la de la tabla (dejá la función de elección para el otro frente: verificá con la REGLA escrita en el documento, en el test).
2. El modal: un paso más simple, sin más preguntas: el usuario elige el TIPO de una lista con ícono y una línea («DM funnel · comentan una palabra y les escribes»), y eso llena canal + entradas + etapas. Lo de hoy (canal y entradas a mano) queda como «Otro, lo armo yo». Un paso por pantalla; texto corto; sin default (el comentario del modal explica por qué).
3. La API de MaKo: si no hay una op para crear un CRM (grep crear en lib/api-mako/areas/crm.def.ts y en las demás áreas), agregala con el tipo como parámetro (confirmación chat), con el MISMO camino que usa el modal; si existe, sumale los tipos. En un bloque propio del .def.ts.
ALCANCE: lib/pipeline.ts (presets y plantillas), lib/fase-diagnostico.ts sólo si hace falta, app/crm/CrmToolbar.tsx (SÓLO NuevoProductoModal y lo que use), lib/api-mako/areas/crm.def.ts y crm.run.ts (en un bloque propio y contiguo), rest.ts, docs/api-mako.md, el snapshot, plugin/, y tests.`] },
  { n: 4, key: 'captura', etapas: [`${PEDIDO}

TU FRENTE: los DATOS que hoy se pierden y que los bloques nuevos necesitan (§5 del documento, «Datos que hacen falta»). Son ingestas que corren con clientes reales: cada cambio, con su test y sin escribir de más.

QUÉ HACER:
1. El @ de Instagram en el lead que entra por Instagram o Messenger: pasar e.usuario a createLead (lib/zernio-entrante.ts:~168-175). Para los leads viejos, una migración XXXX que complete leads.instagram desde ig_conversaciones.username sólo donde esté vacío (con su cabecera de orden).
2. La PRIMERA entrada social se guarda una vez y no se pisa: cómo entró (comentario, historia, DM, anuncio), la publicación, la palabra clave del comentario y el ref; hoy filaDe pisa (lib/zernio-entrante.ts:~90-107) y el texto del comentario (lib/canal-social.ts:~483) y el ref (:~388, 461) se tiran. El anuncio de un DM pagado va a meta_ad_id (:~172-174). Y una línea en el historial del lead al crearlo por Instagram (hoy Zernio no llama a logLeadEvent). Si hace falta columna, migración XXXX.
3. La página donde se registró: pasar paginaOptin (app/api/track/optin/route.ts:~166) a createLead (:~351-373) y guardarla en el lead (columna nueva con migración XXXX si no hay dónde).
4. Lo que MaKo lee de la ficha: resumenLead / ficha_lead (lib/mako-tools.ts:~58-69) no devuelve web, redes, ingreso estimado, lo que contestó en el opt-in, la oferta ni el tipo de venta, y usa pipeline_stage crudo en vez de etapaVigenteDe: completalo, así MaKo no dice «no hay» sobre lo que el equipo ve.
5. El tipo Lead (lib/leads.ts): sumá junta_1_url/junta_2_url (mig 0204) y email_opt_out (mig 0046), que existen y faltan en el tipo, y lo nuevo de este frente; y que LISTA_COLS/las lecturas de la ficha los traigan si hace falta.
ALCANCE: lib/zernio-entrante.ts, lib/canal-social.ts, app/api/track/optin/route.ts, lib/mako-tools.ts, lib/leads.ts (el tipo, createLead y las columnas que lee la ficha), migraciones XXXX, y tests. NO toques lib/api-mako/areas/crm.def.ts ni crm.run.ts (los tienen otros frentes): si una op de la API tiene que cambiar, decilo en pendientes con el detalle.`] },
  { n: 5, key: 'automations-crm-auto', etapas: [`Pedido de Martín (14/10/2026 03:06, textual en app/admin/dev/crm/bitacora.ts): «elimina el botón de "CRM Automático", para eso ya llevamos todo a Automations... Si quedó algo pendiente, llevalo como template a automations». El botón ya se sacó (tanda A). El motor del CRM automático (lib/crm-auto.ts, lib/crm-auto-plan.ts: reglas T1, T2, T3 y T6) SIGUE prendido, y se apaga recién cuando sus plantillas existan.

Lo que ya está medido (docs/relevo/crm.md, «Pendiente con Automations», y la respuesta del chat de Automations en docs/relevo/chatbot.md, commit 25e4600a): T2 (no agendó → No Agenda → Reactivación) y T6 (perdido o no responde a los 30 días → Reactivación) se arman con las piezas de hoy, pero la galería no puede pedir la ETAPA DESTINO del ⚡ Mover, que es obligatoria; T3 (nutrición manual vencida) no tiene una condición sobre leads.nutricion_manual_deadline; y para T1 (no show por Fathom) faltan una espera «N horas después de la reunión» y la condición «asistencia sin marcar». Para crear desde una plantilla hay UNA puerta: crearDesdePlantilla (lib/plantilla-crear.ts), la usan la op crear_automatizacion_desde_plantilla y POST /api/chat-agent/secuencias con action 'crear_desde_plantilla'. Ya existe la plantilla 'lead-no-avanzo' (el plazo de la etapa). Regla de la casa: «MaKo nada por detrás», o sea que toda regla escondida del motor pasa a una CONDITION visible y configurable.

LO QUE CAMBIÓ EN MAIN EN ESTOS ARCHIVOS (aviso del chat de Automations, 14/10, ya mergeado en tu base; verificalo con git log):
- plantillas-automatizaciones.ts tiene las constantes NO_CONTESTO/CONTESTO (condición 'contesto', «No contestó desde que entró») y EN_PIE ('reunion_en_pie', «Su reunión sigue en pie»). NUNCA_TE_ESCRIBIO ya no existe.
- condiciones-catalogo.ts tiene 'contesto' (de la inscripción, lee contestoEnEsta) y 'reunion_en_pie'.
- Del motor se fueron si_contesta, alResponder, pausarConCarril y la guarda escondida «la reunión ya pasó»: que el lead conteste ya no corta nada, y pausarPorRespuesta sólo anota 'respondio'.
- De chatbot.def/run se fue cambiar_si_contesta_secuencia y entró escenarios_secuencia.
SUS REGLAS para tus plantillas, que Martín pidió el 14/10 («MaKo nada por detrás») y están en AGENTS.md:
- Si «nutrición manual vencida» o «asistencia sin marcar» deciden algo, que sea una CONDITION visible, con su op en la API.
- Después de cada espera, si el mensaje habla de la reunión, va «Su reunión sigue en pie»; si da por hecho que el lead no contestó, va «No contestó desde que entró». El motor ya no lo hace solo.
- Para la espera «N horas DESPUÉS de la reunión», mirá esHiloDelCarril, minutosAntesDeReunion y decidirToqueDelCarril en lib/nutricion-grafo-motor.ts. El carril de hoy es sólo «antes»: que tu espera nueva no caiga sin querer en esas reglas (tolerancia de 12 min, salta el anti-ban y el horario).
- «Nacen pausadas»: desde 1a2fd15f, «Pausar» CONGELA (el motor no las mueve) y al activarlas lo vencido sale enseguida. Tenelo en cuenta en lo que dice cada plantilla.
- Automations va a tocar después condiciones-catalogo, los disparadores y canal-social por TikTok: commiteá chico y contiguo.

QUÉ HACER:
1. Las piezas que faltan, en el catálogo de condiciones y esperas del editor (lib/condiciones-catalogo.ts y donde viva la espera), con su evaluación en el motor de flujos y su editor: la condición «nutrición manual vencida» (o un campo de fecha del lead comparado con hoy, si sale genérico y barato), la condición «asistencia a la reunión 1/2 sin marcar», y la espera «N horas después de la reunión 1/2» (junta_1_at/junta_2_at, con la zona horaria del negocio).
2. La galería: que una plantilla pueda pedir al instalarla la ETAPA DESTINO de un ⚡ Mover (un desplegable con las etapas del CRM elegido), sin que el usuario tenga que abrir el flujo.
3. Las plantillas T1, T2, T3 y T6 con las MISMAS reglas que hoy aplica el motor (leé lib/crm-auto-plan.ts para los plazos, las claves anti-loop y las confirmaciones: T1 PROPONE y una persona confirma; mirá cómo se modela «proponer» en Automations y si no hay pieza, decilo), nacen PAUSADAS como todas, y el texto de cada una dice lo que hace.
4. NO apagues el motor ni toques KEY_CRM_AUTO: decí en pendientes qué falta para apagarlo y cómo se migraría un negocio que lo tiene prendido.
5. API de MaKo: las condiciones y esperas nuevas tienen que poder usarse desde las ops de automatizaciones (lib/api-mako/areas/chatbot.def.ts / chatbot.run.ts, y flujo-params si aplica), en un bloque propio.
ALCANCE: lib/plantillas-automatizaciones.ts, lib/plantilla-crear.ts, lib/condiciones-catalogo.ts, el motor de flujos (lib/flujos.ts, lib/flujo-corridas.ts y el ejecutor de condiciones/esperas que encuentres), app/automations/GaleriaPlantillas.tsx, app/automations/EditorCondicion.tsx y el editor de la espera, lib/api-mako/areas/chatbot.def.ts, chatbot.run.ts, lib/api-mako/flujo-params.ts, rest.ts, docs/api-mako.md, el snapshot, plugin/, y tests. Otro chat (Automations) trabaja en esta zona: tocá sólo lo necesario y en bloques contiguos, y decí en riesgos qué archivos compartidos cambiaste.`] },
]

const REVISION = {
  type: 'object',
  properties: {
    hallazgos: { type: 'array', items: { type: 'object', properties: {
      gravedad: { type: 'string', enum: ['alta', 'media', 'baja'] }, archivo: { type: 'string' }, linea: { type: 'string' },
      problema: { type: 'string' }, escenario: { type: 'string', description: 'datos o estado concretos → resultado incorrecto' }, arreglo: { type: 'string' },
    }, required: ['gravedad', 'archivo', 'problema', 'escenario', 'arreglo'] } },
    veredicto: { type: 'string' },
  },
  required: ['hallazgos', 'veredicto'],
}

const FOCO = {
  'motor-y-armador': 'la config por funnel (sanear, merge sin pisar el resto de funnels.data ni el cambio de otro admin), los avisos por funnel (que «N sin marcar», «A revisar» y el worklist den el mismo número, que las asistencias nunca se apaguen, que una lectura caída no calle avisos), el arreglo de los dos ignorados (que no despierte a los ya ignorados), el corte de sesión y de rol, el workspace del funnel, las dos puertas con los mismos datos, y que los tests prueben algo',
  'pagos-escritura': 'PLATA: el merge de las secciones del deal, las cuotas por id (que no se pierda cobros.pago_id, el corte de la cobranza ni el dedup; que guardar un plan no gane el lead), cobrar una cuota con link, lo cobrado (mensualidad activa, renovación rechazada, becado, monto_cierre_usd pelado), la moneda en los pagos a mano sin romper los totales en USD, el historial y el corte de sesión',
  'captura': 'las ingestas con clientes reales: que no se pise la primera entrada, que el @ no se escriba mal ni encima de uno puesto a mano, que la migración sólo complete vacíos, que la página de registro no rompa el opt-in, y lo que MaKo lee de la ficha',
  'automations-crm-auto': 'el motor de flujos: que la condición y la espera nuevas evalúen bien (zona horaria, reunión sin fecha, lead sin junta_*_at), que las plantillas hagan lo mismo que T1/T2/T3/T6 sin duplicar al motor que sigue prendido (¿un lead recibe las dos cosas?), que nazcan pausadas, que la etapa destino que pide la galería quede en el flujo, y lo que el texto promete contra lo que se ejecuta',
}

// ⚠️ TRES AGENTES A LA VEZ, NO CINCO. La máquina tiene ~3 GB libres con otras sesiones y otro
// workflow andando; la app ya se cayó tres veces el 14/10 por RAM (04:27, 06:10, 07:17).
const TOPE = 3
let activos = 0
const cola = []
async function conTurno(fn) {
  while (activos >= TOPE) await new Promise((r) => cola.push(r))
  activos++
  try { return await fn() } finally { activos--; const sig = cola.shift(); if (sig) sig() }
}

const implementar = (f) => async () => {
  let previo = null
  for (let i = 0; i < f.etapas.length; i++) {
    const e = f.etapas[i]
    const prompt = typeof e === 'function' ? e(previo) : e
    const r = await conTurno(() => agent(`Sos un desarrollador senior del CRM de MaKo (Next.js 16, TypeScript, Supabase). Implementás UN frente de la tanda B del CRM, completo y con tests.

${REGLAS(f.n)}

${prompt}`, { label: `impl:${f.key}${f.etapas.length > 1 ? `:${i + 1}` : ''}`, phase: 'Implementar', schema: SALIDA }))
    if (!r) return previo ? { ...previo, segundaEtapa: null } : null
    previo = i === 0 ? r : { primeraEtapa: previo, ...r }
  }
  return previo
}

const revisar = (f, r) => conTurno(() => agent(`Revisá el trabajo de otro desarrollador en el worktree C:/Users/marti/wtc-b${f.n} (rama crm-bloques-b${f.n}): 'git -C C:/Users/marti/wtc-b${f.n} log --oneline crm-bloques..HEAD' y 'git -C C:/Users/marti/wtc-b${f.n} diff crm-bloques..HEAD'. SÓLO LEÉS: no edites, no commitees, no corras tsc ni builds (sí podés correr sus tests con 'npx tsx --test --test-concurrency=1').
Buscá lo que NO se ve en la pantalla y rompe. Foco de este frente: ${FOCO[f.key]}. En general: datos que se escriben mal o de más, una acción del servidor sin el corte de sesión o de rol, el workspace equivocado (sin sesión getWorkspaceActual cae al ws1, que es un cliente), lecturas que escriben, consultas por render o sin tope, algo que no se puede deshacer, lo que se promete y no es lo que se ejecuta, y tests que dan verde sin probar nada. Ignorá lo visual. Cada hallazgo con un escenario concreto. El diseño: docs/diseno-ficha-bloques.md.

Lo que reportó el desarrollador:
${JSON.stringify(r)}`, { label: `revisar:${f.key}`, phase: 'Revisar', schema: REVISION }))

const resultados = await pipeline(
  FRENTES,
  (f) => implementar(f)(),
  (r, f) => (r && FOCO[f.key] ? revisar(f, r).then((rev) => ({ ...r, revision: rev })) : r),
)

const out = {}
FRENTES.forEach((f, i) => { out[f.key] = resultados[i] })
return out
