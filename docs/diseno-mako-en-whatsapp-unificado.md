# «MaKo en WhatsApp» = automatizaciones — diseño y contrato (11/10/2026)

El pedido de Martín (literal) está al final. Es el CONTRATO entre las dos partes que lo construyen (A: emisor y motor; B: lista, lienzo,
galería y deprecación) y no deja nada por decidir. Lo medido sale del relevamiento del 11/10.

**Decisiones que no se re-preguntan.** (1) «Todos arrancan vacíos»: nadie tiene filas; se agregan desde la galería y, desde el deploy,
estos mensajes NO salen hasta que el negocio agregue y prenda la suya. (2) Nada nuevo en la pantalla para «cada cuánto», «insistir» o el
email: se arma con CONDITION, DELAY y «MaKo en WhatsApp». (3) El «Reporte semanal (lunes)» no se muda: pasa a `AVISOS_SOLO_SUPERADMIN` y
sale como hoy (sólo email, `notification_prefs`). Alcance: `reunion-recordatorio` (el aviso AL EQUIPO media hora antes; NO la
automatización «Recordatorio de la reunión» que le escribe al lead, `TRIGGER_RECORDATORIO`), `wa-mensaje-entrante` y `cuota-vencida`.
Agencia y super admin, intactos.

## 1. El modelo: una fila de `nutricion_secuencias` con el CRON «Evento de MaKo»

- **Una automatización normal**: nombre, emoji, `activa`, `pasos`/borrador, posiciones, archivar. Nace APAGADA desde la galería
  (`filaDePlantilla`, lib/plantilla-crear.ts:92). Tarjetas de siempre, ningún nodo nuevo: «MaKo en WhatsApp» = `accion { operacion:
  'avisar_al_equipo', params: { leadId, mensaje } }` (`OP_AVISAR`, lib/flujo-legado.ts:91), DELAY = `nodo: 'esperar'`, CONDITION =
  `nodo: 'condicion'`.
- **El CRON**: `trigger_tipo = 'aviso_mako'` (`TRIGGER_AVISO_MAKO`, nuevo en lib/disparadores.ts), clase `'mako'` «Evento de MaKo».
  **Cuál evento**: `disparadores[0].subtipo` (jsonb de la mig 0241; existe en producción: el relevamiento leyó `disparadores = null` en
  #228-#237). Es donde Instagram guarda «cuál de sus eventos» (`Disparador.subtipo`, lib/disparadores.ts:198; `CON_SUBTIPO`, :235).
  Tabla `EVENTOS_MAKO` al lado de `EVENTOS_EMAIL` (:132), con `type SubtipoMako`:

  | subtipo | aviso (el `tipo` que se emite) | label (fila del CRON) | trae |
  |---|---|---|---|
  | `reunion_pronto` | `reunion-recordatorio` | Falta media hora para una reunión | lead + mensaje armado |
  | `lead_contesta` | `wa-mensaje-entrante` | Un lead contesta y MaKo no le respondió | lead + mensaje armado |
  | `cuota_vencida` | `cuota-vencida` | Una cuota vence sin cobrarse | lead + cuota |

- **Por qué ahí.** No en `clave` (su índice único `(workspace_id, clave)`, 0054_workspaces.sql:100, no deja duplicar), ni en `etapa`
  (pegar un flujo copiado la pierde y otros la leen), ni un `trigger_tipo` por aviso (3×3 registros del test de registros). El id crudo
  no pasa la regex del subtipo (`/^[a-z_]{1,30}$/`, :282): por eso la tabla.
- **lib/disparadores.ts (A).** `aviso_mako` entra a `TRIGGERS_SOLO_EVENTO` (:60: sin cohorte, el barrido no lo mira y con horario ya
  contesta «Un evento no se repite por horario»), a `CON_SUBTIPO` y a `SOLO_DESDE_EL_CRON` (:76; también `reunion_recordatorio`, que hoy
  se pone desde la API de email). `ClaseDisparador` suma `'mako'`, pero `CLASES_DISPARADOR` (:89) NO: los seis botones siguen seis (una
  fila de evento nace de la galería). `claseDeDisparador` (:413) → `'mako'`; `eventosDe('mako')` → `EVENTOS_MAKO`. `TRIGGERS_DEL_EMISOR
  = new Set(['reunion_recordatorio', 'aviso_mako'])` + `esDelEmisor(d)`: con uno de ésos la lista es de UNO (`problemaDeDisparadores`,
  :492: «Este CRON va solo»). `problemaDeCambio(previos, lista)`: de un CRON del emisor a otro (u otro evento), o de otra clase a uno
  del emisor → «Este CRON no se cambia»; de `manual` a uno del emisor, sí (es pegar un flujo copiado, lib/flujo-copia-negocio.ts:68-82).
  La llaman `guardarDisparadores` y `prepararDisparadores` (lib/disparadores-guardar.ts); `setTriggerSecuencia` y `setCronSecuencia`
  (lib/setting-secuencias.ts:510, :237) no tocan una fila del emisor. De paso cierra los huecos del recordatorio (un segundo CRON lo
  inscribía en el motor; la «←» lo cambiaba).
- **El texto del CRON** es el `label`, por la rama `CON_SUBTIPO` de `textoDeDisparador` (:728). `disparadorCorto`
  (lib/flujo-aviso.ts:628) NO se usa: corta la prosa del catálogo, y la de la reunión son 101 caracteres → 95 + «…».
- **El motor no la inscribe** (como el recordatorio): `if (triggerTipo === 'aviso_mako') return [];` literal en `cohorteDeTrigger`
  (lib/nutricion.ts:1015), `{ value: 'aviso_mako', label: 'Evento de MaKo' }` en `TRIGGERS` (lib/email-marketing.ts, bloque de :337) y
  su glosa en `COHORTE_GLOSS` (lib/nutricion-generator.ts:191): los tres registros del test. Y `inscribirEnSecuencia`
  (lib/nutricion.ts:2094) rechaza una fila del emisor (un «Ir a» o la acción `inscribir_nutricion` le meterían un lead).
- **Duplicar** copia `disparadores` cuando la fila es del emisor (`COPIA`, lib/secuencia-duplicar.ts:38, no lo trae: la copia quedaría
  «Elige el evento» y no saldría nunca). Copiar flujo ya lo lleva (`disparadoresDeSecuencia` → `guardarDisparadores`). La copia nace
  pausada; prendidas, salen las dos.

## 2. El emisor (A)

`emitirDelCatalogo` (lib/avisos.ts:350) sigue siendo la puerta y el `tipo` sigue siendo el id del aviso (de él cuelgan dedup, rótulo,
resumen y feed). Después de resolver `ws` y ANTES de `getPlantilla` (:376): `if (AVISOS_POR_EVENTO.has(id)) return emitirPorEvento(cat,
ws, opts, deps)`. `emitirPorEvento` vive en lib/aviso-evento.ts (puro, deps inyectadas como lib/plantilla-crear.ts); avisos.ts le
enchufa las reales con import dinámico (evita el ciclo avisos → flujos → avisos).

1. **Lee las filas** con `getSupabaseServer()`: `workspace_id = ws`, `trigger_tipo = 'aviso_mako'`, sin archivar, por id (molde:
   `toquesDelNegocio`, lib/reunion-recordatorio.ts:256-283). Quedan las `activa === true` con `disparadoresDe(fila)[0].subtipo ===
   evento`. Corren los `pasos` publicados.
2. **Lectura que falla** → `{ ok: false }` y log, sin caer al store («no pude leer» no es «no tiene»). La reunión no marca y reintenta
   (:142), la cobranza no reclama y reintenta; el de la charla se pierde, como un corte hoy.
3. **Ninguna activa** → `emitirAviso({ tipo, titulo: cat.titulo, texto: opts.texto ?? cat.titulo, categoria, semaforo, ws, estado:
   APAGADO })`: escribe el feed como un apagado hoy (:146-148) y se devuelve con `deduped: true`, como hoy el store apagado (:377), así
   la cobranza no lo cuenta como entrado. No reclama el dedup: un apagado nunca se dijo.
4. **El dedup, UNA vez por evento**: con `opts.dedupTtlMin`, `reclamarEspaciado(ws, cat.id, ttl, opts.dedupKey)` (lib/espaciado.ts);
   perdido → `{ ok: true, deduped: true }` sin correr nada. Es la MISMA clave de hoy (`mako.aviso.last.<tipo>:<hash>`): las ventanas
   vivas siguen valiendo el día del deploy. Y como cada tarjeta emite después SIN `dedupTtlMin` (`emitirAviso`, :120 y :174, no mira
   ninguna), **la segunda fila del mismo evento no la frena la primera**.
5. **Por cada fila activa**: `pasosDelEvento(fila.pasos, evento)`; con problema, log y se saltea (Publicar no la deja llegar así). Si
   no, `correrEvento('sec:<id>', pasos, ws, ctx)` (lib/flujos.ts, exporta `ejecutarPasos`) con `ctx = { ws, leadId, leadNombre, cuotaId:
   opts.cuotaId, datos: opts.datos, texto: opts.texto, aviso: { id: cat.id, titulo: fila.nombre } }`.
6. **Devuelve** `{ ok: true, feedId: null, wa: false, deduped: false, filas: n }`: el envío lo afirma cada tarjeta, y ningún llamador de
   estos tres lee `wa`.

**La tarjeta «MaKo en WhatsApp»** se traduce a `{ tipo: 'mensaje', canal: 'aviso_dueno', texto }`. Con `ctx.aviso` (sólo filas de
evento), la rama de `ejecutarPaso` (lib/flujos.ts:243) resuelve `conVariables(texto, { ws, leadId, leadNombre }, { ...ctx.datos,
mensaje_mako: ctx.texto })` y llama `emitirAviso({ tipo: ctx.aviso.id, titulo: ctx.aviso.titulo, texto, categoria y semaforo del
catálogo, ws, lead, estado: ESTADO_EVENTO })` en vez de `enviarAlGrupoMaKo` (:261): rótulo, feed y turno del doer como hoy.
`EmitirAvisoInput` suma `estado?: EstadoAviso`; presente (`ESTADO_EVENTO = { activo: true, wa: true, email: false, frecuenciaMin: 0 }`),
no llama `estadoAviso` (:146) ni abre insistencia (:252-269): el store de estos tres ya no se lee.

**El texto que arma el código** es un dato del «{ }»: `{{mensaje_mako}}` («Lo que arma MaKo», grupo Lead, `alcance: 'mensaje'`, `fuente:
'evento'`, lib/variables-aviso.ts), lleno con el `texto` de siempre del llamador. Se ofrece sólo con `ContextoDatos.conMensaje` (rama
nueva en `variablesPara`, :350: hoy lo que no es `lead` cae a `conCuota`), que vale en los eventos cuyo aviso es `textoDelCodigo`. Esas
dos plantillas dicen `{{mensaje_mako}}` y nada más: sale EXACTAMENTE el texto de hoy.

**DELAY y CONDITION** corren en el runner de los flujos de los mensajes (`ejecutarPasos`, lib/flujos.ts:148; `flujo_corridas`; cron
`flujo-corridas` cada 5 min), traduciendo el grafo. `pasosDelEvento` recorre UNA fila desde `raizSalida` (devuelve motivo corto y
tarjeta, como `toquesDeLaAutomatizacion`):
- MaKo → `mensaje/aviso_dueno`; DELAY `tiempo` → `{ tipo: 'esperar', horas: minutos / 60 }` (tope 30 días, `DELAY_MAX_HORAS`,
  lib/flujo-pasos.ts:77); CONDITION de UNA rama con «Si no» vacío → `{ tipo: 'condicion', rama }` (variante nueva de `Paso`,
  lib/flujos-tipos.ts:87; `esFlujoValido` no la acepta en el store): se cumple, sigue; no, termina. `decidir` (lib/flujo-pasos.ts:124)
  suma `EstadoCorrida.hechos?: HechosLead | null`: `cumpleRama(rama, hechos)` (lib/flujo-grafo.ts) → `saltar`; si no, o sin hechos →
  `terminar` (lo que no se sabe NUNCA se cumple). `ejecutarPasos` los lee una vez, en la primera `condicion`, con `hechosDeUnLead(ws,
  leadId, filas)` (export nuevo de lib/nutricion.ts sobre `hechosDeLeads`, :2518); sin `leadId` → null. **Con error NO es null**
  (revisión del 11/10): `'ilegible'`, y la corrida se duerme en esa CONDITION y vuelve a preguntar cada 5 min, tres veces
  (`reintentoDeHechos`, lib/flujo-pasos.ts) — terminar gastaba el dedup ya reclamado (120 días en la cobranza).
- Rechaza: WhatsApp o email al lead, ⚡ Acción, AI Step o «Si responde», «Ir a», flechas en paralelo, DELAY «antes de la reunión»,
  CONDITION con las dos salidas, MaKo vacía, `{{mensaje_mako}}` en un evento sin mensaje armado, y `{{cuota_dias}}` o
  `{{mensaje_mako}}` después de un DELAY (son la foto del momento: lib/cobranza.ts:94, y «⏰ En 30 min tienes la R1…»). Mismo freno en Publicar y Activar: rama nueva junto a la del recordatorio en
  `setSecuenciaPasos` (lib/nutricion.ts:792; su `select` de :621 suma `disparadores`).
- Para que CONDITION vea al lead en los tres eventos, los cinco llamadores de la reunión y la charla pasan `lead` (lo único que cambia
  en cada uno): lib/reunion-recordatorio.ts:136 (`{ id: lead.id, nombre: lead.nombre }`), lib/chat-agent-handoff.ts:136,
  lib/nutricion.ts:4604, :4854 y :5025.
- Corridas con `aviso_id = 'sec:<id>'`. `abrirCorrida` (lib/flujo-corridas.ts:46) guarda `ctxParaDormir(ctx)` (puro, lib/flujo-pasos.ts:
  saca `QUE_ENVEJECEN = ['cuota_dias']`). `retomarCorrida` (lib/flujos.ts:213) con `sec:` relee la fila: archivada, pausada o sin forma
  → `cortada` (lo de hoy con un flujo apagado); si no, sigue — **sólo con la MISMA forma** (revisión del 11/10): la corrida guarda una
  posición, así que lleva en su `ctx.firma` qué tarjeta es cada paso, y una fila con una tarjeta sumada, sacada o movida la corta
  (`pasosParaRetomar`, lib/aviso-evento.ts). Un texto, un DELAY o una condición editados en su lugar siguen con lo publicado.
- **El motor no corre una fila del emisor** (revisión del 11/10): `procesarEnvios` cancela, antes de los hilos y del cupo, toda
  inscripción de una fila `TRIGGERS_DEL_EMISOR`. Las dos puertas de arriba no alcanzaban: `encadenar` (lib/nutricion-desenlace.ts) y
  la «secuencia que sigue» de la API las crean sin preguntar.

**La cobranza** se arma con tarjetas de siempre: MaKo (entrada) → DELAY 48 h → MaKo → DELAY 72 h → MaKo. La entrada sale en el acto con
los `datos` completos; al dormirse, la corrida guarda los estables. El corte al pagar sigue siendo `cerrarCorridasDeCuota`
(lib/flujo-corridas.ts:177, filtra `ctx->>cuotaId`): el cron pasa `cuotaId: d.cuota.pago_id` a `emitirDelCatalogo`
(app/api/cron/cobranza/route.ts:65, clave nueva de `opts`). `correrFlujoDe` (lib/flujos.ts:123) devuelve false para `AVISOS_POR_EVENTO`
(si no, la cadencia de fábrica correría además de la fila); su llamada de :83 queda para `cuota-por-vencer`, que es de la agencia.

## 3. La lista y el lienzo (B)

- **La lista** (app/automations/SimuladorWhatsApp.tsx): `partirLista(secuencias)` (exportada, pura) → `{ chatbot, mako }` por
  `trigger_tipo === TRIGGER_AVISO_MAKO`. «MaKo en WhatsApp» dibuja `mako` con el MISMO `ItemLista` (:912), el MISMO «⋯»
  (`opcionesDeFila(j.activa)`, :153: Activar/Pausar, Duplicar, Copiar flujo, Eliminar), las MISMAS acciones (`accionFila` y `eliminar`,
  que archiva, :520-560) y la selección de siempre (`selId`): abre el MISMO `SecuenciaPerfil`/`FlujoLienzo`, con su CRON y su tarjeta.
  Un setter las ve como cualquier automatización. **«＋ Nuevo mensaje»** (:819) abre la galería en su sección (`onNueva('mako')`).
- **Se borra de SimuladorWhatsApp**: `opcionesDeMensaje` (:180), `avisoSel`/`aviso`, `accionMensaje` (:566), `eliminarMensaje` (:586) y
  su `Confirm`, `nuevoMensaje`/`creandoMensaje` con `TemplateDetalleModal` (:451, :670), el montaje de `MensajeMakoLienzo`,
  `filaDeMensaje` del filtro, las props `avisos`, `abrirAviso`, `onAvisosCambio`, `onOcultosCambio` y el tipo `AbrirAviso`. **De
  ChatAgentApp.tsx**: `cargarAvisos` (:376), `cargarOcultos` y `restaurarMensaje` (:391-414), el ancla `?aviso=` (:550-563),
  `vieneAUnMensaje` (:598), `hayAvisos`, y `ocultos`/`onRestaurar` de la galería (:799-800).
- **El lienzo.** SecuenciaPerfil.tsx:536-538: `frenoDeEsta` suma `frenoDelEvento(ps, evento)` con el CRON `aviso_mako`.
  FlujoLienzo.tsx:1029/:1052: en una fila de evento, `EditorMako` recibe `datosDelEvento(evento)` en vez de `GRUPOS_MAKO`, y el destino
  de «Ir a» no ofrece filas del emisor. EditorDisparadores.tsx: con `esDelEmisor(lista[0])`, ni «＋ Nuevo CRON» (:470) ni «←» (:197), y
  la clase `mako` dibuja el label como la rama de :594 sin la flecha (vale también para el recordatorio). PanelProbar.tsx:792:
  `datosExtra = { mensaje_mako: cat.ejemplo }` más los de la cuota. El ícono de `mako` es el rayo de `otro`.

## 4. La galería (B)

- lib/plantillas-automatizaciones.ts: `CronDePlantilla` (:101-113) suma `{ fijo: typeof TRIGGER_AVISO_MAKO; evento: SubtipoMako }`;
  `esPlantillaMako(p)` = `p.cron.fijo === TRIGGER_AVISO_MAKO`. Tres plantillas:
  - `mako-reunion` 🗓️ «Aviso antes de cada reunión» — «Te avisa en el grupo media hora antes de cada reunión, con el link al lead.» —
    `mako('mr_aviso', '{{mensaje_mako}}', null)`.
  - `mako-charla` 💬 «Aviso cuando un lead te escribe» — «Te avisa en el grupo cuando un lead contesta y MaKo no le respondió solo.» —
    `mako('mc_aviso', '{{mensaje_mako}}', null)`.
  - `mako-cobranza` 💸 «Cobranza de cuotas vencidas» — «Te avisa cuando vence una cuota sin cobrar y te lo recuerda a las 48 h y 72 h.
    Se corta al marcar el pago.» (106 car.) — `mk_entrada` (el `ejemplo` de `cuota-vencida`, :1003, que es lo que sale hoy) →
    `esperar('mk_e48', 2880)` → `mk_48` («💸 Sigue sin cobrarse…», lib/avisos-catalogo.ts:987) → `esperar('mk_e72', 4320)` → `mk_72`
    («💸 Último recordatorio…», :989). Textos LITERALES.
- `filaDePlantilla` (lib/plantilla-crear.ts:92): con `evento`, `disparadores: [{ id: 'd1', trigger_tipo: 'aviso_mako', subtipo: evento
  }]` en el MISMO insert, antes de `setPasos` (el freno lee el evento). «Uno por negocio» (:108) y `yaLaTiene`
  (GaleriaPlantillas.tsx:119) quedan sólo para `TRIGGER_RECORDATORIO`: de un evento se permiten varias.
- GaleriaPlantillas.tsx: «Desde una plantilla» deja afuera las de MaKo; debajo, una sección `ROTULO_MENSAJES_MAKO` con las tres y la
  MISMA tarjeta; con `seccion="mako"`, `scrollIntoView` al montar. Se borra la sección de ocultos (:319 en adelante) y sus props.

## 5. Lo que se depreca de DATOS y de código

**Datos (medido el 11/10).** Del store (`app_settings`) de estos tres hay UNA entrada: `cuota-vencida` del ws3 = `canales { wa: true,
email: false }`, igual al default; deja de leerse y no se borra. `reporte-semanal` del ws1 (texto y borrador «ZZZ» de prueba) queda en
el store, visible sólo en /mensajes, y no sale nunca (lo arma `buildReporteSemanal`). ws13: Fathom apagado (del super admin, no cambia)
y `reunion-cancelada` apagado (agencia, no cambia); su propio «Nueva Agenda VSL» (apagado, sin pasos, nunca salió) deja de verse en
/automations y queda en /mensajes. `flujo_corridas`, `avisos_programados` e insistencias abiertas: cero.
Las marcas `mako.aviso.last.*` siguen valiendo. ⚠️ `notificaciones` no existe en producción (PGRST205): el «feed» escribe en
ningún lado, hoy y después.

**Para Martín**: desde el deploy el ws1 deja de recibir «media hora antes» (7 en 30 días) y «un lead te escribió» (3 en 30 días) hasta
que agregue y prenda las plantillas. `cuota-vencida` no salió nunca. Nadie más recibía estos tres.

**Código (B).** lib/avisos-catalogo.ts: `AVISOS_DEL_CLIENTE = []` con su ⛔, `reporte-semanal` a `AVISOS_SOLO_SUPERADMIN` (:308),
`cuota-vencida` sin `flujoPorDefecto` (:979) ni `correSuFlujo` (:958); `cuota-por-vencer` no cambia. lib/plantillas.ts:453:
`listarPlantillas` deja afuera `AVISOS_POR_EVENTO` en las dos vistas (en /mensajes serían un interruptor que no hace nada).
app/perfil/NotificacionesPanel.tsx:364: sale la `PlantillasView` del cliente. app/api/perfil/plantillas/route.ts: salen `?ocultos=1`
(:72) y `ocultar`/`restaurar` (:242-249). lib/api-mako/areas/equipo.run.ts:419: `configurar_aviso_whatsapp` rechaza los tres («Ese
mensaje es una automatización: se prende en Automations»). Se BORRAN app/automations/MensajeMakoLienzo.tsx y
lib/chatbot-mensajes-mako.ts; `PARAM_OCULTOS` se muda a lib/plantillas-ocultas.ts (app/api/admin/plantillas/route.ts:23 cambia sólo el
import). **QUEDAN** (los usan /mensajes o el runtime): TemplateDetalleModal, FlujoAviso, PlantillasView, lib/plantillas-ocultas.ts
(`estaPrendida`, `listarPlantillas`), `ocultar`/`restaurar` de app/api/admin/plantillas (sin pantalla, 0 datos) y
app/api/perfil/plantillas (la leen seis tests).

## 6. Los tests

**Nuevos de A** (tests/aviso-evento.test.ts y casos en tests/secuencia-duplicar.test.ts): (1) `EVENTOS_MAKO`: tres; cada subtipo pasa
`sanearDisparador`; cada aviso está en el catálogo; `AVISOS_POR_EVENTO` son sus avisos y no cruzan `AVISOS_SOLO_SUPERADMIN`. (2) CRON:
clase `mako`, texto = label, `CLASES_DISPARADOR` sigue en seis, «Este CRON va solo», «Elige el evento» sin subtipo, los cuatro casos de
`problemaDeCambio`, `SOLO_DESDE_EL_CRON` con los dos del emisor. (3) `pasosDelEvento`: las tres plantillas traducen (la cobranza a
mensaje, esperar 48, mensaje, esperar 72, mensaje) y cada rechazo de §2 devuelve su tarjeta. (4) `decidir` con `condicion` (cumple →
saltar; no, o sin hechos → terminar); `ctxParaDormir` saca `cuota_dias` y `QUE_ENVEJECEN` contiene `CLAVE_QUE_ENVEJECE` de
lib/cobranza.ts. (5) `emitirPorEvento` con deps falsas: sin filas → apagado sin reclamar; lectura que tira → `ok: false` sin correr; dos
filas → reclama UNA vez y corre DOS; reclamo perdido → `deduped` y corre cero; fila con problema → se saltea. (6) Fuente: el desvío va
antes de `getPlantilla`; `correrFlujoDe` corta los tres; `ejecutarPaso` con `ctx.aviso` llama `emitirAviso` con `estado`; los cinco
llamadores pasan `lead`; la cobranza pasa `cuotaId`. (7) Duplicar una fila de evento conserva `disparadores`; una de etapa sigue sin
copiarlos. Los tres registros los acusa solo tests/nutricion-triggers-registros.test.ts.

**Nuevos de B** (tests/automations-mako-en-whatsapp.test.ts): (1) `partirLista`; el «⋯» de una fila de evento es `opcionesDeFila`
(cuatro) y `opcionesDeMensaje` ya no existe. (2) Nada en app/automations importa MensajeMakoLienzo, TemplateDetalleModal ni
chatbot-mensajes-mako. (3) «Nuevo mensaje» abre la galería en `mako`; las tres van bajo «MaKo en WhatsApp» y no en «Desde una
plantilla». (4) Las tres pasan `validarGrafo`, `frenoDelFlujo` y `frenoDelEvento`; la cobranza trae los textos de hoy, copiados
LITERALES al test; dos `crearDesdePlantilla` del mismo evento crean dos y el recordatorio sigue siendo uno. (5) `mensaje_mako` sólo con
`conMensaje`; `listarPlantillas` no trae los tres; `configurar_aviso_whatsapp` los rechaza; NotificacionesPanel no monta PlantillasView;
`reporte-semanal` está en `AVISOS_SOLO_SUPERADMIN`. (6) Con un CRON del emisor no hay «＋ Nuevo CRON» ni «←» (dibujado, el molde de
tests/editor-disparadores.test.ts).

**Se dan vuelta (B).** tests/chatbot-mensajes-mako.test.ts se BORRA (su test de :302, «sin `enlaceEditar` /mensajes edita en el lugar»,
se muda al nuevo). tests/plantillas-ocultas.test.ts conserva :44-:113 y :147, borra :124, :138, :178, :193 y :199, y :158 pasa a «la
ruta de /mensajes lee `PARAM_OCULTOS` de lib/plantillas-ocultas.ts». tests/automations-mako-marco.test.ts pierde :49-:50.
tests/plantillas-viejas.test.ts: `cuota-vencida` ya no corre su flujo ni es del cliente (:24 y :47).
tests/avisos-solo-superadmin.test.ts suma `reporte-semanal`. tests/plantillas-automatizaciones.test.ts barre las tres nuevas. **Roturas
sugeridas.** A: reclamar por fila (test 5); sacar el literal de `cohorteDeTrigger` (registros); `COPIA` sin `disparadores` (7);
`decidir` que siga sin hechos (4). B: las filas de evento en «Chatbot» (1); cambiar una coma de «Sigue sin cobrarse» (4); `yaLaTiene`
también para el evento (4).

## 7. Los archivos, en dos partes que no se pisan

**A — emisor y motor**: lib/aviso-evento.ts (NUEVO, puro: `AVISOS_POR_EVENTO`, `eventoDeAviso`, `avisoDeEvento`, `datosDelEvento`,
`pasosDelEvento`, `frenoDelEvento`, `emitirPorEvento`, `ESTADO_EVENTO`, `APAGADO`) · lib/disparadores.ts · lib/disparadores-guardar.ts ·
lib/setting-secuencias.ts · lib/avisos.ts · lib/flujos.ts · lib/flujos-tipos.ts · lib/flujo-pasos.ts · lib/flujo-corridas.ts ·
lib/nutricion.ts · lib/email-marketing.ts · lib/nutricion-generator.ts · lib/variables-aviso.ts · lib/secuencia-duplicar.ts ·
lib/reunion-recordatorio.ts · lib/chat-agent-handoff.ts · app/api/cron/cobranza/route.ts · tests/aviso-evento.test.ts ·
tests/secuencia-duplicar.test.ts.

**B — lista, lienzo, galería y deprecación**: app/automations/{SimuladorWhatsApp, ChatAgentApp, GaleriaPlantillas, EditorDisparadores,
FlujoLienzo, SecuenciaPerfil, PanelProbar}.tsx · lib/plantillas-automatizaciones.ts · lib/plantilla-crear.ts · lib/avisos-catalogo.ts ·
lib/plantillas.ts · lib/plantillas-ocultas.ts · app/perfil/NotificacionesPanel.tsx · app/api/perfil/plantillas/route.ts ·
app/api/admin/plantillas/route.ts (el import) · lib/api-mako/areas/equipo.run.ts · app/api/cron/reporte-semanal/route.ts (comentario de
:10) · BORRA app/automations/MensajeMakoLienzo.tsx y lib/chatbot-mensajes-mako.ts · los tests de §6 (B).

**El contrato** (A lo exporta con estos nombres; B los usa sin esperar): de lib/disparadores.ts `TRIGGER_AVISO_MAKO`, `EVENTOS_MAKO`,
`type SubtipoMako`, `esDelEmisor`, la clase `'mako'`; de lib/aviso-evento.ts `AVISOS_POR_EVENTO`, `datosDelEvento(sub): ContextoDatos` y
`frenoDelEvento(pasos, sub): { error, tarjeta } | null` (la forma de `frenoDelRecordatorio`); de lib/variables-aviso.ts
`ContextoDatos.conMensaje`. Typecheck y suite, una vez al final.

## 8. Lo que no queda idéntico (y por qué)

1. **El email, «cada cuánto, como máximo» y el asunto** de estos tres desaparecen: no hay dónde ponerlos sin algo nuevo en la pantalla,
   y nadie los usaba (0 `canales.email: true`, ningún `frecuenciaMin`). El dedup del llamador (12 h de la charla, 120 días de la cuota)
   sigue, desde el código.
2. **Insistir hasta que alguien acuse recibo** no tiene tarjeta, y CONDITION no tiene «alguien contestó en el grupo» (los flujos sí:
   `contestaron`, lib/flujo-pasos.ts:43). Nadie lo usa (0 pasos `insistir`); si Martín lo pide, es UNA fila del catálogo de condiciones.
3. **CONDITION** en un evento es un filtro de UNA rama («Sí» sigue, «Si no» termina) sobre los hechos del lead: es lo que sabe correr el
   runner lineal; uno de grafo sería una pieza nueva.
4. **WhatsApp o email al lead, ⚡ Acción, AI Step, «Ir a» y flechas en paralelo** los rechaza Publicar en un evento: no inscribe a un
   lead, y «nada al cliente» en la cobranza es decisión del 06/10. DELAY sólo por tiempo y hasta 30 días.
5. **El CRON** de una fila de evento no se cambia ni se suma otro; **«Probar»** muestra la tarjeta MaKo como en cualquier automatización
   (sin vista del grupo, para todas); **«Por tiempo»** (`avisos_programados`, 0 filas) de estos tres se va. Lo único nuevo en la
   pantalla: el dato «Lo que arma MaKo», la sección de la galería y el label del evento.

---

**El pedido (Martín, 11/10/2026, literal):** «Te pedí que la parte de WhatsApp de MaKo sea exactamente igual y siguen muchas cosas
diferentes... Ya no se como decirte porque varios prompts ya cometes el mismo error. Esto pasa porque "MaKo en WhatsApp" lo comenzamos a
hacer hace tiempo en la tab de notificaciones y quedaron cosas muy viejas que quiero que las depreques. Todo ahora es lo mismo... 1. Los
3 puntos de "MaKo en WhatsApp" no tienen los botones de duplicar o copiar. 2. Las tarjetas cambian, cambia el CRON, cambia la tarjeta de
"MaKo en WhatsApp" cambia todo, y NO debería... debe ser IDENTICO.»
