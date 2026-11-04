# Relevo: «Web Generator: replicar landings» (claude3, desde el 29/10 ~01:50) — antes claude4, cierre al 95 %

> **4/11/2026 (nube, rearmado de la etiqueta `rescate/replica-editable-2810` sobre main, rama `punta/replica-editable-2810`).**
> Los 24 commits entraron sin choques. Lo de las secciones 000, 00, 0, 1 y 3 ya está en main (la landing High Ticket, la foto,
> el blanco, MaKo sin conexión va por su propia punta). De la 2 (la réplica editable) se hizo, sin la base de producción:
> «Contenido» con íconos y videos, el color del texto que gana también a un degradado, y el aviso cuando una capa de la página
> tapa la imagen de fondo. Tests 21/21, 13 roturas rojas, tsc-acotado limpio. **NO se pudo ver:** los dos ❌ en las copias #68 y
> #69, las capturas y el chat de punta a punta en #70–#72. El detalle y lo que falta: docs/hallazgos-editor-landing.md → «La
> réplica editable». Lo de abajo es la historia de la PC, con sus rutas `C:/dev/…`.

Pegar en un chat nuevo: `Leé docs/relevo/web-generator-replicar.md y seguimos desde ahí.` Las órdenes llegan del Cerebro
(con claude3: `local_428051c1-0369-4df2-ae6b-bcb42f63b64b`; el de claude4 era `local_797d5445-…`). Nada de esto está pusheado (sube el Cerebro). Notas largas en la carpeta
compartida (`…/side-session-notes/local_797d5445-…/desktop-offline-2810.md`, `replicar-landings-2810.md`). Scripts en el
scratchpad de la sesión 05be9946 (`C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-
marketing-main/05be9946-3313-4db7-ab72-196361b6fa78/scratchpad/scripts/`). Resultados en `C:/dev/revisiones/`.

**Orden: 0 (P0 de la foto: VERDE mandado, falta que el Cerebro lo suba) → 2 (la réplica editable). El 1 y el 3 están
cerrados.**

## 000. Landing principal → High Ticket + precios completos + sin fondo azul (29/10 ~11:15-11:20, Martín por el Cerebro)

- **29/10 ~12:55 ART: VERDE mandado a Integración y al Cerebro**: rama `landing-high-ticket-2910` (C:/dev/wt-landing-ht-2910),
  punta 746b3fefe (2f2ccb5ab · 7d376c836 · 746b3fefe), sin pushear. Tests dirigidos 50/50, romper 10/10, tsc-acotado 0 propios
  (con `--heap=3584`). El Cerebro publicó el documento: respaldos #73 (antes) y #74 (6 tarjetas); #32 v12 con las 9 del taller.
- **29/10 ~13:30 ART:** f387e11ce (Acelerador en grafito) · cd841f433 (mosaico de 9) · 066231cf0 (/vsl/_detalle a High Ticket) ·
  18cf6a960 (`--doc` para #33–#40), todo a Integración para tren-ab. Al Cerebro: la línea del mosaico (`--version 12`) y el bucle de
  las #33–#40 (versiones 2, salvo #36=10). Abierto: /vsl/ads vende «crea tu campaña», que ya no existe; la #40 vende el Avatar.
- **29/10 ~14:00 ART:** el Cerebro publicó #32 v13 (respaldo #75: 9 tarjetas + mosaico de 9) y las #33–#40 (respaldos #76–#83).
  213952a92: /vsl/ads vende el media buyer de hoy (decide cada día con su porqué; «propone» o piloto automático en Pro; topes y
  deshacer). Ninguna otra página de app/vsl promete Avatar, Image con IA, Leads Scraper ni LinkedIn.
- **29/10 14:29 ART: EN PRODUCCIÓN** (main 1cf06eba9, mako-obai8j5oz). Medido en hola-mako.com a 1440 y 390: 0 «VSL Funnel» en el
  HTML, título y og nuevos, las 9 tarjetas, ✗ en Esencial y Pro, la tabla (30 filas, 352 px a 390, sin desborde), Acelerador
  grafito, #beta #F5F7FA. Capturas: `C:/dev/revisiones/landing-principal-2910/produccion/`. **Quedan:** la tarjeta «Ads Manager
  para High Ticket» del respaldo sin documento (landing-html.ts); las páginas de funcionalidad se comparten con el og genérico del
  layout («MaKo — Marketing, CRM y ventas…»: `featureMetadata` no arma `openGraph`); la #40 y el Avatar, lo decide Martín.
- **29/10 ~15:30 ART:** 90a760e4b (VERDE a Integración): la tabla saca «Videos para tus anuncios, armados con IA» (Video
  Generator a medias) y «Crear y retocar imágenes con IA» pasa a «Diseñar tus imágenes sin salir de MaKo».
- **29/10 ~16:30 ART: el Avatar, para todos (Martín).** La sesión AI Avatar (`local_33825c6f-…`, rama ai-avatar-para-todos-2910,
  encima de 90a760e4b) hace TODO el código: topes-plan, la fila `enTodos` en la tabla, la línea de Esencial. Mío: abfe143ed, la
  tarjeta «Tu avatar con IA» SEGUNDA en el script de la #32, en el lugar de «Su visita, grabada». Leído contra la v13, vista
  previa en `C:/dev/revisiones/landing-principal-2910/propuesta-avatar/`. Lo corre el Cerebro con `--aplicar --version 13`
  recién con DOS cosas: la rama (es `ai-avatar-todos-2910`, 51ab0774a, que trae abfe143ed) DESPLEGADA, y un look generado en
  producción. El motor nunca generó uno, según docs/hallazgos-ai-avatar.md de esa rama (7511f5f14 lo dice en el script).
- **29/10 ~20:00: las tarjetas de la demo a Thiago.** e832e27eb (script + cosecha): 9 tarjetas en el orden de la llamada,
  «todo en uno» + «Reemplaza a» y «Y además»; el Avatar detrás de `--con-avatar`. El Cerebro la publicó: #32 v14 (respaldo #86).
  Producción medida a 1440 y 390 (`C:/dev/revisiones/landing-principal-2910/produccion-thiago/`). 251e1b75e: la última tarjeta
  impar a todo el ancho en 2 columnas. Leído contra la v14, es el único cambio; falta que el Cerebro lo corra con `--version 14`.
- DOCUMENTO #32 (ws9): `scripts/landing-principal-high-ticket.mts` lee la fila en vivo, cambia «VSL Funnel»→High Ticket (titular
  «El mejor SaaS para ventas High Ticket, de punta a punta»), deja 6 tarjetas (setter WA, CRM, Instagram, media buyer, landings,
  Closing Analyst) a 3 columnas, y saca el fondo azul de #beta (hoja). Sin `--aplicar` sólo lee. `--aplicar --version 10`: respaldo
  «Landing principal — antes del 29/10» (sin publicar) + guarda + publica. NO lo corrí: escribir en prod va con el sí de Martín en
  el chat (memoria aprobacion-prod-en-el-chat); lo corre el Cerebro.
- CÓDIGO (VERDE): portada-metadata, PortadaSinJs, respaldo (landing-html, landing-contenido), og-landing.jpg nueva; precios: ✗ por
  plan (`noIncluyeDe`, lib/planes-comparacion.ts) y la tabla de /planes en la portada (`CompararPlanes`, app/planes/Vitrina.tsx).
- Capturas y propuesta: `C:/dev/revisiones/landing-principal-2910/` (antes-*, propuesta-*, propuesta/vista-previa-portada.html).

## 00. P0 (29/10, del Cerebro) — «las páginas clonadas se desfasaron todas» — VERDE mandado (c3c6849bc), falta que suba

Martín: «Lo que más me interesa es que funcione al 100% Web Generator, porque las páginas clonadas se desfasaron todas...
Y la última prueba que intenté hacer con 100ads no funcionó». **Rama `web-generator-foto-2910`: d413ad03b (arreglo +
test) · 4bfbf85db (cosecha).** Medido DOM contra DOM (`C:/dev/revisiones/clonadas-2910/`, arnés en
`…/8011bc28-…/scratchpad/scripts/medir-clonadas.mts` + `copia-nueva.mts`): la PUBLICADA era fiel en las 5; el EDITOR no.
- Hecho: el corte no parte columnas (la foto marca `data-gm-junto` con la geometría), lo vacío no es sección, la caja del
  body no estira cada sección en el editor. holo en el editor 912 → 177 px de corrimiento; 100ads nueva = la original.
- **Lo próximo (en HtmlEditableVista.tsx, con el editor REAL para verificarlo):** (1) lo fijo/pegajoso (menú de
  respond y de holo) como en la original, encima de lo que sigue (hoy corre la página 40–280 px); (2) dibujar la copia al
  ancho de la original y escalarla al lienzo (~980 px hoy elige el diseño de tableta); (3) replicar de nuevo #68–#72.
- tsc-acotado de d413ad03b: salió 99 (NO se chequeó: el vigía o el turno); repetir por `con-turno`.
- **29/10 ~04:50, el Cerebro aprobó la dirección y pidió 4 cosas** (clics escalados medidos con un clic real sobre «30+
  posts a month»; lo fijo y el aviso de cookies sin bloque al final, en editor y publicada; las 5 del ws9 + 100ads antes y
  después a 1440/390/980 con la tabla de distancias por ancla; no pisar las copias viejas). Hecho SIN COMMITEAR en
  `C:/dev/wt-foto-2910` (esperaba el turno de tests): `escalaDeCopia` + `ANCHO_COPIA_ESCRITORIO` (html-editable.ts), la
  vista escalada (HtmlEditableVista.tsx: iframe a 1440 con `scale`, clic reenviado y capas vivas × escala), lo fijo
  (`data-gm-fijo` en la foto, `pegarLoFijo`/`esSeccionFija` en copia-identica.ts), tests 5/6/6b en
  web-generator-copia-franjas.test.ts. Clic real (arnés `clic-escalado.mts`, CDP Input.dispatchMouseEvent a escala
  0,6806): 4/4 anclas reciben el mousedown en su punto exacto (±1 px). Cadena de medición: `scratchpad/scripts/
  cadena-final.sh` → `C:/dev/revisiones/clonadas-2910/final/` (antes = worktree `C:/dev/verif-clonadas-antes`, origin/main).
- Reglas de la noche (Cerebro): todo lo pesado por `node C:/dev/con-turno.mjs`, un Chrome por vez, commits seguidos.
- **29/10 ~06:40: TODO COMMITEADO en `web-generator-foto-2910`** (punta c3c6849bc): d413ad03b · 4bfbf85db · 997537fc2
  (escala + lo fijo) · 40ea08e1b (lo fijo detrás del anunciador) · abced0bf1 (el <title>) · c3c6849bc (cosecha). Tests
  85/85; romper 33/33 + el del <title>. Tabla antes/después por ancla: `C:/dev/revisiones/clonadas-2910/final/tabla.md`
  (holo 913 → 98 a 1440, 1.755 → 107 a 980; respond 1.264 → 8 a 980; 100ads 0). tsc-acotado 0 propios (14 de _opencut).
  **VERDE mandado ~06:50 al Cerebro y a Integración.** tests-afectados no corrió (fila tomada). Worktree de «antes»:
  `C:/dev/verif-clonadas-antes` (origin/main 7f36fa9c6, limpio): se puede borrar cuando suba. Sin hacer: a 390 la publicada de holo/reportei
  también se corre (la copia en celular); una sección de holo +486 px en el editor.
- **29/10 ~08:20: tren-z dio 3 rojos** (diseno-elementos, editor-web-diseno-editable-clic, punta-a-punta-26-10: fijaban el
  JSX de antes de la escala). Arreglado en **9e73cfb2b** (sólo tests): 14/14 verdes, romper 9/9 rojas
  (`C:/dev/revisiones/clonadas-2910/romper-escala.json`). sha mandado a Integración.

## 0. P0 (29/10 00:40) — «No pude sacar la foto de la página. Vuelve a intentar.» — ARREGLADO (claude3, 29/10 ~03:00)

**Rama `web-generator-foto-2910` (desde origin/main 7f36fa9c6), worktree `C:/dev/wt-foto-2910`, punta 22b4b75c4:
601e6777d (arreglo + test) · a24437bb3 (cosecha) · 409b62839 (el regex de editor-landing-estilo) · 22b4b75c4 (cosecha: la
trampa de tests-afectados con los `todo`).** VERDE mandado al Cerebro (29/10 ~05:55). Sin pushear (sube el Cerebro).
- La URL: https://100ads.ai/ (log de función de Vercel, 03:38:21 UTC). NO era el tope: la ventana falló en < 5 s.
- Causa: en la ventana AISLADA, `sinRastreadores` sacaba dos pedazos `self.__next_f.push` del árbol de la app de Next
  (nombran a Facebook/Clarity) → React la borraba (#423) → foto con cuerpo vacío → el saneo la tiraba en silencio.
  Arreglo: la ventana deja los scripts de DATOS (`guardarDatos`). Y con foto, la ventana ya no se cierra sola a los 300 ms
  (perdía el mensaje 2 de 18): respaldo a los 10 s. El lector manda el motivo (`sinFoto`), saca la foto igual en el tope o
  en una caída, y la pantalla dice un texto por motivo.
- Medido con la ventana de verdad (`C:/dev/revisiones/web-generator-foto/ventana-repro.mts`): antes 0 palabras y foto
  vacía; ahora 684 palabras y la foto de 115 KB, 12 de 12. tests/web-generator-foto.test.ts 8/8, romper 18/18; los 3
  tests vecinos 56/56. tsc-acotado 0 propios (los 14 conocidos de _opencut). tests-afectados (5552 de 540 archivos): el único
rojo de verdad fue editor-landing-estilo (fija la forma del final; arreglado en 409b62839, 15/15); los otros dos que
nombró son `todo` de main (ver hallazgos-infra). Logs en `C:/dev/revisiones/web-generator-foto/`.
- SIN HACER: el Diagnóstico y la copia fiel siguen sacando los datos (una app de Next ahí probablemente en blanco, sin medir).
- Lo de abajo es el pedido original, de historia.

Llegó con la cuenta al 95 %: por la regla de cierre no se arrancó. Va ANTES que la réplica editable. Lo que mandó el
Cerebro (los números de línea son de origin/main, sin verificar acá):
- Ticket abierto de Martín (ws9, botón «Reportar a Soporte»): pantalla /web-generator/68, acción «Replicar», 29/10 00:38
  ART (03:38 UTC), Chrome 156 en 1536x730. NO trae la URL: buscarla en los logs de Vercel de
  `/api/landing-generator/replicar/leer` cerca de las 03:38 UTC, o lo que haya guardado el 68. **No preguntarle a Martín.**
- El mensaje sale de `app/web-generator/crear/Replicar.tsx:215`: `leerEnNavegador` da ok:true SIN `foto`, y «Vuelve a
  intentar» no dice por qué.
- `lib/editor-landing/lector-script.ts`, dos caminos que dejan `foto = null` en silencio:
  1. (primera sospecha) el temporizador de seguridad de `arrancar()` llama a `terminar(true)` a los TOPE+500 ms (TOPE =
     40 000 con foto); la bajada es de hasta 90 pasos × 250 ms + el «quieto» (hasta 10 s) + animaciones + `esperarQuieto`:
     en una página larga o lenta el tope llega ANTES de la línea ~1001 que saca la foto, y `terminar` manda el fin sin foto.
  2. `try { foto = (JS_INSTANTANEA)(); } catch (e) { foto = null; }` (~1001): si la instantánea de
     `copia-identica-script.ts` revienta, el motivo se pierde.
- **Hecho =** si el tope llega con foto pedida y sin foto, la saca igual antes de terminar (parcial, pero con foto); sin
  foto, el lector manda el MOTIVO (tope, la excepción, la página que no cargó) y la pantalla lo dice con palabras de Martín
  (regla del AGENTS.md: lo que corre el chat de un editor devuelve su motivo; «Vuelve a intentar» sólo si reintentar
  sirve); reproducido con la URL real (o una landing larga); test rojo→verde probado rompiéndolo; tsc-acotado sin errores
  propios (con `--heap=4096` si aborta con 134); commits chicos y VERDE con el sha al Cerebro (él verifica, sube y cierra
  el ticket con el aviso a Martín). Rama sugerida: desde origin/main, `web-generator-foto-2910`.

## 1. P0 — el Web Generator en blanco: CERRADO (28/10 ~23:45)

VERDE mandado con 11a0e8211; el Cerebro lo aceptó y lo subió en tren-x (merge 7f63046be). tests-afectados VERDE (2597),
tsc-acotado 0 propios (sólo los 14 conocidos de _opencut). Las copias #68–#72 van a la papelera cuando cierre la MATRIZ
de la réplica editable (acordado con el Cerebro). Producción (29/10, claude3): el deploy `dpl_6EEd…RkuqVR` (7f36fa9c6) lleva el arreglo; en sus logs Martín
navegó #72 → #69 → #70 → #68 y cada una cargó la suya (antes terminaban en #72), sin la ráfaga de `/72`. La ENTRADA POR EL
MENÚ no se vio (los `GET /web-generator` de a pares son el prefetch) y Chrome no estaba conectado con claude3: falta mirarla
con el Chrome de Martín.
Lo de abajo queda de historia.

Martín: «Cada vez que entro a web generator, hay un bug que aparece todo en blanco, le tengo que dar a refresh para que me
cargue la tab» · «Me pasa en la cuenta de superadmin entrando desde cualquier dispositivo».
- **Causa (reproducida con el build de producción 23b329b5e, `next start` + Chrome sin ventana, sesión `dev@local` admin
  ws9):** entrando por el MENÚ, el `redirect()` del layout de /web-generator (a la última landing) viaja ADENTRO del RSC
  en el nodo del layout (`NEXT_REDIRECT;replace;/web-generator/72?ws=9;307;`); el router guarda ese nodo y, al llegar a
  /web-generator/<id> (el MISMO layout), lo vuelve a tirar: pide /web-generator/72 cada segundo para siempre, en blanco.
  Directo (= refresh) es un 307 real y anda. Sólo el ws9 tiene landings que abrir → «sólo el super admin».
- **Arreglo: rama `web-generator-blanco-2810` (desde origin/main = 23b329b5e), commit 7e881d5b5, worktree
  `C:/dev/wt-replicar-2810`.** `esNavegacionDelCliente()` (lib/pedido-actual.ts; la regla pura en pedido-actual-reglas.ts:
  `Next-Url` o `Sec-Fetch-Dest` ≠ document; `headers()` no deja ver `RSC: 1`). Un layout que redirige DEBAJO de sí mismo
  lo hace sólo en la carga; navegando, la página. Aplicado en /web-generator, /plan (/plan ↔ /plan/agencia) y
  /m/second-brain (→ /mapa; lo encontró el recorrido del test). Tests: `tests/redirige-navegando.test.ts` (recorre todo
  `app/`) + `redirige-antes-del-loader.test.ts`: 17/17.
- **28/10 22:05 (88 % semanal):** sumado /crm (el resumen de un lead de otro negocio redirige a `/crm/<id>/resumen?ws=<dueño>`,
  debajo de su layout): `app/crm/layout.tsx` + test 2, SIN commitear en `C:/dev/wt-replicar-2810`. 20/20 tests (con
  `crm-redirige-antes-del-loader`); romper 9/9 (`scratchpad/romper_blanco.py`, B9 = /crm). /dashboard (→ /plan o /crm) y
  /admin/operaciones (→ /inicio o /second-brain) NO caen debajo de sí mismos: sanos.
- La cosecha ya escrita: `scratchpad/cosecha-blanco.md` (falta pegar el resultado en «Verificado» e insertarla en
  docs/hallazgos-infra.md después de «En /m, la ruta del header…» + fila del índice). Memoria `recorrer-local-build-parcial`
  ya actualizada.
- **28/10 23:10 (92 %): VERIFICADO con el build** (`arreglo2/informe.json`): menú 5/5 el editor (producción: 5/5 en blanco,
  4-15 `_rsc`), `router.push` a #68/#69/#70 cada una en la suya (producción: las tres a /72). Commits en
  `web-generator-blanco-2810`: 7e881d5b5 (arreglo) · 97eb40963 (/crm) · 11a0e8211 (cosecha hallazgos-infra + índice).
  FALTA sólo: tsc-acotado (el 1º lo mató el vigía: 99) y `tests-afectados --base 23b329b5e` (en `C:/dev/revisiones/
  web-generator-blanco/{tsc,tests-afectados}.log`), y el VERDE con el sha 11a0e8211 y las copias #68–#72 a la papelera.
- (Lo de abajo ya está hecho, queda de historia.) **FALTA (en este orden):** 1) la corrida `SALIDA=arreglo2` (build con `app/web-generator/*/page.tsx`: los CORCHETES de
  `[id]` en `--debug-build-paths` son un patrón y esa ruta no se compila) y ver en `arreglo2/informe.json` que desde el menú
  aparezca el editor, sin la ráfaga de `/web-generator/72?_rsc`; 2) tsc-acotado y tests-afectados con turno; 3) cosecha +
  índice, commit por ruta en `web-generator-blanco-2810`; 4) VERDE al Cerebro con el sha nuevo y los números de las copias
  #68–#72 para la papelera (lo pidió así).
- ⚠️ **Trampa de la reproducción:** `next build --debug-build-paths` en Windows (Next 16.2.6) NO compila ninguna ruta de
  `app/` y sale verde (compara `/x/page.tsx` con `\x\page.tsx` en `route-discovery.js`, `applyDebugFilter`), y `next start`
  sirve el `.next` VIEJO. Parche local SÓLO en `C:/dev/wt-replicar-2810/node_modules/next/dist/build/route-discovery.js`
  (comentario «parche local (Windows)») + `rm -rf .next` en el pipeline. Llevarlo a hallazgos-infra y a la memoria
  `recorrer-local-build-parcial`. Los 64 KB «cortados» que vi al principio eran mi propio recorte: el RSC llega entero.
- Otros candidatos con layout que redirige a destinos no literales (no los cubre el test): /dashboard (`homeDeCapa`),
  /crm (`destinoDelResumen`), /admin/operaciones. Revisar si alguno cae debajo de su propio layout.

## 2. La réplica 100 % editable (PRIORIDAD 1 después del P0)

Martín: «Es super importante que la replica de las landing, no solo replique, sino que luego sea editable absolutamente
todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».
- **29/10 ~00:15 (93 %): COMMITEADO a medias en a72620aa3** (rama `replica-editable-2810`, worktree
  `C:/dev/wt-replica-editable`, árbol limpio, sin pushear: NO es VERDE). tsc-acotado sin errores propios (hace falta
  `--heap=4096`: con 2560 aborta con código 134; corregidos dos getters sin tipo en el DOM de mentira del test); tests
  48/48.
- **MATRIZ MEDIDA (29/10 00:20, `C:/dev/revisiones/replica-editable/matriz.json`; el script `scratchpad/scripts/
  matriz-editable.mts` tenía un bug propio —`elementosDeHtmlEditable` devuelve una lista con `tipo`—, ya corregido):**
  - Por «Contenido» se llega a TODO texto, imagen y botón del censo en las 5 (#68 247/128/178 · #69 218/93/245 ·
    #70 504/169/55 · #71 99/57/13 · #72 145/0/15). Con clic directo, bastante menos (lo oculto sólo por la lista).
  - Duplicar, mover, quitar, fuente, botón (destino) e imagen: OK en todas las secciones; persiste tras el saneo.
  - ❌ #68 sección 10: `ponerColor` texto y fondo no cambian el color calculado (sospecha: `-webkit-text-fill-color` /
    `background-clip:text` o un `!important` de la hoja de la página; mirar el CSS de esa sección).
  - ❌ #69 sección 13: `ponerImagenDeFondo` no se ve (sospecha: el fondo está en un `::before` o en un `background` con
    `!important`).
  - ⚠️ El chat ve sólo 60 botones por sección (`TOPE_ELEMENTOS_DISENO`, ia-bloques.ts:118): #68 secc 0 tiene 91 y #69
    secc 1 tiene 71 (menús). Por «Contenido» sí se llega.
  - SIN MEDIR: si «Contenido» lista íconos (12/158/89/32/14), videos (1/1/22/0/0) y fondos (3/2/0/0/0); la matriz no los
    cuenta en la lista. Y la matriz por PROMPT del chat en #70–#72 (`chat-e2e-2`).
  - Capturas 1440/390 copia vs editada de las 5 en `C:/dev/revisiones/replica-editable/capturas/` (sin mirar todavía).
- **Lo próximo, en este orden:** los dos ❌ (con su test, rompiéndolo) → íconos/videos/fondos en la matriz → mirar las
  capturas → chat-e2e en #70–#72 → `tests-afectados --base 23b329b5e` → cosecha (borrador en `C:/dev/revisiones/replica-editable/
  cosecha-replica-editable-borrador.md`, con lo medido de arriba) + índice + bitácora → VERDE → recién ahí las copias #68–#72 a la papelera. Tests `tests/replica-editable.test.ts` 20/20; romper 40/40 (`scratchpad/romper_replica.py`).
- Hecho en el worktree: «Elemento» (el de afuera, duplicar, mover, quitar, colores, fondo e imagen de fondo, fuente,
  «Agregar» texto/botón/imagen) y «Contenido» (TODO lo de la sección, también lo OCULTO) en `HtmlEditableVista.tsx`,
  `PanelContenidoDiseno.tsx`, `lib/editor-landing/diseno-elemento-acciones.ts`, `diseno-contenido.ts`. El chat: sacar,
  reordenar y duplicar secciones (`quitar`/`orden`/`copiaDe`, `cambiosDeLista`, `planDeAplicacion`, `trQuitarYOrdenar`,
  la API `editarConIA`), resumidas cuando no entra (`vistaQueEntra`), textos por lugar + texto de antes (`cambios`),
  botones e imágenes por número con «duplicar», `<button>` como botón (`igualarEstilo`), y el resumen dice lo que NO se
  pudo (`avisosDeEdicion`).
- Medido: copias en el ws9 **#68 respond · #69 reportei · #70 holo · #71 masterads · #72 closermood** (siguen como
  material de prueba). Chat de punta a punta con la IA (`chat-e2e.mts`, sin guardar): titular, botón verde + WhatsApp,
  quitar, duplicar y reordenar OK en #68 y #69; la imagen NO: Openverse tarda 11–20 s y el buscador corta a 12 s
  (`lib/imagenes-stock.ts`); ahora el chat lo dice. Faltan #70–#72 (`chat-e2e-2`; «quitar» ya exige la sección nombrada).
- FALTA: la matriz (`matriz-editable.mts`, ya avisa si falla) y las capturas como las dibuja el editor (`vista-copia.mts`
  + `capturas.mts`) con `pipeline-replica-2.sh` y turno; abrir el editor real (con el parche del build ahora se puede);
  tsc + tests-afectados; cosecha (borrador `scratchpad/cosecha-replica-editable.md`) + índice + bitácora; commit; VERDE.
  Decidir si se suma otro proveedor de fotos (Openverse lento).

## 3. MaKo sin conexión — VERDE mandado (28/10 ~20:30)

T1 arreglada: `desktop-offline-2810` = 6ef621b24 + 813101f75. T2 rebasada: `desktop-offline-t2-2810` = 3e6a0dddf +
746633c96. tests-afectados VERDE (3117). Worktrees `C:/dev/wt-desktop-offline` (T2) y `C:/dev/wt-t1-arreglos` (T1).

## Espera a Martín
Nada bloqueante. Lo de la imagen por el chat depende de Openverse (externo).
