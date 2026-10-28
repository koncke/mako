# Relevo: «Web Generator: replicar landings» (claude4) — al 28/10/2026 21:05

Pegar en un chat nuevo: `Leé docs/relevo/web-generator-replicar.md y seguimos desde ahí.` Las órdenes llegan del
Cerebro (`local_797d5445-2365-464d-ae3d-1d71aa7baa8c`). Notas largas: la carpeta compartida de sesiones
(`…/side-session-notes/local_797d5445-…/desktop-offline-2810.md` y `replicar-landings-2810.md`).

## 1. P0 — «Cada vez que entro a web generator, hay un bug que aparece todo en blanco, le tengo que dar a refresh»

Martín: «Me pasa en la cuenta de superadmin entrando desde cualquier dispositivo». Producción = 23b329b5e.
- **Estado: reproduciendo, sin causa todavía.** Build de producción en `C:/dev/wt-replicar-2810` (detached en 23b329b5e,
  `node_modules` propio y PARCHEADO: ver abajo), `next start` en 127.0.0.1:3457 y Chrome sin ventana con la sesión de
  prueba `dev@local` (rol admin = super admin, ws9). Pipeline: `scratchpad/scripts/pipeline-blanco.sh` (+ `blanco.mts`);
  salidas en `C:/dev/revisiones/web-generator-blanco/` (`pipeline.log`, `prueba3/informe.json`, capturas).
- Descartado: el `_rsc` (Next lo saca antes del proxy); el blanco no deja error en `errores_app` (el único #310 del Web
  Generator es el del 25/10, ticket #9); la hoja de una copia sólo entra a los iframes.
- Medido en el ws9 (código de prod, sólo lectura): `listar` 37 landings · 168 KB · 813 ms (trae la primera sección
  ENTERA de cada una); abrir una copia pesa hasta 886 KB (#69). En el ws3: 21 KB.
- ⚠️ **Trampa**: `next build --debug-build-paths` en Windows (Next 16.2.6) NO compila ninguna ruta de `app/` y sale
  verde: el filtro compara `/x/page.tsx` con `\x\page.tsx` (`route-discovery.js`, `applyDebugFilter`); y `next start`
  sirve el `.next` viejo. Las corridas 1 y 2 NO valen. Parche local en esa copia de `node_modules` + `rm -rf .next`.
  Falta llevarlo a docs/hallazgos-infra.md y a la memoria `recorrer-local-build-parcial`.
- Al cerrar: test que lo fije (probado rompiéndolo), causa en hallazgos-editor-landing o infra, VERDE al Cerebro con los
  números de las copias #68–#72 para mandarlas a la papelera (el Cerebro lo pidió así).

## 2. La réplica 100 % editable (PRIORIDAD 1 después del P0)

Martín: «Es super importante que la replica de las landing, no solo replique, sino que luego sea editable absolutamente
todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».
- **Rama `replica-editable-2810`, worktree `C:/dev/wt-replica-editable` (desde 23b329b5e), SIN commitear** salvo este
  relevo. Tests: `tests/replica-editable.test.ts` 20/20 (+ api-mako-landing-contenido, editor-landing-ia/agente).
  Romper: 40/40 cazadas (`scratchpad/romper_replica.py`, log `C:/dev/revisiones/replica-editable/roturas.log`).
- Hecho (en el worktree):
  - «Elemento» (cualquier elemento: el de afuera, duplicar, mover, quitar, color, fondo, imagen de fondo, fuente, y
    «Agregar» texto/botón/imagen) y «Contenido» (todo lo de la sección en una lista, también lo OCULTO: respuestas de
    preguntas, menús, pestañas, textos que rotaban, opciones de un select) en `HtmlEditableVista.tsx`,
    `PanelContenidoDiseno.tsx`, `lib/editor-landing/diseno-elemento-acciones.ts`, `diseno-contenido.ts`.
  - El chat: sacar, reordenar y duplicar secciones (`quitar`/`orden`/`copiaDe`, `cambiosDeLista`, `planDeAplicacion`,
    `trQuitarYOrdenar`, también por la API `editarConIA`); una página que no entra en un pedido va con resumidas
    (`vistaQueEntra`); los textos de un diseño por lugar + texto de antes (`cambios`); botones e imágenes por número,
    con «duplicar»; un `<button>` es botón (con destino pasa a `<a>` y se ve igual: `igualarEstilo`); el resumen dice
    lo que NO se pudo (`avisosDeEdicion`).
- Medido: las 5 copias en el ws9: **#68 respond · #69 reportei · #70 holo · #71 masterads · #72 closermood**. El chat
  de punta a punta con la IA del ws9 (`scratchpad/scripts/chat-e2e.mts`, sin guardar): titular, botón verde + WhatsApp,
  quitar, duplicar y reordenar OK en #68 y #69; la imagen NO: Openverse tarda 11–20 s y el buscador corta a 12 s
  (`lib/imagenes-stock.ts`, `AbortSignal.timeout(12_000)`); ahora el chat lo dice. Falta correrlo en #70–#72 con la
  medida estricta de «quitar» (ya en el script).
- A medias / falta:
  - la matriz de documento (`scratchpad/scripts/matriz-editable.mts`): la primera corrida falló en silencio (ya avisa);
    hay que correrla (pipeline `pipeline-replica-2.sh`, con turno);
  - las capturas lado a lado como las dibuja el editor (`vista-copia.mts` + `capturas.mts`): las primeras salieron en
    blanco porque la EXPORTACIÓN encierra cada diseño en un iframe fijo de 640 px (a propósito, `especificacion.ts`);
  - el editor real no se abrió (RAM): con el parche del build parcial ahora se puede;
  - tsc-acotado + tests-afectados con turno; cosecha en docs/hallazgos-editor-landing.md (borrador en
    `scratchpad/cosecha-replica-editable.md`) + fila del índice; bitácora (`app/admin/dev/landing-generator/bitacora.ts`);
    commit por ruta; VERDE.
- Fidelidad: el render de la publicada sólo importa `api-tipos.ts` de lo cambiado (un tipo): una copia sin tocar se
  dibuja igual (`scratchpad/scripts/grafo-render.cjs`).

## 3. MaKo sin conexión — VERDE mandado (28/10 ~20:30)

- T1 arreglada (la verificación de 90d6410eb: 2 medias + 7 bajas): `desktop-offline-2810` = 6ef621b24 + 813101f75.
- T2 rebasada encima: `desktop-offline-t2-2810` = 3e6a0dddf (antes 02da224d2) + 746633c96. tests-afectados VERDE (3117).
- Sin push (lo sube el Cerebro). Worktrees: `C:/dev/wt-desktop-offline` (T2) y `C:/dev/wt-t1-arreglos` (T1; se puede
  borrar cuando se integre).

## Espera a Martín
- Nada bloqueante. Lo de la imagen por el chat depende de Openverse (externo): decidir si se suma otro proveedor.
