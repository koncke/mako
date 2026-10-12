# Dashboard v4 — contratos de la tanda en curso (11/10/2026)

<sub>Copia versionada de lo que gobierna la corrida (escrita en el scratchpad de la sesión «Graphics»). La mantiene el relevo: [dashboard.md](dashboard.md).</sub>


Repo: C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing (Next 16, TS, React 19).
Varias sesiones trabajan en el MISMO árbol. Reglas para todos los paquetes:
- Tocás SÓLO los archivos de tu paquete (tabla de abajo). Si necesitás un cambio en un archivo ajeno, NO lo hagas:
  devolvelo en «PENDIENTE PARA OTRO PAQUETE» con el archivo, la línea y el código exacto.
- NUNCA git que escriba (add, commit, checkout, stash, reset), nunca `--no-verify`, nunca levantar servidores.
- Archivos temporales: sólo en C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/fad4ba8a-7ddc-4ef3-8022-8457eab88b6a/scratchpad/
- Respetá el fin de línea de cada archivo (algunos son CRLF): las herramientas Edit/Write lo conservan; un script
  que edite tiene que detectar el salto del archivo y devolverlo igual.
- ⚠️ La herramienta Bash se come las barras invertidas y ejecuta backticks adentro de heredocs/`node -e`: para
  escribir código usá Edit/Write, no heredocs.
- Tests: `npx tsx --test tests/<archivo>.test.ts`. Todo test nuevo se PRUEBA ROMPIÉNDOLO (romper lo que persigue,
  ver que falle, restaurar DE MEMORIA —nunca con git—) y el resultado va con números en la cabecera del test.
  Los guards que barren el repo (voseo, frontera use-client) usan `git ls-files`: un archivo nuevo es invisible
  para ellos; medí el voseo de tus archivos nuevos a mano (`voseoEn(copyVisible(ruta))` de tests/puente-panel-copy.test.ts
  o `marcasDeVoseo` de lib/puestas-data.ts).
- Typecheck: UNA vez al final, `node scripts/typecheck-lock.mjs` (serializa y cuida la RAM). Los errores en archivos
  de OTROS paquetes o de otras sesiones no son tuyos: reportalos, no los arregles.
- Español neutro (tú) en todo lo que lee una persona; el texto que se dibuja es corto (AGENTS.md).
- Leé AGENTS.md de la raíz (ya lo tenés inyectado): rige todo (rutas retiradas, ?ws=, `use server`, sticky, etc.).

## Decisiones de Martín (no se re-preguntan)
1. La IA del Dashboard SIEMPRE cae a otros proveedores (ya hecho: lib/graficos-ia-red.ts).
2. «Marcar cobrada»: cualquiera con acceso a la tab (ya hecho en app/crm/actions.ts).
3. Funnel maduro y cohortes de Comercial muestran TODAS (ya hecho: `periodo: 'todo'`).
4. Lo de **Ads Analyst** se muda a la tab **Ads Writer** y Ads Analyst se ELIMINA (la ruta redirige).
5. Lo de **Landing Analyst** se muda a **Landing Generator** y Landing Analyst se ELIMINA (la ruta redirige).
6. **Closing Analyst va COMPLETO al Dashboard**, sumando los elementos **Enlace**, **Video** e **Insertar (embed)**,
   y la tab se ELIMINA (la ruta redirige). **Los closers ven SÓLO la hoja Closing** del Dashboard (no editan el
   informe, no ven otras hojas). Las tareas de Closing (sincronizar, re-analizar, revisar, re-evaluar con MaKo)
   quedan para admin y closer (como hoy en /closing; un setter no).
7. TODO el Dashboard se consume por la API de MaKo; la API trabaja sobre el informe **de la persona que se nombre**
   (sin nombrar y con un solo informe guardado en la cuenta, ése; con varios, pide elegir).
8. Automations tiene que poder configurar y consumir esto (eso lo hace la sesión «Chatbot» con un brief; acá no).
Decisiones que tomé yo (Claude) y se reportan a Martín: el elemento Insertar acepta CUALQUIER https (como Looker),
pasándolo por `embedDe` cuando el proveedor es conocido y con el sandbox de lib/embeds.ts; el Video acepta los
proveedores de video de lib/embeds.ts + Fathom (link de Compartir) + .mp4/.webm/.mov; `?tab=analizar` de Ads Writer
no pasa por la puerta del onboarding de Copy Generator (valorar un guion no usa la matriz).

## Dueños de archivos (UN paquete por archivo)

| Paquete | Archivos |
|---|---|
| **P1 Elementos** | lib/embeds.ts, tests/embeds.test.ts, lib/graficos-catalogo.ts (TODO cambio a este archivo, incluidos los que pide P2a: dimensión `estado` en `llamadas`, entrada `llamadas_venta` en ENTIDADES), app/_ui/iconos-menu.tsx, app/dashboard/Elemento.tsx, app/dashboard/ElementoInsertado.tsx (nuevo), app/dashboard/Galeria.tsx, app/dashboard/editor-css.ts, tests/graficos-elementos.test.ts, tests/graficos-modelo.test.ts |
| **P2a Closing (datos y ficha)** | lib/graficos-datos.ts, lib/graficos-datos-extra.ts, lib/graficos-fuentes-extra.ts, lib/graficos-acciones.ts, lib/graficos-bloques-extra-catalogo.ts, lib/graficos-bloques-extra.ts, app/dashboard/bloques/extra/** (BloquesClosing.tsx, CuerpoBloqueExtra.tsx, FichaLlamada.tsx nuevo), app/dashboard/Detalle.tsx, lib/graficos-plantillas-analysts.ts, app/api/closing/** (llamada/route.ts nuevo + guardas en sync, analyze, revise, transcript), lib/api-mako/areas/closing.def.ts, lib/api-mako/areas/closing.run.ts, lib/api-mako/areas/closing.helpers.ts, tests/graficos-interactividad.test.ts, tests/graficos-closing.test.ts (nuevo) |
| **P2b Dashboard: acceso, hojas y retiro de las tres tabs** | app/dashboard/page.tsx, app/dashboard/EditorInforme.tsx, app/api/graficos/route.ts, lib/graficos-plantillas.ts, app/closing/** (page.tsx redirect; borrar ClosingBrowser.tsx), app/_components/nav.ts, lib/retro-reporte.ts, lib/mako-capacidades.ts, lib/preview-links.ts, lib/mako-doer-in.ts (SÓLO las líneas del link /closing?call=; el archivo tiene cambios sin commitear de otra sesión: no toques nada más), app/configuraciones/page.tsx, app/equipo/page.tsx, app/admin/dev/areas.ts (ídem: tiene cambios ajenos; cambios mínimos), app/admin/docs/catalogo.ts, lib/api-mako/tipos.ts (SÓLO AREA_INFO de closing y landing), lib/mako-tools.ts (comentario), tests/graficos-analysts.test.ts, tests/tabs-retiradas.test.ts (nuevo), docs/dev-tabs-mapa.md |
| **P3 Ads Analyst → Ads Writer** | app/ads-writer/** (tabs.ts nuevo, page.tsx, AdsWriterApp.tsx, AnalizarGuion.tsx nuevo), app/ads-analyst/** (page.tsx y guiones/page.tsx → redirects; ScriptsBrowser.tsx sigue como librería: sólo exportar lo que haga falta, NO borrarlo: lo importa app/marketing/ad-charts.tsx), lib/api-mako/areas/ads.def.ts, ads.helpers.ts, ads.run.ts (sólo textos/links que nombran /ads-analyst), lib/tab-activacion.ts (título de 'script'), tests/ads-writer-analizar.test.ts (nuevo) |
| **P4 Landing Analyst → Landing Generator** | app/landing-generator/analizar/page.tsx (nuevo; NO toques ningún otro archivo de app/landing-generator: la sesión «Landing Generator» los reescribe en el worktree ../wt-gamma), app/landing-analyst/** (page.tsx redirect; LandingAnalystApp.tsx: sacar las Tabs pulso/mapa y el KPI del pie; MapaDeCalor.tsx y PulsoPaginas.tsx se QUEDAN donde están), lib/api-mako/areas/landing.def.ts, landing.helpers.ts, landing.run.ts, integraciones.def.ts (sólo textos que nombran la tab), lib/tab-onboarding-catalogo.ts (sólo el href de 'landing-an'), tests/landing-generator-analizar.test.ts (nuevo) |
| **P5 API de MaKo** | lib/api-mako/areas/dashboard.def.ts, dashboard.run.ts, dashboard.helpers.ts (nuevos), lib/api-mako/registro.ts, lib/api-mako/runners.ts, lib/api-mako/rest.ts, lib/api-mako/recursos.ts, tests/api-mako-registro.test.ts (ajuste mínimo), lib/mako-intencion.ts (la regex de metricas), lib/graficos-tablero.ts, lib/graficos-ia-generar.ts (nuevo), app/api/graficos/ia/route.ts, tests/api-mako-dashboard.test.ts (nuevo), docs/api-mako.md + tests/api-mako-http.snapshot.txt (regenerados con el script) |

Nadie toca: lib/api-mako/areas/plan.* (otra sesión), next.config.ts (otra sesión), lib/ai-cheap.ts, app/automations/**,
lib/flujo*, app/landing-generator/** (salvo P4 su carpeta nueva `analizar/`).

## Interfaces entre paquetes (escribí contra esto aunque el otro lado todavía no exista)

- **C1 · FichaLlamada (P2a la crea, P2b la monta):** `app/dashboard/bloques/extra/FichaLlamada.tsx`
  `export function FichaLlamada(p: { recordingId: number; onCerrar: () => void; onCambio?: () => void; soloLectura?: boolean }): JSX.Element`
  — un Modal de app/_ui con el detalle de una llamada (reproductor, resumen, análisis, momentos, transcript,
  historial, «Lead →») y sus tareas (re-analizar, revisar, re-evaluar con MaKo). Pide sus datos a
  `GET /api/closing/llamada?recording_id=` (P2a).
  P2b la abre desde `?llamada=<recording_id>` (page.tsx lo valida entero y lo pasa como `llamadaInicial` a
  EditorInforme; al cerrar se saca de la URL con el mismo replaceState que usa `hoja`).
  Los demás lugares que la abren (una fila del bloque «Las llamadas», los ejemplos de Factores, la acción
  `ver_llamada` del Detalle) son de P2a.
- **C2 · hojaDestino (P2b):** en lib/graficos-plantillas.ts
  `export function hojaDestino(t: Tablero, pedido: string | null | undefined): { hojaId: string | null; agregar: Hoja | null }`
  1) id exacto; 2) la primera hoja cuya «firma» calce con la plantilla pedida (cada plantilla de
  PLANTILLAS_HOJA declara qué la reconoce: un bloque característico —closing: embudo_cierre/factores_cierre/llamadas_cierre;
  ads-analyst: patrones_guiones/cuadrante_retencion; landing: mapa_calor/curva_vsl; productividad:
  matriz_proyectos/piramide_prioridad—, o los ids fijos de marketing/comercial); 3) si la pedida es una plantilla y
  no está, `agregar` = esa plantilla armada con ids FIJOS (`armar((l) => l)`): EditorInforme la AGREGA al informe
  (y se guarda: la persona fue a buscarla) con un toast corto. Hoy `?hoja=closing|ads-analyst|landing|productividad`
  cae en Marketing sin avisar (bug vivo: /productivity-analyst ya redirige así).
- **C3 · Modo closer (P2b):** el ítem `graphics` de nav.ts suma `rolesWs` con 'closer'; app/dashboard/page.tsx
  hace `requireRolWs(['closer'], { nav: 'graphics' })` y, si el rol efectivo es 'closer', arma un informe EN
  MEMORIA con sólo la hoja Closing (plantilla con ids fijos) y pasa `soloLectura` a EditorInforme (sin editar, sin
  Nueva hoja, sin menú de hoja, sin AI Analyst, sin guardar nunca; Exportar sí). app/api/graficos/route.ts: un
  closer sólo puede pedir `datos` de los conjuntos de Closing (`llamadas`, `llamadas_venta`, `llamadas_dimensiones`)
  y `bloques` de Closing (`embudo_cierre`, `factores_cierre`, `closers_cierre`, `llamadas_cierre`); `guardar`,
  `valores` de otros campos y todo lo demás → 403. El admin, como hoy.
  Las rutas de app/api/graficos/{ia,analisis,imagen} siguen sólo-admin (no se tocan para closers).
- **C4 · Elementos (P1):** `TIPOS_ELEMENTO` suma `enlace`, `video`, `insertado`. P2b, en EditorInforme, pone
  `minW: 3, minH: 4` para video e insertado donde hoy se arma el layout de los elementos (`minW: 1, minH: 1`).
  P5 valida `insertar_elemento_dashboard` contra TIPOS_ELEMENTO en tiempo de ejecución (sin enum en la def).
- **C5 · Retiro de rutas (P2b para las tres en lo común):** nav.ts saca los ítems 'closing', 'script' y 'landing-an'
  del grupo Analysts (las KEYS se quedan en lib/capas.ts y en los gating de la API: están escritas en la base).
  Destinos: /closing → /dashboard?hoja=closing (+ `&llamada=<id>` si venía `?call=`); /ads-analyst y
  /ads-analyst/guiones → /dashboard?hoja=ads-analyst (P3 escribe esos redirects); /landing-analyst: `?tab=pulso|mapa`
  → /dashboard?hoja=landing, lo demás → /landing-generator/analizar conservando la query sin `tab` (P4 escribe ese
  redirect). Todo redirect con `rutaConWs` (lib/workspace.ts) y molde app/productivity-analyst/page.tsx.
  Capacidades (lib/mako-capacidades.ts, P2b): closing → Dashboard; landing-diagnosticar → Landing Generator
  /landing-generator/analizar; guiones-ads → Dashboard ?hoja=ads-analyst + una capacidad nueva guion-valorar →
  /ads-writer?tab=analizar. Retro (lib/retro-reporte.ts TOOL_HREF): closing → /dashboard?hoja=closing, script →
  /dashboard?hoja=ads-analyst, landing → /dashboard?hoja=landing.
  Guard nuevo (P2b, tests/tabs-retiradas.test.ts, molde tests/funnel-estructura.test.ts): nadie en app/ ni lib/
  arranca una cadena con '/closing', '/ads-analyst' o '/landing-analyst' salvo los redirects y las rutas /api/*
  (las APIs NO se renombran) y /vsl/closing (es otra cosa).
- **C6 · API (P5):** lib/graficos-tablero.ts gana `leerTableroDe(sub)` y `guardarTableroDe(sub, raw)` (las de sesión
  delegan). lib/graficos-ia-generar.ts exporta `generarHojaIA(pedido: string, inicio: number)` (lo que hoy es
  `generar()` en app/api/graficos/ia/route.ts, CON la red de plataforma que ya tiene) y la ruta la importa.
  La spec completa de las operaciones: scratchpad/SPEC-api-dashboard.md.
- Ya hecho por Claude (no lo deshagas): `queTableroLeer()` en lib/graficos-lectura.ts (usado por graficos-datos y
  graficos-datos-extra), la red de plataforma en el AI Analyst y en «Pídeselo a MaKo», la guarda de «Marcar
  cobrada», las cohortes en «Todo».

## Detalle por paquete (del relevo, con archivo:línea medidos el 11/10/2026)

### P1 Elementos
- Modelo hoy: lib/graficos-catalogo.ts:814-841 (tipos), `sanearElemento` :987-1010 (aplica `urlDeImagen` a todo, :985).
  Dibujo: `CuerpoElemento` app/dashboard/Elemento.tsx:239-243; panel `PanelElemento` :533-608; ícono
  `Record<Exclude<TipoElemento,'imagen'>,…>` :407; menú Insertar sale de TIPOS_ELEMENTO (Galeria.tsx:102-112).
  MaKo nunca crea elementos que no sean un título (lib/graficos-ia.ts:308-311): dejarlo así.
- lib/embeds.ts YA es la lista blanca de lo insertable (YouTube, Vimeo, Loom, Drive, Panda, Wistia, Bunny, agendas;
  SANDBOX_EMBED/ALLOW_EMBED/REFERRER_EMBED :106-115; `embedDe`, `porQueNoSeInserta` :471-484, `direccionDeTexto` :348,
  `reconocerUrl` :222-302, HOSTS_IFRAME :161-164). Le falta Fathom y video directo:
  · Fathom: host EXACTO fathom.video / www.fathom.video, `/share/<token>` o `/embed/<token>` → `https://fathom.video/embed/<token>`;
    `/calls/` → src null con «Usa el link de Compartir de Fathom». Medido: /share/ manda X-Frame-Options SAMEORIGIN
    (no entra en un iframe); /embed/ con token inválido → 302 a la home. Miniatura `/share/<t>/thumbnail`.
    ⚠️ Sumar fathom.video a HOSTS_IFRAME también lo habilita en las clases del curso y el editor rico
    (lib/html-seguro.ts, app/_ui/EditorRico.tsx): corré tests/html-seguro.test.ts y tests/embeds.test.ts.
  · `videoDirecto(url)`: .mp4/.webm/.m4v/.mov (la regla de lib/curso.ts:365, mudada).
  · `miniaturaDe(url)`: YouTube i.ytimg.com/vi/<id>/hqdefault.jpg, Fathom /share/<t>/thumbnail.
- Diseño de los tres elementos:
  · `enlace` {w:4,h:2}: texto + url + tamaño/alineación/color. Saneo `urlDeEnlace`: camino interno `^/(?![/\\])`
    ≤500, o http/https con dominio, RECHAZANDO usuario:clave@host, javascript:, data:, //. Externo → `<a target=_blank
    rel="noopener noreferrer">` con ↗; interno → app/_ui/Link (conserva ?ws=). Editando, el clic selecciona
    (preventDefault) y el doble clic edita el texto, como CuerpoTexto.
  · `video` {w:6,h:7}: url (https) + título. embedDe de clase video → iframe; directo → `<video controls preload="metadata" playsInline>`;
    Fathom → miniatura y clic para reproducir; siempre «Abrir ↗» al link original. Editando, `pointer-events: none`
    en el iframe/video (si no, se traga el clic de seleccionar y el arrastre).
  · `insertado` {w:12,h:12}: url sacada de un link o de un `<iframe>` pegado (`direccionDeTexto`); un código
    `<iframe>` nunca se guarda, sólo su dirección. iframe con SANDBOX_EMBED/ALLOW_EMBED/REFERRER_EMBED, lazy, title
    (no `no-referrer`: YouTube exige el Referer). Acepta cualquier https (decisión): conocido → embedDe; desconocido →
    tal cual. Rechazar nuestro propio host (X-Frame-Options DENY): «Para una pantalla de MaKo usa Enlace».
  · PDF (editor-css @media print): enlace = texto + URL; video = miniatura + título (el link de Fathom NO se imprime:
    es público); insertado = placeholder con título y proveedor; segunda capa `.lk-comp--elemento iframe, video {display:none}`.
  · Panel: Enlace (texto, enlace con borrador que se aplica al salir, tamaño, alineación, color); Video («Pega el
    link del video», proveedor reconocido, error); Insertar (textarea «link o código», título). Sin color para
    imagen, video e insertado.
  · Íconos: 'link' (app/_ui/iconos-menu.tsx:63), 'video' (:99), uno nuevo 'insertar' (</>).
  · Código nuevo en app/dashboard/ElementoInsertado.tsx (lo importa CuerpoElemento). tests/graficos-elementos.test.ts:236-245
    cuenta UN `height: '100%'` en Elemento.tsx y barre hex sólo ahí: extendé los dos chequeos al archivo nuevo.
- Catálogo pedido por P2a (lo escribe P1): `cat('estado','Estado')` en el conjunto `llamadas` (lib/graficos-catalogo.ts:169-178);
  entrada `llamadas_venta` en ENTIDADES (:312) con entidad `llamada`, ids `{llamada, lead}`, unidad `['llamadas','con_puntaje']`
  (mirá la forma de la entrada `llamadas` y copiala). P2a llena las filas.

### P2a Closing (datos y ficha)
- Inventario de la tab (app/closing/ClosingBrowser.tsx, que P2b borra cuando vos termines el port): KPIs, hallazgo,
  tendencia, embudo, factores con ejemplos, closers (ya en el Dashboard); FALTA: KPI «Analizadas · servicio
  excluidas · sin analizar», la LISTA de llamadas con búsqueda/filtros/orden (:549-622), el DETALLE de una llamada
  (:629-1058: cabecera, reproductor Fathom :819-844 —iframe fathom.video/embed/<embed_token>?autoplay=1, miniatura
  /share/<t>/thumbnail, ▶ mm:ss abre share_url?timestamp=N en otra pestaña—, resumen, historial de revisiones,
  Análisis :854-1007, Momentos :987-1007, Transcript :1009-1058 en vivo de Fathom), y las TAREAS: sincronizar
  (POST /api/closing/sync), re-analizar (POST /api/closing/analyze), revisar a mano y re-evaluar con MaKo
  (POST /api/closing/revise). Datos: getClosingViewData (lib/closing.ts:1085-1128), leerLlamada
  (lib/api-mako/areas/closing.helpers.ts:38-46).
- Plan: (1) `llamadas_venta` con dimensión `llamada` (lib/graficos-fuentes-extra.ts:116) y filas con title, lead_id,
  lead_nombre, invitee_email (lib/graficos-datos-extra.ts:362-389, `d.llamada` y `r:{llamada, lead}`); sumar
  'llamadas_venta.llamada' a DIMENSIONES_PERSONA (lib/graficos-acciones.ts:54); (2) `llamadas` con `estado`
  (lib/graficos-datos.ts:263-273: analizada, pendiente → «Sin transcript», error → «Con error», descartada) —el
  `cat` en el catálogo lo pone P1—; (3) bloque nuevo `llamadas_cierre` («Las llamadas») en BLOQUES_EXTRA
  (w12 h18) y BLOQUES_CON_PERSONAS, datos `{ llamadas: [{id, fecha, tipo, closer, nombre, empresa, puntaje, tono,
  minutos, conTranscript}], counts, ultimaSync }` con la misma memo `una('closing', getClosingViewData)` + enVentana;
  lista compacta, el detalle se pide al abrir; (4) GET /api/closing/llamada?recording_id= con `leerLlamada`, puerta:
  sesión + rol admin o closer + tabEnCapa('graphics') + Fathom conectado; (5) plantilla Closing
  (lib/graficos-plantillas-analysts.ts:115-142): KPI «Analizadas» y el bloque llamadas_cierre abajo; reescribir el
  comentario :9-12 («una hoja mira, no ejecuta» ya no vale: decisión de Martín); (6) FichaLlamada (C1), Modal de
  app/_ui con `useCerrarEstable` (app/customer-success/curso/dialogo-foco.ts), cada fetch con `signal` (transcript
  ~35 s, analyze ~125 s, revise ~125 s), reproductor con `embedDe(share_url)` si P1 ya lo sumó (si no, la URL
  fathom.video/embed/<embed_token> como hoy), «Lead →» con app/_ui/Link, después de una tarea `onCambio()`;
  (7) abrir la ficha desde: una fila de llamadas_cierre, los ejemplos de Factores (BloquesClosing.tsx:69 hoy es un
  Link a /closing?call=), y la acción `ver_llamada` (lib/graficos-acciones.ts:85 → `tipo:'llamada'`, dibujada en la
  caja del Detalle como la ficha del lead, app/dashboard/Detalle.tsx:116,134-137); (8) sincronizar: en la línea de
  arriba del bloque («Sincronizado dd/mm · ↻») y en su vacío, `signal` de 305 s; (9) puertas de
  /api/closing/{sync,analyze,revise,transcript}: hoy sólo exigen sesión y Fathom (un setter puede gastar IA):
  admin o closer. `analizar-lead` NO se toca (lo usa el CRM). (10) API closing (closing.def.ts:18-19,133;
  closing.run.ts:52 `linkLlamada` → `linkPantalla('/dashboard?hoja=closing&llamada='+id)`, :571 «Hazlo desde la hoja
  Closing del Dashboard»). Privacidad: nombres y links de Fathom sólo en pantalla (no salen por HTTP en la API).

### P2b Dashboard: acceso, hojas y retiro
- C2, C3, C5 de arriba. Además: `?hoja=` hoy en app/dashboard/page.tsx:37 (`h.id === p.hoja`, si no cae a hojas[0]).
- Referencias a cambiar al retirar /closing (relevo): app/closing/page.tsx → redirect (validar `call` entero);
  borrar app/closing/ClosingBrowser.tsx SÓLO cuando P2a haya portado la ficha (si al terminar vos todavía no existe
  app/dashboard/bloques/extra/FichaLlamada.tsx, dejalo y reportalo); nav.ts:239 (+ comentario :243-246);
  lib/mako-doer-in.ts:292,298 (el prompt arma /closing?call= → /dashboard?hoja=closing&llamada={recording_id});
  lib/mako-tools.ts:221-222 comentario; lib/mako-capacidades.ts:103-105 (+ :59-62 landing, :108-111 ads);
  lib/retro-reporte.ts:27,37-38; lib/preview-links.ts:88 (una regla para /dashboard?hoja=closing… antes de :87);
  app/configuraciones/page.tsx:22 y app/equipo/page.tsx:25 («El Closer ve CRM, WhatsApp y Closing Analyst» →
  «… y la hoja Closing del Dashboard»); app/admin/dev/areas.ts:373-396 (verEnApp y vive[] de las tres áreas;
  tests/dev-areas.test.ts falla si vive nombra un archivo borrado); app/admin/docs/catalogo.ts:70,74;
  lib/api-mako/tipos.ts AREA_INFO (closing: tab 'Dashboard', ruta '/dashboard?hoja=closing'; landing: tab 'Landing
  Generator', ruta '/landing-generator'); tests/graficos-analysts.test.ts:261-273 (hoy EXIGE que las tres sigan en
  la sidebar: invertir); tests/graficos-interactividad.test.ts lo toca P2a; docs/dev-tabs-mapa.md.
  Si borrás una ruta: `npx next typegen` (AGENTS.md).

### P3 Ads Analyst → Ads Writer
- La tarea que se muda (app/ads-analyst/ScriptsBrowser.tsx): «Analiza un guion nuevo» :581-612 + estado :223-226 +
  valorar/viewDraft/borrarDraft :252-267 + `ValoracionView` :884-968 (POST/DELETE /api/ads-analyst/valorar, tabla
  script_drafts); Sincronizar `SyncBar` :723-739 + `sincronizar` :228-238 + confirmación :676-718 (POST
  /api/ads-analyst/sync); Ángulos y avatares (`TaxonomyManager`, botón :1091, modal :1163; /api/ads-analyst/{angles,avatares}).
  El detalle de un anuncio (AdDetailTabs) ya vive en el Ads Manager: no se muda.
- ScriptsBrowser.tsx NO se borra: app/marketing/ad-charts.tsx:25 importa FunnelModal, applyAngles, applyAvatares,
  AngleDef, AvatarDef. Exportá lo que AnalizarGuion necesite (ValoracionView/VV, TaxonomyManager, SyncBar…) o
  movelo a un archivo nuevo de app/ads-writer re-exportándolo desde ScriptsBrowser para no romper a ad-charts.
- Ads Writer hoy: app/ads-writer (AdsWriterApp.tsx:32, :159-162, :197-213 vistas por estado de cliente, sin ?tab=);
  page.tsx:24-44 manda al wizard PuertaCopyGen mientras el onboarding esté pendiente: `?tab=analizar` NO pasa por
  esa puerta (decisión), y el puente tiene que seguir corriendo antes del guard (tests/onboarding-recorte.test.ts:213-222).
  Tercera vista «Analizar guion» con `?tab=` leída en el server (molde app/experimentos/tabs.ts: módulo puro
  `tabDeUrl`) y escrita de vuelta con router.replace de app/_ui/Link ({ scroll: false }).
- Redirects: app/ads-analyst/page.tsx y app/ads-analyst/guiones/page.tsx → `/dashboard?hoja=ads-analyst`.
  (next.config.ts:62-63 /script-analyst → /ads-analyst NO se toca: encadena con tu redirect.)
- Textos de la API que nombran la tab: ads.def.ts:352, ads.helpers.ts:124,132, ads.run.ts:601 (las KEYS de gating
  'script' se quedan); lib/tab-activacion.ts:101-119 (sólo el título).

### P4 Landing Analyst → Landing Generator
- La tarea (app/landing-analyst/LandingAnalystApp.tsx): Analizar URL :330-348 (POST /api/landing-analyst/analyze),
  Buscar mis páginas :345 (POST /sync), pegar el texto :364-387, chips «tu seguimiento vio» :390-400, reintentar /
  volver a analizar / quitar :460,:473-474,:503-508,:586 (DELETE /view), el resultado del diagnóstico :427-451,
  :480-582, «Escribir la nueva versión» :509. Lo que es ANÁLISIS ya está en el Dashboard: `?tab=pulso`
  (PulsoPaginas.tsx) y `?tab=mapa` (MapaDeCalor.tsx, que importa el Dashboard: NO se mueve), y los KPIs del pie :596-603.
- La sesión «Landing Generator» trabaja en ../wt-gamma (rama gamma-editor, sin commitear) y reescribe
  app/landing-generator/page.tsx, crea crear/, editor/, [id]/, y toca LandingAnalystApp.tsx:509 (el link pasa a
  /landing-generator/crear?url=). Por eso: tu página va en `app/landing-generator/analizar/page.tsx` (carpeta nueva,
  estática, gana sobre [id]), importa LandingAnalystApp desde donde está hoy, y en LandingAnalystApp recortás sólo
  :212-229 (Tabs/URL), :314-326, :405-412, :596-603 — bloques distintos del :509 de wt-gamma. NO muevas el archivo.
- Redirect app/landing-analyst/page.tsx: `?tab=pulso|mapa` → /dashboard?hoja=landing; lo demás →
  `destinoConQuery('/landing-generator/analizar', …)` sin `tab`, con rutaConWs. Guard de rol de la página nueva:
  requireRolWs([], { nav: 'landing-writer' }) (la de Landing Generator) — y la key 'landing-an' sigue gobernando los
  gating de la API.
- lib/tab-onboarding-catalogo.ts:297 href → '/landing-generator/analizar' (key y pasos intactos).
- Textos de la API: landing.def.ts:193,279,286,292,307, integraciones.def.ts:97 (keys 'landing-an' se quedan).
- Bug vivo que encontró el relevo (reportalo, NO lo arregles en app/landing-writer: es de wt-gamma): el
  «Escribir la nueva versión» va a /landing-writer?url= y app/landing-writer/page.tsx:9 redirige sin la query.
  En TU página, si el botón queda, que apunte directo a /landing-generator con la url (mirá qué espera hoy main).

### P5 API de MaKo
- Spec: scratchpad/SPEC-api-dashboard.md (las ~21 operaciones). Bloqueos medidos:
  · tests/api-mako-registro.test.ts:57-69 busca el runner en `${area}.run.ts` (un archivo por área): mapear
    { metricas: ['metricas','dashboard'] } y :71-94 barrer TODOS los *.def.ts del directorio (hoy no vería dashboard.def.ts).
  · La regex de un runner es `^\s{2}'?id'?:\s*\{`: en dashboard.run.ts no puede haber otra cosa a 2 espacios.
  · `leerTablero()`/`guardarTablero()` leen la COOKIE: en un runner devuelven el inicial sin avisar → leerTableroDe/guardarTableroDe(sub).
  · Subs 'password'|'legacy'|'dev' no son una persona: sólo cuenta un sub numérico (= usuarios.id).
  · Un `object` del validador recorta las claves no declaradas: filtros como object[] {campo, valores[], texto}.
  · No usar el catálogo como `enum` en la def (ata docs/api-mako.md a graficos-catalogo): validar en el runner y
    devolver `disponibles`.
  · REST: prefijo `/metricas/...`, kebab-case, GET lee, acción no-GET, ruta de 2 tramos sin id de operación, una
    ruta por operación HTTP (tests/api-mako-rest.test.ts); títulos de recurso en lib/api-mako/recursos.ts.
  · tests/editor-acciones.test.ts:180-209: rótulos de parámetros y la primera frase de la descripción.
  · tests/mako-turno-app.test.ts:115-129: nada con rolMinimo admin le llega a un closer.
  · /api/v1 corta a 60 s: el AI Analyst por la API ARRANCA y devuelve «en curso» (after() de next/server o el
    mismo mecanismo de app/api/graficos/analisis/route.ts).
  · lib/mako-intencion.ts:811 regex de metricas: sumar «gráfico», «hoja», «informe», «plantilla», «AI Analyst».
  · docs/api-mako.md y el snapshot se regeneran con `node --import tsx scripts/generar-api-doc.mjs` (reescribe los
    dos enteros; lee el registro del DISCO, incluidos cambios ajenos sin commitear de plan.*: está bien para que
    tus tests pasen; Claude los regenera de nuevo en un worktree limpio antes de commitear).

## Lo que devuelve cada paquete (tu texto final)
1. Archivos tocados (y los nuevos). 2. Tests nuevos/cambiados con el resultado de cada rotura. 3. PENDIENTE PARA OTRO
PAQUETE (archivo:línea + código exacto). 4. BLOQUEANTES. 5. HALLAZGOS para la cosecha (síntoma → causa → dónde vive →
regla; sobre todo cuando el diagnóstico obvio era el equivocado). 6. Decisiones que tomaste. 7. Qué NO verificaste
(nada de navegador: lo hace Claude al integrar).


---

## Spec — el Dashboard en la API de MaKo (área `metricas`, archivos nuevos)

Decisiones de Martín (11/10/2026), no se re-preguntan:
- TODO el Dashboard se tiene que poder consumir por la API de MaKo.
- La API trabaja sobre el informe **de la persona que se nombre**: la operación recibe `persona` (email);
  si no se nombra y en la cuenta hay UN solo informe guardado, usa ése; si hay varios, pide elegir
  (`disponibles` con los emails). Sin ninguno guardado: para LEER, el informe inicial (dicho como tal);
  para ESCRIBIR, si hay un único admin en la cuenta, el suyo; si no, pide elegir.
- Gating: «cualquiera con acceso a esa tab». Hoy la tab Dashboard es sólo admin (`requireRolWs([], {nav:'graphics'})`),
  así que `{ tab: 'graphics', rolMinimo: 'admin' }` ES eso. (Los closers verán SÓLO la hoja Closing en la pantalla;
  por la API no se les abre nada nuevo: Ctx.rol sólo distingue admin/miembro.)
- La IA del Dashboard siempre cae a la red de plataforma (lib/graficos-ia-red.ts) si fallan las keys del negocio.

## Archivos (propios de este paquete)
- lib/api-mako/areas/dashboard.def.ts (nuevo, sin server-only, `area: 'metricas'`)
- lib/api-mako/areas/dashboard.run.ts (nuevo, server-only, SÓLO `RUNNERS`; nada a 2 espacios que no sea un id)
- lib/api-mako/areas/dashboard.helpers.ts (nuevo, server-only): resolver persona, leer/guardar informe, armar markdown/csv
- lib/api-mako/registro.ts (POR_AREA: `metricas: [...metricas, ...dashboard]`), lib/api-mako/runners.ts (TODOS)
- lib/api-mako/rest.ts (filas `/metricas/dashboard/...`), lib/api-mako/recursos.ts si hace falta
- tests/api-mako-registro.test.ts: mapear área → archivos ({ metricas: ['metricas','dashboard'] }) y barrer TODOS los *.def.ts en la regla de server-only
- lib/mako-intencion.ts: la regex de `metricas` reconoce «gráfico», «hoja», «informe», «plantilla», «AI Analyst», «análisis de la hoja»
- lib/graficos-tablero.ts: `leerTableroDe(sub)` / `guardarTableroDe(sub, raw)` (las de sesión quedan y delegan)
- lib/graficos-ia-generar.ts (nuevo): mudar `generar()` de app/api/graficos/ia/route.ts a lib (la ruta la importa)
- app/api/graficos/ia/route.ts (sólo para importar `generar` de lib)
- tests/api-mako-dashboard.test.ts (nuevo)
- NO tocar: lib/api-mako/areas/metricas.def.ts / metricas.run.ts / plan.* (otra sesión), docs/api-mako.md y el snapshot
  (se regeneran al final en un worktree limpio), app/dashboard/** salvo lo dicho.

## Operaciones (todas `gating: { tab: 'graphics', rolMinimo: 'admin' }`)
Ids en español, verbo + objeto, únicos en todo el registro (grep antes). Títulos ≤ 8 palabras. Descripción ≥ 40
caracteres, español neutro, primera frase 12-90 caracteres sin «propone», «(» ni «sí» (lib/editor-acciones.ts).
Cada parámetro con `rotulo` de 1-3 palabras con tildes («Hoja», «Persona», «Conjunto», «Métricas»…).

### Lecturas (costo gratis salvo que se diga; canales según privacidad)
1. `ver_catalogo_dashboard` — conjuntos (id, nombre, área, dimensiones, métricas, fechas, si es por dimensión),
   tipos de gráfico, bloques, plantillas de hoja, temas, tipos de control y de elemento. Salida markdown; formato json.
   Canales: whatsapp, app, http. (NO usar el catálogo como `enum` en la def: ata docs/api-mako.md a graficos-catalogo.)
2. `consultar_datos_dashboard` — un «gráfico» ad hoc: `conjunto`, `metricas[]`, `dimension?`, `desglose?`,
   `periodo?` (preset) o `desde`/`hasta`, `fecha?` (cuál fecha del conjunto), `filtros?` (object[] {campo, valores[]} o
   {campo, texto}), `limite?`, `orden?`. Valida contra el catálogo en el runner (error con `disponibles`). Usa
   `datosDeGraficos` (lib/graficos-datos.ts) con `sanearGrafico`. Salida markdown (tabla) y formatos json/csv.
   Canales: whatsapp, app, http. ⚠️ Por http, las dimensiones que NO son públicas (`dimensionPublica`,
   lib/graficos-analisis.ts) salen con alias (`Alias`/`etiquetaSegura`), nunca con nombres de personas.
   `lenta: true` (algunos conjuntos leen Meta en vivo o tablas grandes).
3. `leer_bloque_dashboard` — un bloque del catálogo (revenue, cobranza, cohortes, funnel_maduro, scl, los de
   Analysts…) en un período: `datosDeBloques`. Markdown/json. Canales: whatsapp, app (los bloques con personas,
   `BLOQUES_CON_PERSONAS`, sin http; los demás también http — o todo sin http si es más simple y seguro).
4. `listar_informes_dashboard` — quiénes tienen informe guardado en la cuenta (email, nombre, hojas con id y nombre,
   última modificación) + si no hay ninguno, el inicial. Canales: whatsapp, app (son personas del equipo: sin http).
5. `leer_hoja_dashboard` — una hoja del informe de `persona` (`hoja` = id o nombre): su configuración (cabecera,
   controles con lo de entrada, componentes) y los NÚMEROS de cada gráfico y bloque (lo mismo que dibuja la pantalla:
   `pedidosDeHoja` de app/dashboard/exportar.ts con vista vacía + datosDeGraficos + datosDeBloques). Formatos md
   (resumen legible), json y csv (`csvDeHoja`, el MISMO CSV que el botón Exportar). Canales: whatsapp, app, http
   (por http, sin personas: `sinPersonas`). `lenta`.
6. `leer_analisis_dashboard` — el último análisis del AI Analyst de una hoja (`vistaDe(usuario, hojaId)`): resumen,
   hallazgos, recomendaciones, cuándo, estado (corriendo/listo/error) y el horario. Canales: whatsapp, app, http.
7. `ver_detalle_numero_dashboard` — el detalle de un número (`detalleDeGrafico`, lib/graficos-detalle.ts): qué filas
   lo forman. Trae personas: sólo whatsapp y app.
8. `listar_valores_campo_dashboard` — los valores posibles de un campo (para armar un filtro): `valoresDeCampo`.
   Ojo: hoy traga errores y devuelve []; en la operación, si vuelve [] decirlo como «no llegó ningún valor», no
   «no hay». Canales: whatsapp, app (puede traer nombres: closer, lead).

### Acciones (confirmación `chat`, reversibles salvo que se diga; devuelven el id creado en `Ejecutado.datos`)
Todas escriben el informe de UNA persona: `preparar()` resuelve la persona y FIJA su `sub` y la versión leída en el
payload (nunca se resuelve de nuevo al ejecutar), y `ejecutar()` relee, aplica el cambio con las funciones puras del
catálogo (sanearHoja/sanearGrafico/instanciarPlantilla/conIdsNuevos/acomodar), guarda con `guardarTableroDe` y
ofrece en el resumen cómo deshacer. Compare-and-set: si el informe cambió entre preparar y ejecutar (otra pestaña
autoguardó), `ok:false` con «tu informe cambió, vuelve a pedirlo».
9. `crear_hoja_dashboard` — desde `plantilla` (id), en blanco, o con `pedido` (texto) para «Pídeselo a MaKo»
   (costo `ia`; usa el `generar` mudado a lib, gratis + red de plataforma). Devuelve `{ hojaId }`.
10. `editar_hoja_dashboard` — nombre, emoji, subtítulo, tema (plantilla de estilo), orden (mover).
11. `duplicar_hoja_dashboard`, 12. `borrar_hoja_dashboard` (no reversible por la API: se dice).
13. `agregar_grafico_dashboard` — tipo + conjunto + métricas + dimensión + período + título (+ lugar opcional;
    por defecto abajo con `acomodar`). Devuelve `{ componenteId }`.
14. `editar_grafico_dashboard` — título, tipo, métricas, dimensión, período, filtros guardados (controles), estilo
    básico (color, etiquetas).
15. `quitar_componente_dashboard`.
16. `agregar_filtro_dashboard` / `quitar_filtro_dashboard` — controles de la HOJA (período, lista por campo, búsqueda).
17. `insertar_elemento_dashboard` — texto, imagen (url https), enlace, video, embed, formas (según TIPOS_ELEMENTO
    vigentes; validar contra el catálogo en el runner). Una URL que pasó por un modelo no es exacta: el resumen la
    MUESTRA entera para que la persona la confirme.
18. `restablecer_informe_dashboard` — vuelve al inicial (no reversible por la API).
19. `analizar_hoja_dashboard` — corre el AI Analyst a mano (`arrancarAMano` / `analizarHoja`), costo `ia`,
    asíncrono (puede pasar de 60 s: arrancar y devolver «en curso»; se lee con leer_analisis_dashboard).
20. `programar_analisis_dashboard` — el horario (cada día/semana/mes, hora; o apagar) con `programar`.
21. `cancelar_analisis_dashboard` — `cancelarCorrida`.

### Reglas
- Una acción que ya está así devuelve `yaEstaba: true` en preparar (p. ej. editar con los mismos valores).
- Todo lo que se puede saber sin escribir falla en `preparar()`.
- `NO_EN_FLUJOS` (lib/api-mako/flujo.ts): NO hace falta excluirlas: en un flujo la persona se configura en el paso.
- Links que se devuelvan: `linkPantalla('/dashboard?hoja=<id>')` (lib/api-mako/link.ts), nunca APP_BASE_URL a mano.
- REST: lecturas GET, acciones POST/PATCH/PUT/DELETE, prefijo `/metricas/dashboard/...`, kebab-case, parámetros de
  ruta = parámetros obligatorios que son ids.
- Tests: tests/api-mako-dashboard.test.ts con la resolución de persona (pura, en helpers sin server-only si se puede:
  `elegirPersona(informes, admins, pedido)`), el armado del CSV/markdown, y los guards de privacidad por http.
  Probar cada test rompiéndolo y anotar el resultado en la cabecera.


---

## Brief para el chat «Chatbot» (sin mandar todavía)

Tarea del chat Graphics (Dashboard) para el chat Chatbot: que Automations pueda CONFIGURAR y CONSUMIR lo del Dashboard.

**De dónde sale.** Martín, 11/10/2026: «Revisa que todo esto se pueda consumir en la API de MaKo, absolutamente todo. Y también mandale tarea al chat de chatbot para que se pueda configurar en automations y consumir esto tambien». «Esto» es el Dashboard (la tab /dashboard, editor de informes: hojas, gráficos, bloques, AI Analyst con horario, Exportar).

**Lo que ya hizo el chat Graphics (commit {{COMMIT}}, en producción):** ~21 operaciones nuevas en el registro de la API de MaKo, área `metricas`, en `lib/api-mako/areas/dashboard.def.ts` + `dashboard.run.ts` + `dashboard.helpers.ts`. Las ids y parámetros exactos están en `docs/api-mako.md` (sección del área metricas, las que dicen «dashboard»). Nombres de parámetros FIJOS para que armes selectores por nombre: `persona` (email; en un flujo es OBLIGATORIA), `hoja` (id), `componente` (id), `conjunto`, `metricas`, `dimension`, `periodo`. Las acciones son `confirmacion: 'chat'`, `canales` con `app`, `gating: { tab: 'graphics', rolMinimo: 'admin' }`, devuelven el id creado en `Ejecutado.datos` y marcan `yaEstaba`. Crear, borrar y restablecer hojas rechazan correr en un flujo (lo frenan ellas mismas en `preparar()`, sin tocar `NO_EN_FLUJOS`). Hay una función pura `{{TEXTO_ANALISIS}}` que arma el texto corto de un análisis (resumen + 3 hallazgos + link).

**Lo que te toca (relevado en sólo lectura el 11/10; archivos tuyos, el chat Graphics no los toca):**

1. **El evento «El AI Analyst terminó» (lo más barato y lo más útil).** Hoy no existe un camino para «leer el Dashboard y mandar el resumen» (los flujos no corren lecturas: `lib/api-mako/flujo.ts:86` y `:230`; la salida de una acción no llega al paso siguiente: `ResultadoEjecucion` sin `datos` en `lib/nutricion-paso-accion.ts:83`). Propuesta:
   - `analisis_listo` en `SubtipoMako` y `EVENTOS_MAKO` (`lib/disparadores.ts:169`, `:181-190`) con `trae: ['mensaje']`.
   - Un aviso del catálogo con `textoDelCodigo: true` (`lib/avisos-catalogo.ts`; precedente en `:389`), id acordado **`dashboard_analisis_listo`**, datos `{ hoja, hojaId, persona, link }`. `AVISOS_POR_EVENTO`, `conMensaje` y `datosDelEvento` se derivan solos (`lib/aviso-evento.ts:40`, `:57`, `:64-68`).
   - Avisame el id cuando esté en main: el chat Graphics agrega la emisión en `lib/graficos-analisis-server.ts` (después de guardar un análisis PROGRAMADO, `emitirDelCatalogo('dashboard_analisis_listo', { ws, texto, datos, dedupKey: filaId + analizado_at })`) y saca del cron la nota «sin avisos… lo decide Martín» (`app/api/cron/dashboard-analisis/route.ts:20-22`).
   - Una plantilla de la galería «Resumen del AI Analyst por WhatsApp» con `cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'analisis_listo' }` y una tarjeta MaKo «📊 {{mensaje_mako}}» (`lib/plantillas-automatizaciones.ts:353`, variante en `:184`). Ojo: ya existe el aviso «Reporte semanal (lunes)» del super admin (`lib/avisos-catalogo.ts:384`): que no se confundan los nombres. `ObjetivoPlantilla` (`:150-161`) no tiene un objetivo que encaje: el objetivo nuevo lo decide Martín.
   - Con eso «cada lunes a las 9» se configura en el AI Analyst de la hoja (`programar_analisis_dashboard` o el panel) y Automations manda el resultado. Va al grupo de MaKo, con el dedup y el espaciado de `emitirAviso` (`lib/avisos.ts:136`, `:197-199`).

2. **El área «Dashboard» en el selector del paso ⚡ Acción.** Entrar al registro NO hace aparecer una operación: `seccionesDeAcciones` sólo ofrece las `curada && grupo && área` (`lib/editor-acciones.ts:393-405`). Hay que sumar las acciones del Dashboard que tengan sentido en un flujo (analizar una hoja, programar el análisis, editar una hoja o un gráfico, insertar un elemento; NO crear/borrar/restablecer) a `ACCIONES_DEL_FLUJO` (`:244-259`), `AREAS_ACCION`/`ICONO_AREA` (`:177-179`, el ícono `grafico` ya existe), `GRUPOS_ACCION`/`AREA_DE_GRUPO` (`:185-191`). El criterio escrito de la lista excluye «lo que no es de UN lead» y lo que usa IA (`:232-236`): ofrecerlas sólo cuando el disparador NO es de un lead (un CRON o un evento de MaKo) es una decisión de Martín.
   - **Selectores** en vez de texto libre: `OpcionesAccion` (`:442-446`) suma `informes` (email → hojas → componentes) y `conjuntos` (métricas y dimensiones), cargados en `app/api/flujos/opciones/route.ts:48-63` con lo mismo que usa la operación `listar_informes_dashboard` y `ver_catalogo_dashboard`. La lista `equipo` de hoy son NOMBRES (`nombresAsignables`), no emails: no sirve para `persona`. Los controles van en `app/_components/CamposAccion.tsx` (después de `:151-163`) y en el switch de `app/_components/EditorAccionMako.tsx:314`; las dependencias (la hoja según la persona, las métricas según el conjunto) con `ContextoDelPaso`/`visibilidadDe` (`lib/editor-acciones.ts:543-572`). La hoja se guarda por ID.

3. **Más adelante (no ahora, juntarlo con «Grupos de WhatsApp» para elegir a qué grupo va):** (a) que la salida de una acción se pueda usar en el paso siguiente (pide migración en `nutricion_inscripciones`; en el runner de `lib/flujos.ts` el transporte ya existe: `CtxFlujo.datos` y `conVariables`, pero `ejecutarPaso` no devuelve nada, `:239`, `:405-409`); (b) un evento `numero_umbral` («un número cruzó un umbral»): la REGLA vivirá en el Dashboard (tabla nueva + evaluación en el cron dashboard-analisis, sin IA) y el aviso saldría como evento de MaKo; avisá si lo querés encarar y lo coordinamos.

**Restricciones medidas:** un flujo corre sin sesión (`ctxDeFlujo`, `lib/api-mako/flujo.ts:57-62`: sin email ni sub), por eso la persona va en el paso. El AI Analyst nunca corre EN LÍNEA dentro de un flujo (puede tardar 240 s; el cron de nutrición tiene 300 s para todos): `analizar_hoja_dashboard` arranca y devuelve «en curso». La ⚡ Acción no pasa por el freno anti-ban ni gasta cupo: lo que va a un lead no es esto; el reporte va al grupo de MaKo por `emitirAviso`.

**Cómo se verifica:** una automatización con el evento «El AI Analyst terminó» → programar el análisis de una hoja en el ws3 (Cliente de Prueba) para dentro de 15 minutos → llega el mensaje al grupo con el resumen y el link. Y el selector: elegir persona → hoja → la acción «Analizar hoja» en un CRON.

**Commiteá por ruta explícita** (`git commit <rutas> -F msg`), y la cosecha en `docs/hallazgos-chatbot.md` (entrar al registro no es aparecer en el selector; las lecturas no corren en un flujo; un evento de MaKo rechaza la ⚡ Acción, `lib/aviso-evento.ts:94,135`; `datos` se pierde en la pantalla genérica, `lib/api-mako/flujo.ts:156`).
