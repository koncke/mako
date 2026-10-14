# Hallazgos — Offer (la tab que une Offer Analyst y Offer Generator)

Lo que costó construir `/offer` el 11/10/2026 y no se deduce leyendo el código. El marco
de oferta en sí (las 13 piezas, la rúbrica de 9 dimensiones, la plantilla, qué dice cada
autor y dónde discrepan) vive en [offer-marco.md](offer-marco.md); el contrato en código,
en `lib/offer-marco.ts`.

**Vive en:** `app/offer/*`, `app/api/offer/route.ts`, `app/api/offer/pdf/route.ts`,
`app/api/offer/audio/route.ts`, `lib/offer-marco.ts`, `lib/offer-reglas.ts`, `lib/offer-ia.ts`,
`lib/offer-sesiones.ts`, `lib/offer-contexto.ts`, `lib/offer-pdf.ts`, `lib/offer-autores.ts`,
`lib/pdf-escritor.ts`, `lib/pdf-helvetica.ts`, `app/admin/offer-playbook/*`,
`supabase/migrations/0254_offer_sesiones.sql`, `supabase/migrations/0256_offer_funnel.sql`.

## El pedido, textual (Martín, 11/10/2026 07:55 UTC)

> «Implementa completamente la funcionalidad de "Offer Analyst" y "Offer Generator" Pero
> todo en una mista tab que se llame "Offer"... Elimina la tab de "Análisis", llevala dentro
> de "Experiments"... revisa las transcripciones de los cursos que tenemos en CONOCIMIENTOS...
> Sofia Contreras, Marcos Razzetti, Ramiro Cubria, Juan Carrizo, y todos los que hablen de
> oferta... prefiero algo simple como un chat con una IA, donde el usuario pueda escribir o
> mandar audio o adjuntar como en el "Archivero"... que no tenga mucho texto la tab y que el
> "resultado final" sea que te de un PDF con la conclusión... Y claro que se pueda visualizar
> allí también la conclusión.»

Lo que ya estaba decidido antes y este pedido confirma (de `lib/plan-proyectos-catalogo.ts` y
de las tarjetas del 25/09): si el Analyst terminaba siendo «MaKo te dice qué mejorar» en un
chat, se fusionaba con el Generator en una tab con dos modos. Los DOS proyectos del tablero
(Offer Analyst y Offer Generator) se quedan: unirlos en una tab no autoriza fundirlos.

## El PDF sin librería — y por qué la recomendación obvia era la equivocada

- **Síntoma / decisión:** el relevamiento recomendó `@react-pdf/renderer` (medido: 256 ms,
  Geist incrustada, acentos bien). Era la mejor librería y la decisión equivocada: el
  `package.json` y el lockfile tenían cambios SIN COMMITEAR de otra sesión (web-push), y un
  `npm install` en el clon compartido se llevaba su dependencia adentro de mi commit o dejaba
  el lockfile desparejo para el build de Vercel. Además Next 16 trae su propio React canary
  y react-pdf, al quedar externo, resuelve el de `node_modules`: dos Reacts, y un hook en un
  componente del PDF rompería.
- **Lo que se hizo:** `lib/pdf-escritor.ts`, un PDF 1.4 a mano (~350 líneas) con las fuentes
  estándar (Helvetica): no hay archivos de fuente que incrustar ni que declarar en
  `outputFileTracingIncludes`. Las métricas (`lib/pdf-helvetica.ts`) salen de los AFM
  oficiales de Adobe que trae pdfkit.
- **La trampa que cazó la prueba por rotura:** con cada offset del xref corrido 1 byte,
  **unpdf (pdf.js) abre el archivo igual** — reconstruye la tabla escaneando — y los siete
  tests de lectura daban verde. Otros lectores no reparan. Regla: un PDF escrito a mano se
  valida con un chequeo DETERMINISTA del xref (cada offset cae en su `N 0 obj`), no sólo
  leyéndolo con un lector tolerante. Está en `tests/offer-pdf.test.ts`.
- **WinAnsi cubre el español entero** (á é í ó ú ü ñ ¿ ¡ « » “ ” — • … €) y no cubre flechas,
  ✦ ni emoji. Un lector que recibe un código que la fuente no tiene NO falla: dibuja otra
  cosa (medido con jsPDF por el relevamiento: «→ ✦» salía «!' '&»). Todo texto pasa por
  `textoParaPdf`, que reemplaza lo que tiene equivalente (→ pasa a ›) y anota lo que descarta.
- **`Content-Disposition` con un carácter > 255 tira el 500** («Cannot convert argument to a
  ByteString»), y MaKo escribe «—» en todo: el nombre del archivo es un slug ASCII
  (`nombreArchivoOferta`).
- **Mirar un PDF en esta máquina:** no hay `pdftoppm` (el Read de PDF lo necesita) y Chrome
  headless con `--screenshot` sobre un `.pdf` saca la pantalla gris del visor vacío; un HTML
  con el pdf.js de unpdf tampoco renderizó. Lo que sí sirve es abrirlo en el Chrome real.

## Un turno que falla YA guardó el mensaje

- **Síntoma (encontrado al integrar, antes de salir):** el server guarda el mensaje del dueño
  ANTES de llamar a la IA (para no perderlo) y, si la IA falla, contesta 502 con la `sesion`
  en el cuerpo. La pantalla tiraba esa sesión y devolvía el texto al composer: al reenviarlo,
  el mensaje quedaba DOS veces; en una conversación nueva, quedaba además una sesión huérfana.
- **Arreglo:** `ErrorOfferApi` lleva la `sesion`; la pantalla la aplica y no devuelve el texto.
  El «Reintentar» se CALCULA del estado (el último mensaje es del dueño y nadie contesta), y
  manda `{ action: 'turno', reintentar: true }`, que corre la IA sobre lo guardado sin agregar
  nada (y no contesta dos veces si otra pestaña ya lo hizo).
- **Regla:** si un endpoint guarda algo antes de fallar, el contrato de error lleva el estado
  guardado, y el cliente lo usa. Un error que tira el estado convierte «reintentar» en «duplicar».

## La IA: gratis, por la cascada del cliente, y con red

- `chatClaude` no sirve para un chat multi-turno ruteado a Gemini: **aplana el historial**
  (`messages.map(m => m.content).join`), no acepta `validar` y si la cascada falla cae a Sonnet,
  donde el veto lo corta con un error a la vista. Offer llama a `chatCheapCascade` directo con
  el historial serializado con rótulos de hablante.
- Proveedores: `['gemini','groq','openrouter']` — sin `openai` (cobra contra la key del
  cliente) y sin `mistral` (rebota siempre y fabrica el veredicto de cuota). Groq queda
  salteado casi siempre por su techo de entrada (7.000 tokens con la salida).
- La red de plataforma va por `chatCheapTools`, que NO le pasa a Gemini el nivel de
  razonamiento: ese razonamiento sale del mismo tope de tokens de la respuesta. Si la red
  devuelve JSON cortado, el tope es lo primero a mirar.
- `ConclusionOferta.modelo` dice la lista que se probó, no el proveedor exacto: la cascada no
  lo devuelve. El dato exacto queda en el Saldo de IA.

## Lo de la plataforma que mordió

- **`resolverWsAdmin()` le devuelve el ws1 —de un cliente— al super admin sin impersonar.**
  Offer usa `adminDeWorkspaceActual()`, que cierra en null. Todas las rutas de
  `/api/onboarding/*` siguen con el viejo: el que copia de ahí, escribe en el workspace de
  Mauricio.
- **Agregar una capacidad en `lib/mako-capacidades.ts` cambia `docs/api-mako.md`**: el área
  `mako` arma un enum con los ids de las capacidades. El acople no se ve desde el archivo de
  capacidades, y el test del registro y el pre-push fallan si el doc no viaja en el mismo commit.
- **El corte de Meta de `/experimentos` escondía Análisis entero** a los negocios sin Meta
  (la cascada sale del CRM y no la necesita). Ahora el panel de activación se dibuja ADENTRO
  de Retro/Experiments/Conclusions y Análisis sigue andando.
- **Un guard que fija «no hay salida temprana» cuenta los `return`**, no busca un texto: la
  primera versión dio verde con `if (panelSinMeta) return panelSinMeta;`.
- **Un `border` o `boxShadow` inline le gana a `:focus-within`**: el aro de foco del composer
  no aparecía hasta que el color pasó a la hoja de estilos.

## Lo que encontró la revisión adversarial (3 revisores, antes del primer commit)

13 hallazgos reales sobre código que todavía no había corrido nunca; 11 se arreglaron. Los que
dejan regla:

- **El prompt recortaba cada mensaje del dueño a 2.000 caracteres** mientras la ruta acepta
  12.000: el mensaje se guardaba entero y el modelo leía la mitad (preguntaba por el precio que
  estaba en el tramo cortado). Un tope de entrada y un tope de prompt distintos para el MISMO
  dato son un dato que se pierde en silencio.
- **Un archivo quitado del composer seguía viajando a la IA**: se lee y se guarda apenas se
  elige (para el ✓), así que quitarlo de la pantalla no lo sacaba de la sesión. A la IA ahora
  sólo van los documentos que forman parte de algún mensaje (`docsDeLaConversacion`).
- **«Guardada» se heredaba entre versiones**: guardar la v1 dejaba la v2 marcada como guardada
  y sin botón. Lo guardado se compara contra la versión VIGENTE.
- **Los topes del navegador eran más cortos que los del server** (turno 120 s contra 300 s de la
  ruta): el navegador daba por fallido un mensaje que el server terminaba guardando. Regla de la
  casa: el `signal` es el tope de la ruta más un margen. Y si igual se corta, se relee la
  sesión antes de devolver el texto al composer.
- **Una urgencia VENCIDA contaba como sabida** y MaKo no la preguntaba: la semilla ahora pasa
  por `urgenciaUsable`.
- **Guardar desde Offer antes de abrir el editor de ofertas** hacía que el seed de la oferta
  principal viera «ya hay ofertas» y no la creara nunca: se siembra antes de insertar.
- **Experiments con `history.replaceState`**: el árbol del router quedaba con la tab vieja
  (atrás/adelante pintaba otra) y la hipótesis de «Probarlo» volvía a abrir el alta. La tab y
  la limpieza del parámetro van por el router de la casa.

## Offer v2 (11/10/2026, tarde): atada a un funnel, el chat de WhatsApp y el diagnóstico adentro

**Vive en:** `app/offer/*` (`SelectorFunnel.tsx`, `ChatOffer.tsx`, `arbol.ts`, `AvatarMako.tsx`),
`app/api/offer/route.ts`, `app/api/offer/audio/route.ts`, `lib/offer-sesiones.ts` (`arbolOffer`),
`lib/offer-reglas.ts`, `lib/offer-ia.ts`, `lib/offer-pdf.ts`, `supabase/migrations/0256_offer_funnel.sql`.

El pedido, textual (Martín, 11/10/2026 18:04 UTC), está entero en el registro de `/admin/dev`
(Products & Offers). Lo que no se deduce del código:

- **«Funnel» NO es un producto de `productos`, y era el diagnóstico obvio.** El pedido decía «las
  ofertas deben estar atadas a los productos del CRM», y el primer contrato leía `listProductos()`.
  Lo midió el chat del CRM (15:15): lo que el CRM dibuja como «producto» es una fila de `funnels`
  (`leads.funnel_id`), con el nombre de su producto principal (`productoDeFunnel`). `productos` es el
  catálogo con precio que va ADENTRO de una oferta. Con el contrato viejo, el selector habría listado
  la lista de precios en vez de los funnels que Martín ve. **Regla:** funnels con `leerFunnels()`
  (null si la lectura falla), ofertas con `funnel_ofertas`, y la oferta guardada se liga con
  `ligarOfertaAFunnel` — principal SÓLO si el funnel no tenía ninguna (no se le roba la principal a otra).
- **El número de migración se mira también en las RAMAS y los worktrees.** La 0255 estaba tomada por
  `0255_cobros_pasarela.sql` en la rama `pagos-pasarela`, que `ls supabase/migrations` no ve.
- **El composer de `ChatHilo` no sirve para los archivos de Offer** (corta en 4 MB, uno solo, `accept`
  fijo). Se monta `ComposerWhatsApp` con su menú del clip y los archivos van por el camino de Offer
  (`subir-url` → PUT → `leer`). Para que la barra quede dentro de la tarjeta del hilo se le aplana la
  caja a `ChatHilo` desde afuera (`.of-hilo-lista > div` en `app/offer/estilos.ts`): si `ChatHilo`
  cambia su nodo raíz, lo peor que pasa es un borde de más.
- **La ranura `vacio` de `BurbujaHilo`** es la forma de pintar Markdown con la burbuja de la casa.
- **La hora de una burbuja depende de la zona horaria**: dibujada en el servidor, rompe la hidratación.
  Se pide después de montar.
- **`MakoStar` siempre dibuja la estrellita chica**; la chispa sola está sólo en `MakoLogo`, con su
  borde. `AvatarMako` copia el trazo (`SPARK` no se exporta): si la marca cambia, son dos lugares.
- **El bloque del diagnóstico no puede ir dentro de `contenidoNoConfiable`**: la cláusula de seguridad
  le dice al modelo que no obedezca lo que hay adentro, y el bloque trae la orden de que la pregunta es
  obligatoria.
- **Con la pregunta obligatoria, la validación estricta descarta a los proveedores que sólo leyeron el
  documento**: por eso un turno con documentos nuevos no la fuerza.
- **El audio se transcribe ANTES de guardar nada**: si ninguna IA lo escucha, 502 y el binario queda
  (para no dejar un mensaje mudo); si no tenía voz, 422 y el binario se borra.

### Lo que encontró la revisión adversarial de la v2 (5 revisores + 5 refutadores, antes de subirla)

26 hallazgos reales sobre código que no había corrido nunca (seguridad: cero). Los que dejan regla:

- **«La opción adaptada CONTIENE los números de la original» no alcanza: dos rangos vecinos comparten
  un borde.** La IA personaliza las opciones del diagnóstico de fase y una lista corrida un lugar
  pasaba el chequeo: tocar «menos de 3.000» guardaba en el diagnóstico DEL NEGOCIO el rango de al lado.
  La opción N tiene que traer exactamente los mismos números que la N original, uno a uno; si no,
  vuelve la original (`lib/offer-reglas.ts`).
- **«Guardar si no hay» no es `getSetting` + `setSetting`**: el primero devuelve null cuando la base
  falla y el segundo pisa. Va `cambiarSettingSi(clave, null, valor)`, que decide la base. El
  diagnóstico que el negocio ya tenía no se toca desde Offer.
- **Un validador estricto en la cascada tira respuestas que servían.** Con la pregunta obligatoria, un
  turno con las piezas bien sacadas pero sin la pregunta adaptada se descartaba entero y se seguía
  quemando la cascada hasta la red de plataforma. Se guarda la primera respuesta incompleta de
  respaldo (`validadorConRespaldo`), se corta a la segunda, y la pregunta sale en su versión original.
- **`extraerLanding` le saca el www y el querystring a la URL**: sirve para IDENTIFICAR una landing,
  no para bajar la página que alguien pegó (con `?page_id=` bajaba otra). Hoy esos links piden pegar el
  texto; falta una variante que baje la URL tal cual (`lib/landing-fetch.ts`, de otra área).
- **`esDelWorkspace` no mira `activo`**: `ligarOfertaAFunnel` liga ofertas a funnels archivados. Offer
  avisa que no se va a ver en el selector; con el funnel BORRADO dice que ya no existe y no manda a
  reintentar (`avisoReintentable: false`).
- **Un aviso que pide «vuelve a tocar Guardar» al lado de un botón que ya dice «Guardada»** es la
  familia de «un paso que nombra un control que su pantalla no tiene»: el botón se cambiaba antes de
  que la liga al funnel se confirmara. Mientras haya aviso, el botón sigue; después de recargar lo
  decide `ligada` (vista).
- **«Nueva oferta» devuelve la conversación vacía que ya existía** (para no sembrar huérfanas), y la
  pantalla corría `reiniciar()` igual: descartaba lo que estaba en vuelo. Mismo id → no se reinicia.
- **Una nota de voz larga se cortaba en silencio a 12.000 caracteres** (el tope del mensaje): ahora la
  transcripción entera viaja como documento de la conversación.

### Los documentos se leen recién al ENVIAR (12/10/2026)

Hasta la v2, elegir un archivo lo subía y lo LEÍA con IA en el acto (para el ✓ del chip). Martín lo vio
al saltar un error apenas eligió un PDF: «eso estaría mal. Solo cuando le doy a ENVIAR debería». Ahora
elegir abre la vista previa compartida (`VistaAdjuntos`, ver hallazgos-comunicacion.md) y Enviar sube y
lee cada uno en orden («Leyendo «X»…») antes del turno (`app/offer/adjuntos-envio.ts`). Si una lectura
falla no sale el turno, la vista queda con el error, y al reintentar no se releen los ya leídos; un
documento leído que nunca viaja en un mensaje no le llega a la IA (`docsDeLaConversacion`).

## Offer Playbook (`/admin/offer-playbook`): el criterio y lo que se concluyó de cada curso

**Vive en:** `app/admin/offer-playbook/*`, `lib/offer-autores.ts`, `docs/offer-marco.md`,
`tests/offer-playbook.test.ts`.

Pedido de Martín (11/10/2026 18:19 UTC): «una tab con el criterio y todas las conclusiones que sacaste
luego de analizar los cursos que hablan de OFFER, así lo puedo revisar».

- **La tab RENDERIZA el marco, no lo copia** (como `/admin/docs`): `secciones.ts` corta
  `docs/offer-marco.md` por sus `## N.` y cada sección va a una tab. Una sección nueva que nadie mapeó
  va a la última tab y el test falla hasta que alguien decida dónde va. El `.md` llega al deploy por
  `outputFileTracingIncludes` (`next.config.ts`); sin eso la tab anda en local y sale vacía en producción.
- **Lo que corre de verdad sale del código**: las piezas y las dimensiones de la pestaña Criterio se
  leen de `lib/offer-marco.ts` (`EnElCodigo.tsx`), no del documento.
- **Las conclusiones por autor** (`lib/offer-autores.ts`: 19 autores, 132 conclusiones) salen de las
  seis investigaciones del 11/10, destiladas por un agente y verificadas por otro contra la
  investigación y contra la clase citada. Se re-verificaron a mano tres al azar (Contreras clases 084 y
  109, Carrizo 039): las tres dicen lo que la conclusión afirma. **Las citas textuales se dejaron
  afuera** (todo va parafraseado); sólo queda la del curso propio de MaKo.
- **Rediseño del mismo día** (pedido de las 01:18 UTC del 12/10: «simplifica mucho… más gráfico»): cinco
  pestañas («A definir» primero, Criterio, Autores, Discrepancias, Errores comunes), tablas y desplegables
  `<details>` sin JavaScript. «Precio y garantías» pasó a un desplegable de Criterio y «Fuentes» a uno de
  Autores; los links viejos `?tab=precio` / `?tab=fuentes` caen ahí, y un `§N.N` abre su desplegable con
  `?ver=`.
- **`MarkdownDoc` no entiende `*cursiva*`**: dibuja los asteriscos. El marco tiene 99; el Playbook los saca
  al dibujar (el documento no cambia), y en `/admin/docs` se siguen viendo.
- **El guard grande de voseo también marca nombres de constantes en mayúsculas** (`DEJALO`): mira la forma,
  no si es copy.
- **Trampa de Windows:** un componente `Pendientes.tsx` al lado de un módulo `pendientes.ts` —mismo
  nombre, distinta mayúscula y extensión— hace que `import './Pendientes'` resuelva al `.ts` en Windows
  (busca `.ts` antes que `.tsx` y el disco no distingue mayúsculas) y al `.tsx` en Linux. Se renombró a
  `ListaPendientes.tsx`. Dos archivos que difieren sólo en la mayúscula no conviven en una carpeta.

### El marco contra el código: el cruce del 11/10 y las 13 decisiones del 12/10

El 11/10 un agente cruzó el marco escrito contra lo que corría en HEAD y encontró 13 cosas que el código
no aplicaba (la peor: el filtro de cifras dejaba pasar números inventados en el PDF). Fueron las tarjetas
de «A definir» del Playbook, y Martín las contestó el 12/10 (textual en la bitácora de Products & Offers;
el resumen, en la memoria `offer-decisiones-a-definir`). Quedaron aplicadas ese mismo día; la pestaña las
muestra en «Decididas». Lo que no se deduce del código:

- **Guardar una pieza REEMPLAZA su texto entero.** Por eso cada pregunta nueva (valor anual, costo,
  primera semana, % al firmar, escalera, otras ofertas, cuántos pagaron) tiene su propia pieza: anotar el
  valor anual en «Resultado» borraba el resultado. Quedaron 20 piezas y 7 mínimas; el riel las agrupa por
  tema (`GRUPOS_PIEZAS` en app/offer/PiezasRail.tsx), y una pieza nueva sin grupo cae en «Más».
- **Las cifras se comparan por VALOR** (`claveCifra`: «1.500», «1500», «1,5 mil» y «1.5k» son lo mismo),
  y un rótulo («Fase 1»), un año o un plazo («en 90 días») no pasan a «[completar]»: eso lo propone MaKo y
  va a «Lo que propuso MaKo». Las cifras escritas con letras («tres clientes») NO se revisan.
- **`calcularDiagnostico` sólo pasa el control final si recibe las piezas**: la pestaña Criterio calcula
  sólo con notas. La ruta siempre las pasa, y un test lo exige.
- **El PDF de cada versión entra al chat en la MISMA escritura que la versión** (`mensajePdf` dentro del
  CAS de 'generar'): no hay versión sin su mensaje ni mensaje duplicado por un reintento. «Así está bien» lo
  contesta el código, sin gastar IA. El PDF se pide por versión (`/api/offer/pdf?id=&v=`; una que no existe
  es 404, nunca cae a otra).
- **La garantía (decisión 3, B) no cambió en el código: cambió el marco** (§7.1 y §9.2). Un test fija que
  ningún texto que lee la IA diga «10 a 15 casos».

Lo que no quedó del todo:
- **La pregunta de «otras ofertas» depende del orden de la guía y de una regla del prompt**, no de código:
  una IA gratis puede saltarla, y entonces el foco usa sólo lo cargado en MaKo.
- **El margen y el % cobrado al firmar se leen del texto libre** con una heurística (`montosDe`): cada
  aviso dice los números que usó, para que el dueño vea si se leyó bien. La duración se lee del primer «N
  días/semanas/meses» del formato.
- **Una duración fuera de 90-180 días o un precio bajo 1.000 USD se AVISAN**, no se corrigen: corregirlos
  sería inventar.
- **Un prompt guardado desde /configuraciones con la plantilla vieja no trae `{{alertas}}` ni
  `propuestoPorMako`**: lo determinista se aplica igual, pero los avisos no le llegan a la IA.

## Lo que quedó SIN hacer

- **Offer v2:**
  - ~~La oferta guardada no se liga a los productos~~ · ~~el audio se re-sube al reintentar~~ ·
    ~~«Guardar si no hay» vive en la ruta~~ · ~~un link con `?page_id=` no se lee~~ — **CERRADOS el
    13/10/2026**, ver «Los cuatro que se cerraron el 13/10» más abajo.
  - ⚠️ **El Archivero no se entera de lo que se sube en Offer, y NO es sólo la función que falta.**
    El diagnóstico original («falta una `registrarDocumentoSinPisar` en `lib/archivero.ts`») se quedó
    corto: aunque exista, Offer **no tiene con qué llamarla**. Un archivo del Archivero es una fila con
    `storage_path` + `campos` (los del brief, extraídos por IA), y Offer hace lo contrario a propósito —
    borra el binario apenas lo lee (`finally` de `leer`: «el binario no se guarda, lo que queda es el
    texto») y su IA saca PIEZAS DE LA OFERTA, no campos del brief. Registrarlo igual dejaría una fila
    que apunta a un archivo borrado y suma cero al brief. Para cerrarlo de verdad hay que decidir si
    Offer **conserva el binario y paga una extracción de campos por documento** — y la tab promete que
    «la conversación, el diagnóstico y la oferta nunca pagan». **Es una decisión de Martín, preguntada
    el 13/10.**
  - **El avatar que se arma en el chat no se guarda en Avatares, y se queda así.** No es un pendiente:
    `setAvatares` reemplaza la lista entera, y escribir desde el chat sin que una persona confirme rompe
    «un canal propone, una persona confirma». Queda en la pieza `cliente`, que es donde corresponde.
  - **La transcripción de un audio se ve cortada a 140 caracteres** (lo hace `BurbujaHilo`, que es
    compartido).
- **Leer una imagen, un PDF escaneado o un audio puede cobrar en la OpenAI del cliente**:
  `archivoATexto` usa las cascadas compartidas de visión y transcripción, que terminan en
  OpenAI (lo mismo que hoy le pasa al Archivero y al importador del Plan). La conversación, el
  diagnóstico y la oferta nunca pagan. Cerrarlo es un `sinPago` en `leerDocumentoIA` y
  `transcribirAudio` (`lib/ai-cheap.ts`), que es un archivo compartido.
- ~~**Un binario puede quedar en Storage** si la persona cambia de conversación justo mientras un
  archivo se sube~~ — **CERRADO el 13/10/2026** con la acción `'descartar-subida'` (ver «El audio se
  re-subía en cada reintento» más abajo).
- ⚠️ **El aviso de precio afirmó «Cierras el 170% de las llamadas calificadas»** en la primera
  conversación real de un cliente (ws11, 12/10/2026 19:04 UTC, la única con una conclusión en prod al
  14/10). Un porcentaje arriba de 100 es imposible, y encima de ese número el aviso aconseja SUBIR EL
  PRECIO. La causa probable (no medida sobre sus datos): `tasa_cierre_sobre_calificados` divide los
  cierres por los calificados, y `lib/analisis-negocio.ts` ya avisa que «Calificados es un piso» cuando
  hay asistentes sin la calificación marcada; Offer usa la tasa sin mirar eso ni topearla. Lo mismo
  muerde a `alertasEmbudo`, que con `cierreCalificados ?? cierreAsistencias` puede tapar un cierre
  malo con uno inflado. Falta: descartar la tasa sobre calificados cuando `sin_marcar > 0` o cuando
  pasa de 1, caer a la de asistencias, y su test probado rompiéndolo. Es la regla «un mensaje que sale
  solo no puede AFIRMAR lo que no verificó». **Vive en:** `lib/offer-reglas.ts` (`alertasPrecio`,
  `alertasEmbudo`) · `lib/offer-contexto.ts` (arma `TasasEmbudo`) · `lib/analisis-negocio.ts`.
  *14/10/2026, cuenta claude1.*

- **La lectura de la última oferta analizada no está declarada en la API de MaKo**
  (`lib/api-mako/areas/negocio.def.ts`): MaKo por WhatsApp no sabe que existe la conclusión.
  Se dejó porque `lib/api-mako` y `docs/api-mako.md` tenían cambios sin commitear de otra
  sesión; es una lectura `SIN_HTTP` con `gating: { tab: 'offer', rolMinimo: 'admin' }`.
- **Una versión EXTERNA del PDF** (sin diagnóstico, números ni datos «[completar]») para
  mandarle a un prospecto. La de hoy es para el dueño.
- **El umbral de la alerta de foco** (`alertaFoco`, `lib/offer-reglas.ts`) no está medido
  contra los productos y ofertas reales de los clientes.
- **La urgencia no se escribe al «Guardar como mi oferta»**: `ofertas` exige un tipo cerrado
  (fecha, cupos, capacidad, inicio) que la propuesta no trae, y deducirlo sería inventar una
  restricción que después sale en un anuncio. Se declara a mano en el editor de la oferta.
- **Ver versiones anteriores** de la conclusión, y renombrar o borrar conversaciones desde la
  pantalla (la API ya lo soporta).
- **La métrica que más le importa a una oferta, la tasa de cierre, no está en el catálogo de
  métricas de Experiments**: un «Probarlo» de Offer deja que MaKo elija la métrica más cercana.

## Los cuatro que se cerraron el 13/10, y qué enseñó cada uno

Los cuatro estaban en «Lo que quedó SIN hacer» desde el 11/10 y se cerraron de corrido. Lo que vale
guardar no es que se hicieron: es por qué el diagnóstico de cada uno estaba a medias.

### Un link con `?page_id=` no se leía, y no era una regla: era una limitación disfrazada

`linkParaLeer` RECHAZABA el link si traía un parámetro propio, con un mensaje que mandaba a copiar el
texto a mano. El motivo real era que `extraerLanding` sólo sabía bajar la URL **normalizada de Landing
Analyst** —`normalizarUrl` tira el querystring ENTERO y el `www.`, a propósito, porque esa es la
IDENTIDAD de una landing y sin eso un cliente tenía 24 «landings» que eran 2 páginas—. Con esa URL, un
`?page_id=245` de un WordPress sin permalinks bajaba la HOME: otra oferta, y la IA anotando piezas de
ahí sin que nada avisara. Rechazar era correcto mientras no hubiera alternativa.

**La regla:** cuando un mensaje de error manda al usuario a hacer a mano lo que el sistema no sabe
hacer, lo que falta es la capacidad, no la validación. `urlTalCual` (lib/landing-url.ts) convive con
`normalizarUrl` y las dos están documentadas una contra la otra: **«¿qué landing es ésta?» y «¿qué
página quiere que lea?» son dos preguntas distintas**, y mezclarlas hace aparecer la misma página
veinticuatro veces o bajar la equivocada. La baranda SSRF no cambió: `bajarHtml` revalida en cada salto.

**Vive en:** `lib/landing-url.ts` (`urlTalCual`) · `lib/landing-fetch.ts` (`extraerLanding(url, { talCual })`) ·
`lib/offer-reglas.ts` (`linkParaLeer`) · `app/api/offer/route.ts` (`leerLink`)

### El audio se re-subía en cada reintento, y el servidor lo estaba guardando para eso

El servidor conserva el binario cuando la IA no pudo escuchar («el binario NO se borra: la pantalla
puede reintentar con el mismo audio»). La pantalla no se enteró nunca: `AudioGrabado` no recordaba el
`path`, así que cada reintento volvía a convertir a MP3 y a subir, y el anterior quedaba huérfano
pagando. Lo irónico es que los DOCUMENTOS ya lo hacían bien —`docsLeidos` existe justamente para no
releerlos— y el audio quedó afuera del mismo patrón.

**La regla:** cuando un lado conserva algo «para que el otro lo reuse», el contrato tiene que estar
escrito en los DOS. Un comentario en el servidor no es una interfaz.

De paso se cerró el hermano: un binario que ya no se va a usar (el dueño descarta la nota de voz, o
cambia de conversación mientras algo sube) ahora se borra con la acción `'descartar-subida'`, con la
misma validación de path que `'leer'` — que hasta hoy era lo único que borraba, y en esos dos caminos
no se llamaba.

**Vive en:** `app/offer/OfferApp.tsx` (`AudioGrabado.path`, `descartarSubida`) ·
`app/api/offer/route.ts` (`case 'descartar-subida'`)

### «Guardar si no hay» vivía en la ruta con la clave copiada, y un test cuidaba la copia

La ruta tenía el insert-if-absent entero con `'negocio.fase.diagnostico'` escrito a mano, y un test
leía los DOS fuentes para comprobar que la cadena no se separara de `FASE_KEY`. Pasó al store como
`guardarFaseSiNoHay`, que es el dueño del setting.

**La regla:** **una guarda que cuida una copia es la pista de que sobra la copia.** El test no se borró,
cambió de objeto: ahora fija que la ruta NO escriba la clave ni use `setDiagnosticoFase` (el upsert que
pisa), y que el store use el insert atómico con la relectura ESTRICTA. Probado rompiéndolo (el store
releyendo con `getDiagnosticoFase`, que es tolerante, y escribiendo con `setSetting`): 1 fallo, 12 pases.

**Vive en:** `lib/fase-store.ts` (`guardarFaseSiNoHay`, `parseFase`) · `app/api/offer/route.ts`
(`asegurarFaseGuardada`) · `tests/offer-ia-cableado.test.ts`

### La oferta no se ligaba al producto, y la regla para hacerlo ya estaba escrita en otro lado

`seedOfertaDesdeBrief` ya ligaba al producto **sin adivinar**: el que se llama igual (nombre
normalizado) o el único que hay, y si hay varios y ninguno coincide no liga — porque el catálogo es del
CRM, lo que se FACTURA, y elegir uno por parecido le mete al cliente una línea de facturación que no
cargó. Offer creaba ofertas por otro camino y no pasaba por ahí. La regla salió a
`ligarProductoQueCorresponde` y ahora corre en los dos.

**La regla:** antes de decidir cómo resolver un puente que falta, buscá si el OTRO camino que crea la
misma entidad ya lo resolvió. Acá el fork («¿y si la IA elige el producto?») lo cerró un precedente, no
una decisión nueva.

⚠️ Se liga por el nombre LIMPIO de la propuesta, no por el que entró a la base: los candidatos de
desempate («… (2)», «… · versión 3») existen para no chocar el índice único, no son cómo se llama la
oferta. Y va DESPUÉS del CAS y sólo si la oferta sobrevivió: la que pierde se borra un instante después.

**Vive en:** `lib/ofertas.ts` (`ligarProductoQueCorresponde`) · `lib/offer-sesiones.ts` (`guardarComoOferta`)

### Y lo que NO se cerró, dicho con su motivo

Las 13 decisiones de «A definir» **no se miraron con clics, y está bien**: lo que se podía verificar sin
navegador ya está verificado y es más fuerte que un clic — `tests/offer-a-definir.test.ts` (10 en verde)
y el bloque de cableado de `tests/offer-ia-cableado.test.ts`, los dos construidos con un arnés de
roturas («la base en verde, 13 de 13; 6 roturas más, las 6 cazadas con 1 fallo, 12 pases»). Lo que queda
sin ver es cómo SE VE, y eso lo revisa Martín por su propia regla del 11/10.

*13/10/2026, cuenta claude2.*
