# Pendientes del Web Generator: replicar cualquier landing

Revisado el 9/11/2026, sólo lectura, contra `origin/main` `406dfd8fc` (9/11 12:40 ART) y contra `origin/punta/web-replicate-0911` `eaf60825c`. Junta dos listas que se armaron por separado: una salió del código y los documentos, la otra de los chats del Cerebro. Cada estado se miró en el código. Lo que dice «medido hoy» se midió el 9/11 desde la PC de Martín, con curl y un User-Agent de Chrome.

**Prioridad:**
- **P1:** impide replicar cualquier landing.
- **P2:** la réplica sale mal, Spy no la muestra o falta verla andando.
- **P3:** el resto.

## En corto

1. **«Replicar con la extensión» no existe.** Lo acordado el 4/11 se construyó sólo para Spy: «Capturar» guarda una foto JPEG, el título, el texto y los enlaces, pero no el diseño. El Web Generator no nombra a la extensión en ningún archivo.
2. **Por qué las mismas páginas fallan en Replicar y en Spy:** las dos dependen de que el SERVIDOR de MaKo baje la página. «Leer en tu navegador» no abre la página real, sino la copia que bajó el servidor, servida aislada en hola-mako.com. **El diagnóstico obvio («hay que arreglar Replicar») era el equivocado.**
3. **Cómo se cubre cualquier landing:** la extensión corre la bajada y la foto de la copia idéntica en la pestaña real de la persona, con su toque en el ícono, y se la manda a Replicar. El servidor ya acepta esa foto. Después hay que publicar la extensión.
4. **La tienda sirve la 0.74.5** (medido hoy; el código todavía dice 0.74.3). El repo va por la 0.78.0 y «Capturar» pide la 0.76.0, así que hoy ningún cliente de la tienda lo tiene.
5. **Los varios mouse:** la tanda 1 está en una rama que no entró a main (la firma es noreply). Faltan las tandas 2 y 3, y el segundo reel no lo analizó nadie.

---

## 1. Replicar: por qué fallan y cómo cubrir cualquier landing

### 1.1 La causa común: todo pasa por la bajada del servidor (P1, pendiente)

- **Qué es.** Replicar y «Sus páginas» de Spy leen la página que baja el servidor de MaKo. Si el servidor no la baja (un antibots, una IP de datacenter bloqueada, un 401, 403 o 429), fallan los dos, y la «lectura en tu navegador» también.
- **Martín** (4/11, 15:44 UTC): «No entiendo porque no podemos, si literal ya lo hacemos en Web Generator... Y es mirar una pagina, no debería ser complicado».
- **Ejemplos.** https://beacons.page/denborg (redirige a https://beacons.ai/denborg), https://lovable.dev/, https://www.vidalytics.com/
- **Estado real:**
  - La ventana de lectura navega a `/api/landing-generator/diagnostico/pagina?lector=…`, que baja la página con `paginaConDireccion(url, { talCual: true })` (route.ts:79). Si falla, contesta un documento de error (`documentoErrorLector`, lib/editor-landing/lector-pagina.ts:272).
  - La página real se abre sólo por el camino del Pixel, y sólo con una landing declarada del propio negocio (`vaALaPaginaReal`, lector-pagina.ts:81, :261-263 y :274).
  - Un antibots sale como 403, «La página pide comprobar que es una persona» (lib/landing-fetch.ts:271-272). Un 401, 403 o 429 sale como «está bloqueando la lectura automática» (:275-279).
  - Spy usa la misma bajada: `/api/competitor-spy/pagina` usa `paginaParaVer` (lib/landing-fetch), y el marco usa `srcPaginaDiagnostico`, que es la misma ruta del Diagnóstico (app/competitor-spy/SusPaginas.tsx:29 y :312).
  - **Prueba de que leer la pestaña real funciona:** el 29/10, inyectar el lector directo en la página de 100ads dio la foto en 8,4 s (docs/hallazgos-editor-landing.md, entrada «No pude sacar la foto…»).
  - **Medido hoy, Beacons:** de 4 pedidos, 3 trajeron la página (200, 311 KB, título «@denborg | De Instagram al Escenario: Paso a Paso») y 1 trajo el desafío (403, «Just a moment...»). La barrera no es fija: depende de quién pide y cómo. Un navegador real la pasa, o la pasa la persona; un fetch del servidor no tiene cómo.
  - **Medido hoy, los otros dos:** https://lovable.dev/ dio 403 «Just a moment...». https://www.vidalytics.com/ dio 429 «Vercel Security Checkpoint».
- **La regla que vale:** un antibots no se evade. La barrera la pasa la persona en su navegador, y el navegador de Apify con proxy lo frenó el clasificador (memoria lead-magnets-y-competitor-spy).
- **Cómo se cierra:** sección 3.
- **Fuente.** lector-pagina.ts:238-300, app/api/landing-generator/diagnostico/pagina/route.ts, lib/landing-fetch.ts:255-285, docs/hallazgos-competitors-spy.md:1705-1730, chat del Cerebro 0ee425c6.

### 1.2 Las apps de Vite o Lovable partidas en módulos no corren en la ventana (P1, pendiente)

- **Qué es.** La ventana aislada tiene origen opaco, así que un módulo con `crossorigin` y sin CORS no carga. Sólo se mete en línea un módulo sin imports, hasta 3 módulos y 6 MB.
- **Ejemplos.** https://gsap.com/ (0 animaciones leídas) y https://lovable.dev/ (403 de Cloudflare).
- **Estado real:**
  - El límite está explicado en lector-pagina.ts:14-23.
  - `TOPES_MODULOS = { cantidad: 3, bytes: 6_000_000 }` (:39), y sólo entra lo que pasa `esModuloSuelto` (:286).
  - Hoy, para esas páginas, quedan el Pixel (si la landing es propia) o pegar el texto. Según los hallazgos, «Página web» no ofrece pegar texto: propone «Landing».
  - Leyendo la pestaña real con la extensión, esto deja de pasar.
- **Fuente.** docs/hallazgos-editor-landing.md:1106-1141, :1242-1270 y :1718-1735.

### 1.3 «No pude sacar la foto de la página» con 100ads.ai (P2, hecho; falta verlo en producción)

- **Martín** (29/10, ticket desde /web-generator/68): «Lo que más me interesa es que funcione al 100% Web Generator, porque las páginas clonadas se desfasaron todas... Y la última prueba que intenté hacer con 100ads no funcionó».
- **Ejemplo.** https://100ads.ai/ (medido hoy: 200).
- **Estado real:**
  - Está en main desde el 29/10: `601e6777d`.
  - La ventana deja los scripts de datos (`sinRastreadores(crudo, { guardarDatos: true })`, lector-pagina.ts:170).
  - Sin foto, el lector manda el motivo y la pantalla lo dice (`mensajeSinFoto`, app/web-generator/crear/Replicar.tsx:225-226).
- **Lo viejo:** `docs/relevo/web-replicate-nube.md` de la rama punta/web-replicate-0911 todavía lo da por pendiente de otro chat. La base de esa rama (`6ad8c0202`) ya trae el arreglo, así que hay que corregir ese renglón al entrar.
- **Falta:**
  - replicar https://100ads.ai/ en producción;
  - cerrar el ticket con el aviso a Martín, que le toca al Cerebro.
- **Fuente.** docs/relevo/web-generator-replicar.md §0, docs/hallazgos-editor-landing.md:3831-3873.

### 1.4 El Diagnóstico, la copia fiel y la vista previa de Spy todavía sacan el árbol de las apps de Next (P2, pendiente, sin medir)

- **Qué es.** El arreglo de 1.3 va sólo en la ventana del lector. En la vista del Diagnóstico, que es también la vista previa de «Sus páginas», una app de Next probablemente queda en blanco. Entonces `marcoVerificado` no llega y Spy sólo ofrece «Abrir». Es candidata concreta a «tampoco aparecían en Competitor Spy».
- **Ejemplo.** https://100ads.ai/
- **Estado real:**
  - Siguen sin `guardarDatos`: `documentoDiagnostico` (lib/editor-landing/diagnostico.ts:982), `headLimpio` (replicar-reglas.ts:242) y `copiaFiel` (:618).
  - **Es a propósito, y por eso el arreglo no es sólo un parámetro.** El comentario de replicar-reglas.ts:224-230 explica que esas vistas no apagan los rastreadores antes de la página. Con los datos, la app vuelve a montar Meta o Clarity. Primero hay que llevar el preludio de la ventana (`JS_PRELUDIO_VENTANA`) a la vista del Diagnóstico, y recién después dejar los datos.
- **Medido hoy:** https://beacons.ai/denborg también es de Next App Router (`self.__next_f`, un pedazo de 112 KB que nombra a «facebook»). Pero ninguno de sus scripts calza con el patrón de rastreadores (`RE_RASTREADOR`, replicar-reglas.ts:206), así que este punto no le toca a Beacons.
- **Fuente.** docs/hallazgos-editor-landing.md:3866-3870 («Sin hacer»).

### 1.5 Las copias se desfasan en el editor y en el teléfono (P2, a medias)

- **Martín** (29/10): «las páginas clonadas se desfasaron todas».
- **Ejemplos.** https://tryholo.ai/, https://reportei.com/es, https://respond.io/
- **Hecho (en main):**
  - el corte no parte columnas (`d413ad03b`);
  - la copia se dibuja a 1440 y se achica al lienzo (`ANCHO_COPIA_ESCRITORIO = 1440` y `escalaDeCopia`, lib/editor-landing/html-editable.ts:461 y :468; `997537fc2`);
  - lo fijo va dentro de la primera sección (`pegarLoFijo`, lib/editor-landing/copia-identica.ts:367; `c3c6849bc` y `9e73cfb2b`).
  - Por eso los renglones de docs/pendientes-todo-6-11.md:632-633 y :757-759 que piden «escalar a 1440» y «lo fijo» son viejos.
- **Falta:**
  1. A 390 px, holo y reportei se corren también en la PUBLICADA (~320 px en holo), porque la foto se saca a 1280.
  2. Una sección de holo («from bakeries to B2B SaaS.») mide ~486 px más en el editor. Nadie lo miró.
  3. Volver a replicar las #68-#72 en el negocio de Martín (ws9) sin pisar las viejas, y medir.
- **Fuente.** docs/relevo/web-generator-replicar.md §00, docs/hallazgos-editor-landing.md:3875-3930.

### 1.6 Que la réplica sea editable en todo (P2, a medias)

- **Martín** (28/10, ~17:30 ART): «Es super importante que la replica de las landing, no solo replique, sino que luego sea editable absolutamente todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».
- **Hecho (4/11):**
  - «Contenido» con íconos y videos;
  - `-webkit-text-fill-color`;
  - el aviso de una capa que tapa el fondo (`capaEncima`, lib/editor-landing/diseno-elemento-acciones.ts:184, usado en HtmlEditableVista.tsx:564).
- **Falta:**
  - Abrir la #68 (sección 10, el color no cambia) y la #69 (sección 13, no se ve la imagen de fondo) en el editor real.
  - Mirar las capturas a 1440 y 390 de `C:/dev/revisiones/replica-editable/capturas/`.
  - Correr el chat de punta a punta en las #70-#72.
- **Límites medidos:**
  - el chat ve 60 botones por sección (`TOPE_ELEMENTOS_DISENO = 60`, lib/editor-landing/ia-bloques.ts:118) y la #68 tiene 91 en la sección 0;
  - la imagen por el chat depende de Openverse, que tarda 11-20 s, contra un corte de 12 s (`AbortSignal.timeout(12_000)`, lib/imagenes-stock.ts:144). Falta decidir otro proveedor;
  - el degradado va sólo por «Elemento»;
  - una caja HIJA que tapa el fondo no se detecta.
- **Fuente.** docs/hallazgos-editor-landing.md:66-119, docs/relevo/web-generator-replicar.md §2.

### 1.7 La copia idéntica: lo que quedó sin hacer el 28/10, y la landing por función (P2, pendiente)

- **Martín:**
  - 28/10, 12:19 UTC: «Enfocate primero en replicar tal cual, tanto en diseño como copy y luego vemos de personalizarlo».
  - 28/10, 12:25 UTC: «con respond.io sea justamente la landing de la funcionalidad de "chats" que viene a reemplazar a respond.io... No a que hable de mako en general».
- **Hecho:** la copia idéntica, que sale de la foto del navegador. Las cinco de Martín (#68 respond, #69 reportei, #70 holo, #71 masterads, #72 closermood) tienen el texto literal al 100 %.
- **Ejemplos.** https://respond.io/, https://tryholo.ai/ (el popup «You've got a surprise!»)
- **Falta:**
  - (a) Las imágenes y las fuentes siguen en el sitio de la original: el bucket `landing-imagenes` sólo acepta png, jpeg, webp, gif, mp4 y webm (mig 0246). Mientras tanto, la original ve la IP de cada visitante.
  - (b) El JavaScript de la original no corre: carruseles, menú del teléfono y acordeones quedan quietos, y los formularios no envían.
  - (c) El Pixel no mide por sección en una copia.
  - (d) La API (`replicar_landing`, «Página web») no tiene navegador: sin foto sale la copia vieja. Está escrito en app/api/landing-generator/replicar/route.ts:10.
  - (e) Personalizar SOBRE la copia, con prompts y por FUNCIÓN (respond.io → la landing de Chats de MaKo). «Tu oferta» y la función no se guardan en la landing. No encontré si la landing de Chats se hizo.
  - (f) Los popups de la original y los errores #418 de hidratación.
  - (g) El editor con una copia abierta no se miró con clics.
- **Fuente.** docs/hallazgos-editor-landing.md:3653-3830 (sin hacer: :3803-3816), memoria replicar-landing-por-partes.md.

### 1.8 Replicar por partes: los restos (P3, a medias)

- **Martín** (28/10): «Una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los ángulos de comunicación, los copies... hay que diferenciar en varios botones o funcionalidades».
- **Estado:** entró el 28/10. Falta:
  - leer una SPA en la ventana del clic DENTRO de la app, y la réplica con IA en vivo dentro de la app (el negocio de prueba no tiene IA);
  - el tope de 60 renglones por sección (`slice(0,60)` en `esquemaDelPedido`);
  - la posición de la imagen y las columnas de una grilla;
  - «Leer de nuevo» vuelve a pagar los ángulos;
  - sin estructura, los ángulos comen el plazo de las tandas;
  - Martín no abrió una copia en producción.
- **Fuente.** docs/hallazgos-editor-landing.md:3442-3636.

### 1.9 Replicar las animaciones (P3, a medias)

- **Martín** (15/10, 00:56 UTC): «También tiene que tener la capacidad de al REPLICAR una web, poder replicar las animaciones que tenga».
- **Ejemplos.** https://www.youtube.com/watch?v=L_0vx859tF0 (el video de referencia), https://gsap.com/, https://lovable.dev/
- **Estado:**
  - Hecho en `ec9226345` (en main).
  - No se copian: canvas, WebGL ni Spline. Una app de Vite en módulos da 0 animaciones, y detrás de Cloudflare da 403.
  - Lo atado al scroll queda quieto, con el aviso (`AVISO_SCROLL`, lib/editor-landing/replicar-animaciones.ts:89).
  - Con «reducir movimiento» en la PC de quien replica se lee menos.
- **Fuente.** docs/hallazgos-editor-landing.md:1606-1735 y :1922.

### 1.10 La réplica con animaciones del ticket de Leila: falta la dirección (P3, pendiente)

- **Ticket 876825880-07.** https://sendipro.com/ no existe: ENOTFOUND el 27/10, y «Non-existent domain» medido hoy.
- «La copia fiel saca los scripts» era falso: sólo saca los rastreadores.
- Espera que el Cerebro le pida la URL a Leila.
- **Fuente.** docs/hallazgos-editor-landing.md:3431-3438, docs/relevo/landing-generator.md:136.

### 1.11 La landing #88 y sus imágenes rotas (P3, estado desconocido)

- **Qué fue.** 27 imágenes con 404 porque se pegó la dirección sin la barra final.
- **Estado:** `5b5204e2c` (en main) resuelve lo relativo contra la dirección final. Pero no está medido con la página real, y el documento se contradice: dice «#88 reparada» y también «Sin hacer: reparar la #88».
- **Ejemplo.** contentpartner.com.co/…-inmersion (la URL completa no está en las fuentes).
- **Fuente.** docs/hallazgos-editor-landing.md:3966-3993.

### 1.12 Borrar las réplicas que salieron mal (P3, a medias)

- **Martín** (28/10, 23:23 UTC): «Y elimina todas las replicas de landing que salieron mal».
- **Estado:**
  - Las #54-#58 fueron a la papelera.
  - Las #60-#64 son borradores de prueba.
  - Las #68-#72 se dejaron a propósito.
  - Las de prueba #44-#46 van a la papelera.
  - Borrar en producción pide el sí de Martín.
- **Fuente.** docs/pendientes-depurados-7-11.md:819, docs/pendientes-todo-6-11.md:451-454.

### 1.13 Ticket #54 (Leandro) (P3, a medias)

- **Hecho:** lo leído queda como borrador (lib/editor-landing/replica-borrador.ts, la ruta `/replicar/borrador`, hasta 8 por negocio y 30 días).
- **Falta:** el defecto visual «de cómo se interactúa con el chat». No hay captura; docs/relevo/nube-tickets.md dice qué mirar.
- **Fuente.** docs/hallazgos-editor-landing.md:25-64.

### 1.14 Los tickets no traen la URL que se pegó (P3, pendiente)

- **Martín** (29/10, memoria ticketera-usuarios.md): «Los tickets de bugs asi, siempre deben traer las acciones que hizo el usuario».
- **Estado real:** app/_ui/ReportarASoporte.tsx guarda el texto del aviso, la pantalla, el ÚLTIMO botón (vale 2 minutos) y la hora. No guarda la URL pegada para replicar: la de https://100ads.ai/ salió de los logs. El archivo no cambió desde el 27/10 (`f78574342`).

---

## 2. Competitor Spy

### 2.1 «Copiar su sitio» abre el Diagnóstico, no Replicar (P1, pendiente)

- **Qué es.** El botón vuelve a bajar la página por el servidor, así que una página bloqueada falla otra vez, y encima no replica.
- **Estado real:**
  - `SusPaginas.tsx:274` lleva a `/web-generator?analizar=<url>`, y `derechaDeQuery` (app/web-generator/panel-reglas.ts:375-383) lo convierte en `{ tipo: 'diagnostico', url }`.
  - **Hoy no hay ninguna query que abra Replicar con una dirección:** `?vista=replicar` abre el cuadro vacío (:301 y :397), y la dirección de Replicar sólo llega desde la caja (:220). Para mandar de Spy a Replicar hace falta un parámetro nuevo.
- **Fuente.** app/competitor-spy/SusPaginas.tsx, app/web-generator/panel-reglas.ts.

### 2.2 Las páginas de Den Borg en Beacons no se replican ni se ven en «Sus páginas» (P1, a medias)

- **Martín** (4/11, 14:58 UTC): «Y revisa esto, que no se bloquee, y que funcione todo». Después: «Esto sigue asi...».
- **Ejemplos.** https://beacons.page/denborg y https://beacons.ai/denborg
- **Estado real:**
  - `esDesafioDeBot` reconoce el desafío venga con 403, 503 o 200 (lib/landing-fetch.ts:271).
  - Spy ya no dibuja el cartel técnico: ofrece «Abrir» y «Capturar».
  - Sin la réplica por la extensión (3.1) y la extensión publicada (3.3), sigue sin replicarse. Tampoco le da sus otras páginas al desplegable, salvo que se capture.
- **Fuente.** docs/hallazgos-competitors-spy.md:1705-1730, chat del Cerebro 0ee425c6.

### 2.3 «Su funnel» con sus webs leídas y replicables (P2, a medias)

- **Martín:**
  - 31/10, 06:07 UTC: «Y analice todo de la competencia, incluso con la funcionalidad de replicar landing, el scraper y todo lo que tenemos en mako».
  - 4/11, 10:10 UTC: «debe "exponer" su OFERTA con el analizador de oferta que ya tenemos construido, y debe traer automáticamente sus web para analizarlas».
- **Hecho:** «Sus páginas» y la oferta leída. Lo capturado con la extensión alimenta la oferta como plan B (lib/spy-oferta.ts:274-277, 6/11).
- **Falta:**
  - https://viralidad.com dio «500» en «Sus páginas» (4/11). La causa no está medida.
  - El acortador https://linktw.in/pywydg se resolvía a https://linktw.in/expired. Hoy queda en «Abrir». El destino real (https://youtu.be/99n0XhdDq0Y) está sólo en el `href` de «Open in browser», y leerlo quedó sin hacer (docs/hallazgos-competitors-spy.md:186-188).
- **Fuente.** docs/hallazgos-competitors-spy.md:154-230 y :1780.

### 2.4 «Guardar en Spy» (copiar Unfunnelizer): hecho, pero sin clientes (P2)

- **Martín** (4/11, 01:06 UTC): «investiga esto para copiarlo en la extension de MaKo: https://chromewebstore.google.com/detail/unfunnelizer/bdjkbgejocjhchdjmckgegngdaghnfbl?hl=es».
- **Estado:**
  - Está en el código: extension/spy-leer.js y `/api/competitor-spy/extension`. Sacó 19 anuncios de Hormozi con la extensión real.
  - A propósito no se copiaron la descarga del VSL, el fetch-relay ni el modo Brute.
  - No le llega a nadie hasta publicar (3.3).
- **Fuente.** docs/hallazgos-competitors-spy.md:1045-1116.

### 2.5 Los anuncios de la competencia (P3, a medias)

- **Martín** (4/11, 16:46 UTC): «no estoy viendo todavía los anuncios. Eso es importante que se pueda ver».
- **Estado:**
  - Van por Apify (`ANUNCIOS_POR_APIFY = true`, lib/spy-todo-reglas.ts:82).
  - Falta la primera lectura real (¿trae el pageID?) con una clave con crédito, y el crédito de la cuenta de Spy queda corto.
- **Fuente.** docs/hallazgos-competitors-spy.md:283, docs/pendientes-depurados-7-11.md:903.

---

## 3. Replicar desde la extensión de MaKo

### 3.1 Replicar por la extensión: no existe (P1, pendiente)

- **Martín:**
  - 4/11, 16:13 UTC: «Pero podemos hacerlo con la extension de mako... Muchas extensiones capturan sitios web... Yo no quiero vulnerar a nadie, solo quiero capturar el diseño».
  - 4/11, 16:29 UTC, después de probar Replicar con Beacons: «Si, tendremos que hacerlo con la extension entonces».
  - Hoy, 9/11, 15:48 UTC: «habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa manera siempre vamos a poder replicar cualquier landing».
- **Ejemplos.** https://beacons.ai/denborg, https://lovable.dev/, https://gsap.com/
- **Estado real:**
  - Manifest 0.78.0. Permisos: `storage`, `alarms`, `webRequest`, `scripting`, `activeTab`. Permisos de sitios: hola-mako.com, labs.google, flow.google.com, aisandbox-pa.googleapis.com y web.whatsapp.com.
  - En extension/ no hay nada de Replicar. La única mención del Landing Generator es la de seguridad: el puente NO atiende a la ventana de lectura, ni a `/api/` ni a `/l/` (background.js:2522-2536).
  - En app/web-generator, lib/editor-landing y app/api/landing-generator no hay ni una referencia a la extensión ni a lo capturado.
  - Lo único parecido es «Capturar» de Spy:
    - extension/spy-pagina.js devuelve `final`, `titulo`, `texto` (60 KB), `enlaces` y los primeros 30 KB del HTML, que no se guardan;
    - popup.js:1196 saca la foto JPEG con `captureVisibleTab`;
    - a propósito no hace scroll, ni clics, ni foco, y el test lo exige (tests/spy-captura-pagina.test.ts:184).
- **Qué falta, en orden:**
  1. **Un script nuevo en la extensión,** inyectado con el toque en el ícono (`activeTab` y `scripting`, sin un permiso de sitios nuevo), que corra en la pestaña real lo que hoy corre el lector. Eso es `JS_ANTES_DE_BAJAR` (:48), `JS_MIRAR_VISIBLES` (:63), `JS_HIJOS_JUNTOS` (:90) y `JS_INSTANTANEA` (:114), todos en lib/editor-landing/copia-identica-script.ts y ya escritos como JS plano.
  2. **El código viaja DENTRO del paquete.** Manifest V3 no deja correr código bajado de afuera. Se copia con un script de sincronización y un chequeo antes del push, como `lib/flow-boq-respuesta.ts` → `scripts/sync-boq-respuesta.mjs` (AGENTS.md:4720). La consecuencia: cada cambio a la instantánea es una versión nueva de la extensión que pasa por la tienda. Conviene que lo que corre en la pestaña sea tonto y que decida el servidor (AGENTS.md:11641-11644).
  3. **Una decisión que hay que escribir:** la copia idéntica necesita bajar la página para que cargue lo perezoso, y la regla de la extensión en sitios de terceros dice que no mueve la pantalla (AGENTS.md:11632). Hace falta una regla propia para esta lectura, su test, y actualizar app/privacidad/extension/page.tsx.
  4. **Mandar la foto a Replicar.** El servidor ya acepta `POST /api/landing-generator/replicar` con `{ url, formato: 'web', foto }` (route.ts:8-10; replicar.ts:154 → `replicarIdentica`, :226). Dos cosas a tener en cuenta:
     - el pedido tiene un tope de 4,2 MB (`TOPE_PEDIDO_FOTO`, Replicar.tsx:120, porque Vercel corta a 4,5 MB);
     - las hojas de estilo que no vienen adentro de la foto las baja el SERVIDOR (`hojaDeLaFoto`, copia-identica.ts:291). En la pestaña real, las del mismo sitio vienen adentro; una hoja de un CDN detrás de la misma barrera fallaría. Sin medir.
  5. **El lado de la pantalla:** «Replicar con la extensión» en Replicar y en `LeerOPegar` cuando el servidor no la baja. Hoy esa pantalla ofrece sólo «Leer en tu navegador» y «Pega el texto» (app/web-generator/lector/LeerOPegar.tsx:45-46). El molde es «Capturar»: `MAKO_SPY_CAPTURAR_PIDO` (mako-puente.js:325-345) → `SPY_CAPTURAR` (background.js:3342).
  6. **Subir la versión** (todo cambio en extension/ la sube) y publicarla (3.3).
- **Un paso intermedio más barato:** para los formatos «Landing» y «Presentación», la ruta ya acepta `lectura` o `texto` en vez de la bajada (route.ts:11-12). El texto que «Capturar» ya trae alcanzaría para esos dos formatos, no para la copia idéntica.
- **Fuente.** extension/manifest.json, extension/spy-pagina.js, extension/popup.js:1164-1196, lib/spy-pagina-capturada.ts:1-33, lib/editor-landing/copia-identica-script.ts, app/api/landing-generator/replicar/route.ts, memoria lead-magnets-y-competitor-spy.md, chats del Cerebro 0ee425c6 y 6ea62e88.

### 3.2 Lo capturado no guarda el diseño y no llega a Replicar (P1, pendiente)

- **Estado real:**
  - lib/spy-pagina-capturada.ts:18-20 dice que el diseño todavía no se guarda: `spy-miniaturas` es público, sólo acepta imágenes (mig 0361) y un HTML ajeno no va ahí.
  - Hace falta un bucket privado, o sea una migración. **El número 0410 que se anotó el 6/11 ya está usado** (`0410_correo_bajas.sql`). Main va por la `0412_mako_tokens.sql`, así que el número lo da el Cerebro.
  - Nada del Web Generator lee lo capturado.
- **Fuente.** lib/spy-pagina-capturada.ts, supabase/migrations/, docs/relevo/nube-spy.md:146-148.

### 3.3 Publicar la extensión: requisito de todo lo anterior (P1, pendiente)

- **Martín:**
  - 3/11, 19:28 UTC: «Y si hay una nueva version de la extension, subela a chrome, como lo hemos hecho ya en el pasado».
  - 5/11, 22:22 UTC: «si hay cosas que publicar, como por ejemplo la nueva extensión... eso se tiene que hacer automáticamente. No me lo tenés que preguntar».
- **Ejemplo.** https://chromewebstore.google.com/detail/mako/gapbemdaaghomjbnggechglkpmbgplle
- **Estado real:**
  - **Medido hoy en la ficha pública:** «Versión 0.74.5», actualizada el 3/11/2026 a las 19:52 UTC.
  - **Constante vieja:** el código sigue diciendo `VERSION_EN_TIENDA = '0.74.3'` (lib/extension-tienda.ts:51), y con esa constante se decide qué se le ofrece a cada uno.
  - El repo va por la 0.78.0 (lib/extension-version.ts:8). «Capturar» pide la 0.76.0 (`VERSION_CAPTURA`, lib/spy-pagina-capturada.ts:33). La que Martín tenía instalada el 8/11 era la 0.74.4 (`07cc0a8b2`).
  - La subida por API está muerta (`deleted_client`). El panel pide que Martín vuelva a verificar su cuenta en el Chrome aparte (scripts/cdp-tienda.mjs), y después Google tarda en aprobar.
  - «Capturar» nunca se probó en un Chrome de verdad.
- **Fuente.** docs/hallazgos-extension.md:30-60 y :400-473, docs/encargos-6-11/martin.json, chats del Cerebro e680c815, 0ee425c6 y 4d1a09d4.

---

## 4. Web Replicate: los varios mouse

### 4.1 Tanda 1, los 12 cursores: está en una rama, no en main (P2, a medias)

- **Martín** (9/11, 11:43 UTC): «PARA WEB REPLICATE, COPIAR ESTO: https://www.instagram.com/reel/DfZFAfzs3Ng/ … Sobre todo la animación de los multiples mouse actuando».
- **Estado real:**
  - `origin/punta/web-replicate-0911` tiene 3 commits fuera de main (`66d4c10f6`, `cf1f2f00c`, `eaf60825c`), los tres con el autor `noreply@anthropic.com`. Por eso también está en `origin/ci-rojo/web-replicate-0911`, que es el mismo commit.
  - Trae app/_ui/enjambre.ts, app/_ui/CursorAgente.tsx, lib/editor-landing/replicar-escena.ts, app/web-generator/crear/EscenarioReplica.tsx y tests/web-replicate-agentes.test.ts.
  - Desde su base (`6ad8c0202`, 9/11 04:54), main avanzó 58 commits. El único archivo que tocan los dos es docs/hallazgos.md.
  - Falta firmarla con martinkoncke@gmail.com (docs/relevo/cerebro.md:1426) y verla en la app con una réplica de punta a punta.

### 4.2 Tanda 2: el anillo en el paso «Leer» (P3, sin empezar)

- **Estado real:** hoy se ve el giro de siempre (Replicar.tsx:690). `useLeerParaReplicar` (:444) sólo da «leyendo» y «leída», sin progreso.

### 4.3 Tanda 3: la página real adentro de cada caja (P3, sin empezar)

- **Qué es:** pintar en cada caja la sección de verdad, con la foto de la copia idéntica, en un iframe con sandbox.
- **Regla que vale:** «Servir contenido de AFUERA bajo nuestro dominio exige una firma del server» (AGENTS.md:1845).

### 4.4 El segundo reel, «Swarm rebuild» (P3, pendiente)

- **Martín** (9/11, 12:07 UTC): «Este reel explica como hacer la animación de los cursores para web generator y editor. Y viene de una extensión que tal vez podriamos encontrar su repo».
- **Ejemplo.** https://www.instagram.com/reel/DfUdHN9sMbg/
- **Estado real:**
  - Está en `origin/referencias/reels-0911` (`cursores-explica.mp4` y `.txt`, commit `1e424774d`, fuera de main). Su texto dice «Extension : Swarm rebuild».
  - En main sólo lo nombra docs/relevo/cerebro.md:1426, como encargo del chat de la nube. El relevo de la rama no lo analiza, y nadie buscó el repo.
  - La parte de los cursores en el EDITOR no tiene ni tanda.
  - Es una extensión de terceros, no la de MaKo.

---

## 5. Otros del Web Generator (no son de réplica)

| Qué | Estado | Prio | Fuente |
|---|---|---|---|
| Replicar en el teléfono: /m/landing no tiene crear ni Replicar. En Spy del teléfono, «Replicar su sitio» y la extensión dicen «En la computadora» (correcto para la extensión) | pendiente | P3 | lib/movil-rutas.ts:263, app/m/competitor-spy/SpyM.tsx:34-35, docs/pendientes.md:361 |
| Carrusel 4:5: `origin/punta/web-generator-45` (`93e7f8be5`, 1 commit, firmado bien) también está en `ci-rojo/`, y el motivo no consta. Choca con main en lib/api-mako/areas/landing.def.ts y docs/api-mako.md | a medias | P3 | rama |
| La segunda pregunta de la iniciativa («¿Vas a pautar esta página en Meta?») y la guía de la pestaña | pendiente | P3 | docs/hallazgos-editor-landing.md:9-23 |
| Las animaciones de las etapas 4, 6 y 9 | pendiente | P3 | docs/pendientes.md:380 |
| La cadena de pago en dominio propio termina en hola-mako.com y pierde el anuncio (el 8/11 había 0 clientes con dominio propio) | pendiente | P3 | docs/pendientes.md:381 |
| El video de fondo espera al Video Generator | pendiente | P3 | docs/pendientes.md:384 |
| Imágenes con IA por Flow (Martín: «más tarde») | pendiente | P3 | docs/pendientes.md:410 |
| «Mi otro producto» en texto libre; los comentarios del Diagnóstico firmados como MaKo | pendiente | P3 | docs/pendientes.md:467-468 |
| Mirar con clics el editor como Automations, las animaciones, el cuadro con modos y la ventana del lector | pendiente | P3 | docs/pendientes.md:424 y :481 |

---

## Landings que fallaron

| URL | Dónde | Qué pasó | Causa | Hoy |
|---|---|---|---|---|
| https://beacons.page/denborg → https://beacons.ai/denborg | Replicar y Spy (4/11) | Replicar: «La página pide comprobar que es una persona». Spy: «La página respondió 403» | El «Just a moment...» de Cloudflare al servidor. No se evade | Medido hoy desde la PC: 3 de 4 pedidos con 200, 1 con el desafío. Sin resolver: 3.1 y 3.3 |
| https://lovable.dev/ | Replicar y animaciones | No se lee | 403 de Cloudflare al servidor | Medido hoy: 403 «Just a moment...» |
| https://gsap.com/ | Animaciones | 0 animaciones | App de Vite en varios módulos: no corre en la ventana aislada | Sin resolver: 1.2 |
| https://www.vidalytics.com/ | Spy | No se muestra | 429 al servidor | Medido hoy: 429 «Vercel Security Checkpoint» |
| https://100ads.ai/ | Replicar (29/10) | «No pude sacar la foto de la página» | App de Next: la ventana sacaba el árbol de 113 KB, React la borraba (#423) y la foto vacía se tiraba en silencio. Además, cerrar a los 300 ms perdía la foto | Arreglado (`601e6777d`). Falta verlo en producción. En el Diagnóstico y la copia fiel sigue (1.4) |
| https://respond.io/ | Replicar (28/10) | Por partes salió «horriblemente mal» (tema de fábrica, texto reescrito, mitad en inglés) | Se pasó a la copia idéntica; esa copia perdía la hoja y la publicada mostraba 125 imágenes rotas | Arreglado. En el editor, la sección 10 de la #68 no cambia de color (1.6) |
| https://tryholo.ai/ | Editor | El hero se partía en dos columnas | El corte de secciones | Arreglado. A 390 la publicada se corre ~320 px y una sección mide +486 px (1.5) |
| https://reportei.com/es | Editor | Corrimiento de 870 px (hoy 289); 1 imagen rota, la misma que en la original | Elementor: 116 secciones y header pegajoso | A 390 la publicada se corre; en la #69, sección 13, no se ve el fondo |
| https://masterads.ai/mkt/register | Replicar | Sólo se lee en el navegador | SPA | Copiada (#71) |
| https://closermood.com/ | Editor | Un 110vh en bucle (16.000 px), un fondo en canvas de ~700 KB | Lo dinámico de la original | Copiada (#72) |
| https://sendipro.com/ | Ticket de Leila | No existe | DNS: ENOTFOUND (27/10) y «Non-existent domain» (medido hoy) | Falta la URL (1.10) |
| contentpartner.com.co/…-inmersion (#88; la URL completa no está en las fuentes) | Replicar | 27 imágenes con 404 | La dirección sin la barra final | `5b5204e2c`, sin medir (1.11) |
| La landing de Mauricio (14/10, sin URL en las fuentes) | Diagnóstico | «No pude leer el texto de esa página» | App de Vite con `<div id="root">`, 0 palabras en el HTML y 403 | Resuelto el 24/10 |
| https://webflow.com/pricing | Replicar | «No se pudo conectar» | Cabeceras de ~17,5 KB contra el límite de 16 KB de Node | Arreglado (`MAX_CABECERAS = 65_536`, lib/landing-fetch.ts:58) |
| https://www.skool.com/ | Spy | No se ve nada desde afuera | Pide sesión (455 KB de HTML) | Sin cambio |
| https://linktw.in/pywydg | Spy | Mostraba https://linktw.in/expired | Acortador que calcula su destino en JS | Queda en «Abrir». El destino (https://youtu.be/99n0XhdDq0Y) no se lee (2.3) |
| https://www.acquisition.com/ | Spy | El píxel de Meta no se ve | Lo carga Tag Manager, y eso no se ve desde el servidor | Sin cambio |
| https://viralidad.com | Spy (4/11) | «500» en «Sus páginas» | Sin medir | Sin medir |
| https://vturb.com/es | Páginas de detalle | No se baja | Bloquea al servidor | Se copió a mano (memoria landing-detalle-rutas.md) |

---

## Lo que no se pudo confirmar

- Si alguien replicó https://100ads.ai/ en producción después del deploy, y si el ticket se cerró con el aviso a Martín.
- Si una app de Next queda en blanco en el Diagnóstico y en la vista previa de Spy (1.4): no está medido.
- Si Beacons sigue frenando al servidor (Vercel) hoy. Lo medí desde la PC, no desde el servidor.
- Si las hojas de estilo de un CDN detrás de una barrera fallan en `hojaDeLaFoto` cuando la foto venga de la extensión.
- Por qué da «500» https://viralidad.com en «Sus páginas».
- Si se hizo la landing de Chats a partir de la copia de respond.io, o alguna otra landing por función.
- Si la #88 quedó reparada (el documento se contradice).
- Por qué `ci-rojo/web-generator-45` está en rojo: su autor es el correcto.
- Si Martín actualizó la extensión después de la 0.74.4.
- El defecto visual del chat del ticket #54: no hay captura.
- Si «Capturar» funciona en un Chrome de verdad: nunca se probó.

## Hallazgos nuevos de esta revisión (van a `docs/hallazgos-*.md`, con el índice en el mismo commit)

- **docs/hallazgos-editor-landing.md:** la causa común (1.1), con el diagnóstico obvio equivocado. Y que `guardarDatos` en el Diagnóstico pide antes el preludio, no sólo el parámetro (1.4).
- **docs/hallazgos-extension.md:**
  - el contrato de la réplica por la extensión (3.1): el código viaja en el paquete por Manifest V3, cada cambio pasa por la tienda, y bajar la página choca con la regla de no mover la pantalla;
  - que `VERSION_EN_TIENDA` está vieja: dice 0.74.3 y la tienda sirve la 0.74.5, medido el 9/11.
- **docs/hallazgos-competitors-spy.md:** que «Copiar su sitio» abre el Diagnóstico, y que no existe una query que abra Replicar con una dirección (2.1).