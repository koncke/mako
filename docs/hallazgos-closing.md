# Hallazgos: Closing Analyst y las llamadas de Fathom

Lo que se aprendió leyendo llamadas grabadas con Fathom y sus análisis en `closing_analyses`.
Una entrada por tema; lo que quedó sin hacer dice dónde vive.

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
