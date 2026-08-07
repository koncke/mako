# Hallazgos de comunicación (WhatsApp, nutrición, email)

Lo que hay que saber antes de tocar el espejo de Evolution (`lib/evolution-*.ts`), el
onboarding del Chat Agent (`app/api/chat-agent/onboarding/*`) o el desenlace de las
nutriciones (`lib/nutricion-desenlace.ts`). **No es un changelog.**

Origen: corrida multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. El comentario del código juraba que el bug ya estaba arreglado

**Síntoma:** la mitad de la agenda de WhatsApp aparecía con el número crudo, como si esos
contactos no tuvieran nombre guardado.

**Causa:** `getNombresContacto` paginaba con `.range()` **sin ORDER BY**, así que la página
2 repetía contactos de la 1 y salteaba otros — y los salteados son exactamente los que
salen con el número crudo. El comentario que había arriba del bucle atribuía el arreglo de
**ese mismo síntoma** al `.range()` que se había agregado antes.

**El diagnóstico obvio era el equivocado** dos veces: primero se creyó "falta paginar"
(era la mitad), y después el comentario hizo creer que ya estaba resuelto. Ver la trampa
completa en [hallazgos-infra.md](hallazgos-infra.md) §1.

**Regla:** un comentario que declara un síntoma resuelto **no es evidencia**. Si el
síntoma sigue, el comentario es parte del bug.

## 2. `wa_timestamp` se repite en ráfagas

Es la misma trampa, y por eso vuelve: 16 mensajes en 4 segundos comparten timestamp, y los
volcados del importador entran de a cientos con el mismo valor. Los dos bucles del
onboarding (`contexto/route.ts`, `conversaciones/route.ts`) paginaban por `wa_timestamp` a
secas. Hoy desempatan por `id` (`bigint identity primary key` de `wa_mensajes`).

**Regla:** en `wa_mensajes` el orden **siempre** lleva `id` de desempate, en cualquier
sentido.

## 3. Los topes del espejo son de producto: se escriben

Los dos barridos de `lib/evolution-mensajes.ts` tenían un tope mudo de 20.000 filas
escondido en el `for`. Se preservó tal cual (`TOPE_PAGINAS_ESPEJO = 20`) porque bajarlo
dejaría sin inbox a un workspace grande — pero ahora vive en el call-site
(`return nro < TOPE_PAGINAS_ESPEJO`) y, con el orden `desc`, dice lo que hace: **los 20.000
mensajes más recientes**. Lo mismo en los dos routes del onboarding (8.000 / 20.000).

## 4. Qué degrada y qué rompe se decide por dato, no por módulo

En el mismo lote, dos decisiones opuestas y las dos correctas:

- **`getNombresContacto` degrada** a `Map` vacío (`.catch(() => new Map())`): la agenda es
  un adorno del inbox. Sin ella se ve el número; una agenda ilegible **no puede** dejar al
  dueño sin inbox.
- **Los routes del onboarding propagan** el error (500 con mensaje). Antes un fallo en la
  página 1 daba `filas = []` → "no tenés conversaciones", que es el falso all-clear.

**Regla:** la pregunta no es "¿este módulo tolera errores?" sino "**¿qué le decimos al
usuario si esta lectura falla?**". Si la respuesta es una frase que también significa "no
hay nada", tiene que romper.

## 5. "Viene de un formulario" no es excusa cuando no hay formulario

`lib/nutricion-desenlace.ts` movía leads con `setPipelineStage` **sin validar** los
requisitos de la etapa. La justificación general —los callers que vienen de un formulario
ya validaron con lo que la persona acaba de tipear— no aplica: acá es el **cron** del
desenlace, y `logradoEtapa` / `falloEtapa` son **configurables por workspace**. Un cliente
que apunte `logradoEtapa: 'ganado'` escribe la etapa de venta sin monto.

Agravante: el `catch` era un `console.error`, así que el movimiento fallido no dejaba
rastro **ni en `lead_audit` ni en la respuesta**.

**Dónde:** los dos call-sites usan `moverLeadAuto()` (`lib/leads.ts:1725`), el mismo helper
que el motor del CRM: valida, y si falta algo no mueve y escribe el porqué en el historial.

**Regla:** un caller automático que escribe una etapa **que configura el cliente** valida
siempre. Hoy no rechaza nada porque esas etapas no tienen requisitos; la validación es la
garantía para el día que un funnel de cliente se los ponga.

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### Con el envío en simulado, el tracking de email se pierde para siempre

Con el envío real apagado o el remitente en sandbox, `procesarEnvios` registra la fila como `'simulado'` **sin `proveedor_id`** — y el webhook de Resend matchea justamente por ese id, así que `abierto_at`/`clic_at` de esas filas quedan vacíos y no hay backfill posible después. Encima algunos KPIs cuentan `'simulado'` como enviado, así que la tasa de apertura sale artificialmente en 0. Dos vecinos del mismo insert: `nutricion_envios.error` no se escribe nunca (el insert omite la columna que la migración 0034 previó, así que el motivo del fallo se pierde), y el secreto del link de baja cae a `SUPABASE_SERVICE_ROLE_KEY` si no hay `UNSUBSCRIBE_SECRET` — el día que esa key rote, todos los links de baja ya enviados dejan de validar.

**Vive en:** lib/nutricion.ts:642 (procesarEnvios), lib/email-marketing.ts, app/api/email/unsubscribe · *2026-07-02 audit-automatizaciones-lead (+ 2026-07-19)*

#### Toda la voz de MaKo sale por UNA instancia y no hay fallback ante fallo

Síntoma: el cron corrió bien, creó las propuestas, y el aviso nunca llegó a WhatsApp; el log solo decía «Evolution 400». Causa real: TODO envío de MaKo (avisos, doer, chat admin, flujos, reportes, y hasta crear grupos) pasa por `instanciaVoz()`, que lee el setting `mako.voz.instancia` del ws1. Con esa instancia caída, MaKo queda mudo para TODOS los workspaces a la vez. El `INSTANCIA_VOZ_DEFAULT = 'mako_ws1'` NO es un fallback ante fallo: solo aplica si la setting está vacía, y no hay health-check previo. La regla: antes de culpar al emisor, mirá qué instancia resuelve `instanciaVoz()` y su `connectionState`.

**Vive en:** lib/mako-grupo.ts:26-36 e instanciaVoz(); setting app_settings ws1 `mako.voz.instancia` · *2026-07-29 · ~forense-canal-mako-mudo*

#### Una instancia sin fila en evolution_instancias se cae y nadie se entera

`mako_superadmin` —la línea que le da voz a MaKo— no tiene fila en `evolution_instancias`. El webhook de `connection.update` hace `update ... .eq('instance_name', ...)` y afecta 0 filas: la caída no se registra en ningún lado, no aparece en ninguna pantalla y el estado sigue diciendo lo de siempre. Peor: `repararWebhook()` resuelve el nombre con `instanceNameDeWs(ws) → mako_ws<id>`, así que el botón «Reparar espejo» NUNCA alcanza esa instancia; la única vía por app es `POST /api/admin/mako-doer {action:'preparar-voz'}`, que no tiene botón en ninguna parte del repo. La regla: si una instancia no está en la tabla, no está monitoreada ni reparable.

**Vive en:** app/api/webhooks/evolution/route.ts:28-37 y :101; lib/evolution.ts (repararWebhook); tabla evolution_instancias · *2026-07-29 · ~forense-canal-mako-mudo (confirmado de nuevo el 2026-08-05)*

#### En Evolution, «connecting» no significa que se esté por conectar

`GET /instance/connectionState` decía `close` y `GET /instance/fetchInstances` decía `connecting` para la misma instancia, al mismo tiempo. No es un bug de reporte: son dos fuentes distintas — `connectionState` lee memoria y `fetchInstances` lee la fila de Postgres. En 2.3.7 el valor `connecting` de la fila se escribe SOLO dentro del bloque que emite QR, o sea que es el rastro del último QR emitido, no un estado en curso. Y `setInstance` auto-conecta al bootear todo lo que esté en `open` o `connecting`, así que cada reinicio del contenedor repite el ciclo QR → límite → close indefinidamente. Si `disconnectionAt` es null pero pidió QR, la sesión está invalidada: hay que re-escanear.

**Vive en:** Evolution API v2.3.7 (externo); se consulta desde lib/evolution.ts y lib/mako-canal.ts (estadoCanalMaKo) · *2026-07-29 · ~forense-canal-mako-mudo*

#### El dedup de los avisos es por TIPO, no por entidad

`emitirAviso`/`emitirDelCatalogo` dedupean con una key `mako.aviso.last.<tipo>` por workspace. Si le pasás `dedupTtlMin` a un evento discreto (un lead nuevo, un pago, un mensaje entrante), el SEGUNDO lead dentro de la ventana se traga en silencio: nunca te enterás de que no avisó. Regla: eventos discretos van SIN dedupTtlMin y se protegen con una guarda de transición (estado previo ≠ nuevo); los agregados de cron (cobranza, salud de Meta) sí llevan dedup. Si necesitás dedup por entidad, no uses el catálogo: llamá `emitirAviso` directo con un `tipo` compuesto tipo `reunion-no-show:{leadId}:{j1|j2}`.

**Vive en:** lib/avisos.ts (emitirAviso, emitirDelCatalogo); catálogo en lib/avisos-catalogo.ts · *2026-07-14 · mako-cableado-avisos*

#### El reparador de webhooks compara la URL completa, así que tras mudar de dominio no reconoce el suyo

`webhooksPropios()` filtra con `sinQuery(h.url) === sinQuery(esperada)`, y `esperada` incluye el HOST. Al cambiar el dominio, el webhook propio deja de matchear, `propios` queda vacío, `repararWebhookChatwoot()` entra por la rama «no hay ninguno» y hace POST creando UNO NUEVO en vez de PATCH — y el DELETE de duplicados nunca corre sobre los viejos. Consecuencia medida: dos webhooks entregando, cada mensaje entrante disparando el receiver dos veces, avisos duplicados al dueño y turnos duplicados contaminando la memoria del doer. El gemelo del mismo error: `estadoWebhook()` de Evolution compara contra `APP_BASE_URL` y devuelve `no_registrado`, así que dos clientes reales veían «el webhook no está activado» mientras los mensajes entraban perfecto. Comparar por `pathname`, nunca por URL completa.

**Vive en:** lib/chatwoot.ts:693 y :732-734 (webhooksPropios); lib/evolution.ts:380 (estadoWebhook); app/whatsapp/EvolutionConnect.tsx:240 · *2026-08-05 · ~auditoria-mudanza-dominio*

#### El generador de emails escribe para el negocio de Mauricio, no para el del cliente

El SYSTEM de /api/email/generar arranca literal con «Sos MaKo escribiendo EMAIL MARKETING para Mauricio Bustos (consultor: Negocio que Escala™)» y más abajo ordena usar https://calendly.com/mauriciobustoseguia/60min como link de agenda. No lee el perfil del workspace ni la guía de voz destilada: solo pasa por brandSystem(). Cualquier cliente que toque «generar email» en /email recibe copy de OTRO negocio, con el link de agenda de otro y en voseo aunque su audiencia sea mexicana. El contraste está en el mismo dominio: lib/nutricion-generator.ts sí inyecta perfil + funnel + guía de voz + estrategia. Verificado el 2026-08-07: sigue vivo, hardcodeado en las líneas 18 y 23.

**Vive en:** app/api/email/generar/route.ts (líneas 18 y 23) · el molde correcto está en lib/nutricion-generator.ts:265-283 · *2026-08-07 · ideas-content-machine*

#### Desbloquear en WhatsApp resucita a un lead que estaba descalificado por otra razón

Al desbloquear un contacto, la ruta hace `else if (estado === 'descalificado')` → estado_lead 'abierto', motivo_perdida null y pipeline_stage null. La condición asume que TODO lead descalificado lo está por culpa del bloqueo, y el comentario del código lo dice explícito («el bloqueo es lo que descalifica acá»). Falso: `bloqueado` viene del contacto de Chatwoot y `estado_lead` del lead, coexisten, y un closer o el formulario pueden haber descalificado antes. Un lead legítimamente descalificado que alguien bloquea y desbloquea vuelve a «abierto» y pierde su motivo histórico. Verificado el 2026-08-07: la rama de bloquear YA se arregló (solo mueve si el lead estaba 'abierto'), pero la de desbloquear sigue revirtiendo a ciegas. La regla: un deshacer que no guarda quién puso el estado no es un deshacer, es un pisado.

**Vive en:** app/api/whatsapp/contacts/[id]/block/route.ts (rama `else if (estado === 'descalificado')`) · *2026-06-23 · ~review-inbox-whatsapp*

#### Las plantillas de avisos son GLOBALES aunque la UI las muestre por workspace: si un cliente apaga un aviso, lo apaga para todos

Síntoma: un aviso deja de llegarle a un cliente sin ningún error — `emitirDelCatalogo` devuelve `{ ok: true, deduped: true }`, o sea éxito. Causa real: el store de plantillas vive en `app_settings` bajo `mako.plantillas.store` y se lee y se escribe SIEMPRE dentro de `runWithWorkspace(OWNER_WS, …)`, así que el texto de cada plantilla y su on/off no son por inquilino: son uno solo para toda la instalación. `emitirDelCatalogo` consulta `plantillaActiva(id)` antes de mandar y, si otro workspace la desactivó, se traga el aviso con un ok. Sigue vivo hoy (verificado en lib/plantillas.ts:32 y :37, y lib/avisos.ts:157). La regla que queda: un store montado a mano sobre OWNER_WS es global aunque la pantalla que lo edita se vea dentro de un workspace; antes de exponer un toggle por cliente, mirá con qué ws se resuelve el `getSetting`, y nunca devuelvas `ok: true` para «apagado» — apagado y enviado no son el mismo resultado.

**Vive en:** lib/plantillas.ts:32,37 (store `mako.plantillas.store` en app_settings) y lib/avisos.ts:157 (`emitirDelCatalogo`) · *2026-08-02 · ~investigacion-rediseno-chat-agent-17-puntos*

#### Un «Cargando…» que no termina nunca no puede ser una query vacía ni un error: es un request que no resuelve

Síntoma: el hilo del inbox no oficial se quedaba en «Cargando…» para siempre. Los tres diagnósticos obvios eran los equivocados y se descartaron por razonamiento mecánico, sin tocar la base: si el `chat_jid` no matcheaba la query volvía vacía y la UI pinta «Sin mensajes»; si el server tiraba, el catch devuelve 500 y la UI pinta el error con botón Reintentar; si el ref de selección se desincronizaba, el siguiente `loadMsgs` apagaba el loading igual. Toda respuesta que RESUELVE cae en poblado, vacío o error — ninguno de esos estados sostiene un spinner. La causa era la única I/O que el hilo tenía de más respecto de la lista (que sí cargaba): `getMensajesDeChat` firmaba la media con `createSignedUrl` en un loop secuencial con await, y ese llamado al storage no resolvía. La regla doble: (1) al diagnosticar, dejá que el síntoma descarte causas — «eterno» acusa a un request colgado, no a un dato faltante; (2) todo fetch que alimenta un spinner necesita AbortController con timeout, si no un backend colgado se convierte en una pantalla sin error y sin salida. El firmado ya pasó a batch (`createSignedUrls` con try/catch: si el storage falla se sirve el hilo sin media) y `loadMsgs` ya tiene su controller, pero el `jget` genérico de EmpresaInbox:51 —el que trae la LISTA— sigue sin `signal`.

**Vive en:** lib/evolution-mensajes.ts (firmado de media de `getMensajesDeChat`) y app/whatsapp/EmpresaInbox.tsx:51 (`jget` sin AbortController) · *2026-07-10 · wa-no-oficial-paridad-diagnostico*

#### Un fallo que no avanza se queda a la cabeza de la cola y mata el motor de nutrición entero

Con WhatsApp habilitado, «lead sin teléfono» y «paso sin template_wa» se marcaban `fallo` sin `terminal`, y un fallo no terminal no avanza `paso_actual` ni toca `proximo_envio_at`. Como la ventana de trabajo es `limit(cupo*3)` (18 filas) ordenada por `proximo_envio_at` ASC, esas inscripciones conservan el timestamp más viejo y ocupan las primeras posiciones en TODAS las corridas: con 18 leads sin teléfono en un workspace, la ventana queda 100% llena de fallos que ni siquiera consumen cupo y no vuelve a salir un solo envío real, sin recuperación y sin ninguna señal. Además insertan una fila de `fallo` por corrida, para siempre. Regla: todo estado de error de una cola tiene que avanzar el paso (terminal) o correr el `proximo_envio_at` (backoff) — si no hace ninguna de las dos, no es un fallo: es un bloqueo de cabecera.

**Vive en:** lib/nutricion.ts (procesarEnvios: fetch de vencidas + marcado de fallo; ya tiene backoff) · *2026-07-09 ~review-canal-email*

#### Matchear el texto del error de un proveedor es matchear algo que el proveedor nunca prometió

`createResendDomain` era «idempotente»: ante un fallo del POST buscaba el dominio por nombre solo si el mensaje matcheaba `/already exists|ya existe/i`. Resend responde «The `x.com` domain has been registered already» — «registered», no «exists» — y encima no localiza sus errores, así que la rama `ya existe` jamás matcheaba: el flujo de reconectar (desconectar deja el dominio vivo en la cuenta) devolvía 502 y el usuario quedaba trabado sin poder recuperar su propio dominio. Regla: discriminá por status o por el campo `name` del error, o directamente hacé el list-lookup ante cualquier 4xx; el `message` es copy del proveedor, no un contrato.

**Vive en:** lib/resend.ts:303-305 (ya reescrito: 4xx → buscar por nombre) · *2026-07-09 ~review-canal-email*

#### Los reportes salen por default y su email no mira el flag de envío

`DEFAULT_PREFS` trae horario/diario/semanal con `activo:true` (diario y semanal además con email), así que sin configurar nada los reportes SALEN. Y `lib/notify.ts` importa `sendEmail` directo, sin consultar `EMAIL_SEND_ENABLED` ni el setting por workspace: apagar el envío de email marketing no apaga los reportes. Son dos canales distintos con la misma cañería, y el flag que todo el mundo asume global cubre uno solo. Sigue vivo.

**Vive en:** lib/perfil.ts:125-130 (DEFAULT_PREFS) y lib/notify.ts:17,60 · *2026-07-09 ~mapa-app-doer*

#### Tres almacenes de teléfono que parecen uno solo, y cambiar el del grupo no cambia el de los reportes

`mako.numero_dueno` (app_settings por workspace) crea y sincroniza el grupo de MaKo; `user_telefono` (app_settings por workspace) es a dónde el CRON manda los reportes; `usuarios.perfil.telefono` es solo dato de perfil de la persona. `setNumeroDuenoYSync` escribe el primero y NO el segundo, así que quien cambia su número desde la card «Tu WhatsApp» sigue recibiendo la apertura diaria de la plantilla en el teléfono viejo. El falso positivo más peligroso es el campo «Teléfono» de /perfil: parece lo mismo y no toca el grupo. Hoy solo el wizard del onboarding los sincroniza juntos — y esa card es el ÚNICO lugar donde un usuario que ya terminó el onboarding puede cambiar el número (el wizard es inalcanzable con status 'done'), así que borrarla deja al workspace sin grupo y todo aviso falla con un console.error.

**Vive en:** lib/mako-grupo.ts:244 (setNumeroDuenoYSync) · lib/perfil.ts:122 (getContactoReportes) · app/api/cron/reporte-diario/route.ts:27 · app/perfil/NotificacionesPanel.tsx:96 · *2026-08-06 · rediseno-notificaciones*

#### El interruptor de avisos no era el problema: el aviso del cliente se va al grupo de la AGENCIA

Síntoma: el cliente apaga un aviso en /configuraciones y el aviso sale igual. El diagnóstico obvio («el gate lee las prefs del workspace equivocado») lo refutó un verificador: el gate lee el mismo ws al que se ENTREGA, así que respecto del destinatario está bien. La causa real es de ruteo: `const ws = a.ws ?? OWNER_WS` ignora el contexto ambiente, y 8 emisores corren dentro de `runWithWorkspace(wsDelCliente)` sin pasar `ws` (webhooks de chatwoot/meta-leads/calendly/fathom, retro-pipeline, todo-seeds, ads-manager/ad-aprobacion) — el WhatsApp del cliente termina en el grupo del dueño, y de yapa su interruptor queda decorativo. Ojo con el mecanismo: `avisoWaActivo` hace `runWithWorkspace(1, …)`, que PISA el AsyncLocalStorage del webhook. Se arregla en el choke point (`a.ws ?? (await getWorkspaceActual()) ?? OWNER_WS`), no en los 8 call-sites.

**Vive en:** lib/avisos.ts:71 y :89 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

#### Apagar un aviso envenena su dedup: al volver a prenderlo sigue mudo hasta 3 días

La rama de «apagado» llama igual a `marcarAvisado(ws, tipo)`, así que la marca `mako.aviso.last.<tipo>` se refresca durante el silencio. Al reprender el interruptor, `avisadoReciente()` encuentra una marca fresca escrita mientras nadie recibía nada y devuelve `deduped:true` sin enviar — con `tracking-apagado` (TTL 3 días) el primer WhatsApp llega hasta 3 días después. Regla: un gate que corta un envío no debe tocar el estado de dedup de ese envío; si querés conservar el anti-spam del feed, usá una key aparte (`${tipo}#mute`).

**Vive en:** lib/avisos.ts:89-92 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

#### `enviarBorrador` es check-then-act: dos setters mandan el mismo WhatsApp dos veces

SELECT del estado → guard `estado !== 'pendiente'` → enviar → marcar 'enviado'. La ventana entre el read y el write es de segundos porque `enviarTexto` bloquea el HTTP durante todo el delay anti-ban (min(1500+len*45, 9000)*1.2 ≈ hasta 10,8 s), así que dos setters sobre la cola compartida (o un doble clic con latencia) pasan los dos el guard y el lead recibe el mensaje duplicado por el número no oficial — exactamente el patrón de spam que la feature existe para evitar. El espejo no lo tapa: cada envío devuelve un `wa_message_id` distinto, así que entran dos filas y salen dos WhatsApp. El guard `borrBusy` de la UI protege un solo navegador, no la cola. Arreglo: claim atómico (`UPDATE ... SET estado='enviando' WHERE id=? AND estado='pendiente' RETURNING ...`).

**Vive en:** lib/evolution-envio.ts:106-117 · *2026-07-09 ~auditoria-envio-evolution-nutricion*

#### `esLeadCliente` llama «cliente» a un 'ganado' que todavía no pagó

`estado_lead === 'ganado' || !!fecha_primer_pago`, con un docstring que dice «pagó». El propio motor demuestra que 'ganado' no implica pago: la cohorte `confirmado_sin_pago` selecciona justamente leads con `estado_lead IN ('abierto','ganado')` y `fecha_primer_pago IS NULL`. En la rama no_oficial eso manda al lead por `enviarYEspejar` (automático directo) en vez de `crearBorrador`, violando la regla dura «automático directo SOLO a clientes que ya pagaron» — y sobre el lead recién confirmado, que es exactamente el caliente que la cola de borradores existe para proteger del riesgo de ban. Es el único hueco por donde un no-pagador recibe auto-send.

**Vive en:** lib/evolution-envio.ts:17-22; lib/nutricion.ts:309-320 y :631-648 · *2026-07-09 ~auditoria-envio-evolution-nutricion*

#### El borrador avanza el paso igual, así que se apilan y descartarlo pierde el toque

Crear un borrador no es 'fallo', así que la inscripción avanza `paso_actual` y agenda el siguiente en cadencia, sin importar si el setter lo mandó. Dos consecuencias sin mitigar: (1) cada paso posterior tiene un `paso` distinto, así que el índice único `(workspace_id, inscripcion_id, paso)` NO dedupea y se acumulan N borradores pendientes del mismo lead caliente — y `leadsConEnvioReciente` solo cuenta estados 'enviado'/'simulado', o sea que un borrador no frena nada; el setter puede dispararlos todos en ráfaga, que es el patrón de ban que la feature evita. (2) `descartarBorrador` solo pone estado='descartado' y nunca toca la inscripción, que ya avanzó: el toque se pierde sin reintento. Aparte, el guard anti-ban de 20 h se evalúa ANTES de ramificar por proveedor, así que difiere hasta 20 h la CREACIÓN de un borrador que no manda nada.

**Vive en:** lib/nutricion.ts:610-613 y :644-648, :746-755; lib/evolution-envio.ts:119-122 · *2026-07-09 ~auditoria-envio-evolution-nutricion*

#### `evFetch` no tiene timeout y el cron de nutrición itera workspaces en serie

El cliente de Evolution llama a `fetch()` sin `AbortSignal`, así que una conexión colgada dura hasta que Vercel mata la función. El cron recorre TODOS los workspaces activos en serie dentro de UNA invocación con maxDuration=300, y cada envío bloquea entre 1,2 y 10,8 s por el delay anti-ban (~65 s por workspace en el peor caso): un solo socket trabado se come la corrida y mata de hambre a los workspaces siguientes. Peor: el envío ocurre ANTES de que se commitee el avance del paso, así que un kill a mitad deja el paso sin avanzar y el mensaje se re-manda en la corrida siguiente. Todo fetch a un proveedor externo lleva `AbortSignal.timeout`.

**Vive en:** lib/evolution.ts:43-64 y :253-258; app/api/cron/nutricion/route.ts:100 · *2026-07-09 ~auditoria-envio-evolution-nutricion*

#### El upsert del espejo borra la media ya guardada en la re-entrega del mismo mensaje

`guardarMensajeUpsert` escribe todas las columnas incondicionalmente con `onConflict (workspace_id, wa_message_id)`. Evolution reenvía `messages.upsert` con el MISMO key.id en dos sabores: 'notify' (en vivo, trae el base64) y 'append' (sync de historial/reconexión, generalmente sin media), y el webhook procesa los dos por igual. La re-entrega sin base64 produce `mediaPath=null` y PISA con null el `media_path` que la primera entrega guardó bien: el archivo queda huérfano en el bucket y se pierde el «respaldo total» que es el objetivo de la feature. Idem `texto`. Regla: en un upsert de espejo, leé la fila primero y no escribas columnas que la entrega actual no puede llenar.

**Vive en:** lib/evolution-mensajes.ts:104-125; app/api/webhooks/evolution/route.ts:89 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

#### Una reacción o un mensaje borrado pausan la nutrición como si fueran una respuesta

`extraerContenido` cae a `{ tipo: messageType, texto: null }` para todo lo que no reconoce —reactionMessage, protocolMessage (borrar/revocar), editedMessage—, y `guardarMensajeUpsert` solo filtra grupos y status. Esas filas entran al espejo como mensajes normales, y como el disparo es `!fromMe && leadId`, una reacción con un pulgar o un mensaje que el lead borró llaman a `pausarPorRespuesta(leadId)`: la inscripción pasa de 'activa' a 'respondio' y se anula `proximo_envio_at` sin que nadie haya contestado. De paso se pintan como burbujas vacías y ensucian el preview de la conversación. Guardar el crudo está bien; lo que falta es segregar los eventos que no son contenido de los caminos de display y de pausa.

**Vive en:** lib/evolution-mensajes.ts:56 y :94-131 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

#### El mime de la media lo elige el remitente y se sirve inline

`extraerContenido` toma `media_mime` verbatim del payload de WhatsApp (`img.mimetype`, `doc.mimetype`, …), `subirMedia` lo pasa tal cual como `contentType` del upload, y `getMensajesDeChat` lo devuelve con una signed URL sin disposition — o sea Supabase lo sirve inline con el content-type que declaró el remitente. El mimetype de un imageMessage lo pone el cliente que envía y es trivialmente forjable con un Baileys modificado: se pueden mandar bytes de HTML/JS declarados `text/html` y quedan almacenados y servidos al inquilino. La migración del bucket `wa-media` no define `allowed_mime_types` ni `file_size_limit`, así que el único freno es el cap de 25 MB de la app. No depende de tener el secreto del webhook: es la superficie normal de la feature.

**Vive en:** lib/evolution-mensajes.ts:45-54 y :86; supabase/migrations/0073 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

#### Comentarios que afirman un orden o un relleno que no existen

Tres casos verificados en el mismo frente, todos con la misma forma: el comentario promete algo que ninguna rama del código hace. (1) `getMessagesForConvs` hace `ids.slice(0,15)` y el comentario dice que los convIds vienen «recent-first» — es falso, se pushean en orden de iteración de páginas, así que con más de 15 conversaciones se corta cualquiera. (2) El espejo escribe `instance_name:''` y `raw:{local:true}` con un «lo completa el webhook si vuelve»: ninguna rama los rellena nunca (si llega primero el eco, el espejo lo PISA; si llega primero el espejo, el patch queda vacío). (3) El matcher de teléfono de Evolution usa `.like('%'+last10).limit(1)` sin `order`, o sea match no determinista, mientras el de Chatwoot ya fue endurecido con `.eq` exacto primero y verificación de los últimos 10 dígitos en JS. Regla: cuando un comentario afirma un orden, un relleno o una garantía, buscá la línea que lo cumple antes de confiar.

**Vive en:** lib/chatwoot.ts:398; lib/evolution-envio.ts:31-42; lib/evolution-mensajes.ts:67-73 vs app/api/webhooks/chatwoot/route.ts:42-59 · *2026-06-23 ~auditoria-inbox-whatsapp-chatwoot + 2026-07-09 ~auditoria-espejo-evolution-inbox*

#### Los `[tu link …]` NUNCA se reemplazan, y tres comentarios del repo juran que sí

Síntoma: mensajes de nutrición que le llegan al lead diciendo literal «te dejo el video de preparación: [tu link del video]». Causa real: `aplicarVariables` (lib/template-vars.ts:41) solo sustituye `{{key}}`/`{key}` contra las 4 claves de `VARIABLES_LEAD` — no hay una sola línea en el repo que toque los corchetes. Peor: `RX_RELLENO` (lib/nutricion.ts:541) los excluye A PROPÓSITO del detector de «copy sin terminar», así que el único control de calidad que existe los deja pasar; y el prompt del generador (lib/nutricion-generator.ts:146) le ordena al modelo «DEJALOS TAL CUAL. El sistema los reemplaza; si los tocás, se rompen». El diagnóstico obvio (el modelo escribió mal) es el equivocado: el modelo obedeció una promesa que el sistema nunca cumplió. Regla: o se implementa el reemplazo (un catálogo de links del negocio, hoy inexistente) o se sacan los `[tu link …]` de los prompts y del `RX_RELLENO` — mientras tanto, cualquier paso que los use sale roto al lead. El contra-ejemplo del mismo archivo muestra el otro extremo: un paso con `[tu nombre]` SÍ matchea `RX_RELLENO` y entonces nunca sale, reagendándose +24h en cada corrida sin que nadie se entere.

**Vive en:** lib/nutricion.ts:539-543 (RX_RELLENO) · lib/template-vars.ts:41 (aplicarVariables) · lib/nutricion-generator.ts:146 · lib/setting-simulador.ts:30 · *2026-08-02 ~investigar-onboarding-chat-agent*

#### `requiere: 'sin_respuesta'` está declarado, sembrado y pintado en la UI — y el motor no lo evalúa nunca

Síntoma: un paso que la pantalla promete como «Solo si el lead no respondió» sale igual aunque el lead haya contestado. Causa real: el valor existe en el tipo (`PasoSecuencia.requiere`), sobrevive al normalizador de `setSecuenciaPasos` (lib/nutricion.ts:252) y lo usa una plantilla real (lib/secuencias-audios.ts:114), pero el loop de `procesarEnvios` solo tiene ramas para `'respondio'`, `'ya_contactado'` y `'primer_contacto'` — `'sin_respuesta'` cae al camino normal. La condición no falla: no existe. Regla: un valor nuevo de `requiere` toca TRES lugares (tipo + normalizador + rama del loop del motor); si falta la tercera, el compilador no dice nada y la UI queda mintiendo. Antes de agregar un condicional nuevo, buscar el `if (paso.requiere === …)` del loop y confirmar que el valor esté ahí.

**Vive en:** lib/nutricion.ts:944-965 (loop de procesarEnvios) · lib/secuencias-audios.ts:114 · app/api/chat-agent/onboarding/resumen/route.ts:67 · *2026-08-02 ~investigar-onboarding-chat-agent*

#### after() de Next no garantiza que la invocación sobreviva, y Evolution no reintenta

El webhook de Evolution es fire-and-forget: encola el doer en after() y devuelve 200 (app/api/webhooks/evolution/route.ts). Eso da lugar para esperar (maxDuration 300), pero NO es un lugar durable: si la instancia se congela o se recicla, el trabajo pendiente se pierde sin retry — el 200 ya salió y Evolution no reintenta. El único rastro sería un console.error. Cuanto más se espere dentro del after (que es exactamente lo que hace un buffer de mensajes), más grande la ventana de pérdida silenciosa. Regla para el buffer: persistir en DB ANTES de devolver el 200, y que el cron de red barra los huérfanos.

**Vive en:** app/api/webhooks/evolution/route.ts:133-152 · lib/mako-doer-in.ts · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

#### El doer arranca ESCUCHANDO por default, al revés que los flags de envío

mako.doer.activo tiene default ON (solo el string 'false' lo apaga), mientras que envio_email_enabled / envio_whatsapp_enabled / crm_auto_enabled son fail-closed a propósito: un workspace SIN la setting queda apagado. La asimetría importa al clonar o crear un workspace: no hace falta copiar nada para que el doer quede activo, queda solo. Y si además se copia la allowlist mako.doer.grupos, el ws nuevo escucha los grupos REALES del otro y MaKo responde dos veces cada mensaje.

**Vive en:** lib/mako-doer-in.ts:41 (KEY_ACTIVO) · lib/envio-flags.ts · *2026-08-01 · mapa-clonar-workspace*

#### 18 de las 29 plantillas de docs/nutricion-templates.md arrancan con {{nombre}}, que es rechazo automático de Meta

La investigación de las reglas de aprobación (fuentes oficiales de Meta + checklists de la industria) dejó una rúbrica con bloqueantes, y el primero es: el body NO puede empezar ni terminar con una variable — una plantilla "demasiado rellenable" se lee como infraestructura de spam y se rechaza sola. El archivo que hoy es fuente de verdad para cargarlas tiene 18 plantillas que empiezan literal con `{{nombre}},`. Los otros bloqueantes que valen para el generador de MaKo: ratio de texto fijo ≈ 3×(nº de variables)+1, cada variable con su sample obligatorio, nada de acortadores ni links `wa.me`, footer sin variables ni emojis, y nombre en snake_case sin "test". Y dos cambios de enforcement: desde abr-2025 Meta recategoriza UTILITY→MARKETING sola (y desde el 16/4 sin el aviso previo de 24h) — una utility con redacción persuasiva empieza a costar como marketing sin que toques una palabra.

**Vive en:** docs/nutricion-templates.md (18 plantillas) · lib/nutricion-plantillas.ts (el generador que hoy las escribe) · lib/meta-rules.ts · *2026-06-24 ~map-secuencias-y-plantillas-meta*

#### Chatwoot acepta y Meta rechaza después: la UI dice «enviado» para algo que nunca se entrega

El route de adjuntos responde `ok:true` en cuanto Chatwoot crea el mensaje saliente; el rechazo de Meta llega asincrónico y el mensaje queda en el hilo marcado failed sin ningún aviso. Pasa por tres motivos que el código no valida: tipo de archivo (el `accept` del input es cosmético, cualquiera postea al route), tope por tipo (WhatsApp corta imágenes en 5 MB mientras el route usa un cap único de 16 MB) y ventana de 24h cerrada (la guarda es solo de UI, sobre un snapshot polleado cada 20s). Regla: un 200 de Chatwoot NO es una entrega — validar allowlist de MIME y tope por tipo antes de mandar, y para lo que no se pueda validar, que la UI diga «encolado», no «enviado».

**Vive en:** app/api/whatsapp/contacts/[id]/attachments/route.ts + lib/chatwoot.ts (sendAttachmentToContact) · *2026-06-23 ~review-adjuntos-whatsapp*

#### El aviso paga la llamada al modelo ANTES de decidir si el aviso sale

En `emitirDelCatalogo` el texto se genera con IA (`generarMensajeAviso` → chatClaude, feature 'avisos') en `lib/avisos.ts:158-159`, pero el dedup por `dedupTtlMin` y el interruptor `avisoWaActivo` se evalúan DENTRO de `emitirAviso` (:86, :106). O sea: se paga Sonnet igual cuando el aviso se dedupea o está apagado. Y 6 de los 13 call-sites viven en webhooks; `wa-mensaje-entrante` dispara por CADA mensaje, así que con la ráfaga ya conocida de 16 mensajes en 4 segundos son 16 llamadas al modelo adentro de un handler de webhook. Regla: la redacción va después del gate, nunca antes, y los avisos de alto volumen se quedan con texto fijo (`texto:`), no con `contexto:`.

**Vive en:** lib/avisos.ts (emitirDelCatalogo :158-159 vs emitirAviso :86,:106) + lib/plantillas.ts:147-153 · *2026-08-06 mila-ia-nativa*

#### `{{1}}` con parameter_format NAMED = rechazo de Meta sin explicación

El regex de `detectarVars` era `/\{\{\s*([a-z0-9_]+)\s*\}\}/gi`, así que aceptaba `{{1}}` y `{{123}}` como nombre de variable; `syncParams` generaba `param_name:'1'` y `buildGraphPayload` mandaba siempre `parameter_format:'NAMED'`. Meta rechaza con error 100 porque `{{1}}` es sintaxis POSITIONAL. La trampa: existía una validación de nombre (`/^[a-z0-9_]+$/`) que hacía creer que estaba cubierto, pero valida el nombre de la PLANTILLA, no las variables del cuerpo. La regla: el regex que extrae variables tiene que exigir que empiecen con letra o `_`, y el backend debe rechazar un body con `{{\d}}` o con una `{{var}}` que no esté en `params[].name` antes de gastar el viaje a Meta.

**Vive en:** app/whatsapp/PlantillasPanel.tsx (detectarVars) + lib/meta-templates.ts buildGraphPayload · *2026-06-24 ~review-plantillas-whatsapp-meta*

#### «Meta respondió 200» no es «Meta te dio el id»

`submitTemplate` devolvía `{ok:true, metaId: j.id}` sin verificar que `j.id` existiera. Si Meta contestaba ok pero sin id, el borrador se guardaba con `meta_template_id: null` y quedaba en `pending` para siempre: `reconcileDrafts` sólo podía matchear por `name::language`, un match frágil de por vida (y si la plantilla todavía no se refleja en la lista de Meta, nunca se actualiza). La regla: tras el chequeo de `res.ok`/`j.error`, validar explícitamente el campo que necesitás para reconciliar y fallar ahí — un id ausente cuesta más que un error.

**Vive en:** lib/meta-templates.ts submitTemplate + enviarBorradorAMeta + reconcileDrafts · *2026-06-24 ~review-plantillas-whatsapp-meta*

#### Un `.catch(() => [])` atrapa el error pero no la lentitud

El GET de plantillas hacía `Promise.all` con `listMetaTemplates().catch(() => [])` y eso daba sensación de estar cubierto. No lo estaba: los `fetch` a Graph no tenían `AbortController` ni timeout, así que si Meta tardaba 25s el `Promise.all` esperaba igual y el usuario veía carga infinita — el catch nunca se dispara por lentitud. La regla: degradar con `.catch` sólo tapa la mitad; toda llamada a un tercero en el camino de una pantalla necesita además un timeout explícito (~8s). No hace falta cola ni retry: timeout + el catch existente alcanza.

**Vive en:** lib/meta-templates.ts (fetch de submitTemplate/listMetaTemplates) + app/api/whatsapp/templates/drafts/route.ts · *2026-06-24 ~review-plantillas-whatsapp-meta*

#### Dos contadores del mismo segmento que no cuentan lo mismo

`contarSegmento` contaba todos los ids del segmento y `leadsDeSegmento` filtraba además por `!!l.email`. Resultado: la UI mostraba «N destinatarios» y el envío resolvía 0 — y como `enviarBroadcast` marcaba `estado='enviado'` de forma incondicional (con `total_destinatarios: 0`) y el guard de re-entrada es `if (b.estado === 'enviado') return error`, el broadcast quedaba bloqueado para siempre mostrando «Listo: 0 enviados (de 0)» como éxito. Dos trampas juntas: el preview y el envío usaban criterios distintos, y un envío vacío consumía el estado terminal. La regla: el contador que ve el usuario y la lista que se envía salen de la MISMA función; y sólo se marca 'enviado' cuando `total_destinatarios > 0`.

**Vive en:** lib/email-marketing.ts (contarSegmento / leadsDeSegmento / enviarBroadcast) · *2026-06-30 ~auditoria-email-marketing-resend*

#### El guard anti-doble-contacto vivía en una tabla y los broadcasts escribían en otra

`leadTuvoEnvioReciente` consultaba sólo `nutricion_envios`, y `enviarBroadcast` escribía en `email_broadcast_envios` sin consultar ningún guard. El hueco era bidireccional: un lead en una secuencia activa que además caía en el segmento de un broadcast podía recibir 2-3 correos en la misma hora. Lo peor era el comentario de la migración 0046, que afirmaba que broadcasts y secuencias «comparten el guard de 20h» — documentación que sobre-promete y hace que nadie vuelva a mirar. La regla: un guard por-lead tiene que consultar TODAS las tablas donde se registra un contacto con ese lead; si agregás una tabla de envíos nueva, sumala al guard en el mismo commit.

**Vive en:** lib/nutricion.ts leadTuvoEnvioReciente + lib/email-marketing.ts enviarBroadcast (mig 0046) · *2026-06-30 ~auditoria-email-marketing-resend*

#### Un estado terminal marcado como 'fallo' se reintenta para siempre

Con el envío real prendido, un lead con `email_opt_out` o sin email se registraba como `estado='fallo'`, y el manejo de 'fallo' hacía `continue` sin avanzar `paso_actual` ni cerrar la inscripción («se reintenta»). Como `leadTuvoEnvioReciente` sólo cuenta 'enviado'/'simulado', las filas 'fallo' no activaban el guard de 20h: cada corrida del cron volvía a elegir al mismo lead e insertaba otra fila basura, sin tope y sin unique constraint que lo frenara. La regla: distinguí fallo TRANSITORIO (red, 5xx del proveedor) de condición TERMINAL (opt-out, sin dato de contacto). Lo terminal avanza el paso o cierra la inscripción; sólo lo transitorio reintenta.

**Vive en:** lib/nutricion.ts procesarEnvios (manejo de 'fallo' vs 'saltado') + nutricion_envios · *2026-06-30 ~auditoria-email-marketing-resend*

#### Sin CHATWOOT_WA_INBOX_ID los mensajes del cliente salen por el inbox del dueño

`cfg()` en lib/chatwoot.ts:30 hace `const inbox = Number(inboxRaw ?? '3')`. Los otros tres valores (base, account, token) tiran error si faltan; este INVENTA uno, y el 3 es el inbox de WhatsApp del dueño. Encima el catálogo marca `CHATWOOT_WA_INBOX_ID` como `opcional: true` (lib/metodo-catalogo.ts:139), así que un cliente puede terminar el onboarding sin cargarlo y quedar con plantillas y nutrición apuntando a un inbox ajeno. Regla: en una config por-workspace, un default numérico que apunta a una entidad real de otro inquilino no es un default, es una fuga.

**Vive en:** lib/chatwoot.ts:30 (cfg) + lib/metodo-catalogo.ts:139 · *2026-07-16 · ~censo-features-onboarding*

#### En findMessages de Evolution, `offset` es el tamaño de página, no el desplazamiento

Pedir la "página 2" con offset:50 devuelve otra vez lo mismo. En Evolution v2.3.7 `offset` es el take (default 50) y el skip lo calcula el server como offset*(page===1?0:page-1); findChats, del mismo controlador, en cambio usa take/skip crudos. Además findMessages NO devuelve un array: devuelve `{messages:{total,pages,currentPage,records:[...]}}` ordenado por messageTimestamp DESC (epoch en segundos), y findChats sí devuelve array plano pero armado desde la tabla Message, así que un contacto sin mensajes no aparece nunca. Regla: contra Evolution, parsear defensivo las dos formas y no asumir que dos endpoints del mismo controlador paginan igual.

**Vive en:** lib/evolution.ts (evFetch) → POST /chat/findMessages/{instance} y /chat/findChats/{instance} · *2026-07-10 evolution-live-pull-research*

#### La foto de perfil de WhatsApp no se puede guardar: las URLs caducan

Las URLs de pps.whatsapp.net son firmadas por el CDN de Facebook con los params `oh` (firma) y `oe` (expiración): caducan en horas o días y después el <img> queda roto con 403. Guardarlas en la base como si fueran permanentes es el error; hay que re-fetchearlas con /chat/fetchProfilePictureUrl (en vivo) o bajar los bytes al bucket propio, y renderizar con referrerPolicy="no-referrer" porque el CDN puede rechazar por Referer. Ojo también con la fuente: el `profilePicUrl` que trae findChats/findContacts sale de la tabla Contact cacheada y puede venir null, vacío o stale. Del lado Chatwoot el equivalente es `meta.sender.thumbnail`, que manda cadena vacía —no null— cuando el contacto no tiene foto.

**Vive en:** lib/evolution.ts (fetchProfilePic), lib/chatwoot.ts (mapConv/ConvRaw) · *2026-07-10 evolution-live-pull-research*

#### El estado 'error' de Evolution viaja con ok:true y el onboarding te ofrece re-escanear el QR

Con Evolution caído (host inalcanzable, timeout, 5xx) `estadoEnVivo()` devuelve `{estado:'error'}` y la ruta lo envuelve en `Response.json({ ok:true, ...s })`. El onboarding chequea solo `j.ok && j.estado`, guarda 'error', no matchea ninguna rama y cae al último else: le muestra "Generar código QR" a un número que ya estaba vinculado — y re-escanear tumba la sesión viva. EvolutionConnect.tsx ya compensaba a mano con `body.ok && body.estado !== 'error'`; el onboarding se olvidó esa mitad de la guarda, y 'conectando' tampoco tiene rama. Regla: un `ok:true` con un campo `estado:'error'` adentro es una mentira de contrato; si no se pudo comprobar, que la ruta devuelva ok:false o un 'desconocido' explícito. Dato útil: `estadoEnVivo` corta con return ANTES del upsert, así que el 'conectado' cacheado en evolution_instancias sigue siendo confiable como respaldo.

**Vive en:** lib/evolution.ts:242 (estadoEnVivo), app/api/whatsapp/evolution/route.ts:68, app/chat-agent/OnboardingChatAgent.tsx:407-418 · *2026-08-05 ~verificar-commits-contra-el-board*

#### MaKo no le contestó a NINGÚN cliente por WhatsApp durante dos semanas y no quedó ni una traza

El onboarding crea el grupo oficial de cada cliente (asegurarGrupoMaKo) pero NUNCA lo agrega a la allowlist `mako.doer.grupos`, que solo se escribe desde una acción manual del super-admin. `manejarEntranteDoer` cortaba en la segunda línea con skip:'grupo no habilitado', antes de resolver workspace o IA. Lo que lo volvió invisible fueron dos cosas más: los entrantes de GRUPO no se espejan en ninguna tabla (el webhook manda a guardarMensajeUpsert solo los 1-a-1) y el webhook descarta el ResultadoDoer sin loguearlo, así que un mensaje descartado es indistinguible de uno respondido y el 200 sale igual. Como MaKo sí mandaba avisos SALIENTES por ese mismo grupo, parecía funcionar. Reglas: espejar el entrante ANTES de evaluar los gates, y loguear el motivo del skip. Al habilitarlos, ojo con el modo default 'libre': MaKo contesta CADA mensaje del grupo, incluida la charla del cliente con su equipo, con un loop de tools de Claude por mensaje.

**Vive en:** lib/mako-doer-in.ts (manejarEntranteDoer, modoDoer), app/api/webhooks/evolution/route.ts:123-150, lib/mako-grupo.ts:183 · *2026-08-01 auditoria-plan-y-whatsapp*

#### `requiere:'sin_respuesta'` es metadata muerta: el bucle de envío no lo mira nunca

El valor existe en el tipo de PasoSecuencia, se conserva al normalizar y se pinta como etiqueta en la UI del resumen, pero el bucle de envío solo tiene ramas para 'ya_contactado'/'primer_contacto' y 'respondio'. Toda la red de seguridad que se le atribuye ("no mandes el recordatorio si ya contestó") no existe. Del mismo flujo: `pausarPorRespuesta` trata igual un "sí, confirmo" que un "no puedo, cambiámelo" —pone la inscripción en 'respondio'— y el destrabe posterior solo reactiva secuencias que tengan un paso con requiere==='respondio', así que el lead que confirma queda en un callejón sin salida; y como las secuencias de armarSecuenciasDeAudios nacen con `estrategia` NULL, `asistirRespuesta` retorna en silencio: ni aviso al dueño ni borrador. Regla: un valor que el motor no evalúa no es una garantía aunque el tipo y la UI lo muestren.

**Vive en:** lib/nutricion.ts:59 (tipo), :946 y :964 (el bucle), :1249 pausarPorRespuesta, :1305 asistirRespuesta; lib/secuencias-audios.ts · *2026-08-05 ~verificar-commits-contra-el-board*

#### `CHATWOOT_WA_INBOX_ID` vacío cae al inbox 3 — el de Mauricio — contra la cuenta del cliente

Un default que inventa un dato. `cfg()` hace `Number(inboxRaw ?? '3')` y el campo está marcado `opcional: true` en el catálogo, así que un cliente puede conectar Chatwoot con base+account+token y dejar el inbox en blanco: ahí se asume el inbox 3, que en SU cuenta de Chatwoot es otra cosa o no existe. La cadena de daño es toda silenciosa: `listConversations` filtra por `inbox_id=3` y el inbox de /whatsapp sale VACÍO sin ningún error; `contactoEnInboxWA` devuelve false para todos los contactos, así que mensajes, adjuntos y bloqueo rebotan a todo el mundo; `ensureContactoWhatsapp` cuelga conversaciones en el inbox equivocado; y `getWabaConfig`/`getApprovedTemplates` leen el provider_config de un inbox ajeno, o sea que las plantillas de nutrición se sincronizan contra el WABA que no es. Vivo hoy: solo ws1 y ws3 tienen fila de ese campo. Si no hay inbox, `cfg()` debería tirar igual que con base/account/token, o resolverlo en vivo listando los inboxes de la cuenta (que es lo que ya hace `metodo-verificar` para el paso de verificación).

**Vive en:** lib/chatwoot.ts:30 (cfg) · lib/metodo-catalogo.ts:100 · *2026-08-05 · ~auditoria-ruleta-hidratacion-credenciales*

#### Chatwoot contesta 200 y Meta rechaza después: queda 'enviado' un mensaje que el lead nunca recibió

En la rama oficial de `procesarEnvios`, `sendWhatsappTemplate` devuelve `{ok:true}` en cuanto Chatwoot acepta la creación del mensaje. El rechazo de Meta (plantilla no aprobada, pausada, variables que no calzan) llega DESPUÉS y de forma asíncrona, y solo aparece como `status='failed'` + `content_attributes.external_error` en el hilo de Chatwoot — nunca en `nutricion_envios`, que ya escribió estado 'enviado' y avanzó la inscripción. Las únicas validaciones síncronas son «lead sin teléfono» y «paso sin template_wa»; nadie verifica que la plantilla esté APROBADA antes de disparar (`ensureTemplateSynced` solo sincroniza la lista de Chatwoot). La regla: un 200 del intermediario no es una entrega; si el fallo real vive en otro lado, hay que ir a buscarlo (reconciliar contra getMessages o el webhook) o el contador de enviados miente.

**Vive en:** lib/chatwoot.ts:139-171 (sendWhatsappTemplate) · lib/nutricion.ts, rama oficial (~1120-1140) · lib/meta-templates.ts:427 (reconcileDrafts, sin cron propio: hoy depende de que alguien abra la app) · *2026-07-09 f33-understand*

#### En la rama oficial `paso.cuerpo` es el espejo del inbox, NO el mensaje; y `template_param` es campo muerto

Dos trampas del mismo envío, las dos vivas el 7/8/2026. (1) La rama oficial pasa `content: paso.cuerpo` CRUDO (sin `aplicarVariables`): ese texto es solo lo que Chatwoot muestra en el hilo. Lo que el lead recibe es la plantilla aprobada en Meta rellenada con `bodyParams`. Si el cuerpo del paso diverge del texto aprobado, el inbox miente sobre lo que se mandó. Contrasta con la rama no_oficial, que sí hace `aplicarVariables` porque ahí el cuerpo SÍ es el mensaje. (2) `template_param` se persiste (default 'nombre' en setSecuenciaPasos) y se edita en la UI del editor de secuencias, pero `procesarEnvios` lo ignora por completo: siempre manda TODAS las variables del catálogo vía `valoresVariablesLead`. Es configuración que el usuario toca y no hace nada.

**Vive en:** lib/nutricion.ts:1129 (content crudo) vs :1158 (aplicarVariables en no_oficial) · lib/nutricion.ts:78 y :264 (template_param) · lib/template-vars.ts:26 · *2026-07-09 f33-understand*

#### getWabaConfig cae a OWNER_WS: un cron sin workspace fijado manda con las credenciales del dueño

`getWabaConfig()` resuelve el workspace con `(await getWorkspaceActual()) ?? OWNER_WS`. En un request está bien, y los routes de plantillas encima gatean con `integracionConectada`, que devuelve false cuando el ws es null. Pero cualquier cron o job que llame `enviarBorradorAMeta`/`submitTemplate` sin envolver en `runWithWorkspace` no tiene sesión: `getWorkspaceActual()` devuelve null, el `??` lo tapa y la llamada sale con el WABA y el token del DUEÑO, sobre la cuenta equivocada, sin error. La regla: cualquier job de plantillas fija el workspace explícito antes de llamar; el fallback a OWNER_WS es aceptable solo cuando el caller es un request del propio dueño.

**Vive en:** lib/chatwoot.ts:585 (getWabaConfig) · lib/meta-templates.ts:275 (enviarBorradorAMeta) · *2026-07-09 f33-understand*

#### wa-media es un bucket compartido: borrar el espejo por prefijo `${ws}/` se lleva los audios del Setting

Los binarios del WhatsApp no oficial viven en `wa-media` bajo `${ws}/mako_ws${ws}/`, pero en el MISMO bucket, bajo `${ws}/setting-audios/`, vive la biblioteca de notas de voz que el dueño grabó para las jugadas de nutrición. El patrón que uno copia por inercia es el de `reset-workspace`, que borra el prefijo `${ws}/` entero: hacerlo al limpiar el espejo se lleva puesta una biblioteca que no tiene nada que ver con el número desvinculado. El prefijo correcto es siempre `${ws}/mako_ws${ws}/`. Aparte: `borrarEspejoNoOficial` borra ÚNICAMENTE filas de `wa_mensajes` — cada vez que alguien apretó «Borrar todo el historial» dejó los binarios huérfanos en el bucket, y nada en el repo los borra salvo `resetearWorkspace`. Ya hay basura acumulada.

**Vive en:** lib/evolution-media.ts:24 · lib/setting-audios.ts:52 · lib/evolution-mensajes.ts:572-576 (borrarEspejoNoOficial) · lib/reset-workspace.ts:138-149 · *2026-08-02 mako-desconexion-estado-pegado*

#### El OTP del paso «Verificación» sale por la línea de voz de MaKo, no por el número del cliente

El paso `wa_no_oficial_prueba` del onboarding se presenta como la prueba de que el canal del cliente entrega de verdad — el comentario del propio route dice «guardar la credencial NO es estar conectado; el paso cierra cuando llega un mensaje de verdad». Pero el código manda el código con `enviarCodigoVerificacion` → `enviarAlGrupoMaKo` → `instanciaVoz()`, que devuelve `mako_ws1` o `mako_superadmin`: la línea de VOZ de MaKo, nunca `mako_ws<N>`. Con el WhatsApp del cliente completamente desvinculado el paso se completa igual (el destino cae al teléfono del perfil y el código llega desde MaKo). O sea: el paso no verifica nada del canal que dice verificar. Corolario que se derivó de esto: NO tiene sentido desmarcar ese paso al desvincular — lo que hay que arreglar es que pruebe el canal del cliente.

**Vive en:** app/api/chat-agent/onboarding/prueba/route.ts:45-51 · lib/mako-grupo.ts:30 (instanciaVoz), :308, :409-411 · *2026-08-02 mako-desconexion-estado-pegado*

#### Se ESCRIBE en una conversación de Chatwoot y se LEE de otras: el mensaje propio desaparece tras el refetch

Síntoma: mandás un mensaje, aparece la burbuja optimista, y al refrescar el hilo el mensaje ya no está (o no entra un entrante reciente del lead). El diagnóstico obvio —«el POST falló»— es el equivocado: el mensaje llegó bien, pero a una conversación que la lectura no mira. `crearOReusarConversacion` (lib/chatwoot.ts:396) elige la conversación con `status==='open'`; `getMessagesForConvs` (:417) lee las N más recientes por `last_activity_at`. Son dos ejes distintos, y `last_activity_at` en Chatwoot bumpea por actividad que NO es un mensaje (cambios de estado, labels, asignaciones), así que una conv 'open' vieja puede quedar fuera del corte. Regla: la conversación de ENVÍO tiene que estar SIEMPRE en el conjunto que se lee — que el listado marque explícitamente la `sendConvId` y el hilo la incluya, en vez de confiar en el orden. Ojo también con el comentario del código: dice «solo las 4 más recientes» y afirma que «los mensajes actuales viven en la última conversación» — el corte hoy es 6 y la premisa es justamente la que no se cumple.

**Vive en:** lib/chatwoot.ts (crearOReusarConversacion :392-400 vs getMessagesForConvs :417-424) + app/api/whatsapp/thread/route.ts · *2026-06-23 · ~review-inbox-whatsapp*

#### `saliente` es un booleano sobre CUATRO tipos de mensaje de Chatwoot

`getMessages` mapea `saliente = message_type === 1`, pero Chatwoot tiene 4: 0 entrante, 1 saliente, 2 actividad del sistema, 3 plantilla (saliente). Consecuencia: las plantillas de nutrición que mandamos NOSOTROS y los «conversación resuelta» del sistema entraban al prompt del análisis del lead etiquetados como «LEAD:», y el modelo sacaba dolor, objeciones y señales de compra de nuestro propio marketing. Peor: el gate de «hay sustancia para analizar» contaba esas líneas, así que se abría sin un solo mensaje real del lead. El propio repo ya filtraba el type 2 en otro camino (`mapConv`) porque las actividades con texto enmascaraban la dirección — el filtro nunca se había replicado acá. Hoy lead-insights usa `messageType` explícito, pero el mapeo booleano de lib/chatwoot.ts sigue igual: cualquier consumidor nuevo repite el error.

**Vive en:** lib/chatwoot.ts (saliente = message_type === 1) · lib/lead-insights.ts (bloqueChat) · *2026-07-04 ~auditoria-insights-del-lead*

#### Los emails «se enviaban» y no llegaban a nadie durante 13 días

Sin el setting `resend_from`, sin la credencial `RESEND_FROM` y sin env, `getEmailFrom()` cae a un SANDBOX_FROM hardcodeado (`onboarding@resend.dev`) que Resend entrega SOLO a la casilla del dueño de la cuenta. No hay error de configuración ni log: solo emails que no llegan, y quedó así 13 días sin que nadie lo notara. Ante cualquier «no sale el mail», lo primero es `select value from app_settings where key='resend_from'`, antes de tocar dominios o DNS. Relacionado: la RESEND_API_KEY de producción es «sending only» a propósito, así que `GET /domains` y `/api-keys` devuelven 401 — el mini-onboarding de dominio de la tab /email no puede funcionar con ella.

**Vive en:** lib/resend.ts (getEmailFrom, createResendDomain) · app/email → DominioSetup · *2026-08-07 contexto-mako-md*

#### «Reparar espejo» no alcanza la línea de voz de MaKo, y setWebhook es un no-op mudo

`repararWebhook()` resuelve `instanceNameDeWs(ws)` → `mako_ws<id>`, así que la instancia `mako_superadmin` (setting `mako.voz.instancia`, la voz de «Hola MaKo») es invisible para TODO botón de la UI: se repara workspace por workspace, todo queda verde y la voz sigue muerta. Solo se arregla con `POST /api/admin/mako-doer {"action":"preparar-voz"}`, que no tiene botón en ningún lado. Y aparte: `setWebhook` es un no-op si falta `EVOLUTION_WEBHOOK_SECRET` en el entorno donde corre — la instancia queda `state=open` («conectado») con el webhook nunca registrado, sin un solo mensaje en el espejo y sin error.

**Vive en:** lib/mako-canal.ts · lib/evolution.ts (setWebhook, estadoWebhook, repararWebhook) · app/api/admin/mako-doer · *2026-08-07 contexto-mako-md*

#### Un cambio de dominio duplica los webhooks que la app se registra sola

`webhooksPropios()` comparaba la URL entera, host incluido. Al mudar el dominio, los webhooks viejos dejaban de «ser nuestros», así que `repararWebhookChatwoot()` CREABA uno nuevo en vez de actualizar y nunca borraba el anterior: empezaban a llegar avisos duplicados al dueño y turnos repetidos en `mako_doer_conv`. Ya compara por PATH. La regla para cualquier webhook auto-registrado: la identidad es el path, no la URL — el host es exactamente lo que cambia.

**Vive en:** lib/chatwoot.ts (webhooksPropios, repararWebhookChatwoot) · *2026-08-07 contexto-mako-md*

#### Plantillas de Meta vía Chatwoot: tres errores que se confunden entre sí

Para variables nombradas hay que mandar SÍ O SÍ `parameter_format:'NAMED'`, y `example.body_text_named_params` necesita un item por cada APARICIÓN de `{{}}` en el cuerpo, no uno por variable única — si no, Meta rechaza con «parámetros incorrectos, deben ser {{1}}, {{2}}» o «BODY missing example». Una plantilla recién creada por la Graph API falla al enviarse con error 132000 porque Chatwoot arma mal los params de las plantillas que no conoce: hay que forzar `POST /inboxes/{id}/sync_templates` (~4s). El error 131049 es OTRA cosa y no se arregla tocando el formato: es el límite de ENTREGA de Meta por frecuencia de marketing al mismo usuario. Formato que funciona al enviar: `processed_params:{body:{<param>:valor}}`.

**Vive en:** lib/meta-templates.ts · lib/chatwoot.ts (ensureTemplateSynced, getWabaConfig) · *2026-08-07 contexto-mako-md*

#### El audio copiado del dueño se degrada a un WhatsApp VACÍO, y el comentario que lo justifica miente

`remapearJson` cierra con `?? null`, así que un `audio_id` que no se pudo remapear queda en null. El comentario del archivo afirma que «en el mejor caso el motor falla ('el audio del paso ya no existe') y reintenta para siempre». Falso: el motor decide con `const esAudio = paso.tipo === 'audio' && Number(paso.audio_id) > 0`, y `Number(null) === 0`, así que NUNCA entra a la rama de audio ni a ese error. El paso cae a la rama de texto y sale con `paso.cuerpo`, que en las secuencias del Chat Agent es el PIE — y en post-agenda es literalmente `''`. Manda un WhatsApp vacío, lo marca 'enviado' y avanza la cadencia como si todo hubiera salido bien; si el lead es caliente, deja un borrador en blanco para el setter. Es exactamente lo que el propio motor declara que no quiere hacer («no degradamos a texto en silencio»).

**Vive en:** lib/datos-mau.ts:489 y :77-81 · lib/nutricion.ts:1031-1090 · lib/setting-secuencias.ts:183 · *2026-08-02 ~ensayo-chat-agent-y-datos-mau*

#### cwFetch fuerza Content-Type JSON: un adjunto por multipart entra sin archivo y sin error

`authHeaders()` (lib/chatwoot.ts:32-34) devuelve `{ api_access_token, 'Content-Type': 'application/json' }` y `cwFetch` lo spreadea ANTES de `init.headers` (l.40-54). Si reusás cwFetch para postear un FormData a `/conversations/{id}/messages`, Chatwoot recibe Content-Type JSON con un body multipart y no parsea el archivo: el mensaje entra igual, sin adjunto y sin error. La regla es doble y contraintuitiva: para el adjunto va un fetch propio con SOLO `api_access_token`, y NUNCA se setea Content-Type a mano en multipart (fijarlo rompe el boundary que pone undici). El campo es `attachments[]` — con corchetes — en el mismo endpoint que el texto libre; no hace falta el endpoint de /upload de assets.

**Vive en:** dashboard-marketing/lib/chatwoot.ts (authHeaders 32-34, cwFetch 40-54, sendText 279-291) + app/api/whatsapp/contacts/[id]/messages/route.ts (POST, hoy solo req.json()) · *2026-06-23 wa-inbox-recon*


### Reglas que quedan

#### No persistir el contact_id de Chatwoot: duplica por +54 vs +549

Chatwoot crea contactos duplicados para el mismo teléfono según el formato (+54 vs +549) y cuál es el «bueno» cambia con la actividad — por eso la ruta de conversaciones ya re-elige `sendContactId` en cada carga. Guardar `chatwoot_contact_id` en el lead lo congela en el duplicado equivocado y los envíos empiezan a caer en un hilo muerto. Regla: resolver el contacto en vivo con `buscarOCrearContacto`; para deep-linkear a la tab no hace falta el id, alcanza el groupId determinístico `'p' + últimos 10 dígitos` del teléfono.

**Vive en:** app/api/whatsapp/conversations/route.ts:72 (groupKey); lib/chatwoot.ts · *2026-07-02 audit-automatizaciones-lead*

#### Los límites de WhatsApp son por PORTFOLIO y el tope de 2 plantillas marketing por usuario/24h es cross-brand

Dos constantes externas que gobiernan el diseño de la nutrición y no dependen de nosotros. (1) Desde oct-2025 el tier de envío se aplica al Business Portfolio, no al número: sumar números oficiales al mismo Business Manager NO suma capacidad (heredan el mismo tier) y un solo número en quality RED congela la progresión de TODOS. (2) El tope de 2 plantillas MARKETING por usuario cada 24h lo cuenta Meta sobre el usuario final sumando a TODAS las empresas: una cadencia de 3 toques marketing en un día no llega aunque tu cuenta esté verde, y no hay forma de esquivarlo con más números ni con otro BSP. UTILITY y AUTHENTICATION están exentas del cap. Consecuencia práctica: la cadencia se reparte en días (que es lo que ya hace el seed), y si hace falta densidad, es por utility legítima, no por volumen.

**Vive en:** lib/nutricion.ts (cadencia y guards) · docs/nutricion-templates.md · memoria [[sistema-hibrido-comunicacion]] · *2026-06-22 research-whatsapp-antiban*

#### Minúsculas en el código y la base; UPPERCASE sólo en el payload que sale a Meta

`listMetaTemplates` normalizaba `category` y `status` a UPPERCASE, pero el tipo y el check de `whatsapp_template_drafts` usan minúsculas: reusar una MetaTemplate para crear o actualizar un draft rompía el upsert. En la UI funcionaba de casualidad porque `statusChip` hacía `.toLowerCase()` en cada uso, y `reconcileDrafts` lo bajaba otra vez — dos normalizaciones opuestas en el mismo camino. La regla: normalizá en el borde de ENTRADA a la convención interna (minúsculas) y aplicá el `.toUpperCase()` sólo en `buildGraphPayload`, que es el único lugar donde Meta lo pide.

**Vive en:** lib/meta-templates.ts listMetaTemplates / buildGraphPayload / reconcileDrafts · *2026-06-24 ~review-plantillas-whatsapp-meta*

#### El navegador NO graba en el formato que sabe reproducir: la nota de voz de Chrome/Edge salía «OK» y Meta la tiraba

`pickAudioMime` probaba `audio/ogg;codecs=opus` y `audio/mp4` primero, pero el MediaRecorder de Chrome y Edge solo sabe REPRODUCIR esos formatos, no grabarlos: `isTypeSupported` devuelve false y cae a `audio/webm`, que WhatsApp Cloud API no acepta. Y la barrera del server era `if (base.startsWith('audio/')) return true`, así que lo dejaba pasar y Chatwoot lo reenviaba tal cual: el usuario veía el envío terminar bien y Meta lo dropeaba sin aviso. Solo Firefox (ogg) y Safari (mp4) entregaban. Reglas que quedan: (1) nunca asumir que MediaRecorder graba lo que el navegador reproduce — hay que mirar el `mimeType` real del recorder, no el que pediste; (2) la barrera del server va con lista blanca real (`AUDIO_OK` = ogg/mpeg/mp4/aac/amr/3gpp), nunca con `startsWith`; (3) MP3 es el único formato que WhatsApp entrega acá, así que se transcodifica en el cliente antes de mandar.

**Vive en:** app/whatsapp/WhatsAppApp.tsx (onstop → blobToMp3) · app/whatsapp/audio.ts · app/api/whatsapp/contacts/[id]/attachments/route.ts:34-41 (AUDIO_OK) · *2026-06-23 · ~review-inbox-whatsapp*


### Decisiones tomadas, y por qué

#### Los avisos tienen DOS apagadores y son maestro/hijo, no una regla duplicada

`plantillaActiva(id)` (store global del dueño, /agencia › Plantillas) corta antes que `avisoWaActivo(ws,id)` (preferencia por workspace, /configuraciones › Notificaciones). Un revisor lo reportó como «una cosa, un lugar» roto; la verificación decidió que NO: son dos compuertas de alcance distinto (plataforma vs inquilino), cada una con un solo lugar de definición, y arrancan sin divergencia porque el store nace vacío. Lo que sí es defecto: el hijo se dibuja sin mirar al maestro — con la plantilla desactivada por la agencia el panel muestra el interruptor PRENDIDO y no llega nada. El propio catálogo dice que «ofrecerle al usuario un interruptor para algo que nunca se enciende es peor que no ofrecerlo», y el panel ya resuelve bien el caso maestro/hijo del pop-up/sonido con `disabled`.

**Vive en:** lib/avisos.ts:139 + lib/plantillas.ts:32 vs lib/perfil.ts:218 y app/perfil/NotificacionesPanel.tsx:361 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*


### Lo que quedó sin hacer

#### FATHOM_WEBHOOK_SECRET es una clave global que solo se hidrata desde ws1

Los webhooks de Fathom de los workspaces 9 y 11 nunca entregaron un solo evento en su vida, y NO es por el dominio: la firma se valida contra una clave única global que solo se hidrata desde las credenciales del ws1, así que cualquier otro workspace muere en 401 «Firma no coincide» apunte a donde apunte. Queda sin arreglar: mientras el secreto no sea por-workspace, la tab de Fathom de un cliente se puede pintar verde y no recibir nada.

**Vive en:** app/api/webhooks/fathom/route.ts + lib/fathom.ts (verifyFathomSignature); hidratación en lib/credenciales.ts:215 (solo OWNER_WS) · *2026-08-05 · ~auditoria-mudanza-dominio*

#### El acuse del doer NO sale justo en los casos más lentos

El gate del acuse es `!audio && !adjunto && textoDirecto.length > 10 && vigentes.length === 0` y adentro exige tier !== 'cheap' o carga de plan. O sea: no hay acuse para nota de voz, imagen/PDF, textos de ≤10 caracteres, turnos con una acción pendiente de confirmar, ni charla barata. Y el fallback tampoco cubre: enviarPresencia(...,'composing',12000) dura 12 segundos. Esto importa antes de fijar cualquier ventana de espera: la más larga (audio, ~30s) es exactamente la que hoy queda muda por partida doble. Hay que mandar acuse también en audio/adjunto y en cheap, o renovar la presencia mientras dure la ventana.

**Vive en:** lib/mako-doer-in.ts (bloque del acuse y enviarPresencia) · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

#### El anti-eco del doer sigue con el read-modify-write que ya explotó una vez en el dedup

`registrarEnviados` lee `mako.doer.sent.<jid>` de app_settings, le agrega el id y hace `setSetting` — un read-modify-write sin atomicidad sobre un upsert last-write-wins. Dos invocaciones concurrentes leen el mismo array y una pisa a la otra: un id enviado desaparece del ring buffer y, cuando llega su eco `fromMe`, MaKo lo procesa como si fuera un mensaje del dueño (respuesta duplicada o loop). Es exactamente el bug que ya se pagó en el dedup de mensajes y que se resolvió migrándolo a un índice único ([[lote-whatsapp-buffer]]); el anti-eco quedó con el patrón viejo. Se mitigó batcheando un solo write por respuesta, lo que angosta la ventana pero no elimina la carrera entre dos entrantes del dueño.

**Vive en:** lib/mako-doer-in.ts:59-70 (registrarEnviados) y :324 (el guard del eco) · *2026-07-19 ~review-doer-whatsapp-y-snapshot*

#### Lo acordado para la prospección no entra en el motor de nutrición: tres bloqueos concretos

De la reunión salió que el primer toque post-agenda es un AUDIO del dueño y que el lead magnet se manda como archivo. El motor no puede hacer ninguna de las dos: `PasoSecuencia` solo tiene `cuerpo` de texto (aunque lib/evolution-envio.ts ya sabe mandar notas de voz), y la jugada guarda `lead_magnet_id` apuntando a un Entregable que el motor no sabe entregar. El tercer bloqueo es el guard anti-ban `HS_MIN_ENTRE_MSGS = 20`: la secuencia acordada exige varios toques cercanos (audio + conversación + pedido de ver el video) y con la reunión en 48h el candado de 20 horas mata la preparación — hay que separar el presupuesto anti-ban de la prospección fría del de una conversación ya abierta. Además el enrolamiento es por cron con ventanas amplias y tope MAX_POR_CORRIDA=6, contra la regla explícita de que el contacto al que llenó el formulario de Meta salga casi inmediato.

**Vive en:** lib/nutricion.ts (PasoSecuencia, HS_MIN_ENTRE_MSGS, MAX_POR_CORRIDA), lib/setting-estrategia.ts (lead_magnet_id), lib/evolution-envio.ts · *2026-08-01 ~extraccion-reunion-mau-mensajes*

#### MP3 nunca va a ser una nota de voz de WhatsApp, y el error 131053 de Meta no es por el MP3

El envío de audio graba con MediaRecorder y re-encodea a MP3 en el cliente con lamejs (Opus→PCM→MP3: doble transcodificación con pérdida, JS puro, lenta en móviles). Dos cosas que quedaron claras y no están escritas en ningún lado. (1) El 131053 de Meta es un error GENÉRICO de media, no «MP3 no soportado»: audio/mpeg está soportado hasta 16 MB y 48 kHz no es la causa; lo que falla es el header que arma lamejs o el MIME mal puesto, y si el `error_data.details` habla de 429/fwdproxy hay que subir por media_id en vez de por URL. (2) WhatsApp solo pinta la burbuja de nota de voz con .ogg/OPUS y `audio:{voice:true}` — con MP3 ese techo es inalcanzable por definición. El backend YA acepta audio/ogg (AUDIO_OK en la ruta de attachments): falta solo el encoder del lado del cliente (opus-recorder, un único asset de ~175 KB gzip servido desde /public, import dinámico con ssr:false). Antes de prometer «nota de voz nativa», verificar que Chatwoot exponga `voice:true` hacia la Cloud API: el OGG es condición necesaria, no suficiente.

**Vive en:** app/whatsapp/audio.ts (blobToMp3) · app/whatsapp/EmpresaInbox.tsx:374 · app/api/whatsapp/contacts/[id]/attachments/route.ts:34 · *2026-06-23 wa-audio-131053*

#### Un paso de nutrición de un canal apagado se marca 'omitido' y AVANZA — y la inscripción es una-vez-en-la-vida

Cuando un workspace tiene un canal prendido y el paso es del canal apagado, `procesarEnvios` marca el paso 'omitido' y avanza la cadencia sin enviar. Y `comprometerInscripciones` dedupea por (lead, secuencia) con un unique de la migración 0034: el lead no se puede reinscribir nunca. O sea que el paso queda QUEMADO — prender el canal después no lo re-manda. Hoy no hay daño heredado (0 filas en `nutricion_inscripciones` y `nutricion_envios`, el motor nunca comprometió nada), así que ésta es la ventana para decidir la semántica antes del go-live: re-mandar, no-avanzar (como ya hace la rama de borrador pendiente) o aceptar el quemado. Nota de auditoría del mismo motor: 'saltado' en nutrición es solo detalle en memoria (hace `continue` sin insertar fila) pero SÍ persiste como fila en `email_broadcast_envios` — «por qué no salió este mensaje» se responde en fuentes distintas según el canal.

**Vive en:** lib/nutricion.ts:396, :530 y :607-631 · supabase/migrations/0034_nutricion.sql · lib/envio-flags.ts · *2026-07-31 ~mapa-envio-flags-nutricion-crm-auto*

#### La foto de perfil del contacto ya llega de Chatwoot y se tira en el mapeo

Cada conversación de `GET /conversations` trae `meta.sender.thumbnail` con la URL absoluta del avatar, en el MISMO objeto del que el repo ya saca `sender.id`, `sender.name` y `sender.phone_number`. Pero `ConvRaw` no declara el campo, `mapConv`/`ChatwootConversation` no lo mapean y el acumulador `Acc` de `/api/whatsapp/conversations` no lo propaga, así que el inbox pinta iniciales generadas en los dos lugares donde hay avatar (lista l.538 y header del hilo l.563). Dos trampas al cablearlo: Chatwoot manda cadena VACÍA (no null) cuando el contacto no tiene foto — un `?? null` no la normaliza y el `<img>` queda con src vacío —, y como la ruta agrupa varias conversaciones por persona hay que quedarse con el primer thumbnail no vacío. A diferencia de Evolution, esta URL no caduca: es absoluta del server de Chatwoot y sirve directo en un `<img>`.

**Vive en:** dashboard-marketing/lib/chatwoot.ts (ConvRaw ~187, ChatwootConversation ~168, mapConv ~191) + app/api/whatsapp/conversations/route.ts (Acc ~69) + app/whatsapp/page.tsx (interface Contacto 22-37, avatarStyle 145, usos 538 y 563) · *2026-06-23 wa-inbox-recon*

