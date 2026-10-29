# Relevo: «Web Generator: replicar landings» (claude4) — corte al 97 %, 28/10/2026 ~21:20

Pegar en un chat nuevo: `Leé docs/relevo/web-generator-replicar.md y seguimos desde ahí.` Las órdenes llegan del Cerebro
(`local_797d5445-2365-464d-ae3d-1d71aa7baa8c`). Nada de esto está pusheado (sube el Cerebro). Notas largas en la carpeta
compartida (`…/side-session-notes/local_797d5445-…/desktop-offline-2810.md`, `replicar-landings-2810.md`). Scripts en el
scratchpad de la sesión 05be9946 (`…/Temp/claude/…/05be9946-…/scratchpad/scripts/`).

## 1. P0 — el Web Generator en blanco (ARREGLADO, falta verificar con el build)

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
- **FALTA (en este orden):** 1) rebuild + `pipeline-blanco.sh` con `SALIDA=arreglo` (`node C:/dev/con-turno.mjs bash
  <scratchpad>/scripts/pipeline-blanco.sh`) y ver que desde el menú aparezca el editor (`informe.json`: `editor:true`, sin
  la ráfaga de `/web-generator/72?_rsc`); 2) romper (sacar la condición en cada layout y la regla pura); 3) tsc-acotado y
  tests-afectados con turno; 4) cosecha en docs/hallazgos-infra.md (al lado de los dos #310) + fila del índice; 5) VERDE al
  Cerebro con los números de las copias #68–#72 para la papelera (lo pidió así).
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
- **Rama `replica-editable-2810`, worktree `C:/dev/wt-replica-editable`, SIN commitear** (sólo este relevo, 714bc51e1 y el
  de ahora). Tests `tests/replica-editable.test.ts` 20/20; romper 40/40 (`scratchpad/romper_replica.py`).
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
