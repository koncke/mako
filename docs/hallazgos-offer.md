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
  - ~~**El Archivero no se entera de lo que se sube en Offer**~~ — **CERRADO el 15/10/2026**
    (`f4ed5e069`). Martín decidió que Offer conserva el binario y paga una extracción de campos por
    documento; lo que enseñó, en «El Archivero desde el chat (15/10/2026)» al final.
  - **El avatar que se arma en el chat no se guarda en Avatares, y se queda así.** No es un pendiente:
    `setAvatares` reemplaza la lista entera, y escribir desde el chat sin que una persona confirme rompe
    «un canal propone, una persona confirma». Queda en la pieza `cliente`, que es donde corresponde.
  - **La transcripción de un audio se ve cortada a 140 caracteres** (lo hace `BurbujaHilo`, que es
    compartido).
- **Leer una imagen, un PDF escaneado o un audio puede cobrar en la OpenAI del cliente**:
  `archivoATexto` usa las cascadas compartidas de visión y transcripción, que terminan en
  OpenAI (lo mismo que hoy le pasa al Archivero y al importador del Plan). La conversación, el
  diagnóstico y la oferta nunca pagan; guardar cada archivo en El Archivero SÍ paga desde el 15/10
  (decisión de Martín, ver al final). Cerrar lo de leer es un `sinPago` en `leerDocumentoIA` y
  `transcribirAudio` (`lib/ai-cheap.ts`), que es un archivo compartido.
- ~~**Un binario puede quedar en Storage** si la persona cambia de conversación justo mientras un
  archivo se sube~~ — **CERRADO el 13/10/2026** con la acción `'descartar-subida'` (ver «El audio se
  re-subía en cada reintento» más abajo).
- ~~**El aviso de precio afirmó «Cierras el 170% de las llamadas calificadas»**~~ — **CERRADO el
  14/10/2026** (`db81f96`), ver «El 170%, la API y la voz» al final.

- ~~**La lectura de la última oferta analizada no está declarada en la API de MaKo**~~ — **CERRADO
  el 14/10/2026** (`listar_analisis_oferta`, `ver_analisis_oferta`), ver «El 170%, la API y la voz».
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
- **«Los números» de la propuesta no dicen de dónde salen** (la IA calcula márgenes y un «LTV:CAC estimado» que nadie
  dio): ver «El “43” de Código Inmobiliario» al final (17/10/2026).
- **MaKo Mobile** no dibuja la fuente del puntaje ni elige funnels al guardar: ver las entradas del 17/10/2026 al final.

## Los cuatro que se cerraron el 13/10, y qué enseñó cada uno

Los cuatro estaban en «Lo que quedó SIN hacer» desde el 11/10 y se cerraron de corrido. Lo que vale
guardar no es que se hicieron: es por qué el diagnóstico de cada uno estaba a medias.

### Un link con `?page_id=` no se leía, y no era una regla: era una limitación disfrazada

`linkParaLeer` RECHAZABA el link si traía un parámetro propio, con un mensaje que mandaba a copiar el
texto a mano. El motivo real era que `extraerLanding` sólo sabía bajar la URL **normalizada de Landing
Analyst** —`normalizarUrl` (desde el 15/10/2026, `claveDeLanding`) tira el querystring ENTERO y el `www.`, a propósito, porque esa es la
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

### Y ese «descartar-subida» borraba también la nota que SÍ se mandó (16/10/2026)

Síntoma (leído en el código al copiar la pantalla al teléfono, no medido): una nota de voz enviada
desde escritorio deja de sonar. `enviarAudio` llamaba a `descartarSubida(a.path)` con todo lo que no
volvía a la barra, también con `'salio'`; ese `path` es el que el mensaje guarda y el que firma GET
/api/offer/audio. El servidor no lo frena: `'descartar-subida'` sólo mira que el path sea del workspace.
**El diagnóstico obvio era el equivocado:** «se borra porque falló la transcripción»; la 422 la borra el
servidor, y la nota BUENA la borraba la pantalla. Y un test lo fijaba: tests/offer-v2-pantalla.test.ts
exigía el `descartarSubida(a.path);` suelto.

**La regla:** un binario se suelta sólo cuando el envío se TIRA (413/415/422 o un audio que no se puede
convertir): `if (res === 'tirar') descartarSubida(a.path);`. Lo que salió vive en el mensaje y se borra
con la conversación. Probado rompiéndolo: el borrado suelto da 9 / 1.

**Vive en:** `app/offer/OfferApp.tsx` (`enviarAudio`) · `app/m/offer/OfferM.tsx` (la misma regla) ·
tests/offer-v2-pantalla.test.ts (§ 6) · tests/m-offer.test.ts («orquestación»)

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

## El 170%, la API y la voz (14/10/2026)

### «Cierras el 170%»: el arreglo obvio era el equivocado

**Síntoma:** la única oferta armada por un cliente en prod (ws11, 12/10) decía «Cierras el 170% de las
llamadas calificadas» y, con ese número, le aconsejaba subir el precio. **Causa:** el cierre sobre
calificados divide los cierres por los calificados, y con asistencias sin la calificación marcada los
calificados son un PISO (`lib/analisis-negocio.ts` ya lo avisaba en sus advertencias; Offer usaba la tasa
cruda).

Las dos salidas que aparecen primero estaban mal, y por razones opuestas:
- **Topear a 100%** sigue afirmando un número que nadie midió.
- **Caer siempre al cierre sobre asistencias** sirve para una de las dos preguntas y miente en la otra.

Lo que sí se sabe, porque los calificados reales nunca superan a las asistencias:
`cierre sobre asistencias ≤ cierre real sobre calificadas ≤ cierre sobre el piso de calificados`. O sea que
el de asistencias es un PISO (sirve para «más de 30%: hay margen para subir el precio») y el del piso de
calificados es un TECHO (sirve para «menos de 25%: revisa el cierre»). Cada cota vale en UNA dirección.
**La regla:** cuando un dato sale de dividir por algo que puede estar contado de menos, preguntá en qué
dirección se equivoca y usalo sólo para la afirmación que esa dirección permite. Nada fuera de 0-1 se dice.

**Y lo ya guardado se filtra al LEER, no se reescribe.** La conclusión de la clienta sigue en la base con
el texto viejo: es su historial. Lo leen tres lugares (el PDF, la pantalla y la API de MaKo), y los tres pasan
por `avisosAfirmables`; un lector nuevo de `calculo.alertas` tiene que hacer lo mismo
(`tests/offer-api-mako.test.ts` mira los tres).

**Vive en:** `lib/offer-reglas.ts` (`cierreConfiable`, `alertasPrecio`, `alertasEmbudo`) ·
`lib/offer-marco.ts` (`avisosAfirmables`) · `lib/offer-contexto.ts` (`sinMarcar` en `TasasEmbudo`)

### Offer en la API de MaKo

Dos lecturas en el área `negocio`: `listar_analisis_oferta` y `ver_analisis_oferta`, gratis, sin http y con
`gating: { tab: 'offer', rolMinimo: 'admin' }`. Dos cosas que no se ven en el código:
- **«Offer» no llevaba a ningún área.** El clasificador (`lib/mako-intencion.ts`) reconoce «oferta» y no la
  palabra en inglés con la que se llama la tab: «mostrame la conclusión de Offer» caía en experimentos y la
  lectura no viajaba en el turno. Se mide con `clasificarIntencion` + `herramientasDelTurno`, como corre.
- **`docs/api-mako.md` no cambia, y no es un error.** El generador dice «ya estaba al día» porque la
  referencia lista lo que sale por http; una lectura sin http no aparece ahí.

La conversación en sí (un turno, adjuntar, armar la oferta) no se maneja desde la API: es la pantalla.

**Vive en:** `lib/api-mako/areas/negocio.def.ts` + `negocio.run.ts`

### La voz de marca: no era una configuración nueva

Pedido (Fathom 858545195 @44:56): «una configuración de voz de marca y tono personalizado en el Offer
Generator». La voz ya existía; Offer era la única feature que no la leía. `vozDelNegocio`
(`lib/nutricion-generator.ts`) da la guía destilada del Chat Agent o, si no hay, la marca que declaró el
dueño; `ContextoOffer.voz` va APARTE de `texto` (que se recorta en `TOPE_CONTEXTO`), y el slot `{{voz}}`
está en el turno y en la oferta, no en el diagnóstico, que no escribe copy.

- **La voz cambia el TONO, nunca los datos**: las reglas de «[completar]» y de no inventar mandan igual.
- **El idioma neutro sigue**, con una excepción escrita (`EXCEPCION_VOZ`): sólo los textos que el negocio
  le dice a sus clientes. `tests/offer-ia-cableado.test.ts` exige el `${IDIOMA}` en cada system: por eso la
  excepción se suma al bloque y no lo reemplaza.

**Lo que quedó sin hacer:**
- **Un prompt guardado desde /configuraciones con la plantilla vieja no trae `{{voz}}`**: la oferta sale
  sin la voz, sin error. Es lo mismo que ya pasaba con `{{alertas}}`.
- **No se probó con una IA de verdad** ni se miró una oferta armada con voz: los tests fijan el cableado.
- **La tab Análisis** (Experiments) sigue mostrando «Sobrevive del anterior 170%» en el escalón de cierres
  cuando hay asistencias sin calificar. Vive en `lib/analisis-modelo.ts` (`analisisAMarkdown`), con la
  advertencia del piso arriba; está anotado en `docs/hallazgos-crm.md`.

*14/10/2026, cuenta claude1.*

## El Archivero desde el chat (15/10/2026)

**La decisión** (Ticketera, 15/10/2026 05:32, ref `offer-archivero`), textual: «¿El Archivero del chat
guarda el archivo y paga una extracción por documento? → A · Sí».

**Lo que hace ahora Offer con un documento:** 'leer' lo lee para la conversación como siempre
(`archivoATexto`, feature `offer`) y, con el documento YA guardado en la conversación, le pasa el binario
POR DETRÁS (`after`) a `registrarDocumentoSinPisar` (`lib/archivero.ts`). Ésa lo mueve de
`<ws>/offer/<uuid>` a `<ws>/<id>` (el lugar y el formato de los que sube la pantalla del Archivero),
corre la MISMA extracción (`extraerDeArchivo`) sobre el texto que Offer ya leyó, escribe la fila y suma al
brief sólo las claves de ese documento. Lo que pasó queda en el campo `archivero` del documento y de los
adjuntos que lo llevan, y si falló, el chip del archivo dice por qué («No quedó en El Archivero: …»).

Lo que no se ve en el código:

- **El «ya está» no puede mirar la fila antes de pagar: la extracción tarda segundos.** Dos envíos del
  mismo archivo (lo adjuntó dos veces, o la misma lectura llegó dos veces) se pisaban en esa ventana y
  pagaban dos. El candado es MOVER el binario a su lugar ANTES de extraer: `storage.move` es atómico y no
  pisa, así que uno solo gana. Y el id sale del CONTENIDO (sha256 del workspace + los bytes, con forma de
  UUID), por eso dos envíos del mismo archivo apuntan al mismo lugar. Lo que subió antes la pantalla del
  Archivero tiene id al azar: ahí el «ya está» es por nombre y tamaño en bytes, una heurística.
- **El que pierde la carrera no siempre se entera por «el destino ya existe».** Si los dos traían el MISMO
  origen (un 'leer' repetido con el mismo path), el segundo choca con «el origen no existe». Lo que se mira
  es si el destino existe, no el texto del error (`reclamarLugar`). Un destino sin fila más viejo que un
  registro (10 min, `TOPE_HUERFANO_MS`) es basura de uno que se cortó y se reemplaza.
- **`buildEstado(true)` no es «guardar el estado del Archivero»: reescribe las answers enteras** con lo de
  los archivos y lo manual, y se lleva lo que el wizard guardó por la otra puerta (negocio_objetivo,
  negocio_freno, marca_*). La cabecera de `lib/api-mako/areas/negocio.helpers.ts` ya lo advertía. Un
  documento NUEVO se suma sin recalcular (`answersConDocumento`), y un test lo compara contra
  `computeEffective` de verdad (por eso se mudó, sin cambios, a `lib/archivero-registro.ts`).
- **Un campo nuevo en un documento de Offer se BORRA en la próxima escritura** si no se agrega a
  `sanearDocumentos` y a `sanearAdjuntos`: los dos rearman cada objeto con los campos que conocen, y toda
  escritura de la conversación pasa por ahí.
- **Los adjuntos de un mensaje son COPIAS del documento** (las arma el turno con `adjuntoDe`). El registro
  termina segundos después del turno, así que el resultado se escribe en el documento Y en los adjuntos que
  lo llevan (`conArchivero`); en uno solo, el chip no se enteraba.
- **El tag del gasto es «El Archivero», no `offer`**, con el motivo «Offer → El Archivero: extraer campos
  de «…»». Es la misma extracción que la pantalla del Archivero, y así la medición por documento del
  Pricing (`archivero`, n=94) sigue valiendo; la feature `offer` mantiene su promesa (la conversación, el
  diagnóstico y la oferta no pagan), y la nota del catálogo dice qué sí paga.
- **Va sólo lo que es un ARCHIVO.** Un audio o video subido como documento (`via: 'audio'`) no: la pantalla
  del Archivero no los acepta y se guardaría la grabación entera. La página de un link tampoco: no hay
  archivo que guardar, y lo aprobado fue guardar el archivo. Las notas de voz del dueño, menos.
- **La API de MaKo no necesitó nada:** `ver_archivero`, `obtener_link_documento_archivero` y
  `borrar_documento_archivero` leen `archivero_files` del workspace, así que lo que llega desde Offer
  aparece solo.

**Lo que quedó sin hacer:**
- **El panorama no se regenera** con los documentos de Offer: sería una segunda llamada paga por
  documento, y lo aprobado es una. Y no los recoge después: el panorama se arma con los textos de
  cada subida de la pantalla del Archivero más el anterior, así que lo de Offer nunca entra.
- **`archivero_files` no guarda de dónde vino un documento** (no hay columna): en el Archivero, uno de
  Offer se ve igual que uno subido ahí. Para distinguirlo hace falta una migración.
- **Dos registros que terminan juntos pueden perder un merge del brief**: los dos leen las answers, suman
  lo suyo y escriben (la fila de los dos queda; el campo de uno puede faltar en las answers hasta el
  próximo recálculo del Archivero). Es la misma ventana que ya tenía el Archivero con varias subidas.
- **Que SÍ quedó no se muestra** (a propósito: un chip que habla siempre deja de avisar).
- **No se vio en el navegador ni contra Storage de verdad**: los tests fijan lo puro y el cableado.

**Vive en:** `lib/archivero.ts` (`registrarDocumentoSinPisar`, `reclamarLugar`) · `lib/archivero-registro.ts`
(lo puro) · `app/api/offer/route.ts` (`leer`, `archivarDespues`, `anotarArchivero`) · `lib/offer-reglas.ts`
(`seArchivaDesdeOffer`, `conArchivero`, los saneos) · `app/offer/ayudas.ts` (`notaDelAdjunto`) ·
`tests/offer-archivero.test.ts` (13 tests, 30 roturas cazadas)

*15/10/2026, cuenta claude3.*

## El chat no desaparece, y Offer es el onboarding (16/10/2026)

**El pedido que no estaba escrito.** Martín pidió al Cerebro «el chat no debe desaparecer jamás… Había
dado feedback de esto, revisalo». No estaba en ningún lado del repo ni de la memoria: estaba en la
transcripción de Fathom de la llamada con Leila del 12/10 (la API de Fathom, `recording_id 191910109`; el
link que anotaba el repo, `calls/858545195`, da 404). Dos momentos, los dos de Martín:
- **00:37:00**, con la pantalla de carga tapando el chat: «en lugar de que cambie el chat, que siga
  manteniendo el mismo chat pero que MaKo te envíe un mensaje diciéndote ya estoy trabajando en hacer tu
  diagnóstico o en hacer tu oferta… te mando una notificación cuando esté listo».
- **00:42:47**, con la oferta en una pantalla aparte: «yo de hecho quisiera que jamás se salga el recuadro
  del chat… de última que haya como una preview de un pop-up».
- ⚠️ Fathom pega voces: lo que figura como Martín a veces es Leila leyendo la pantalla (el «programa de
  autonomía operativa» del 00:37:00 es la oferta leída de la pantalla, no Martín).

**Síntoma → causa.** Apretar «Armar mi oferta» REEMPLAZABA el chat por la vista Generando y, al terminar,
por la de la Conclusión (`setVista('generando')` / `setVista('conclusion')` en `OfferApp.tsx`). El chat
volvía sólo con «Seguir afinando». **Ahora no hay vistas:** armar es un mensaje más del hilo
(`GenerandoEnChat` dentro de una burbuja, con sus dos pasos y su reintento, `armando` de `ChatOffer`) y la
oferta se ve en un `Modal` ENCIMA del chat, desde «Ver mi oferta» del PDF o del riel. El PDF llega como
mensaje y la ventana NO se abre sola (en el onboarding, la persona está eligiendo su CRM mientras tanto).

**Offer es el onboarding.** El mismo motor (`OfferApp` con `arranque`) es /onboarding: sin selector, la
conversación nace sola en el funnel PRINCIPAL y alrededor van los mensajes del arranque. Lo que eso exige
de este motor, y vale para tocarlo después:
- **Los mensajes del arranque llevan id `arr-…`** y la opción del último mensaje se reparte por eso: si es
  `arr-`, contesta el arranque; si no, Offer.
- **`visible` (la conversación con los del arranque alrededor) va en `useMemo`**: un arreglo nuevo en cada
  tecla hace que el hilo se vuelva a desplazar con cada letra (la misma trampa que `ChatOffer` ya cuidaba).
- **Después de «¡Listo!» el composer NO va a Offer**: los mensajes del arranque van DESPUÉS de los de la
  oferta, así que un turno nuevo quedaría arriba de la tarjeta final. La oferta sigue en la tab.
- **«Probarlo» no se ofrece en el onboarding** (`conProbar`): Experiments rebota al onboarding mientras está
  pendiente, y además sacaría a la persona del chat.

**El crédito de Claude** entra en `pedir` ANTES de su bucle de la red gratis (no pidiéndole
`redDePlataforma` a la cascada, que volvería a probar las mismas keys gratis y no conoce el respaldo flojo
ni `hastaRedMs`). Lo habilita la lista del veto sólo mientras `onboardingPendiente()`.

**Lo que quedó SIN hacer:**
- ~~El aviso al terminar si la persona se fue~~ **HECHO el 16/10**: la oferta se arma en el servidor y avisa
  (ver «La oferta se arma en el servidor, y MaKo avisa cuando está», abajo).
- **El resto del feedback de esa llamada — HECHO el 16/10** (ver «Una entrada no es un alto ticket» y «El PDF en dos partes», abajo): que detecte las ofertas de menor a mayor precio
  («¿qué le vendes después?», 00:34:26); que distinga low ticket de high ticket y servicio hecho por vos /
  con vos / para vos (00:38:54, 00:39:11: no prometer implementar algo que hace el cliente en un curso);
  que no vuelva a proponer el diagnóstico cuando ya tiene las respuestas (00:35:43); que la oferta salga
  menos corporativa (00:41:03, 00:44:48); y ~~que el PDF separe el diagnóstico de su oferta actual de la
  propuesta nueva (00:45:30)~~ (**hecho el 16/10**, «El PDF en dos partes», abajo). La voz de marca (00:46:06) ya estaba hecha (`db81f96`).
- **No se vio en el navegador**: la RAM de la máquina no dejaba levantar la app. Lo cubren los tests de
  fuente y lo puro ejecutado.

**Vive en:** `app/offer/OfferApp.tsx` (sin vistas; `ArranqueOffer`; la Conclusión en un `Modal`) ·
`app/offer/ChatOffer.tsx` (`armando`, `onVerOferta`, `avatar`, `extra`, `soloTexto`) ·
`app/offer/Generando.tsx` (`GenerandoEnChat`) · `app/offer/Conclusion.tsx` (`conProbar`) ·
`lib/offer-ia.ts` (el crédito en `pedir`) · `tests/onboarding-arranque.test.ts`, `tests/offer-ia-cableado.test.ts`

*16/10/2026, cuenta claude3.*

## La oferta se arma en el servidor, y MaKo avisa cuando está (16/10/2026)

**El pedido** (Martín, llamada con Leila del 12/10, 00:37:00): que MaKo arme la oferta sin que la persona se quede
esperando en la pestaña, «te mando una notificación cuando esté listo».

**El diagnóstico obvio era el equivocado.** Parecía que alcanzaba con avisar al final. Pero «Armar mi oferta» eran DOS
pedidos que esperaba el NAVEGADOR (`diagnosticar` y `generar`, cada uno de hasta ~285 s): si la persona cerraba la
pestaña durante el primero, el segundo no salía nunca y la oferta no se hacía. Con el segundo ya en curso, sí
terminaba (nada en la ruta mira `req.signal`). Y en el onboarding, volver a montar la pantalla re-corría el
diagnóstico desde cero: pagaba la IA otra vez, y si el primer `generar` seguía vivo, su CAS fallaba con un 409.

**Ahora:** `armar` anota el armado en la fila (`offer_sesiones.armado`, mig 0296: cuándo, en qué paso, de dónde, quién
y el error), contesta al toque y corre los dos pasos en un `after()` (`armarPorDetras`). La pantalla sólo relee cada
4 s mientras `sesion.armando.corriendo`, y lo que dibuja sale de lo guardado: una recarga, otra pestaña o la persona
que vuelve ven el mismo armado. Al terminar, el evento de la plataforma `oferta_lista` (docs/diseno-avisos-plataforma.md §7).

**Lo que conviene saber antes de tocarlo:**
- **`maxDuration = 800`** (como /api/retro): los dos pasos en una sola invocación son ≤285 + ≤288 s. Cada paso cuenta
  su plazo desde SU arranque (`inicio` de lib/offer-ia.ts), no desde el pedido.
- **Cada escritura es de ESTE intento** (`armado.intento`, por CAS): un armado viejo que termina tarde no pisa el
  nuevo. Y `armar` es idempotente: con uno corriendo, devuelve la conversación sin arrancar otro (el doble clic, la
  pantalla del onboarding que se vuelve a montar, dos pestañas).
- **Un armado que se cortó no queda «armando» para siempre:** pasados `ARMADO_VENCE_MS` (15 min, más que el
  `maxDuration`), la vista lo muestra como fallido («Se cortó…») y se puede volver a pedir.
- **El reintento arranca desde el paso que falló:** con `borrador` (el diagnóstico hecho), desde la oferta.
- **La columna está en las COLS:** la mig 0296 va ANTES del deploy (se aplicó el 16/10 con
  scripts/apply-migration.mjs; es aditiva y el código de antes no la lee).
- **MaKo Mobile sigue con los dos pasos sueltos** (app/m/offer/OfferM.tsx): `diagnosticar` y `generar` se quedaron
  para él. Si se lo pasa a `armar`, el teléfono gana lo mismo.

**El aviso:** se emite SIEMPRE al terminar (Martín no pidió «sólo si se fue», y un evento de la plataforma no admite
condiciones hoy). Va por `emitirEventoDePlataforma`, nunca por `emitirDelCatalogo`: sin fila, éste cae al camino viejo
y mandaría el `ejemplo` del catálogo como si fuera real.

**Lo que quedó SIN hacer:**
- **Correr la mudanza después del deploy:** `node scripts/mudanza-avisos-plataforma.mts --eventos=oferta_lista
  --aplicar`. Sin esa fila en el ws 9, la oferta se arma en el servidor igual, pero no avisa.
- **Sin grupo de MaKo no llega el WhatsApp.** En el onboarding pasa seguido: el teléfono se pide DESPUÉS de la oferta.
  Lo ve en el chat cuando vuelve. «En la app» de escritorio no existe todavía: la tabla `notificaciones` no está en
  producción y no hay campanita (docs/hallazgos-chatbot.md, «Lo que el evento de la oferta lista destapó del motor»).
- **Verificado en el ws3 el 16/10** (build parcial + `next start`, la IA de verdad): `armar` contestó en 1,4 s; la página
  se cerró a los 3 s, en pleno diagnóstico; el servidor pasó a «oferta» a los 33 s y terminó a los 113 s (versión 1,
  el PDF en el chat, el armado borrado). El aviso dio `sinFila` y lo dijo en el log, como debe hasta la mudanza. Al
  volver, la oferta estaba en el chat y el onboarding siguió con lo que faltaba del diagnóstico. El ws3 quedó como estaba.

**Vive en:** `app/api/offer/route.ts` (`armar`, `armarPorDetras`, `diagnosticarSesion`, `generarSesion`) ·
`lib/offer-reglas.ts` (`sanearArmado`, `armadoEnCurso`, `armadoParaVista`) · `lib/offer-sesiones.ts` (la columna) ·
`app/offer/OfferApp.tsx` (`armar`, la relectura) · `lib/oferta-lista.ts` y `lib/oferta-lista-server.ts` (el aviso) ·
`supabase/migrations/0296_offer_armado.sql` · `tests/offer-armado-servidor.test.ts` (14 roturas)

*16/10/2026, cuenta claude3.*

## El PDF en dos partes: «Tu oferta hoy» y «La propuesta que te armo» (16/10/2026)

**El pedido** (Martín, llamada con Leila del 12/10, 00:45:30): primero, de la oferta de HOY, «me gustó esto, esto y
esto, y esto lo cambiaría y haría tal forma»; después, aparte, «esta es la propuesta que yo te armo para vos».

**Lo que lo mezclaba** (no era sólo un título):
- La portada ponía el NOMBRE DE LA OFERTA NUEVA arriba del PUNTAJE DE LA ACTUAL: se leían como una sola cosa.
- Lo bueno era una sola frase (`fuerte`); todo lo demás del diagnóstico mira lo flojo.
- El «cómo subirla» de cada dimensión (`NotaDimension.mejora`) se veía en la pantalla y nunca llegaba al PDF.

**Ahora:** portada neutra («La oferta de X», qué trae el documento) · **Parte 1 · Tu oferta hoy**: puntaje, lo que
falta, el diagnóstico del negocio, el de la oferta, **«Lo que me gustó»** (lista) y **«Lo que cambiaría, y cómo»** (los
3 cambios con su hipótesis y, parte por parte, la `mejora` de cada nota de 5 o menos) · **Parte 2 · La propuesta que te
armo**, en página NUEVA, con el nombre y la frase de la oferta nueva arriba.
- «Lo que me gustó» sale de lo que YA deja el diagnóstico (`loQueMeGusto`, lib/offer-marco.ts): las fortalezas, las
  notas de 7 o más con su porqué y los puntos del control final que ya cumple. Sin IA nueva.
- El diagnóstico ahora pide **`fuertes`, de 1 a 3** (citando al dueño, nunca inventadas para llenar). `fuerte` se queda
  como la primera: lo leen la pantalla y MaKo Mobile, y las conclusiones viejas sólo tienen ésa.
- **El rótulo de la pantalla no cambió** («Lo más fuerte», ahora con la lista): MaKo Mobile exige que sus rótulos
  existan tal cual en `Conclusion.tsx` (tests/m-offer.test.ts).

**Una trampa de los tests:** el lector del PDF (`leerPdf`) junta las páginas, así que «la propuesta va en otra página»
contando páginas pasaba igual sin el salto (el documento ya era largo). Se lee por página (`paginasPdf`) y se pide que la
segunda parte sea lo PRIMERO de su página.

**Vive en:** `lib/offer-pdf.ts` (`pdfDeOferta`, `parte`) · `lib/offer-marco.ts` (`loQueMeGusto`, `paraSubirCadaParte`,
`DiagnosticoOferta.fuertes`) · `lib/offer-reglas.ts` (`parseDiagnostico`) · `lib/offer-ia.ts` (regla 6 del diagnóstico) ·
`app/offer/Conclusion.tsx` · `tests/offer-pdf.test.ts` (11 roturas)

*16/10/2026, cuenta claude3.*

## Una entrada no es un alto ticket: el nivel, quién hace el trabajo, las palabras del cliente (16/10/2026)

El resto del feedback de la llamada con Leila (12/10), comprobado contra su conversación REAL (ws 11, la sesión 3:
36 mensajes, «LíderMente», membresía grupal de 800 MXN al mes).

**El diagnóstico obvio era el equivocado.** Parecía que el modelo se había equivocado al convertir la membresía de
800 MXN al mes en un programa de 1.000 USD (unas 25 veces el precio). No: el MARCO daba por hecho el alto ticket en
todos lados. Los tres prompts arrancaban con «negocio de alto ticket», la regla 8 de la propuesta mandaba «desde
1.000 USD», la ruta pedía 90 a 180 días y el código avisaba «por debajo de 1.000 USD, el piso del high ticket». Y la
pregunta de la escalera era fija, «¿qué le vendes ANTES (una entrada más barata)?»: suponía que lo cargado es la cima.

**Ahora:**
- **El nivel lo decide el CÓDIGO con el precio** (`nivelDeOferta`): bajo / medio / alto, con cortes POR MONEDA (una
  membresía mensual tiene sus propios cortes). Viaja PEGADO al bloque de las piezas (`bloqueNivel`), que está en los
  tres prompts, también en los editados desde /configuraciones (un slot nuevo no les llegaría; hoy nadie tiene uno).
- **Una entrada se mejora EN SU NIVEL**: las reglas de alto ticket no aplican, el escalón caro va en «siguiente» y la
  escalera pregunta «¿qué le vendes DESPUÉS?» (`preguntaEscalera`, también en la guía sin IA).
- **El aviso al revés:** si la IA convierte una entrada en otra oferta (3 o más veces el precio en la misma moneda, o
  un precio que ya es de alto ticket en otra), lo dice. Sin convertir monedas: la conversión con el tipo de cambio
  fijo está prohibida en los lectores (tests/moneda-meta.test.ts) y para esto alcanza el orden de magnitud.
- **Quién hace el trabajo:** el formato pregunta si lo hace el cliente solo, con acompañamiento o el negocio por él, y
  la propuesta no promete «implementamos» para un curso (regla 17 y el aviso `prometeHacerloPorElCliente`).
- **Las palabras del cliente:** toda la oferta (no sólo los mensajes) en las palabras de su cliente, y el aviso de la
  jerga de consultor que el dueño no usó (`jergaAjena`: SOPs, KPIs, microgestión, descentralización…; los números,
  que son para el dueño, no cuentan).
- **El turno perdido:** «¿Quieres que avancemos con el diagnóstico de tu negocio?» lo inventó el modelo (no estaba en
  ningún prompt): un paso que no existe. Con las mínimas, el código lo cambia por «Ya tengo lo necesario… toca Armar
  mi oferta», y una opción de «diagnóstico» fuera del diagnóstico de fase se saca siempre.

**Dos trampas al hacerlo:**
- **La guarda de voseo (tests/puente-panel-copy.test.ts) barre el repo ENTERO**, comentarios y regex incluidos, y sus
  excepciones son por ARCHIVO. Los detectores que tienen que nombrar «por vos» para reconocerlo van en un archivo
  aparte (`lib/offer-quien-hace.ts`, exceptuado con su porqué), para no sacar de la guarda todo `offer-reglas.ts`, que
  tiene copy que ve el dueño.
- **Un caso del test que cumple por dos lados no prueba ninguno:** el de la agencia decía también «lo hacemos por ti»,
  y sacar «agencia» de la regex no hacía caer nada.

**La interpretación que tomé** (para que Martín la corrija): Offer sigue siendo para el alto ticket, pero cuando le
cargan una ENTRADA no la convierte: la mejora como entrada y anota el alto ticket como el escalón siguiente.

**Lo que quedó SIN hacer:**
- ~~**«Liberar 10 horas semanales»** pasó el filtro de cifras~~ y ~~**las otras ofertas se eligen de a una**~~ —
  **CERRADOS el 16/10/2026**, ver «El tiempo que es un resultado, la marca con mayúscula y las opciones que se suman».
- ~~**No se armó una oferta contra la IA con estos cambios**~~ — armada el 16/10 en el ws 3 (conversación 7, una
  entrada tipo Leila): el precio quedó en 800 MXN al mes, el formato dice que el cliente aplica con guía y el aviso de
  jerga cazó un «ROI».

**Vive en:** `lib/offer-reglas.ts` (`nivelDeOferta`, `preguntaEscalera`, `bloqueNivel`, `jergaAjena`,
`prometeHacerloPorElCliente`, `mensajeDeMako`) · `lib/offer-quien-hace.ts` · `lib/offer-ia.ts` (los tres prompts) ·
`lib/offer-marco.ts` (las piezas y la guía) · `tests/offer-nivel-y-voz.test.ts` (15 roturas)

*16/10/2026, cuenta claude3.*

## El tiempo que es un resultado, la marca con mayúscula y las opciones que se suman (16/10/2026)

Tres cosas de la oferta de verificación tipo Leila (ws 3, conversación 7) y de su conversación real.

**«Liberar 10 horas semanales» no lo inventaba el filtro: lo dejaba pasar a propósito.** `filtrarCifras` con
`plazos` no marca una cifra seguida de una unidad de tiempo, porque «en 90 días» o «12 semanas» son plazos que el
marco pide. Pero «horas» también era unidad de plazo, y «10 horas semanales» es lo que el cliente LOGRA. Ahora
(`esTiempoDeResultado`) un tiempo que se REPITE («horas semanales», «al día», «por semana») o que se GANA («liberar»,
«ahorrar», «recuperar», «ganar») se marca como cualquier cifra que el dueño no dio; «4 sesiones de 2 horas» y «en 12
semanas» siguen pasando. El caso de Leila pasa por los dos caminos a la vez: con él solo, sacar cualquiera de los dos
no rompía nada (hizo falta un caso de cada camino solo).

**«[Completar: …]» con mayúscula quedaba como dato real.** El modelo escribe la marca a su manera, y TODO lo que la
busca es exacto (`includes('[completar]')`): el resaltado del PDF y de la pantalla, la lista de «datos para
completar», el precio que no se calcula y `limpio` de «Guardar como oferta», que la escribía en `ofertas` como si la
hubiera dicho el negocio. El arreglo obvio, pedirle al modelo la minúscula, era el equivocado: los prompts se editan
en /configuraciones y el modelo varía. Se normaliza en la ÚNICA entrada de lo que trae el modelo, `aObjeto`, a fondo
sobre todo string (`normalizarCompletar`): la usan el turno, el diagnóstico y la propuesta.

**Las otras ofertas se marcan varias.** El turno trae `"varias": true` cuando las opciones se suman (qué otras ofertas
vende, por qué canales consigue clientes), y el mensaje lo guarda (`OfferMensaje.varias`). Con eso las chips se marcan
y desmarcan, y «Enviar (N)» las manda como UNA respuesta, «Un taller, una mentoría y un curso» (`unirOpciones`).
«Armar mi oferta» y la que dice que no hay ninguna («No, sólo ésta», `esOpcionNinguna`) siguen saliendo con un toque.
La pregunta de las otras ofertas lo es aunque el modelo se olvide del campo (`preguntaPorOtrasOfertas`, que mira sólo
la PREGUNTA, desde el último «¿»). Nunca en una pregunta del diagnóstico de fase: ésas tienen una respuesta.

**La trampa:** `sanearMensajes` es una LISTA BLANCA. Un campo nuevo de `OfferMensaje` que no se agrega ahí se ve al
llegar el turno y desaparece al reabrir la conversación, sin un error.

**Lo que quedó SIN hacer:**
- **MaKo Mobile no lee `varias`** (`app/m/offer/HiloOfferM.tsx`): ahí cada toque sigue mandando una opción. No es de
  esta tab; el flag ya viaja en el mensaje.
- **No se armó una oferta contra la IA con el campo nuevo:** si el modelo lo pone en otras preguntas se ve en la
  próxima conversación real.

**Vive en:** `lib/offer-reglas.ts` (`esTiempoDeResultado`, `normalizarCompletar`, `aObjeto`, `parseTurno`,
`mensajeDeMako`, `preguntaPorOtrasOfertas`, `sanearMensajes`) · `lib/offer-ia.ts` (`FORMA_TURNO`, reglas 6 y 14) ·
`app/offer/ChatOffer.tsx` · `app/offer/ayudas.ts` · `tests/offer-cifras-y-marcas.test.ts` (14 roturas)

*16/10/2026, cuenta claude3.*

## El «43» de Código Inmobiliario: cada número dice de dónde sale, o no aparece (17/10/2026, #888)

**El síntoma.** En la revisión con Código Inmobiliario (16/10, Fathom 193666833, 01:48:49) Martín leyó en el diagnóstico
«Cierras el 43% de las llamadas asistidas» y preguntó «¿de dónde sacó ese número?». La pantalla no lo decía.

**El diagnóstico obvio era el equivocado.** Parecía que la IA lo había inventado. No: lo calculaba el CÓDIGO
(`alertasPrecio` con las tasas de `lib/analisis-negocio.ts`) y la IA lo repetía en un cambio y en la mejora de Precio.
Y el número estaba mal armado: dividía las 9 ventas del PERÍODO por las 21 asistencias del PERÍODO, y 4 de esas 9
ventas nunca pasaron por una llamada (en el ws13, clientes cargados como ganados sin primera llamada). Sobre la misma
gente: de las 21 que asistieron compraron 6; de las 13 calificadas, 6.

**La regla que queda.**
- El embudo de Offer se cuenta sobre la MISMA gente (`EmbudoOffer`, `embudoDeAnalisis`; `compraron` y
  `compraron_calificados` en `leerCalificacion`). La tasa del período de la cascada sigue igual para Análisis: es otra
  pregunta («cuánto se vendió este trimestre»), y no se tocó.
- Cada aviso dice de dónde sale su número («tu CRM, del 19/07 al 16/10», «según me dijiste», «en MaKo», «según tu
  diagnóstico de fase») y el puntaje dice que es el promedio de las 9 notas.
- Lo que escribe la IA se revisa cifra por cifra (`diagnosticoConFuentes`): la del dueño queda, la del sistema lleva
  su fuente al lado, la frase con una cifra sin fuente sale. En lo que PROPONE (mejora, hipótesis) sólo si la frase la
  afirma sobre el negocio de hoy («dado que cierras el 43%»): «súbelo a 2.490 USD» es una propuesta.
- Lo ya guardado se LEE sin los avisos del embudo de entonces (`conclusionParaMostrar`), sin reescribir la fila.

**Tres trampas que aparecieron al hacerlo:**
- **Un conteo le daba fuente a un porcentaje.** «De 43 primeras llamadas» (un conteo del CRM) hacía pasar «43%»: las
  claves de cifra no distinguían. Ahora un porcentaje lleva su «%» en la clave (`claveConFuente`, `cifrasConPorcentaje`).
- **Las horas de una transcripción eran «cifras del dueño».** La llamada que subió el ws13 trae «0:04:43»: todo número
  del 0 al 59 pasaba por dicho por él, el 43 y el 36 incluidos. `cifrasDelNegocio` ya no lee horas ni fechas (también
  para la propuesta, que tenía el mismo agujero sin saberlo).
- **«ojalá sí»:** el número corregido (46% de las calificadas) es MÁS alto que el 43. El arreglo no era bajar el número
  sino decir de dónde sale, para que Joan lo pueda contrastar con su CRM.

**Lo que quedó SIN hacer:**
- «Los números» de la propuesta (Parte 2) no pasan por esto: ahí la IA calcula márgenes y un «LTV:CAC estimado
  superior a 5 a 1» que nadie dio (`propuesta.numeros`, `lib/offer-reglas.ts` → `aplicarReglasPropuesta`). Pide decidir
  si esos números los calcula el código o se marcan.
- MaKo Mobile no dibuja la fuente del puntaje (`app/m/offer/HojasOfferM.tsx`); los avisos y los textos sí le llegan
  arreglados (salen de la vista del servidor).

**Vive en:** `lib/offer-reglas.ts` (`EmbudoOffer`, `alertasEmbudo`, `alertasPrecio`, `cifrasConFuente`,
`diagnosticoConFuentes`, `conclusionParaMostrar`) · `lib/analisis-negocio.ts` (`leerCalificacion`) ·
`lib/offer-contexto.ts` · `app/api/offer/route.ts` (`diagnosticarSesion`) · `tests/offer-cifras-con-fuente.test.ts`
(15 roturas)

## Un documento largo se lee entero, por partes (17/10/2026, #865)

**El síntoma.** La transcripción de la llamada de venta del ws13 (64.462 caracteres) quedó «Leí sólo el principio
(40.000 de 64.462)». Y lo guardado tampoco llegaba entero: los documentos de un pedido comparten 24.000, así que la IA
leía ~17.000 de la llamada. Lo que el cliente dijo en la segunda mitad no existía para MaKo.

**La regla que queda.** Se guarda el texto entero (300.000, ~4 horas de transcripción). Uno que no entra en un pedido
(`TOPE_DOC_ENTERO`, 16.000) se parte sin perder un carácter (`partirEnPartes`: `partes.join('') === texto`, corta en un
renglón) y la IA lee CADA parte (`lecturaDeParte`, prompt editable «offer.lectura.system»). Lo que viaja a la
conversación, el diagnóstico y la oferta es esa lectura entera (`cuerpoDelDoc`). Una parte que la IA no pudo leer va
tal cual y el chip lo dice. Vale para un archivo, la página de un link y la transcripción de un audio largo.

**Medido con la IA de verdad (ws3, 17/10):** 43.000 caracteres, 3 partes, 18 s por la red de plataforma (Gemini), y
los 8 datos sembrados (el precio del final incluido) llegaron todos.

**Ojo al tocarlo:**
- `sanearDocumentos` es una LISTA BLANCA: sin `lectura` y `partes` ahí, la próxima escritura de la conversación las
  borraba sin un error (la misma trampa que `sanearMensajes`).
- La lectura de un audio se hace ANTES del CAS del turno: el callback no puede esperar a la IA y puede correr varias
  veces.
- La fila crece (hasta megas con varios documentos largos) y `actualizarSesion` la relee entera en cada escritura.
  Si se nota lento, la salida es no traer `documentos` en las lecturas que no arman prompt.

**Vive en:** `lib/offer-reglas.ts` (`partirEnPartes`, `lecturaPorPartes`, `cuerpoDelDoc`, `documentosParaPrompt`) ·
`lib/offer-ia.ts` (`lecturaDeParte`) · `app/api/offer/route.ts` (`leerPorPartes`) · `lib/prompt-registry.ts` ·
`tests/offer-documento-entero.test.ts` (9 roturas)

## Al terminar, lo primero que se ve es el PDF (17/10/2026, #887)

**El pedido** (Martín en la misma revisión, 01:49:37): «lo que le recomiendo siempre… es que te muestre la vista de PDF,
mejor antes que eso» (la oferta nueva en pantalla).

**La recomendación obvia era la equivocada:** un `<iframe>` con el PDF. En Android no se ve (Chrome no tiene visor
dentro de una página) y en un iPhone se ve la primera página. Un visor de PDF en el navegador (pdf.js, el de `unpdf`)
pesa más de un mega y su build para navegador trae un `import.meta.resolve` que no se sabe cómo lo toma el build de
Vercel. Lo que sí: el escritor de PDF es nuestro y usa tres primitivas (texto, rectángulo, línea), así que anota cada
una también como dibujo y `paginasSvg` arma las MISMAS páginas en SVG, con el ancho de cada texto forzado
(`textLength`, medido con las métricas de Helvetica). La pantalla las muestra como `<img>` (un SVG como imagen no corre
nada). El test compara palabra por palabra el texto de cada página del PDF (leído con unpdf) con el de su SVG.

**Ahora:** la ventana de la oferta abre en la pestaña «PDF» (la primera) y se abre SOLA cuando el armado termina con la
pantalla abierta (no con un error, no en otra conversación, no en el onboarding). El héroe con la frase de la oferta
nueva pasó adentro de las otras dos pestañas: arriba de las pestañas, la oferta nueva se veía antes que el PDF.

**Ojo:** en el teléfono la hoja A4 se ve chica (es un PDF); para leer, «Descargar PDF» o el zoom del navegador.

**Vive en:** `lib/pdf-escritor.ts` (`Dibujo`, `paginasSvg`) · `lib/offer-pdf.ts` (`paginasDeOferta`) ·
`app/api/offer/pdf/route.ts` (`vista=paginas`) · `app/offer/VistaPdf.tsx` · `app/offer/Conclusion.tsx` (`PESTANAS`) ·
`app/offer/OfferApp.tsx` (`armandoEn`) · `tests/offer-vista-pdf.test.ts` (8 roturas)

## Una oferta se guarda en uno o varios funnels (17/10/2026, #895)

**El pedido.** «Guardar en este funnel» ligaba la oferta sólo al funnel de la conversación, y el modelo ya permitía
varios (`funnel_ofertas`, mig 0171). Ahora se elige con el selector de la casa (`ElegirFunnels`, el de los OKR de
/general): el de la conversación marcado de entrada, uno o varios, o «Todos los funnels». Con un solo funnel en el
negocio no aparece: se guarda como antes. Ya guardada, dice dónde («Guardada en VSL y Renovación»).

**Lo que cambió por debajo y conviene saber:**
- `guardarComoOferta(id, elegidos)`: sin `elegidos` (MaKo Mobile, el onboarding, una pestaña vieja) liga al funnel de la
  conversación, como siempre; `[]` es «todos» (la convención de `ElegirFunnels`: vacío = todos), resuelto con los
  ACTIVOS en el momento de guardar (`destinoDeLaOferta`).
- `ligada` de la vista mira la liga a CUALQUIER funnel: con la del funnel de la conversación sola, una oferta guardada
  sólo en «Renovación» seguía ofreciendo «Guardar» para siempre.
- Varios funnels, varios avisos: se juntan en uno y manda el que se arregla reintentando (`juntarLigas`).
- La API de MaKo: `guardar_oferta_analisis` (por chat, con su «sí») y `ver_analisis_oferta` con `guardada_en` y
  `funnels_del_negocio`.

**Lo que quedó SIN hacer:** sacar una oferta de un funnel desde acá (se hace en el editor de ofertas del CRM); MaKo Mobile
guarda siempre en el funnel de la conversación (`app/m/offer/OfferM.tsx`, no manda `funnelIds`).

**Vive en:** `app/offer/Conclusion.tsx` (`BarraAcciones`) · `lib/offer-sesiones.ts` (`guardarComoOferta`, `destinoAhora`,
`ligarAFunnels`, `nombresDeSesion`) · `lib/offer-reglas.ts` (`destinoDeLaOferta`, `juntarLigas`) · `app/offer/ayudas.ts`
(`textoGuardada`) · `lib/api-mako/areas/negocio.*.ts` · `tests/offer-guardar-funnels.test.ts` (9 roturas)

*17/10/2026, cuenta claude4.*

## «Los números» de la propuesta: lo que estimó MaKo sale marcado (17/10/2026, la mitad que quedó del #888)

- **Síntoma.** En la Parte 2 del PDF de Código Inmobiliario: márgenes y un «LTV:CAC estimado superior a 5 a 1» que
  nadie dio. El prompt se los PIDE («margen bruto, ventas y llamadas necesarias, % cobrado al firmar y LTV:CAC, con la
  cuenta a la vista»: lib/offer-ia.ts, punto 11) y `aplicarReglasPropuesta` no los revisaba.
- **Decisión con criterio.** El código no los puede CALCULAR (no tiene el costo de adquisición, la recompra ni la
  retención), así que los MARCA, como pide la decisión 10 de Martín (lo que propuso MaKo, separado de lo que dijo el
  negocio): una línea con una cifra que el negocio no dio termina en «(estimado por MaKo)» y va a «Lo que propuso
  MaKo». Quedan sin marca lo del negocio, el precio propuesto, el margen que calcula el código con su precio y su costo
  (`margenDe`), una CUENTA a la vista hecha sólo con cifras del negocio y una línea con «[completar]».
- **Lo guardado** se lee marcado (`conclusionVisible`: la pantalla, MaKo Mobile por la vista y el PDF), sin reescribir
  la fila. Ahí no está el contexto cargado (el CRM): una cifra que salió de ahí se lee «estimada», el lado seguro.
- **Vive en:** `lib/offer-reglas.ts` (`MARCA_ESTIMADO`, `numeroDeLaPropuesta`, `aplicarReglasPropuesta`,
  `propuestoPorMako`, `conclusionVisible`) · `tests/offer-numeros-estimados.test.ts` (O1-O7).

*17/10/2026, «Pendientes B3» (`claude4`).*

## El onboarding lo termina el código, y ChatOffer no puede importar nada con .css (20/10/2026)

- **En el modo arranque, el turno que cierra lo escribe el código** (app/api/offer/route.ts → `responder`): con las piezas
  del arranque, «¡Gracias!» aunque el modelo traiga otra pregunta; y una pieza no se pregunta más de dos veces. El
  «listo» del modelo se parseaba y nadie lo leía (Florencia: 6 preguntas de más). Detalle en hallazgos-onboarding.md,
  «Florencia (ws21, 18/10)».
- **Un texto escrito más largo que el chat ya no rebota:** va a documento («Tu mensaje largo») por el camino del audio, y
  la pantalla (OfferApp y OfferM) dejó de cortarlo antes de mandarlo. Ojo: el corte estaba en los DOS lados; arreglar sólo
  la ruta no alcanzaba.
- **ChatOffer no puede importar nada con .css.** tests/offer-pulir-pdf.test.ts importa `DocumentoPdf` de
  app/offer/ChatOffer.tsx en node, que no lee `.css`: la caja del Ops Center (app/offer/CajaDelCentro.tsx, que trae
  chat.css y centro.css) la arma OfferApp y entra por la prop `caja`. Lo fija tests/onboarding-caja-centro.test.ts.

*20/10/2026, chat «Onboarding» (claude4).*

## El Sprint de Mauricio: cada número es de SU funnel, lo que vende se nombra, y lo que MaKo sugirió no es un hecho (22/10/2026)

Llamada Mau <> Martín del 22/10 (Fathom 195129619, 01:42:50-01:46:05). Mauricio armó en Offer su oferta nueva, el Sprint
(USD 270, taller en vivo de 3 días), y el diagnóstico afirmó cuatro cosas falsas. Todo medido en su conversación (ws1,
`offer_sesiones` id 18, sólo lectura).

- **«Solo 2 ventas de 24 asistentes», «cuello de botella en la conversión de llamadas».** Mauricio lo adivinó en la
  llamada («tal vez lo habrá tomado de otro funnel»). Era el CRM ENTERO: `analisisNegocio` no conoce funnels, y Offer le
  pedía los últimos 90 días del negocio. Lo que lo hace engañoso: en el ws1 los **1.169 leads tienen `funnel_id` NULL**,
  que es como se guarda el funnel DEFAULT (lib/campana-funnel.ts, regla 2), así que «el negocio» era el embudo de
  «Negocio que ESCALA», y el Sprint (funnel 44, nacido ese día) no tenía un lead. **Ahora** el embudo de una conversación
  con funnel sale de `embudoDeFunnel` (lib/analisis-negocio.ts: sus leads; el default son los NULL más los que traen su
  id), cada número dice de qué funnel es («tu CRM, funnel «Sprint 3 días», del 25/07 al 22/10»), y un funnel sin agendas,
  llamadas ni ventas da el aviso «… es una oferta sin datos de venta. Este diagnóstico mira la oferta, no sus
  resultados» (`alertaSinDatos`, también si el dueño dijo «0» en la pieza `ventas`). Un funnel que ya no está no tiene
  embudo: **nunca** cae al del negocio. Sin funnel (las conversaciones v1) sigue el negocio entero.
- **«Tienes 6 ofertas activas en MaKo».** Contaba `ofertas.activa`: 3 eran de prueba (dos con su funnel archivado, una
  sin funnel). Y había una trampa más: «Guardar» suma cada VERSIÓN de una oferta a su funnel (el Sprint y «Sprint de
  Diseño…» son dos filas de lo mismo), así que contar ofertas ligadas tampoco alcanza. **Ahora** se cuentan los funnels
  ACTIVOS con una oferta activa, y se NOMBRAN por su oferta principal («Tienes 3 ofertas activas en tus funnels de MaKo
  («Negocio que Escala», «Renovación» y «Sprint 3 días»)»): un conteo que el dueño no puede contrastar no le sirve
  (`loQueVendeEnMako`). Con una lectura fallida no se cuenta nada. El de «lo que me dijiste» ya no agrega «que no están
  cargadas en MaKo», que también era falso. ⚠️ Los productos casi nunca están ligados a una oferta (ws13: 3 activos, 0
  ligados): el foco cuenta sólo los ligados, y en esos negocios el que manda es el conteo de ofertas.
- **«Tres sesiones en vivo por Zoom».** El diagnóstico obvio («la IA inventó Zoom») estaba corto. La cadena: MaKo
  PREGUNTÓ «¿es 100% en vivo por Zoom…?» con la opción «Tres sesiones 100% en vivo por Zoom»; Mauricio eligió otra, y el
  turno igual anotó la pieza `formato` con «por Zoom». De ahí pasó al diagnóstico y a la propuesta. **La IA confunde lo
  que ella sugirió con lo que dijo el dueño.** La regla del prompt va (turno, diagnóstico y propuesta) y no alcanza (se
  editan en /configuraciones); lo determinista es `lib/offer-hechos.ts`: un catálogo de HERRAMIENTAS (videollamada,
  mensajería, cursos, cobro, agenda) que se sacan de lo que escribió la IA si el negocio no las nombró en sus mensajes
  (las opciones que tocó viajan como su mensaje), sus documentos o las piezas que vienen de lo cargado. Corre en `aFila`
  (lib/offer-sesiones.ts), la única entrada de la fila: la pantalla, el PDF, los prompts, la API y «Guardar» la leen
  limpia, y lo ya guardado se arregla sin reescribir nada. Los mensajes de MaKo no se tocan: son lo que preguntó.
  Las redes sociales quedaron afuera del catálogo a propósito (el copy las nombra: «tu bio de Instagram»).
- **«El margen bruto queda en 0%».** Mauricio dijo «tenemos pensado invertir $3,000 usd en publicidad en Meta» y
  `costoDe` lo leyó como el costo de atender a UN participante. Un presupuesto de anuncios sin un «por cliente» explícito
  ya no es un costo para el margen.

**Lo que quedó SIN hacer:**
- **La versión 1 de Mauricio sigue diciendo «2 ventas de 24 asistentes»** al leerla: se guardó con `cifrasConFuente`
  (las cifras tenían fuente, la del negocio entero) y lo guardado no se recalcula. «Zoom» sí sale al leer. Para verla
  bien hay que armar la versión 2 («Pulir la oferta» → «Armar mi oferta»). ⚠️ Desde OF1 (más abajo) se marca al leer:
  la pantalla avisa con «Rehacer el diagnóstico» y la API de MaKo ya no lo entrega.
- El aviso «Te pagan el 100% al firmar… súbelo entre 250 y 1.000 USD» no tiene sentido en una entrada de pago único de
  270 USD (O4, en la tanda P1).
- El catálogo de herramientas es una lista: una plataforma que no está ahí (o una fecha, un lugar) pasa si la IA la
  inventa; para esos sólo está la regla del prompt.

**Vive en:** `lib/analisis-negocio.ts` (`embudoDeFunnel`) · `lib/offer-contexto.ts` · `lib/offer-reglas.ts`
(`embudoSinDatos`, `alertaSinDatos`, `loQueVendeEnMako`, `alertaFoco`, `costoDe`) · `lib/offer-hechos.ts` ·
`lib/offer-sesiones.ts` (`aFila`) · `lib/offer-ia.ts` · `tests/offer-sprint-mauricio.test.ts` (25 roturas, las 25 cazadas)

*22/10/2026, chat «Offer» (claude3).*

## Lo demás de la llamada con Mauricio: el saludo, la demora, la landing que no se dejaba leer, el .zip (22/10/2026, P1)

Misma llamada (Fathom 195129619) y misma conversación medida (ws1, id 18), más el Saldo de IA de esa hora.

- **La demora (O6) no era «la IA es lenta».** Mediana de 6 s; 6 de 25 respuestas tardaron 66 a 124 s, por dos causas
  medidas en `anthropic_usage`: (1) en la red de plataforma, `gemini-flash-latest` salió **4 de 4 veces con 1.996
  tokens**, el tope del turno: la red no le pasa el nivel de razonamiento (`chatCheapTools`), razonar se come la
  respuesta, el JSON llega cortado, se descarta y el bucle prueba **el mismo modelo** con la key siguiente (20 a 60 s
  cada vuelta). Todos sus turnos los terminó contestando flash-lite. (2) Las de 66 s no dejan ninguna fila entre el
  mensaje y la respuesta: un intento con las keys del ws1 (tiene OpenRouter, con un modelo gratis) esperó sus 60 s
  enteros. **Ahora** el turno va a flash-lite en la red (`Pedido.modelosRed`) y corta cada intento a los 30 s.
  Trampa: un intento que muere por timeout no deja rastro en el Saldo de IA; se ve como un HUECO entre filas.
- **El saludo en cada mensaje (O5)** era la voz del negocio («Hola estimado… espero que estés muy bien… Bendiciones»)
  aplicada a la charla con el DUEÑO. El primer mensaje lo escribe el código, así que ningún turno de la IA saluda:
  `sinSaludo` en `parseTurno` (la única entrada del turno), más la regla en los prompts.
- **«¿Es pago único?» dos veces (O4):** la guía pregunta el precio y después el % al firmar. Con «pago único» en el
  precio, el cobro se anota solo (`conCobroDelPrecio`). Y el aviso «te pagan el 100% al firmar: súbelo» ya no sale con
  un pago único: la señal del §6.2 es que el cliente PODÍA pagar en cuotas y no quiso.
- **La landing «bloqueada» (O7):** desde acá abre con 200; el hosting (cabeceras de SiteGround) frena a los servidores y
  nuestro User-Agent se declara bot. No se tocó lib/landing-fetch.ts (es de Landing): la ruta de Offer, si la descarga
  SSRF-segura bloquea (401/403/429) o trae casi nada de texto, pide la página a r.jina.ai (`lib/offer-lector-externo.ts`),
  que la abre con un navegador desde su red. Medido: trae la landing del Sprint entera (precio, fechas, testimonios).
  Viaja sólo la URL pública. La baranda «ningún fetch en la ruta» (tests/offer-ia-cableado.test.ts) se respetó.
- **El .zip (O8):** el navegador no deja elegir una carpeta; un .zip sí. `lib/offer-zip.ts` lo abre con el jszip que
  ya estaba, lee las páginas con el MISMO extractor de copy de Landing (`copyDeHtml`) y los textos, saltea el resto, y el
  aviso del documento dice qué leyó. `archivoATexto` no se tocó: es compartido (Archivero, Plan, WhatsApp). La pantalla
  valida por extensión: importar `esZip` de lib/offer-reglas.ts habría metido 3.000 líneas en el navegador.
- **El PDF «muy raro» (O11), lo que se pudo ver:** se armaron sus 6 páginas con su conclusión real. El aviso «la garantía
  que escribió la IA era incondicional: en high ticket…» salía en una entrada SIN garantía porque la regex leyó «no se
  contempla reembolso **ni** garantía incondicional» como que la tenía; ahora mira la negación y sólo en alto ticket. Y
  «Lo que me gustó» repetía, en la misma página, las notas de 7 o más con su porqué: ahora son las fortalezas y el
  control final. También salían «Sistema DOS» (una oferta de prueba del contexto, P0) y Zoom (P0).
- **El selector (O12)** abría «parado en lo elegido» (decisión CRON 4 del Dropdown de la casa): adentro del funnel de la
  conversación abierta. Ahora Offer lo abre en la raíz (`abrirEnLaRaiz`, prop nueva; el resto de la app, igual).
- **«¿Cuál es el propósito?» (O13):** el mensaje del PDF y el de «Así está bien» lo dicen (`PARA_QUE_SIRVE`).
- **«Los analizo y te aviso» (O9):** con 3 o más archivos sin leer, la pantalla los sube y manda `leer-lote`; el servidor
  anota «Estoy leyendo tus N documentos… te aviso cuando termine» (`mensajeLeyendo`, un campo `leyendo` en el mensaje:
  sin migración), contesta al toque y en un `after()` lee cada uno con la MISMA `leer` de uno por uno (el .zip, las
  partes, El Archivero), manda el turno con lo que escribió el dueño y recién DESPUÉS saca el «estoy leyendo»: así la
  pantalla, que relee mientras lo ve, sigue hasta que llega la respuesta. Lo que no se pudo leer queda dicho en su
  lugar (`resumenDelLote`). Mientras, en esa conversación no entra otro turno (409, salvo el del lote: `delLote`), y el
  «estoy leyendo» no viaja al modelo. Al terminar, la campanita de escritorio (`crearNotificacion`, link a
  `/offer?sesion=`). Uno que pasó 15 min se da por cortado («Vuelve a mandarlos»).
  Dos trampas: `sanearMensajes` es una LISTA BLANCA (sin `leyendo` ahí, la primera escritura lo borraba y la pantalla
  dejaba de esperar), y un mensaje del dueño sin texto ni adjuntos se descarta: por eso el texto del dueño viaja ADENTRO
  del «estoy leyendo» y su mensaje lo pega `turno` al final. Y `subir-url` rechazaba el .zip con 415 antes de subirlo
  (el O8 sin esto no andaba).

**Lo que quedó SIN hacer:**
- ~~**El lector de afuera recibe la URL entera.**~~ Cerrado el 22/10 (OF2): un link con algo que parece un acceso no sale a
  r.jina.ai y se le dice al dueño «Esa página pide acceso: súbela en .zip o copia su texto y pégalo aquí.»
  (`credencialEnLaUrl` en lib/offer-reglas.ts; la ruta frena antes y `leerConLectorExterno` es la última puerta). Mira el
  nombre del parámetro (token, key, sig, auth, code, secret, session, las firmas de S3 y GCS), un valor que parece un código
  (24 o más caracteres con letras y números) y el usuario y clave del link. **La trampa: un Drive compartido NO lleva el
  token en un parámetro**, lo lleva en la RUTA (`/d/<id>`), y una regla de parámetros lo dejaba salir. Mirar la ruta de
  cualquier página tampoco sirve (`/webinar-gratuito-octubre-2026-registro` es una landing), así que los links para
  compartir archivos van por su host (Drive, Docs, Dropbox, OneDrive, SharePoint, Box, WeTransfer). Un Google Doc
  publicado, que antes se leía por el lector, ahora pide el texto o el archivo: es el precio de no mandar el acceso a un
  tercero. Lo prueba `tests/offer-lector-credenciales.test.ts` con el lector REAL y un fetch de mentira (8 roturas, las 8
  cazadas); la landing del Sprint, con su `fbclid`, se sigue leyendo.
- **El aviso de O9 por el WhatsApp del grupo:** no había camino. Pide un evento de la plataforma nuevo (como
  `oferta_lista`: el catálogo de avisos, lib/disparadores.ts, sus variables) y su fila en el ws 9 con la mudanza. Hoy
  avisa sólo la campanita.
- **O9 no se vio en el navegador** ni contra Storage de verdad: el test fija lo puro y el cableado.
- **O10, el micrófono que no muestra que graba**, vive en app/whatsapp/_shared/ComposerWhatsApp.tsx + VoiceRecorder.tsx
  (compartido con los chats de WhatsApp y el lienzo): no se tocó desde Offer.
- **No se vio en el navegador** el selector abierto en la raíz ni el chip del .zip; el lector de afuera se probó con curl.
- Que un fuerte del diagnóstico sea una OBJECIÓN («Ya probé otras capacitaciones y la gente vuelve a lo mismo» salió en
  «Lo que me gustó») depende del modelo: no hay regla que lo frene.

**Vive en:** `lib/offer-reglas.ts` (`sinSaludo`, `parseTurno`, `esPagoUnico`, `conCobroDelPrecio`, `textoDelLectorExterno`,
`esZip`, `PARA_QUE_SIRVE`, la garantía en `aplicarReglasPropuesta`) · `lib/offer-ia.ts` (`modelosRed`, el turno) ·
`lib/offer-lector-externo.ts` · `lib/offer-zip.ts` · `lib/offer-marco.ts` (`loQueMeGusto`) · `app/api/offer/route.ts`
(`leerLink`, `leer`, `responder`) · `app/components/Dropdown.tsx` (`abrirEnLaRaiz`) · `app/offer/SelectorFunnel.tsx` ·
`app/offer/OfferApp.tsx`, `ChatOffer.tsx` (el .zip, `enviarLote`) · `app/api/offer/route.ts` (`leerLote`,
`leerLotePorDetras`, el freno en `turno`) · `tests/offer-mauricio-p1.test.ts` (24 roturas, las 24 cazadas) ·
`tests/offer-lote-documentos.test.ts` (13 roturas, las 13 cazadas)

*22/10/2026, chat «Offer» (claude3).*

## La prueba de los chats (22/10/2026): el perfil pisado, de dónde sale cada pieza, lo que el turno no sabía

El Cerebro corrió un arnés contra el POST real de /api/offer (ws3, 3 corridas, rama `probar-chats-offer`, worktree
`C:/dev/wt-probar-offer`, `scripts/probar-chats/offer.mts`) y confirmó 8 fallas, más una para Mauricio.

- **Un archivo subido en Offer pisaba el perfil del negocio, y ya le pasó a Mauricio:** salió aparte, como P0, con la
  restauración del ws1. Ver «Un archivo subido en Offer pisaba el perfil del negocio», abajo.
- **De dónde sale cada pieza.** La ruta ponía la fuente del TURNO entero (`'doc'` si traía documentos, si no `'chat'`):
  lo que el modelo sacaba de lo cargado en MaKo quedaba como dicho por el dueño. Ahora el modelo dice el origen por
  pieza (`{"valor": …, "de": "contexto" | "documento"}`) y `fundirPiezasDelTurno` las guarda con su fuente. ⚠️ El origen
  lo declara el modelo: una pieza inventada y marcada «contexto» cuenta como del negocio para `lib/offer-hechos.ts`.
- **«otras» se anotaba sin que el dueño la contestara** («0» leído de «no vendí ninguno», que es la pregunta de las
  ventas). Ahora sólo con la respuesta a ESA pregunta (`preguntaPorOtrasOfertas` de la última de MaKo), y «1: sólo esta»
  no es otra oferta (`ofertasDeclaradas`).
- **El turno no sabía el estado de la oferta**: «¿ya quedó guardada?» se contestaba que sí. Va en su contexto
  (`estadoDeLaOferta`), y una regla le pide contestar primero lo que le preguntan.
- **«[de: chat]» guardado en las piezas:** es la marca que `piezasParaPrompt` pone al lado de cada pieza, copiada de
  vuelta. Se saca al entrar y al leer (`sinMarcaDeFuente`).
- **El PDF:** «Dónde cierras la venta» es ahora el canal del funnel de la oferta (`conCanalDeLaOferta`) y el guion del
  precio es «Cómo decirlo»; un resultado con un número en letras («tu primer cliente en 14 días») es medible; una fecha
  se mira ENTERA (la que dio el dueño queda, otra pasa entera a «[completar]»: antes «24/10» salía «[completar]/10»); la
  caja de completar no se queda con un resto; y los pasos ya numerados no salen «1. 1.» (`sinNumeroDelante`, también en
  la pantalla).

**Lo que quedó SIN hacer:**
- Las ~90 consultas a la base por turno: en docs/hallazgos-infra.md, no es de Offer.
- El arnés no se corrió contra esta rama (gasta la cuota diaria de Gemini de la plataforma): los tests fijan lo que decide el código.

**Vive en:** `lib/offer-reglas.ts` (`fundirPiezasDelTurno`, `limpiarPiezas`, `sinMarcaDeFuente`, `estadoDeLaOferta`,
`conCanalDeLaOferta`, `ofertasDeclaradas`, `resultadoMedible`, `filtrarCifras`, `entradaCompletar`) · `lib/offer-marco.ts`
(`sinNumeroDelante`) · `lib/offer-pdf.ts` · `lib/offer-ia.ts` (reglas 8, 14 y 20) · `app/api/offer/route.ts` (`responder`,
`generarSesion`) · `tests/offer-prueba-chats-2210.test.ts` y `tests/offer-archivero.test.ts` (18 roturas, las 18 cazadas)

## Un archivo subido en Offer pisaba el perfil del negocio (22/10/2026, P0, cliente roto)

- **Síntoma.** A Mauricio (ws1) su perfil del negocio le quedó con el Sprint: «Sprint de Diseño para la Ejecución
  Empresarial» como oferta principal, la promesa, lo que incluye y el avatar del Sprint, y otro «qué hace el negocio». Lo
  leen ~20 features (las automatizaciones, los mensajes de los envíos). Lo encontró la prueba de los chats del Cerebro en
  el ws3; medido en el ws1: `mako.onboarding.answers` se escribió a las 04:08:26 UTC, cuando subió en Offer el guion y
  la landing del Sprint (7 claves: `oferta_nombre`, `oferta_promesa`, `oferta_incluye`, `avatar_quien`, `avatar_dolor`,
  `avatar_deseo`, `negocio_que_hace`). La oferta principal es `desde_brief`, así que «Negocio que Escala» se leía con la
  promesa del Sprint.
- **Causa.** Cada archivo del chat de Offer pasa por El Archivero (`registrarDocumentoSinPisar`, decisión del 15/10), y
  `answersConDocumento` sumaba sus claves al perfil con «el más nuevo gana», como un recálculo del Archivero. El
  diagnóstico equivocado era de qué es un documento de Offer: describe la oferta que se ANALIZA, no el negocio. Y no
  alcanzaba con dejar de pisar el perfil: la fila del archivo guardaba todos sus `campos`, y el próximo recálculo del
  Archivero (`computeEffective`, el más nuevo gana) los volvía a imponer.
- **Ahora.** Un documento de Offer sólo LLENA lo que el perfil no tiene (ni a mano ni de otro documento), y su fila del
  Archivero guarda sólo lo que llenó. Lo fija `tests/offer-archivero.test.ts` (con el caso del Sprint).
- **La restauración del ws1 (autorizada por el Cerebro, 22/10 ~07:55 UTC).** No hay historial de `app_settings`. La fuente
  de cada clave fue el último valor antes de las 04:05: una edición del dueño a esas claves va a `mako.archivero.manual`
  («una puerta por campo», lib/api-mako/areas/negocio.helpers.ts), que no cambió desde el 29/07 ni tiene ninguna; el único
  archivo anterior es el del 29/07 («Avatar_Dolores_Oferta_DOS_v2 (2).pdf»), y la conversación de Offer del 18/10 nació
  con su promesa y lo que incluye. Se escribió en una transacción con compare-and-set sobre el valor exacto: las 7 claves
  del perfil y los `campos` de las 4 filas del Sprint sin esas claves. Releído: el resto del perfil igual, un recálculo
  del Archivero da lo mismo, «Negocio que Escala» se lee con su promesa y el Sprint (oferta 24, su propia fila: no es
  `desde_brief`) con la suya. Backup, script y foto del después: en las notas del Cerebro,
  `side-session-notes/local_428051c1-…/restauracion-ws1-2210/`.

**Regla (AGENTS.md):** un documento nuevo nunca pisa un dato que ya tenía el negocio.

**Lo que quedó SIN hacer:** las filas del Sprint conservan `oferta_ticket` (lo tapa el valor manual del dueño). Otros
negocios que hayan subido archivos en Offer desde el 15/10 pueden tener el perfil pisado igual: no se midió.

**Vive en:** `lib/archivero-registro.ts` (`answersConDocumento`) · `lib/archivero.ts` (`registrarDocumentoSinPisar`) ·
`tests/offer-archivero.test.ts`

*22/10/2026, chat «Offer» (claude3).*

## Lo guardado no se recalcula: el diagnóstico de la v1 del Sprint seguía en el contexto de MaKo (22/10/2026, OF1, P0)

Medido por el Cerebro a las 12:44 UTC, después del deploy de O1: la sesión 18 del ws1 (oferta 24 v1, funnel 44) seguía
guardando «solo 2 ventas de 24 asistentes» y «Tienes 6 ofertas activas en MaKo».

- **Dónde vivía.** En la conclusión guardada (`offer_sesiones.conclusiones`): la tesis y el porqué del primer cambio, y la
  alerta de foco del cálculo. No en los mensajes del chat ni en la oferta 24 (`ofertas`), que están limpios. La conclusión es
  un documento: `embudoDeFunnel` arregló lo que se arma DESPUÉS, y lo armado antes nadie lo vuelve a armar. Llegaba a los
  chats por `ver_analisis_oferta` (lib/api-mako/areas/negocio.run.ts), la lectura con la que MaKo toma la oferta como
  contexto para prospectar. Medido con `scripts/medir-diagnostico-viejo.mts`: con el código de 87365c830 las dos frases
  llegan al contexto del ws1; con el arreglo, ninguna.
- **El diagnóstico obvio («todo lo de antes del deploy está mal») era el equivocado.** Un corte por fecha solo marcaba
  también al ws13 (Código Inmobiliario, un cliente): tiene UN funnel con todos sus leads, así que su negocio entero ERA su
  funnel y el diagnóstico de antes dice lo mismo que diría hoy. Decirle «usó datos de otro funnel» habría sido falso. La
  marca necesita la base: `armadaConElEmbudoViejo` (pura: conversación con funnel y armada antes de las 07:33 UTC del 22/10,
  el aviso de Integración de que O1 estaba desplegado) y además `hayLeadsFueraDelFunnel` (lib/analisis-negocio.ts, el mismo
  criterio que `embudoDeFunnel`: el default son los NULL más los suyos). Medido en producción: marca ws1 #18 (todos sus
  leads son del default, el Sprint no tiene ninguno), ws11 #3 (18 leads de otros funnels) y tres pruebas del ws3; no marca
  al ws13 #8 ni al ws3 #49 (armada después).
- **No se escribe nada al leer.** La marca se calcula en `nombresDeSesion` y viaja en la vista (`diagnosticoViejo`), no en la
  fila: una marca en `conclusiones` se habría guardado sola con el próximo «Armar». Con la marca, la pantalla (computadora y
  teléfono) dice «Este diagnóstico usó datos de otro funnel.» arriba de la conclusión, con «Rehacer el diagnóstico» (arma
  una versión nueva, como «Armar mi oferta»), y la API entrega la oferta pero no el diagnóstico ni sus avisos. Si la lectura
  de los leads falla, no se marca: un aviso en falso le diría a un cliente que su diagnóstico está mal.

**Regla (AGENTS.md):** arreglar la regla que arma un documento guardado no arregla lo guardado; en el mismo cambio se decide
qué pasa con lo de antes, midiendo en la base cuáles están mal de verdad.

**Lo que quedó SIN hacer:**
- El PDF descargado de una versión marcada sigue diciendo lo que decía (la pantalla avisa arriba, el archivo no).
- La v1 de Mauricio sigue igual en la base hasta que alguien toque «Rehacer el diagnóstico». La v2 la arma él (o Martín).
- La alerta «Tienes N ofertas activas en MaKo» de antes del 22/10 no se marca sola: sólo viaja con un diagnóstico marcado.
  En producción, la única que la tiene es la sesión 18.

**Vive en:** `lib/offer-reglas.ts` (`armadaConElEmbudoViejo`, `EMBUDO_POR_FUNNEL_DESDE`) · `lib/analisis-negocio.ts`
(`hayLeadsFueraDelFunnel`) · `lib/offer-sesiones.ts` (`nombresDeSesion`, `vistaDe`) · `lib/api-mako/areas/negocio.run.ts` ·
`app/offer/Conclusion.tsx` · `app/m/offer/HojasOfferM.tsx` · `scripts/medir-diagnostico-viejo.mts` ·
`tests/offer-diagnostico-viejo.test.ts` (13 roturas, las 13 cazadas)

*22/10/2026, chat «Offer» (claude3).*
