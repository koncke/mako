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

### El marco contra el código (cruce del 11/10/2026, contra HEAD)

Lo que el código de Offer todavía no aplica del marco escrito. En pantalla es una tarjeta de decisión por
tema en la pestaña «A definir» (`app/admin/offer-playbook/pendientes.ts`); acá, el dónde. Cuando se
arregle uno, se saca de los dos. ⚠️ Los archivo:línea son de HEAD ANTES de la v2: la v2 corrió
`lib/offer-reglas.ts` (por ejemplo, «lista para vender» quedó en las líneas 1081-1083).

1. **Cifras inventadas.** El filtro es todo o nada por pieza (`lib/offer-reglas.ts:565-577`): con
   cualquier dato en Prueba o Bonos, todas sus cifras pasan; Bonos se llena sola con los NOMBRES de los
   bonos cargados (`:267`, `:281`); el valor total, la frase, los escenarios y la ecuación no se revisan
   (`:546-550`). El PDF puede decir «27 clientes duplicaron sus ventas» sin que nadie lo dijera. Es lo
   que el marco más prohíbe (§5).
2. **Preguntas que faltan.** La guía tiene 13 de las 39 del §3 (`lib/offer-marco.ts:306-320`): no
   pregunta el valor anual del resultado (#32, la que destraba D7), costo y capacidad (#30, #23), la
   primera semana (#22) ni el % cobrado al firmar (#27). El campo `destraba` de cada dimensión no llega
   a la IA (`:74`, `:291`).
3. **Piezas mínimas.** El código pide 5 sin Prueba (`lib/offer-marco.ts:41-53`) y un «sin dato» cuenta
   (`:265-267`); el §3 marca como mínimas «cuántos pagaron» y «cuántos lograron el resultado». Decide
   Martín.
4. **Anclas sin números.** D1 (75+), D6 (márgenes) y D7 (valor 5-10×, 50-75% al firmar) llegan a la IA
   sin los números del §4, y sin las señales de alerta (`lib/offer-marco.ts:81`, `:104-111`). Con «la
   mayor parte al firmar», cobrar el 100% saca nota alta; para el marco es señal de precio barato.
5. **D1 o D2 en 3 o menos.** El marco rehace la oferta desde ahí; el código sólo avisa
   (`lib/offer-reglas.ts:488-491`) y la oferta sale completa. Decide Martín.
6. **«Lista para vender» sin el Check final** de Contreras (`lib/offer-reglas.ts:483-485`): puede decir
   «lista» con Precio y cobro en 5.
7. **Garantía.** El texto de la IA dice «sin casos» (`lib/offer-marco.ts:297`, `lib/offer-ia.ts:174`) y
   el marco dice «con menos de 10 a 15 casos» (§7.1).
8. **Alertas que faltan:** margen bajo 60%, dónde se corta el embudo y cuándo subir el precio. Sólo
   existen foco y D1/D2 bajos (`app/api/offer/route.ts:150`); el tipo anuncia una alerta del embudo que
   no existe (`lib/offer-marco.ts:187`).
9. **Alerta de foco:** sin la facturación salta recién con 6 (`lib/offer-reglas.ts:516`), no está
   medida contra negocios reales, y la IA que pone la nota de Foco no la ve (se calcula después).
10. **Supuestos:** la sección 20 sólo lista los «[completar]» (`lib/offer-reglas.ts:575`, `:590-626`);
    no separa lo que propuso MaKo de lo que dijo el dueño del negocio. Decide Martín.
11. **Reglas de cierre que no llegan al prompt** (cuotas con 50% inicial, valor de 4-5× el precio,
    bonos con su porqué, LTV:CAC): el texto del marco que lee la IA es un resumen (`lib/offer-marco.ts:269-303`).
12. **Reglas que sólo cumple el prompt** (duración 90-180 días, precio desde 1.000 USD, garantía nunca
    incondicional, nombres del método como propuesta): con la cascada gratis, un modelo chico puede
    saltarse alguna sin aviso.
13. **Topes flojos:** acepta 6 fases, ningún bono y ningún nombre del método (`lib/offer-reglas.ts:648`,
    `:654`, `:670`).

El 14º era del marco y ya se arregló: decía que el total es «el promedio» (0-10) y el código lo muestra
sobre 100 (promedio × 10).

## Lo que quedó SIN hacer

- **Offer v2:**
  - **El Archivero no se entera de lo que se sube en Offer**: no hay una función que registre un
    documento sin recalcular el estado entero (`buildEstado(true)`). Hace falta una
    `registrarDocumentoSinPisar` en `lib/archivero.ts`, con el molde de `borrarDocumentoArchivero`.
  - **El avatar que se arma en el chat no se guarda en Avatares**: `setAvatares` reemplaza la lista
    entera y escribir desde el chat sin que una persona confirme rompe «un canal propone, una persona
    confirma». Queda en la pieza `cliente`.
  - **La oferta guardada no se liga a los productos** (`oferta_productos`), sólo al funnel.
  - **Un audio que ninguna IA escuchó se vuelve a subir al reintentar**: el servidor deja el binario
    para reintentar con el mismo `path`, pero la pantalla lo vuelve a subir y el primero queda suelto
    en Storage.
  - **«Guardar si no hay» del diagnóstico de fase vive en la ruta** con la clave del setting copiada
    (un test exige que sea igual a la de `lib/fase-store.ts`): falta la función en el store.
  - **Un link con la página en el querystring** (`?page_id=…`) no se lee: pide pegar el texto hasta que
    `lib/landing-fetch.ts` tenga una variante que baje la URL tal cual.
  - **La transcripción de un audio se ve cortada a 140 caracteres** (lo hace `BurbujaHilo`, que es
    compartido).
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
