# Tanda B1 del CRM: lo que devolvieron los agentes (14/10/2026)

> Volcado mecánico del journal de `wf_0132bb27-e06`. Quedó en el repo porque la corrida se cortó al 98% del uso semanal
> y lo que sólo vive en el journal se pierde. NO es la cosecha: al integrar, los hallazgos van a docs/hallazgos-<área>.md
> y esto se borra. El estado y el orden de lo que falta están en docs/relevo/crm.md.

## b3 · tipos de «Nuevo CRM» (wtc-b3)

«Nuevo CRM» ahora pide el nombre y el TIPO, cada uno en su pantalla. El tipo se elige de una lista de 13 opciones, cada una con ícono y una línea. Las 12 de la tabla de la §2 crean el CRM sin preguntar nada más, porque cada una llena el canal, la entrada y las etapas. La 13ª, «Otro, lo armo yo», mantiene las dos preguntas de antes (canal y entradas), una por pantalla. No hay nada elegido de entrada.
- lib/pipeline.ts: `TIPOS_CRM` tiene 12 presets. Cada uno es un canal existente + UNA entrada + las etapas de una plantilla con nombres cambiados. No se agregó ningún `CanalId`. Los siete que faltaban son dos_reuniones (siembra `highticket`), formulario_meta (entrada `formulario_anuncio`), dm_funnel, instagram, recurso_gratis, linkedin (lead → conversando → agenda → ganado) y youtube.
- Mismo archivo: `siembraDeCrm` sanea la elección y falla cerrado ante cualquier cosa que no exista. `apagadasAlCrear` hace la misma cuenta de nutriciones apagadas que `crearFunnel`.
- La plantilla `vsl` pasó a las claves canónicas (lead, conversando con kind grupo, agenda, facturando, ganado) y en pantalla conserva los mismos nombres.
- lib/nuevo-crm.ts tiene `crearCrm`, el único camino de alta: llama a `crearProductoConFunnel` y después guarda las etapas y la entrada con `saveFunnelDe`. Si esa segunda escritura falla no tira error: devuelve `etapasDelTipo: false`, porque el CRM ya existe y un error invitaría a crearlo dos veces.
- app/crm/nuevo-crm-actions.ts tiene `crearCrmAction`, que corta sin sesión y a quien no es admin. Reemplaza en el modal al par `crearProductoAction` + `declararEntradasAction`.
- API de MaKo, en un bloque propio de crm.def.ts y crm.run.ts:
  - `tipos_de_crm`: lectura, `GET /crm/tipos`.
  - `crear_crm`: confirmación chat, solo admin, `POST /crm/embudos`; devuelve el embudoId en `datos`.
  - Se regeneraron docs/api-mako.md y el snapshot HTTP. El plugin no cambió.
- Nada de esto lo vi en un navegador: el modal no está probado en pantalla.

**Commits**
- `54b6bde61` CRM: los tipos de «Nuevo CRM» como presets (canal + entrada + etapas), y la plantilla vsl con claves canónicas
- `022d2c42d` CRM: «Nuevo CRM» elige el TIPO de una lista y crea por una sola action (sesión + admin)
- `8b3392d15` API de MaKo: tipos_de_crm y crear_crm, el mismo alta que «Nuevo CRM»

**Contrato para la tanda B2**

Este frente NO toca el motor ni el armador de bloques. Lo que otros frentes pueden usar de acá:
- lib/pipeline.ts (puro, sirve en cliente y server):
  - `type TipoCrmId = 'llamada'|'dos_reuniones'|'webinar'|'presencial'|'conversaciones'|'dm_funnel'|'instagram'|'formulario_meta'|'recurso_gratis'|'linkedin'|'youtube'|'carrito'`
  - `type TipoCrm = { id; label; linea; canal: CanalId; entradas: readonly EntradaId[]; pipeline: Stage[]; suppressed?: readonly string[] }`
  - `TIPOS_CRM: readonly TipoCrm[]`, `TIPO_CRM_OTRO = 'otro'`, `esTipoCrm(v)`, `tipoCrmPorId(v): TipoCrm | null`
  - `type SiembraCrm = { tipo: TipoCrmId | null; canal: CanalId; entradas: EntradaId[]; pipeline: Stage[]; suppressed: string[] }`
  - `siembraDeCrm({ tipo, canal?, entradas? }): SiembraCrm | { error }`: falla cerrado ante lo que no existe
  - `apagadasAlCrear(pipeline, propias?)`: suppressed propias + suppressedInicial, sin repetir
- lib/nuevo-crm.ts (server-only): `crearCrm(nombre, siembra): Promise<{ productoId; ofertaId; funnelId; etapasDelTipo: boolean; motivo? }>`
- app/crm/nuevo-crm-actions.ts: `crearCrmAction(nombre, { tipo, canal?, entradas? }): { funnelId; etapasDelTipo } | { error }`
- El TIPO no se guarda en el funnel. La plantilla de la ficha la decide la regla de la §4 a partir de las reuniones (tieneEtapaDeReunion por etapa), fechaFijaDelEvento(canal) y tipoDeFunnel(entradas) + canal carrito. La función que la aplica es del frente del armador; tests/tipos-crm.test.ts trae una copia (`plantillaDeFicha`) con ids provisorios: 'r1-r2', 'una-llamada', 'evento', 'carrito', 'te-escriben', 'prospeccion', 'formulario-meta', 'landing', 'respaldo'.
- La plantilla `vsl` tiene el webinar en `agenda` (R1, fecha_junta_1/asistio_j1), el grupo en `conversando` (kind grupo) y el checkout en `facturando`.

**API de MaKo**
- tipos_de_crm (lectura, TODOS los canales, gating TAB): GET /crm/tipos
- crear_crm (acción, confirmación chat, TAB_ADMIN, reversible: false; params nombre, tipo ∈ TIPOS_CRM ids | 'otro', canal y entradas solo con otro): POST /crm/embudos; datos { embudoId, productoId }

**Tests**
- tests/tipos-crm.test.ts (nuevo): 8/8 pasan. Ejecuta cada tipo: ubica un lead en cada etapa como lo hace el tablero (etapaVigenteDe y, si no la encuentra, la primera columna) y aplica la regla de la §4, escrita en el test, para comprobar que la plantilla de ficha sea la de la tabla. — rotura: Cuatro roturas, cada una 7/1: la R1 de linkedin con la clave 'sesion'; recurso_gratis con la entrada chat_entrante; siembraDeCrm cayendo a TIPOS_CRM[0]; apagadasAlCrear sin suppressedInicial.
- tests/acciones-sin-sesion.test.ts (test nuevo): 6/6 pasan — rotura: Sin haySesion() en crearCrmAction: 5/1. Sin el corte de admin: 5/1.
- tests/funnel-estructura.test.ts (3 tests cambiados a propósito: fijaban crearProductoAction, `paso === 1 && !canal` y alto 520): 28/28 pasan — rotura: Sin entradas en el saveFunnelDe de nuevo-crm.ts: 27/1. El tipo con useState('llamada') de default: 27/1. Sin la validación `!tipo`: 26/2.
- tests/producto-con-funnel.test.ts (cambiado a propósito): 5/5 pasan — rotura: crearCrm sin crearProductoConFunnel: 4/1.
- tests/pipeline.test.ts, tests/stage-requirements.test.ts, tests/funnel-etapas.test.ts (cambiados a propósito por las claves nuevas de vsl): Pasan — rotura: En pipeline.test.ts, con 'registro' de vuelta en la entrada de vsl: 9/1.
- Los 123 archivos que leen mis archivos, más los guards que barren el repo (grep ls-files): 1533/1535 pasan, 1 falla — rotura: La que falla es integracion-sin-salir.test.ts («el barrido: ningún link a /integraciones fuera de la lista»). Viene de antes: la provocan app/landing-generator/editor/dialogos/DialogoPublicar.tsx y app/landing-generator/editor/nodos/CobroBoton.tsx, que no toqué.

**Pendientes**
- app/crm/actions.ts:839 `crearProductoAction` quedó sin uso, y además no tiene haySesion ni corte de rol: sin cookie, getTenantDb cae al ws1. Conviene borrarla, o ponerle el corte si alguien más la usa.
- lib/producto-con-funnel.ts:58 y :86-93: que `crearProductoConFunnel` reciba `{ pipeline, suppressed, extra }` y se los pase a crearFunnel en un solo insert. Así `crearCrm` (lib/nuevo-crm.ts) deja de escribir dos veces. Hoy tampoco pasa `tpl.suppressed`; no rompe nada porque suppressedInicial ya apaga 'nopaga>reunion_excepcional'.
- lib/funnels.ts:622-624: que crearFunnel use `apagadasAlCrear` (lib/pipeline.ts). Hoy la misma fórmula está en dos lugares.
- app/crm/CrmToolbar.tsx:~776 `opciones.unshift({ value: NUEVA, label: 'Nuevo CRM', crear: true })`: esconder la opción a quien no es admin. Hoy un closer completa los dos pasos y recién al final ve «Solo el administrador puede crear un CRM». Hay que pasarle el rol a SelectorFunnel.
- docs/diseno-ficha-bloques.md: la §2 («Para implementar», «la falla de la plantilla vsl») y la última fila de la tabla de la §5 («usa claves que el cálculo de etapa no conoce») quedaron viejas para los funnels nuevos.
- Medir en producción `select id, workspace_id from funnels where plantilla = 'vsl'`: esos funnels conservan las claves viejas (registro/webinar/checkout), y sus leads con fecha de webinar siguen cayendo en la primera columna.
- Verificar el modal en el navegador, porque no pude levantar servidores: las 13 opciones en dos columnas (minmax 230px), el alto fijo min(85vh, 680px) con el paso más largo, y una sola columna en el celular.
- Si Martín quiere los logos de Instagram, LinkedIn y YouTube, hay que sumarlos a app/_ui/iconos-menu.tsx. Hoy van #, imagen, avión de enviar y play (ICONO_TIPO_CRM en CrmToolbar.tsx).
- Para el frente del armador de la ficha: la función que elige la plantilla según la §4 no existe. tests/tipos-crm.test.ts tiene la regla copiada (`plantillaDeFicha`, con ids provisorios 'r1-r2', 'una-llamada', 'evento', 'carrito', 'te-escriben', 'prospeccion', 'formulario-meta', 'landing', 'respaldo'); cuando esa función exista, el test debería llamarla a ella.

**Hallazgos (a cosechar)**
- La plantilla `vsl` usaba claves propias (registro, grupo, webinar, checkout). Un lead con la fecha del webinar deriva `agenda`, el funnel no tenía esa clave y el tablero lo dibujaba en la PRIMERA columna. Vive en lib/pipeline.ts, FUNNEL_TEMPLATES. Quedó arreglado para los funnels nuevos. Regla: toda plantilla o preset usa claves canónicas renombradas (lead, agenda, agendaj2, facturando, ganado, conversando), y tests/tipos-crm.test.ts lo fija ubicando un lead en cada etapa.
- El test «funnel VSL: el webinar y el cierre validan lo suyo» (stage-requirements) pasaba sin probar nada. funnelReqInfo(vsl, 'webinar') cuenta las reuniones del pipeline sin mirar la clave, y por 'checkout' contestaba esVenta=false porque cualquier clave desconocida no es venta. Con las claves cambiadas siguió en verde sobre etapas que ya no existían. Regla: un test que pregunta por una etapa por su clave primero verifica que la clave esté en el pipeline.
- El diagnóstico obvio era agregar un CanalId por tipo, y era el equivocado: CanalId es la clave de tres Record (ENCUENTRO_POR_CANAL, TEMPLATE_POR_CANAL, VOLUMEN_POR_CANAL) y la ficha saca su plantilla de las reuniones y la entrada, no del canal. Un tipo es un preset en TIPOS_CRM y la plantilla de ficha sale sola: los doce tipos caen donde dice la tabla de la §2.
- El alta de antes perdía datos sin avisar. El modal llamaba a crearProductoAction, que no pide rol, y después a declararEntradasAction, que pide admin, con `.catch(() => {})`. Para un closer el CRM se creaba sin entradas y nadie se enteraba (app/crm/CrmToolbar.tsx, versión anterior). Regla: el alta va en una sola action con un solo corte (sesión + admin).
- Un tipo no siempre tiene las etapas de la plantilla de su canal: dos reuniones va sobre `llamadas`, cuya plantilla es `simple`, y LinkedIn agrega la conversación antes de la llamada. Las ids de `suppressed` salen de las claves del pipeline, así que las nutriciones apagadas se vuelven a calcular sobre las etapas del tipo (apagadasAlCrear). Copiar las del canal habría dejado prendidas o apagadas las equivocadas.
- Trampa de RAM/entorno: el scratchpad lo comparten varios agentes y otro frente sobrescribió msg1.txt y msg2.txt (mensajes de commit) mientras yo trabajaba. Regla: en el scratchpad, nombres de archivo con el prefijo del frente.
- Los labels de etapa tienen un tope de 24 caracteres (MAX_LABEL_ETAPA): uno más largo, como «Lead entrante (pidió el recurso)», se recortaría al primer guardado. Quedó «Pidió el recurso», y el test controla el tope.
- Decisiones mías que el documento no cerraba: UNA entrada por tipo, alineado con el «Tipo de funnel» del editor del 12/10 («solo se pueda elegir 1 opción»); Llamada y YouTube van con `landing` (agenda_sola ya no se ofrece); Sesión presencial va con `chat_entrante` (la tabla dice «te escriben o tú les escribes»).

**Riesgos**
- Los no-admin ya no pueden crear un CRM. Antes podían, aunque quedaba sin entradas.
- crearCrm escribe dos veces: si falla la segunda, el CRM queda con las etapas de su canal, sin las del tipo y sin entrada. El modal lo abre igual y la API lo avisa en el resumen.
- El modal no está probado en el navegador. Con alto fijo de 680px y 13 tarjetas, en pantallas bajas el paso del tipo puede necesitar scroll.
- Un token detallado con escritura en CRM crea un CRM por HTTP en el acto, como toda acción de token detallado.
- Los funnels nuevos de canal webinar (onboarding y «Otro») nacen con las claves nuevas; los viejos de vsl no cambian. mismoPipeline los va a tratar como «editados», que es el lado seguro.
- No corrí tsc (está prohibido en esta máquina). Los tipos nuevos (siembraDeCrm, el estado del modal, los enums de la def) no pasaron por el compilador, solo por tsx en los tests.

## b1 · motor de la ficha por bloques (wtc-b1, etapa 1)

El motor de la ficha por bloques está en la rama crm-bloques-b1 (C:/Users/marti/wtc-b1), en 5 commits, sin pushear. Sólo lib y server: la pantalla no se tocó.
- lib/ficha/catalogo.ts: los 56 bloques de la §3, con id tal cual el documento. Cada uno trae su tab y su «también en», sus anchos de 12 columnas, ancho y diseño de entrada, sus diseños, qué datos completa, si se calla sin datos, si se puede quitar (contacto no), si va varias veces, si es privado y su ícono del set. También la densidad de las tarjetas.
- lib/ficha/plantillas.ts: las 9 plantillas de la §4 más la fija de CS. elegirPlantilla aplica la regla del documento: cuenta las reuniones con tieneEtapaDeReunion etapa por etapa, el evento con fechaFijaDelEvento(canalEfectivo(...)) y la entrada con tipoDeFunnel o el canal carrito. Nunca usa funnels.canal pelado. Los avisos apagados son los que escribe el documento más los de todo dato cuyo bloque la plantilla no pone, menos el comprobante del carrito.
- lib/ficha/config.ts: la ficha por funnel en funnels.data.ficha, guardando sólo lo cambiado. Incluye el saneo tolerante y fichaEfectiva con el respaldo del negocio (crm.resumen.campos y crm.datos_aviso.apagados). Los cambios son parches (CambioFicha) que se normalizan: si el cambio deja todo como la plantilla, no queda nada guardado. Las asistencias nunca se apagan, y sacar un bloque no apaga su aviso.
- lib/ficha/config-server.ts: lee la ficha de un funnel y guarda un cambio sobre lo de hoy, con compare-and-set sobre funnels.updated_at y sin tocar el resto de data. avisosDelWorkspace hace UNA lectura de todos los funnels por pasada; apagadosDeFunnel es la de un solo lead.
- Avisos por funnel en todos lados: el worklist (getPendientesDeMarcar) y estadoDatosDeLead usan la ficha del funnel de cada lead (PENDIENTES_COLS suma funnel_id). Si los funnels no se pueden leer, vale lo del negocio.
- Mismo número en las tres puertas: «N sin marcar» de la ficha, «A revisar» y el worklist pasan por avisanDelLead / partirDatosDelLead (lib/datos-aviso.ts).
- Los dos ignorados: la escritura vive en lib (escribirDatosIgnorados) y la usan la ficha, la ✕ de «A revisar» y la API.
- app/crm/ficha-actions.ts: leer (cualquier rol) y cambiar (sólo admin), las dos con haySesion. avisosDatosAction y guardarAvisosDatosAction aceptan un funnelId opcional.
- API de MaKo: ver_ficha_funnel y cambiar_ficha_funnel (chat, sólo admin, salen por GET/PATCH /crm/ficha). ignorar y reactivar ahora escriben datos_ignorados, y faltantes_del_lead devuelve el número de la ficha. Regenerados docs/api-mako.md y el snapshot de HTTP; plugin/ no cambió.

**Commits**
- `1c930ec33` Ficha por bloques: el catálogo de los 56 bloques del diseño, con test contra el documento
- `b21d99dcc` Ficha por bloques: las plantillas por tipo de funnel y la regla que elige la de cada uno
- `af73a1672` Ficha por bloques: la config por funnel, con sólo lo cambiado y el respaldo del negocio
- `07aa12b88` Ficha por bloques: leer y guardar la ficha de un funnel, y los avisos de datos sin marcar POR FUNNEL
- `d04040305` API de MaKo: ver y cambiar la ficha de un CRM, y los ignorados de datos sin marcar como la pantalla

**Contrato para la tanda B2**

ARCHIVOS: lib/ficha/catalogo.ts, plantillas.ts, config.ts y registro.ts son puros. lib/ficha/api.ts es puro (traduce para la API). lib/ficha/config-server.ts es server-only. Las server actions están en app/crm/ficha-actions.ts.

catalogo.ts:
- Tipos: TabFicha = 'resumen'|'reuniones'|'pagos'|'tracking'; TabCs = 'cs-resumen'|'cs-pagos'; TabBloque; Ancho = 3|4|6|12; Densidad = 'compacta'|'normal'|'amplia'; Red = 'web'|'instagram'|'youtube'|'linkedin'; FuenteRespuesta = 'meta'|'landing'|'agenda'; SinDatos = 'se-calla'|'raya'; BloqueId (los 56 ids del documento).
- BloqueDef = { id, tab, tambienEn, titulo, anchos, ancho, disenos: {id, nombre}[], avisa: StepId[], quitable, sinDatos, icono: NombreIconoMenu, varias?: true, privado?: 'admin-y-closer', opciones?: ('redes'|'fuentes'|'pregunta')[] }.
- Valores y funciones: BLOQUES, bloqueDef(id), esBloqueId, vaEnTab(def, tab), bloquesDeLaTab(tab), bloquesQueAvisan(paso), TABS_FICHA, NOMBRE_TAB, ANCHOS, DENSIDADES.

plantillas.ts:
- Tipos: PlantillaId = 'respaldo'|'dos-reuniones'|'una-llamada'|'evento'|'formulario-meta'|'landing'|'te-escriben'|'prospeccion'|'carrito'; PlantillaFicha; EleccionPlantilla = { id, porque }.
- Funciones: elegirPlantilla({ etapas, canalDelFunnel, canalDelNegocio, entradas }), plantillaFicha(id), listaDePlantilla(p, tab), listaDeTab(p, tab), apagadosDePlantilla(p).
- Valores: PLANTILLAS_FICHA, PLANTILLA_RESPALDO, PLANTILLA_CS.

config.ts:
- Registro de un bloque puesto: BloquePuesto = { id: BloqueId; ancho: Ancho; diseno: string; icono?: NombreIconoMenu; opciones?: { redes?: Red[]; fuentes?: FuenteRespuesta[]; pregunta?: string } }.
- FichaGuardada = { plantilla?, tabs?: Partial<Record<TabFicha, BloquePuesto[]>>, avisos?: Partial<Record<StepId, boolean>>, estilo?: { tema?: TemaHoja; densidad?: Densidad } }.
- RespaldoNegocio = { resumen, apagados }; EstadoAviso = { id, label, avisa, por }.
- FichaEfectiva = { plantilla, plantillaAMano, tabs: Record<TabFicha, BloquePuesto[]>, tocadas, apagados, avisos: EstadoAviso[], estilo: { tema, densidad } }.
- Funciones: sanearFicha(raw), fichaEfectiva(elegida, guardada, respaldo), bloquesDeTab(f, tab, { verPrivado }), dondeSeCompleta(f, paso), puestoDeEntrada(id, respaldo), sanearCambio(raw), aplicarCambio(actual, cambio, elegida, respaldo), describirCambio(c).
- CambioFicha.op es uno de: poner, quitar, mover, ancho, diseno, icono, opciones, lista, aviso, avisos, tema, densidad, volver, plantilla, restaurar (lugar y n cuentan desde 1).

registro.ts (lo que usan los bloques de B2):
- CtxBloque = { leadId, funnelId, tab, rol: RolFicha, puedeEditar, tz, estilo }.
- PropsBloque<D> = { puesto, def, titulo, datos: D|null, ctx }.
- Lado del navegador: RegistroBloque<D> = { id, Componente: ComponentType<PropsBloque<D>>, hayDatos? }.
- Lado del server: CargadorBloque<C, D> = { id, cargar(contexto, puesto) → Promise<D|null> }.
- Funciones: seDibuja(def, datos, hayDatos?) y tituloDeBloque(def, etapas), que en reunion-1/2 usa el nombre de su etapa.

config-server.ts:
- leerFichaDeFunnel(funnelId|null) → FichaDelFunnel | null, con FichaDelFunnel = { funnel: {id, nombre, esDefault}, eleccion, guardada, efectiva, respaldo }.
- cambiarFichaDeFunnel(funnelId|null, cambio) → { ok, ficha, antes, cambio } | { ok: false, error }.
- avisosDelWorkspace() → { apagadosDe(funnelIdDelLead), porFunnel }; apagadosDeFunnel(funnelId); respaldoDelNegocio().

ficha-actions.ts: leerFichaFunnelAction(funnelId|null) y cambiarFichaFunnelAction(funnelId|null, cambio).

datos-aviso.ts: avisanDelLead, partirDatosDelLead, ignoradosDelLead, cambioDeIgnorados, IGNORABLES. datos-aviso-config.ts: escribirDatosIgnorados(leadId, pasos, ignorar, autor).

**API de MaKo**
- ver_ficha_funnel (nueva, lectura, todos los canales, tab crm): GET /crm/ficha?embudoId=
- cambiar_ficha_funnel (nueva, acción con confirmación chat, sólo admin, todos los canales): PATCH /crm/ficha. cambio = poner|quitar|mover|ancho|diseno|aviso|estilo|densidad|plantilla|volver
- ignorar_datos_sin_marcar (cambiada): escribe datos_ignorados con todos los ignorables por escribirDatosIgnorados; ya no escribe pendientes_ignorados; «ya está así» marcado como yaEstaba
- reactivar_datos_sin_marcar (cambiada): vacía datos_ignorados, pendientes_ignorados y empresa_omitido por la misma escritura; yaEstaba si no hay nada ignorado
- faltantes_del_lead (cambiada): suma sin_marcar (el número de la ficha, con la ficha del funnel del lead) y no_avisan con el porqué

**Tests**
- tests/ficha-catalogo.test.ts: 6/0 (lee las tablas del .md) — rotura: 6 roturas: otro id → 4/2; las otras cinco → 5/1
- tests/ficha-plantillas.test.ts: 7/0 (lee las listas del .md y ejecuta elegirPlantilla con funnels como ws1, ws11, ws13, ws15 y ws17) — rotura: 6 roturas: canal pelado → 5/2; las otras cinco → 6/1
- tests/ficha-config.test.ts: 10/0 — rotura: 7 roturas, cada una 9/1
- tests/ficha-registro.test.ts: 2/0 — rotura: 2 roturas, cada una 1/1
- tests/ficha-avisos.test.ts: 7/0 (mismo número en las tres puertas, una sola lectura de funnels, la API ignora como el panel) — rotura: 7 roturas, cada una 6/1
- tests/ficha-api.test.ts: 5/0 — rotura: 5 roturas, cada una 4/1
- tests/acciones-sin-sesion.test.ts: 6/0 (suma las acciones de la ficha) — rotura: sin haySesion en cambiarFichaFunnelAction → 5/1
- tests/a-revisar-por-lead.test.ts: 11/0 (cambiado a propósito: la única escritura de lo ignorado vive en lib) — rotura: la acción escribiendo datos_ignorados por su cuenta → 10/1
- tests que leen archivos de mi alcance (api-mako-registro, api-mako-rest, worklist, a-revisar, datos-aviso, pendientes-columnas, flujo-acciones, editor-acciones, agenda y 26 más): todo verde: 155 + 310 + 191 pases. El único ✖ es el todo ya marcado como bloqueante en tests/api-mako-landing-editor.test.ts
- guards que barren el repo (grep ls-files, 60 archivos): 597/1 — rotura: El 1 es tests/integracion-sin-salir.test.ts: links a /integraciones en app/landing-generator/editor/dialogos/DialogoPublicar.tsx y nodos/CobroBoton.tsx. No vienen de este frente.

**Pendientes**
- Segunda etapa, el armador: la cabecera todavía calcula los faltantes con otros insumos que el worklist. app/crm/[id]/page.tsx:168-171 no pasa `grabable` y usa `pagos.length > 0 ? true : undefined`, mientras app/crm/actions.ts:318 y el worklist usan `pagos.length > 0` y `grabable`. Hasta que el armador calcule los faltantes una sola vez, el plan y el Fathom pueden dar distinto. El test fija lo de ignorados y apagados, no esos insumos.
- Segunda etapa: app/crm/lead-view/AvisosDatosModal.tsx:32 y :44 llaman avisosDatosAction() y guardarAvisosDatosAction(nuevos) sin funnelId, o sea que siguen editando lo del negocio. Hay que pasarles el funnel del lead (`lead.funnel_id ?? null`). Mientras tanto, prender ahí algo que la plantilla del funnel apaga no tiene efecto.
- Segunda etapa: TAB_DE_DATO (lib/datos-aviso.ts, setter y closer → 'reuniones') se reemplaza por dondeSeCompleta(efectiva, paso) de lib/ficha/config.ts. Lo dejé intacto porque los campos todavía viven en ReunionesCard.
- La ficha no tiene historial: no existe tabla de cambios de configuración de un funnel. cambiarFichaFunnelAction sólo deja un console.info con el autor y devuelve `antes` para deshacer con {op:'restaurar', ficha: antes}. Para dejar rastro hace falta una tabla (por ejemplo funnel_audit, o el pedido «registro de TODAS las acciones de usuario»), con migración.
- pendientes_ignorados todavía se escribe en app/crm/actions.ts:1437 (ignorarPendientesAction), :1448 (ignorarPendientesMasaAction, en lote) y :1469 (reactivarPendientesAction). Hay que pasarlas a escribirDatosIgnorados(leadId, IGNORABLES, ...) de lib/datos-aviso-config.ts, como la API.
- Carrito sin bloque de cuotas: el documento deja avisando el comprobante (y así está implementado), pero la plantilla no pone `cuotas`. Un pago a mano sin comprobante en un funnel de carrito no tiene dónde completarse en la ficha, y el asistente tampoco lo resuelve (WIZARD_STEP_IDS en lib/stage-requirements.ts no incluye comprobante). Los bloques de Pagos de la tanda B2 tienen que darle lugar.
- El orden de los anchos de entrada en cada plantilla no está pensado fila por fila (por ejemplo, contacto de ancho completo y después cuatro de ⅓). El armador decide cómo empaquetar las filas, o se ajustan los anchos por plantilla.

**Hallazgos (a cosechar)**
- La regla general de la §4 apaga más avisos que las listas del documento. La regla dice que si una plantilla no pone el bloque de un aviso, ese aviso nace apagado. Aplicada al pie de la letra, además de lo que lista el documento, apaga: en Landing con opt-in el setter y el closer (no trae setter-y-closer); en Evento el calificado; en Te escriben servicio, promesa, obligaciones, comprobante y documento fiscal; en Prospección calificado, servicio, promesa, obligaciones y documento fiscal; en Formulario de Meta comprobante y documento fiscal; en Carrito el closer; en Una llamada y Evento el Fathom de la R2 (no importa, tienen una sola reunión). Implementé la regla como está escrita; tests/ficha-plantillas.test.ts lo fija. Martín tiene que confirmar sobre todo el setter en Landing: cambiarlo es una línea en la plantilla o un toque en la ficha.
- La cabecera, «A revisar» y el worklist contaban distinto. Síntoma: un lead con «3 sin marcar» en su ficha que no aparecía en «A revisar». La causa no estaba en los apagados: el worklist sacaba el lead entero ignorado (pendientes_ignorados, mig 0109) y la empresa omitida, y estadoDatosDeLead no. Vive en lib/datos-aviso.ts (ignoradosDelLead / avisanDelLead / partirDatosDelLead). Regla: las tres puertas pasan por avisanDelLead.
- «Volver a avisar» mentía en los leads ignorados de la manera vieja. Esos datos se dibujaban como «ignorado» con su botón, pero el botón sólo sacaba el dato de datos_ignorados, y pendientes_ignorados (o empresa_omitido) lo seguía escondiendo. Arreglo: cambioDeIgnorados pasa ese lead a ignorado dato por dato (todos menos el que vuelve) y limpia la marca vieja. Ningún otro dato se despierta.
- La API ahora ignora TODOS los datos ignorables del lead, no sólo los que hoy le faltan. Así se conserva lo que hacía la op para los flujos (un «Spam» deja de contar también con lo que le falte después), y cada dato aparece en «Ver más» cuando falta, con su «volver a avisar». Reactivar vacía datos_ignorados, la marca vieja y empresa_omitido. Qué hacer con la columna pendientes_ignorados: pasar las tres escrituras de app/crm/actions.ts a escribirDatosIgnorados, convertir las filas viejas con una migración de datos (datos_ignorados = todos los ignorables, pendientes_ignorados = null) y recién entonces borrarla. Hoy la leen ignoradosDelLead y el loop de «Ver más» de lib/queries.ts.
- Guardar la ficha NO puede pasar por saveFunnelDe (lib/funnels.ts), aunque mergea bien: pone declarado = true, y con eso los prompts empiezan a afirmar un funnel que nadie declaró. config-server escribe aparte, con compare-and-set sobre updated_at.
- tieneEtapaDeReunion es un booleano y no cuenta reuniones. Para contar con la MISMA regla que la tab se aplica etapa por etapa (cuantasReuniones = etapas.filter(e => tieneEtapaDeReunion([e]))). Así no hay una segunda copia del predicado, y la «Reunión excepcional» que siembra generateFunnel en la banda de nutrición no cuenta.
- El documento cita lib/general-vistas-modelo.ts (BLOQUES_GENERAL, PLANTILLAS), y ese archivo ya no existe. La General se rehízo sobre el editor del Dashboard: el molde actual es lib/general-piezas.ts y lib/general-plantillas.ts.
- La plantilla depende del canal del negocio (getDiagnosticoFase). Como funnels.canal está en NULL, si ese setting falta o no se lee, un funnel presencial con una reunión pasa de «Evento» a «Una llamada» y cambian sus avisos, sin error. getSetting devuelve null en vez de tirar.
- Se rompió a propósito un test existente: tests/a-revisar-por-lead.test.ts exigía exactamente una escritura de datos_ignorados en app/crm/datos-sin-marcar-actions.ts. Ahora exige cero ahí y una llamada a escribirDatosIgnorados, porque la API tiene que usar la misma escritura y una server action no se puede llamar desde el registro.

**Riesgos**
- Al desplegar cambian los avisos de clientes reales, sin pantalla que lo explique hasta la segunda etapa. Según la plantilla de cada funnel dejan de avisar varios datos: ws15/ws17 (formulario de Meta) empresa, plan, servicio, promesa, obligaciones y lo fiscal; ws11 (evento) lo fiscal, servicio, promesa, obligaciones y calificado; ws13 (landing) setter y closer, entre otros. Baja el número de «A revisar» y del worklist. Se puede volver atrás por funnel con cambiar_ficha_funnel (cambio aviso) o con {op:'avisos'} desde la action. ws1 (dos reuniones) y el respaldo no cambian.
- No corrí tsc, como pedía la tarea. Revisé los tipos a mano; los tests corren con tsx y no tipan. El pre-push lo va a tipar.
- Semántica nueva de ignorar_datos_sin_marcar en los flujos (⚡ Acción): ahora escribe datos_ignorados con todos los ignorables y ya no la marca del lead entero. reactivar también limpia empresa_omitido.
- estadoDatosDeLead suma, por cada apertura de ficha, una lectura del funnel y tres settings (resumen, apagados y el diagnóstico de fase). El worklist suma una lectura de todos los funnels por pasada.
- El ciclo entre lib/datos-aviso-config.ts y lib/ficha/config-server.ts se evita con un import dinámico en estadoDatosDeLead. Si alguien lo pasa a estático, vuelve el ciclo.

## b2 · Pagos campo por campo (wtc-b2)

La tab Pagos ya puede escribir campo por campo sin «Editar deal», y Editar deal sigue andando.
- Lógica pura y con tests: lib/pagos-campo.ts (merge de un campo del deal, obligaciones renglón por renglón con el texto que se vio, cambios de la venta copiados del wizard con compare-and-set y Deshacer, reconciliación de cuotas POR ID, plan uniforme, pago a mano en otra moneda) y lib/cobrado-lead.ts («$X cobrado de $Y» con semáforo, sin las tres mentiras de DealDetailsCard).
- lib/pagos.ts: ningún escritor de cuotas borra e inserta. saveLeadPlanManual, savePlanPagos y el nuevo guardarCuotasPorId pasan por reconciliarYGuardar: actualiza por id, inserta y borra AL FINAL sólo las impagas sin link vivo ni recordatorio abierto. Si no puede leer qué protege a una cuota, no escribe. Además: editarCuota, ajustarPlanPagos, cortarRecordatoriosDeCuota, escribirCampoDeal/escribirObligacion (merge con compare-and-set sobre leads.updated_at), escribirVenta, quitarSinCobro, cambiarEstadoSuscripcionManual, moneda del negocio (app_settings 'negocio.moneda', USD por defecto), anotarEnHistorial. cobrarCuota y registrarPagoSuelto aceptan moneda, montoOriginal, concepto y metodo; monto sigue en USD.
- Decisión sobre saveCuotasAction/saveLeadPlanManual: saveCuotasAction (Editar deal) pasa a guardarCuotasPorId y ya NO gana el lead. saveLeadPlanManual SIGUE ganando: sólo lo usan el wizard de Ganado y la API guardar_cuotas, que cierran la venta y lo avisan. Ninguno de los dos borra e inserta.
- Link por cuota habilitado: crearCobroAction acepta pagoId. crearCobro valida la cuota (de ese lead, impaga, sin pasarela), devuelve el link vivo si ya hay uno y fija el valor en USD = el de la cuota. registrarCobroDeProveedor la salda por id sólo si el monto coincide, y marcarPago corta su cobranza.
- Renovaciones: el rechazo se escribe con la constante PREFIJO_RENOVACION_FALLIDA, y la próxima renovación que entra lo borra.
- app/crm/[id]/pagos-campo-actions.ts (nuevo): 11 acciones. Todas cortan sin sesión y leen el lead del negocio de la sesión; la moneda y el estado de la suscripción, sólo el admin. Dejan el diff y el actor en el historial y devuelven su Deshacer.
- deal-actions.ts: todas las acciones cortan sin sesión. saveDealSectionsAction mergea con la base y el doc_path siempre sale de la base.
- API de MaKo: 9 ops en cobros.def/run (chat), rutas REST, docs y snapshot regenerados; cobranza_lead devuelve `cobrado`.
- Migración XXXX: pagos.concepto, pagos.metodo y leads.suscripcion_cancelada_at.
No corrí tsc (la consigna lo prohíbe; había 1,9 GB libres): hice un chequeo de sintaxis con esbuild y revisé los tipos a mano.

**Commits**
- `f3a36ffa3` Pagos campo por campo: las reglas puras y lo cobrado del lead, con tests
- `38b411d00` Pagos: las cuotas se reconcilian por id y una cuota se cobra con su propio link
- `10d1ec828` Pagos: las server actions campo por campo, y Editar deal deja de ganar el lead
- `ae3a0e52d` API de MaKo: Pagos campo por campo en el área cobros, y cobranza_lead con lo cobrado
- `0952106fc` Pagos campo por campo: el test del historial de una reconciliación

**Contrato para la tanda B2**

No armé el motor ni el armador de bloques. Esto es lo que van a llamar los bloques de Pagos de la B2:
app/crm/[id]/pagos-campo-actions.ts ('use server'; todas devuelven {ok:false,error,faltan?} si fallan):
- guardarCampoDealAction(leadId, CambioCampoDeal) → {ok,cambio,antes,despues}. CambioCampoDeal = {seccion:'fiscal'|'servicio'|'promesa', campo, valor:string|null} | {seccion:'lead', campo:'fecha_inicio_servicio'|'facturado_por_id', valor}. Deshacer = llamarla con `antes`.
- guardarObligacionAction(leadId, CambioObligacion) → {ok,obligaciones:{cliente[],prestador[]},deshacer}. CambioObligacion = {accion:'agregar',parte,texto,indice?} | {accion:'editar',parte,indice,texto,esperado} | {accion:'quitar',parte,indice,esperado}.
- guardarVentaAction(leadId, CambioVenta, {tipoVisto?}) → {ok,cambio,ventaTipo,deshacer:CambioVenta[]}. CambioVenta = {campo:'monto'|'plazo', valor:number|null} | {campo:'fecha', valor:string|null} | {campo:'tipo', valor:'unico'|'suscripcion'|'sin_cobro'}.
- editarCuotaAction(leadId, pagoId, {monto?,fecha?}) → {ok,antes:{monto,fecha},despues}.
- guardarCuotasAction(leadId, [{id?,monto,fecha}], plan?) → {ok,actualizadas,nuevas,quitadas,sinTocar}.
- ajustarPlanAction(leadId, Partial<PlanUniforme>) → lo mismo + deshacer:{cuotas,plan}. PlanUniforme = {cobro_inicial_usd,monto_cuota_usd,total_cuotas (1-6),dia_de_pago (1-28)}.
- cortarRecordatoriosCuotaAction(leadId, pagoId) → {ok,cortados}. No se deshace.
- cambiarEstadoSuscripcionAction(leadId, 'cancelada'|'activa', {mesesAlReactivar?}) → {ok,cambio,deshacer}. Sólo el admin.
- monedaDelNegocioAction() → {moneda,puedeEditar}; guardarMonedaNegocioAction(moneda) → sólo el admin.
- cobradoDelLeadAction(leadId) → {ok,cobrado:Cobrado}.
app/crm/[id]/deal-actions.ts: marcarPagoManualAction(pagoId, leadId, {monto? USD, fecha, hora?, resto?, moneda?, montoOriginal?, concepto?, metodo?}) y registrarPagoSueltoAction(leadId, {monto USD, fecha, hora?, moneda?, montoOriginal?, concepto?, metodo?}). Sin moneda es USD. quitarSinCobroAction no cambia.
app/crm/[id]/cobros-actions.ts: crearCobroAction(leadId, {...DatosCobro, pagoId?}) → {ok,link,prueba,yaEstaba?}.
lib/cobrado-lead.ts (pura): cobradoDelLead(EntradaCobrado {ventaTipo, montoCierreUsd, suscripcionMontoUsd, suscripcionMeses, fechaCierre, suscripcionCanceladaAt?, pagos, cobros?, hoy}) → Cobrado {seDibuja, tipo, cobradoUsd, totalUsd, pendienteUsd, vencidoUsd, pct, texto, semaforo:{tono:'verde'|'ambar'|'rojo'|'gris', texto}, proxima, cuotas:{total,cobradas,vencidas,porVencer}, suscripcion|null {estado:'activa'|'cancelada'|'terminada', mensualidadTexto, finPlazo, proximaRenovacion, renovacionFallida, fuente, sinRegistrar}, monedas, cuadra}. También esCuotaDevuelta y ddmm.
lib/pagos-campo.ts (pura): CAMPOS_DEAL, CAMPOS_LEAD_DEAL, SECCIONES_DEAL, rotuloCampoDeal, METODOS_PAGO, ROTULO_METODO, MONEDA_POR_DEFECTO, validarPlan, cuotasDelPlan, nombreCuota, obligacionesDe.

**API de MaKo**
- ver_moneda_negocio (lectura, GET /cobros/moneda)
- cambiar_moneda_negocio (chat, admin, PUT /cobros/moneda)
- editar_dato_deal (chat, PATCH /cobros/deals/{leadId}): sección fiscal|servicio|promesa|lead, campo, valor; merge
- editar_obligacion_deal (chat, PATCH /cobros/deals/{leadId}/obligaciones): parte, accion agregar|editar|quitar, renglon (desde 1), texto
- editar_venta_lead (chat, PATCH /cobros/ventas/{leadId}): tipo, montoUsd, plazoMeses, fechaCierre, con compare-and-set sobre el tipo
- editar_cuota (chat, PATCH /cobros/cuotas/{cuotaId}): montoUsd, vence; revisa la protección fail-closed
- crear_link_cuota (chat, externo, POST /cobros/cuotas/{cuotaId}/links-pago): Stripe por el monto exacto de la cuota
- cortar_recordatorio_cuota (chat, DELETE /cobros/cuotas/{cuotaId}/recordatorios)
- estado_suscripcion_manual (chat, admin, PUT /cobros/ventas/{leadId}/suscripcion): cancelada|activa
- cobranza_lead (crm, cambiada): suma `cobrado` (texto, estado, tono, totales, próxima, suscripción con renovación fallida, otras monedas, no_cuadra) y `cobrada_en` por cuota

**Migraciones (numerar al integrar)**
- supabase/migrations/XXXX_pagos_manual_suscripcion_cancelada.sql — pagos.concepto (≤200) y pagos.metodo (≤40), con su CHECK de largo, y leads.suscripcion_cancelada_at timestamptz. ORDEN: antes o junto con el deploy (la cabecera dice qué pasa si todavía no corrió). Se puede volver a correr.

**Tests**
- tests/pagos-campo.test.ts: 13 pasan / 0 fallan. Probado rompiéndolo: 12 roturas, todas caen (12/1; 10/3 y 9/4 en número y protegidas)
- tests/cobrado-lead.test.ts: 11 / 0. Probado rompiéndolo: 9 roturas, cada una cae (10/1; 9/2 con monto_cierre pelado)
- tests/pagos-escritura.test.ts: 7 / 0. Probado rompiéndolo: 10 roturas sobre lib/pagos.ts y lib/cobros.ts, cada una 6/1
- tests/api-mako-pagos-campo.test.ts: 6 / 0. Probado rompiéndolo: 7 roturas, cada una 5/1
- tests/acciones-sin-sesion.test.ts: 6 / 0. El barrido nuevo de sesión de las dos puertas de Pagos, probado rompiéndolo: 5/1 en cada una
- tests/cobranza.test.ts: 13 / 0 — rotura: Ya fallaba en la base: el recorte de marcarPago medía 6.777 caracteres desde ba199cb49. Ahora mide sólo marcarPago (cambio a propósito, comentado)
- tests/crm-cuota-cobrada.test.ts: pasa; el ancla cambia a propósito de saveLeadPlanManual( a guardarCuotasPorId( y suma un doesNotMatch
- tests/api-mako-cobros.test.ts: pasa; a propósito cambian la lista exacta del área (+9 IDS_PAGOS_CAMPO) y el conteo fijo de seguro() (ahora todo ejecutar() tiene que ir envuelto)
- guards con ls-files (55 archivos, en 2 lotes): 597 pasan / 1 falla — rotura: integracion-sin-salir falla en la BASE por dos archivos de otro frente: app/landing-generator/editor/dialogos/DialogoPublicar.tsx y app/landing-generator/editor/nodos/CobroBoton.tsx
- api-mako-registro, rest, curso, dashboard, landing-editor, creaciones, oferta-del-lead, ruta-automations, agenda-*, lead-producto, flujo-acciones-bordes, sugerencias-crm, datos-comercial, admin-cobros, cobros-servicio, cobros-reglas, pasarela-sin-env, link-con-workspace, campana-producto, venta-sin-cobro, crm-curso-al-ganar, ganado-monto, pagos-diferencia, updatelead-no-borra-venta, cobros-contrato, crm-campo-inline, alta-cliente, aviso-evento, datos-mensaje: todos pasan (0 fallos). api-mako-landing-editor tiene un `todo` BLOQUEANTE que ya estaba (esPedidoDeLanding)

**Pendientes**
- app/crm/[id]/DealDetailsCard.tsx:348-359 y :545-570 — reemplazar la cuenta local por cobradoDelLead (lib/cobrado-lead.ts), que corrige «Pagada por completo» en una mensualidad activa y la renovación rechazada en verde. Lo mismo en la ficha de CS (app/customer-success/FichaPestanas.tsx, que monta la misma tarjeta).
- app/crm/[id]/DealDetailsCard.tsx:886 y :982 (Marcar pagada / Registrar pago) — pedir moneda, monto original, concepto y método, con monedaDelNegocioAction() como valor inicial. Las acciones ya los aceptan. Y pasarle pagoId a CobrarConLink para «cobrar esta cuota con link».
- lib/leads.ts:175 — sumar `suscripcion_cancelada_at?: string | null` al tipo Lead (hoy se lee con un cast).
- lib/api-mako/areas/crm.def.ts:555 y :570 + crm.run.ts:1054 y :1101 — marcar_pago_cobrado y registrar_pago_suelto: exponer moneda, montoOriginal, concepto y metodo (cobrarCuota y registrarPagoSuelto ya los reciben). Está fuera de mi alcance.
- lib/api-mako/areas/crm.def.ts:202 — la descripción de cobranza_lead tiene que nombrar el bloque `cobrado` nuevo (estado, semáforo, renovación fallida, próxima), para que el modelo lo use.
- lib/mako-intencion.ts (areasDelMensaje/esPedidoDeCobro) — rutear al área cobros frases como «cambiale el vencimiento a la cuota 3» o «mandale el link de la cuota 2»: las 9 ops nuevas sólo viajan cuando el mensaje ya nombra un link de pago.
- supabase/migrations/XXXX_pagos_manual_suscripcion_cancelada.sql — numerarla al integrar, ANTES o junto con el deploy.
- Pantalla de la moneda del negocio en /configuraciones: existen monedaDelNegocioAction y guardarMonedaNegocioAction (admin), falta el selector.
- app/crm/[id]/deal-actions.ts saveIdentidadFiscalAction/deleteIdentidadFiscalAction — sólo les puse el corte de sesión; falta decidir si, por ser config del negocio, son sólo del admin.
- lib/pagos.ts:896 getOutstandingTotal cuenta como deuda las cuotas DEVUELTAS (impagas, sin fecha y con proveedor) y getOutstandingPeriodo no: los dos números no coinciden.
- Guardar la próxima renovación que manda la pasarela (§5 del diseño): cobradoDelLead hoy la proyecta desde fecha_cierre.
- Sacar «Editar deal →» (LeadSheet.tsx:304) y ?edit=1 al cierre de la tanda: lo hace otro frente cuando los bloques estén montados.

**Hallazgos (a cosechar)**
- El diagnóstico obvio era el equivocado. Síntoma: crearCobroAction bloqueaba el pagoId «porque registrarCobroDeProveedor no mira de qué lead es la cuota». Causa: eso ya se había cerrado el 11/10 (`.eq('lead_id', p.leadId)`, lib/pagos.ts). Los riesgos que quedaban eran otros: (1) saveLeadPlanManual borraba e insertaba las impagas, así que el pago_id del link quedaba en null por el FK; (2) saldar por id marcaba la cuota pagada por SU monto y no por el del link. Regla: el link de una cuota cobra la cuota (montoUsd = cuota.monto_usd) y se salda por id sólo si el monto coincide (mismoMonto).
- Síntoma: después de guardar «Editar deal», el recordatorio de una cuota seguía saliendo aunque ya estuviera pagada, y la cuota volvía a entrar en la cobranza. Causa: saveLeadPlanManual (lib/pagos.ts) borraba e insertaba todas las impagas, cada cuota cambiaba de id, la corrida quedaba con un ctx.cuotaId huérfano que marcarPago no corta, y el dedup `cuota:${pago_id}` (lib/cobranza.ts) era nuevo. Regla: ningún escritor de `pagos` borra e inserta; se reconcilia por id con reconciliarCuotas, y una cuota con link vivo o recordatorio abierto no se borra ni cambia lo que no puede. Un solo delete en lib/pagos.ts (lo fija tests/pagos-escritura.test.ts).
- Síntoma: una renovación rechazada seguía pintada como fallida después de que la tarjeta volvió a pasar. Causa: aplicarPagoAprobado sólo toca el cobro en el paso 1 si pasaAPagado (pendiente/fallido/anulado); una suscripción ya «pagado» nunca limpiaba el motivo que dejó aplicarPagoFallido (lib/cobros.ts). Regla: la renovación que entra borra el motivo con PREFIJO_RENOVACION_FALLIDA, la misma constante con que se escribe y se lee. Los cobros viejos con el motivo pegado se ven fallidos hasta la próxima renovación.
- Síntoma: ninguno visible. Causa: `pagos.lead_id` sólo tiene FK a leads(id) y getTenantDb estampa el workspace en el insert, así que con el id de un lead de OTRO negocio la cuota entraba en el cash de éste apuntando a una persona ajena, sin error (registrarPagoSuelto, las cobradas de saveCuotasAction, la reconciliación). Regla: asegurarLeadDelNegocio(leadId) antes de insertar en pagos.
- Ninguna acción de app/crm/[id]/deal-actions.ts cortaba sin sesión: sin cookie, getWorkspaceActual() cae al ws1 y escribían cuotas y pagos en su CRM. Regla: haySesion() en TODA export async function de las dos puertas de Pagos, con un barrido que nombra la que se olvide (tests/acciones-sin-sesion.test.ts).
- Mergear en el server no alcanzaba para el documento fiscal. Causa: DealDetailsCard manda deal_fiscal con el doc_path de SU foto del lead (`{ ...(lead.deal_fiscal ?? {}), ... }`), y la foto vieja lo pisa igual. Regla: doc_path/doc_nombre los escribe sólo /api/extract-deal-fiscal; saveDealSectionsAction los saca del patch y gana el de la base.
- La moneda del negocio no existía en ningún lado (todo asumía USD). Va en app_settings 'negocio.moneda' (lib/pagos.ts, monedaDelNegocio). Y un pago SIN moneda se lee como USD, no como la moneda del negocio: las pantallas viejas mandan dólares sin decirlo, y el día que un negocio configure MXN, 500 USD se habrían guardado como 500 pesos. La moneda del negocio la pone la pantalla como valor inicial.
- tests/cobranza.test.ts fallaba en la base desde el 13/10 (ba199cb49): el recorte de marcarPago iba hasta sincronizarTotalCobrado y en el medio quedaron cobrarCuota y registrarPagoSuelto (6.777 caracteres, el tope era 3.000). Regla de los guards que leen el fuente: recortar hasta el próximo `\nexport `, no hasta un nombre que puede alejarse.
- Entorno: en este worktree los archivos están en CRLF (core.autocrlf=true) y el índice en LF, y `grep $'\r'` de Git Bash dice que no hay CR (mintiendo); `file` y node sí lo ven. Un script que reemplaza texto de varias líneas tiene que adaptar \n → \r\n. El Edit tool ya lo hace.
- Entorno: el scratchpad es COMPARTIDO entre los agentes de la corrida. Mientras trabajaba, otros frentes pisaron mis msg1.txt y msg2.txt con sus mensajes de commit. Mis commits salieron bien porque el archivo se leyó antes, pero los nombres tienen que ser únicos por frente.
- Para que dos pestañas no se pisen al mergear un jsonb, el CAS sobre leads.updated_at (trigger de la mig 0001) con 3 reintentos alcanza sin una RPC ni una migración. La suscripción manual sí necesitó una columna (suscripcion_cancelada_at) para distinguir «cancelada» de «terminó su plazo»; el MRR deja de contarla igual que a la de la pasarela, por suscripcion_meses.

**Riesgos**
- No corrí tsc (lo prohíbe la consigna; había 1,9 GB libres). Sólo pasé esbuild para la sintaxis y revisé los tipos a mano: quien integra tiene que correr el tsc acotado sobre lib/pagos.ts, lib/cobros.ts, lib/pagos-campo.ts, lib/cobrado-lead.ts, las dos actions y los dos .run.ts.
- proteccionesDeCuotas usa `.in('ctx->>cuotaId', ...)` sobre flujo_corridas. El `.eq` sobre esa ruta ya anda en cerrarCorridasDeCuota, pero el `.in` no lo vi correr contra la base. Si PostgREST lo rechaza, falla cerrado y bloquea guardar cuotas o planes (incluidos savePlanPagos y el wizard de Ganado): no se pierde nada, pero no deja guardar. Hay que probarlo en staging.
- escribirConCas compara leads.updated_at tal como vuelve de PostgREST. Si la comparación no cuadrara, después de 3 vueltas contesta «El lead cambió» y bloquea editar el deal campo por campo (sin perder datos).
- Editar deal ya no gana el lead al guardar cuotas: quien cerraba ventas así ahora tiene que mover la etapa.
- Una cuota que se quita en Editar deal y tiene un link vivo o un recordatorio abierto se conserva: vuelve a aparecer y el porqué queda sólo en el historial, porque EditarDeal no muestra el retorno.
- savePlanPagos puede tirar donde antes no tiraba (si no puede leer las protecciones). Lo usan el wizard de Ganado, savePlanPagosAction y la API guardar_plan_pagos.
- Si se cobra a mano de menos una cuota que tiene un link vivo, su monto cambia, y cuando el link se pague entra como cuota nueva: la plata se ve dos veces, a la vista.
- La migración XXXX tiene que ir ANTES o junto con el deploy. Sin ella: concepto y método se pierden en silencio (update aparte que no tira) y «Cancelar suscripción manual» contesta error.
- Las cuotas sin ids que llegan del wizard y de la API guardar_cuotas se casan por orden con las impagas libres: una cuota «cambiada» reusa el id de una que no tenía link ni recordatorio. Es correcto, pero en el historial esa cuota aparece con su número viejo.

## b4 · captura de datos (wtc-b4)

Las ingestas guardan ahora tres datos que antes se perdían, y MaKo lee la ficha igual que el equipo.

1. Instagram/Messenger (lib/zernio-entrante.ts → crearLeadDe):
   - El lead nace con su @ (`instagramDelEvento`), solo si entra por Instagram: en Messenger el usuario es el de Facebook.
   - El anuncio de un DM pagado queda en `meta_ad_id`.
   - Cómo entró queda en la columna nueva `leads.entrada_social`, una sola vez, al crear el lead (`entradaSocialDe`). Trae el comentario con su publicación, lo que escribió (la palabra clave), la historia, el DM, el anuncio y el ref.
   - El alta deja una línea en el historial: campo «Entrada», autor Instagram o Messenger. Solo la deja el lead que ganó el compare-and-set.
2. `createLead` ahora escribe `meta_ad_id`: estaba en el tipo de entrada y nunca llegaba al insert. También escribe `pagina_registro` y `entrada_social`. Si falta la migración, reintenta una sola vez sin esas dos columnas, y solo cuando el error nombra una de ellas (lib/lead-alta-columnas.ts).
3. El opt-in (app/api/track/optin) guarda la página normalizada donde se registró la persona (`pagina_registro`) en el alta directa. En la propuesta la manda dentro de `datos.leads[]`, para que la escriba quien confirma.
4. MaKo (lib/mako-tools.ts más el módulo puro nuevo lib/mako-ficha-lead.ts):
   - La etapa sale de `etapaVigenteDe` contra `getPipelineStagesDeLead`, con DEFAULT_STAGES si la lista viene vacía, igual que la ficha, y con su nombre. Antes era `pipeline_stage` crudo.
   - `ficha_lead` suma, solo si tienen valor: web, redes, dirección, sexo, ingreso estimado (oculto en un ganado), tipo de venta y suscripción, oferta, página de registro, entrada social y la baja de los emails.
   - Suma `formulario_landing` al lado de `formulario_meta`.
5. Tipo `Lead`: suma `junta_1_url`/`junta_2_url`, `email_opt_out`, `oferta_id` (migración 0272, también faltaba), `pagina_registro` y `entrada_social`. `LISTA_COLS` no cambia, a propósito.
6. Dos migraciones nuevas:
   - 0290_lead_entrada: las dos columnas. Va ANTES o junto con el deploy.
   - 0291_lead_instagram_desde_ig: completa el @ de los leads viejos. Va DESPUÉS del deploy.

**Commits**
- `6b11f7602` CRM (tanda B, datos): el lead guarda cómo entró — su @, la entrada social y la página del opt-in
- `cab2e72d3` MaKo (tanda B del CRM): ficha_lead lee lo que el equipo ve en la ficha, y la etapa efectiva

**Contrato para la tanda B2**

Lo que este frente deja para los bloques de B2. No es el motor ni el armador: son los datos y sus lectores.

lib/leads.ts, tipo Lead (getLead lee con `*`; LISTA_COLS NO los trae):
  pagina_registro?: string | null        // URL normalizada del opt-in; el «cuándo» es created_at
  entrada_social?: unknown               // NUNCA crudo: entradaSocialGuardada(lead.entrada_social)
  instagram?: string | null              // sin la @, en minúsculas
  meta_ad_id: string | null              // también el anuncio de un DM pagado de Instagram/Messenger
  junta_1_url?, junta_2_url?: string | null
  email_opt_out?: boolean | null
  oferta_id?: number | null

lib/canal-social.ts (puro, se puede importar desde el cliente):
  type EntradaSocial = { canal: 'instagram'|'messenger'; como: SubtipoSocial; at?: string; cuenta_id?: string;
    post_id?: string; comentario_id?: string; texto?: string /* el comentario, tope 280 */; ref?: string; anuncio_id?: string }
  entradaSocialGuardada(v: unknown): EntradaSocial | null   // null = no entró por redes
  COMO_ENTRO: Record<SubtipoSocial, string>                 // «Comentó tu publicación», «Tocó tu anuncio»…
  lineaDeEntradaSocial(en): string                           // la línea corta del historial
  instagramDelEvento(e), entradaSocialDe(e)                  // las usa el alta de Zernio
  // ¿«ya le contestaste por privado»? = ig_conversaciones.comentario_id === entrada.comentario_id && comentario_respondido_at

Historial: el alta por Instagram o Messenger escribe lead_audit { campo: 'Entrada', autor: 'Instagram'|'Messenger' }.
El backfill escribe { campo: 'Instagram', autor: 'Instagram' }.

lib/mako-ficha-lead.ts (puro):
  etapaParaModelo(l, etapas?) → { etapa, etapa_nombre }   // con DEFAULT_STAGES si viene vacía, como la ficha
  datosDeLaFicha(l, oferta?), landingParaModelo(v) → { formulario_landing: [{pregunta,respuesta}] | null }

lib/lead-alta-columnas.ts: COLUMNAS_NUEVAS_DEL_ALTA = ['pagina_registro','entrada_social']. Una columna nueva que escriba el alta se suma acá.

**API de MaKo**
- ficha_lead (cambia la salida, la op sigue igual): `lead.etapa` pasa a ser la etapa efectiva (etapaVigenteDe contra getPipelineStagesDeLead) y suma `lead.etapa_nombre`. Solo si tienen valor: web, instagram, youtube, linkedin, direccion, sexo, ingreso_estimado_usd, venta_tipo, suscripcion_mensual_usd, suscripcion_meses, oferta, pagina_registro, entrada_social, email_dado_de_baja. Y `formulario_landing` arriba, al lado de `formulario_meta`. La descripción de MAKO_TOOLS está actualizada; la de crm.def.ts queda pendiente para otro frente.
- buscar_leads (cambia la salida): `etapa` efectiva contra las etapas del negocio, leídas una vez, y `etapa_nombre`.

**Migraciones (numerar al integrar)**
- supabase/migrations/0290_lead_entrada.sql: `leads.pagina_registro text` y `leads.entrada_social jsonb`. ORDEN: ANTES o JUNTO con el deploy. Si llega tarde, el lead entra igual, sin esos dos datos, por el reintento de createLead.
- supabase/migrations/0291_lead_instagram_desde_ig.sql: backfill de `leads.instagram` desde `ig_conversaciones.username`, con estas reglas: solo `plataforma = 'instagram'`; solo donde el @ está vacío; con la regla de usuarioDeTexto; mismo workspace; la conversación del último mensaje. Deja su línea en `lead_audit` con `workspace_id` explícito. ORDEN: DESPUÉS del deploy; es idempotente.

**Tests**
- tests/crm-entrada-social.test.ts (nuevo): 11 pass / 0 fail — rotura: 14 roturas, una por vez y restaurando: R1 (Messenger sin corte), R4, R6, R7, R8, R9 (la línea del historial antes del compare-and-set), R10 (sin meta_ad_id), R11 (sin reintento), R12, R13 (el backfill sin plataforma) y R14 (lead_audit sin workspace_id) dan 10/1 cada una; R2, R3 y R5 dan 9/2. Restaurado: 11/0.
- tests/mako-ficha-lead.test.ts (nuevo): 6 pass / 0 fail — rotura: 8 roturas: M1 (etapa cruda), M2 (sin DEFAULT_STAGES), M3, M4 (estimado en un ganado), M6, M7 y M8 (etapas del negocio en vez de las del lead) dan 5/1; M5 (campos vacíos como null) da 4/2. Restaurado: 6/0.
- tests/mako-ficha-formulario.test.ts: 4 pass / 0 fail — rotura: La regex del return de ficha_lead se cambió A PROPÓSITO, con comentario en el test. Lo que cuida (formulario_meta en la salida) sigue igual.
- 122 archivos: los tests que leen zernio-entrante, canal-social, track/optin, mako-tools y lib/leads, más todos los guards con ls-files: 1579 tests: 1577 pass / 1 fail — rotura: La única falla es de antes de este frente: tests/integracion-sin-salir.test.ts, «el barrido: ningún link a /integraciones fuera de la lista». La causan app/landing-generator/editor/dialogos/DialogoPublicar.tsx y app/landing-generator/editor/nodos/CobroBoton.tsx, que este frente no toca.
- scripts/generar-api-doc.mjs --check: docs/api-mako.md y tests/api-mako-http.snapshot.txt al día (no se tocó ninguna def)

**Pendientes**
- lib/api-mako/areas/crm.def.ts:~81 (op `ficha_lead`, campo `descripcion`): sumar lo que ahora devuelve, que son `etapa_nombre`, `formulario_landing` (null = nada guardado) y, solo si están cargados, web/instagram/youtube/linkedin/direccion/sexo, `ingreso_estimado_usd` (oculto en un ganado), `venta_tipo` con `suscripcion_mensual_usd`/`suscripcion_meses`, `oferta {id,nombre,ticket_usd,modelo}`, `pagina_registro`, `entrada_social {canal,como,cuando,comento,publicacion_id,ref,anuncio_id}` y `email_dado_de_baja`. También: «No trae cobranza…» sigue valiendo. Y en `buscar_leads` (:~73) agregar `etapa_nombre`. Después regenerar con generar-api-doc y generar-plugin. Los tests no lo frenan: el de formulario sigue pidiendo solo «formulario de Meta (formulario_meta».
- app/crm/revisar/[id]/propuesta-lead.ts:~73-106 (`Atribucion` y `atribucionDePropuesta`): copiar `c.pagina_registro` (ya normalizada por la ruta; volver a pasarla por `normalizarUrl` porque se lee de la base) a `a.pagina_registro`. Sin eso, el lead que nace al confirmar una propuesta de la landing queda sin página. Ojo: el update de app/crm/revisar/[id]/acciones.ts:~76 nombra las columnas que se le pasan, así que sin la migración 0290_lead_entrada ese update falla.
- Quien integra: poner el número a las dos migraciones y reemplazar «0290_lead_entrada» en lib/leads.ts (comentario y console.warn de createLead), lib/lead-alta-columnas.ts y el comentario del tipo Lead. Y además en tests/crm-entrada-social.test.ts, que LEE los dos .sql por su nombre (`../supabase/migrations/0290_lead_entrada.sql` y `0291_lead_instagram_desde_ig.sql`): sin cambiarlo, el test se rompe al renombrar. Orden: 0290_lead_entrada ANTES o junto con el deploy; 0291_lead_instagram_desde_ig DESPUÉS (es idempotente).
- lib/zernio-entrante.ts (procesarEventoSocial, rama `yaEraLead`): Meta manda primero el mensaje del anuncio SIN referral y el referral en el mensaje siguiente. Si escucha «Te envía un mensaje», el lead nace con `como: 'mensaje'` y el anuncio del mensaje siguiente se pierde. Arreglo posible: un update compare-and-set de `meta_ad_id` y de `entrada_social.anuncio_id` con `.is(null)` cuando `yaEraLead && e.anuncioId`. No se hizo: es una escritura más por evento y una decisión de atribución.
- El comentario previo al lead: si la persona comentó sin que ninguna automatización escuchara y después escribió por DM, `entrada_social` dice «mensaje», y el comentario sobrevive en `ig_conversaciones.comentario_*` solo hasta el próximo comentario. El bloque `publicacion-de-entrada` puede caer a esa fila.
- lib/mako-analyst-lead-reglas.ts:75 (`ficha_lead`, tope 5_000): con los campos nuevos y `formulario_landing`, una ficha cargada puede cortar `formulario_meta`/`formulario_landing`, que van al final. Hay que revisar el tope o el orden.
- Leads viejos sin `pagina_registro`: no hay backfill a propósito (por dónde pasó no es dónde se registró). El bloque `pagina-de-registro` puede caer a `landing_visits.landing_url` por `visitor_id`, como dice el doc.
- Messenger: no hay columna para el usuario de Facebook. Si un bloque lo quiere, hace falta una columna nueva (no `instagram`).

**Hallazgos (a cosechar)**
- Los saltos de línea: el worktree es CRLF (core.autocrlf=true; el índice es LF), pero `grep -c $'\r'` en Git Bash devuelve 0 sobre esos archivos. Lo medí: mi primera detección dijo «LF» y el arnés de roturas daba «NO APLICA» en toda rotura con salto de línea. Con node se ven 667 CRLF y 0 LF solos en lib/canal-social.ts. Regla: el EOL se mide con node o con `git ls-files --eol` (i/lf w/crlf), nunca con grep de Git Bash. Los archivos nuevos se pasaron a CRLF.
- El anuncio de un DM pagado → el comentario de lib/zernio-entrante.ts decía que «viaja en el `ctx` del disparador» → mentira: `dispararEventoSocial` manda solo `{ subtipo }`, así que el anuncio no quedaba en ningún lado. Regla: un comentario que dice dónde «sigue viajando» un dato se verifica contra el call site.
- createLead tenía `meta_ad_id` en LeadCreateInput y no en el insert: el mismo patrón que el `visitor_id` de agosto. Que un campo esté en el tipo de entrada no prueba que se escriba. Regla: un campo nuevo del alta se prueba sobre el insert, no sobre el tipo.
- `eventoSocialDe` (lib/canal-social.ts) pone el 1/1/1970 como fecha cuando el cuerpo no trae timestamp. Le sirve a la ventana de 24 h (que quede cerrada), pero persistido como «cuándo entró» es un dato inventado. Regla: todo lo que guarde `e.fecha` como fecha de un hecho mira que sea > 0.
- El @ de Messenger: el doc dice «el @ de Instagram en el lead que entra por Instagram o Messenger», pero en Messenger el usuario es el de Facebook (`plataformaDe('messenger') = 'facebook'`). En `leads.instagram` linkearía al perfil de otra persona. Ganó lo medido: el @ se guarda solo de Instagram, en el alta y en el backfill.
- `lead_audit.workspace_id` (y toda tabla del loop de la migración 0054) tiene `default 1`. Un INSERT desde una migración sin `workspace_id` explícito cae al ws1, que es un cliente real (Mauricio). El backfill lo pasa explícito, con test.
- La etapa de «el lead» es hoy la del negocio: `getFunnelDeLead` devuelve `getFunnelDefault()` para todos (lib/funnels.ts:188). La ficha y ahora MaKo usan `getPipelineStagesDeLead`, así que coinciden entre sí, pero un lead cuya casa es un funnel secundario se evalúa contra las etapas del funnel del negocio. Cuando cambie el cuerpo de `getFunnelDeLead`, las dos puertas lo siguen juntas.
- La detección de una columna que falta (PGRST204/42703) ya existe en el repo como `esColumnaInexistente` (lib/nutricion-grafo-motor.ts:843), pero vive en un módulo pesado que lib/leads.ts no debería importar. Se escribió una copia acotada que exige que el mensaje nombre una de las columnas nuevas (lib/lead-alta-columnas.ts). Sin eso, el reintento taparía la falta de otra columna.
- getLead lee con `select('*')`, así que las columnas nuevas no rompen la ficha ni el panel aunque falte la migración. Ponerlas en LISTA_COLS haría que el CRM abra vacío. Hay un test que lo fija.

**Riesgos**
- `meta_ad_id` en los leads de un DM pagado mueve números. Las métricas por anuncio (lib/queries.ts ~1700 «downstream» por meta_ad_id, lib/graficos-datos-extra.ts cierres por anuncio, lib/ads-analyst.ts) empiezan a contar esos leads. Es correcto (los trajo el anuncio), pero el CPL y los cierres de los anuncios click-to-DM cambian. Y el «traer» de campañas (lib/campana-traer.ts) puede agregar esos leads al producto de su campaña.
- El backfill del @ deja una línea «Instagram» (autor Instagram) en el historial de cada lead que completa. Se ve en la ficha.
- El reintento sin las columnas nuevas depende de la forma del error de PostgREST (PGRST204 o 42703, con el nombre de la columna en el mensaje). Si la forma es otra, el alta falla como fallaba antes del reintento, así que no queda peor.
- No corrí tsc, por la regla de memoria. Los tipos se razonaron a mano: el `let { data, error }` reasignado en createLead, Stage → EtapaParaModelo y Lead → LeadParaModelo.
- Renombrar las migraciones XXXX sin tocar tests/crm-entrada-social.test.ts rompe ese test, porque lee los .sql por su nombre.

## Revisión de b2 · Pagos

**Veredicto:** No está para integrar tal cual. Hay dos fallas altas, las dos de plata y las dos invisibles: (1) ajustarPlanAction recibe un Partial<PlanUniforme> pero lo trata como el plan entero, y un bloque que mande sólo el campo que cambió borra cuotas o corre todos los vencimientos al día 1; (2) el modo 'lista' de saveLeadPlanManual (lo usan el wizard de Ganado y la API guardar_cuotas) duplica la deuda cada vez que una cuota protegida no se puede tocar, y la API igual contesta «Listo». Hay además seis medias: el dedup por id deja sin recordatorio a una cuota reprogramada; el link de una cuota sigue vivo después de cobrarla a mano; pasar a becado deja la deuda y la cobranza andando; una pantalla vieja borra cuotas que no vio; Editar deal ignora en silencio lo que no puede cambiar; reactivar una suscripción manual pierde su plazo. Lo que pidió la consigna está bien cubierto: no se borra e inserta, cobros.pago_id se conserva, hay corte de sesión en las tres puertas y de rol en la moneda y la suscripción, el merge conserva doc_path y lo cobrado no lee monto_cierre_usd pelado. Corrí los 8 archivos de tests de la rama: 78 pasan y 0 fallan. Pero son guards sobre el fuente o tests puros, y ninguno prueba un plan parcial, la duplicación en 'lista' ni el dedup de una cuota que cambió de fecha. Los dos casos altos los reproduje con un script contra lib/pagos-campo.ts. No escribí nada en el repo (la consigna era sólo leer). La cosecha queda pendiente para quien integre: va en docs/hallazgos-crm.md, que es donde viven lib/pagos.ts y lib/pagos-campo.ts (o en un docs/hallazgos-pagos.md nuevo, sumado al índice docs/hallazgos.md en el mismo commit).

- **[alta]** `app/crm/[id]/pagos-campo-actions.ts:208-226 (y lib/pagos-campo.ts:468-494)` ajustarPlanAction se declara y se entrega en el contrato como (leadId, Partial<PlanUniforme>), pero validarPlan llena con null lo que no vino y ajustarPlanPagos lo escribe como el plan COMPLETO: pone en null las columnas que faltan, usa el día 1 cuando falta el día de pago (`plan.dia_de_pago ?? 1`) y reconcilia por número, así que borra las cuotas que el plan parcial ya no nombra.
  - Escenario: Lead con inicial 1.000 más 3 cuotas de 1.000 que vencen el 15. El bloque `cuotas` cambia sólo el inicial: ajustarPlanAction(id, {cobro_inicial_usd: 500}). Resultado (lo reproduje): la cuota 0 queda en 500, las cuotas 1, 2 y 3 se BORRAN, y monto_cuota_usd, total_cuotas y dia_de_pago quedan en null: la deuda pasa de 4.000 a 500. Otro caso: con {monto_cuota_usd: 1200, total_cuotas: 3} se borra el inicial impago y los tres vencimientos se corren del 15 al 01. Lo único que avisa es una línea en el historial.
  - Arreglo: Mergear el parcial con el plan que está en la base (leer cobro_inicial_usd, monto_cuota_usd, total_cuotas y dia_de_pago del lead) antes de validarPlan. Si se quiere un reemplazo entero, cambiar la firma a PlanUniforme completo y rechazar las claves ausentes. Sumar un test que pase un plan parcial y exija que no se borre nada.
- **[alta]** `lib/pagos-campo.ts:383-397 (lo usan lib/pagos.ts:292, lib/api-mako/areas/crm.run.ts:1624 y app/crm/actions.ts:610)` En el modo 'lista' (saveLeadPlanManual: wizard de Ganado y API guardar_cuotas), la segunda pasada casa por orden sólo con cuotas NO protegidas. Una deseada que correspondía a una cuota protegida termina en `insertar`, y la protegida queda en `conservar`: la deuda se cuenta dos veces. La API ignora el PlanDeCuotas que devuelve la función y contesta «Listo: N cuota(s) guardadas».
  - Escenario: (a) Cuotas A 1.000 (vencida, con recordatorio corriendo), B 1.000 y C 1.000. Por MaKo: «dejale 2 cuotas de 1.500» → guardar_cuotas. Reproducido: B y C pasan a 1.500 y A queda en 1.000. Total 4.000 en vez de 3.000, y la cobranza sigue con A. (b) Cuota de 500 con link sin pagar; el wizard la manda con otra fecha: se inserta una cuota nueva de 500 y la del link se conserva. Deuda 1.000 en vez de 500, y la cuota nueva entra a la cobranza: el cliente recibe recordatorios de plata que no debe. En modo 'porId' ese mismo cambio de fecha se aplica bien.
  - Arreglo: En 'lista', casar también con las protegidas y dejar que casar() decida (cambia la fecha si sólo tiene link; si no puede, conserva), en vez de excluirlas e insertar una nueva. Una deseada que no se puede aplicar tiene que ir a conservar, no a insertar. Además, que guardar_cuotas y completeStageMoveAction lean el retorno y digan lo que no se tocó (avisoDeConservadas).
- **[media]** `lib/pagos.ts:303-337 (editarCuota) y escribirReconciliacion; dedup en lib/cobranza.ts:110-114` El dedup de la cobranza es `cuota:${pago_id}` con un TTL de 120 días. Ahora que el id sobrevive a cualquier edición (editarCuota, Editar deal en modo porId), a una cuota que se reprograma no le vuelve a salir el recordatorio: el cron la descarta como «ya entró». Antes, el borrar e insertar le daba un id nuevo y volvía a entrar.
  - Escenario: La cuota 3 vencía el 01/10. Entró a «cuota-vencida» el 02/10 y su cadencia terminó (o se cortó con cortarRecordatoriosCuotaAction). El 05/10 se renegocia y editarCuotaAction le pasa el vencimiento al 01/11. El 31/10 y el 02/11 el cron la ve, pero emitirDelCatalogo la deduplica, porque «cuota-por-vencer» y «cuota-vencida» ya salieron para ese id: el cliente no recibe ningún recordatorio de la fecha nueva.
  - Arreglo: Meter el vencimiento en la clave (`cuota:${pago_id}:${fecha_esperada}`), o limpiar el dedup de esa cuota cuando editarCuota o la reconciliación le cambian fecha_esperada. Sumar un test con una cuota reprogramada.
- **[media]** `lib/pagos.ts:418-457 (cobrarCuota) y 735 (registrarCobroDeProveedor)` Cobrar a mano una cuota que tiene un link sin pagar no anula el link: el link sigue vivo y se puede pagar. Si se paga, registrarCobroDeProveedor encuentra la cuota ya pagada y, como el `if (!p.pagoId)` saltea el casamiento por monto, inserta una cuota NUEVA ya cobrada. El comentario dice «(o salda otra del mismo monto, abajo)», y eso no pasa.
  - Escenario: Se manda el link de la cuota 2 (500). El cliente paga por transferencia y el closer la marca pagada. Días después el cliente abre el link del WhatsApp y paga: Stripe le cobra 500 de nuevo y el CRM suma una cuota cobrada más (total_cobrado 500 de más).
  - Arreglo: En cobrarCuota y marcarPago (pagado = true), anular los cobros pendientes o fallidos que tengan pago_id = esa cuota (anularCobro), o como mínimo avisarlo en la línea del historial. Corregir el comentario.
- **[media]** `lib/pagos-campo.ts:267-274 (patchDeVenta a sin_cobro); escritura en lib/pagos.ts:1199` Pasar la venta a «Sin cobro» (bloque `venta` o API editar_venta_lead) sólo se niega si hay cuotas COBRADAS. Las impagas quedan vivas: getCuotasPendientes no mira venta_tipo, así que la cobranza le sigue recordando a un becado y el Outstanding las cuenta.
  - Escenario: Lead con 3 cuotas impagas de 1.000. Lo declaran becado desde el bloque: venta_tipo = sin_cobro, monto null. Al otro día el cron le manda «cuota vencida» a la persona becada, y el Dashboard sigue mostrando 3.000 por cobrar.
  - Arreglo: Al pasar a sin_cobro, negarlo también con cuotas impagas (que primero las quiten), o quitar en la misma operación las impagas no protegidas y meter su reinserción en el Deshacer. La segunda opción lleva su línea en el historial.
- **[media]** `lib/pagos-campo.ts:399-405 (las impagas que nadie pidió se borran); app/crm/[id]/pagos-campo-actions.ts:170 y app/crm/[id]/deal-actions.ts:342` El modo porId da por quitada cualquier impaga que no vino en la lista. Una cuota que nació DESPUÉS de que la pantalla cargó su foto (el resto pendiente de un pago parcial, una cuota que agregó MaKo) no viene en la lista y se borra.
  - Escenario: Pestaña A abre Editar deal. Desde la pestaña B, o por MaKo con marcar_pago_cobrado, se cobra de menos la cuota 2 y nace la cuota 5 con los 200 que quedan pendientes. La pestaña A guarda un cambio de fecha: guardarCuotasPorId no ve la 5 en la lista y la borra. Los 200 de deuda desaparecen; sólo queda una línea en el historial.
  - Arreglo: Que la pantalla mande los ids que VIO (idsVistos) y borrar sólo esos. Una impaga que no está ni en la lista ni en idsVistos se conserva y se avisa en sinTocar.
- **[media]** `app/crm/[id]/deal-actions.ts:311-356 (saveCuotasAction)` Editar deal guarda con guardarCuotasPorId, que ignora en silencio el monto o la fecha de una cuota con un recordatorio corriendo (y el monto de una con link). saveCuotasAction devuelve void, así que la pantalla dice que guardó.
  - Escenario: Cuota 2 vencida, con recordatorio en curso. El closer la renegocia en Editar deal de 1.000 a 800 y guarda: «Guardado». La cuota sigue en 1.000 y el recordatorio sigue cobrando 1.000. Lo que no se tocó sólo queda en un evento del historial.
  - Arreglo: Devolver avisoDeConservadas(cambios) desde saveCuotasAction y mostrarlo, o tirar con un error que diga qué cuota no se pudo cambiar y por qué (y cómo destrabarla: cortar el recordatorio).
- **[media]** `lib/pagos.ts:616-618 (cambiarEstadoSuscripcionManual); lib/api-mako/areas/cobros.run.ts:574; app/crm/[id]/pagos-campo-actions.ts:296` Cancelar pisa suscripcion_meses con los meses transcurridos y el plazo original no se guarda en ningún lado. Reactivar escribe `mesesAlReactivar ?? null`: la API siempre pasa null, y la pantalla también salvo en el Deshacer inmediato. La def de la API promete «o los devuelve al reactivar». Aparte, revertir desde el historial la línea «Plazo de la suscripción» (que es REVERTIBLE) restaura los meses pero deja suscripcion_cancelada_at.
  - Escenario: Suscripción de 12 meses cancelada en el mes 3 (meses = 3). Días después se reactiva por MaKo: meses = null, o sea mes a mes. El MRR la cuenta para siempre, después del mes 12, y la ficha ya no muestra el fin del plazo. Otro caso: revertir «Plazo 12 → 3» desde el historial deja meses = 12 con cancelada_at puesto. La ficha dice «Cancelada» y el MRR la vuelve a contar.
  - Arreglo: Guardar el plazo previo al cancelar (por ejemplo, una columna suscripcion_meses_antes o el valor en el evento) y restaurarlo al reactivar si no viene otro. Que revertir el plazo de una suscripción cancelada también limpie suscripcion_cancelada_at, o sacar esa línea de REVERTIBLES.
- **[baja]** `lib/cobrado-lead.ts:174-177` suscripcion_cancelada_at le gana a una suscripción de la pasarela ACTIVA, y nadie la limpia cuando entra una suscripción nueva por Stripe o Mercado Pago (ganarLead sólo corre si el lead no estaba ganado).
  - Escenario: Suscripción manual cancelada en marzo. En octubre el cliente vuelve y paga un link de suscripción de Stripe. La ficha y cobranza_lead dicen «Cancelada» en gris, y una renovación que falle después tampoco se pinta roja. suscripcion_meses sigue congelado, así que el MRR no la cuenta mientras Stripe cobra todos los meses.
  - Arreglo: En cobradoDelLead, que activaPasarela tenga precedencia sobre suscripcionCanceladaAt. En aplicarPagoAprobado, para un cobro de tipo suscripción, limpiar suscripcion_cancelada_at y volver suscripcion_meses a null aunque el lead ya esté ganado.
- **[baja]** `lib/pagos.ts:418-445 (cobrarCuota) y etiquetarPago` La moneda, el monto original, el concepto y el método sólo se escriben si vienen, y desmarcar (marcarPagoAction → marcarPago(false)) no los limpia. Una cuota que se cobró en otra moneda, se deshizo y se volvió a cobrar en USD sigue diciendo la moneda vieja.
  - Escenario: Se marca pagada la cuota 2 en MXN 8.600 (USD 500), se deshace y se marca pagada de nuevo sin moneda (USD). La cuota queda con moneda MXN y monto_original 8600: lo cobrado dice «en otras monedas: MXN 8.600», cobranza_lead devuelve cobrada_en MXN y la ficha pinta «(MX$8,600)».
  - Arreglo: Al cobrar sin moneda, escribir moneda y monto_original en null (y lo mismo con concepto y método), o limpiarlos en marcarPago(false) cuando la cuota no es de la pasarela.
- **[baja]** `app/crm/[id]/pagos-campo-actions.ts:184-189 y 239 (el Deshacer de ajustarPlanAction)` El Deshacer de ajustarPlanAction devuelve el planAntes, pero guardarCuotasAction lo pasa por validarPlan y, si falla, lo descarta en silencio. Con un plan anterior todo en null (las cuotas cargadas por Editar deal o el wizard), validarPlan falla siempre.
  - Escenario: Lead con cuotas manuales y sin columnas de plan. Se ajusta el plan a 3 × 1.200 y se aprieta Deshacer: las cuotas vuelven, pero monto_cuota_usd = 1200 y total_cuotas = 3 quedan escritos. planEnLead sigue dando true y la variable {{lead_cuota}} de las automatizaciones dice USD 1.200.
  - Arreglo: En el Deshacer, escribir planAntes tal cual (nulls incluidos) sin pasarlo por validarPlan, o validar sólo cuando trae algún valor.
- **[baja]** `lib/pagos.ts:340-351 (cortarRecordatoriosDeCuota)` cerrarCorridasDeCuota se traga el error y devuelve 0. La acción y la API contestan «no había un recordatorio corriendo: nada que cortar» cuando en realidad no pudieron escribir.
  - Escenario: Supabase devuelve 5xx al cortar. MaKo responde «nada que cortar», la persona intenta editar la cuota y editarCuota la rechaza por «recordatorio en curso».
  - Arreglo: Para este camino manual, una variante que tire (o que devuelva ok:false) cuando el update falla, y dejar la versión que no tira sólo para marcarPago.
- **[baja]** `lib/pagos.ts:1194-1215 (escribirVenta)` Cambiar el tipo o la mensualidad de una suscripción que cobra la pasarela no tiene la misma guarda que «cancelar la manual»: el CRM deja de contarla (o cuenta otro monto) mientras Stripe sigue cobrando lo de siempre.
  - Escenario: Lead con una suscripción de Stripe activa. Desde el bloque `venta` le cambian el tipo a pago único: suscripcion_monto_usd y suscripcion_meses quedan en null, el MRR la saca, y la renovación siguiente entra igual como una cuota cobrada de un pago único.
  - Arreglo: En escribirVenta (y en el preparar de editar_venta_lead), rechazar tipo y monto de una suscripción con un cobro de la pasarela 'pagado' y no cancelado, con la misma condición que cambiarEstadoSuscripcionAction.
- **[baja]** `app/crm/[id]/pagos-campo-actions.ts:320-332 (guardarMonedaNegocioAction)` Corta sin sesión y sin rol, pero no cuando el workspace es null. setSetting cae a OWNER_WS (lib/settings.ts, wsActual), así que la moneda se escribe en el ws1, que es un cliente.
  - Escenario: El super admin, sin ?ws, sin impersonar y sin workspace propio (getWorkspaceActual = null; esAdmin da true por rol global), llama a guardarMonedaNegocioAction('MXN'). La moneda del CRM de Mauricio pasa a MXN.
  - Arreglo: Agregar `if ((await getWorkspaceActual()) == null) return { ok: false, error: SIN_SESION }` antes de guardar, como hace cambiarEstadoSuscripcionAction.
- **[baja]** `lib/api-mako/areas/crm.run.ts:463` cobranza_lead devuelve dos «por cobrar» que no coinciden: por_cobrar_usd suma las cuotas devueltas (impagas) y cobrado.pendiente_usd las excluye.
  - Escenario: Una cuota de 500 que se reembolsó por Stripe: por_cobrar_usd = 500 y cobrado.pendiente_usd = 0 en la misma respuesta. MaKo puede citar cualquiera de los dos.
  - Arreglo: Calcular por_cobrar_usd sin las devueltas (esCuotaDevuelta) o devolver sólo el de cobrado.

## Revisión de b4 · captura

**Veredicto:** Las ingestas están bien en lo que pedía este frente. La primera entrada se escribe una sola vez, en createLead, y ningún update la toca; en la rama yaEraLead no se escribe nada. El @ va sólo en Instagram, con la misma regla que usuarioInstagram. El backfill completa sólo los vacíos, compara el workspace y pone workspace_id explícito en lead_audit; además ig_conversaciones.lead_id sólo lo escribe crearLeadDe, así que toca únicamente leads nacidos por Zernio. En Zernio, logLeadEvent pasa por getTenantDb dentro de runWithWorkspace y cae en el workspace correcto. El reintento del alta sin la migración se activa sólo si el error nombra una de las dos columnas nuevas, así que el opt-in no se cae.

Lo que rompe:
- **Media:** la etapa nueva de ficha_lead y buscar_leads se calcula contra el funnel del negocio. Para un lead cuya casa es un producto secundario es una regresión: antes MaKo daba el override correcto y ahora da una etapa derivada que contradice al tablero y a productos_del_lead.
- **Baja:** tres promesas que no se cumplen o que dejan datos de más. La página de registro «la escribe quien confirma» y no la escribe nadie, aunque el test da verde. El ingreso estimado se oculta en un ganado «como la ficha», que hoy no lo oculta. Y el lead huérfano del compare-and-set ahora lleva el anuncio y el @, así que entra en las métricas por anuncio.

Corrí sus tests: los 3 archivos del frente dan 21/21 y 12 archivos relacionados (canal-social, crm-revisar-propuesta, landing-optin, leads-duplicados, crm-origen-lead y otros) dan 175/175. Los tests del cableado son regex sobre el código fuente, no lo ejecutan; el del opt-in y el del ganado fijan justo las dos promesas que no se cumplen. No edité nada.

- **[media]** `lib/mako-tools.ts:230 (ficha_lead) y 216 (buscar_leads); la regla vive en lib/mako-ficha-lead.ts:etapaParaModelo` La etapa «efectiva» de MaKo se calcula contra las etapas del funnel DEL NEGOCIO (getPipelineStagesDeLead → getFunnelDefault, lib/funnels.ts:188), no contra las del funnel donde vive el lead. Si la casa del lead es un producto secundario y su override es una etapa que sólo existe ahí, etapaVigenteDe lo toma como huérfano y devuelve la etapa derivada. Antes de esta rama, ficha_lead devolvía el override crudo, que en ese caso era el correcto. Es una regresión, y deja a MaKo contradiciéndose con el tablero y con su propia API.
  - Escenario: Un workspace con dos productos: «Negocio», con las etapas lead, agenda y ganado, y «Webinar», con registro, grupo, webinar y oferta. El lead L tiene funnel_id = Webinar y lo movieron en el tablero de Webinar a «Grupo WhatsApp», o sea pipeline_stage = 'grupo'. El tablero de Webinar (app/crm/page.tsx:157, getFunnelDe(funnelId), con validStageKeys de ese funnel) lo dibuja en 'grupo'. productos_del_lead (lib/api-mako/areas/crm.run.ts:653, etapaVigenteDe(lead, p.etapas)) y el CRM móvil (lib/crm-movil.ts:174) también dicen 'grupo'. ficha_lead ahora devuelve etapa 'lead' con etapa_nombre 'Lead entrante', y buscar_leads dice lo mismo. MaKo Analyst carga ficha_lead y productos_del_lead en el mismo contexto (LECTURAS_DEL_LEAD) y recibe dos etapas distintas. Además, transiciones_desde_etapa y proponer_cambio_etapa le piden al modelo «la etapa de ficha_lead», así que propone movimientos desde una etapa en la que el lead no está.
  - Arreglo: Para la casa, usar las etapas del funnel del lead (lead.funnel_id → getFunnelDe o etapasDeProducto, lo mismo que hacen productos_del_lead y crm-movil); con funnel_id null, las del negocio. En buscar_leads, leer las etapas una vez por cada funnel_id distinto entre los 20 resultados. Test: un lead con funnel_id secundario y un override que sólo existe ahí tiene que dar ese override, no la derivada. Mientras no se haga, que la descripción no diga que es «la etapa en la que lo ve el equipo».
- **[baja]** `app/api/track/optin/route.ts:491-493; test en tests/crm-entrada-social.test.ts:202` El código promete algo que no se ejecuta, y el test da verde igual. El comentario de la propuesta dice que `pagina_registro` «La escribe quien confirma, como la atribución», pero atribucionDePropuesta (app/crm/revisar/[id]/propuesta-lead.ts:73-106) no la copia y nada la lee de `datos.leads[]`. El test sólo busca la cadena `pagina_registro: paginaOptin,` en la propuesta, con el mensaje «(la escribe quien confirma)», así que da verde aunque nadie escriba el dato. El desarrollador lo dejó en pendientes, pero el comentario y el test lo dan por hecho.
  - Escenario: Una persona nueva se registra en la landing y el alta directa falla por un error pasajero de la base: el lead cae a propuesta. También pasa con alguien cuyo email ya existe, que va directo a propuesta. El dueño confirma en /crm/revisar/<id> y el lead nace sin `pagina_registro`. Como no hay backfill a propósito, el bloque `pagina-de-registro` y MaKo dicen «sin dato» para siempre, aunque la página estaba guardada en la propuesta.
  - Arreglo: Sumar `pagina_registro` a `Atribucion` y copiarla en atribucionDePropuesta, otra vez por normalizarUrl porque se lee de la base. La función es pura, así que el test puede ejecutarla en vez de usar una regex sobre la ruta. Si eso va en otro frente, sacar del comentario y del mensaje del test el «la escribe quien confirma».
- **[baja]** `lib/mako-ficha-lead.ts:89; test en tests/mako-ficha-lead.test.ts:70` `ingreso_estimado_usd` se omite en un ganado «porque la ficha lo oculta», pero la ficha de hoy no lo oculta. app/crm/[id]/page.tsx:228 pasa ingresoEstimado siempre, e InfoPrincipalCard.tsx:306 lo dibuja con ve('ingreso') sin mirar el estado. El ocultamiento sólo lo dice el diseño del bloque futuro (docs/diseno-ficha-bloques.md:93). La descripción de la herramienta le dice al modelo «Un campo que no viene es un dato sin cargar». Es justo la falla que el módulo dice que evita: MaKo afirma «no hay» sobre un dato que el equipo ve.
  - Escenario: Un lead ganado tiene ingreso_estimado = 1500 y en la ficha se lee «Ingreso estimado (USD): 1500». El dueño le pregunta a MaKo por WhatsApp cuánto se estimaba ese cliente. ficha_lead no trae el campo y MaKo contesta que no tiene ingreso estimado cargado. El test fija ese comportamiento con el comentario falso «la ficha lo oculta».
  - Arreglo: Mientras exista el bloque de hoy, mandarlo también en un ganado y aclarar que es una estimación (o con una marca tipo `ingreso_estimado_es_estimacion: true`). Otra opción es que la descripción diga que en un ganado no se informa. Y corregir el comentario del test.
- **[baja]** `lib/zernio-entrante.ts:185-199 (crearLeadDe: createLead con meta_ad_id e instagram, antes del compare-and-set)` El lead que pierde el compare-and-set queda huérfano, como antes, pero ahora además lleva `meta_ad_id`, el @ y `entrada_social`. Antes ese huérfano no contaba en ninguna métrica por anuncio; ahora sí. Y la primera entrada puede quedar guardada en el huérfano en vez de en el lead real. El comentario dice que el choque «no pasa en la práctica», pero canal-social.ts:357 documenta justo el caso: en un anuncio de DM, Meta manda dos mensajes de la misma persona nueva casi juntos.
  - Escenario: Un anuncio click-to-DM de Instagram en un negocio con dos CRON, «Te envía un mensaje» y «Hace clic en tu anuncio». Meta manda el primer message.received sin referral y casi enseguida el segundo con referral.ad_id. El webhook no serializa por persona, así que los dos pedidos ven lead_id null, los dos llaman a createLead y gana uno. Si gana el de 'mensaje', el lead unido queda sin meta_ad_id y con como 'mensaje'. El huérfano, que no tiene la charla y nunca avanza, guarda meta_ad_id, entrada 'anuncio' y el mismo @. Resultado: lib/queries.ts:1700 y campanaDeLead le cuentan al anuncio un lead que nunca agenda, el lead real queda sin atribuir y el buscador muestra dos leads con el mismo @.
  - Arreglo: Cuando se pierde el compare-and-set, borrar el lead recién creado: lo creó esta misma llamada y todavía no tiene historial ni charla. O al menos pasarle al ganador `meta_ad_id` y `entrada_social` con un update compare-and-set `.is(null)`. Lo más sólido es reclamar la fila de la persona antes de crear el lead.

