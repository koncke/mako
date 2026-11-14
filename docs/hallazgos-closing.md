# Hallazgos: Closing Analyst y las llamadas de Fathom

Lo que se aprendió leyendo llamadas grabadas con Fathom y sus análisis en `closing_analyses`.
Una entrada por tema; lo que quedó sin hacer dice dónde vive.

## Closing se vendía como Pro desde el 23/10 y nada lo frenaba (14/11/2026)

`SOLO_PRO_FUERA_DE_LA_BARRA` decía que su candado «va en el Dashboard» y nadie lo había puesto; además el análisis salía por cuatro caminos:
la hoja, `/api/closing/*`, `analizar-lead` del CRM y las 19 operaciones de la API. Ahora la hoja muestra el candado sin leer datos, las
rutas dan 403 y el área `closing` de la API se cierra menos las 3 de grabaciones del CRM (`OPERACIONES_CLOSING_ABIERTAS`,
lib/closing-solo-pro.ts). **La regla:** lo que /planes vende como de Pro necesita un test que encuentre su candado en el código.
**Sin hacer:** `/api/graficos` sigue sirviendo los datos de llamadas si un Esencial los mete en otra hoja (`llamadas_venta` lo usan
Comercial y Focus); el cron sigue analizando las llamadas de un Esencial con SU Claude (gasta en algo que no ve: lib/closing.ts); con
`?llamada=` la ficha se abre encima del candado. **Trampa:** tests que clavan líneas literales del Dashboard (dashboard-aviso-closing,
dashboard-en-blanco): cualquier condición nueva en esas líneas los pone en rojo.

## El prompt del Closing le leía las llamadas de TODOS con el método de un solo rubro (id=530, 6/11/2026)

- **Síntoma:** ninguno visible. `SYSTEM_ANALISIS` (`lib/closing.ts`) le decía al modelo, para todos los
  workspaces, que «entrega de servicio» era «sesiones de coaching/mentoría, accountability, 4DX, OKRs,
  tableros, planeación estratégica, sprints, seguimiento de compromisos, "Sesión 2/3/4", "Programa"» —
  y repetía el mismo vocabulario en las pistas de clasificación. A un cliente que vende departamentos se
  le leían las llamadas con el método de una consultoría de accountability.
- **Por qué es caro, y por qué no se ve:** falla para los dos lados y el lado grave es el silencioso. Una
  junta de entrega que no se parece a una «Sesión 3» se va a VENTA y se le paga un análisis de closer que
  no corresponde: eso al menos aparece en el gasto. Una llamada de VENTA que habla de tableros u OKRs se
  clasifica como entrega: la fila queda cerrada, sin error, sin aviso, y nadie vuelve a mirar esa venta.
- **EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO, dos veces. Es lo único que vale guardar de este item:**
  1. El pendiente decía «ninguno está en el registry». Era falso: `closing.analyze.system` ya estaba en
     `lib/prompt-registry.ts`, o sea ya era editable desde /configuraciones — y el bug seguía ahí entero.
     **Estar en el registry no lo arregla: el texto que se edita sigue siendo UNO para todos los
     workspaces.** Editable ≠ por-negocio. Lo que lo arregla es que el dato salga a un `{{slot}}` que lea
     el negocio en curso. Un prompt «ya en el registry» no está revisado.
  2. **Había TRES guardas apuntando a este prompt y las tres estaban en VERDE sobre el bug**, porque las
     tres miran NOMBRES PROPIOS y la identidad estaba en el VOCABULARIO:
     · `tests/sin-nombre-de-un-cliente.test.ts:64` se llama, literal, «los prompts de análisis no le dicen
       al modelo a qué se dedica OTRO negocio», y de `lib/closing.ts` sólo comprueba la frase de apertura y
       `/programa de mentoría/`;
     · `tests/sin-nombre-de-un-cliente.test.ts:40` barre `app/` y `lib/` con `/mbustos|mauricio bustos/i`;
     · `tests/closing-entrega.test.ts:465` mira 9 nombres propios y los aplica al prompt HERMANO —
       `ENTREGA_SYSTEM_TEMPLATE`— cuando su propio comentario dice «El del Closing Analyst arranca "Eres
       MaKo, analista de cierres de Mauricio Ejemplo…"». La guarda se escribió POR este prompt y nunca se
       le aplicó.
     **La regla:** una guarda de nombres propios no puede ver una taxonomía. Un prompt que corre para todos
     se revisa por el MÉTODO que nombra (4DX, OKRs, «Sesión 3», un rubro), no sólo por los nombres.
     `tests/closing-taxonomia.test.ts` es la guarda que mira eso.
- **Dónde quedó:** la taxonomía salió a tres slots (`{{servicio}}`, `{{reunion1}}`, `{{reunion2}}`) que se
  llenan en runtime con el negocio ACTUAL: `perfilNegocioTexto()` (`lib/onboarding.ts`, brief + oferta
  principal) y los rótulos de las etapas de reunión de su embudo (`reunionesDe` sobre el funnel default, la
  misma fuente única que usa el CRM automático). La decisión vive en `lib/closing-taxonomia.ts`, **sin
  `server-only`** — la misma regla de la casa que puso `lib/closing-internos.ts` afuera: la condición que
  gobierna algo destructivo tiene que poder ejecutarla un test.
- **La dirección del error NO es la del molde de /email, y es a propósito.**
  `app/api/email/generar/route.ts` es fail-closed: sin perfil contesta 422 y no escribe. Está bien ahí
  porque lo apretó una persona que lee la respuesta en pantalla. **En un cron ese mismo 422 no lo lee
  nadie:** deja la fila en `error` y `syncClosingCalls` reintenta las filas en error en cada vuelta — el
  modo de falla que ya costó 168 análisis en error durante tres semanas en el ws11 (más arriba en este
  mismo documento). Así que sin perfil SÍ se analiza, con una taxonomía NEUTRA (cero términos de cualquier
  rubro) y pidiéndole al modelo que no suponga uno y que use `categoria="otro"` antes que adivinar.
  **Lo inaceptable era leerle las llamadas a un cliente con el vocabulario de otro, no analizarlas con
  palabras genéricas.** Mismo criterio que `SIN_INTERNOS`: el fallback es la lista vacía, nunca la del dueño.
- **Los rótulos nombran, no deciden.** `{{reunion1}}`/`{{reunion2}}` sólo cambian cómo se LEE el prompt;
  el JSON sigue devolviendo `"tipo": "R1" | "R2"`, que es de donde cuelgan el saneo y la ficha del CRM. Sin
  rótulos en el embudo caen a «Reunión 1»/«Reunión 2» y el prompt sale idéntico al de antes.
- **Sin caché, a propósito:** son 4 lecturas al lado de una llamada a Claude de hasta 120 s que se paga.
  Cachear no ahorra nada medible y sí mete el bug de que el dueño corrija su brief y el analista siga
  leyendo el viejo mientras el proceso viva.

### Lo que sigue sin hacer, acá

- **UN OVERRIDE GUARDADO ANTES DE ESTE COMMIT SE QUEDA CON EL TEXTO VIEJO, y el arreglo no lo
  alcanza.** `getPromptText` devuelve `override ?? default` y los overrides son POR WORKSPACE
  (`app_settings`, filtrado por `workspace_id`: `lib/settings.ts:22`). Si un negocio guardó una
  edición de `closing.analyze.system` desde /configuraciones antes del 6/11, su texto no tiene los
  `{{slot}}`: `renderTemplate` no encuentra nada que reemplazar y la taxonomía vieja sigue viva para
  ese workspace, en silencio. **Lo mismo vale para el arreglo de `/email` de `97f98ba81`**: un
  override viejo de `email.generar.system` conserva el Calendly.
  Falta (a) MEDIR en producción cuántos workspaces tienen override de esas dos keys —la casa ya hizo
  esa medición una vez para decidir, ver la cabecera de `tests/prompt-sin-dueno.test.ts`— y (b) que
  **Martín decida**, porque limpiar un override es pisarle una edición a un cliente: o se le borra el
  override (y pierde su edición), o se le avisa en /configuraciones que su versión quedó sin los
  slots nuevos. Lo segundo no se puede hacer sin su firma, así que queda acá anotado.
  **La regla general que sale de esto:** arreglar el DEFAULT de un prompt del registro no arregla a
  quien lo editó. Todo arreglo de un default que cambie los slots tiene que decir qué pasa con los
  overrides vigentes.
- **`RE_SERVICIO_EXPLICITO` (`lib/closing.ts:141`) es el MISMO bug por otro mecanismo** y quedó sin tocar:
  `paddock\s*&\s*pit|programa\s+via|sesiones\s+programa|reporte\s+semanal|scaling\s*up|mesa\s+de\s+trabajo`
  es el vocabulario de UN negocio, aplicado en `preClassify` a todos. A otro cliente, una llamada titulada
  «Mesa de trabajo» o «Scaling Up» se descarta como entrega de servicio ANTES de que el modelo la lea — y
  descartar en la pre-clasificación no deja ni la fila que el análisis sí deja. No es un prompt, así que
  ninguna guarda de prompts lo va a ver nunca: lo que corresponde es que esos marcadores salgan a
  configuración por workspace, como salieron los internos.

## Con pantalla compartida, los números están en el video, no en el transcript (26/10/2026)

- **Síntoma:** el análisis de la llamada con Leila (847861420) listó sus suscripciones de lo que se DIJO y se le escaparon
  Canva, WebEmpresa, Diwep y los montos exactos. Martín lo marcó con capturas del video.
- **Causa:** ella compartió su planilla («Revisión de cuentas») y la repasaron en pantalla. El transcript de Fathom sólo tiene
  la voz; una tabla que se lee en silencio, o a medias, no está.
- **Regla:** si en la llamada se compartió pantalla con números (precios, gastos, métricas), el análisis se cierra con el
  video (capturas de los minutos en que se ve), no sólo con el transcript. Y se dice en el informe qué parte salió de dónde.

## Buscar una llamada por el número que da Martín (26/10/2026)

- **Síntoma:** Martín pide «la llamada 847861420» y no aparece buscando por `recording_id`.
- **Causa:** ese número es el de la URL de Fathom (`fathom.video/calls/<número>`). En la base vive en
  `closing_analyses.call_url`. La grabación de esa llamada tenía otro id (`recording_id` 189761032).
- **Regla:** se busca con `call_url LIKE '%/calls/<número>%'`, nunca por `recording_id`.

## El texto de la llamada no está en la base

- `closing_analyses` guarda sólo `has_transcript` y `transcript_items`, no el texto.
- El texto se baja de Fathom con `GET /recordings/{recording_id}/transcript`, usando la clave del
  workspace dueño de la grabación (para el ws9, la de Martín).

## Cada llamada con un cliente está dos veces

- Una llamada entre Martín y un cliente queda en el ws de Martín (9) y en el del cliente (la de Leila,
  en el 11), con `recording_id` distintos. Contar o analizar llamadas sin sacar duplicados las cuenta dos veces.

## Fathom puede cruzar quién habla

- En la llamada con Leila del 05/10 las etiquetas de quién habla venían cruzadas: frases de ella
  firmadas por Martín y al revés. Una cita se atribuye por lo que dice, no por la etiqueta.
- Todo lo que dependa de «qué dijo el cliente» (objeciones, puntajes del Closing) hereda ese error.
- **También el dueño de una tarea del Plan (27/10/2026):** «Comprar el certificado SSL» salió a nombre de Leandro y
  era de Martín. Un dueño que sale sólo de la etiqueta ahora viaja marcado y se confirma antes de mandárselo a nadie:
  docs/hallazgos-plan.md → «El dueño de una tarea no puede salir sólo de la etiqueta del hablante».
  Las 3 propuestas del ws9 de esas llamadas (`propmvn5jk0zn4wsz`, `propmvpmpjspdh5oi`, `propmvq00r7ecld37`) se leyeron
  antes del arreglo y no traen la marca: se corrigen a mano o con «Volver a analizar» después del deploy.
- **El RESUMEN de Fathom también se equivoca de sentido.** El de la llamada con Aaron (876825880) invierte quién trae
  y quién cobra (Aaron trae clientes y cobra US$300 por cada Acelerador de 1.500 que se cierra). Un acuerdo de plata
  se lee en el transcript, nunca en el resumen.

## El análisis falla en silencio cuando la IA del cliente se queda sin crédito (26/10/2026)

- **Síntoma:** en el ws11 (Leila) hay 168 análisis de llamadas en error: 165 hasta el 08/10 y 3 más
  hasta el 19/10. Nadie se enteró en tres semanas.
- **Causa:** su clave de Claude se quedó sin crédito. Cada vuelta del cron (`syncClosingCalls`) volvía a
  intentar las llamadas (las filas en `error` no se saltan: se reintentan) y cada intento guardaba el texto
  de Anthropic en su fila. El error quedaba ahí y no le llegaba ni al dueño ni a nosotros.
- **Lo obvio que no alcanza:** mostrar las filas en error, o avisar por cada una. Nadie abre el Closing si no
  hay análisis nuevos, y 168 filas serían 168 avisos. El aviso es por **incidente** (desde que su cuenta
  falla hasta que vuelve a analizar), no por llamada.
- **Qué es «de su cuenta»:** sin crédito, clave inválida (borrada, rotada) o sin permiso: la misma vara que
  la tarjeta de «Tus cuentas de IA» (`motivoCorto`, `lib/su-clave-reglas.ts`). Un 429, un 5xx, un timeout o
  la pausa de MaKo **no**: se arreglan solos y avisarle al dueño sería ruido.
- **Trampa (revisión del tren m): el texto NO dice de quién es la cuenta.** La clave de la plataforma (el ws1
  tiene una copia) y el crédito de Max que paga MaKo (`esCredito`, el ws10) contestan EXACTAMENTE lo mismo:
  «Your credit balance is too low». Clasificar por el texto le pedía al negocio que cargara crédito en una
  cuenta que no es suya, y a MaKo no le avisaba nadie de que la suya se cayó. Lo que decide es de dónde vino
  el error: sólo el de SU clave lleva `deSuClave` (`analyzeMeeting`), y `conClaveDelNegocio` dice `esCredito`
  cuando la que falló es el crédito de la plataforma. Medido con el harness (tests/closing-su-claude.test.ts → 6).
- **Regla (`lib/closing-ia-caida-reglas.ts`, `lib/closing-ia-caida.ts`):** lo de su cuenta no deja fila en
  error (la llamada queda sin procesar), corta la vuelta (las demás fallarían igual) y anota el incidente en
  `app_settings` (`mako.closing.ia_caida`), que conserva su `desde` y su `avisadoAt`. Mientras está anotado,
  cada vuelta prueba **una** llamada; la primera que se analiza cierra el incidente. El drenaje de insights
  no corre con su Claude caído. La API (`panorama_closing`) lo dice en `ia_del_negocio`.
- **Trampa (revisión del tren m): un incidente que nadie prueba no se cierra nunca.** «Una vuelta prueba una
  llamada» vale sólo si hay candidatas. Un «Re-analizar» sin crédito abría el incidente sobre una llamada ya
  analizada (que no vuelve a ser candidata), el negocio recargaba, y si no entraba otra llamada de venta la
  marca quedaba para siempre: el drenaje de insights frenado y el siguiente corte sin aviso (`conFallo`
  conserva el `avisadoAt` viejo). Ahora «Re-analizar» que sale cierra el incidente, y una vuelta sin ninguna
  llamada que llegara a su Claude hace una prueba de UN token con su clave (`probarSiVolvio`; `count_tokens`
  no sirve: no mira el crédito).
- **El aviso:** evento de la plataforma `closing_ia_caida` → automatización de SuperAdmin
  `mako-closing-ia-caida` (un texto literal por motivo, con el link a Integraciones → Tus cuentas de IA).
  **Trampa:** sin la fila de esa automatización en el ws9, `emitirEventoDePlataforma` devuelve `filas: 0` y
  no sale nada. Por eso `avisadoAt` se pone sólo si `filas > 0`: si no, quedaba «avisado» sin haber avisado.
  Y el aviso del catálogo nace `porDefecto: 'on'`: con `'off'` la mudanza crea la fila **pausada**.
- **Trampa (27/10/2026): avisar por WhatsApp no alcanza, la hoja también tiene que decirlo.** El aviso único le
  llegó al grupo de Leila el 26/10, pero la hoja «Closing» seguía quieta con 193 llamadas sin analizar, y ella
  preguntó por qué Fathom no tenía los datos de Ana: el síntoma se leía como un problema del grabador. Ahora la
  hoja (escritorio y teléfono) dice la causa, desde cuándo, el paso y cuántas esperan (`avisoDeIaCaida`; el
  incidente guarda `pendientes`).
- **«Conectar su suscripción» NO arregla el Closing.** Anthropic no deja que otra app use los tokens de Pro/Max, y
  «Mi computadora» sólo contesta el chat. Lo que sí sirve con Claude Max es su crédito de API mensual, que va a la
  cuenta de la clave: eso dice el paso para arreglarlo.
- **Sin hacer:**
  1. Crear la fila de la plataforma después del deploy, con el sí de Martín:
     `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --aplicar --eventos=closing_ia_caida`.
     Hasta entonces no avisa.
  2. Las 168 filas del ws11 no se tocan a mano (es el ws de un cliente, va con el sí de Martín): como las filas
     en `error` se reintentan solas, cuando Leila cargue crédito se analizan en las vueltas siguientes.
  3. Lo mismo le pasa a cualquier otra lectura con la IA del negocio (Plan, Chat Agent…): esto cubre sólo el
     Closing.

## Una sesión de Customer Success no puede quemar sus intentos por algo que no es suyo (26/10/2026)

- **Síntoma (revisión del tren m, hallazgo 11):** con el código de los grabadores desplegado antes que la
  migración 0338, cada sesión de entrega de tl;dv o Fireflies gastaba un intento por corrida («no sé de qué
  grabador es») y a los 3 salía de la cola **para siempre**: aplicar la migración después no la recuperaba.
  La misma trampa con la base caída: el `.catch(() => null)` convertía «no pude leer» en «culpa de la sesión».
- **Lo obvio que era equivocado:** el encabezado de la migración decía «ORDEN DE DESPLIEGUE: da igual». Era
  cierto para todo lo demás, no para esto.
- **Regla (`lib/closing-entrega.ts`, `analizarUna`):** un intento (`'sesion'`) es sólo por algo de ESA sesión.
  La base que no contesta corta la corrida sin culpar a nadie (`'proveedor'`); una clave que todavía no se sabe
  de qué grabador es **espera** sin tocar la fila ni gastar el turno de otra (`desenlace: 'espera'`). Cuando
  llega la 0338, la próxima lectura de cada grabador anota sus claves y las sesiones siguen solas.

## Una reunión sin transcripción todavía no se analiza (26/10/2026)

- **Síntoma (revisión del tren m, hallazgo 13):** tl;dv avisa antes de tener la transcripción; el seguimiento
  post-llamada llamaba a `analizarLlamadasDeLead`, que se tragaba el error de lectura («seguimos con la
  metadata») y pagaba a Claude con el título solo. Si salía «descartada», el barrido no la volvía a mirar.
- **Regla:** `GrabadorSinRespuestaError` al leer = «todavía no está»: no se analiza ni se escribe fila (el
  barrido la toma cuando esté). Otro error de lectura sigue como antes, con la metadata. El seguimiento que
  esperaba esa transcripción lo redacta el cron (docs/hallazgos-integraciones.md, los grabadores).

## El nombre del programa de un cliente descartaba las ventas de los demás (06/11/2026)

- **Síntoma: no hubo síntoma, y es el punto.** `RE_SERVICIO_EXPLICITO` (`lib/closing.ts`) traía
  `paddock & pit`, `programa via`, `scaling up` y `mesa de trabajo` —nombres de programas de UN
  cliente— y `preClassify` se los aplicaba a TODOS los workspaces. Para otro negocio, una llamada de
  VENTA titulada «Mesa de trabajo» o «Scaling Up» (que es un libro de metodología, no la marca de
  nadie) se clasificaba `entrega_servicio` ANTES de que el modelo la leyera: sin error, sin aviso y
  sin dejar ni la fila que el análisis sí deja. Una venta descartada así no aparece en ninguna
  pantalla y nadie vuelve a mirarla.
- ⚠️ **EL DIAGNÓSTICO OBVIO ESTABA MAL: «aflojar este detector sube el gasto».** El dato que lo dice
  es real y está en el repo: el 77% del gasto de closing fue para que el modelo dijera «esto no es
  una venta» (`docs/api-mako-inventario.md`). Pero hay un SEGUNDO dato medido, sobre el mismo cliente
  y las mismas llamadas, que dice qué parte de eso evita este detector: **caza 0 de 28 entregas**
  (`docs/hallazgos-crm.md`, 06/10/2026). Cero. Los títulos reales de las entregas son «Junta X y Y» y
  «X y Mauricio» —nombres de personas—, no nombres de programa. Los dos datos no se contradicen:
  miden cosas distintas. Así que esto nunca fue corrección contra plata; era corrección gratis, y la
  discusión de costo se venía teniendo sin mirar el rendimiento del detector del que se hablaba.
- **La causa real, y por qué nadie la vio:** es el TERCER mecanismo del MISMO módulo que le aplicaba
  la identidad de un cliente a los demás, y cada vez el que vino después no lo vio porque buscaba el
  mecanismo anterior: los correos (14/08, `closing-internos.ts`), la taxonomía del prompt (06/11,
  `closing-taxonomia.ts`) y ahora el vocabulario de un regex. Una guarda de prompts no lo iba a
  encontrar, porque no es un prompt. La regla general quedó en `AGENTS.md` («El vocabulario de UN
  negocio no se escribe en el código»), con la tabla de los tres y su fallback.
- **Regla (`lib/closing-marcadores.ts`, sin `server-only`, con test):** los nombres salen de lo que el
  negocio tiene cargado —sus ofertas y sus productos, **activos e inactivos**, porque las entregas de
  hoy son las del programa que se dejó de vender— y se filtran tres veces antes de poder descartar
  nada: fuera los hechos sólo de palabras que usaría cualquiera (`PALABRAS_GENERICAS`), fuera los de
  menos de 6 caracteres, y fuera los que además rotulan una reunión de VENTA de ese mismo negocio
  (`reunionesDe` sobre su embudo, la fuente única del CRM). Fallback `SIN_MARCADORES`: si no se pudo
  leer, no se descarta. Los prefijos `SERVICIO:` / `COACHING:` se quedaron en el código porque son
  convención de la app, y la diferencia con lo que se fue es la frase que conviene recordar: **un
  prefijo es una declaración; una subcadena es una adivinanza.**
- **El desempate, escrito al lado del código: ante la duda, VENTA.** El prefijo alcanza solo. El
  nombre de un programa NO descarta si el título trae además una señal fuerte de venta («propuesta»,
  «diagnóstico», «primera llamada», «Junta 1»), porque ese mismo nombre aparece en la llamada donde
  se VENDE el programa. Cuesta un análisis que el modelo cierra bien, y lo paga la clave del propio
  negocio desde IA12; la duda al revés cuesta una venta que nadie vuelve a mirar.
- ⚠️ **Y la guarda que tenía que cazarlo existía: buscaba el nombre de la PERSONA, no los de sus
  programas.** `tests/sin-nombre-de-un-cliente.test.ts` (ticket #41, 03/11/2026) barre `app`, `lib` y
  `plugin` buscando «mbustos» y «Mauricio Bustos», así que «paddock & pit» y «scaling up» le pasaron
  por al lado. Lo de un cliente no es sólo cómo se llama: es también **cómo llama a lo que vende**.
  Esa guarda ahora barre los tres nombres distintivos de programa además del nombre propio («mesa de
  trabajo» queda afuera: es castellano corriente y daría rojos en copy legítimo). Y de paso encontró
  uno vivo: el copy de la landing (`app/vsl/_detalle/features.ts`) le contaba al público que el
  triage descarta «weeklies, Scaling Up», con el nombre del programa de un cliente y describiendo un
  comportamiento que ya no existe.
- ⚠️ **Trampa: mudarlo a configuración NO alcanza.** Si la config admite una palabra genérica, el bug
  vuelve por ahí: un producto llamado «Programa» o «Consultoría» descarta las ventas de su propio
  dueño. De ahí los tres filtros, y no son decoración — son la mitad del arreglo.
- ⚠️ **Trampa: que una función esté `export`ada no la hace testeable.** `preClassify` lo estaba, y
  `lib/closing.ts` importa `server-only` en la línea 27, así que ningún test la podía ejecutar. Por
  eso la decisión se MUDA a un módulo sin `server-only`; testearla donde estaba no era una opción.
- ⚠️ **Trampa: un test que busca una llamada por su texto se rompe cuando la firma crece.**
  `tests/grabadores-revision-tren-m.test.ts` chequeaba el ORDEN del triage con el needle
  `'preClassify(m, internos)'`; con un tercer argumento, `indexOf` da -1 y la comparación de orden se
  vuelve falsa por un motivo que no tiene nada que ver con el orden. El needle quedó sin el
  paréntesis de cierre.

### Lo que sigue sin hacer, acá

- **Lo que de verdad separa la entrega no es el título: es el CIERRE del lead.**
  `esGrabacionDeEntrega` (`lib/insights-llamada-reparto.ts`, pura y con test) midió 28 de 28 entregas
  y 19 de 19 ventas. `preClassify` no la puede llamar porque el match contra el lead
  (`matchMeetingToLead`) corre DESPUÉS, en el mismo loop de `syncClosingCalls`. Adelantar el match
  antes de la pre-clasificación es la punta que puede bajar ese 77% de verdad; ningún detector por
  título lo va a lograr, y está medido.
- **Nadie midió si algún workspace tiene sus programas cargados como ofertas o productos.** Si no los
  tiene, su lista de marcadores queda vacía y lo único que descarta por título son los prefijos. Se
  ve con una lectura de `ofertas` y `productos` por workspace; hasta entonces, el alcance real de
  esto es una suposición.
- **La señal de duda no tiene «demo», ni «cotización», ni «presupuesto».** `RE_VENTA_FUERTE` es lo que
  le gana al nombre de un programa, así que «<su programa> — demo con Juan» se sigue descartando. Se
  reusa esa lista a propósito: es la definición de la casa de «esto grita venta» y la usan también el
  rescate de `preClassify` y el puntaje de `syncClosingCalls`, así que ensancharla sólo para este
  desempate crearía una segunda definición —`AGENTS.md` ya cuenta lo que pasó con las DOS de «es
  R2»—. Ensancharla para los tres es su propia punta, y pide medir antes.
- **El embudo se lee dos veces por corrida, y queda así A PROPÓSITO.** `taxonomiaDelNegocio` y
  `marcadoresDelWorkspace` llaman las dos a `getPipelineStagesDefault()` —las dos puntas aterrizaron el
  mismo día—, y parece «una cosa, un lugar» sin hacer. No lo es: corren en momentos distintos (los
  marcadores UNA vez por corrida, en `syncClosingCalls`; la taxonomía una vez por llamada analizada, en
  `analyzeMeeting`, y sin caché a propósito) y cada una tiene su propio `catch` con su propio fallback
  —`TAXONOMIA_NEUTRA` y `SIN_MARCADORES`—, elegidos por separado. Compartir la lectura acoplaría las dos
  direcciones de error: un embudo que no se puede leer degradaría a la vez el prompt y el detector. Son
  dos consultas al lado de llamadas a Claude de 120 s. Si alguien las une, que una a los fallbacks también.

## El número de un link de Fathom no es el `recording_id`, y Fathom rotula mal a quién habla (10/11/2026)

- **`https://fathom.video/calls/883162834` da 404 en `/recordings/883162834/transcript`.** El número de la URL es el de la llamada,
  no el de la grabación. Se busca la reunión en `/meetings` por su `url` o `share_url` y se usa su `recording_id`. Las dos claves
  (`FATHOM_API_KEY_MARTIN` y `FATHOM_API_KEY`) devolvieron 404 con el número de la URL. Con la primera, la reunión apareció en la
  primera página de `/meetings`.
- **El `speaker.display_name` de Fathom miente en llamadas de tres personas.** En «Codigo <> Martin» (30/10), frases de Juanfran
  salen como «Martin Carballo» (por ejemplo, 00:45:33 «Voy a vender una oferta anual…»). Para citar quién dijo qué, se atribuye
  por el contenido y se dice que se hizo así. Un análisis que confíe en el rótulo le atribuye a Martín lo que pidió el cliente.
