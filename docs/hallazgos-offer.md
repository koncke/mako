# Hallazgos — Offer (la tab que une Offer Analyst y Offer Generator)

Lo que costó construir `/offer` el 11/10/2026 y no se deduce leyendo el código. El marco
de oferta en sí (las 13 piezas, la rúbrica de 9 dimensiones, la plantilla, qué dice cada
autor y dónde discrepan) vive en [offer-marco.md](offer-marco.md); el contrato en código,
en `lib/offer-marco.ts`.

**Vive en:** `app/offer/*`, `app/api/offer/route.ts`, `app/api/offer/pdf/route.ts`,
`lib/offer-marco.ts`, `lib/offer-reglas.ts`, `lib/offer-ia.ts`, `lib/offer-sesiones.ts`,
`lib/offer-contexto.ts`, `lib/offer-pdf.ts`, `lib/pdf-escritor.ts`, `lib/pdf-helvetica.ts`,
`supabase/migrations/0254_offer_sesiones.sql`.

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

## Lo que quedó SIN hacer

- **Leer una imagen, un PDF escaneado o un audio puede cobrar en la OpenAI del cliente**:
  `archivoATexto` usa las cascadas compartidas de visión y transcripción, que terminan en
  OpenAI (lo mismo que hoy le pasa al Archivero y al importador del Plan). La conversación, el
  diagnóstico y la oferta nunca pagan. Cerrarlo es un `sinPago` en `leerDocumentoIA` y
  `transcribirAudio` (`lib/ai-cheap.ts`), que es un archivo compartido.
- **Un binario puede quedar en Storage** si la persona cambia de conversación justo mientras un
  archivo se sube: 'leer' es lo único que lo borra y ya no se llama. Falta una acción
  'descartar-subida' con la misma validación de path.

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
