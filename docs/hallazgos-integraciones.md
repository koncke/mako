# Hallazgos — integraciones y credenciales

Lo que se aprendió tocando el catálogo de integraciones, la resolución de
credenciales y el reparto entre lo que paga la casa y lo que paga el cliente.

---

## La tarjeta de Apify le prometía al cliente el tope de OTRA lectura: 40 en vez de 150 (6/11/2026)

**Vive en:** `lib/metodo-catalogo.ts` (la nota de `APIFY_INSTAGRAM_TOKEN`) · `lib/instagram-perfil.ts`
(`TOPE_LECTURAS_SPY_POR_DIA`, `APIFY_TOPE_POR_DIA`). Lo fija `tests/spy-varias-claves.test.ts` (caso 14).

**Síntoma:** la nota de la tarjeta decía «un tope de 40 lecturas por día». El tope real de lo que esa clave hace en Spy es
**150**. El cliente creía que podía casi cuatro veces menos de lo que podía y no usaba Spy todo lo que podría.

**La causa:** el 40 es `APIFY_TOPE_POR_DIA`, el tope de **la otra** lectura de Instagram (la del buscador del alta del CRM).
El de Spy es `TOPE_LECTURAS_SPY_POR_DIA`, que **subió de 40 a 150 el 4/11/2026**: el día en que los dos números coincidían
fue el último en que la nota estuvo bien. Dos topes con nombres parecidos, y la nota con el número copiado a mano.

⚠️ **La regla que queda: un número que la pantalla le promete al cliente se INTERPOLA de la constante que lo hace cumplir,
nunca se escribe a mano.** Escrito a mano, el día que el tope cambia no falla nada: sólo empieza a mentir, y nadie se entera.

⚠️ **Y se le sacó el «sólo para Competitors Spy», que ya era falso:** desde el 2/11/2026 el buscador de @ del alta del CRM lee
UN perfil por @ exacto con esta misma clave. Su tope es otro y **no** se puso en la nota: dos números en una nota de una línea
no se entienden. Tampoco va el tope de búsquedas (`TOPE_BUSQUEDAS_SPY_POR_DIA` cuenta **corridas**, y una búsqueda por nombre
gasta dos, así que «60 búsquedas» sería otro número mal).

⚠️ **Lo que costó dos rojos, y es lo más reutilizable de acá:**

1. **Un COMENTARIO también es texto que un guard lee.** La primera versión explicaba el error nombrando
   `APIFY_TOKEN` —la clave del Leads Scraper retirado— y `tests/leads-scraper-retirado.test.ts` barre ese nombre por todo
   `app`, `lib`, `tests` y `scripts`. Rojo, con razón. Para afirmar en un test que ese nombre no aparece hay que escribirlo
   partido, o el test se acusa a sí mismo.
2. **Dos ítems en una sola punta se contagian el rojo.** Esta punta se commiteó encima de la de al lado sin volver a
   `origin/main`, así que arrastraba su diff y fallaba por el guard del OTRO cambio. Una punta se abre SIEMPRE desde
   `origin/main`; si no, el veredicto deja de ser sobre lo tuyo.
## «Sin conectar» con la integración andando: `integracionConectada` sólo mira los campos REQUERIDOS (6/11/2026)

**Vive en:** `lib/credenciales.ts` (`integracionConectada`) · `lib/metodo-catalogo.ts` (los campos de `apify-instagram`) ·
`lib/instagram-perfil.ts` (`CLAVES_APIFY_DE_SPY`) · lo fija `tests/cuentas-pago.test.ts` (caso 17b del hijo).

**Síntoma:** el cliente que borró su primera clave de Apify y dejó la segunda veía la tarjeta en **«Sin conectar»** con
Competitors Spy leyendo perfecto. Volvía a configurar al vicio.

**La causa, y es una trampa del diseño del catálogo, no de Apify:** `integracionConectada` arma su respuesta con
`s.campos.filter((c) => !c.opcional)` — **sólo los campos requeridos**. Cuando una integración acepta varias claves, la 1 es la
requerida y las `_2`…`_5` nacen `opcional: true` (así tiene que ser: pedirlas rompería el alta). Resultado: la función mide la
clave 1 y nada más, mientras el que de verdad lee (`clavesApifyDeSpy`, y el salto por crédito de `lib/spy-claves.ts`) anda con
cualquiera de las cinco.

⚠️ **La regla que queda: en cuanto una integración acepta VARIAS claves o cuentas, «conectada» deja de ser una pregunta sobre
sus campos requeridos y pasa a ser «¿hay al menos una con la que se pueda trabajar?».** Eso ahora lo dice el **catálogo**
(`conUnaAlcanza` en `ServicioMetodo`), no una lista de nombres dentro de `integracionConectada`: ese archivo no tiene que
saber de qué servicio se trata ni cómo se llaman sus claves, y la próxima integración de varias claves se arregla con un
`true`.

⚠️ **Y esa forma salió de un rojo, no de la primera idea.** La primera versión importaba `CLAVES_APIFY_DE_SPY` dentro de
`lib/credenciales.ts`, y eso puso **rojo a `tests/leads-scraper-retirado.test.ts`**: ese test tiene una **lista blanca de
archivos** que pueden nombrar las claves de Apify, para que nadie, tocando Apify, reabra el Leads Scraper retirado. La guarda
tenía razón: un archivo central como `credenciales.ts` no tiene por qué nombrar las claves de un servicio. **La regla:
cuando una guarda de «esto no vuelve» salta por un cambio legítimo, casi siempre está señalando que el cambio está en el
archivo equivocado** — se mueve la decisión, no se amplía la lista.

**Y el precedente estaba al lado, sin usarse:** las pasarelas con cuenta con sufijo (`__C2`, la principal desconectada) ya
tenían exactamente este caso resuelto diez líneas más abajo, desde el 22/10/2026, con el mismo síntoma («se reportaba
DESCONECTADA aunque estuviera cobrando»). Apify llegó después con varias claves (5/11/2026) y nadie miró la función.
**Cuando se agrega la clave N a una integración, se busca quién responde «¿está conectada?».**

⚠️ **Lo que NO cuenta como conexión:** el campo con el NOMBRE de la clave (`<ENV>_ACCOUNT`), que es opcional y no secreto. Un
nombre guardado sin su token no sirve para leer nada. Está fijado con un test.

## Un 404 de simple-icons se leyó como «esta marca no tiene logo» (1/11/2026)

**Vive en:** `app/_components/ServicioVisual.tsx` (el mapa `ICON`, `SvcIcon`, `BrandDefs`) ·
`public/logos/` · guards: `tests/zernio-todas-las-redes.test.ts` («cada logo servido como archivo
existe en public/logos»), `tests/integracion-tres-registros.test.ts`.

**El síntoma.** Martín: «muchos logos, como por ejemplo el de Appify, no son los logos reales de
esas empresas. Fíjate en integraciones tienen que ser todos los logos reales». Eran **trece de
cuarenta y cinco**.

**El diagnóstico obvio era el equivocado.** El archivo ya tenía la regla correcta escrita arriba
—«acá solo van logos OFICIALES; si no conseguimos el vector, va un letter-mark»— y la regla se
estaba cumpliendo al pie de la letra. El problema no era la regla: era **dónde se buscaba**. Seis
logos estaban dibujados a ojo (Apify, Groq, Gemini, ElevenLabs, YouTube y la «G» de Google) y siete
iban con inicial «porque no hay vector» (Creem, tl;dv, Fireflies, Otter, Read AI, bunny.net y Google
Business). Los trece tenían su logo publicado. Lo que había pasado es que **un 404 de simple-icons
se leyó como «no existe»**, cuando simple-icons es un atajo, no la fuente — y además retira marcas:
Google Business estaba en la 11 y no está en la 13.

**El orden de búsqueda que sí funciona** (quedó escrito arriba del mapa, que es donde lo lee el que
agrega un servicio):

1. el `<link rel="icon">` de la **propia página** de la empresa — ahí estaban Apify (`/icon0.svg`,
   tres formas planas) y Groq (`/favicon.svg`, que es un RAYO, no una «G»);
2. su **carpeta de marca** — ahí estaba Creem, en `/new-branding/Logo/SVG/`, después de que el
   31/10 se diera por perdida porque creem.io no tiene `theme-color` ni manifest;
3. el **CDN del dueño de la marca** — `fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg` para
   la «G», `gstatic.com/images/branding/product/` para Google Business;
4. el **wordmark del sitio**, recortado al glifo con `viewBox` — Fireflies, bunny.net, Read AI;
5. recién acá simple-icons;
6. y sólo después, el letter-mark.

**La regla que queda: un logo que no se puede pegar como trazo entra como ARCHIVO, no como dibujo.**
`IconDef` ganó dos campos. `img` apunta a un archivo oficial de `public/logos/`, para lo que no se
puede copiar a mano sin reescribirlo: degradés con sus `<defs>` (Fireflies son 8 trazos y 8
`<linearGradient>`; bunny.net, 9), un wordmark que ES la marca (tl;dv) y lo que la empresa sólo
publica en PNG (Otter, Google Business). `lleno` dice que el archivo trae su propio fondo y sus
esquinas —un ícono de app— y entonces OCUPA el tile en vez de ir centrado adentro; se decide mirando
si las esquinas del PNG son transparentes: Otter es un cuadrado azul lleno, Google Business es un
toldo sobre transparente y va en tile blanco con borde.

**La trampa del guard.** El test de las redes afirmaba `sym: '…'` o `letter: '…'` por tarjeta. Con
`img` había que ampliarlo, y ahí se le agregó lo que de verdad protege: **que el archivo EXISTA**.
Una ruta mal escrita no falla en ningún lado — deja la tarjeta con una imagen rota, que se lee como
que la integración está mal, no como que falta un archivo. Probado rompiéndolo: con
`public/logos/bunny.svg` renombrado, el test cae y dice `falta public/logos/bunny.svg`.

**Lo que queda sin hacer:** `LogoMeet` (`ServicioVisual.tsx`) sigue siendo un dibujo propio — su
propio comentario lo dice, «Dibujo propio y simple». Es la cámara de Meet al lado del texto «Asignar
evento», no un tile de /integraciones, así que no entró en esta pasada; el mark oficial ya está
pegado como `ic-googlemeet` y de ahí se puede sacar.

---

## La clave de API no es la suscripción, y Gemini no se saca de la vista (27/10/2026)

**Vive en:** `app/integraciones/TusCuentasIA.tsx` (`ClavesDeApi`, `estadoDeClave`, `CLAVES_RETIRADAS`) ·
`app/integraciones/CuentasYDispositivos.tsx` (`BloqueCuenta`, el chip «Suscripción») · `app/integraciones/tus-cuentas-ia.css`.
Guard: `tests/clave-y-suscripcion-27-10.test.ts`.

- **El síntoma (Leila, en la llamada con Martín):** «Anthropic API · Conectada» arriba y «Cuenta 1 · Max» abajo se leían como
  lo mismo, sin saber con cuál contestaba MaKo. La causa no era sólo la palabra: la FILA de la clave abría «¿Cómo la conectas?»
  (computadora o clave), así que en los hechos era la puerta de Claude entero, y su estado sólo hablaba de la clave. Regla: una
  fila de «Claves de API» es SÓLO la clave («Clave cargada» / «Sin clave», abre el modal de SU clave); la elección con la
  computadora vive en «Nueva cuenta», y cada cuenta de la computadora dice «Suscripción Max».
- **⚠️ El obvio («Gemini ya no se ofrece → sacar su fila») era el equivocado.** Su clave está cargada en 11 negocios (medido el
  27/10: qué negocio tiene qué clave, sin leer ningún valor) y MaKo la sigue usando (escuchar audios, la cascada barata:
  `lib/ai-cheap.ts`). Sacarla de la vista deja una clave EN USO sin dónde cambiarla ni quitarla. Regla: una IA retirada se ve
  SÓLO si está cargada, sin el verde de «lista», y dice «ya no se ofrece» (`CLAVES_RETIRADAS`).
- **Trampa de CSS:** `.tci-ayuda` es absoluta (la de las opciones grandes) y está DESPUÉS en el archivo; un modificador de una
  sola clase pierde y el «?» se va a la esquina de la página. Con dos clases (`.tci-ayuda.tci-ayuda--titulo`) gana.
- **Trampa del test de voseo** (`tests/ia-pc-ola2.test.ts`, «de tú, no de vos»): `\b(abrí|…)\b` sin la bandera `u` toma la `í`
  como no-letra, así que «abrían» en un COMENTARIO da positivo. Si salta sin un voseo a la vista, buscar una palabra que
  EMPIECE con una de la lista.
- **SIN HACER:** los errores de la IA que todavía dicen «conecta tu Claude, tu GPT o tu Gemini» (`lib/ai-cheap.ts`, `lib/persona.ts`)
  y la descripción de Groq en `lib/integraciones-catalogo.ts` (son de otras áreas); y la fila no se relee si se QUITA la clave en
  su modal (`onConectado` sólo avisa al conectar).

## La política de privacidad lee el MISMO interruptor que el login (26/10/2026)

**Vive en:** `app/privacidad/page.tsx` (`loginPideAgenda`) · `lib/google-login-agenda.ts` · `app/api/auth/google/route.ts` y su
callback. Guard: `tests/privacidad-agenda-login.test.ts`.

- **Google aprobó la app** (Martín, 26/10). Prender la agenda al entrar es poner `GOOGLE_LOGIN_CON_AGENDA=1` en Vercel; la
  política prometía «dos momentos separados» y tenía que cambiar ANTES.
- **El diagnóstico obvio era reescribir el texto y listo.** Pero el interruptor se prende en Vercel cuando la rama ya está en
  main: un texto fijo mentiría en el medio (diría «una sola vez» con el login todavía en dos, o al revés). La página lee el
  MISMO interruptor en el server y dice lo que el login hace HOY. **Regla: un texto legal que describe un comportamiento
  detrás de un interruptor lee ese interruptor.**
- Cada promesa de la versión «al entrar» quedó atada a su línea de código en el test: destildable (`otorgoLaAgenda`), sólo
  quien administra (`rolWs !== 'admin'`), sin pisar la agenda de otra persona (`googleCalendarDueno`).

**Quedó SIN hacer:** poner `GOOGLE_LOGIN_CON_AGENDA=1` en Vercel (producción). Lo pide el Cerebro a Martín cuando esta rama
esté en main.

*26/10/2026, chat «Settings» (claude5), rama google-agenda-2610.*

## Los grabadores de reuniones: una reunión, venga de donde venga (26/10/2026)

**Vive en:** `lib/grabadores/` (la capa: `reunion.ts` la forma común y la clave, `index.ts` la puerta, un lector por
grabador, `formas.ts` lo que devuelve cada API, `firmas.ts`, `al-terminar.ts` lo que pasa cuando un grabador avisa),
`app/api/webhooks/{tldv,fireflies,zoom}`, migración sin número `XXXX_reuniones_de_cualquier_grabador.sql`.
Guard: `tests/grabadores.test.ts` (15, probado con 11 roturas, dos invertidas).

Pedido de Martín (26/10, ~01:50): «implementa otras integraciones de grabadores de reuniones, como Loom, etc... Así no solo
se puede grabar con fathom. Y revisa el plan y otras cosas que solo consumen fathom».

- **El diagnóstico obvio era el equivocado: «Loom es el primero» no se puede hacer.** Loom dice textual «Loom does not offer
  a open API at this time» (support.atlassian.com/loom). No hay listado, ni transcripción, ni webhooks; `api.loom.com` ni
  resuelve DNS. El oEmbed (`loom.com/v1/oembed`) da título, duración y miniatura de un video PÚBLICO cuyo link ya tenés.
  Lo único con transcripción es el Teamwork Graph de Atlassian: Preview, sólo desde apps Forge instaladas en Jira o
  Confluence, con allowlist. La GraphQL de loom.com contesta 200 anónimo y la usan scrapers: NO es oficial, no se usa. Lo
  que quedó: la tarjeta lo dice, el link de un Loom entra al lead, y la transcripción se sube en el Plan → Importar.
- **El inventario: lo que leía SÓLO de Fathom eran cinco funciones de red y una forma.** `listMeetingsPage`,
  `fetchAllMeetings`, `fetchMeetingContent`, `fetchRecordingTranscript`, `fetchRecordingSummary` y `FathomMeeting`, usados
  por el Plan (cron, webhook, modal, API), el Closing (sync, por lead, re-analizar, transcript), Customer Success (sesiones
  de entrega, propuesta del curso), el CRM (enganche automático de grabaciones, el webhook, el link del lead), los gráficos
  con IA, el Ops Center y once lugares que preguntaban `integracionConectada('fathom')` para decir «¿puede leer
  reuniones?». Todo pasa ahora por `lib/grabadores` (`hayGrabadorConectado`, `listarReunionesRecientes`, `leerReunion`).
  El Second Brain todavía no lee reuniones (el recolector es sólo WhatsApp): cuando lo haga, de la capa.
- **La clave numérica, para no migrar seis tablas.** `closing_analyses`, `plan_reuniones_descartadas` y
  `curso_progreso.ia_recording_id` guardan la reunión como `bigint`, y las marcas del Plan van por número. Fathom sigue con
  su `recording_id` (positivo): ninguna marca, borrador ni análisis viejo cambia de nombre. Los demás llevan un número
  NEGATIVO derivado de «grabador:id» (cyrb53, 53 bits): nunca choca con uno de Fathom. De la clave a la reunión vuelve la
  tabla `grabador_reuniones` (la escribe UN lugar, la capa al listar). Sin la migración todo lo que lleva la reunión
  entera anda (el cron, el webhook, el modal); lo que tiene SÓLO el número («Leer igual», «Volver a analizar») lo dice, y
  Customer Success deja esperando sus sesiones (hasta la revisión del tren m les quemaba los 3 intentos: ver
  docs/hallazgos-closing.md). Con eso el orden entre el deploy y la 0338 da igual de verdad.
  ⚠️ El proyecto compila a ES2017: un hash con literales BigInt (`0xcbf…n`) no compila; por eso cyrb53 con `Math.imul`.
- **Las trampas medidas contra las APIs reales (26/10, sin credenciales):**
  - **Fireflies contesta HTTP 500 a una clave mala** (`errors[].code = "auth_failed"`), no 401: un cliente que reintenta
    los 5xx reintentaría para siempre. El ping y el lector lo leen como «la clave no sirve» (`esAuthFireflies`).
  - **tl;dv no firma sus avisos** (sólo deja agregar headers propios) y el esquema de `TranscriptReady` no coincide con el
    ejemplo de su misma doc. Por eso de un aviso se usan el correo del organizador (ruteo) y el id, y la reunión se pide
    ENTERA por la API con la clave de ese negocio: un aviso falso, a lo sumo, hace leer una reunión que de verdad es suya.
  - **Fireflies y Zoom no dicen de quién es el aviso** (Fireflies manda sólo `meeting_id`; la validación de Zoom no trae
    cuenta). Los rutea la FIRMA: el negocio cuyo secreto la verifica (`negocioPorFirma`). Dos negocios con el mismo
    secreto (Fireflies lo escribe la persona) = no es de nadie.
  - **Zoom: el correo de un participante de afuera viene VACÍO.** El CRM no puede saber solo de qué lead es la llamada;
    la tarjeta lo dice. La transcripción es un VTT («Nombre: texto») y el rango de fechas, de un mes como máximo.
  - **tl;dv, Fireflies y Otter no dicen quién es «de afuera»** (Fathom sí, `is_external`). Se infiere del correo contra el
    de quien grabó (`externoPorCorreo`): el mismo dominio es de la casa; con un gmail, cualquiera es de afuera.
  - **Una transcripción que falta en una reunión reciente es «todavía no está», no «no hay»** (tl;dv la devuelve sólo
    completa; Zoom tarda). Tratarla como vacía cerraba la reunión para siempre como «sin compromisos»: es
    `GrabadorSinRespuestaError`, y el cron la reintenta.
  - **Read AI**: OAuth 2.1 con registro dinámico, token de 10 minutos y refresh que rota en cada uso, y su doc no dice si
    acepta una vuelta que no sea la suya: sin probarlo, no hay botón. **Google Meet**: el permiso `meetings.space.readonly`
    es «sensible» y la app de Google de MaKo no lo tiene. **Otter**: API sólo Enterprise; la forma de su LISTA no se pudo
    medir, así que si no es la esperada, tira diciendo qué vino (nunca «no hay reuniones»).
- **El chip «Fathom» del Plan mentía para todo lo demás.** El origen de una tarjeta caía a «WhatsApp» con cualquier
  `origen` que no estuviera en una lista; ahora cada grabador es su propio origen, y el filtro «Reuniones grabadas» guarda
  la clave vieja `'fathom'` para no borrarle el filtro a quien ya lo tenía.
- **Lo que encontró la revisión del tren m (26/10, hallazgos 9, 12 y 13):**
  - **La misma reunión grabada por dos grabadores era DOS reuniones.** Con Fathom y tl;dv en la misma R1, cada copia tenía
    su clave: dos análisis del Closing (score y conteos duplicados), dos borradores del Plan, y como los links eran
    distintos, los dos avisos «agregaban» un link y disparaban `reunion.ocurrio` y el aviso al dueño dos veces. El único
    freno era por link. Ahora `esLaMismaReunion` (menos de 10 minutos de diferencia, y un invitado en común que no es el
    anfitrión o el mismo título con el mismo anfitrión) y `leTocaA`: se procesa la copia que ya tiene algo hecho —así la
    que llega después no se procesa de nuevo— y si ninguna, la de Fathom. El evento y el aviso llevan la clave del lead y
    la reunión (`claveDeReunionDelLead`), no la del grabador.
  - **Con tl;dv o Fireflies un no-show quedaba «asistió».** Ninguno atribuye voces a correos (`invitadoHablo` da null
    siempre) y sus invitados salen del CALENDARIO, no de quién entró. El webhook hacía `null ?? true`: el lead que no vino
    —el closer lo esperó con el grabador prendido— avanzaba de etapa y nunca entraba a la nutrición No Show. Un «no se
    sabe» es «asistió» sólo con Fathom (`anotaLaAsistencia`); con los demás se engancha el link y la asistencia queda para
    una persona o la regla T1. (El revisor dijo que disparaba CAPI QualifiedLead: falso, la asistencia dejó de mandar
    eventos a Meta el 05/10; el comentario de `applyFathomRecording` que lo decía estaba viejo.)
  - **tl;dv avisa MeetingReady ANTES de tener la transcripción, y TranscriptReady no dice de qué negocio es.** El
    seguimiento se redactaba igual: el Closing pagaba un análisis con el título solo (y si salía «descartada», la llamada
    se perdía para siempre) y el borrador no se hacía nunca. Ahora el aviso espera y reintenta mientras el reloj deje
    lugar al análisis (`entraOtraEspera`); si no llega, el seguimiento queda anotado (`seguimiento-pendiente.ts`) y lo
    redacta el cron del Closing cuando la transcripción esté. El análisis por lead no paga a Claude sin transcripción.
- **Sin hacer:** la migración (con el sí de Martín), Read AI, Meet, y Grain/MeetGeek/Avoma/Granola/Krisp (tienen API con
  clave): `docs/pendientes.md` → P13.

## /integraciones limpia: sacar una tarjeta NO es sacar la integración, y el Leads Scraper era una sola cosa (25/10/2026)

**Vive en:** `lib/integraciones-catalogo.ts` (`oculto`), `app/integraciones/IntegracionesBoard.tsx` (`?abrir=`),
`app/integraciones/TusCuentasIA.tsx`, `lib/google-login-agenda.ts`, `app/api/auth/google/route.ts` y su callback.
Guards: `tests/integraciones-limpieza-25-10.test.ts`, `tests/leads-scraper-retirado.test.ts`.

- **Ocultar una tarjeta rompía su link EN SILENCIO.** El `?abrir=<key>` del tablero buscaba la key en la lista VISIBLE: con
  las cuatro IA y Google Calendar en `oculto`, `?abrir=anthropic` o `?abrir=google` (que mandan los avisos, la API de MaKo y
  MaKo en WhatsApp) no abría nada, sin error. Ahora una `oculto` abre el modal suelto (`useConectarIntegracion`). **Regla:
  `oculto` saca la tarjeta, no la integración; su modal (`getIntegracion` no mira `oculto`), su estado en la API
  (`getIntegraciones({ conOcultas: true })`) y su link tienen que seguir andando.**
- **Ocultar algo pone rojo a un test ajeno que lo usaba de EJEMPLO.** `integraciones-visibles` tomaba a `anthropic` como «la
  tarjeta de Inteligencia que el super admin ve»: rojo desde el commit que la ocultó, y no lo dijo nadie hasta correrlo.
  Antes de ocultar, `git grep` de la key en `tests/`.
- **Las filas nuevas salían apiladas y centradas, y no era la grilla:** `.tci-clave` ya existía más abajo en
  `tus-cuentas-ia.css` (reglas viejas sin dueño, `flex-direction: column`) y le ganaba a la nueva. Un nombre de clase se
  busca antes de usarlo; las nuevas son `.tci-api`.
- **«Depreca Hotmart, Skool... Elimina Apify» no eran tres tarjetas: era el Leads Scraper entero** (14/10). Dos webhooks que
  entraban gente al CRM, el ruteo por hash, la pantalla `/crm/prospectos` con su renglón del «⋯» y del clic derecho, dos
  operaciones de la API y un `funnel-de-entrada` que sólo existía para ellos. Medido antes, sólo leyendo: **0** claves (ni de
  la plataforma), 0 filas de ruteo, 0 leads con ese origen, 0 búsquedas. Salió todo; las tablas de la mig 0289 quedan
  (vacías) y `RUTEO_POR_HASH` queda vacío pero vivo (es el mismo mecanismo de los tokens de la API).
- **Apify tenía una segunda vida que no es la integración:** la lectura de un @ de Instagram que paga la PLATAFORMA
  (`lib/instagram-perfil-server.ts`, 22/10). Quedó DORMIDA: no hay clave en ningún lado y la tarjeta para cargarla se fue.
  Su respaldo con la clave del negocio (`credDelCliente('APIFY_TOKEN')`) ya no se puede cargar.
- **El login con Google NUNCA pidió la agenda, y dos comentarios decían que sí** (el callback y `GoogleCalendarPanel`):
  `guardarCalendarBestEffort` estaba dormido. Ahora la pide con `GOOGLE_LOGIN_CON_AGENDA=1`, apagado: la app de Google no
  está verificada (`docs/verificacion-google.md`) y los scopes del calendario son SENSIBLES → «Google no verificó esta app»
  a todo el que entra y cada uno cuenta contra el tope de 100. **Trampa del consentimiento granular:** la persona puede
  destildar el calendario y Google igual manda un refresh_token; el callback guarda sólo si el `scope` de la respuesta trae
  la agenda ENTERA (`otorgoLaAgenda`).
- **`oculto` rompió en silencio CUATRO lugares más, y los encontró la revisión adversarial del tren (25/10, noche):**
  - `link_configurar_integracion` validaba la key contra la grilla y contestaba «no existe» para las IA y Google: MaKo
    no podía mandarle a nadie el link para conectarlas (justo el caso de Florencia);
  - las cajas de «Costo de MaKo» buscaban el modal en la grilla y no abrían nada;
  - el teléfono (`/m/configuraciones/integraciones?abrir=<key>`, adonde reescribe el link en un celular) leía la lista sin
    `conOcultas`: el link llegaba a una lista sin la conexión y sin hoja abierta;
  - `googleConToken` miraba la grilla: el permiso de Google no se leía nunca, y la vuelta con la casilla de editar
    destildada festejaba «Google Calendar conectado».
  **Regla:** todo lugar que lee la lista para saber qué EXISTE (validar, abrir, buscar un estado), y no para dibujarla,
  usa `conOcultas` o `getIntegracion(key)`. Antes de ocultar algo: `git grep` de `getIntegraciones(` y de
  `integraciones.(find|some)`, y cada pantalla que lee `?abrir=` resuelve las `oculto` aparte.

**Quedó SIN hacer:**
- Prender `GOOGLE_LOGIN_CON_AGENDA`: recién con la verificación aprobada (Martín contesta el hilo de Google con el video
  youtu.be/0-i4bJ8w5fo y arma la cuenta de revisor en el ws3) y **antes** reescribir `app/privacidad/page.tsx` (promete dos
  consentimientos separados, el del login y el de la agenda).
- La lectura de un @ por Apify de la plataforma (`lib/instagram-perfil-server.ts`): sacarla o reemplazarla lo decide el CRM.
- El nombre y el logo de Zernio: los lleva el chat de Zernio.

*25/10/2026, chat «Settings» (claude5), rama integraciones-2510.*

## Los links a cada conexión: `?abrir=` y `?servicio=` abren el modal, y el login perdía la query (25/10/2026)

**Vive en:** `app/integraciones/IntegracionesBoard.tsx`, `proxy.ts` (`denegar`), `lib/integraciones-catalogo.ts`,
`lib/metodo-catalogo.ts`, `lib/hechos-mako.ts`, `lib/mako-capacidades.ts`.

- **`/integraciones?abrir=<key>` abre el modal de esa integración, y `?servicio=` también.** Una entrada más abajo dice que
  `?servicio=` no lo abre: está vieja. «Tus cuentas de IA» no tiene link propio, y una key desconocida se ignora en silencio.
- **Un link así abierto SIN sesión terminaba en integraciones sin el modal:** `denegar` ponía en `next` sólo el pathname y la
  query quedaba colgada en /login. Lo arregló Zernio (0024e38ce, `tests/login-next-con-query.test.ts`); se vio con la vuelta de
  Facebook de la conexión de Meta por Zernio.
- **Lo que MaKo sabe de cómo conectar cada cosa está escrito en ocho lugares que ya se contradicen**: los dos catálogos,
  `servicio-slides` (todavía vende «IA gratis»), `tab-activacion`, `hechos-mako` (sólo meta, anthropic y landing), `mako-capacidades`,
  los `DEEP_LINKS` del doer y la expresión de intención (todavía dice «chatwoot»). Fathom, Zernio y MaKo Desktop no estaban.
- **Zernio no crea la conexión de Meta si en la ventana de Facebook se marcan varias páginas y no se le pasa `pageId`**: vuelve
  sin error visible. El primer clic de Martín (25/10) no dejó nada; el segundo, con la página fija, sí.

**Lo que quedó (tanda 2, «MaKo en WhatsApp: conexiones», 25/10/2026): un solo catálogo, `lib/conexiones-catalogo.ts`**, puro;
lo fija `tests/conexiones-api.test.ts`:
- ⚠️ **El plan decía «montado sobre `DEFS` de metodo-catalogo», y `DEFS` no vive ahí.** Las tarjetas son `DEFS` de
  `lib/integraciones-catalogo.ts` (puro); `lib/metodo-catalogo.ts` es `server-only` (`SERVICIOS_METODO`, los tutoriales). Por
  eso el catálogo NO trae los pasos de una tarjeta: los lee el runner, en el servidor (`como_conectar`, `ver_integracion`).
  Trae sólo los de lo que no es tarjeta (la computadora), con los rótulos reales de «Conecta MaKo»: el test los busca en la
  pantalla, porque un paso con un botón que no existe es peor que ninguno.
- **Una tarjeta nueva entra sola** (se deriva de `DEFS` y el test exige que estén todas). Aparte: la computadora
  (`/perfil/ia?computadora=1`), «Tus cuentas de IA» (`?abrir=ia`, de MaKo Desktop) y el QR (`/chats?conectar=whatsapp`).
- **Gemini y Groq están pero no se ofrecen** (`noSeOfrece`): quien ya los tiene los usa; no se manda a conectarlos.
- `buscarConexion` gana con la frase MÁS LARGA que aparece como palabra: «google calendar» le gana a «google», y «el pixel de
  meta» va a Meta (ahí se carga el ID del píxel), nunca al Pixel de MaKo.
- **SIN hacer:** que lo consuman `hechos-mako`, `mako-capacidades`, los `DEEP_LINKS`, la expresión de intención y los carteles
  (lib/fallo-ia-texto.ts tiene su propio `RUTA_CONEXION`): tanda 3. Y la key desconocida en `?abrir=` sigue sin aviso.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## Pasar una integración de PLATAFORMA a BYOK son seis piezas, y cinco fallan calladas

**Vive en:** `lib/integraciones-catalogo.ts` · `lib/metodo-catalogo.ts` ·
`lib/credenciales.ts` · `lib/datos-mau.ts` · `lib/elevenlabs.ts`

El 02/09/2026 ElevenLabs pasó de correr con la cuenta de MaKo a correr con la de
cada cliente. La cifra que lo justificaba al revés es la que lo dio vuelta: la voz
es MEDIOS, **US$0,045/min contra US$0,00067 del texto — 67×**, y eso no se puede
costear para todos. Un mapeo de 76 agentes encontró 61 problemas confirmados, 28
de ellos bloqueantes. Estos son los que no se ven leyendo el código.

### Sacar una integración: los cuatro registros juntos, y sus credenciales quedan huérfanas

Medido el 06/10/2026 sacando Microsoft Clarity del producto. Una integración son tres
registros más el logo (AGENTS.md) y, al SACARLA, el orden importa en las dos direcciones que
los guards miran por separado: sin el ping primero, /metodo contesta «servicio inválido» sobre
un formulario que todavía existe; sin el logo primero, el guard de los tres registros falla
sobre una integración que sigue declarada. Por eso salen los cuatro en el mismo commit.

**Lo que no se ve:** `ENVS_METODO` (lib/metodo-catalogo.ts) es la lista blanca de lo que la
ruta de credenciales deja **borrar y revelar**. Sacando el servicio del catálogo, una fila ya
guardada en `credenciales` queda cifrada y **sin forma de borrarla desde la pantalla**. Con
Clarity son 10 filas en 5 workspaces, inertes —ningún código las lee—; si hace falta borrarlas,
es por SQL. Es lo mismo que lib/integraciones.ts ya advierte del WhatsApp oficial: esconder una
integración no la apaga, la vuelve inmanejable.

**Y un umbral que pasaba por uno:** `tests/tutoriales-legibles.test.ts` exigía más de 300
textos de tutorial y, sin los 15 de Clarity, quedaron 301. Se bajó a 250 con el porqué: es un
piso contra un extractor ROTO, y a uno del margen la próxima limpieza de copy lo habría tirado
con un mensaje que manda a arreglar el extractor.

**Vive en:** lib/integraciones-catalogo.ts · lib/metodo-catalogo.ts · lib/metodo-verificar.ts ·
app/_components/ServicioVisual.tsx · app/api/integraciones/credencial/route.ts ·
tests/tutoriales-legibles.test.ts · *2026-10-06*

### 1. `soloPlataforma` está DOS veces y hace dos cosas distintas

`lib/integraciones-catalogo.ts` decide si se **dibuja** la tarjeta.
`lib/metodo-catalogo.ts` lo lee `servicioDelContexto` en
`app/api/integraciones/credencial/route.ts`, que es el **choke point** de guardar,
verificar, revelar y borrar.

Sacar sólo el primero deja al cliente **peor que antes**: ve la tarjeta, abre el
modal, y el GET le contesta 400 «servicio inválido» — un mensaje que lo culpa a él
por haber elegido bien. Es la misma familia que «sin el PING el cliente no puede
guardar nada».

**La regla: antes de mover un flag de visibilidad, `grep` del flag entero.** Si
aparece en dos catálogos, son dos decisiones y hay que tomarlas juntas.

### 2. `credWs` cae a `process.env` para OWNER_WS, y OWNER_WS es un cliente

Ya está en AGENTS.md, y aun así es la trampa central de cualquier BYOK:

```ts
if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]!;
```

Con `credWs` a secas, Mauricio —**y sólo él**— habría seguido usando la cuenta de
la casa, facturada a la casa. **Y no falla: funciona.** Por eso ahora existe
`credDelCliente`, que es `credWs` sin esa línea: la pregunta «¿de quién es esta
credencial?» se contesta **eligiendo función**, no acordándose de un argumento.

**Y la PANTALLA pregunta con `credWs`, así que en el ws1 miente para arriba**
(*2026-09-16 api-mako-areas*). El ws1 ve ElevenLabs, Zernio y OpenRouter «Conectada», y
«Probar conexión» da verde. Las tres piezas leen con la función equivocada: la tarjeta, con
`credWs` (`lib/integraciones.ts:175`); el campo, con `estadoCampo`, que sin fila y en
OWNER_WS cae al env con `origen: 'servidor'` (`lib/credenciales.ts:255-260`); y el ping
prueba lo que devuelve `credWs` (`lib/metodo-verificar.ts:599`) — o sea, la key de la casa.
La lib BYOK lee con `credDelCliente` (`lib/elevenlabs.ts:155`) y no la ve. `NO_MIGRAR_A_WS`
no ayuda: frena la copia del boot, no esta lectura.

**El diagnóstico obvio —«la key está cargada, lo roto es la feature»— es el equivocado:** la
key que se ve no es del cliente. Para decir «conectada» sobre una credencial BYOK, la
pregunta tiene que ser la misma que hace quien la consume. Sigue así en las tres libs.

### 3. Borrar la fila no dura: el boot la vuelve a sembrar

`migrarEnvACredenciales` **rellena huecos** desde el entorno, y `.env.local`
apunta a la base de **producción**. O sea que un `npm run dev` en la máquina de
cualquiera bastaba para que la cuenta de MaKo reapareciera dentro del ws1,
disfrazada de conexión propia de Mauricio. Se cierra con `NO_MIGRAR_A_WS`.

### 4. Y «Datos de Mau» la sembraba por el otro lado

`lib/datos-mau.ts` copia las credenciales del ws1 al workspace destino. Así se
había sembrado la del ws4. **El filtro obvio —`if (s.soloPlataforma) continue`—
nace muerto**: ese flag se apaga exactamente cuando una credencial pasa a BYOK,
que es el momento en que más se lo necesita. Va contra `esCredencialDeLaCasa`, que
es la misma lista que gobierna el boot.

⚠️ **Es el patrón general: una guarda colgada de un flag que el propio cambio
apaga no es una guarda.** Antes de escribir una, preguntá si sigue siendo cierta
después del commit que la motiva.

### 5. El texto de «falta la key» estaba escrito seis veces, y las seis mentían

Seis literales idénticos de «No hay API key de ElevenLabs cargada **en la
plataforma**». Bajo BYOK eso apunta al lugar equivocado: manda a esperar que MaKo
arregle algo que se arregla en la pantalla del propio cliente. Es «una cosa, un
lugar» sin cumplir, con el agravante de que el texto duplicado envejece de golpe
el día que cambia el modelo de negocio.

**Y el reparto de culpa es lo que decide si un mensaje lleva link:** `sin_key`,
`sin_permiso`, `impago` y `cuota` van a `/integraciones`; `voz_muerta` ofrece
reclonar; y `proveedor` y `nuestra` **no llevan link** y dicen con todas las letras
que no es nada del cliente.

### 6. La pantalla pedía 90 segundos para dar una noticia que ya sabía

El paso «Tu voz» pedía la grabación entera y recién al subirla contestaba que
falta la key. **Un chequeo que se puede hacer antes del trabajo y se hace después
convierte un dato en una pérdida.** Ahora el GET trae `hayKey` y sin ella se pide
la key, no la grabación — con `null` («todavía no contestó») no se pinta nada,
porque mostrar «conectá» por un parpadeo a quien sí la tiene es peor que esperar.

### Lo que se midió, y por qué no se puede confiar en el `.env.local`

| Workspace | Key | Qué era |
|---|---|---|
| ws9 (plataforma) | `…734a` | La que usa producción. 9 clones adentro |
| ws1 (Mauricio) | `…734a` | La de la casa, copiada. **Borrada** |
| ws4 | `…734a` | La de la casa, sembrada por «Datos de Mau». **Borrada** |
| ws11 (Leila) | `…de1d` | Propia, plan `starter` de pago. **Se conserva** |

⚠️ **La key del `.env.local` (`…d3c6`) NO es la que usa producción.** `credWs`
busca primero la fila de la base y sólo cae al entorno como último recurso; el ws9
tiene fila propia, así que la del entorno no se usa nunca. Medir la cuenta del
`.env.local` era medir **otra cuenta** — y así se reportó un «tier creator, 2/30
slots» que no era el de producción.

**Antes de medir una cuenta de un proveedor, comprobá qué credencial usa el código
de verdad.** No la que está a mano.

### El orden del deploy, que no es intercambiable

1. Los cambios de código juntos, y desplegar.
2. Verificar **contra la API**, no mirando la pantalla: un GET a
   `/api/integraciones/credencial?servicio=<x>` con sesión de cliente tiene que dar
   200. El flag de visibilidad y el guard de la ruta son cosas distintas.
3. **Recién ahí** borrar las filas viejas, en POSITIVO y enumerando
   (`workspace_id IN (1,4)`). La formulación tentadora —«borro las que tengan el
   valor de la plataforma»— se lleva puesta la del super admin.

Al revés, el cliente se queda sin la feature **y** sin forma de reactivarla,
porque la tarjeta todavía no le aparece.

### Lo que quedó SIN hacer

- Los **9 clones** que viven en la cuenta de MaKo (`MaKo ws11`, `MaKo ws14`, seis
  de Mauricio, Johana) quedaron huérfanos: sus workspaces ahora resuelven a otra
  cuenta, así que su `voiceId` guardado en `video.voz` apunta a una voz que su key
  no puede ver. `verificarVoz` lo detecta, pero el resultado se colapsa a un
  booleano que nadie lee, así que la pantalla puede pintar «Tu voz está clonada» en
  verde sobre un clon inalcanzable. Vive en `app/api/onboarding/voz/route.ts` y
  `app/video-generator/OnboardingVideoGen.tsx`.
- `textoEleven()` está escrito y **no lo llama nadie todavía**: la pantalla sigue
  mostrando el `error` plano. Falta cablear el `motivo` desde las respuestas de
  `app/api/onboarding/voz/route.ts` hasta el render.
- «Se acabaron los espacios de voz» no es un motivo del enum: cae en `cuota` («se
  repone el mes que viene»), que manda a esperar algo que no va a llegar. Vive en
  `lib/elevenlabs-fallo.ts`.

*Corrida del 02/09/2026 — 76 agentes, 61 hallazgos confirmados de 70.*

---

## Google Calendar era owner-only, y el 403 que veía el cliente NO era la parte cara

**Vive en:** `app/api/integraciones/google-calendar/route.ts` ·
`app/api/integraciones/google-calendar/callback/route.ts` · `lib/google-calendar.ts` ·
`lib/gcal-estado.ts` · `lib/workspace.ts` · `app/configuraciones/gcal-actions.ts` ·
`app/integraciones/IntegracionesBoard.tsx` · consola de Google Cloud (cliente `118392241323-j98eq…`)

El cliente del ws13 (Código Inmobiliario) apretó «Conectar Google Calendar» y recibió
`{"ok":false,"error":"Solo el workspace principal puede conectar Google Calendar."}`.

### El gate estaba puesto con la pregunta equivocada

Las dos patas del OAuth gateaban con `esDuenoAdmin()`, que pregunta **«¿sos la
agencia?»** y existe para mover PLATA en la cuenta de Meta de la agencia. Conectar
la agenda propia es otra pregunta: **«¿administrás ESTE workspace?»**. El resto de
la maquinaria ya era per-workspace desde siempre —`app_settings` tiene PK compuesta,
el token se cifra con el ws, y el callback del LOGIN ya guardaba con
`runWithWorkspace(ws, …)`—: la casa estaba entera y quedó una sola puerta cerrada.

El guard correcto ya estaba escrito y comentado en la ruta hermana
(`app/api/integraciones/credencial/route.ts`): super-admin de agencia **O** admin del
propio workspace, ws siempre del request, fail-closed. Ahora vive en
`adminDeWorkspaceActual()` (`lib/workspace.ts`) y lo usan los cuatro puntos.

### Abrir el gate ACTIVA tres fallas que dormían

Ninguna se veía mientras conectar era owner-only, porque el `?? OWNER_WS` era
justamente el mecanismo por el que la agenda del ws1 quedaba conectada:

1. **`wsDelSetting()` caía a `OWNER_WS`.** Un admin sin ws resuelto conectaba SU
   agenda y el token cifrado terminaba en `app_settings` del ws1 — el buscador de
   reuniones de Mauricio pasaba a leer la agenda de otro, sin error y sin síntoma.
2. **`desconectarGoogleCalendar()` era peor**: llamaba a `setSetting` directo, que
   tiene su PROPIO `?? OWNER_WS` (`lib/settings.ts`). Un «Desconectar» apretado sin
   ws resuelto le borraba el token a Mauricio.
3. **El `?ws=` se perdía en las TRES patas del round-trip.** El `redirect_uri` está
   registrado FIJO en Google Cloud, así que en la vuelta no hay `?ws=` ni pestaña que
   leer: el callback resolvía el workspace de **quien tuviera la sesión**. La agencia
   configurando parado adentro de un cliente le guardaba la agenda a su propio
   workspace. No falla: **funciona**, con el tile verde en el lugar equivocado.

El workspace destino ahora viaja en la cookie `gcal_state` (`nonce.ws`, httpOnly), que
escribe el paso 1 —el que ya autorizó— y el callback aplica con `runWithWorkspace`.
La regla vive en `lib/gcal-estado.ts`, **sin `server-only`**, con test: es la frontera
que decide en qué inquilino se escribe el token de agenda de alguien.

### ⚠️ El bloqueante real está FUERA del repo, y ningún cambio de código lo toca

**MEDIDO el 05/09/2026 en la consola** (proyecto `MaKo` / `mako-500317`, que es de
`martinkoncke@gmail.com` — con la cuenta de Leandro la consola contesta «Necesitas acceso
adicional» y eso se lee como un problema de permisos cuando es de cuenta):

| Qué | Estado |
|---|---|
| Publishing status | **Testing** (cap de 100 usuarios de por vida) — **PUBLICADA el 07/10**, ver abajo |
| Test users | **3**: martinkoncke@, dueno@negocio-uno.com, tejadomartin@ — **el cliente NO está** |
| Branding | **INCOMPLETO**: `App name` VACÍO, home page, privacy, terms y authorized domains vacíos |
| Data Access | **CERO scopes registrados** — ni `calendar.readonly` ni `calendar.events`, en ninguna de las tres tablas |
| Redirect URIs | **OK**: las dos de `hola-mako.com` (login y agenda) están, y también `localhost:3000` |

El rastro estaba escrito en `docs/hallazgos-infra.md` desde el 06/08/2026
(«**Pendiente del dueño:** sacar el aviso de Google "Esta app está en prueba"») y nadie lo
cruzó con «los clientes van a conectar su agenda». En Testing sólo consienten los emails
cargados a mano: el cliente pasa los gates nuevos **y lo frena Google**.

⚠️ **Y publicar NO es un botón:** la propia pantalla de Audience dice «Your app's OAuth
configuration is incomplete… visit the Branding page». Con el `App name` vacío el botón
«Publish app» no procede. O sea que el pendiente escrito en agosto era más grande de lo que
su redacción sugería — «sacar el aviso» suena a un toggle y son cuatro campos más una
política de privacidad publicada.

### 07/10/2026: publicada, sin verificar

El cliente del ws13 chocó, un mes después, con exactamente lo que esta sección predecía:
«Acceso bloqueado: hola-mako.com no ha completado el proceso de verificación de Google…
Error 403: access_denied». **Que el error fuera de Google y no nuestro probó que el arreglo
de código funcionaba**: el cliente pasó `adminDeWorkspaceActual()` y llegó al
consentimiento. Seguía en Testing con los mismos 3 test users.

Se completó Branding y se publicó («In production»). Tres cosas que no se ven desde afuera:

- **«Publish app» no da error: está GRIS.** Con Branding incompleto el botón queda
  deshabilitado con una línea chica que manda a Branding. Se lee como «no tengo permiso»
  cuando es «falta un campo».
- **El email de soporte había quedado VACÍO** (el 05/09 figuraba cargado). Es obligatorio
  y es lo que destrabó el botón, junto con los tres enlaces a `/privacidad`, `/terminos`
  y la home. Los dominios autorizados no hubo que tocarlos: se cargan solos desde las
  redirect URIs del cliente OAuth.
- **Sin logo, a propósito**: subir uno obliga a verificar aunque nada más cambie.

Lo que ve un cliente ahora: «Google no verificó esta app» → *Avanzado → Ir a
hola-mako.com*. Tope de **100 usuarios en toda la vida del proyecto**, que no se
reinicia. Los refresh_token ya no caducan a los 7 días. **Verificar sigue bloqueado** por
el Uso Limitado (`docs/hallazgos-ia.md`) y porque Data Access no declara ningún scope.

Dos correcciones a lo que decía la doc vieja, las dos medidas:
- **`localhost:3000` SÍ está registrada** para el callback de la agenda: `hallazgos-infra.md`
  afirma que conectar desde `npm run dev` falla con Error 400, y eso ya no es cierto.
- **`www.hola-mako.com` NO está** en ninguna de las 8 redirect URIs ni en los 3 JavaScript
  origins, y `proxy.ts` deja pasar `www` sin mandarlo al apex: quien entre por ahí come
  `redirect_uri_mismatch`. Sin reproducir todavía.

### 07/10/2026: el Verification Center dice «no hace falta verificar», y es falso

Al arrancar la verificación, el Verification Center contestó *«Verification is not required
since your app is not requesting any sensitive or restricted scopes»*. Mide lo DECLARADO en
Data Access, que tiene cero scopes, no lo que la app pide: `GCAL_SCOPE` lleva
`calendar.readonly` + `calendar.events` en cada conexión de agenda, y por eso el cliente ve
«Google no verificó esta app». **Un verde que contradice la pantalla que ve el cliente es un
dato sobre la consola, no sobre la app.**

Y dos cosas más que piden el trabajo antes de enviar (el paso a paso, con los textos para
pegar y el guion del video, está en `docs/verificacion-google.md`):

- **Google exige verificar en Search Console CADA dominio autorizado.** Hay tres:
  `hola-mako.com` (no verificado en martinkoncke@) y dos muertos, `makodigital.app` y
  `dashboard-marketing-six.vercel.app`, que entraron solos con sus redirect URIs. Los dos
  muertos contestan 410 en `/api/auth/...` (`EXENTAS_DE_HOST` no lo incluye), así que se
  sacan en vez de verificarlos.
- **`calendar.readonly` no sobra**: `calendar.events` no alcanza para `calendars.get` (el
  correo y la zona de la agenda) ni para `freeBusy` (la grilla de horarios). La
  justificación tiene que decirlo, porque Google pregunta por qué no alcanza un scope más
  angosto.

⚠️ **Con la ventana de Chrome oculta, Search Console no abre sus diálogos.** La pestaña que
maneja la extensión mide 0×0 (`visibilityState: hidden`): la consola de Cloud se lee bien
con `get_page_text`, pero las capturas vencen a los 30 s y el diálogo de «Verificar
propiedad», que es donde Google da el TXT, no llega a armarse. No es un permiso: es que
nadie lo dibuja.

Y trae una cola que el código no puede distinguir: en Testing **los refresh_token
caducan a los 7 días**. `googleCalendarConectado()` mide «el token descifra», no «Google
lo acepta», así que el tile quedaba **VERDE diciendo «Cruzando las reuniones de …»**
sobre una agenda muerta, para siempre. Peor: `gcalIncompleta` daba `false` con
`conectado:false`, así que tampoco entraba en «Requiere tu atención». Ahora hay un
tercer estado (`gcalRechazada`) que degrada a ámbar y dice qué pasó.

**Y `conectado: false` todavía contesta varias preguntas a la vez** (*2026-09-16
api-mako-areas*). `googleCalendarConectado` (`lib/google-calendar.ts:170-182`) da `false` si
el token nunca existió, si se desconectó (setting vacío) y si no descifra — y a diferencia de
la tabla `credenciales`, no hay estado «ilegible» que avise. `tokenGoogle` (`:195-216`) le
suma dos causas a su `null`: faltan `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en el server, o
el refresh no devolvió token (Google lo rechazó, o no contestó en 8 s). Y
`permisoCalendarioGoogle` (`:388-395`) devuelve el mismo `conectado: false` desde su `catch`.
O sea: «Google no respondió» se lee igual que «nunca conectaste tu agenda».

**Regla para quien lo consuma:** si `googleCalendarConectado()` da `true` y
`permisoCalendarioGoogle()` da `conectado: false`, el token está y Google no lo aceptó o no
contestó — nunca «no se conectó». Así lo dice la API (`rechazada_o_sin_respuesta`,
`lib/api-mako/areas/integraciones.run.ts:137`); la lib sigue sin distinguirlo, y esa es la
deuda, en esas tres funciones.

**La regla que queda:** cuando una feature pasa de owner-only a per-cliente, el gate es
la parte barata. Lo caro son (a) los `?? OWNER_WS` que hasta ese día eran el mecanismo
correcto y pasan a ser una fuga, y (b) **lo que un tercero exige y nadie volvió a mirar
desde que la feature tenía un solo usuario**. Un consentimiento de OAuth se otorga por
CUENTA, no por workspace: la agenda del cliente sólo la puede conectar el cliente, y el
email de la agenda (`EMAIL_KEY`, ya visible en la tarjeta) es la única señal de que
quedó conectada la correcta.

### Lo que quedó SIN hacer

- **Completar Branding y publicar la app.** Falta el `App name` (obligatorio, hoy vacío),
  y para la verificación posterior hacen falta política de privacidad y términos **públicos
  en el dominio**, que no existen: `app/privacidad/extension/page.tsx` habla de la extensión
  de Chrome, no de MaKo ni del uso de datos de Google Calendar. No hay
  `app/privacidad/page.tsx` ni `/terminos`.
- **Declarar los scopes en Data Access.** Hoy la tabla está vacía: `calendar.readonly` y
  `calendar.events` nunca se cargaron. En Testing no molesta (Google los concede igual a un
  test user), pero es lo primero que mira la verificación.
- **`integracionConectada('google')` devuelve `false` para TODOS los workspaces**: el
  token vive en `app_settings` y no en `credenciales`, y `'google'` no está en
  `lib/metodo-catalogo.ts` (sale por el `if (!s) return false` de
  `lib/credenciales.ts`). Hoy no muerde porque ningún cron lo usa —
  `correrPorWorkspace('google', …)` iteraría CERO workspaces y devolvería `ok:true` en
  silencio. Hay que cerrarlo antes de escribir el primer cron de agenda.
- **`googleRedirectUri()` lee `NEXT_PUBLIC_APP_URL`, no `APP_BASE_URL`** (que es la que
  usa el resto vía `lib/app-url.ts`). Si en Vercel está la segunda y no la primera, la
  URI se deriva del origin — y `proxy.ts` deja pasar `www.hola-mako.com` sin mandarlo al
  apex, así que quien entre por `www` come `redirect_uri_mismatch`. Sin medir.
- **`/api/crm/horarios` documenta «SIN CHEQUEO DE ROL» a propósito.** Con los gates
  abiertos, cualquier closer/setter del workspace pasa a leer el freeBusy de la agenda
  conectada. Es una decisión que hay que tomar explícita, no heredar.

*Corrida del 05/09/2026 — 9 agentes (5 lentes + síntesis + 3 refutadores); los tres
refutaron el plan de síntesis y los tres tenían razón: el gate solo no alcanzaba.*

---

## ⚠️ `verificarServicio` se escribió para el tilde del formulario, y reusado para contestar «¿anda?» miente

**Vive en:** `lib/metodo-verificar.ts` (`PINGS`, `verificarServicio`) ·
`lib/api-mako/areas/integraciones.run.ts` (`probar_conexion_integracion`)

El ping corre ANTES de guardar cada campo (es el tercer registro de una integración, en
AGENTS.md), y varias decisiones correctas para ese momento son mentiras fuera de él. Salió
al exponerlo como «probar la conexión» en la API de MaKo. La auditoría vieja de los pings
—«key válida» no es «la integración sirve»— está en [hallazgos-infra.md](hallazgos-infra.md);
estas cuatro son otras.

### 1. Hay `ok: true` que no le pegaron a nadie

Para no trabar el guardado, varios caminos contestan `ok` sin llamar al proveedor:

| Servicio | Caso | Qué devuelve |
|---|---|---|
| Clarity | sin token (`:430`) | `ok: true`, «ID válido. Falta el token…» |
| Clarity | cuota diaria agotada, 402 (`:438`) | `ok: true`, «Guardado. Hoy ya se usaron las 10 consultas…» |
| Zernio | sin key propia (`:505-507`) | `ok: true`: el modo normal, con la cuenta de la agencia |
| Cal.com | sin API key y con secret (`:539-548`) | `ok: true`: el secret no se puede comprobar contra nadie |

Quien lo reuse para decir «anda» tiene que separar los `ok` que no probaron nada. Y el
«Guardado.» del 402 afirma una acción que, fuera del formulario, no pasó.

### 2. Probar Clarity le gasta al cliente la cuota del día

La Data Export API de Clarity permite 10 consultas por día, y el ping gasta una
(`project-live-insights`, `:432`). Un «probar» apretado unas cuantas veces deja ese día sin
resumen de sesiones — y el 402 que sigue sale como `ok`, por el punto 1.

### 3. Los `facts` traen datos personales y plata

Son para la tarjeta del admin, y traen: el número de WhatsApp de la bandeja de Chatwoot
(`:155`), el email de la cuenta de Calendly (`:491`) y de Cal.com (`:562`), el título de la
última llamada de Fathom —que suele llevar el nombre de un lead— (`:377-379`) y el uso en USD
de OpenRouter (`:249`). Nada de eso puede salir por otro canal. Por eso la API devuelve solo
`anda`, `detalle` y `motivo` (`integraciones.run.ts:118-125`), y así puede ir por HTTP.

### 4. El sondeo de ElevenLabs no tiene timeout

`fetchJson` lleva `AbortSignal.timeout(8000)` (`:22-24`), pero `sondear` (`:317-318`, el POST
sin cuerpo a `voices/add` y a speech-to-speech) llama a `fetch` directo, sin `signal`. Un
ElevenLabs lento cuelga la verificación hasta el techo de la función. Sin arreglar.

**La regla:** una función escrita para UN momento trae las decisiones de ese momento adentro
de sus `ok`. Antes de reusarla para otra pregunta, leé cada rama que devuelve `ok: true` y
preguntá qué probó.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## Un link a /integraciones: el parámetro es `?abrir=`, y sin `?ws=` puede abrir otro workspace

**Vive en:** `app/integraciones/IntegracionesBoard.tsx:186-210` · `lib/ws-tab.ts:51-61`
(`conWs`) · `lib/api-mako/areas/integraciones.run.ts:50` (`linkIntegracion`)

### El modal se abre con `?abrir=<key>`, y un key que no está no abre nada

⚠️ **Corregido el 25/10/2026: `?servicio=<key>` SÍ abre el modal** (el efecto de `servicio` del board; ver «Los links
a cada conexión», arriba). Lo que sigue vale para `?abrir=`, que es el contrato. El inventario de la API decía
`/integraciones?servicio=<key>`. Se creyó que ese link abría la página y ningún modal, sin error: `IntegracionesBoard` lee `searchParams.get('abrir')` (`:195`) y
además **ignora en silencio** todo key que no esté entre sus integraciones visibles ni en
`SYNTHETIC` (`:199`). Un link bien formado a un servicio que ese workspace no ve —por capa, o
por `soloPlataforma`— aterriza igual frente a la grilla.

**Regla:** el link es `/integraciones?abrir=<key>`, y el key se valida contra `defsVisibles`
con la capa de ese workspace ANTES de mandarlo; si no, el aviso promete un modal que no se abre.

### Un link absoluto sin `?ws=` abre el workspace de la cookie

Para quien administra varios (la agencia), un link a /integraciones sin `?ws=` abre el
workspace que tenga en la cookie. En esta pantalla eso no es mirar otra cuenta: es **pegar la
credencial de un cliente en la fila de otro**. Un link que sale por un chat no pasa por
ninguna de las cuatro formas de navegar de AGENTS.md, así que nadie le pega el `?ws=`.

⚠️ Y `conWs` no lo arregla tal cual: devuelve intacto todo href que no empiece con `/`
(`lib/ws-tab.ts:54`), así que sobre un link ya absoluto (`${APP_BASE_URL}/integraciones?…`) no
hace nada. Hoy ningún link de `lib/api-mako` lleva el `?ws=`. Lo que quedó SIN hacer: armar el
path relativo con `conWs` y recién después anteponerle la base.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## La lógica de credenciales vive adentro de la ruta, así que un segundo consumidor la tiene que copiar

**Vive en:** `app/api/integraciones/credencial/route.ts` (`envDelContexto` `:155`,
`servicioDelContexto` `:161`, la rama `elegir` `:395-441`, `borrar` `:443-451`) ·
`lib/metodo-catalogo.ts:933` (`servicioMetodo`) · `lib/api-mako/areas/integraciones.helpers.ts`
(`servicioDelWs`)

El guard de plataforma es un choke point bien puesto (ver
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «el guard cubría 4 de 6 caminos») — pero
es el choke point **de esa ruta**. `servicioDelContexto` y `envDelContexto` son funciones
privadas del `route.ts`; lo que está exportado es `servicioMetodo`, el accessor CRUDO, que le
devuelve la ficha de GitHub (`soloPlataforma`) a cualquiera.

El 16/09/2026 la API de MaKo necesitó la misma pregunta y no tuvo de dónde importarla:
quedó copiada en `integraciones.helpers.ts` (`servicioDelWs`: `soloPlataforma` y el ws no es
el de `wsSuperAdmin()` → no existe). Dos copias de un guard de seguridad es «una cosa, un
lugar» sin cumplir, y la segunda se queda vieja el día que la primera gane un caso.

Es también por qué la API **no** escribe credenciales:

- **Borrar:** el guard (`envDelContexto`) y la llamada a `auditarCredencial` están escritos
  adentro de la rama `borrar`.
- **Elegir cuenta, página o píxel de Meta:** la rama `elegir` son ~45 líneas inline que le
  vuelven a pedir el token de página a Meta (`descubrirMeta`, que además trae los page tokens
  y el titular) y escriben identificadores de ruteo que otro workspace puede tener reclamados
  (`IdentificadorOcupadoError`).
- **Desconectar Google Calendar** es borrar el refresh token, y volver atrás exige el OAuth
  del dueño de esa agenda: no se deshace desde un chat.

**Lo que quedó SIN hacer:** mudar `servicioDelContexto`, `envDelContexto` y las ramas
`guardar`, `elegir` y `borrar` a un `lib/integraciones-credencial.ts` que usen la ruta y la
API. El día que exista, `servicioDelWs` se borra.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## «El cliente conecta Calendly, no entra nada y no hay ningún error» (01/10/2026, arreglado el 04/10)

Martín, en la llamada del 01/10 (00:50:03): *«Calendly: el cliente conecta, no entra nada y
no hay ningún error. No sé por qué, como no uso Calendly. Esto yo creo que lo que pasa es
que está configurado el Calendly de Mauricio y los clientes conectan el suyo y no pasa
nada»*.

**Su hipótesis era la equivocada, y la causa estaba escrita en el propio webhook.**

Un webhook entrante llega SIN sesión, así que lo único que dice de quién es el evento es la
tabla `webhook_routing` (mig 0090), y esa fila la escribe el guardado de **una credencial**:
las de `ROUTING_CREDS` (`lib/webhook-routing.ts`). Para Calendly son
`CALENDLY_EVENT_TYPE_J1` y `_J2`… y las dos estaban declaradas **`opcional: true`** en
`lib/metodo-catalogo.ts`. El único campo obligatorio era el token.

O sea: conectar Calendly «bien» —token y signing key— dejaba al cliente con **cero filas de
ruteo**, y el webhook es fail-CLOSED a propósito (sin mapeo no se toca un solo dato, para
que la reserva de un cliente no caiga en el CRM del dueño). Resultado: 200, un
`console.warn` que no lee nadie, y ninguna reserva en el CRM.

**Medido contra producción el 04/10/2026:** de los 2 workspaces con Calendly conectado,
**uno (el ws 4) tenía token y signing key y CERO filas de ruteo**. El script quedó en
`scripts/probe-calendly-sin-ruteo.ts`.

Y no hay red por otro lado: **no existe ningún cron que ingiera la agenda**. Con el token,
MaKo COMPLETA las fechas de un lead que ya existe (`lib/auto-reuniones.ts`, al mover una
tarjeta del CRM) y RESERVA (`lib/calendly-agenda.ts`). Lo que crea el contacto a partir de
una reserva es el webhook y nada más — así que la ayuda de la signing key, que decía «deja
el campo vacío, tus reuniones igual entran porque MaKo lee tu agenda con el Personal access
token», prometía algo que no pasa. Era el mismo malentendido por la otra puerta.

### Lo que quedó

- `CALENDLY_EVENT_TYPE_J1` y `CALCOM_EVENT_TYPE_J1` dejaron de ser opcionales, y su nota
  dice qué se pierde: *«sin esto, las reuniones que agende tu gente no entran a tu CRM y no
  vas a ver ningún error»*. El `_J2` sigue opcional, que es lo correcto: sólo hace falta si
  la segunda reunión va por otro link. Es el MISMO precedente que `FATHOM_HOST_EMAIL`, que
  dejó de ser opcional por esto mismo y lo dice en su comentario; estos dos se habían
  quedado atrás.
- **La regla, en positivo y con guard**: cada servicio de `ROUTING_CREDS` tiene al menos una
  clave que el cliente no puede dejar vacía — obligatoria, o `auto` (la completa MaKo, como
  `META_PAGE_ID` al pegar el token). `tests/webhook-ruteo-obligatorio.test.ts`.

⚠️ **Y esto no arregla al ws 4**, por la regla de siempre: una regla que se aplica AL
ESCRIBIR no toca una fila ya escrita. Lo que sí cambia es que su Calendly deja de contar
como «conectado» (`calcConectada` exige los no-opcionales), así que la pantalla pasa a
mostrar el campo en «pendiente» en vez de un verde que miente. El dato lo tiene que poner
ese cliente: es el nombre de SU event type.

⚠️ **Y la excepción de `auto` no es un detalle del guard: es la mitad que lo hace usable.**
`META_PAGE_ID` ES `opcional: true` y está bien así, porque lo completa MaKo al pegar el
token. Sin esa excepción el guard habría pedido hacer obligatorio un campo que el cliente no
tiene de dónde sacar — que es exactamente el candado sin llave que la casa prohíbe.

**Vive en:** `lib/metodo-catalogo.ts` (Calendly y Cal.com) · `lib/webhook-routing.ts` → `ROUTING_CREDS` · *2026-10-04*

## `opcional: true` no es un rótulo: lo cuentan tres lectores y mueve pantallas enteras (04/10/2026)

Sacarle `opcional: true` a un campo del catálogo de integraciones parece un cambio de validación
de un formulario. No lo es: la bandera la leen `integracionConectada`
(`lib/credenciales.ts:227-230`), `calcConectada` (`app/integraciones/ServicioConfigForm.tsx:96-98`)
y `app/api/metodo/route.ts:28`, **los tres exigiendo que estén TODOS los requeridos** para
contestar «conectado».

Medido: al volver obligatorio el tipo de evento de la R1, el ws 4 pasó de «Calendly conectado» a
**no conectado**, sin que nadie tocara una credencial y sin un solo error. Para esa persona la
integración se desconectó sola.

**Antes de sacarle `opcional: true` a un campo, grepeá quién cuenta los requeridos y corré la lista
de workspaces para ver quién cambia de lado.** Es la misma familia que «un campo nuevo son SEIS
lugares», del lado de la CONDICIÓN en vez del dato — y acá el cambio es correcto y hay que hacerlo
igual: lo que no puede pasar es que nadie sepa a quién le cambió la pantalla.

**Vive en:** `lib/metodo-catalogo.ts` · `lib/credenciales.ts:218-231` · `app/integraciones/ServicioConfigForm.tsx:96-98` · *2026-10-04 arreglar-crm*

## Un aviso de «esto está a medias» cuelga de la INTEGRACIÓN, no de la tab (04/10/2026)

El panel de activación del CRM se dibuja con un OR sobre tres fuentes
(`!calendly && !calcom && !meta`, `app/crm/page.tsx:51-59`), así que **una integración a medias
queda tapada por cualquier otra que esté entera**.

Medido: el ws 4 tiene Meta conectado y Calendly a medias —token sí, tipo de evento no, cero filas
de ruteo— o sea que es exactamente el workspace al que se le están tirando reservas, y el único al
que la pantalla no le puede avisar. El OR lo da por cubierto.

**Un gate que decide si se ve una pantalla de datos se pregunta por los DATOS además de por la
configuración**, y el aviso de una integración incompleta vive en esa integración: una tab con
otra fuente conectada no tiene cómo contarlo.

**Vive en:** `app/crm/page.tsx:51-59` · `lib/tab-activacion.ts` · *2026-10-04 arreglar-crm*

## Un encargo con archivo:línea es una FOTO FECHADA, no el estado del árbol (04/10/2026)

El encargo medía, con archivo y línea del 03/10, que los dos campos de tipo de evento de Calendly
seguían `opcional: true`. En HEAD, uno ya era obligatorio: el commit `1a0c13cf` entró el 04/10, un
día después de la medición.

**Se relee HEAD y se corre `git log --oneline -5 -- <archivo>` antes de escribir una línea.** Y
cuando el arreglo ya está, lo que suele quedar son los TEXTOS que ese arreglo dejó viejos —tres
tutoriales y una nota que seguían describiendo el campo como opcional—, que es trabajo real y que
ningún compilador reclama.

**Vive en:** `lib/metodo-catalogo.ts:828-861` · *2026-10-04 arreglar-crm*

## Retirar el CONSUMIDOR de una integración no es retirar la integración: Whop (06/10/2026)

**Vive en:** `lib/integraciones-catalogo.ts`, `lib/metodo-catalogo.ts`, `lib/metodo-verificar.ts`,
`app/_components/ServicioVisual.tsx`, `tests/sin-whop.test.ts`.

Diez días después de que el 26/09 (`07d07139`) saliera el programa de Mauricio con su webhook, su
sync y su mapa de lecciones, la tarjeta de Whop seguía en `/integraciones` para TODOS los
clientes: se podía conectar, el tilde se ponía verde con el nombre del negocio, y el tutorial
mandaba pegar `{{APP_URL}}/api/webhooks/whop`, que daba 404. Se había ido lo que la USABA y había
quedado la integración: los tres registros, el logo, sus `AYUDA_CAMPO` y una lib sin call sites.

- **Retirar una integración son siete cosas**: la tarjeta, los campos, el ping, el logo, sus
  `AYUDA_CAMPO`, su lib, y un guard `tests/sin-<x>.test.ts` que falle si vuelve.
- **Lo que dejó escrito en la base no lo limpia ningún camino del producto**: `webhook_routing` se
  borra sólo al borrar una credencial de `ROUTING_CREDS`, y Whop nunca estuvo ahí (el ruteo lo
  escribía su lib al derivar el company id). Su fila del ws1 queda, inerte, hasta que alguien la
  borre a mano. Las 4 credenciales (ws1 y ws4) también: son dato del cliente.
- La categoría «Contenido» quedó sin tarjetas; se sigue nombrando en `CAT_ORDER` y en
  `lib/capas.ts`, y es inofensivo porque el tablero filtra las categorías vacías.

## El remitente de Resend: «opcional» para abrir la tab, obligatorio para que salga algo (09/10/2026)

**Vive en:** `lib/metodo-catalogo.ts` (`CampoCredencial.sinEsto`, el `RESEND_FROM`) ·
`app/integraciones/ServicioConfigForm.tsx` (`semaforo`, `PasosAyuda`) · `lib/integraciones.ts` (la rama de
email) · `lib/resend-remitente.ts` (`problemaDelRemitente`) · `lib/metodo-verificar.ts` (el ping `email`) ·
`app/api/integraciones/credencial/route.ts` · `tests/resend-remitente.test.ts`

Punto 15 del audio de Customer Success (08/10, Leandro probando el curso): con su key de Resend puesta los
correos no salían. «Resend en teoría está conectado… el problema es que me faltaba un campo… falta
remitente, y lo raro es que dice que es opcional». El formulario lo marcaba «opcional», la tarjeta decía
«Conectada», y el tutorial afirmaba que «si lo dejas vacío MaKo usa uno por defecto». Ese default es
`onboarding@resend.dev`, que con una key PROPIA sólo le entrega al dueño de la cuenta de Resend: nadie
más recibe nada. Medido el 09/10: el ws4 tiene su key y ningún remitente.

⚠️ **El arreglo obvio —marcarlo obligatorio— rompía otra cosa.** `opcional` es la entrada que ya tiene
escrita «no es un rótulo» (04/10, arriba): lo leen los tres lectores de «conectado», y uno de ellos es la
puerta de `/email` (`integracionConectada('email')` → `PanelActivacion`). La tab se abre con la key sola
porque ES donde se verifica el dominio desde MaKo. Obligatorio, el remitente dejaba esa tab detrás de la
activación justo a quien tiene que entrar a verificar para poder escribir el remitente: un huevo y una
gallina. **Son dos preguntas —«¿se puede abrir?» y «¿sale algo?»— y cada una va en su campo**: `opcional`
sigue contestando la primera y `sinEsto` (una frase: qué no anda sin él) la segunda. El campo se pinta
«falta» en ámbar, la tarjeta de Email pasa a «Por configurar» con el motivo (sólo si el remitente que se
va a usar es el sandbox, leído con `remitenteEsSandbox`, que mira también el setting de `/email`), y el
paso del tutorial que mentía dice lo que pasa.

Y el remitente que se escribe tiene que servir: el ping de Email ya traía los dominios de la cuenta para
el detalle, así que juzga ahí el remitente antes de guardar (correo inválido, el sandbox, un dominio que
no está en ESA cuenta o que Resend declara sin verificar). **Generoso a propósito**: frenar uno que anda
es peor que dejar pasar uno que no (el segundo es lo de antes); por eso acepta un subdominio del
verificado y los estados que Resend no declara rotos.

## La ayuda de un campo: el link arriba, «Cómo configurarlo» con rótulo, la nota adentro (09/10/2026)

**Vive en:** `app/integraciones/ServicioConfigForm.tsx` (`PasosAyuda`, el bloque de cada campo) ·
`tests/resend-remitente.test.ts` (los dos tests del punto 13)

Punto 13 del mismo audio: «el link para sacar la key, ARRIBA del todo»; el «?» dentro del campo «pasa
desapercibido»; el texto gris de debajo del campo «no lo va a leer nadie»; y un «Cómo configurarlo»
visible debajo del campo que al abrirse dé el link directo a la página de keys.

- El link del proveedor va primero, como botón, y después los pasos.
- El «?» de la barra se fue: la ayuda es un «Cómo configurarlo ⌄» con rótulo, debajo del campo, sólo
  mientras la credencial no está guardada. Es la misma lección que el «Guardar» con rótulo que ya está en
  ese archivo: un ícono hay que ir a buscarlo, y sólo lo busca quien ya sabe que ahí hay algo.
- ⚠️ **La nota no se borró: se mudó adentro de la ayuda.** Algunas dicen algo que los pasos no dicen («Lo
  completa MaKo», «con el prefijo act_»); borrarla por «no la lee nadie» habría perdido esas.

**Vale para TODAS las integraciones**, no sólo Resend: es el formulario común. Y Customer Success monta
este mismo formulario adentro del aviso del invitar del curso, así que allá cambia igual.

**Lo que quedó sin hacer:**
- **Verlo con clics en producción** (ws3) después del deploy: los tests fijan la forma del código, no cómo
  se ve.
- **El punto 14 (conectar el correo con Google/Gmail, como el QR del WhatsApp)**: espera la verificación
  de la app OAuth de Google, que sigue trabada (falta que Martín entre con martinkoncke@gmail.com en el
  Chrome conectado).

_09/10/2026 — sin subagentes; `tests/resend-remitente.test.ts` probado con 7 roturas (1 fallo cada una,
2 la del juez). Typecheck 0; npm test 6339/0._

## Stripe y Mercado Pago como integraciones (11/10/2026, la pasarela de pagos)

El modelo entero de la pasarela vive en [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md) →
«La pasarela». Acá, lo que es de la tab y de las credenciales.

### El molde de Meta era el diagnóstico equivocado: guarda la clave SIN probarla

**Síntoma (evitado):** una clave de Stripe rota quedaba guardada con un mensaje que decía «Guardada».
**Causa:** `guardarCampo` (`ServicioConfigForm.tsx`) cuenta los campos `auto` obligatorios como
faltantes y, si falta alguno, guarda sin probar. Meta lo tapa porque su descubrimiento corre al toque y
pisa el mensaje, pero su token también queda guardado sin probar. **Regla:** si los obligatorios de una
integración se DERIVAN de una clave, la clave va directo al descubrimiento (`descubrir-pago`), que le
pregunta al proveedor primero y guarda TODO junto sólo si la acepta. Meta tiene el mismo agujero y no se
tocó. **Vive en:** `app/integraciones/ServicioConfigForm.tsx` · `lib/cobros-conexion.ts`.

### El ruteo de un webhook sólo se AGREGA: cambiar de cuenta deja la vieja reclamada

**Causa:** `guardarCredencial` sólo agrega filas a `webhook_routing`, y `borrarRoutingDeWs` se lleva
TODAS las del servicio. **Regla:** quien reemplaza un identificador de ruteo suelta el anterior con
`soltarIdentificador(servicio, id, ws)`. Afecta también a `META_PAGE_ID` (no se tocó).
**Vive en:** `lib/webhook-routing.ts` · `lib/cobros-conexion.ts`.

### Quitar la R2 de Calendly se llevaba el ruteo de la R1 (16/10/2026)

**Síntoma (latente, encontrado leyendo, no reportado):** un negocio borra en Integraciones el «Tipo de
evento de R2» y desde ese momento sus reservas de la R1 contestan 200 «sin_ruteo» y no entran al CRM.
El diagnóstico obvio —«la R1 está mal cargada» o «Calendly no manda»— es el equivocado: la R1 está bien.
**Causa:** `eliminarCredencial` llama a `borrarRoutingDeWs(servicio, ws)`, que borra TODAS las filas de
`calendly` (o `calcom`) de ese workspace, y la agenda tiene DOS credenciales en el mismo servicio (y
desde la mig 0293, los eventos vinculados a una etapa). La de la R1 se iba con la de la R2.
**Arreglo:** después de borrar, `reclamarRuteoDeAgenda` (lib/agenda-evento-etapa-server.ts) vuelve a
reclamar lo que se sigue usando (la otra credencial y los vinculados); si no puede leer qué se usa, no
reclama nada y lo dice en el log. **Regla:** un servicio de `ROUTING_CREDS` con más de una fuente de
identificadores no puede usar el borrado por servicio sin volver a reclamar; y para soltar UNO se usa
`soltarIdentificador` después de preguntar si alguien más lo usa.
**Y el ruteo compara EXACTO** (sólo los emails bajan a minúsculas), mientras `clasificarJunta` es
tolerante: la R1 cargada con otra mayúscula clasifica y no rutea. Medido en producción el 16/10/2026:
las únicas filas de agenda son las 2 de Calendly del ws1 (nombres con mayúscula, como en Calendly) y las
2 de Cal.com del ws13 (slugs): hoy no muerde a nadie.
**Vive en:** `lib/credenciales.ts` (`eliminarCredencial`) · `lib/webhook-routing.ts` ·
`lib/agenda-evento-etapa-server.ts` · `tests/agenda-evento-etapa.test.ts`.

### Reclamar el id de la cuenta ANTES de guardar la clave

Así, si la cuenta ya es de otro workspace, contesta 409 y no guarda nada — y de paso impide que un
cliente pegue como suya la clave de cobro de MaKo, sin una lista aparte (siempre que la plataforma la haya
conectado primero). Los tres ids derivados (`STRIPE_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`,
`MERCADOPAGO_USER_ID`) llevan `derivado: true` en el catálogo y las dos rutas de guardar los descartan: un
`acct_` tipeado a mano secuestraría los avisos de otro negocio.
**Vive en:** `lib/cobros-conexion.ts` · `lib/metodo-catalogo.ts` · `app/api/integraciones/credencial/route.ts` · `app/api/metodo/route.ts`.

### La clave del aviso de Mercado Pago sólo existe en su panel

No hay API para leerla, las suscripciones sólo avisan por la URL del panel (crear una suscripción no
acepta URL de aviso) y los pagos de prueba también. Por eso es opcional con un `sinEsto` que dice qué se
pierde: si no está, casi seguro el paso del panel no se hizo. El aviso de Stripe, en cambio, lo registra
MaKo solo (y su `whsec_` vuelve SÓLO al crearlo: si ya hay uno nuestro, se borra y se crea otro).
**Vive en:** `lib/metodo-catalogo.ts` · `lib/stripe-api.ts` (`asegurarWebhookStripe`).

_11/10/2026 — pasarela de pagos; `tests/cobros-conexion.test.ts` (7, probado con 5 roturas) y
`tests/pasarela-sin-env.test.ts`._

### Quitar la clave de una pasarela no la desconectaba (15/10/2026)

**Síntoma (revisión del 11/10):** el negocio quita su clave de Stripe en /integraciones y la tarjeta se
apaga, pero la cuenta sigue reclamada: al conectarla en otro workspace sale «quítala de ahí primero», y
desde la pantalla no hay cómo (los derivados no se ven). En su cuenta de Stripe queda el aviso de MaKo
apuntando a un MaKo que ya no lo acepta: Stripe reintenta tres días y le manda mails de fallo.
**Causa:** la acción `borrar` borra UN campo. Los derivados (`STRIPE_ACCOUNT_ID`, la firma, el
`MERCADOPAGO_USER_ID`) se escriben solos al conectar y nadie los borraba; y el ruteo se va sólo cuando se
borra el campo que está en `ROUTING_CREDS` (el id de la cuenta), no la clave.
**Regla:** una credencial con derivados se desconecta ENTERA (`desconectarPasarela`): lo que MaKo registró
AFUERA (el aviso en Stripe) se saca primero, con la clave todavía guardada —después no hay con qué—; si
eso falla, se desconecta igual y se le dice dónde borrarlo. Cada campo se borra aunque no se pueda leer: una
fila que no descifra o un ruteo sin su fila también atan la cuenta. En Mercado Pago el aviso vive en SU
panel y sólo se le puede decir.
**La trampa del aviso:** buscar el nuestro por la URL EXACTA deja vivos los de un dominio viejo (cada mudanza
de dominio suma uno muerto en la cuenta de cada negocio). Se reconoce por el camino y la cuenta
(`/api/webhooks/stripe?acct=…`) más `metadata.mako = '1'`; sin la metadata se llevaría el de otro sistema
que use el mismo camino.
**Vive en:** `lib/cobros-conexion.ts` (`desconectarPasarela`, `CAMPOS_PASARELA`) · `lib/stripe-api.ts`
(`avisosNuestros`, `borrarWebhooksStripe`) · acción `borrar` de `app/api/integraciones/credencial/route.ts` ·
`tests/cobros-conexion.test.ts` · `tests/stripe-api.test.ts`.

### Prohibir el lector no alcanza: la hidratación ESCRIBÍA las claves de cobro en process.env (15/10/2026)

**Síntoma (revisión del 11/10):** había un barrido que prohíbe leer `STRIPE_*`/`MERCADOPAGO_*` de
`process.env`, `envCred` o `credWs`, y aun así las claves de cobro del ws1 (Mauricio, un CLIENTE)
quedaban en el entorno de cada proceso.
**Causa:** `aplicarAEnv` (el boot y cada `guardarCredencial` del ws1) refleja al entorno TODO lo del ws1. El
barrido miraba a quien lee, no a quien escribe: cualquier `credWs`/`credWsEstricta` de otro camino, o el
«ojito» de `revelar` (que leía con `credWs`), caía en ellas.
**Regla:** una clave que es sólo por workspace se corta en la ESCRITURA al entorno (`CLAVES_DE_PASARELA` en
`aplicarAEnv`), además de en los lectores. Y lo que se revela de una pasarela se lee con `credDelCliente`.
**Vive en:** `lib/credenciales.ts` (`CLAVES_DE_PASARELA`, `esClaveDePasarela`) · `tests/cobros-conexion.test.ts`
(caso 12 del hijo: conecta y bootea el ws1 y mira `process.env`).

## Los tutoriales de conexión: el guard estaba ciego, y un tutorial son 3 a 5 pasos (12/10/2026)

**Síntoma** (Martín, la prueba con Fiesta Music): «los tutoriales para conectar APIs están muy largos». Medido: 55
tutoriales con 648 pasos. El de Meta tenía 29 pasos, y 41 de sus 46 notas pasaban de 120 caracteres (la más larga, 393).

### El guard que debía frenarlo leía cero líneas

`tests/tutoriales-legibles.test.ts` («cada paso hace UNA cosa») buscaba los pasos con `^ {6}'`, y los pasos están a 8
espacios. Además miraba sólo los servicios, nunca `AYUDA_CAMPO`. Leía 0 líneas y pasaba en verde. Con el extractor
corregido, sobre el catálogo viejo marcaba 6 pasos de Meta con 3 o 4 verbos (el relevo había medido 2: miraba sólo los
servicios).

**La regla:** todo extractor de un guard lleva un PISO (`assert.ok(leidos.length > N)`), así falla si lee cero. Y un
guard nuevo se prueba también sobre el texto VIEJO: si lo deja pasar, no mide nada.

### El formato

La regla vive en [AGENTS.md](../AGENTS.md), junto a «La regla del tutorial de un campo». Lo que no dice ahí:
- Las explicaciones se fueron a propósito: qué es una API key o un webhook, los planes gratis de Resend y OpenRouter, el
  portugués de Panda y los menús en inglés de Google.
- Las trampas quedaron DENTRO del paso: «se ve UNA vez», «Nunca», «Full access», `rk_live_`, `APP_USR-`, «Public Key no
  sirve», «NO COMERCIAL» y «Never expires».
- Se borró `AYUDA_CAMPO.META_ACCESS_TOKEN`, que repetía el tutorial del servicio paso por paso: su «?» cae al tutorial.
- Quedaron 54 tutoriales con 250 pasos.

### Una mentira que el acortado destapó

El tutorial de Cal.com decía «Opcional — "Tipo de evento de R1"», y el campo es OBLIGATORIO: rutea el webhook. Es el
mismo error que tuvo Calendly el 04/10, y su guard (`tests/calendly-sin-tipos.test.ts`) mira sólo Calendly. Quedó
corregido en el texto, sin guard.

**Lo que quedó SIN hacer:**
- Martín mira Meta, Resend, Cal.com y Fathom antes del push. Lo que se cayó al acortar: en Meta, «tienes que ser
  administrador del portafolio comercial»; en Stripe, «la verificación que te pide» y `rk_test_`; en Fathom, «External
  Recordings»; en Calendly, los planes pagos.
- ~~El guard de «opcional» para `calcom`~~ y ~~lo sin medir~~: cerrados el 13/10, abajo.

### 13/10/2026: el guard de «opcional», para TODOS los servicios, y lo que nadie medía

**El guard de Calendly no se copió a Cal.com: se generalizó.** `tests/tutorial-opcional.test.ts` recorre los 19
servicios y exige que todo paso que diga «opcional» NOMBRE su campo entre comillas, y que ese campo tenga
`opcional: true`. Una regla aplicada en un servicio de dos estaba documentada, no implementada: copiarla a un tercero
dejaba el cuarto igual. Tres falsos positivos que hubo que separar antes de que diera verde sobre el catálogo sano:

- **El último servicio se comía `AYUDA_CAMPO`**: sin el tope en `\n];`, el bloque de Mercado Pago seguía hasta el final
  del archivo y le atribuía las ayudas de todos los campos.
- **«"API key 2"» no es un campo del catálogo**: la casilla de una cuenta extra la agrega el código (`cuentasExtra`).
  Un nombre que termina en número se da por nombrado.
- **«"OAuth"» nombra los TRES campos OAuth de YouTube**: se cuenta por prefijo (`OAuth Client ID`, `… secret`, `…
  Refresh token`), y los tres son opcionales.

Lo que el guard NO ve: un «opcional» escrito como «no hace falta» o «puedes dejarlo vacío». Mira la palabra.

**Lo que nadie medía.** El recuadro amarillo del paso externo y las slides del panel negro se dibujan igual que los
pasos, y el 12/10 sólo se midieron los pasos. Medido el 13/10, con el mismo tope de 120:

| Texto | Leídos | De más de 120 |
|---|---|---|
| `pasoExterno.porque` | 3 | 2 (Fathom 154, Cal.com 126) |
| `pasoExterno.donde` | 3 | 2 (Fathom 123, Mercado Pago 145) |
| `sinEsto` | 3 | 0 |
| `SLIDES` (`lib/servicio-slides.ts`, no `IntegracionesBoard.tsx`) | 45 | 9 (la más larga, 179) |

Se condensaron sin sumar nada, y quedaron fijados en `tests/tutoriales-legibles.test.ts` (dos tests nuevos, 7 en total).
Al condensar «Te propone, no decide» se fue también **«deja un borrador con preguntas»**, que era falso: desde el
05/10/2026 el alta no pregunta (`tests/alta-sin-preguntas.test.ts`).

**Lo que quedó SIN hacer:** las slides de `anthropic` (la tarjeta «MaKo IA (Anthropic)») afirman lo contrario del veto
de Claude: «Sin esta llave, MaKo no piensa» y «Tú eliges el modelo: Opus para el análisis pesado, Sonnet para lo
conversacional». Hoy Claude está vetado salvo excepción escrita (`lib/veto-claude.ts`) y MaKo corre en la cascada
gratis. No es un problema de largo —miden menos de 120— sino de lo que afirman, y reescribirlas es decidir qué se le
promete al cliente. Lo mismo, más chico, en la de `openai` («en vez de gastar Claude»).

**Vive en:** `lib/metodo-catalogo.ts` · `lib/servicio-slides.ts` · `tests/tutorial-opcional.test.ts` ·
`tests/tutoriales-legibles.test.ts` · `tests/calendly-sin-tipos.test.ts`.

_13/10/2026 — cierre de lo planificado (cuenta 3 → claude2). `tests/tutorial-opcional.test.ts` probado rompiéndolo con
la base en 0: el «Opcional: en "Tipo de evento de R1"» de vuelta en Cal.com y un «opcional» sin nombrar campo dan 1
fallo cada uno. Los dos tests nuevos de `tutoriales-legibles`: el `donde` de Mercado Pago a 145, el `porque` de Fathom
a 154 y la slide de 179 de vuelta dan 1 fallo cada uno (base 7/0)._

_12/10/2026 — duodécima tanda, paquete «fuera»: `tests/tutoriales-legibles.test.ts`, 6 tests. Con el catálogo viejo, 4
fallos; un paso con 4 verbos, un sexto paso, un paso partido con `+`, una nota de 121, el «Para qué sirve» de vuelta y el
extractor a 6 espacios dan 1 fallo cada uno._

## Conectar sin salir de la tab: la pieza ya existía, y lo que le faltaba no se veía (14/10/2026)

**El pedido** (Martín, textual): «si una persona entra allí y no tiene el google calendar conectado, que salte el modal
que tenemos en integraciones allí mismo... Esto como regla siempre, en todas las tabs, para una integración jamás se
debe salir de la tab». La regla está en AGENTS.md («Para conectar una integración JAMÁS se sale de la tab»).

**El diagnóstico obvio era el equivocado: no hacía falta un modal nuevo.** `ServicioSuelto` (el `ServicioModal` de la
grilla abierto en otra pestaña) existía desde el 12/10 para Zernio en Automations. Lo que faltaba para usarlo en
cualquier tab eran cuatro cosas que no se ven hasta que se monta en otro lado:

1. **El OAuth de Google volvía SIEMPRE a /integraciones.** El callback armaba el destino a mano. Ahora el botón manda
   `?volver=` (la tab, sin el `?ws=`: `volverDeLaPestana`, lib/integracion-en-tab.ts), el paso 1 lo guarda saneado en la
   cookie `gcal_volver` con la MISMA defensa de host que Meta (`volverSeguro`) y el callback vuelve ahí con
   `?gcal=<resultado>` (`destinoGcal`, lib/gcal-estado.ts). La tab que ofrece Google lee esa vuelta (`useVueltaDeGoogle`
   / `VueltaDeGoogle`): con un fallo, reabre el modal con el mensaje de `GCAL_MSG`. Meta ya volvía a la tab (su
   `meta_volver`, desde el 07/10).
2. **`ServicioSuelto` pasaba `gcal={null}`**: abierto suelto, Google decía «Conectar» aunque la agenda estuviera
   conectada a medias, y el chip no podía decir «Falta permiso». Ahora pide el permiso real
   (`getGoogleCalendarStatusAction`) como la grilla.
3. **Montado adentro de otra cosa, un modal sin portal se rompe de tres formas**, y ninguna da error: un
   `position: fixed` bajo un ancestro con `transform` (la animación de un `<Modal>`) se ubica contra ese ancestro; el
   Escape lo contestaba el `<Modal>` de abajo, que no sabía que había otro encima (`ModalShell` no está en la pila); y un
   clic adentro burbujea por el árbol de React hasta el `onClick` de quien lo montó (en la Calificación del CRM, la
   tarjeta abría su sí/no). La capa (`CapaIntegracion`, app/_components/ConectarIntegracion.tsx) va por portal al
   `body`, se anota en la pila como `anidada` y frena la propagación; el botón también.
4. **«No cabe en un modal» no era cierto para Stripe y Mercado Pago.** El CRON de Automations abría /integraciones en una
   ventana emergente con ese porqué; son servicios de `ServicioConfigForm` como cualquier otro y se abren sueltos.

**Lo que NO se abre suelto, y por qué sigue siendo un link:** la landing (el código del Pixel, sus páginas y la prueba)
y el agente de Claude (el token y la skill) necesitan datos que arma el `page.tsx` de /integraciones (`SIN_MODAL_SUELTO`).
Tampoco lo que viaja afuera (un aviso de WhatsApp, un mail: no hay tab) ni «ir a mirar» (el saldo de la IA). La lista
completa, con el porqué de cada archivo, está en `tests/integracion-sin-salir.test.ts` (`QUEDAN`), que barre `app/`.

**Lo que quedó SIN hacer:**

- **General y el Dashboard** los pasó su propia sesión (`abd91fdb`: la acción del día, las alertas del semáforo y
  «Conectar una IA» del AI Analyst). Quedan yendo a la grilla, a propósito, los que no nombran una integración (el
  «Conectar» del semáforo sin fuentes, lo que arman `lib/focus.ts` y `lib/vista-general-modelo.ts`).
  `app/dashboard/NuevaHoja.tsx` (el `TextoConLink` del fallo de la IA) ya abre el modal: `cd88308bb`, medido el 14/10.
  El barrido no lo habría visto, porque el link llega en una variable.
- **Abrir suelta la landing y el agente** pediría mudar su armado del `page.tsx` a una server action como
  `integracionAction`.
- **Las tabs que ofrecen Google y no montan la vuelta** pierden el mensaje si el OAuth falla (el parámetro queda en la
  URL sin leer). Hoy la montan el Calendario y el CRM.

**Vive en:** `app/_components/ConectarIntegracion.tsx` · `app/integraciones/ServicioSuelto.tsx` ·
`app/integraciones/IntegracionesBoard.tsx` (`ServicioModal`, la acción de Google) · `lib/integracion-en-tab.ts` ·
`lib/gcal-estado.ts` · `app/api/integraciones/google-calendar/route.ts` · `app/api/integraciones/google-calendar/callback/route.ts` ·
`tests/integracion-sin-salir.test.ts` · `tests/gcal-estado.test.ts`. *14/10/2026, claude2.*

## Hotmart y Skool: un webhook que sólo trae un SECRETO se rutea por su hash (14/10/2026)

**Vive en:** `lib/ruteo-hash.ts` · `lib/webhook-routing.ts` (`ROUTING_CREDS`) · `lib/credenciales.ts` ·
`app/api/webhooks/hotmart/route.ts` · `app/api/webhooks/skool/route.ts` · `lib/fuentes-leads.ts`

Las primeras fuentes del Leads Scraper (`docs/diseno-leads-scraper.md`). Lo que no se ve leyendo el código:

- **Ni Hotmart ni Skool traen un identificador público de la cuenta.** Stripe trae `?acct=` y Mercado
  Pago un `user_id`; acá lo único que llega es un SECRETO (el `hottok` en `X-HOTMART-HOTTOK`, y la clave
  que el negocio inventa para el Zap de Skool en `X-MaKo-Clave`). La regla de la casa es que un secreto
  no va en claro a `webhook_routing`. La salida fue la de los tokens de la API de MaKo: la fila guarda el
  **sha256** (`identificadorDeRuteo`, aplicado en el guardado de la credencial) y el webhook compara el
  header contra la credencial del workspace en tiempo constante (`igualesSeguro`). Un secreto nuevo que
  rutee va a `RUTEO_POR_HASH`; `tests/fuentes-leads-webhooks.test.ts` falla si el guardado deja de
  hashearlo.
- **El hottok no se puede verificar contra nada** (no abre ninguna API) y la clave de Skool la inventa el
  negocio: el ping dice que está guardado, como el «Secret» de Cal.com. La primera prueba real es el
  primer aviso.
- **La forma del cuerpo de Hotmart salió de un repo público** (`trichains/hotmart-webhooks`, MIT, que
  modela los ejemplos oficiales v2.0.0) y no de un aviso real: el teléfono de una compra viene PARTIDO
  (`checkout_phone` + `checkout_phone_code`, el DDD de Brasil) y el del carrito abandonado ENTERO y con
  el país. Con un comprador de México o Argentina no se sabe si `checkout_phone` trae el código de país:
  **no medido**. Se mira en el «Histórico» del webhook de Hotmart con la primera cuenta que se conecte.
- **Los nombres de las pantallas de Hotmart del tutorial salen de guías en inglés y portugués**, no de la
  pantalla en español. **No medido.**
- **El cuerpo de Skool lo decide el Zap, no Skool**, y los nombres crudos del trigger de Zapier tampoco
  están medidos. El lector busca por el SIGNIFICADO de la clave (email, nombre, «answer»/«respuesta»), y
  una clave que no dice nada (un id, un link, una fecha) no entra como respuesta: llenaría la ficha de
  ruido. Ojo con `email_verified: true`: sin validar el VALOR, tapaba al email de verdad.

### Lo que quedó SIN hacer, con su archivo

- **Una compra de Hotmart no dispara el CRON «Pagos» de Automations.** Se decidió NO llamar a
  `enrolarPorPago` desde `lib/fuentes-leads.ts`: el CRON «Pagos» se apaga si no hay Stripe o Mercado Pago
  conectados (`estadoMedios`, `lib/disparadores-canales.ts`), así que a un negocio que sólo vende por
  Hotmart no le serviría, y a uno que tiene las dos le dispararía automatizaciones pensadas para un cobro
  de MaKo (con la condición «Pagó» en falso: Hotmart no escribe `fecha_primer_pago`). Es trabajo con el
  chat de Automations y el de Pagos.
- ~~Cada fuente entra al funnel DEL NEGOCIO~~ **Hecho el 15/10** (decisión 9, `docs/diseno-leads-scraper.md`
  §7): una compra, un pago pendiente o un carrito de Hotmart entran al funnel que declara la entrada
  «carrito» (`lib/funnel-de-entrada.ts`); con ninguno o varios, al del negocio. Un lead que ya estaba se
  AGREGA a ese funnel. Skool, sin entrada que le corresponda, sigue yendo al del negocio.
- **No hay aviso al equipo** cuando entra un lead por Hotmart o Skool (Meta tiene `lead-formulario-meta`).
  Va como un Evento de MaKo en Automations, no escondido en el webhook.

## Una pestaña que MaKo abre vacía (`about:blank`) es del MISMO ORIGEN que hola-mako.com (14/10/2026)

«Probar» del Pixel (`app/integraciones/ProbarTracking.tsx`) abre la pestaña de la landing en el clic, vacía, para no
perder el gesto (Chrome deja abrir UNA ventana por clic sin permiso de emergentes; docs/hallazgos-editor-landing.md →
«Tanda 6»). **El diagnóstico obvio («es un link a una página de afuera, no pasa nada») era el equivocado:** esa pestaña
hereda el origen de MaKo hasta que navega, así que navegarla con lo que escribió la persona corre un `javascript:…`
como si fuera MaKo (self-XSS). Y era peor: la ventana de la prueba recibe la landing por `?l=`, así que un link armado
podía dejar un `javascript:` a un clic de «Probar». Además «tu-pagina.com» sin esquema se abría RELATIVA a MaKo (un
404 nuestro).

**Regla:** una pestaña que MaKo abre vacía se navega sólo con http(s) validado con `new URL` (sin esquema se asume
https), y se valida ANTES de abrir nada. Vive en `lib/landing-paginas.ts` (`urlParaAbrir`) y `ProbarTracking.tsx`
(`af8a5aca7`).

*15/10/2026, chat «Landing Generator» (`claude1`).*

---

## «Se borra cuando entre la rama X» venció sin que nadie lo viera: el cascarón de Chatwoot (17/10/2026)

**El síntoma**: `lib/chatwoot.ts` seguía en el repo ocho días después de «borrar Chatwoot» (09/10). Su comentario, el test
`tests/sin-chatwoot.test.ts` y dos relevos decían lo mismo: no se borra porque lo importan archivos que la rama `wip/api-acciones-0910` tiene
a medio cambiar.

**El motivo estaba vencido, y nadie lo midió**: esa rama son 2 commits «WIP (sin terminar, NO pushear)» del 09/10 (222 archivos tocados) y la API de
MaKo que sirve está en `main` desde hace días. De los 5 importadores, **3 se quitaron sin conflicto posible** porque eran código muerto:
`app/crm/actions.ts` llamaba a `ensureContactoWhatsapp`, que contestaba `null` siempre (dos llamadas); el paso por el WhatsApp oficial de
`lib/nutricion.ts` ya devolvía el fallo del cascarón; y `lib/meta-templates.ts` sólo usaba `getWabaConfig`, que tiraba. Quedan dos:
`lib/api-mako/areas/whatsapp.helpers.ts` y `whatsapp.run.ts`, que registran **8 operaciones** del WhatsApp oficial (que contestan «no hay canal
oficial» desde el 09/10). Retirarlas cambia el CONTRATO de la API de MaKo (def, rest, docs, snapshot HTTP, tests del editor), y eso es del
chat de la API, no de un pendiente de limpieza.

**La regla**: un «se borra cuando entre la rama X» se vuelve a medir cada vez que alguien lo lee (`git log origin/main..X`, `git diff --stat
origin/main...X`), y la lista de importadores del test se achica por partes: `IMPORTADORES` está hecha para eso.

**Y la columna `crm_etiquetas.chatwoot_label`** (mig 0224): sin lector ni escritor — se midió por grep en app/, lib/, scripts/ y tests/ —, y
`lib/datos-mau.ts` ya la omite al copiar. La migración que la quita (`0314_quitar_crm_etiquetas_chatwoot_label.sql`) está escrita y **sin
aplicar**; el procedimiento está en `docs/relevo/integraciones.md`.

**Vive en:** lib/chatwoot.ts · lib/api-mako/areas/whatsapp.{helpers,run}.ts · tests/sin-chatwoot.test.ts · supabase/migrations/0314_quitar_crm_etiquetas_chatwoot_label.sql

---

## El ws1 no puede tener una IA propia: su fila ES el entorno de la plataforma, y la grilla decía «Conectada» (18/10/2026)

**El síntoma** (tickets #5 y #6): MaKo no le contesta a Mauricio en el chat de la app —«falló la IA (sin proveedor gratis
disponible)»— y su /integraciones dice «Conectada y operativa» en las siete IA.

**Lo medido** (sólo lectura, por huellas, con el `.env.local`): en la fila del ws1, Gemini, OpenAI y Claude son copias de
la plataforma; Groq, Mistral, OpenRouter y Cerebras salen «propias». Pero en producción la cascada no encontró **ninguna**,
y el porqué está en el código: `hidratarCredenciales` copia la fila del ws1 (`OWNER_WS`) a `process.env` en cada arranque
(`aplicarAEnv` pisa lo que hubiera), y `soloLasPropias` (lib/ai-cheap.ts) descarta toda key igual a una del entorno. En
producción, entonces, TODAS las del ws1 son «de la plataforma». La medición local no lo ve: la key del `.env.local` no es
la que usa producción (la trampa de arriba, otra vez).

**El diagnóstico obvio era el equivocado.** «Que Mauricio conecte su IA» NO lo arregla en el ws1: lo que pegue en su fila,
`guardarCredencial` lo pone en `process.env` en el acto, y cada arranque también. Su key pasa a ser LA key de la
plataforma —la red gratis de todos los negocios gastaría su cuenta, o pisaría la nuestra— y su workspace sigue sin una IA
propia. Por eso, en ESE workspace, ni el chat le ofrece «Conectar tu IA» («Ya lo está resolviendo el equipo de MaKo») ni
sus IA en /integraciones tienen formulario (dicen «La configura el equipo de MaKo», fuera de «Requiere tu atención»).

**La guarda no compara con un 1:** `WS_DEL_ENTORNO` / `esElWsDelEntorno` (lib/credenciales.ts) es la MISMA constante con la
que leen `hidratarCredenciales` y `guardarCredencial`. Si la hidratación cambia de fuente, la guarda la sigue sola; un
`ws === OWNER_WS` escrito aparte se habría quedado apuntando al ws1 (lo frena tests/mako-sin-ia.test.ts).

**La grilla** miraba `credWs` («hay algo en la fila, o el entorno si es el ws1»); la cascada pregunta «¿es SUYA?». Ahora
la tarjeta hace la pregunta de la cascada (`iaDelNegocio`: `provsDe` para las baratas, la frontera de `conClaveDelNegocio`
para Claude), y una copia dice «Esa key es la de MaKo, no la tuya», también adentro del modal.

**La regla:** una tarjeta que dice «Conectada» se calcula con la MISMA lectura que usa quien la consume. Dos lecturas de
«¿tiene X?» divergen en silencio, y la que miente es la que mira la persona.

**Y una que no se ve:** el barrido de tests/integracion-sin-salir.test.ts busca el link a /integraciones ESCRITO; un
`<Link href={`/integraciones?abrir=${servicio}`}>` armado con template literal le pasa por al lado (medido rompiéndolo: 5 / 0).

**La separación (18/10/2026, Martín: «Sí: separá el ws1 de las claves de la plataforma (que salgan del ws9 o del entorno)
para que Mauricio pueda conectar su propia IA»).** `wsDelEntorno(clave)` (lib/credenciales.ts) dice de qué workspace sale el
entorno: las de IA (`esClaveDeIA`) de la PLATAFORMA (`wsSuperAdmin()`), el resto todavía del ws1. Lo preguntan la
hidratación (dos fuentes, cada clave sólo de la suya; sin IA legible en la plataforma, un `console.error` fuerte),
`guardarCredencial`/`eliminarCredencial`, el respaldo del entorno de `credWs`/`credWsEstricta`/`estadoCampo`, `envCred`,
`esDeLaPlataforma`, la migración del arranque (que ya no copia IA del entorno a la fila de un negocio: así se sembraron las
copias) y las dos fronteras de Claude (`conClaveDelNegocio`, la tarjeta). La guarda del ws1 queda de baranda
(`esNegocioDelEntorno`) y no se dispara con nadie.

**El orden importa, y por eso la migración corre ANTES del deploy** (scripts/ia-del-ws1-a-la-plataforma.mts, aditiva e
idempotente): en producción las keys de IA del ws1 ERAN las de la plataforma (la hidratación las ponía en el entorno). Si el
código nuevo arrancara sin ellas en la plataforma, las que no coinciden con ninguna del ws9 pasarían a contar como DEL ws1
—datos de sus clientes en cuentas de la agencia—. Copiadas a casilleros libres del ws9, siguen siendo «la de MaKo» en la
fila del ws1 (`soloLasPropias` compara contra las filas de la plataforma) y la plataforma conserva su capacidad.

**Lo que quedó SIN hacer:**
- **La Cerebras del ws1** no coincide con ninguna de la plataforma ni con el `.env.local`, y Cerebras admite una sola cuenta
  (la del ws9 es otra): no se copió. Con el código nuevo cuenta como DEL ws1. Si es de MaKo, hay que sacarla de esa fila
  (decisión; nunca se escribe en el ws1 para probar).
- **Lo que no es IA sigue saliendo del ws1** (Meta, Calendly, Fathom, Resend, Panda, YouTube…): el mismo problema, para otra
  decisión. Y las settings de plataforma que viven en el ws1 (`runWithWorkspace(OWNER_WS, …)`): `mako.modelos`
  (lib/model-registry.ts), `mako.claude.pausa` (lib/anthropic.ts), el canal de MaKo (lib/mako-canal.ts, lib/linea-plataforma.ts),
  los guiones (lib/guion-*-store.ts), lib/copywriting-metodo.ts, lib/mako-grupo.ts y el Plan (lib/plan-*.ts).
- **El gasto de Claude con la key de la plataforma se anota al ws1** (lib/anthropic-usage.ts: `ws === OWNER_WS`), y
  `claudePropio` de la API de MaKo da sí al ws1 por ser el dueño (lib/api-mako/areas/integraciones.run.ts). Contabilidad y
  la vista del modelo: no se tocaron.
- «Datos de Mau» (lib/datos-mau.ts) copia las credenciales del ws1 a un workspace de prueba, IA incluida (copias: siguen
  marcadas). Y otros lugares que le piden una key de IA a un negocio (el onboarding, /metodo) no se revisaron.

**Vive en:** lib/integraciones.ts (`iaDelNegocio`) · lib/ia-keys.ts (`veredictoDeIA`) · lib/credenciales.ts · lib/ai-cheap.ts (`soloLasPropias`) · app/integraciones/IntegracionesBoard.tsx · tests/mako-sin-ia.test.ts

## El número de la URL de Fathom no es el `recording_id` (18/10/2026)

- **Síntoma:** Martín pasó «683162143 y 738834138» para analizar dos llamadas, y `scripts/fathom-a-claude.ts` daba 404 con esos números.
- **Causa:** son el id de la URL de la grabación en Fathom (`fathom.video/calls/<id>`), no el `recording_id` de la API. El chat Debate los resolvió buscando la llamada por esa URL.
- **Regla:** cuando Martín pasa un número de Fathom, primero hay que ver si es de la URL. 683162143 es la del 21/5 y 738834138 la del 8/7, las dos con Mauricio.

## «Under review» no quiere decir que Google esté revisando: la verificación esperaba un mail nuestro (21/10/2026)

- **Síntoma:** la verificación de la app de Google (proyecto `mako-500317`) se envió el 10/10 y a los 11 días seguía
  diciendo «Your app's data access is under review». Parecía que Google tardaba.
- **Causa real:** el 11/10 Google marcó un problema («App functionality: your demo video does not show the OAuth consent
  flow») y mandó un mail a martinkoncke@ pidiendo un video nuevo. Nadie lo contestó. El cartel general no cambia: el
  problema se ve sólo entrando a «View verification progress», ítem por ítem.
- **Por qué el diagnóstico obvio era el equivocado:** «Google está lento» llevaba a esperar o a escribirle a soporte. Lo
  que destraba es contestar ese hilo.
- **La regla:** después de enviar una verificación a Google (o una revisión a Meta), alguien revisa cada dos días el
  progreso ítem por ítem y el correo donde llegan los avisos. Google contesta en un hilo de
  `api-oauth-dev-verification-reply`, y la revisión sigue recién cuando se responde ahí.
- **El video que pide Google** se graba con una cuenta a la que se le borró el acceso a MaKo antes de grabar. Si no,
  Google esconde los permisos detrás de «already has some access». El cómo, y los clics que el clasificador de Claude no
  deja hacer, están en [verificacion-google.md](verificacion-google.md).
- **Lo que quedó SIN hacer (21/10):** subir el video nuevo, crear la cuenta del revisor y contestar el hilo. Le toca a
  Martín.

**Vive en:** docs/verificacion-google.md · lib/google-calendar.ts (`GCAL_SCOPE`) · app/api/integraciones/google-calendar/route.ts

## La vuelta de un OAuth pegaba `?ws=` siempre, y al super admin lo ponía en «vista de cliente» de sí mismo (21/10/2026)

- **Síntoma:** Martín volvió de «Reconectar con Meta» en su propio negocio (ws9) con el cartel «Estás viendo el
  dashboard de Martin Koncke como administrador / SALIR DE LA VISTA», y la barra decía «CLIENTE».
- **Causa:** los callbacks de Meta y de Google Calendar vuelven con `conWs(destino, ws)`, o sea con el negocio destino
  en `?ws=`, SIEMPRE. Para el proxy, cualquier `?ws=` de un admin de plataforma es una pestaña de cliente, aunque sea
  la suya (`estaImpersonando` → `wsDePestana`).
- **Lo que NO es (la sospecha era grave y no se confirma):** a un admin común no le puede pasar. `headersSeguros`
  (proxy.ts) sólo convierte el `?ws=` en pestaña si la sesión firmada es `rol === 'admin'`; para cualquier otro usuario
  es texto decorativo. Ningún cliente se ve «como administrador» de otro por este camino.
- **La regla:** la vuelta lleva `?ws=` sólo si hace falta para caer en ese negocio, o sea cuando el destino NO es al
  que cae la sesión sin pestaña (`wsDeVuelta`, lib/ws-tab.ts). Ese negocio sale de `adminDeWorkspaceActual()`, y NO de
  `getWorkspaceActual()`: el callback no puede leer el negocio de la sesión, porque el negocio donde se ESCRIBE sale de la
  cookie (lo fija tests/meta-login.test.ts, y el primer intento de este arreglo lo rompió). El super admin que conecta
  parado adentro de un cliente sigue volviendo a la pestaña del cliente.
- **Lo que quedó SIN hacer:** los pasos 1 (`app/api/integraciones/meta/route.ts` y `google-calendar/route.ts`) todavía
  pegan el ws en sus salidas de error. Sólo pasa si falla antes de ir a Meta o Google, y en ese caso el pedido casi
  siempre ya venía con la pestaña.

**Vive en:** lib/ws-tab.ts (`wsDeVuelta`) · app/api/integraciones/meta/callback/ · app/api/integraciones/google-calendar/callback/ · tests/ws-vuelta-oauth.test.ts

## La agenda del CRM era lenta: tres APIs en fila, y el usuario de Calendly antes de cada lista (23/10/2026)

- **Síntoma** (Martín, 22/10, en el ws1): «Vincular evento» tarda al abrir, al vincular y al «Conectar Cal».
- **Causa, leída en el código:** `listarEventosDeAgenda` (lib/agenda-evento-etapa-server.ts) esperaba a Calendly, después
  a Cal.com y después a Google: la suma de los tres. `prepararVinculo` vuelve a listar la cuenta para validar. Y
  `listarEventTypes` de Calendly pedía `GET /users/me` antes de cada lista y de cada evento creado: dos viajes en fila.
- **Lo que quedó:** todo a la vez (la base, cada agenda y Google). La lista de cada cuenta se guarda un minuto
  (lib/agenda-cache.ts), y el usuario de cada token, para siempre (no cambia). Crear o editar un evento olvida la lista de
  esa cuenta.
- **La trampa de la llave:** esa lista decide QUÉ se puede vincular (`prepararVinculo`: sólo eventos de SU cuenta, porque
  los identificadores no son secretos). Por eso la llave lleva el negocio y la huella del secreto (nunca el secreto). Con
  la huella, conectar otra cuenta cambia la llave y nunca se ve la lista de la anterior: «Conectar Cal» no borra nada.
- **Lo guardado se copia:** `eventosDelProveedor` le suma a la lista las R1/R2 que la cuenta no devolvió. Sin la copia,
  eso ensuciaba lo guardado y cada lectura sumaba otra vez.
- **El contrato con Cobros** (su fase B, varias cuentas por proveedor, va encima): `eventosDelProveedor(proveedor)` es LA
  unidad de lectura de una cuenta, la llave le suma la cuenta, y Calendly recibe el token por parámetro.

«Volver a leer» del pop-up pide `fresco` (`leer(true)` en app/crm/EventosDeEtapaModal.tsx); abrirlo y «Conectar» no.

**Sin hacer:** sin medir en producción. La caché vive en la memoria de cada instancia.

**Vive en:** lib/agenda-cache.ts · lib/agenda-evento-etapa-server.ts (`eventosDelProveedor`, `listarEventosDeAgenda`,
`olvidarCuentas`) · lib/calendly-agenda.ts (`usuarioUri`) · tests/agenda-velocidad-23-10.test.ts
*23/10/2026, chat «CRM» (claude3).*

## Varias cuentas por pasarela: una cuenta es un SUFIJO, y todo lo que miraba el nombre exacto la dejaba afuera (22/10/2026)

Martín pidió dos cuentas de Stripe, dos de Mercado Pago (y dos de Calendly o Cal). Medido en el ws3: no se podía; hoy
Stripe y MP sí (la agenda es la fase B, con el CRM). El modelo (lib/cuentas-integracion.ts): las claves de una cuenta
llevan un sufijo (`STRIPE_SECRET_KEY__C2`; la principal, sin sufijo, como siempre), su nombre es otra clave
(`STRIPE_ALIAS__C2`) y su id es `stripe:c2`. Lo que mordía, todo callado:

- **Las protecciones por nombre EXACTO dejaban afuera a la segunda cuenta.** `NO_MIGRAR_A_WS`, `CLAVES_DE_PASARELA`
  (`aplicarAEnv`: la clave del ws1 iba a `process.env`) y `ROUTING_CREDS`: `guardarCredencial` guardaba
  `STRIPE_ACCOUNT_ID__C2` SIN reclamar su `acct`, y los avisos de esa cuenta no llegaban a ningún negocio. Ahora todas
  preguntan por `baseDeClave(clave)`.
- **Borrar el id de UNA cuenta cortaba los avisos de TODAS.** `eliminarCredencial` llamaba `borrarRoutingDeWs(servicio,
  ws)`: todas las filas del servicio del negocio. Para Stripe y MP lee el valor antes de borrar y suelta sólo ESE
  (`soltarIdentificador`). Calendly y Cal siguen con el viejo (su R1 y R2 se vuelven a reclamar después).
- **Borrar el id de una cuenta que no descifra la dejaba reclamada para siempre:** el valor se lee antes de borrar para
  soltar SU fila, y una fila ilegible daba null. Ahora se sueltan las filas del servicio que no son de otra cuenta del
  negocio (`soltarRuteoSinCuenta`) — y si el id de alguna otra no se puede leer (estricta: la base caída tira), NO se
  suelta nada: soltar de más corta los avisos de una cuenta que cobra, y a un cliente nadie le re-siembra el ruteo.
- **La tarjeta decía «no conectada» con sólo una cuenta de más** (`integracionConectada` miraba los nombres exactos).
- **El aviso de MP de una cuenta de más no tenía dónde pegarse** (el recuadro amarillo es de la tarjeta de la principal): va
  en su fila, con la acción `aviso` de /api/integraciones/cuentas.
- **La cuenta de un aviso se busca ESTRICTA** (`cuentaDeIdentificador`): con `credDelCliente` sola, la base caída daba
  «de ninguna cuenta», MP releía con la principal, ignoraba el pago con un 200 y no volvía (MP no reintenta un 200).
- **`like` en PostgREST: `*` es el `%`, y `_` también es comodín.** `clavesGuardadasConBase` trae `clave.like.STRIPE_SECRET_KEY*`
  y filtra después por la base exacta: el `like` solo trae de más. tests/_postgrest-de-mentira.ts entiende `or=(…like…)`.
- **Los barridos fijaban la lectura de la principal letra por letra** (`credDelCliente('STRIPE_SECRET_KEY', ws)`): con la
  clave armada por `claveDeCuenta(`, un `credWs(claveDeCuenta('STRIPE_…'))` pasaba tests/pasarela-sin-env.test.ts. Su
  prefijo ahora incluye `claveDeCuenta(`.

**Vive en:** lib/cuentas-integracion.ts (puro) · lib/cuentas-pago-server.ts (`cuentasDePago`, `credStripeDe`, `credMpDe`,
`cuentaDeIdentificador`, `proximaCuentaDe`) · lib/credenciales.ts · lib/cobros-conexion.ts · app/api/integraciones/cuentas ·
app/integraciones/CuentasDePago.tsx · tests/cuentas-pago.test.ts. Lo de la plata, en docs/hallazgos-pagos.md.
**La fase B (Calendly y Cal.com, 23/10/2026)** usa el mismo sufijo (`CALENDLY_API_TOKEN__C2`, `CALCOM_WEBHOOK_SECRET__C2`;
`CLAVES_AGENDA`, lib/cuentas-agenda-server.ts). Lo que mordía:
- **El aviso de la segunda cuenta no verificaba**: los webhooks leían UN secreto por negocio, y la reserva de la otra
  cuenta daba 401 «firma rechazada» (Calendly deshabilita la suscripción después de varios no-2xx). Ahora prueban el
  secreto de cada cuenta (`cuentaQueFirmo`, puro), leídos estrictos (`firmasDeAgenda`).
- **Buscar o cancelar la reunión de un lead con UN token no ve la otra cuenta**, y cancelar con el token equivocado da
  404. `proximaReunionCalendly` busca en todas (`tokensDeAgenda`) y devuelve de cuál es; cancelar usa ese token. Una
  cuenta que no se puede leer TIRA con su nombre.
- Lo que rutea una reserva sigue siendo el TIPO DE EVENTO (R1/R2 o un vínculo de «Asignar evento»), no la cuenta.
- **«Asignar evento» por cuenta** (sobre la agenda rápida del CRM, `eventosDelProveedor` sigue siendo LA unidad de lectura):
  lee cada cuenta en paralelo con su token y su caché (la llave lleva la huella del token, así dos cuentas no comparten
  lista), y cada evento sale con su `cuenta` y `cuentaNombre`; `proveedores` pasa a ser una fila por CUENTA. Crear va a
  la cuenta elegida; EDITAR sin cuenta busca la que TIENE el evento (con el token de otra, Calendly contesta 404).
- **Un test que mockea `credWs` esconde de qué negocio se lee.** tests/calendly-cancelar.test.ts corría
  `proximaReunionCalendly` fuera de todo negocio y pasaba porque `credWs` era de mentira; buscar las cuentas de más
  necesita el negocio (`getWorkspaceActual`), y fuera de un request eso tira «cookies outside a request scope». En
  producción corre siempre dentro de uno (request o flujo con `runWithWorkspace`), así que el test pasó a correr ahí:
  ese error en un hijo es el test sin negocio, no la librería rota.
- **Tres barredoras de todo el repo frenaron la fase A en el tren 18** y no estaban entre mis tests:
  - tests/puente-panel-copy, la guarda de voseo, por un «acá».
  - tests/fuentes-leads-webhooks, que fija la línea del ruteo de lib/credenciales.ts.
  - tests/historico-al-conectar, porque toda puerta nueva que llama a `guardarCredencial` decide si arranca el histórico.
  Las de las cuentas no lo arrancan (ninguno de los cuatro proveedores tiene), y el test ahora tira si uno llega a tenerlo.
  Antes de pasar una punta que toca credenciales o copy, se corren las tres.
**Sin hacer:** la pantalla y la API de «Asignar evento» agrupadas por cuenta y el `cuenta` en crear/editar de la API de
MaKo son del CRM (las firmas ya están); el link de la R1/R2, la anticipación y las herramientas de agenda del doer siguen
con la principal (la R1/R2 es de la principal); no se detecta la misma cuenta de Calendly conectada dos veces (haría falta
guardar su `/users/me`).

## Editar un evento de Calendly o Cal.com por API: lo que se puede y lo que no (22-23/10/2026)

Martín pidió «edición COMPLETA del evento» desde el CRM. Leído en la documentación de cada una el 22 y el 23/10/2026 (sin
probar contra una cuenta real: no hay una de prueba). Desde el 23/10 el pop-up y MaKo editan nombre, duración, descripción,
dónde es la reunión y, en Cal.com, las preguntas que ya existen:

| | Calendly (API v2) | Cal.com (API v2) |
|---|---|---|
| Nombre, duración, descripción, dónde | `PATCH /event_types/{uuid}`: `name`, `duration`, **`description`** (`description_plain` es sólo de la respuesta), `locations` (`kind` + `location`). Sólo eventos uno a uno | `PATCH /event-types/{id}`: `title`, `lengthInMinutes`, `description`, `locations` (`type`: integration, address, link, phone, attendeePhone…) |
| Preguntas | **No se editan** (`custom_questions` es de lectura) | `PATCH /event-types/{id}/booking-fields`, por `slug`: texto, obligatoria, oculta. **Sólo las que existen**: agregar una pide reemplazar la lista entera, que repone las de sistema |
| Disponibilidad | Dos rutas distintas según la fuente (`/event_type_availability_schedules` y `/event_types/{uuid}/availability_schedules/{id}`), sin la forma de una regla | `scheduleId` + `PATCH /schedules/{id}` |
| Límite | 500 por minuto (pago), 50 (gratis) | 120 por minuto |

- **La disponibilidad no se edita desde MaKo:** en las dos, un PATCH reemplaza TODAS las reglas, y en Calendly ni la ruta
  está clara. El pop-up la manda a la cuenta con un link (`editarAllaDe`), en otra pestaña.
- **`locations` reemplaza la lista entera.** Con más de una ubicación (o una que no es de las comunes: Meet, Zoom, llamada,
  en persona, link), el pop-up no deja cambiarla: pisaría las otras (`ubicacionAlla`). MaKo sí, y el «sí» dice que reemplaza.
- **Cal.com versiona cada endpoint aparte con `cal-api-version`, y CAMBIA:** las preguntas piden `2026-06-12`
  (`VERSION_BOOKING_FIELDS_CALCOM`); los tipos de evento se leen y escriben con `2024-06-14` (`VERSION_EVENT_TYPES_CALCOM`;
  su documentación de hoy ya pide `2026-06-12` también para el PATCH), los horarios con `2024-06-11` y las reservas con
  `2024-08-13`. Con la versión equivocada contesta igual, con la forma vieja y sin error.
- **Una falla a medias se dice:** en Cal.com el evento y las preguntas son dos pedidos; si el segundo falla, el error dice
  «Cal.com guardó lo demás, pero no las preguntas».

**Sin hacer:** agregar o borrar preguntas en Cal.com; la disponibilidad desde MaKo; pasar los tipos de evento de Cal.com a
`2026-06-12` (probarlo con una cuenta real antes).

**Vive en:** lib/agenda-evento-detalle.ts (puro: ubicaciones, preguntas, `datosDeDetalle`) · lib/calendly-agenda.ts
(`editarEventTypeCalendly`, `detalleEventTypeCalendly`) · lib/calcom.ts (`editarEventTypeCalcom`, `detalleEventTypeCalcom`,
`editarPreguntasCalcom`) · lib/agenda-evento-etapa-server.ts (`detalleDeEventoDeAgenda`, `editarEventoDeAgenda`) ·
tests/agenda-edicion-completa-23-10.test.ts
*22-23/10/2026, chat «CRM» (claude3).*

## El tope de cuentas del plan: sólo a quien MaKo le cobra el plan, y sólo lo que SUMA una cuenta (23/10/2026)

MaKo Esencial trae «1 cuenta de Stripe o Mercado Pago» y Pro varias (docs/ofertas-mako.md; el número está en
lib/topes-plan.ts, `cobros.cuentas`). Se hace cumplir en lib/tope-cuentas.ts, y la regla pura vive en
lib/tope-cuentas-reglas.ts. Lo que no se ve:
- **La capa no alcanza para saber si hay tope.** El ws1 y los acuerdos a mano también tienen capa `completo`. Primero
  se pregunta si MaKo le cobra el plan por la pasarela (`suscripcionDeMakoDe`). Si no puede leerlo, no frena: el tope
  vende, no protege nada.
- **Hay DOS puertas que suman una cuenta, no una.** «Conectar otra» (/api/integraciones/cuentas) y la tarjeta de la
  pasarela que todavía no estaba (`descubrir-pago` en /api/integraciones/credencial). Si sólo se cierra la primera,
  Esencial conecta Stripe y Mercado Pago por las tarjetas.
- **Cambiarle la clave a la misma cuenta o volver a conectarla no suma.** El tope se mira sólo si `cuentaParaConectar`
  devuelve una cuenta que no estaba. Nunca desconecta nada ni llega a un cobro: un test exige que `topeDeCuentas`
  viva sólo en esas dos puertas.
- Se cuenta por grupo: las de cobro (Stripe y Mercado Pago juntas) y las de agenda (Calendly y Cal juntas).

**Sin hacer:** la principal de Calendly o Cal por la tarjeta genérica (`guardar` de /api/integraciones/credencial) no
mira el tope. Las ofertas sólo hablan de las de cobro. «Pasar a Pro» lleva a `RUTA_CAMBIAR_PLAN` (lib/topes-plan.ts,
/configuraciones/plan), que llega con la rama de la suscripción (`suscripcion-mako-2310`); hasta entonces ningún negocio tiene `suscripcionDeMakoDe`, así que el tope
no se aplica a nadie.

**Vive en:** lib/tope-cuentas.ts · lib/tope-cuentas-reglas.ts · app/api/integraciones/cuentas/route.ts ·
app/api/integraciones/credencial/route.ts (`descubrir-pago`) · app/integraciones/CuentasDePago.tsx ·
tests/tope-cuentas.test.ts.

## «Conectar con Facebook, Instagram o anuncios»: UNA pieza vía Zernio, con la key del negocio y sin respaldo de la plataforma (23/10/2026)

**El pedido** (Martín, vía el Cerebro, 23/10/2026): «Esta bueno que todo eso salga directo en la app... Que ellos conecten su API de Zernio y
luego cuando quieran hacer X cosa que requiera un login, que en MaKo esté el botón de logearse con Facebook, Instagram o lo que haga falta».
Hasta ese día se pegaba la key de Zernio pero **el login de cada red se hacía afuera**: con el ws1 la key se pegó a las 22:43 y la conexión
de anuncios nunca se creó (Ads Manager sacó el link a mano con `GET /v1/connect/facebook/ads`).

**Cómo quedó.** Una pieza para todas las pantallas que necesitan una red: `<ConectarViaZernio red volver onConectado>` / `useConectarViaZernio`
(`app/_components/ConectarViaZernio.tsx`), con lo del servidor en `lib/zernio-conectar.ts` y lo puro en `lib/zernio-redes.ts`. La usan el bloque
«Redes» del modal de Zernio de /integraciones (`ConectarRedes`, una fila por Facebook / Instagram / Anuncios de Meta), Instagram y Messenger
de Automations (`ConectarSocial`) y **Chats** (que antes mandaba la pestaña entera a Zernio y volvía a /automations). **Ads Manager la consumirá**
(`red="metaads"` y `conexionesViaZernio`, con el `accountId` de cada conexión: lo que pide la API de anuncios de Zernio para publicar), pero lo cablea
SU chat: al 23/10 no hay ningún llamador suyo en el repo, y la firma quedó acordada con él. **Copiada de Nango**
(Connect UI + SDK frontend: el modal es de la app y no navega, la ventana del login se abre en el MISMO clic con `window.open('')` y la URL se
asigna después, y la verdad la dice el servidor) y de las trampas de Ayrshare (origen y fuente de cada mensaje, gracia antes de dar un popup por
cancelado, nunca un WebView).

**Y sin respaldo de la plataforma** (Martín: «que cada usuario traiga su API de Zernio»; el Cerebro lo extendió a Automations): la key es SIEMPRE
la del negocio (`credDelClienteEstricta`: su fila, nunca `process.env`, y «no pude leer» tira). **Medido en producción antes (sólo lectura):** el
único workspace que dependía del respaldo era el ws3 (Cliente de Prueba) y no hay ni una conversación ni un envío de Instagram o Messenger en toda
la historia. El ws1 (Mauricio, un cliente) tiene pegada la key de la PLATAFORMA desde las 22:43, para la prueba de anuncios: el Cerebro se la saca
cuando Ads Manager termine; hasta entonces `cfg` lo deja en su modo de siempre (`byok: ws !== OWNER_WS`).

### Lo que se leyó de la API de Zernio (docs.zernio.com, 23/10/2026, por un LECTOR que resume cada página: los nombres de campos pueden venir parafraseados)

- `GET /v1/connect/{plataforma}?profileId&redirect_url` → `{ authUrl, state }`. Al volver agrega `connected=<plataforma>&profileId&accountId&username`, o
  `error=<código>&platform&request_id&stage` (`oauth_denied`, `no_facebook_pages`, `no_pages_granted`, `payment_required`, `meta_ads_authorization_denied`).
  Los parámetros propios se conservan. `redirect_url` tiene que ser absoluta (relativa: 400).
- **Anuncios:** `GET /v1/connect/facebook/ads`. Modo `classic` reutiliza el token de la cuenta de Facebook (`alreadyConnected: true` si ya tiene
  `ads_management`); `loginMode=business` crea una conexión `metaads` independiente (token de un usuario del sistema), pide una página y que quien entre
  sea admin del Business. Ads Manager mide que `business` sirve para publicar.
- **Página, Instagram y cuenta publicitaria se conectan POR SEPARADO** (2 o 3 conexiones) y **cada una cuenta aparte para el cobro**: un login de Facebook NO es una
  cuenta. Precio (leído el 23/10): 1-2 gratis (un crédito de US$12 al mes), 3.ª a 10.ª US$6, 11.ª a 100.ª US$3, desde la 101.ª US$1; desconectar deja de cobrar. La
  tarjeta de Zernio avisa en UNA línea («Zernio te cobra a ti. Cada red cuenta aparte (página, Instagram, anuncios): 2 gratis, desde la 3.ª se paga.»), y el bloque
  «Redes» dice cuántas hay conectadas.
- `GET /v1/accounts?profileId&platform&excludeHidden=true` → cuentas con `_id`, `platform`, `profileId`, `isActive`, `enabled`, `username`, `displayName`,
  `needsReconnection` (en `/accounts/health` se llama `needsReconnect`). Zernio sólo se entera de que un token venció cuando una operación real falla.
- El **402** de conectar por pasarse de 2 cuentas trae `reason: free_tier_exceeded` y el link en `dashboard_url`. Un plan legacy da `403 platform_account_limit`.
- **Lo que Ads Manager SÍ vio de verdad (23/10, con las claves que tienen; el resto del body no se imprimió):** `GET /v1/connect/facebook/ads?profileId&loginMode=business&redirect_url`
  → 200 con `authUrl` (`https://www.facebook.com/v24.0/dialog/oauth?client_id=712341431446535&config_id=1788931715593499&redirect_uri=https://zernio.com/api/v1/connect/meta-ads/callback&response_type=code&…&state=<JWE>`;
  el `state` vence a los 30 min); `GET /v1/accounts` → `{ accounts: [...] }` con `_id`, `platform` y `username`; `GET /v1/profiles` → `{ profiles: [{ _id, name, isDefault }] }`. Con eso el
  envoltorio de `/accounts` y el nombre `authUrl` dejan de ser deducciones. **Los dos links de anuncios que Martín aceptó a mano (el segundo, generado 23:19 UTC y aceptado antes de las 23:49) NO dejaron
  ninguna conexión `metaads` en las 4 claves (medido 23:29):** la causa no se sabe (¿el link vencido?, ¿falta una página?, ¿el callback de Zernio?) y es lo primero que mira la primera conexión real:
  a qué dirección terminó el navegador (`error=…`) lo dice la landing de la ventana.
- La ventana de Meta nombra a Zernio («co-branded, not white-label»): la app de Meta de Zernio es «Social Media Connector» (712341431446535, dato de Ads Manager;
  no figura en su doc).

### El diagnóstico obvio era el equivocado, y las trampas

- **«El link de pago del 402 ya se muestra»: nunca se mostró.** `app/api/zernio/route.ts` leía `billingUrl`, que NO existe en la doc de Zernio (es `dashboard_url`): el
  negocio de la cuenta pausada (ws11, 10/10) veía «pausada» sin su link. `urlDePagoDeZernio` acepta los dos y sólo https (va a un `href`).
- **`credWs` y `credWsEstricta` caen al entorno para el ws1**, que es Mauricio, un cliente, y además «la plataforma» para las claves de entorno (`wsDelEntorno`). «Leer la key
  propia» con cualquiera de las dos le da la cuenta de la casa. La lectura propia es `credDelClienteEstricta`; `credDelCliente` no sirve porque no mira el error de la base
  («no pude leer» se lee «no tiene» y el negocio ve «falta» con la base caída).
- **«Sin claves de la plataforma» no puede ser literal:** `ZERNIO_WEBHOOK_SECRET` (el secreto maestro del que se derivan los de cada negocio) sigue siendo de la casa, y no es una
  cuenta de Zernio.
- **Un popup que se ve «cerrado» NO es «canceló».** Si la red pone `Cross-Origin-Opener-Policy`, el navegador corta el vínculo con la ventana: desde la pantalla se ve cerrada
  (y `window.opener` queda en null en la landing) aunque la persona siga adentro. Dar por cancelada la conexión al ver `closed` la cortaba en el segundo en que se abría el login de Meta.
  Hoy `closed` sólo adelanta una medición y avisa; el aviso de la landing va por `window.opener.postMessage` **y** por un `BroadcastChannel` del mismo origen; y se corta a los ~4 min.
  **Es una deducción de la lectura, no se midió con un login real.**
- **`window.open` en el clic y antes de cualquier `await`, y sin `noopener`** (con él devuelve null y no se puede asignar la URL): lo fija el test con el orden de las líneas.
- **En un teléfono y en el navegador interno de Instagram/Facebook/TikTok no hay popup confiable** (Meta lo dice en su doc): la pestaña navega y VUELVE a la misma pantalla con `?zernio=<red>`;
  el hook lo lee al montar, mide con `/accounts`, y saca esos parámetros de la barra (se procesa una vez aunque haya varios botones). La lista de agentes es una deducción: se mide en un teléfono.
- **«Conectada» sale de lo que lista Zernio AHORA y no estaba ANTES** (`medirConexion`). Tres casos que rompen una versión ingenua: una cuenta ya conectada (con «hay alguna» daba conectado
  en el primer sondeo), volver a entrar con una cuenta que YA estaba (el id no cambia: sólo el `accountId` de la vuelta lo confirma, y siempre contra la lista de ahora) y no poder leer la lista
  de antes (ANTES valía «cualquiera»; ahora NADA de lo que ya estaba cuenta como nuevo: falla cerrado).
- **`volver` es del navegador y termina como `redirect_url` de un tercero:** sólo una RUTA de la app (`validarVolver`: `//evil.com`, `/\evil.com`, `https://…`, `javascript:` y `/api/…` no pasan).
- **El `?ws=` de la vuelta, sólo si hace falta** (`wsDeVuelta`): pegarlo siempre pone a un admin de plataforma en «vista de cliente» de sí mismo (21/10).
- **El sondeo cuenta contra los 60 pedidos por minuto** de un equipo con 0 a 2 cuentas: cada medición es un `GET /accounts` (a 4 s, 15 por minuto); el profile se cachea 2 minutos por negocio y por
  huella de la key (sin eso cada medición hacía un `GET /profiles` y una escritura de ruteo).
- **`conexionesViaZernio` es SOLO LECTURA** y `recibirConexion` (reclamar el ruteo de las cuentas y asegurar el webhook) se llama UNA vez, al quedar conectada una cuenta de Facebook o Instagram: sin eso
  conectar «anda» y no llega ningún mensaje, y no da error. Antes lo hacía el «estado» de la tarjeta, que ahora sigue haciéndolo para la cabecera de Automations.
- **La MISMA key en DOS negocios comparte el profile Default de esa cuenta de Zernio** (con key propia no hay un profile por negocio): el segundo vería las cuentas del primero como suyas, y el
  ruteo de sus mensajes sigue siendo del primero («el primero que reclama gana»; `profileIdEfectivo` descarta el resultado de `upsertRouting`). Lo encontró la revisión adversarial: **el
  filtro por profile de `leerCuentasDeZernio` sólo protege cuando UNA key tiene VARIOS perfiles**, no con una key repetida. Hoy la pieza se NIEGA (`clave-en-uso`) si el profile ya es de otro negocio,
  y `recibirConexion` dice `ocupado` si una cuenta quedó con otro. **SIN HACER:** que `guardarCredencial` rechace una key de Zernio ya guardada por otro negocio, y lo mismo en
  `cuentasConectadas`/«estado» de Automations (el camino viejo sigue sin mirarlo).
- **Un «Volver a conectar» de los anuncios (`force` sobre una conexión que ya anda) no tiene cambio visible:** la cuenta ya estaba sana, así que «una que antes no estaba» no existe, y darla por hecha
  con `reconectarId` cerraba la ventana a los 0,5 s, recién abierta, con «conectado ✓». `reconectarId` sólo confirma una cuenta que ANTES no estaba sana; la sana la confirma la pista (el `accountId` con que vuelve la ventana).
- **La vuelta de página entera sólo vale si ESTA pestaña la inició** (`guardarVuelta` en `sessionStorage`: red, cuentas de antes y hora; 30 minutos): un link armado a mano con `?zernio=…&connected=…` hacía que la pantalla dijera
  «conectado», armara la recepción y le entregara a quien llama (Ads Manager publica con `nueva.accountId`) una cuenta equivocada. Y `connected` de la URL ya no decide: se mide como en la ventana.
- **Un segundo clic NO cierra la ventana del primero:** las corridas comparten la ventana por su nombre y la vieja, al despertar, la cerraba con la nueva ya adentro de Meta. `cerrar()` sólo cierra al desmontar o si la corrida
  sigue siendo la vigente. El aviso de la ventana lleva el id de SU flujo: el canal es del origen entero y un error de una pestaña cortaba el login de otra.
- **`replaceState(null, …)`, no con el `state` de la página** (me equivoqué la primera vez): el parche de Next (`app-router.js`) deja pasar sin sincronizar la URL un `replaceState` cuyo state trae `__NA`; con `null` copia su estado interno y
  sincroniza `usePathname` y `useSearchParams`. Lo cazó un revisor leyendo `node_modules`, no un test.
- **«No pude leer tus credenciales» ya no es «no tienes Zernio»** (`zernioConfigurado` tragaba todo): con la base caída `estadoMedios` frenaba Publicar con «Conecta Instagram» y el modal abría «pega tu key» a un negocio que sí la tiene.

### Lo que NO se midió (se mide con la primera conexión REAL, que hace una persona: los clics de Facebook son suyos)

1. Los nombres de `alreadyConnected`, `isActive`, `enabled`, `needsReconnection` y el `profileId` de una cuenta (¿texto u objeto?): el lector es tolerante y falla cerrado (`respuesta`). `authUrl` y el envoltorio `{ accounts }` SÍ se vieron.
   **Y por qué los links a mano de anuncios no dejaron conexión** (ver arriba): si la causa es de Zernio o de la cuenta de Meta, esta pieza no la arregla, sólo la dice (`error=` en la vuelta).
2. Si el vínculo con la ventana sobrevive a la cadena Zernio → Meta → `redirect_url` (si no, el `BroadcastChannel` y el sondeo lo cubren), y cómo se ven la ventana y el login dentro del navegador de Instagram.
3. Que Zernio conserve el `?red=` de la landing de la ventana junto a sus parámetros (la doc dice que conserva los propios).
4. Si `GET /accounts` lista las conexiones `metaads` sin `platform` (Ads Manager midió que hoy no hay ninguna, así que no se sabe) y si una cuenta `metaads` con el token vencido sale con `needsReconnection`.
5. El cuerpo del 402 al conectar ANUNCIOS (¿trae `dashboard_url`?), y qué pasa al intentar una segunda conexión de anuncios por profile («una por profile»).
6. Si el modo `classic` de anuncios crea una cuenta de Facebook oculta (`enabled: false`) además de la `metaads`: la lista pide `excludeHidden=true`.

### Lo que quedó SIN hacer

- **El estado de la tarjeta de Zernio en la grilla sigue siendo «hay key».** Un «falta conectar Facebook» es un estado nuevo y toca cuatro lugares que dibujan el estado (`sevOf`, el chip de `ServicioSuelto`, «Requiere tu atención» y el teléfono); el bloque «Redes» dice el estado de cada red al abrir la tarjeta.
- ~~Traer los formularios de Meta con `lead.received`~~ **HECHO el 23/10/2026** (el reemplazo del puente de Make): ver «Los leads de los formularios de Meta por Zernio», más abajo.
- Sacar la key de la plataforma del ws1 (la coordina el Cerebro con Ads Manager) y, después, la rama `byok: false` de `ensureProfile` (queda sólo para el ws1).
- Una operación en la API de MaKo para conectar una red (`conectar_redes`: el id no puede llevar «zernio» ni «instagram», `tests/sin-instagram.test.ts`).
- El teléfono (MaKo Mobile) no tiene el bloque «Redes»: abre la computadora con `?abrir=zernio`.
- Tipos: salió «sin tipos» (política del tren): los chequea el `tsc` acotado de Integración.

**Vive en:** `lib/zernio-redes.ts` · `lib/zernio-conectar.ts` · `lib/zernio.ts` (`cfg`, `zFetch` y `profileIdEfectivo` exportados) · `lib/credenciales.ts` (`credDelClienteEstricta`) · `app/api/zernio/route.ts` ·
`app/_components/ConectarViaZernio.tsx` · `app/integraciones/ConectarRedes.tsx` · `app/integraciones/zernio-vuelta/` · `app/automations/ConectarMedio.tsx` · `app/chats/ChatsApp.tsx` ·
`tests/zernio-conectar-redes.test.ts` · `tests/zernio-sin-respaldo.test.ts`.

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2), con el contrato cerrado con Ads Manager. Investigación: cuatro lectores en paralelo (API de conexión, cuentas y cobro, apps de referencia, mapa del código)._

**Y el rojo que dejó en main el mismo día (medido el 24/10/2026, claude5, chat Automations).** `tests/zernio-sin-respaldo.test.ts`
(«ningún código lee la key de Zernio de la plataforma para un negocio») acusaba a `lib/zernio-ads.ts` (publicar anuncios por Zernio,
001b3184b, apagado hasta la prueba). **El diagnóstico obvio («un negocio publica con la cuenta de MaKo: plata nuestra») era el
equivocado.** `claveZernioAnuncios` lee `envCred('ZERNIO_API_KEY')` SÓLO si el negocio es el de la plataforma (`wsSuperAdmin`, el de
MaKo), donde esa key es la suya. A todo cliente le lee su fila con `credDelCliente`, sin respaldo, incluido el ws1, que para
`credWs` sí cae al entorno. El barrido buscaba el texto `envCred('ZERNIO_API_KEY'` sin mirar la guarda. **Regla:** la excepción va en
POSITIVO y exacta: el test saca esa única línea, dentro de `claveZernioAnuncios`, y exige que la función termine en
`credDelCliente`. Sin la guarda, o con `credWs`, cae (B11, B12). No se excluye el archivo entero: así cualquier otra lectura
nueva en él vuelve a caer.

## Los leads de los formularios de Meta por Zernio (`lead.received`): la misma puerta que Meta, y lo que la doc NO dice (23/10/2026)

**El pedido** (Martín, vía el Cerebro, 23/10/2026): el puente de Make o Zapier se retiró («ya resolvimos todo con Zernio») y los leads de los formularios
instantáneos de un negocio sin app propia de Meta tienen que entrar por el webhook de SU cuenta de Zernio: «Va por `upsertLeadFromMeta`, igual que el
webhook de Meta: mismo origen, sin duplicar si el lead también entra por la app propia del negocio (dedup por el leadgen_id), y con la conversión, el aviso
y las automatizaciones que dispara un lead de Meta. Ruteo estricto por la cuenta de Zernio del negocio y la deduplicación de reentregas».

**Cómo quedó.** El webhook de Zernio (`app/api/webhooks/zernio/route.ts`) tiene una rama para `lead.received`, DESPUÉS de lo que ya tenía (firma sobre el
cuerpo crudo → ruteo estricto por profile o por cuenta → la firma tiene que ser de ESE negocio → el evento se reclama una sola vez en `zernio_eventos`).
`lib/zernio-lead.ts` (puro) lee el cuerpo; `lib/zernio-leads.ts` lo entrega a `upsertLeadFromMeta` con el `leadgenId` como `meta_lead_id`, y manda la
conversión `Lead` (CAPI, con el MISMO `event_id` que el webhook de Meta: si el lead entra por los dos caminos, Meta junta los eventos) y lo inmediato
(`alNacerLeadDeMeta`: el aviso, los flujos, las automatizaciones). **El alta va adentro del pedido y lo demás en `after`**, porque Zernio corta a los 5 s;
si el alta falla se suelta el reclamo del evento y Zernio reintenta.

### Lo que se leyó de la doc del webhook (docs.zernio.com/webhooks/ads, 23/10/2026, por un lector que resume: los nombres pueden venir parafraseados)

**La doc NO trae un JSON de ejemplo: sólo la tabla de campos.** `id` (estable, igual en cada reintento y en `X-Zernio-Event-Id`), `event`, `timestamp`, `test`
(sólo en las muestras de `POST /v1/webhooks/test`), `lead` { `id`, `leadgenId`, `formId`, `formName`, `adId`, `adsetId`, `campaignId`, `fields`, `isOrganic`,
`createdAt` } y `account` { `id`, `accountId`, `platform: "facebook"`, `profileId` (nulo si no hay profile) }. `fields` es «pregunta → respuesta»
y **las opciones de una pregunta de selección vienen como CLAVE** (`k1`), no como rótulo. Los eventos de anuncios exigen el complemento de anuncios (Ads
add-on) de Zernio, y la página tiene que estar conectada con el permiso `leads_retrieval`: una cuenta conectada antes de tener anuncios se tiene que
reconectar.

### El diagnóstico obvio era el equivocado, y las trampas

1. **«Armar el parser con la API REST que ya se lee» NO sirve.** `GET /v1/ads/leads` devuelve el lead con `fieldData` crudo (la forma de Meta) y otros
   nombres; **la tabla del webhook no lista `fieldData`**. Es la misma trampa de Cal.com (06/10/2026, AGENTS.md): el lector toma `fields` y NO lee `fieldData`
   (un test lo fija con un cuerpo que sólo trae `fieldData`).
2. **Una muestra de prueba NO es un lead.** `POST /v1/webhooks/test` manda un cuerpo con `test: true`; sin mirarlo, apretar «probar» en el panel de Zernio
   creaba un lead falso, con el aviso y las automatizaciones que dispara uno real. Se ignora con su motivo (`ignored: "prueba"`).
3. **El `leadgenId` decide la identidad y no se inventa ni se rellena.** Sólo dígitos (8 a 32), como string o como número seguro (un id de 17 dígitos que
   viaja como número JSON ya se redondeó al parsear). Sin eso el evento NO se carga —un lead que se carga dos veces avisa dos veces— y se registra con las
   CLAVES que sí vinieron (nunca los valores: es un dato personal). **El `id` de Zernio (`lead.id`) no es el leadgenId**: usarlo duplicaba el lead que ya
   entró por Meta.
4. **Los NOMBRES de anuncio, conjunto y campaña no viajan en este evento, sólo los ids.** Quedan vacíos (no se rellenan con el id): los ids son los que
   deciden el producto (`lib/campana-funnel.ts`) y la atribución (`lib/campana-atribucion.ts`: «los nombres sólo para MOSTRAR»), así que lo único que se
   pierde es el renglón con el nombre en la ficha. ⚠️ `upsertLeadFromMeta` escribe esas columnas con `?? null` también en el UPDATE de un lead que ya
   existía (la persona que vuelve a anotarse, unida por teléfono o email): ese lead pierde el nombre de la campaña anterior y queda con los ids nuevos.
5. **Hay UN solo índice único de `meta_lead_id` y es GLOBAL** (mig 0007). Si el webhook de Meta y el de Zernio traen el MISMO lead a la vez, el segundo insert
   falla por clave duplicada; el webhook de Zernio contesta 500, suelta el reclamo, Zernio reintenta y el reintento lo encuentra (`created: false`) sin
   avisar de nuevo. No se necesita código de carrera: se necesita NO tragar ese error.
6. **Lo inmediato y la conversión, sólo con un lead creado por ESTA entrega y de menos de 24 h** (`esNuevoParaElNegocio`, la regla del poll). Zernio
   reintenta hasta 7 veces y se puede reentregar a mano desde su panel: un evento de hace días no es «un lead nuevo» y no puede mandar un primer
   mensaje. Sin fecha legible se trata como recién llegado (callarlo dejaría a un lead real sin que nadie le escriba).
7. **Los leads se suscriben APARTE de los otros eventos.** `lead.received` es del complemento de anuncios y la doc dice que sin él los eventos de anuncios
   dan 403 `ads_addon_required` al registrar el webhook; **no dice si `lead.received` está entre ellos**. Si fuera una sola lista y Zernio la rechazara,
   el negocio perdería sus mensajes y comentarios de Instagram y Messenger, que hoy andan. `asegurarWebhook` pide todo junto y, si Zernio contesta 400,
   403 o 422, registra los de siempre solos (y lo deja en el log); una key mala (401), un pago (402) o una caída suben tal cual.
8. **`asegurarWebhook` no corre solo.** Corre al conectar una red, al ver el estado de Instagram o Messenger y al publicar una automatización con esos
   medios: un negocio que ya tenía su webhook registrado NO escucha `lead.received` hasta que pase una de esas tres.

### Lo que NO se midió (se mide con un `lead.received` REAL)

1. El cuerpo: **ningún negocio recibió todavía un `lead.received`**; todo lo de arriba sale de la tabla. Falta ver `fields` con un formulario real (¿las claves
   son las de Meta —`full_name`, `phone_number`— o los rótulos?) y si un campo de varias opciones llega como lista.
2. Que `lead.leadgenId` sea EXACTAMENTE el id que Graph devuelve para ese lead (si no, la deduplicación con Meta no funciona y el lead entra dos veces).
3. Si Zernio rechaza suscribir `lead.received` sin el complemento de anuncios (y con qué código), y si `account.accountId` de este evento es el `_id` que lista
   `GET /v1/accounts` (de ahí depende el ruteo cuando `profileId` viene nulo).

### Lo que quedó SIN hacer

- **Nadie le dice al negocio que sus leads no llegan por falta del complemento de anuncios o del permiso.** `leadsEnElWebhook(ws)` (lib/zernio.ts) mide si el
  webhook registrado escucha el evento; falta que alguna pantalla lo use (Ads Manager o el modal de Zernio). Mide lo REGISTRADO, no que llegue alguno.
- **Sin red de seguridad si un evento se pierde.** Zernio reintenta 7 veces y lo descarta; el poll de Meta (`/api/cron/meta-leads-poll`) usa el token de página
  propio del negocio y un negocio que sólo conectó por Zernio no lo tiene. Existe `GET /v1/ads/leads?accountId&since=<segundos>` (más nuevo primero, cursor por
  `pagination.cursor`) para un barrido, que además traería `fieldData`, y la regla de lo inmediato (24 h) ya está en `cargarLeadDeZernio`.
- **Los nombres de campaña, conjunto y anuncio** (punto 4): se pueden resolver por id contra `marketing_metrics_daily`, o desde la API de anuncios de Zernio.
- **Un fallo DESPUÉS del insert deja el lead sin anunciar:** si `upsertLeadFromMeta` tira al dejar el rastro o al sumarlo a otro funnel, el reintento de Zernio
  encuentra el lead (`created: false`) y nadie dispara el aviso ni las automatizaciones. Es de la puerta compartida (el webhook de Meta tiene el mismo hueco).
- **Sin prueba de punta a punta** (un evento firmado contra un negocio de prueba): ws3 no tiene key de Zernio y no se la pone con código.
- Tipos: salió «sin tipos» (política del tren): los chequea el `tsc` acotado de Integración.

**Vive en:** `lib/zernio-lead.ts` · `lib/zernio-leads.ts` · `app/api/webhooks/zernio/route.ts` · `lib/zernio.ts` (`EVENTO_LEADS`, `EVENTOS_ESCUCHADOS`, `asegurarWebhook`,
`leadsEnElWebhook`) · `tests/zernio-leads.test.ts`.

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2), después de «Conectar con Facebook, Instagram o anuncios»._

## La agenda de MaKo NO entra al CRM de MaKo (medido en la base el 23/10/2026)

**Síntoma:** a dos días del lanzamiento, toda venta de MaKo pasa por la agenda `calendly.com/koncke/asesoria` (/planes sin
pasarela, la VSL, las landings), y ninguna reserva llega al CRM del ws 9. **Medido:** `webhook_routing` de Calendly tiene
filas sólo del ws 1 (los eventos de Mauricio); `credenciales` de Calendly sólo en el ws 1 y el ws 4; el ws 9 no tiene token,
ni signing key, ni tipo de evento de R1. Leads del ws 9 con `origen_lead = 'calendly'`: 0.

**El diagnóstico obvio era el equivocado:** «la huella `calendly.reservas_sin_ruteo` está vacía, así que no hubo reservas».
No prueba eso. La huella se escribe recién DESPUÉS de verificar la firma con la key de plataforma
(app/api/webhooks/calendly/route.ts:343-398): si la cuenta koncke no tiene una suscripción apuntada a MaKo, no llega nada; si
la tiene y firma con otra key, es un 401 sin rastro en la base (y Calendly la cuenta para deshabilitar la suscripción). Lo
que se ve es idéntico: nada. La prueba está en Calendly (el registro de entregas de las suscripciones de webhook de koncke).

**Mientras tanto:** la reserva existe en Calendly (mail y calendario de Martín) con las UTM del link; lo que falta es el
lead, el seguimiento y el origen en el CRM. **Arreglo (de Martín, en /integraciones?ws=9, donde va la pasarela):** conectar
la cuenta de Calendly de koncke y cargar el tipo de evento de R1.

**Conectar no es todo, y lo que trampea es creer que sí:**
- Guardar el token y el R1 escribe el RUTEO (`ROUTING_CREDS`), no el AVISO. La suscripción de webhook no tiene pantalla en
  Calendly ni en MaKo («los webhooks se configuran aparte», lib/metodo-catalogo.ts): se crea por API con el token
  (scripts/arreglar-webhook-calendly.ts, fijo al ws 1) y requiere un plan pago de Calendly.
- Lo agendado ANTES no entra solo: Calendly no reenvía avisos viejos, ningún cron lee la agenda y el «histórico al
  conectar» (lib/onboarding-contrato.ts) no incluye Calendly. No se pierde: la API lista las reservas pasadas con sus UTM y
  scripts/backfill-calendly.ts las importa (idempotente, sólo completa vacíos), pero está fijo al ws del dueño y al token de
  `.env.local`.
- **MaKo no tiene ningún token de la cuenta koncke** (medido el 23/10): el de `.env.local` es de otra cuenta (por
  `/users/me`, sin imprimirlo), y los únicos otros están en el ws 1 y el ws 4, que son clientes y no se usan para esto. Hasta
  que Martín pegue el suyo, no se puede ver si koncke tiene una suscripción apuntada a MaKo ni cuántas reservas quedaron
  afuera. Con el token, la API dice qué suscripciones hay y si están `active` o `disabled`; los intentos de entrega uno por
  uno no los da.

**La pantalla ya no miente (23/10):** /integraciones pregunta a Calendly, con el token del negocio, si hay un aviso a MaKo
(lib/calendly-aviso.ts) y, si no anda, baja Calendly a ámbar con su motivo: «Falta el aviso», «Aviso apagado», «Aviso con
fallas» (reintentando) o «Aviso incompleto» (sin invitee.created). Reglas aprendidas con la revisión adversarial, todas en
lib/calendly-aviso-reglas.ts con test:
- **«Es de MaKo» pide camino Y dominio.** Con el camino solo, el webhook de otro CRM, de un túnel o de localhost
  (`/api/webhooks/calendly` es el camino de cualquier app Next) daba «activo» y la pantalla pintaba verde sin que entrara una
  reserva. El dominio es cualquiera de `DOMINIOS_DE_MAKO` (el de antes también: el proxy exime a /api/webhooks del 410 y
  puede seguir entregando), https y sin puerto.
- **«Activo» no es `state: active`.** Pide además sin `retry_started_at` (Calendly reintenta una entrega que falla antes de
  apagarla) y con `invitee.created` en sus eventos (sin él entrega cancelaciones y ninguna reserva nueva).
- **Un 403 de la organización no es «sin aviso».** Un usuario que no administra su organización no ve las suscripciones de
  alcance organización, y esas son justo las que crea el script. Con 403 sólo un aviso visto y sano (`activo`) es veredicto;
  lo demás se calla (`estadoDeLasLecturas`). Falló antes: pintaba de ámbar a quien sí tenía el aviso.
- **No puede colgar la página.** Eran dos viajes en serie a una API ajena con tope por llamada (hasta 8 s de render). Ahora UN
  tope de 3 s para toda la cadena, el veredicto claro se recuerda 60 s por negocio, y la página lo lanza al principio y lo espera
  al final. «No pude leer» (null) no se recuerda y no pinta a nadie.
- **Verde NO prueba que las reservas lleguen.** Dice: token vigente, alguna fila de ruteo y aviso sano. No dice que el ruteo
  resuelva el tipo de evento de la ASESORÍA (puede ser otro), ni que la firma valide, ni que la entrega funcione. La prueba de
  punta a punta es UNA reserva de prueba que aparezca como lead en el ws 9 (y se cancela). El relevo lo pide así.
- **«Conectada» es SÓLO el token, no token + R1 (24/10).** La grilla mira `envs: ['CALENDLY_API_TOKEN']`
  (lib/integraciones-catalogo.ts). Un negocio con el token y sin el R1 no tiene ruteo, y con un aviso sano la pantalla quedaba
  verde mientras el webhook descartaba cada reserva con un 200 (el 04/10 se midió 1 de 2 así). Ahora lee `webhook_routing`
  del negocio y dice «Falta el R1»; y un 401 de /users/me dice «Token vencido» (`estadoAntesDelAviso`: los dos ganan sobre el
  aviso). El ruteo se lee SIEMPRE, fuera del recuerdo de 60 s: recién guardado el R1 no puede seguir diciendo que falta. Y el
  recuerdo es por negocio Y por token: pegar uno nuevo no hereda «Token vencido».

**Los scripts, por negocio:** `--ws=N` en scripts/backfill-calendly.ts y scripts/arreglar-webhook-calendly.ts toma el token
de las credenciales de N y NUNCA el de `.env.local` (con el de otra cuenta, el backfill metería una agenda ajena en el CRM
de N); `--simulacro` mide sin escribir. Lo que NO era obvio y la revisión adversarial encontró:
- **Un flag mal escrito caía en silencio al ws 1.** `--ws 9` (con espacio), `--WS=9`, `--dry-run` o `--simulacro=1` se
  ignoraban: el script corría sobre Mauricio con el token de `.env.local` y ESCRIBÍA (borraba su aviso, rotaba su clave).
  Los argumentos son estrictos (lib/calendly-scripts-reglas.ts): lo que no se reconoce, o se repite, se rechaza.
- **«El negocio tiene clave guardada» no prueba que el aviso sea suyo.** Calendly no devuelve la signing key, y una
  organización puede tener tipos de evento de dos negocios; borrar su único aviso (la dirección es la misma: 409) y guardar la
  clave nueva sólo en N deja a los otros con 401 y se pierden las reservas de los dos. El freno de `--reemplazar` ahora se
  decide con datos de Calendly: que el aviso lo haya creado el dueño del token y que ningún tipo de evento de la organización
  rutee a OTRO negocio (`puedeBorrarAvisos`); si no se pudo leer algo, frena.
- **El backfill con `--ws` no importa lo vinculado a una etapa de un embudo.** El webhook decide ESAS reservas por la etapa
  (`rutaDeReserva` + `decidirReserva`: una R2 vinculada no crea nada); el backfill las pasaba por la rama R1 y creaba una R1
  fantasma por cada una, con el No Show corriendo desde esa fecha. Hoy las salta y las cuenta, para cargarlas a mano.
- **La R1/R2 se leen con `credWsEstricta`**, como el webhook: con la no estricta una base que tose daba null y una R2 entraba
  como R1. Y la medición del arreglo ya no lee «0 avisos» cuando la lista falla (403): corta, y mira también los de alcance usuario.
- **`--ws=1` se rechaza (24/10).** El ws del entorno lee `.env.local` de respaldo cuando su fila falta o no se descifra
  (`credWs`/`credWsEstricta`, `wsDelEntorno`), así que `--ws=1` era «lo de siempre» con la promesa de «sólo la base de N».
  Para el ws 1, sin `--ws`.
Los pasos exactos, en docs/relevo/suscripcion.md (punto 3). **Quedó SIN hacer:** el backfill no ubica las reservas de eventos
vinculados a una etapa (scripts/backfill-calendly.ts, el salto con `rutaDeReserva`); si hace falta, se arma con
`ubicarReservaVinculada` de lib/agenda-evento-etapa-server.ts, como el webhook. **Vive en:** app/api/webhooks/calendly/route.ts ·
lib/webhook-routing.ts · lib/compra-plan-reglas.ts (`AGENDA_MAKO`) · app/vsl/Landing.tsx (`CALENDLY_URL`).

## El puente de leads de Meta por Make o Zapier: se armó y se RETIRÓ el mismo día (23/10/2026)

**Estado: RETIRADO.** Martín, 23/10/2026, textual: «Y no entiendo porque seguimos teniendo "zapier" o "Make" si ya resolvimos
todo con Zernio...». Los leads de formularios de Meta entran con la app propia de cada negocio (según el Cerebro, como hoy les
pasa a Brigitte y Natalia) y Zernio trae los formularios con su aviso `lead.received`. Quien ya paga Make o Zapier no tiene nada
que conectar acá.

**Qué fue.** Mientras la app de MaKo no tenía `leads_retrieval` (en revisión, ~10/11), un receptor `POST /api/webhooks/zapier`
(header `X-MaKo-Clave`, servicio de ruteo `zapier`, credencial `ZAPIER_LEADS_CLAVE`) recibía el lead desde un escenario de Make o
un Zap del negocio y lo creaba por la MISMA puerta que un lead de Meta, con su tarjeta en /integraciones («Último lead hace X»,
ámbar a las 72 h sin uno). Se probó de punta a punta en el ws3 y rompiendo cada guarda. Está en los commits `4e661df70`,
`ea41ac4e4`, `6c520ad67`, `946a451e0` y `93a7baf00`: se recupera con `git show`. Su guía quedó en
`docs/archivo/guia-leads-por-zapier.md`, con los precios leídos el 23/10/2026.

**Qué se sacó:** la tarjeta y su servicio del catálogo (los tres registros y el logo), sus slides, el endpoint, el ruteo (el
servicio `zapier`, `ZAPIER_LEADS_CLAVE` en `ROUTING_CREDS` y en `RUTEO_POR_HASH`), el lector, la puerta y el estado
(`lib/zapier-lead.ts`, `lib/zapier-leads.ts`, `lib/zapier-estado.ts`), el estado «callada» de la grilla, el renglón de la API de
MaKo y su test. **No se tocó** lo de Skool y Hotmart, que también avisan «por Zapier» pero son otra fuente.

**Medido antes de sacar el endpoint** (producción, 23/10/2026, sólo lectura; de `credenciales` sólo la clave, nunca el valor):
0 credenciales `ZAPIER_LEADS_CLAVE`, 0 filas de ruteo `zapier`, 0 filas `zapier.estado` y 0 leads con id `zap:%`. Nadie lo había
conectado, así que el endpoint se sacó sin avisar a nadie y, ya desplegado, contesta 404.

**El guard:** `tests/puente-leads-retirado.test.ts` barre `git ls-files app lib tests` y falla si vuelve un archivo del puente, una
cadena de su ruta o de su credencial en el código (sin comentarios), la tarjeta en el catálogo o el ruteo; y comprueba que Skool,
Hotmart y Apify siguen donde estaban, para que un retiro torpe no se lleve lo que no era.

### Lo que sigue valiendo, si se vuelve a armar un receptor de leads

- **La puerta de un lead de formulario de Meta es `upsertLeadFromMeta` + `alNacerLeadDeMeta`, no `ingresarDeFuente`.** La de Skool
  y Hotmart a propósito no decide nada por detrás (ni etapa, ni automatizaciones, ni mensajes): por ahí el lead entra al CRM como
  una fila muda y nadie le escribe.
- **`idx_leads_meta_lead_id` es único GLOBAL**, sin `workspace_id`: un id propio lleva el workspace adentro (`zap:<ws>:<huella>`,
  determinista para que un reintento caiga en la misma fila) y NUNCA viaja a Meta como `lead_id`, que rechaza el evento entero
  ante uno inválido.
- **`parseLeadFields` busca por palabra clave dentro del nombre del campo.** `ad_name`, `campaign_name` y `adset_name` contienen
  «name» y ganaban como el nombre de la persona; `first_name` llega antes que `full_name` y salía «Ana» en vez de «Ana Pérez».
  Las claves técnicas se sacan antes del parser y el nombre completo va adelante. Y un id de 17 dígitos que viaja como número
  JSON ya se redondeó al parsear (pasa de 2^53): no es el id.
- **Un aviso sin email ni teléfono contesta 422, no 200**: con 200 el puente «anda» y no entra nadie, y el error no se ve donde
  mira quien lo armó. Un lead viejo se carga callado (24 h), pero sin fecha se trata como recién llegado.
- **Borrar un lead no borra su `lead_audit` ni sus `notificaciones`**: una prueba se limpia con las tres.
- **Un plan «gratis» se mide contra la función que se va a usar, no contra el nombre del plan** (Martín: «El plan gratis de Make
  NO trae la integración API»; lo oficial no lo confirmó ni lo descartó, y no se ofreció). **Y un precio sin país es la cifra de una
  región**: Make Core, US$9 al mes pagando el año en Argentina y México, US$12 en EE. UU.
- **Lo que cuesta un puente de terceros, medido en sus fuentes:** un disparador por intervalo de Make cobra 1 crédito por corrida
  aunque venga vacío (`help.make.com/how-features-use-credits`: a 15 minutos son ~2.900 créditos al mes por escenario); el
  contrato de Make (MSA, cláusula 4.1, «internal purposes») no deja operar los leads de varios clientes con una sola cuenta de
  MaKo, y su plan Core no trae equipos ni roles; Zapier necesita el plan Professional (Facebook Lead Ads es una app premium y
  «Webhooks by Zapier» no está en Free).
- **La key de un servicio no se renombra con su tarjeta**: la tarjeta pasó a «Make o Zapier» y el servicio siguió llamándose
  `zapier` porque la clave ya estaba escrita en la base y en el ruteo.

### Lo que queda SIN hacer

- **Que Zernio traiga los formularios de Meta con `lead.received`.** El webhook `/api/webhooks/zernio` escucha hoy
  `message.received`, `referral.received`, `comment.received` y `account.connected` (`EVENTOS_WEBHOOK`, lib/zernio.ts), no
  `lead.received`. Es lo que reemplaza al puente y no está hecho: el lead pasaría por `upsertLeadFromMeta`, como acá.

**Vive en:** `tests/puente-leads-retirado.test.ts` (el guard) · `docs/archivo/guia-leads-por-zapier.md` (la guía vieja) · los
commits `4e661df70` a `93a7baf00` (el código).

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2), que trajo la decisión de Martín. Retiro probado rompiéndolo._

## «Conectada ✓» con el webhook SIN registrar: el tipo se olvidó un campo y la pantalla se olvidó un valor (24/10/2026, Cerebro › Integración)

La pieza nueva de Zernio (`app/_components/ConectarViaZernio.tsx`, commit `8dda570be`)
llegó al tren con tres errores de tipos **en su propia punta**, medidos antes de
mergearla: no los causó el merge, la rama se commiteó roja. Dos eran el mismo renglón y
el tercero destapó un agujero de producto.

**1. El tipo del cliente se olvidó un campo que el servidor SÍ manda.** `RespuestaApi`
(un `type` LOCAL al archivo, línea 52) declaraba `ruteo` y no `webhook`, y la 158 hace
`c.webhook === 'error'`. No era código muerto: `recibirConexion`
(`lib/zernio-conectar.ts:204`) declara
`Promise<{ ruteo: 'ok'|'ocupado'|'error'; webhook: 'creado'|'actualizado'|'sin_secreto'|'error' }>`
y el handler contesta `Response.json({ ok: true, ...(await recibirConexion(ws)) })`
(`app/api/zernio/route.ts:77`, con el contrato escrito en el `:11`). El campo va
**opcional**, como `ruteo`: la rama `{ ok: false }` del `:81` no lo trae y el tipo lo
comparten los 6 call-sites de `api()`. El tipo se copia del retorno declarado del
servidor, nunca se inventa.

**2. Un `let` asignado sólo dentro de un closure se narrowea a `null`.**
`let errorDeVentana: MensajeVentana | null = null` (223) con su única asignación adentro
de `recibir` (229): en la 271 el `if` por truthiness daba `never`. Pasa a ser una
propiedad de un objeto, que sí se narrowea en el `if`. Sin `as any`, sin `@ts-ignore` y
sin un `?` que esconda el bug; el runtime no cambia.

⚠️ **3. Y EL AGUJERO QUE EL COMPILADOR TAPABA: `'sin_secreto'` no se avisa.**
`asegurarWebhook` devuelve `'sin_secreto'` cuando falta el secreto maestro
(`lib/zernio.ts:261`: `const maestro = await envCred('ZERNIO_WEBHOOK_SECRET'); if (!maestro) return 'sin_secreto';`)
y **sale antes de registrar nada**, o sea que en la cuenta de Zernio del negocio NO queda
webhook — y sin webhook no llega ni un mensaje ni un `lead.received`, sin dar error. La
pantalla sólo reacciona a `=== 'error'`, así que con `'sin_secreto'` la persona ve
«conectado ✓» y se queda callada, que es justo lo que el comentario de la 149-151 promete
no hacer. Los dos defectos son la misma línea: **mientras el campo no estuvo en el tipo,
el compilador no podía ayudar a enumerar sus valores.**

⚠️ **El arreglo obvio es el equivocado, y por eso esto queda como DEUDA y no se aplicó.**
La salida que aparece primero es tratar `'sin_secreto'` como `'error'` y mostrar «no
pudimos armar la recepción, vuelve a conectarla». Eso manda al negocio a arreglar una
variable **de la plataforma**, que él no puede tocar — `lib/disparadores-canales.ts:183`
ya lo dice con todas las letras: *«`ZERNIO_WEBHOOK_SECRET` en la plataforma queda sólo el
log: el negocio no lo puede arreglar»*, y su `:190` lo trata como falla **nuestra**
(`console.error`). Es «una guarda bloquea sólo lo que se arregla haciendo lo que ella
pide» y «el error dice DE QUIÉN fue»: un cartel que lo manda a reconectar para siempre es
peor que el silencio de hoy.

**Lo que queda SIN hacer, y cómo:** `'sin_secreto'` tiene que ser ruidoso **para
nosotros** (el log que ya existe en `disparadores-canales`, o un aviso de plataforma) y
en la pantalla del negocio decir que la recepción no quedó armada **sin pedirle que la
arregle**. Y el estado «armó la recepción» conviene definirlo en POSITIVO
(`webhook === 'creado' || webhook === 'actualizado'`) en vez de por una lista de fallas
que se olvida una. Medido: `ZERNIO_WEBHOOK_SECRET` está en `.env.local` (49 car); **no se
pudo verificar en Vercel producción**, y eso hay que medirlo antes de tocar el cartel,
porque si falta allá el aviso aparece de golpe en todos los clientes.

**Vive en:** `app/_components/ConectarViaZernio.tsx:52,158,223,271` · `lib/zernio.ts:261` · `lib/zernio-conectar.ts:204` · `lib/disparadores-canales.ts:183`

## /integraciones con la estructura de Vercel Marketplace: lo que abrumaba no eran las 22 tarjetas (24/10/2026, Ops Center)

**El pedido** (Martín, por el Cerebro): «hay tanta pero tanta info que se complica muchísimo para el usuario... Piensa en como
hacerlo o investiga como lo hacen otras apps». La referencia es vercel.com/marketplace. La abrió el Cerebro en el navegador, y el
24/10 se volvió a relevar la página en vivo y su documentación (docs/relevo y el commit lo nombran).

**Vive en:** `app/integraciones/IntegracionesBoard.tsx` (la fila de controles, las secciones, la tarjeta, los plegados) ·
`page.tsx` (la destacada) · `TusCuentasIA.tsx` → `TarjetaTusCuentasIA` · `lib/integraciones-catalogo.ts` → `ORDEN_CATEGORIAS` ·
`app/globals.css` («La grilla de /integraciones») · el teléfono `app/m/configuraciones/integraciones/` ·
`tests/integraciones-vercel.test.ts`.

- **El diagnóstico obvio era el número, y estaba mal.** Vercel tiene unas 30 categorías y la pantalla no abruma. Tres cosas
  abrumaban acá:
  - las 10 categorías desplegadas a la vez, cada una con su fila;
  - «Requiere tu atención», que en un cliente nuevo repetía ARRIBA hasta quince tarjetas de la grilla, con el nombre de la variable
    («Falta configurar: ZERNIO_API_KEY»);
  - y todo lo que no es el catálogo, desplegado: el medidor, «Costo de MaKo», el historial y el bloque entero de «Tus cuentas de IA».
  En Vercel las categorías son un FILTRO: tres controles en una fila, no treinta secciones.
- **Lo que se copió:**
  - la fila de controles: el tipo (acá el estado), la categoría y la búsqueda, que «/» enfoca;
  - pocas secciones con criterio. «Conectadas» va primero, con el estado en cada tarjeta y las que tienen un problema adelante.
    «Sin conectar» muestra doce y cierra con «Mostrar más integraciones»;
  - la tarjeta mínima: el logo, la categoría en una píldora, el nombre y UNA línea, la `descripcion` del catálogo, que en la
    computadora no se dibujaba en ningún lado.

  **Lo que no se copió:**
  - el carrusel de destacadas. La única destacada es «Tus cuentas de IA», arriba, que abre el MISMO modal del Ops Center;
  - la tarjeta «Request an integration». AGENTS.md dice que un pedido de integración no se resuelve con un formulario propio, va por
    la Ticketera.
- **`CAT_ORDER` hacía de LISTA BLANCA, y era la tercera vez que mordía.** GitHub y Whop quedaron invisibles sin ningún error. Ahora el
  orden vive en `lib/integraciones-catalogo.ts` (`ORDEN_CATEGORIAS`, el mismo para el teléfono) y no filtra nada: una categoría
  nueva va al final.
- **«Mostrar más» y un link `?abrir=` no se llevan solos.** Si la tarjeta pedida cae en lo plegado (o un filtro la esconde), el modal
  se abre igual, pero el scroll no encuentra la tarjeta. Ningún test lo veía: `scrollIntoView` sobre `null` no falla.
  - Ahora el link limpia los filtros y despliega lo que haga falta (`pedida`).
  - El scroll va en su efecto, detrás del render que pone la tarjeta en el DOM.
- **Sacar «Requiere tu atención» se llevaba un aviso que no tenía otro lugar.** Un negocio que pegó la clave de MaKo
  («Esa key es la de MaKo, no la tuya», veredicto `copia`) está SIN conectar, y sólo esa sección lo decía. Las alertas de las
  conectadas ya iban a sus tarjetas, pero ésta quedaba muda en el catálogo. Ahora lo dice su tarjeta, va primera en «Sin
  conectar» y entra en «Con problemas» (en el teléfono, igual). **Al sacar una sección que junta avisos, se recorre cada aviso
  que juntaba**, no sólo los de las tarjetas que se ven.
- **Lo plegado conserva sus links.** «Costo de MaKo» se abre con `#saldo-ia` (el chip «Saldo de IA» del menú) y con `?ops=1`. El
  historial muestra a la vista cuántos están en curso, o «No pude leerlo».
- **El teléfono, en el mismo trabajo** (AGENTS.md: las mismas vistas, en el mismo orden y con los mismos rótulos): «Tus cuentas de
  IA», «Conectadas», «Sin conectar» y el «Historial de problemas». Antes tenía «Para resolver» arriba y una sección por categoría.
  Las filas sin conectar muestran la línea del catálogo, no «Falta configurar: …».
- **Medido** con las piezas reales dibujadas en Node (la receta, en docs/hallazgos-ui.md), con 7 conectadas y 14 sin conectar, a 1440
  de ancho: **de 2.895 px a 1.550 px**. El «antes» tenía «Tus cuentas de IA» todavía cargando, así que el de verdad era más largo.
  No es producción.

**SIN hacer:**
- «Pedir una integración» (por la Ticketera, con MaKo proponiendo el ticket).
- En el teléfono, el problema de una conectada sale de los incidentes abiertos, no de la lectura en vivo de la computadora (Meta,
  el permiso de Google, el Pixel viejo, Calendly). Esa diferencia ya existía.
- `tests/zernio-conectar-redes.test.ts` falla en main: espera un `errorDeVentana` que no está en ningún archivo. Es de Zernio, no de
  este trabajo.

## Meta entero por la Zernio del negocio: el token de Meta deprecado, y CAPI NO necesita una integración aparte (25/10/2026)

**El pedido** (Martín, 25/10): «implementa zernio y depreca la conexión con API de Meta... Y también revisa el tema de CAPI y
alimentar al pixel, como lo hariamos y deja un tutorial de como hacerlo en caso de que requiera una integración aparte».

**Vive en:** `lib/meta-via.ts` (la vía y las lecturas) · `lib/zernio-meta-cuerpo.ts` (lo puro, con `ZERNIO_META_PROBADO`) ·
`lib/meta-conexion-zernio.ts` (guardar, mirar y probar la conexión) · `app/api/integraciones/meta-zernio/route.ts` ·
`app/integraciones/ConectarMetaZernio.tsx` · `lib/meta-capi.ts` · `scripts/prueba-zernio-meta.mts` · `docs/tutorial-capi-pixel.md` ·
`tests/zernio-meta.test.ts` · el relevo con el inventario entero: `docs/relevo/zernio-capi.md`.

- **El diagnóstico obvio era el equivocado: «Zernio no hace CAPI, hace falta una integración aparte».** Lo decía la memoria del
  25/10 («lo probable que NO cubre es CAPI») y el pedido. La OpenAPI de Zernio (v1.356.1, `docs.zernio.com/api/openapi`) tiene
  `POST /v1/ads/conversions` (la Conversions API de Meta, «Platform is inferred from the provided `accountId`») y su guía de Meta
  dice «There is no pixel-scoped access token to paste. Zernio uses the ads connection you already have». O sea: con la MISMA
  conexión `metaads` con la que MaKo lee y publica, salen Lead, calificado y Schedule. El token del píxel (el botón «Generar
  token de acceso» de Events Manager) queda como SALIDA DE RESPALDO, no como camino, con su tutorial.
- **Lo que no dice la doc, y decide la prueba:** si una conexión con «Administrar campañas» (`permissionLevel=advertise`) puede
  mandar eventos al píxel. Zernio pide «Control total» (`full`) para CREAR píxeles; para mandarles eventos no dice nada. Por eso
  `lib/meta-capi.ts` cae al token del píxel sólo ante un fallo de PERMISO (`esFalloDePermiso`) y si el negocio lo pegó.
- ⚠️ **Dos pantallas piden permisos distintos para la MISMA conexión.** El botón de MaKo (`REDES.metaads`, lib/zernio-redes.ts)
  no manda `permissionLevel`, así que Zernio pide su default, `full`; el script del Media Buyer (`urlConectarAnunciosZernio`,
  lib/zernio-ads.ts) pide `advertise`. Se dejó así a propósito: `full` cubre el píxel. Si la prueba muestra que `advertise`
  alcanza para CAPI, conviene bajar el botón a `advertise` (una ventana que pide «Control total» asusta al dueño).
- **Lo que cubre Zernio, medido en la OpenAPI (lectura, no prueba):** insights como PASO DIRECTO (`GET /v1/ads/insights`:
  manda `fields`, `level`, `breakdowns` y `actionBreakdowns` a Meta y devuelve sus filas «verbatim»: el mismo parser de siempre);
  la cuenta con su estado (`GET /v1/ads/accounts`: `accountStatus`, `disableReason`, `currency`, `timezoneName`) y sus finanzas
  (`/v1/ads/accounts/finance`); campañas y conjuntos EN VIVO con presupuesto e interruptor propio (`/v1/ads/accounts/live`:
  `configuredStatus`); el árbol con el creativo y su permalink (`/v1/ads/tree`: `effectiveObjectStoryId`,
  `instagramPermalinkUrl`); los píxeles que ve la conexión (`/v1/accounts/{id}/conversion-destinations`, y `tracking-tags` con
  `stats`); leads (`lead.received` y `GET /v1/ads/leads?since=`); la calidad del match (`/v1/ads/conversions/quality`); y
  los links directos de los videos e imágenes de un anuncio (`GET /v1/ads/{adId}/media`), que es la salida al `source` que Meta
  dejó de devolver (docs/hallazgos-ads.md). Lo que NO cubre: Business Discovery de Instagram y las recomendaciones de Meta
  (`/v1/ads/recommendations` es sólo de Google).
- ⚠️ **Las UNIDADES cambian según el endpoint, y mezclarlas multiplica o divide por 100.** Meta da presupuestos y saldos en la
  unidad MÍNIMA (centavos, salvo COP, CLP, JPY…); Zernio, en UNIDADES de la moneda (`dailyBudget`, `balance`, `amountSpent`).
  El cron guarda el presupuesto de Zernio sin `desdeUnidadMeta`, y la salud de la cuenta lo vuelve a la mínima con
  `aUnidadMeta` para que `computeAccountHealth` (que divide) juzgue igual. Lo fija un test.
- ⚠️ **CAPI por Zernio: la identidad va EN CLARO y el `eventId` es OBLIGATORIO.** Zernio hashea email, teléfono, nombres y
  `externalId`: mandarlos hasheados (como hace MaKo con la Graph API) los hashea dos veces y no cruzan con nada. Sin un `eventId`
  Zernio rechaza; sin uno del llamador, MaKo arma uno ESTABLE (nombre, hora e identidad), así un reintento no cuenta doble.
- ⚠️ **Un rechazo de Meta por Zernio viene en un 200** (`eventsFailed`, `failures[]`), como con Meta directo. Y un 200 sin
  eventos recibidos tampoco es un éxito (`resultadoConversionZernio`).
- ⚠️ **Una página de insights sin `data` NO es «no hubo entrega».** El cron de Meta BORRA el día antes de insertar: tomar una
  forma desconocida por vacía borraría el día. `paginaDeInsights` devuelve null y la lectura tira.
- **«Conectada» la leen TRES lectores** (`integracionConectada`, `verificarServicio`, `/api/metodo`) y el token es obligatorio
  en el catálogo. No se lo marcó opcional (una cuenta publicitaria pegada sola quedaba «conectada» sin nada con qué leerla): la
  regla es `metaConectadaConCampos` (token + cuenta, o la conexión de Zernio + cuenta) y la usan los tres. La conexión se guarda
  como `META_ZERNIO_CUENTA`, `derivado` (ningún «guardar» la acepta tipeada: la de otro negocio no entra). Sin esto, un negocio
  conectado por Zernio no podía ni guardar su píxel: el tilde decía «Falta completar: Access token».
- **El onboarding ya no pedía Meta** (desde el 16/10 es el chat de arranque, que posterga el paso con `integracionConectada`):
  lo que había que cambiar era esa regla, no una pantalla.
- `tests/sin-instagram.test.ts` lista en `CANAL` los únicos archivos que pueden importar el cliente de Zernio, y lee
  `git ls-files`: un archivo NUEVO no existe para el guard hasta `git add -N`.

**Sin medir (lo decide la prueba, scripts/prueba-zernio-meta.mts, sobre la cuenta de MaKo `act_1426493815659364`):** que el paso
directo de insights devuelva las mismas filas que Meta directo; las finanzas con `advertise` y con `full`; que CAPI por Zernio
llegue al píxel (con `testCode`, a «Probar eventos»); el `permissionLevel` que hace falta para eso. Hasta entonces
`ZERNIO_META_PROBADO = false` y lo nuevo corre SÓLO en el negocio de la plataforma.

- ⚠️ **El primer clic de Martín (25/10, link de las 12:38 con `permissionLevel=full`) NO dejó ninguna conexión**: la Zernio de la
  plataforma quedó con 0 cuentas (con las ocultas también) y 0 registros, lo mismo que los dos links del 23/10. No era el link
  vencido (se usó a los minutos) ni la cuenta de Zernio (plan por uso, pago, `hasAccess: true`: los anuncios vienen incluidos).
  **La sospecha, de la doc** (`GET /v1/connect/{platform}/ads`): con VARIAS páginas concedidas y sin `pageId`, una integración
  por API recibe un 400 («restart with pageId») y la conexión no se crea; sólo el panel de Zernio abre el selector de página. El
  script ahora manda la página de MaKo. **Confirmado por el segundo clic** (12:44, con `pageId` = «Hola MaKo»): volvió con
  `connected=metaads&accountId=6ade25185b6c93612b7cc6a1&stage=callback` y la conexión quedó (ve `act_1426493815659364` y un
  píxel). ⚠️ **Vale para los CLIENTES:** el botón (`REDES.metaads`, lib/zernio-redes.ts) tampoco manda `pageId`; un negocio con
  más de una página no conectaba nunca (el primer clic volvió sin conexión y sin nada que lo explicara). **HECHO el mismo día**,
  copiado de lo que hace Zernio en su app (un selector de página): MaKo junta las páginas que conoce del negocio (la de la
  conexión vieja, `META_PAGE_ID`; las de su Facebook en Zernio, `GET /v1/accounts/{id}/facebook-page`; las de una conexión de
  anuncios que ya exista) y decide con `paginaParaConectar`: UNA conocida se manda sola (también desde el botón del Media
  Buyer: la deduce el server en `urlConectarViaZernio`), con VARIAS se pregunta antes de abrir la ventana, y si la ventana
  vuelve sin conexión habiendo abierto sin página, el modal de Meta pide la página (de la lista o su ID) y reintenta con ella.
  ⚠️ **No se lee el error de Zernio para decidirlo**: la forma exacta de esa vuelta («400 with available Page IDs») no está
  medida, y un texto de un tercero no es un contrato. `GET /v1/connect/facebook/select-page` existe, pero para el inicio de
  sesión para empresas la doc sólo lo describe con el `selectionToken` del panel de Zernio.
- **La prueba de lectura (25/10, 12:50) contestó con la forma esperada y sin errores**, pero sobre una cuenta que NUNCA
  gastó: insights `data: []`, ningún conjunto, la cuenta activa y en verde (USD, Argentina) y las finanzas leídas (con `full`).
  O sea: el camino anda; que las filas sean las de Meta directo NO se pudo comparar (sin entrega no hay filas). Se probó SIN
  guardar la conexión en producción: con el código viejo desplegado, la cuenta guardada metía al negocio de MaKo en los crons
  de Meta con el token del botón (sin `ads_read`). `guardar --si` va después del deploy.
- **Con el deploy (main 9c684f88c, 25/10 14:54) se guardó la conexión en el negocio de MaKo** (`META_ZERNIO_CUENTA`, la cuenta,
  el píxel; la página «Hola MaKo» ya estaba). Medido con las funciones REALES de producción, sin el script: `integracionConectada`
  da Meta conectada, `fetchMetaInsights` y `fetchAdsetBudgets` leen por Zernio (cero filas, cero errores), la salud da activa y
  en verde, CAPI sale por la conexión de Facebook al píxel, y `ver_conexion_meta` de la API lo devuelve todo sin tokens. Desde
  ahí los crons de Meta corren para el negocio de MaKo por Zernio. Lo que sigue sin medir: filas reales (la cuenta nunca gastó)
  y CAPI (falta el código de «Probar eventos»).

- **CAPI por Zernio, PROBADO el 25/10 (~20:35 UTC) con el código de «Probar eventos» TEST96217** sobre el píxel de MaKo
  (`1869323014511830`), con la conexión de permiso «Control total»: dos Lead de prueba, uno por el script (`capi --si`:
  `eventsReceived: 1`, `eventsFailed: 0`, fbtrace `AW5-rkSpUET8ixrvKTtm9R8`) y otro por el camino entero de la app
  (`probar_capi_meta` → `sendMetaCAPIEvent` → Zernio: recibidos 1). Con eso se prendió `ZERNIO_META_PROBADO`. Sigue sin medir si
  alcanza «Administrar campañas» (`advertise`): por eso el botón pide «Control total».
- ⚠️ **El diagnóstico obvio («no aparecen en Probar eventos → CAPI no llegó») era el equivocado: llegaron, como eventos REALES.**
  `/{pixel}/stats` (por Zernio, `tracking-tags/{id}/stats`) mostró 2 «Lead» en la franja de las 20:00 UTC con la clave de match
  `email` y NADA más (ni cookies, ni `fbp`, ni navegador): son los de prueba (sólo llevaban `prueba@hola-mako.com`); uno de la
  landing trae cookies. O sea: **Zernio no reenvía el `testCode`** aunque su doc dice «Meta `test_event_code` passthrough». El
  píxel de MaKo quedó con 3 Lead falsos (los de las 20:35 y 20:36 en la franja de las 20:00 UTC, el de las 21:41 en la de las 21:00, los tres con match `email` y nada más) (sin campañas corriendo: no movieron ninguna optimización; lo que entra por CAPI no se
  borra). **La regla:** una prueba de CAPI nunca manda un evento que cuente (`EVENTO_DE_PRUEBA_CAPI = 'PruebaMaKo'`), y para ver
  si un evento llegó, `aggregation=match_keys` de las estadísticas del píxel dice QUÉ lo identificó (un evento de servidor con sólo
  email es el nuestro). El reclamo a Zernio, redactado para que Martín decida.
  **Verificado en la pantalla de Meta** (el Cerebro, en el Administrador de eventos del píxel): «Información general» → «Cliente
  potencial · Activo · API de conversiones · 2», y nada en «Probar eventos». **Para la próxima:** la API de Zernio no tiene otro
  campo para el código de prueba (sólo `testCode`; `platformData` va únicamente a `custom_data`, no a la raíz del evento), así que
  una prueba de CAPI por Zernio va contra un PÍXEL DE PRUEBA, nunca contra uno con anuncios que optimizan por Lead; y si se prueba
  en un píxel real, con un evento propio (`PruebaMaKo`), nunca con uno estándar.
- **La deprecación del token (25/10, tarde):** el corte para ADMINISTRAR anuncios es una fecha (`CORTE_TOKEN_META`, `null` hasta
  que sale el aviso) y un solo freno (`frenoDelTokenMeta`) en las puertas que escriben con el token; leer no se corta. ⚠️ **Una
  conexión hecha desde la tarjeta de Zernio no llegaba a MaKo:** sólo el modal de Meta guardaba la conexión de anuncios en el
  negocio, y el link del aviso abre la tarjeta de Zernio. Ahora la guarda la pieza común (`conectada-meta`), venga del botón que
  venga. ⚠️ **El logo de Zernio no era el suyo:** iba una «Z» sobre violeta #6D4AFF; su ícono oficial es la marca blanca sobre
  #EB3514 (zernio.com/icon.svg).

**Sin hacer, con su archivo:** lo que sigue leyendo SÓLO por el token (el inventario entero está en el relevo): el árbol de
`/integraciones` y de la API (`lib/meta-health.ts`, `_getMetaHealth`: las ramas de campañas, conjuntos y anuncios fallan
suave y quedan `parcial`); el reproductor del anuncio
(`app/api/anuncios/video/route.ts`); las escrituras de la API de MaKo y del doer (`lib/meta-write.ts`; el Media Buyer ya
escribe por Zernio); los formularios de leads y el barrido de leads (`lib/meta-ads-create.ts`, `lib/meta-leads.ts`; existe
`GET /v1/ads/leads?since=`); los píxeles y eventos del selector de campañas (`listPixels`, `listPixelEvents`); el perfil de
Instagram (`lib/instagram-perfil-server.ts`, `app/api/crm/instagram-buscar/route.ts`); y el botón para la cuenta de MaKo (el
ws9 no tiene Zernio propia: su conexión sale por el script).

*25/10/2026, chat «Zernio y CAPI» (`claude5`).*

## Vimeo, Wistia, Bunny Stream y Cloudflare Stream como integraciones (25/10/2026, claude5)

Pedido de Martín (por el Cerebro, «otros alojadores de video»). Las cuatro van en los cuatro registros de siempre:
la tarjeta (lib/integraciones-catalogo.ts), los campos y el tutorial (lib/metodo-catalogo.ts), el ping
(lib/metodo-verificar.ts) y el logo (app/_components/ServicioVisual.tsx). Van pegadas a Panda, que es la zona que Settings
no tocó en su rama.

**Lo que no era obvio:**
- **Las claves de la tarjeta y las que lee el catálogo tienen que ser las mismas** (`envs` contra `CLAVES_ALOJADOR` en
  lib/alojadores-video-api.ts). Si se separan, conectar la tarjeta no trae ni un video y nada lo dice.
  tests/alojadores-video-catalogo.test.ts las compara.
- **Cloudflare no contesta 401 a un token mal formado: contesta 400 con el código 9106** («Authentication failed»). Uno con
  buena forma pero inexistente sí da 401 (código 10000). Los dos son «el token no sirve». Sin mirar el código del error, el
  ping decía «Cloudflare respondió 400», que no le dice nada a quien lo pegó.
- **Bunny tiene dos claves**: la de la cuenta y la de cada BIBLIOTECA. La que sirve para leer videos es la de la biblioteca,
  y además va el Library ID. El ping lo dice si pegan la otra.
- **Bunny no está en simple-icons** (404 en la 13.21.0), así que va con su inicial sobre el naranja de bunny.net
  (#FD8D32, el de su página). Vimeo, Wistia y Cloudflare llevan el mark oficial.

**Probado:** los cuatro pings contra las APIs REALES con claves inventadas contestan «inválido» con el motivo. Un ping que
diga «válido» necesita una cuenta real de cada uno: queda para cuando Martín conecte una.

## Conectar por Zernio la cuenta publicitaria de OTRO portfolio: un perfil aparte, y la vuelta que se tragaba el error (25/10/2026)

**Vive en:** `lib/zernio-ads.ts` (`urlConectarAnunciosZernio`, `conexionAnunciosZernio`) · `lib/zernio-redes.ts`
(`retornoDeZernio`, `errorDeVueltaAjena`) · `app/_components/ConectarViaZernio.tsx` (la vuelta de página entera).

Para probar el Media Buyer en la cuenta de un cliente (Mauricio, con permiso de Martín) hubo que conectar su cuenta a la
Zernio de la plataforma. Costó tres clics de Martín; esto es lo que no se ve en la doc de un vistazo.

- **El diagnóstico obvio era «Martín no marcó las cuentas», y era el equivocado.** Las marcó. Zernio conecta los anuncios
  con el inicio de sesión para empresas de Meta: el permiso es de UN portfolio (el que se elige primero), y las cuentas de
  otro portfolio no entran aunque la persona las vea. La conexión de la plataforma es del portfolio de MaKo.
- ⚠️ **Zernio guarda UNA conexión de anuncios por perfil, y un login nuevo en el mismo perfil la RECONECTA** (si comparte
  alguna cuenta, cambia el alcance por el nuevo; si no comparte ninguna, lo rechaza con `reconnect_mismatch`). Conectar la
  cuenta de un cliente en el perfil de MaKo podía cambiar o tirar la de MaKo, que el CAPI usa con «Control total». El
  camino seguro: un perfil de Zernio aparte (`POST /v1/profiles`), sólo para eso, y borrarlo al terminar.
- ⚠️ **La vuelta se tragaba el error.** `/ads-manager` (y toda pantalla con `ConectarViaZernio`) saca de la barra lo que
  agrega Zernio, y si la pestaña no había empezado el login (un link abierto suelto) no decía nada: Martín aceptó dos veces
  y nadie supo que no había conectado. Ahora un `error=` igual se dice, con el texto de MaKo y no el de la URL
  (`errorDeVueltaAjena`; un éxito ajeno sigue sin hacer nada). Para un link armado a mano, volver a una página que no toca
  la barra (la landing) deja leer `connected=metaads` o el `error=`.
- **El estado de pago de cada cuenta sin leer el token del cliente:** `GET /v1/ads/accounts` trae `billingStatus`
  (`ok` o `missing`), `accountStatus` y `minimumDailyBudget`. La de MaKo dice `missing`. ⚠️ Pero `ok` no alcanza: la
  «Cuenta 1» de Elévate decía `ok` y Meta igual frenó el anuncio por el método de pago (docs/hallazgos-ads.md).
- **Borrar el perfil de prueba:** primero `DELETE /v1/accounts/{id}` (desconecta; Zernio da un período de gracia) y después
  `DELETE /v1/profiles/{id}`. Verificado el 25/10: quedó sólo el Default, con la conexión de MaKo intacta.

**Sin hacer:** el botón de conectar no deja elegir el perfil de Zernio (siempre el Default del negocio): conectar un
segundo portfolio en un mismo negocio hoy se hace por script.

*25/10/2026, chat «Media Buyer» (`claude5`).*

## El cobro de Zernio, YouTube sin clave y el tutorial del token que se va (27/10/2026)

**Vive en:** `lib/zernio-redes.ts` (`avisoDeCobroZernio`, `textoAvisoCobro`) · `lib/zernio-conectar.ts` (`urlConectarViaZernio`) ·
`app/_components/ConectarViaZernio.tsx` (el aviso) · `lib/metodo-catalogo.ts` (`retirado`, YouTube, el tutorial de Meta) ·
`lib/youtube.ts` (`claveDeYoutube`).

- ⚠️ **Zernio cobra por cuenta ACTIVA de toda su cuenta (el equipo), no por perfil:** 1 a 2 gratis; de la 3.ª a la 10.ª, US$6 por
  mes cada una, prorrateado por día (su tabla de precios, leída el 27/10). La página de Facebook, el Instagram y la conexión de
  anuncios (`metaads`) cuentan UNA vez cada una; las ocultas y desconectadas no cuentan. Sin tarjeta, la 3.ª da 402
  `free_tier_exceeded`. Una línea fija en la tarjeta («desde la 3.ª se paga») no alcanzó: a Leila le cobró US$16. Ahora el servidor
  cuenta TODA la cuenta (`/accounts` sin `profileId`) antes de pedir el link y, si la que viene se paga, contesta `cobro`; la
  pantalla pregunta y «Conectar igual» vuelve con `aceptaCobro`. Sólo con la clave del negocio (con la de MaKo paga MaKo) y nunca
  al reconectar. Volver a entrar con una red que ya tiene cuenta no avisa: Zernio conserva el id y no suma.
- **YouTube no necesita la clave de cada negocio:** las vistas de un video son PÚBLICAS y leerlas cuesta 1 unidad de las 10.000
  diarias de la clave de MaKo (`claveDeYoutube`: la del negocio si la tiene, si no la de la plataforma; buscar tutoriales ya hacía
  eso, era una copia). La tarjeta ya no pide la clave (`retirado`: sólo se ve si estaba cargada), «conectado» es tener el video del
  VSL, y el canal se conecta con el login de Zernio. Medido antes: el único negocio con YouTube es Mauricio Bustos, con la clave Y el
  video cargados como credenciales, así que sigue conectado y en el cron.
- **El tutorial del token de Meta ya no enseña a sacarlo** (Joan se perdió ahí: «tenía 45 pasos pero estaba muy resumido»): avisa
  el corte del 03/11 con la MISMA fecha que `CORTE_TOKEN_META` (un test lo cruza) y lleva a «Conectar con Facebook».
- **Los negocios de Joan, medidos (sólo lectura):** Brigitte Eberlin usa el token (gasto y leads en 30 días; ya está en el aviso del
  27/10); Pablo Chávez, Sergio Arriata y Patricia Contreras lo tienen cargado sin pautar desde MaKo, y Sergio y Patricia no tienen
  píxel (no les sale ningún evento a Meta, con token o sin él). «Calificado» sale por la misma puerta de CAPI que se midió por Zernio.

**Sin hacer (con dónde vive):** varias claves de Zernio en un negocio (de distintos emails), eligiendo cuál usa cada red. No es un
campo más: cada clave es otro equipo de Zernio con su propio perfil, su propio webhook y su propio secreto de firma, así que tocan
el canal (`cfg`/`asegurarWebhook`, lib/zernio.ts; la verificación del webhook, app/api/webhooks/zernio/route.ts; el ruteo por perfil),
los anuncios (`claveZernioAnuncios`, lib/zernio-ads.ts, del Media Buyer) y la conexión (`contexto`, lib/zernio-conectar.ts). Plan en
docs/relevo/zernio-capi.md.

*27/10/2026, chat «Zernio y CAPI» (`claude5`).*

## MaKo le dijo a Joan que el token de Meta «seguía igual»: el tutorial ya estaba arreglado, y no alcanzó (27/10/2026)

**Vive en:** `lib/conexiones-catalogo.ts` (`META_POR_ZERNIO`, `importanteDe`) · `lib/api-mako/areas/integraciones.run.ts`
(`linkIntegracion`, `como_conectar`, `ver_integracion`, `ver_integraciones`) · `lib/mako-doer-in.ts` (`DEEP_LINKS`, la guía) ·
`lib/hechos-mako.ts` · `lib/capas.ts` (`POSTERGABLE_TXT`). Lo fija tests/meta-sin-token.test.ts con la pregunta textual de Joan.

- ⚠️ **El diagnóstico obvio era el equivocado: el tutorial del token ya se había retirado esa mañana.** MaKo igual contestó «Sí» y
  mandó a `?abrir=meta` porque lo que sabe de conectar Meta NO sale del tutorial: el prompt traía «Meta Ads: …?abrir=meta» (el
  catálogo arma la ruta con la key de la tarjeta), los `DEEP_LINKS` del doer traían «Salud de la cuenta de Meta: …?abrir=meta», la
  guía de WhatsApp y `como_conectar` tomaban el tutorial del MODAL de Meta (cuyo primer paso todavía decía «El token de Meta se
  retira…»: la palabra token confirmaba la pregunta), `ver_conexion_meta` devolvía `via: 'token_de_meta'` y `ver_integraciones`
  listaba «Access token» como campo que falta. Cinco lugares, ninguno era el tutorial.
- **La regla:** una tarjeta que se conecta en OTRA (Meta, en la de Zernio) lo declara en el catálogo (`ruta`, `pasos`,
  `aclaracion`), y quien guía toma `c.pasos` ANTES que el tutorial del modal. Los links de la API salen del catálogo
  (`linkIntegracion` → `conexion(key).ruta`), nunca de `?abrir=<key>` armado a mano. `?abrir=meta` queda para ver la cuenta, el
  píxel y la salud. Y lo que se retiró no se nombra: «ya no hace falta el token» igual le hace buscar un token a quien lee rápido.
- Conectar «Anuncios de Meta» desde la tarjeta de Zernio guarda la conexión de Meta igual que el botón del modal de Meta
  (`conectada-meta`), y el servidor deduce la página si no viene (`paginaParaConectar`): por eso la ruta puede ser la de Zernio.

**Sin hacer (con dónde vive):** el «simple login de Facebook» lo es sólo para un negocio con su API key de Zernio pegada: sin ella,
la fila «Anuncios de Meta» no aparece (app/integraciones/ConectarRedes.tsx, abajo de la clave; BYOK desde el 23/10, lib/zernio.ts).
Los pasos lo dicen en una línea. Y el test cubre el camino del CÓDIGO con la pregunta de Joan (la conexión, el link, los pasos, el
prompt), no la frase que arma el modelo.

*27/10/2026, chat «Zernio y CAPI» (`claude5`).*

## Instagram orgánico por Zernio: la primera fuente de redes orgánicas de MaKo (28/10/2026)

Martín a Teo (28/10, 00:16:26): «por WhatsApp preguntás cómo vienen las últimas publicaciones de Instagram». MaKo no tenía
ninguna fuente de redes orgánicas. Chat «Zernio y CAPI», pedido del Cerebro (C:/dev/revisiones/2810-promesas-teo.md).

**Vive en:** `lib/organico-reglas.ts` (puro) · `lib/zernio-organico.ts` (`rendimientoInstagram`) · la operación
`ver_rendimiento_redes` (área contenido, canal WhatsApp) · tests/organico*.test.ts.

- **Lo que Zernio da (su documentación, 28/10; no medido con una cuenta real):** `GET /v1/analytics/instagram/account-insights`
  (alcance, vistas, cuentas que interactuaron, interacciones, me gusta, comentarios, guardados, compartidos, visitas al perfil;
  sólo `reach` tiene serie, el resto es `total_value`; hasta 90 días), `…/follower-history` (la serie de seguidores, ganados
  y perdidos; hasta 89 días: Meta sacó `follower_count` de sus insights) y `GET /v1/analytics` (las publicaciones con sus
  métricas, también las que no se publicaron por Zernio: `source=all`). Los datos pueden tardar hasta 48 h.
- ⚠️ **Es PAGO y aparte: el complemento de Analytics de Zernio.** Sin él contesta 402; MaKo lo dice en palabras («la cuenta de
  Zernio no tiene el complemento de Analytics», y cómo prenderlo) en vez de «error». **Decidido (el Cerebro, 28/10):** con la
  clave propia (lo vigente desde el 23/10) el complemento lo prende y lo paga el NEGOCIO en su cuenta de Zernio, como cada negocio
  paga lo suyo.
- ⚠️ **«No pude leer» no es «cero»:** una métrica que no vino, o una respuesta con otra forma, es null y va dicha en `faltan`;
  las tres lecturas van a la vez y una que falla no tumba a las otras. La forma de la LISTA de `/v1/analytics` no está en su
  documentación (sólo el ejemplo de un post): se acepta `posts`, `data` o `items`, y sin ninguna es «no sé leer», no «no hay».
- **El id de la operación no nombra la red:** tests/sin-instagram.test.ts prohíbe `/instagram|zernio/` en los ids. Y cada
  operación que sale por HTTP necesita su ruta en `RUTAS_REST` (lib/api-mako/rest.ts): sin ella, tests/api-mako-rest.test.ts
  da rojo y frena el tren (pasó con ésta y con `programar_publicacion`).
- ⚠️ **`publishedAt` viene en UTC (con Z): el día se saca en la zona del negocio** (`diaLocal`). Cortarlo a 10 caracteres corría
  al día siguiente todo lo publicado entre las 21:00 y las 23:59 de Buenos Aires, la franja fuerte de Instagram (la
  verificación del 28/10). **No medido:** en qué zona filtra Zernio `fromDate`/`toDate` (su documentación dice sólo
  «YYYY-MM-DD»); si es UTC, de noche «hasta hoy» deja afuera lo de después de las 21:00.
- ⚠️ **Mientras sincroniza, Zernio manda 0, no null.** `syncStatus` (synced | pending | partial | unavailable, y por red en
  `platformAnalytics[].syncStatus`) y `analytics.lastUpdated` null dicen que todavía no hay métricas: ese post va con sus
  números en null, marcado (`sin_metricas`) y contado en `faltan`. Si no, el reel recién publicado (justo el que se pregunta
  por WhatsApp) decía que nadie lo vio. Un post `synced` con 0 sigue en 0.
- **Lo que Zernio dice que no entregó** (`unavailableMetrics: [{ metric, reason }]`, documentado en follower-history) va dicho
  en `faltan` con su motivo, no sólo en null.
- **Una cuenta nombrada que no está** (un error al tipear el usuario) es un error con las conectadas, no los números de la primera.
- ⚠️ **Con la clave de la CUENTA DE MaKo** (el ws1, o un negocio con la cuenta prestada: `cfg(ws).byok` false) los textos no le
  hablan al negocio de «tu cuenta» ni de quién paga (`textoOrganico(m, deLaCasa)`). La misma regla en Conectar: `motivoDeError`
  miraba sólo `ws === OWNER_WS`, y a un negocio con la cuenta prestada un 402 le decía «Tu cuenta de Zernio está pausada» con el
  link de pago de MaKo; ahora `esDeLaCasa(ws, cfg)` (lib/zernio-conectar.ts) cuenta también la prestada.
- **Sin hacer:** las plantillas de Instagram del Dashboard (Reels, Historias, DMs) y el reporte de agencia sobre esta fuente; los
  DMs (Zernio no los da como métrica); medir la forma real con una cuenta que tenga el complemento (y si Zernio rechaza la falta
  del complemento con otro status que el 402 documentado: un 403 hoy se dice «clave-mala»).

## Conectar Instagram y Facebook sin pegar una clave de Zernio: la cuenta de la plataforma, detrás de un interruptor (28/10/2026)

Martín a Teo (28/10, 00:27:36): «te logueás con Instagram y Facebook, escaneás el QR y ya tiene acceso a todo». El Cerebro: sin
pegar una clave de Zernio, con la cuenta de la plataforma y un perfil por negocio. Chat «Zernio y CAPI».

**Vive en:** `lib/zernio.ts` (`cfg`, `plataformaPrestaSuCuenta`, `keyDeSeguimiento`) · tests/zernio-plataforma.test.ts ·
tests/zernio-sin-respaldo.test.ts (la regla nueva).

- ⚠️ **Da vuelta una decisión del 23/10** («que cada usuario traiga su API de Zernio», lo fijaba tests/zernio-sin-respaldo.test.ts).
  No se reconstruyó nada: el modo de la cuenta de la plataforma seguía vivo para el ws1 (el perfil `mako_ws_<ws>` que acuña
  `ensureProfile`, el ruteo por perfil y el webhook firmado con el secreto maestro). Faltaba sólo que `cfg` cayera a esa key.
- **La regla:** la key propia gana; sin ella, la de la plataforma (`byok: false` → su perfil por negocio) SÓLO si el negocio de
  la plataforma prende `zernio.cuenta_de_la_plataforma` = '1' (app_settings). Nunca para el negocio de la plataforma. «No pude
  leer» el interruptor tira (no es «apagado»). La clave de «¿te sigue?» es la misma de `cfg`.
- ⚠️ **Apagado por defecto, porque es PLATA:** con la cuenta de la plataforma, cada cuenta conectada de cada cliente (Zernio cobra
  desde la 3.ª) y el complemento de Analytics los paga MaKo. **ESPERA LA DECISIÓN DE MARTÍN AL PRENDER** (el Cerebro, 28/10):
  quién paga cada cuenta conectada y el complemento con la cuenta de la plataforma se decide al prenderlo, no antes. Hasta
  entonces queda apagado, y la pantalla de /integraciones y el paso del onboarding esperan esa misma decisión.
- **Los anuncios no cambian:** `claveZernioAnuncios` (lib/zernio-ads.ts) sigue con la key del negocio.
- **Sin hacer:** en /integraciones el modal de Zernio sigue pidiendo la key (`ConectarRedes` sólo se ve con una key cargada,
  app/integraciones/ServicioConfigForm.tsx) y su nota dice «Zernio te cobra a ti»: con el interruptor prendido, hay que mostrar
  «Conectar» sin key y decir quién paga. El onboarding no tiene todavía un paso «Conectá Instagram y Facebook» (y
  tests/sin-instagram.test.ts prohíbe un paso de onboarding cuyo texto nombre Instagram: hay que decidir cómo se llama). El aviso
  de «la 3.ª cuenta se paga» (`aceptaCobro`) es de la cuenta del negocio: con la de la plataforma no le corresponde.

## Los límites de Zernio, dichos al conectar, y de dónde se leería el consumo de mensajes (29/10/2026)

Martín (28/10): «Super importante advertir en la conexión de Zernio las limitaciones, como que hasta 2 redes sociales es gratis».

**Vive en:** `lib/zernio-redes.ts` (`textoGratisZernio`, `MENSAJES_GRATIS_ZERNIO`, `ANUNCIOS_GRATIS_ZERNIO`, `USD_CUENTA_EXTRA_ZERNIO`,
`textoAvisoCobro`) · `app/integraciones/ConectarRedes.tsx` (la línea, abajo de la de las cuentas) · tests/zernio-aviso-cobro.test.ts.

- **Lo gratis, de zernio.com/pricing (leído el 28/10 23:40 y otra vez el 29/10 02:20):** 2 cuentas; 10.000 mensajes ENVIADOS por mes
  (los recibidos, los comentarios y las reseñas no cuentan; los DM de X y los SMS van aparte); 500 anuncios gestionados. Sin tarjeta,
  al llegar a 10.000 los ENVÍOS se frenan hasta el mes siguiente (leer, Analytics y publicar siguen); con tarjeta, US$1 cada 10.000.
  ⚠️ La página se contradice: la tabla dice US$6 de la 3.ª a la 10.ª y su FAQ dice «$6/account for 1-10». Vale la tabla (2 gratis,
  y así cobró a Leila).
- ⚠️ **Analytics NO se promete.** La página dice «incluido en cada cuenta», la doc dice que `follower-stats` pide el complemento, y
  MaKo midió un 402 que lo pedía. El test fija que el texto no lo nombre hasta que alguien lo mida con una cuenta real.
- ⚠️ **La nota de la key no da para los límites:** el tope de una nota es una línea (120, tests/tutoriales-legibles.test.ts) y su
  texto lo fija tests/zernio-sin-respaldo.test.ts. Los límites van en el modal, abajo de la línea de las cuentas (con la key guardada).
- ⚠️ **[DADO VUELTA esa misma tarde: ver «Varias claves de Zernio por negocio…», abajo.]** **La salida gratis «conecta otra
  cuenta de Zernio (de otro email)» NO se dice NUNCA** (Martín, 29/10, por el Cerebro: cada
  negocio con SU cuenta de Zernio; si necesita más, paga su plan). Varias cuentas gratis para un mismo negocio arriesgan la
  suspensión de Zernio (abajo, sus términos), y una suspensión le corta las publicaciones al cliente. La única salida gratis que se
  dice va en el aviso de la 3.ª: «desconecta en zernio.com una que ya no uses» (Zernio cobra sólo las activas).
- **El consumo de mensajes del mes (para avisar antes del tope de 10.000, el audio de Leandro): medido a medias.** La OpenAPI v1.358
  tiene `GET /v1/usage` (sin parámetros: la foto del plan; con `range=cycle&granularity=total`: lo FACTURADO en USD por familia, con
  `lineItems[]` de `product: 'messages'` y `quantity`) y `GET /v1/billing` (el ciclo: `period.start/end`). Medido el 29/10 con la
  clave de la plataforma (sólo lectura): las dos contestan 200, cuenta `metronome` (por uso), ciclo del 01/10 al 01/11; pero esa
  cuenta no tiene redes ni envíos, así que `lineItems` sale vacío. Con la clave del ws10 (Fiesta Music, el sí del Cerebro, sólo
  lectura): ciclo del 12/10 03:00Z al 01/11 (`anchorDay` 12: el ciclo arranca el día que el negocio se dio de alta, no el 1.º), y
  `lineItems` trae SÓLO «Connected Accounts (priced)» y «Free Tier Credit applied» (la cuenta gratis se factura y se descuenta), sin
  línea `messages`. ⚠️ **Eso no prueba que los mensajes gratis no aparezcan:** el ws10 no mandó NADA por MaKo en el ciclo (38
  entrantes, 0 salientes), y **MaKo no mandó ni un mensaje por redes desde el 01/09 en ningún negocio** (0 filas sociales en
  `nutricion_envios`, donde viven los envíos del motor; 0 salientes en `ig_mensajes`, donde viven los de Chats). Hoy nadie está
  cerca del tope, y no hay cuenta con qué medir. La salida: contar en MaKo lo que MaKo manda por Zernio en el CICLO (no ve lo que se
  manda desde el inbox de Zernio u otra herramienta con la misma cuenta: el aviso dice «desde MaKo») y, cuando un negocio pase los
  10.000, mirar si `lineItems` trae `messages` con su `quantity`.
- **El conteo, hecho (29/10): `usoZernioDelCiclo(ws)` (lib/zernio-uso.ts).** El reparto con Automations, para que no salgan dos
  avisos: el canal cuenta y lee el ciclo; Automations avisa (`avisarTopesSociales`, al 80%, una vez por ciclo, el evento
  `social_tope` con el estado «gratis»). Devuelve `{ enviados, gratis, desde, hasta, deLaCasa }` o null. ⚠️ Es una aproximación,
  y en las dos direcciones: una fila del motor (`nutricion_envios`) es UN mensaje aunque el paso saliera en varias partes (para
  Zernio son varias), y la respuesta PÚBLICA a un comentario (gratis) cuenta igual porque la fila no la distingue de un DM. Para
  contarlo exacto, el motor tendría que guardar cuántas partes salieron y marcar la pública (es de Automations). ⚠️ No vive en
  lib/zernio-redes.ts: ese módulo lo importa el navegador (ConectarRedes, ConectarViaZernio), y esto habla con la base y con Zernio.
  Por eso es un archivo del canal nuevo, sumado a la lista de tests/sin-instagram.test.ts.
- **Los términos de Zernio están en zernio.com/tos** (no en /terms ni /terms-of-service, que dan 404; la portada no los enlaza),
  fechados el 09/10/2026. Leídos el 29/10: NO hablan de varias cuentas gratis, de agencias ni de compartir claves; sólo «Abuse of
  the API may result in immediate suspension of your account» (sección 3) y que se cobra por cuenta social conectada (sección 4).
  Varias cuentas gratis para un mismo negocio no está prohibido por escrito, pero «abuso» queda a criterio de Zernio. Por eso
  Martín dijo que NO (29/10): varias claves de Zernio por negocio quedó DESCARTADO, no pendiente. ⚠️ **Dado vuelta esa tarde**
  (Martín: «pegar una segunda API key con otra cuenta de Gmail del cliente»): ver la entrada de las varias claves, abajo.

## Una sola pestaña, la de Zernio, y ningún token de Meta a la vista (29/10/2026, ticket #28)

Martín, por WhatsApp (29/10 12:56): «en una sola pestaña, la de Zernio, se pueda configurar tanto para pegar primero tu API y
después para loguearte... ya no debería pedirte nada de Access Token. Toda esa parte de los tokens ya no debería existir».

**Vive en:** `lib/integraciones-catalogo.ts` (`SE_CONFIGURA_EN`, `integracionQueConfigura`, `META_SE_CONECTA_EN_ZERNIO`) ·
`app/_components/ConectarIntegracion.tsx` (`abrir`) · `app/integraciones/IntegracionesBoard.tsx` (`?abrir=`) ·
`app/integraciones/ServicioConfigForm.tsx` (los pasos de Zernio; el modal de Meta lleva a Zernio; `esTokenDeMeta`) ·
`app/integraciones/ConectarRedes.tsx` (el paso 2, con `ConectarMetaZernio`) · `lib/integraciones.ts` (la tarjeta de Meta) ·
tests/zernio-una-pestana.test.ts.

- **La regla:** una integración que se configura en OTRA tarjeta se dice en un solo lugar (`SE_CONFIGURA_EN`: `meta → zernio`), y
  lo usan las dos puertas: `?abrir=` (avisos, la API, MaKo en WhatsApp) y el botón de cualquier tab (`useConectarIntegracion`).
  La tarjeta de Meta se queda (es el ESTADO de la cuenta: saldo, medio de pago, entrega frenada), pero su modal no pide nada.
- ⚠️ **El diagnóstico obvio («ocultar el campo del token») era corto:** el token aparecía en NUEVE lugares que ve un cliente o
  MaKo. El campo del modal estaba oculto sólo con Zernio activo; sin la clave de Zernio aparecían «Conectar con Meta / O pega un
  token abajo». Además estaban las notas de cuatro campos («lo completa MaKo al pegar el token»), las ayudas que enseñaban a
  generar tokens y el «Token del píxel», visible para todos. También: `ver_integracion`, que listaba el token cargado (el modelo
  lo explicaba); `ver_conexion_meta` («token_del_pixel»); dos descripciones de herramientas; los avisos de la conexión y del Media
  Buyer; y dos errores de la extracción del onboarding. **Regla:** un concepto retirado se barre por lo que se LEE, no por el
  campo. El test fija una regex de «nombra el token» sobre cada lugar.
- ⚠️ **Y la grilla tenía su propio hueco:** medía Meta con los `envs` de la tarjeta (el token y la cuenta), así que un negocio
  conectado SÓLO por Zernio quedaba «Sin conectar» y lo que faltaba era el token. Los otros tres lectores ya usaban
  `metaConectadaConCampos`; la grilla no. Lo que falta ahora se dice en palabras (`META_SE_CONECTA_EN_ZERNIO`).
- **Lo que no se rompe:** el token guardado no se borra y sigue de respaldo. El corte es el **03/11** (`CORTE_TOKEN_META`): Martín
  dijo «el 11», que es el mes. Desde ese día se frena escribir con el token, pero LEER sigue, porque el aviso que salió el 28/10
  lo prometió («Tus números se siguen viendo»). Cortar también la lectura es otra decisión, con otro aviso.
- **Sin verificar en el navegador:** no se levanta `next dev` local (regla). Lo fijan tests de fuente; la primera vez que un
  cliente conecte desde la pantalla nueva hay que mirarla en producción.
- **Sin hacer:** el ID del conjunto de datos de CRM (`META_CRM_DATASET_ID`, opcional) sólo se carga desde el modal de Meta con
  «Cargarlos a mano». Ese modal ya no se abre con `?abrir=meta`, sólo desde su tarjeta.

## Varias claves de Zernio por negocio, todas las redes en Integraciones y el Calendario publicando en ellas (29/10/2026)

Martín, 29/10 (audio en SuperAdmin, por el Cerebro): «Lo que yo habilito en MaKo es la posibilidad de pegar una segunda API key con
otra cuenta de Gmail del cliente... y ya tendrías cuatro redes... te advierte: "che, esta es la tercera cuenta..."». Y: «aprovechar
todas las conexiones que tiene [Zernio] para implementar en integraciones todas las redes sociales... Y que aparezcan en
integraciones». **Da vuelta el «NO a varias cuentas» de esa misma mañana** (la entrada de los límites, arriba): gana lo posterior.
Cada clave es de una cuenta de Zernio DEL CLIENTE (su Gmail); MaKo no crea cuentas y ningún texto promete «gratis para siempre».

**Vive en:** `lib/zernio.ts` (`clavesZernio`, `cfgDeCuenta`, `cfgDeHuella`, `perfilDeClaveExtra`, `asegurarWebhook` por clave) ·
`lib/zernio-conectar.ts` (`claveParaConectar`, `conexionesViaZernio` junta las claves) · `lib/zernio-redes.ts` (`CLAVES_ZERNIO`,
`claveConLugar`, `textoAvisoCobro`, `REDES_CON_TARJETA`, `QUE_HACE_MAKO`, `SIN_USO_TODAVIA`, `CLAVE_SIGUE_ZERNIO`) ·
`lib/integraciones.ts` (`estadoDeRedZernio`) · `lib/calendario-publicar-reglas.ts` (`REDES_PUBLICAR`, `TOPE_TEXTO_RED`) · mig 0348 ·
tests/zernio-varias-claves.test.ts y tests/zernio-todas-las-redes.test.ts.

- **La regla de las claves: una red queda ATADA a la clave con que se conectó.** Lo que opera sobre una cuenta (un DM, un
  comentario, un post, los anuncios) habla con la clave DUEÑA (`cfgDeCuenta`, que busca el `accountId` en las cuentas de cada
  clave). Conectar va a la primera clave con lugar (`claveConLugar`: menos de 2 activas, o ya tiene esa red); con todas llenas, el
  aviso de la 3.ª red ANTES del login con [Agregar otra clave] y [Conectar igual]. El webhook se registra en CADA clave con la
  misma URL del negocio (`?w=<ws>`), así que la ruta verifica igual venga de la clave que venga.
- ⚠️ **`clavesGuardadasConBase` corta en `__`, no en `_2`** (es la de las cuentas de una pasarela: `STRIPE_SECRET_KEY__c2`).
  Llamada con `ZERNIO_API_KEY` devolvía SÓLO la 1: las claves `ZERNIO_API_KEY_2…` no aparecían nunca, sin error. Se ve en la
  primera prueba con dos claves (6/7 con la rotura). Se llama con los nombres exactos de las extra.
- ⚠️ **La caché de un minuto no puede tapar la clave recién pegada.** La clave 1 se lee SIEMPRE (`cfg`, como antes); sólo las
  extra se cachean. Conectar y la lista de redes leen sin caché (`{ fresca: true }`): quien pega la clave 2 y toca «Conectar» no
  puede recibir otra vez el aviso de la 3.ª red. Un DM de una red recién conectada con la clave 2 relee una vez (con 10 s entre
  relecturas, para que una cuenta de nadie no lea Zernio en cada mensaje). Lo que SÍ puede esperar hasta un minuto: la PRIMERA
  extra recién pegada, en un proceso que ya había leído «sólo la 1».
- ⚠️ **El perfil de una clave extra NO pasa por `profileIdEfectivo`:** ése guarda el perfil de la clave 1 en `zernio_workspace` y
  lo «suelta» si no es de la cuenta que pregunta; preguntarle con la clave 2 le borraba el perfil a la 1 (`perfilDeClaveExtra`).
- **Todas las redes:** LinkedIn, X, Threads y Google Business se conectan en el paso 2 de Zernio, y cada red tiene su tarjeta en
  «Redes sociales» (`red-<red>`), que abre Zernio y deja marcada la red que sigue. **Pinterest y Reddit se ven pero NO se
  conectan:** MaKo no publica en ellas (un pin pide el tablero; un post de Reddit, la comunidad y un título) y conectarlas gastaba
  una de las 2 gratis en nada. Bluesky, Telegram, Discord y Slack no son OAuth (usuario y contraseña de app, un código o un canal):
  no están. YouTube no tiene tarjeta de red: ya tiene la suya (las vistas del VSL), y dos «YouTube» confunden.
- ⚠️ **X pide tarjeta en Zernio aunque sea de las 2 gratis** (docs.zernio.com/quickstart: «A card only if you connect X
  (twitter), because X bills every API call»). Se dice en su fila y en su tarjeta, antes del login.
- **Lo que dice cada tarjeta es lo que hace MaKo** (`QUE_HACE_MAKO`, fijado contra `REDES_PUBLICAR` por el test): sólo Facebook e
  Instagram reciben mensajes (`cuentasConectadas` rutea esas dos); las demás publican desde el Calendario y lo dicen.
- **El Calendario publica en las cuatro nuevas** con el límite de cada una: X 280, Threads 500, Google Business 1.500 y sin video.
  ⚠️ **La base no las acepta hasta la mig 0348** (la 0342 dejó `red` en cuatro valores, con un CHECK). Sin aplicarla, elegir una
  cuenta de esas redes dice «Publicar en esa red todavía no está activo» en vez de un 500. **La 0348 está escrita, no aplicada.**
- **El «Publicar» de los editores de Video e Imagen y del Copywriter no existe:** sólo exportan o descargan. Lo único que publica
  en redes es el Calendario. Agregarlo es otra tarea.
- ⚠️ **El diagnóstico de «tests afectados» por nombre de import se perdió uno:** el ticket #28 (`af78bb488`) renombró `abrir` →
  `abrirCrudo` en la grilla y dejó rojo `tests/integraciones-vercel.test.ts` («4. un link `?abrir=`…»), que lee el archivo con un
  helper (`tablero()`) y no nombra el import. Se vio recién al correr todos los que mencionan `IntegracionesBoard`. **Regla:** para
  un componente, buscar los tests por su NOMBRE DE ARCHIVO también (`IntegracionesBoard`), no sólo por su ruta de import.
- ⚠️ **El tren encontró tres rojos más del mismo cambio, en tests de OTRAS áreas que leen `lib/zernio.ts`** (tren-ac, 29/10,
  Integración; el chat no corrió el barrido completo). `zernio-webhook-suscripcion` tapa `./credenciales` con `Module._load` y no
  traía `clavesGuardadasConBase`: 14 de 18 con TypeError, porque un stub tiene que llevar CADA función que el módulo importa.
  `zernio-leads` buscaba los dos `guardar` adentro de `asegurarWebhook`, que ahora delega en `asegurarWebhookEn` (una vez por
  clave). `instagram-respuesta-publica` pedía el path a menos de 300 caracteres de la cabecera, y la línea de `cfgDeCuenta` lo
  corrió. **Regla:** al sumar un import a `lib/zernio.ts`, `grep "'./credenciales'" tests/` y sumar la función a cada stub; al
  partir o alargar una función, buscar los tests que la recortan por su cabecera (`funcion(ZERNIO, '…')`, `[\s\S]{0,N}`).
- **El tutorial de Zernio va un paso por pantalla** (`capturas` en el tutorial del catálogo; `PasosUnoPorPantalla`), con los
  nombres de los botones tal cual los dice zernio.com («API keys», «Create API key»: la clave empieza con `sk_` y se ve UNA vez).
- **Sin hacer:** tres capturas del tutorial (el paso 2 pide entrar a una cuenta de Zernio; el 3 y el 4 son pantallas de MaKo) y
  las de la pestaña antes/después y del aviso de la 3.ª red: no se levanta `next dev` local (regla), y el build parcial pide RAM
  que esta noche no hay. Se sacan en producción, en el ws3, después del deploy. Tampoco se midió con una cuenta real el cuerpo del
  post de LinkedIn, X, Threads ni Google Business. El consumo de mensajes (`usoZernioDelCiclo`) cuenta lo que manda el negocio
  entero contra el ciclo y el tope de la clave 1: con varias claves avisa antes de tiempo (cada clave tiene sus 10.000).

## El 2.º Instagram que se cobraba sin aviso, y los leads de Meta por Zernio: el barrido, el aviso y cómo probar uno real (29/10/2026)

La llamada de Martín con una agencia de 27 clientes (29/10, docs/promesas/2910-llamada-thiago.md en `promesas-thiago-2910`): «le
entran acá los leads» de los formularios de Meta [15:12]. Y el Cerebro: un 2.º Instagram puede cobrarle US$6 por mes al cliente sin aviso.

**Vive en:** `lib/zernio-redes.ts` (`avisoDeCobroZernio` con `otra`, `claveConLugar`, `textoAvisoCobro` con `otraDe`) ·
`lib/zernio-conectar.ts` (`claveParaConectar`) · `lib/zernio-lead.ts` (`leerLeadDelRest`, `tocaBarrerZernio`) ·
`lib/zernio-leads-barrido.ts` · `app/api/cron/meta-leads-poll/route.ts` · `lib/zernio.ts` (`leadsEnElWebhook` con la cuenta de anuncios) ·
`lib/meta-conexion-zernio.ts` (`leads`) · `app/integraciones/ConectarMetaZernio.tsx` · tests/zernio-varias-claves.test.ts y
tests/zernio-leads-barrido.test.ts.

- ⚠️ **El 2.º Instagram: el atajo «ya tiene esa red = volver a entrar» era el hueco.** `avisoDeCobroZernio` no avisaba si la red ya tenía
  una cuenta activa (volver a entrar con la MISMA cuenta no suma: Zernio conserva su id). Pero «Conectar otra» sobre un Instagram ya
  conectado es OTRA cuenta: con la clave en 2, la 3.ª se cobraba sin decir nada (y con varias claves, el atajo además la mandaba
  derecho a la clave que ya tenía esa red). **Regla:** sin `reconectarId` (eso ya vuelve antes), conectar una red que la clave tiene
  es «otra» (`claveConLugar(…, { otra: true })`), y el aviso lo dice: «Otra cuenta de Instagram cuenta como una red más».
- **El barrido de leads (`barrerLeadsDeZernio`), dentro del cron de leads que ya corre cada 10 minutos** (cada 30 y en la pasada diaria:
  `tocaBarrerZernio`). Lee `GET /v1/ads/leads` (OpenAPI v1.416, medida el 29/10) y carga lo que falta por la MISMA puerta del webhook.
  ⚠️ **Lo que el REST realmente es:** la CACHÉ de Zernio, que se llena con el `leadgen` de Meta y que Zernio mismo relee de cada página
  cada 15 minutos para recuperar lo que su webhook perdió (`meta.lastCheckedAt`). El barrido recupera un `lead.received` que Zernio NO
  le entregó a MaKo; un lead que Meta no le entregó a Zernio lo recupera Zernio. Pedir más seguido que cada 15 minutos no trae nada.
  ⚠️ Trae `fieldData` CRUDO de Meta (la forma del webhook de Meta) y la fecha es `createdTime` (no `createdAt` como el webhook).
- ⚠️ **Lo que ya está NO se toca, y «ya está» no es sólo el `meta_lead_id`:** `upsertLeadFromMeta` también ACTUALIZA un lead que
  encuentra por teléfono o email (pisa el `meta_lead_id`, deja la campaña en null y avisa «lead fusionado»). El barrido carga sólo el
  `meta_lead_id` que no está en `leads` NI en la papelera, y además con `soloCrear` (`noTocarExistente`): la persona que ya es un lead
  se deja como está, sin conversión ni aviso. **El diagnóstico obvio era el equivocado:** «ya está» por id parecía alcanzar, y una
  persona con DOS formularios (la ficha tiene el id de B) hacía que cada barrido cargara A, la fusionara, y la vez siguiente B: la
  ficha iba y venía cada 30 minutos (revisión de privacidad del 29/10, M3; lo prueba tests/_zernio-leads-barrido-real-hijo.ts con la
  carga REAL). ⚠️ **Lo que se pierde a sabiendas es más que la conversión** (re-verificación del 29/10, N3): cuando el webhook se
  perdió, a la persona que ya era lead el barrido no le guarda NADA del formulario: ni las respuestas, ni la campaña, ni la suma al
  embudo de esa campaña (#893), ni el aviso, ni la conversión (y la cuenta como `yaEstaban` cada pasada). A ella no le llega nada de
  más; lo que pierde el negocio es enterarse de que alguien conocido pidió otro producto. ⚠️ **El poll de Meta de siempre
  (`pollMetaLeads`) tiene los dos huecos (papelera y fusión) y NO se tocó:** es de Ads/CRM.
- ⚠️ **La papelera se lee ENTERA o el barrido corta** (`leerTodo`; M4): PostgREST corta en 1000 sin avisar, y una agencia que limpia
  1.500 leads basura los veía volver con su primer WhatsApp. «Si no se puede leer, se sigue: perder un lead nuevo es peor» era el
  razonamiento equivocado: lo que se pierde es una pasada; lo que se gana sin la papelera es un mensaje a quien el negocio borró.
- ⚠️ **Sólo las cuentas del negocio, en el pedido Y lead por lead en memoria, con CUALQUIER clave** (M1 y M2): `accountIds` va en el
  pedido, y cada lead cuyo `accountId` no es una de las cuentas de Facebook o de anuncios del negocio (o que no trae ninguno) se
  descarta (`ajenos`). Lo mismo con `since` (un lead más viejo que la ventana no entra). **Lo que parecía y no era:** «con su propia
  clave todo el equipo es suyo». No: el equipo de Zernio del cliente tiene páginas que el negocio desconectó y otros perfiles, y la
  clave de MaKo pegada como «propia» en otro negocio (`byok` es «tiene fila y no es el ws1», lib/zernio.ts) listaba los leads de
  TODOS los negocios prestados. Y con la de la plataforma, el filtro del pedido solo dependía de que Zernio lo respete (sin medir).
  Es la regla del webhook, que rutea cada lead por su cuenta y descarta el ajeno: el barrido no puede ser más laxo que la puerta
  que copia. **Regla:** un filtro que va en la URL de un tercero no es una red; se re-verifica en memoria.
- **Un lead de menos de 5 minutos es del webhook** (`esDelWebhookTodavia`, la regla del poll de Meta), uno que falla no tumba a los
  demás (la clave única GLOBAL de `meta_lead_id`), y un 403 (sin el complemento de anuncios) se dice y se sigue con la otra clave.
- **El aviso** (en «Anuncios de Meta» del modal de Zernio): `leadsEnElWebhook(ws, conexión)` mira el webhook de la CLAVE de la conexión
  de anuncios (con varias claves, la 1 no es la que recibe). `false` → falta el complemento de anuncios de Zernio; `null` → MaKo no tiene
  su webhook ahí («Volver a conectar» lo registra). **En la pasada diaria del cron**, `asegurarWebhook` corre en cada negocio con Zernio
  cuyo webhook no escucha los leads: uno registrado antes de que MaKo escuchara `lead.received` lo empieza a escuchar sin tocar nada.
- ⚠️ **La trampa de siempre, otra vez:** `ConectarMetaZernio.tsx` tiene su PROPIO tipo `EstadoMetaZernio` (copia del de
  lib/meta-conexion-zernio.ts) y el campo nuevo (`leads`) no estaba ahí: los tests por texto pasaban y lo vio el tsc acotado (TS2339).
  Es lo mismo que el 24/10 («Conectada ✓» con el webhook sin registrar). Un campo nuevo del estado se suma en los DOS tipos.

### Cómo probar un lead REAL por Zernio (nunca llegó uno)

1. Un negocio de prueba con su clave de Zernio, «Anuncios de Meta» conectado y una página con un formulario instantáneo (Martín conecta
   con su Facebook: es un login). ⚠️ **Un lead de prueba de Meta ES un lead para MaKo:** entra al CRM y dispara el aviso, los flujos y
   las automatizaciones (el WhatsApp de bienvenida al teléfono del formulario). Usar un negocio sin automatizaciones de lead nuevo, o
   un teléfono propio en el formulario de prueba.
2. Crear el lead de prueba: `POST /v1/ads/lead-forms/{formId}/test-leads` con `{ accountId, fieldData: [{ name, values }] }` (la
   conexión de Facebook o de anuncios; OpenAPI v1.416), o la «Lead Ads Testing Tool» de Meta sobre esa página. Meta deja UNO por
   formulario: para otro, `DELETE /v1/ads/lead-forms/{formId}/test-leads?accountId&leadId`.
3. Mirar, en orden: el log del webhook de Zernio (`[webhook:zernio]` con `lead.received`), el lead en el CRM con origen `instant_form` y
   `meta_lead_id` = el `leadgenId`, y su historial. Si en 30 minutos no está, el barrido debería traerlo (`[cron:meta-leads-poll] zernio`).
4. Lo que esa prueba mide y hoy no se sabe: si `lead.fields` trae las claves de Meta (`full_name`) o los rótulos, si `leadgenId` es el id
   de Graph (de eso depende que un lead que entra por las dos puertas sea UNO) y si `lead.received` llega sin el complemento de anuncios.
5. Borrar el lead de prueba del CRM (y el de Meta, con el `DELETE` de arriba).

- **Sin hacer:** el lead de prueba real (lo hace Martín: login de Facebook). Los nombres de campaña por id. Los huecos de la papelera
  y de la fusión en el poll de Meta. La clave de MaKo pegada como propia sigue contando como `byok` en lo demás (perfiles, redes): el
  barrido ya no filtra de más, pero detectarla al pegarla no se hizo. El `?dias=90` del cron (backfill) también barre Zernio 90 días
  y puede traer leads que la papelera ya purgó (revisión, B2). Los negocios con la cuenta prestada nunca se barren (B4). De la
  re-verificación del 29/10 (sospechas que dependen de cómo contesta Zernio, sin medir):
  - **N4:** un lead SIN `createdTime` (o ilegible) pasa el filtro de la ventana y sale como nuevo (`queHacerConElLead` lo toma como
    recién llegado: el WhatsApp de bienvenida). El filtro sólo frena cuando hay fecha.
  - **N5:** el filtro en memoria confía en `GET /accounts`: una cuenta que vuelve SIN `profileId` se queda (`leerCuentasDeZernio`) y
    sus leads entran.
  - **N6:** si el `accountId` del `AdLead` no es el `_id` de `/accounts`, el barrido no carga NADA (falla cerrado) y el log del cron
    no lo dice: imprime `vistos` y `cargados`, no `ajenos`.

## WhatsApp vuelve a /integraciones: la tarjeta de las líneas por QR (29/10/2026)

Martín: «En Integraciones falta el logo de WhatsApp para que aparezca eso también, con el QR obvio, con las múltiples líneas, claro».
La de Chatwoot (el oficial) se fue el 09/10 (tests/sin-chatwoot.test.ts); WhatsApp se conectaba por QR (Evolution) sólo desde
/configuraciones › Teléfonos, /whatsapp y Automations, y no tenía tarjeta.

**Vive en:** `lib/integraciones-catalogo.ts` (la tarjeta `whatsapp`) · `lib/integraciones.ts` (`estadoWhatsApp`) ·
`app/integraciones/LineasWhatsApp.tsx` (las líneas y «Agregar línea») · `lib/lineas-whatsapp-tarjeta.ts` (el texto del estado) ·
`app/api/whatsapp/evolution/route.ts` (`deMaKo`) · `app/integraciones/IntegracionesBoard.tsx` · `app/m/configuraciones/integraciones/IntegracionesM.tsx` ·
`lib/servicio-slides.ts` · tests/whatsapp-tarjeta.test.ts.

- ⚠️ **`integracionConectada('whatsapp')` es la pregunta del OFICIAL** (lo que mandaba Chatwoot) en la API de MaKo
  (lib/api-mako/areas/whatsapp.run.ts, nueve lugares). Sale del catálogo de MÉTODOS, no de la grilla: por eso la tarjeta nueva entra
  SÓLO a `DEFS` (lib/integraciones-catalogo.ts) y NO a lib/metodo-catalogo.ts. Si entrara, esa pregunta empezaría a contestar algo
  y la API de MaKo creería que hay un oficial. Lo fija el test.
- **Ninguna conexión nueva:** «Agregar línea» monta el MISMO `EvolutionConnect` con `nueva` de /whatsapp y de Automations (el QR,
  el tope del plan, la línea que nace al pedirlo). El estado de cada línea se MIDE (`GET /api/whatsapp/evolution?linea=`), porque la
  fila miente en las dos direcciones; lo que nadie midió dice «sin comprobar», nunca un verde.
- **La línea de MaKo (la del grupo, `mako_superadmin*`) no es del negocio:** la regla vive en un lugar (`esLineaDeMaKo`); la ruta
  la marca (`deMaKo`) y la tarjeta la saca, en el estado de la grilla y en la lista del modal.
- **El teléfono:** la hoja muestra las líneas (la misma pieza, `soloLectura`) y «Agregar una línea en la computadora». Un QR no
  se escanea con el mismo teléfono que lo muestra.
- ⚠️ **Una tarjeta nueva entra sola a OTRO catálogo:** lib/conexiones-catalogo.ts (lo que la API de MaKo y el doer ofrecen para
  conectar) se monta sobre `DEFS`, y ya tenía «Tu número de WhatsApp» con la key `whatsapp` y el link de contrato
  `/chats?conectar=whatsapp` (el QR en un paso). La tarjeta iba primero y lo pisaba: MaKo mandaba al modal en vez de al QR. Lo vio
  tests/conexiones-api.test.ts en tests-afectados, no el test de la tarjeta. **Regla:** antes de sumar una key a `DEFS`, buscarla en
  `FUERA_DE_LAS_TARJETAS`; la de WhatsApp se saca del mapeo y queda la de afuera.
- **Capturas sin levantar la app:** un banco de esbuild con el `IntegracionesBoard` real y la ruta simulada (el molde del banco de
  Create, docs/hallazgos-ui.md): `C:/dev/revisiones/whatsapp-tarjeta-2910/`. El CSS del teléfono no viene en `globals.css`: el
  banco tiene que importar `app/m/m.css` y `app/m/configuraciones/configuraciones.css`, o la hoja sale sin estilos.
- **Sin hacer:** renombrar, desvincular o elegir la de por defecto desde la tarjeta (sigue en /whatsapp); el código de vinculación
  (`pairingCode`) que permitiría agregar una línea desde el teléfono (el tipo existe en `EvolutionConnect`, la pantalla no lo muestra).

## El barrido de leads de Meta por Zernio: el filtro va en memoria, no sólo en la URL (29/10/2026, Integración)

> **Estado (29/10 noche):** arreglado en `zernio-token-2910` (`a745e4eb3`): el descarte en memoria por cuenta (con cualquier clave),
> sólo crear, y la papelera entera o el barrido corta. Ver «El 2.º Instagram… y los leads de Meta por Zernio», arriba. Prender el
> interruptor de la cuenta de la plataforma lo decide Integración.

La revisión de privacidad de `zernio-token-2910` (`ce56bd693`, `lib/zernio-leads-barrido.ts`) frenó la punta antes del tren-af y
volvió a su chat. El informe está en `C:/dev/revisiones/2910-revision-privacidad-zernio-leads-ce56bd693.md`, y las pruebas en
`C:/dev/revisiones/2910-rev-zernio-pruebas/`.

- ⚠️ **Un parámetro de la API no es un filtro.** Con la clave de la plataforma, `accountIds` iba sólo en la URL y `leerLeadDelRest`
  ni leía el `accountId`. Con un Zernio de prueba que ignora el parámetro, el lead de otro negocio entró al CRM del ws1. **Regla:**
  todo lead se descarta EN MEMORIA si su cuenta no es del negocio que se barre, con cualquier clave. Es lo que ya hace el webhook.
- ⚠️ **«Clave propia» no garantiza que todo el equipo de Zernio sea del negocio.**
  - Con clave propia, el barrido listaba el equipo entero de Zernio.
  - Una agencia con una sola cuenta de Zernio para varios negocios de MaKo mete en cada uno los leads de todos.
  - En el código, «propia» es «tiene fila y no es el ws1» (`lib/zernio.ts`). Si alguien pega la clave de MaKo en otro negocio, ese
    negocio barre los leads de todos los negocios prestados.
- ⚠️ **Una persona con dos formularios no puede alternar.**
  - Cada barrido le cambiaba el `meta_lead_id` (A, B, A…) y le borraba la campaña.
  - Además le reenviaba la conversión a Meta y el aviso «lead fusionado», cada 30 minutos.
  - Se corrió con el `upsertLeadFromMeta` real.
- ⚠️ **La papelera se lee paginada, y si la lectura falla, el barrido corta.**
  - PostgREST corta en 1000 filas sin avisar.
  - Seguir con la lista incompleta hace volver leads borrados, y a los de menos de 24 h les manda OTRA VEZ el WhatsApp de
    bienvenida.
- **Lo que está bien (verificado):**
  - El cron va negocio por negocio, con sus claves.
  - Ningún error guarda los leads de un negocio en otro.
  - El 2.º Instagram no cruza negocios.
- **Sin hacer (B4):** los negocios con la cuenta prestada nunca se barren, porque el cron sólo recorre los que tienen clave
  guardada. El interruptor `zernio.cuenta_de_la_plataforma` queda APAGADO hasta que el filtro en memoria esté.
- **La re-verificación de `da3cff9f7`** (Integración, 30/10) dio «entra con bajas»: M1 a M4 están y funcionan. Se corrieron las
  pruebas viejas contra la punta nueva, y `noTocarExistente` no cambia nada para el webhook ni para el poll de Meta. Quedan abiertos:
  - **N4 (B1 a medias):** un lead sin fecha pasa el `since` (`lib/zernio-leads-barrido.ts`).
  - **N3:** a la persona que ya era lead y perdió su webhook, el barrido no le guarda nada (respuestas, campaña, embudo) y la
    cuenta como «ya estaban». No es una regresión contra main.
  - **N5 y N6 (sospechas, dependen de Zernio):** una cuenta que vuelve sin `profileId` pasa el filtro, y un id de cuenta en otra
    forma deja el barrido en cero sin que el log lo diga.
  - El interruptor `zernio.cuenta_de_la_plataforma` sigue apagado.

## Un 429 de Zernio es una PAUSA, no una conexión rota (30/10/2026, ticket #34)

Código Inmobiliario (ws17) reportó desde /integraciones: «Zernio no contestó (429). Vuelve a conectar con Facebook.» Medido en los logs
de producción (`vercel logs`, ver docs/hallazgos-infra.md del 17/10): pegó su clave a las 12:27Z y conectó Facebook a las 12:29Z; a las
12:30:37Z, en el MISMO minuto, la clave la usaban el sondeo de conectar (12 a 14 `POST /api/zernio` por minuto, cada uno un `GET
/accounts`), dos lecturas del estado de «Anuncios de Meta» (cada una, hasta 9 pedidos: páginas, cuentas publicitarias, píxeles,
webhook), dos cargas de /integraciones con el árbol de Meta por Zernio, el cron `alerta-critica` y una pasada del barrido de leads.

**Vive en:** `lib/zernio-redes.ts` (`motivoDeRespuesta`, `esperaDeLaPausa`, `errorDeLecturaZernio`) · `lib/zernio-conectar.ts`
(`ZernioConectarError.esperaMs`) · `app/api/zernio/route.ts` · `app/_components/ConectarViaZernio.tsx` (el sondeo) ·
`lib/meta-conexion-zernio.ts` (`estadoMetaZernio`, `pingMetaPorZernio`) · `app/integraciones/ConectarMetaZernio.tsx` ·
tests/zernio-pausa-429.test.ts.

- ⚠️ **El diagnóstico obvio era el equivocado: no fue el barrido.** Corrió UNA vez en esa ventana (12:30:25Z, `vistos=0`), unos pocos
  pedidos cada 30 minutos. Lo que llena los 60 pedidos por minuto de un equipo de Zernio (docs.zernio.com/rate-limits) es el momento
  de CONECTAR: el sondeo cada 4 s, más lo que cada pantalla vuelve a leer al terminar, más un cron que cae justo en ese minuto.
- ⚠️ **Un 429 se decía como una conexión rota.** `estadoMetaZernio` (y el «Probar» de Meta) convertían CUALQUIER error de Zernio en
  «Vuelve a conectar con Facebook», y el sondeo lo leía como `sin-red` y lo contaba como falla (tres seguidas cortaban la conexión).
  **Regla:** un 429 tiene su motivo (`pausa`): se dice lo que pasó («Zernio pidió una pausa… tu conexión está bien»), se espera lo que
  pide `Retry-After` (entre 5 s y 1 minuto; sin dato, 30 s), y se sigue: el sondeo no lo cuenta como falla y el estado se relee solo
  (hasta 3 veces). Volver a conectar queda para lo que se arregla así (un 401, una conexión vencida).
- La ruta anota cada pausa con `console.warn` (`tope de Zernio (429), espera N ms`): cuántos 429 hay es el dato para decidir si hace
  falta gastar menos al conectar.
- **Sin hacer:** gastar menos al conectar (el sondeo podría usar el `accountId` de la vuelta antes de listar, y el estado de «Anuncios
  de Meta» lee hasta 5 páginas por apertura); que `alerta-critica` no lea por Zernio un negocio que está conectando.
- **Los otros lugares (Automations y Calendario, 30/10):** el texto de la pausa ya está en los dos. ⚠️ Ninguno decía literalmente «no
  contestó»: el selector de publicaciones del CRON decía «No pude leer tus publicaciones» (`publicacionesParaElCron` se comía el 429
  y devolvía null: ahora, si ninguna cuenta contestó y alguna pidió pausa, TIRA el `ZernioError` y la ruta lo dice), y Calendario
  decía «Zernio no la programó: Rate limit exceeded» o «No pude leer tus cuentas» con un botón «Conectar una cuenta», que es otra vez
  mandar a reconectar algo que anda. **En Calendario no cambia ningún estado:** un 429 en el primer pedido sigue siendo `fallo`
  (Zernio no la creó) y en un reintento sigue siendo `dudosa` con su texto (el primer pedido pudo haber quedado).
- **Una ruta no mira un `ZernioError`:** el cliente de Zernio se habla sólo desde el canal, y `tests/sin-instagram.test.ts` frenó el tren por importarlo en la ruta. La pregunta «¿es una pausa?» vive en el canal (`pausaDeZernio`).
- **Sin tocar, a propósito:** `estadoMedios` (lib/disparadores-canales.ts) ante un 429 dice «Sin comprobar»: no es falso. **Sin tocar,
  de otra área:** lib/media-buyer/datos.ts:111 sigue avisando «Zernio no contestó: …» ante cualquier error, también un 429.

## Varias claves de Apify: la primera con crédito, y a la siguiente SÓLO por falta de crédito (5/11/2026)

Martín (por el Cerebro): «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones de cargar
más api». La clave de Spy de la plataforma iba en US$8,01 de 10 el 5/11. Se copió el patrón de Zernio del 29/10 (entrada «Varias
claves de Zernio por negocio», arriba): la 1 sigue siendo `APIFY_INSTAGRAM_TOKEN`, las extra son `APIFY_INSTAGRAM_TOKEN_2…_5`,
cada una de otra cuenta de Apify del negocio y con un nombre opcional (`…_ACCOUNT`, no secreto). Sin migración: son credenciales
del negocio, cifradas como las demás.

**Vive en:** `lib/spy-claves.ts` (puro: `conLaPrimeraConCredito`, `ordenDeClaves`, `claveDeHuella`, `resumenDeCredito`) ·
`lib/instagram-perfil-server.ts` (`clavesApifyDeSpy`, la ÚNICA que lee las claves; `porApify` y `leerPerfilesEnLote` con salto) ·
`lib/spy-todo.ts` + `lib/spy-todo-reglas.ts` (`creditoTotal`, `ajustarAlCredito` con el total, `TareaLarga.clave`) ·
`lib/spy-buscar.ts`, `lib/spy-otras-redes.ts`, `lib/spy-google-corrida.ts` (`CorridaGoogle.clave`), `lib/instagram-buscar-apify.ts`
(`pedirBusquedaApify`) · `lib/metodo-catalogo.ts`, `lib/metodo-verificar.ts`, `app/integraciones/ServicioConfigForm.tsx`,
`app/integraciones/CreditoApify.tsx` · `scripts/carruseles-biblioteca.mts` · tests/spy-varias-claves.test.ts (+ `_spy-claves-hijo.ts`).

- **Sólo la falta de crédito pasa a la siguiente clave** (`esFaltaDeCredito`). Un 401 (la clave no entra), un 500 o un corte de
  red se contestan como siempre, con el número de la clave: otra cuenta no arregla una clave rota, y saltar gastaría la plata de
  otra cuenta sin que nadie se entere de que la primera está rota.
- ⚠️ **`esFaltaDeCredito` contestaba que sí a un 429 de «demasiados pedidos».** Su patrón buscaba `limit-exceeded` suelto, y el
  tipo del 429 de Apify es `rate-limit-exceeded`. Con una sola clave daba igual (la traída igual no empezaba); con varias, un
  apuro de un segundo gastaba la cuenta de al lado. Ahora un 429 o un `rate-limit` no es crédito.
- ⚠️ **Lo que empezó una cuenta de Apify sólo lo lee esa cuenta.** La traída larga y la búsqueda de sus otras redes EMPIEZAN una
  corrida y la leen en otro pedido: con otra clave, su corrida y su dataset no existen. Se anota la HUELLA de la clave (sha256
  corto, nunca la clave) en `TareaLarga.clave` y `CorridaGoogle.clave`, y se lee con esa (`claveDeHuella`); lo anotado antes, con
  la 1. Si quitaron esa clave, se olvida y se vuelve a pedir mañana. **Un campo nuevo de `TareaLarga` va también al parser
  `tarea()`**, que reconstruye campo por campo: sin eso se pierde en la primera relectura (lo fija el test 6).
- **La reserva de Spy (US$2) se cuenta sobre el total libre de TODAS las claves**, y cada corrida corre en UNA: no puede pedir más
  de lo que le queda a la suya (`ajustarAlCredito(p, credito, total)`; con una sola clave, el resultado de siempre).
- **Las claves extra son de Spy y de la biblioteca, no del alta del CRM.** `leerPerfilInstagram` sólo rota con `variasClaves`, que
  piden lib/spy.ts y lib/spy-buscar.ts; la ruta del CRM no lo pide y su búsqueda por nombre sigue leyendo la 1. El guard del scraper
  retirado (tests/leads-scraper-retirado.test.ts) enumera ahora también `clavesApifyDeSpy` y `CLAVES_APIFY_DE_SPY`: un lector nuevo
  no puede esquivarlo llamando a las claves por otro nombre. Si Martín quiere que el CRM también rote, es sacar `soloLaPrimera` del
  lector y el assert de `variasClaves`.
- ⚠️ **Ningún archivo de `lib/` puede empezar con «apify»**: el guard del scraper retirado lo prohíbe (era el nombre del módulo que
  se sacó). Por eso el módulo puro se llama `lib/spy-claves.ts`.
- ⚠️ **El stub de credenciales de tests/_instagram-perfil-hijo.ts no traía `clavesGuardadasConBase`** y el test de las fuentes de
  Instagram dio `is not a function` (la regla de AGENTS.md: un stub lleva CADA función que el módulo importa).
- **La memoria de «esta clave se quedó sin crédito» es de la instancia y dura 30 minutos** (`AGOTADA_MS`): ordena, no descarta. La
  agotada se prueba al final, por si cargaron crédito.
- **La tarjeta** lee el crédito con el mismo «Probar conexión» (`verificar` sin valores: las claves guardadas, en el servidor), que
  no gasta (`/users/me` y `/users/me/limits` no corren actores). La API de MaKo contesta lo mismo en `probar_conexion_integracion`.
- **Sin hacer:** el estado de la tarjeta sale de la clave 1 (`integracionConectada` mira los campos obligatorios): con la 1 quitada
  y la 2 puesta, Spy anda y la tarjeta dice «Sin conectar». Los topes por día (150 lecturas, 60 búsquedas, 6 traídas) siguen siendo
  POR NEGOCIO: más claves no los suben. Una clave recién agregada puede tardar hasta un minuto en usarse en una instancia que ya
  había leído (la caché de las extra, como en Zernio). **No medido:** el cuerpo real que manda Apify cuando una cuenta se queda sin
  crédito del mes (se probó con el `not-enough-usage-to-run-paid-actor` que ya tenía el test de la traída), ni la tarjeta en un
  navegador (la nube no tiene `.env.local` para levantar la app).
