# Relevo — chat «Create: un solo diseño» (claude3, 29/10/2026)

Rama `create-shell-2910`, worktree `C:/dev/wt-create-shell`. Diseño e inventario: [docs/diseno-create.md](../diseno-create.md).
Nota para el Cerebro: side-session-notes/…/create-shell-2910.md. **No pusheo: el Cerebro verifica y sube.**

## Lo pedido
Martín, 29/10: Create sin pestañas, el chat de MaKo siempre a la izquierda con los proyectos detrás de la «←», «Nuevo …» con
plantillas bajo «¿Qué vas a crear hoy?», colores de MaKo en Video e Image, deprecar lo que sobra (Reels → plantilla del
Copywriter). Y después: Offer con el mismo sistema, la oferta armándose al costado y sin pestañas (ni para el super admin).

## Commits (todo en la rama)
- 592c1ec0b — el shell (`app/_crear/PantallaCrear.tsx`), `ConversacionCerebro`, nav sin secciones en Video/Image, retiros
  (Reels, Carousels, Image Generator, Thumbnails), teléfono, cosecha ui/api-mako/mobile.
- 2b62724ea — Video en el shell con colores de MaKo (agente), Offer en el shell con `DocumentoVivo`, arreglos del shell.
- e9971db4a — los 5 rojos que vio AI Avatar (tests que fijaban texto de MakoEnLaTab, /m/reels y /m/carousels borradas,
  cerebro-funciones) y la cosecha de Video y Offer.

- 72be0210c — Image en el shell con los colores de MaKo (agente): «Nuevo diseño» con «Carrusel de Instagram», la home de
  Canva borrada; arreglos del shell («MaKo» en la tarjeta, rótulo de plantillas, «aquí»).
- 49cd15779 — la misma cabecera en las tres tarjetas («MaKo» con la estrella), «Escribe a MaKo», cosecha de Image.
- 16f9abc73 — «MaKo» en la tarjeta renombrando en el origen de `k` (los tests del Ops Center fijan `k.nombre` y `k={k}`).
- a15f8ed63 — los 5 rojos de tests-afectados (fijaban la barra vieja): Strategy y Offer Playbook al pie de Offer, el
  teléfono (Video abre el editor; Video Generator oculta), y el alto de Create descuenta `--alto-secciones`.

## Lo que falta
- **tsc-acotado: VERDE** en tres tandas por con-turno (`--heap=3000`): 46 archivos (shell, Offer, nav, tests), 42 (Video) y
  43 (Image), sin errores. Listas en el scratchpad (`t1.txt`…`t3.txt`). Una lista que toque `_opencut` lleva sus cuatro
  `.d.ts` (docs/hallazgos-video-editor.md, 29/10).
- **tests-afectados --base origin/main --rapido: VERDE** sobre 4e75f2067: 3525 tests de 350 archivos, 11 min 24 s. (La
  corrida anterior dio 5 rojos que fijaban la barra vieja: arreglados en a15f8ed63 y probados rompiéndolos.)
- **Capturas**: las del banco (sin dev server) de Image están en `C:/dev/revisiones/create-shell-2910/` (antes de los
  últimos arreglos de cabecera). Las de producción, antes y después, faltan: Claude in Chrome desconectado; el navegador
  integrado cae en el login. Video y Offer no se vieron en un navegador.
- Copywriting y AI Avatar los cierran sus chats en sus ramas encima de las mías (nav.ts de su bloque incluido); están
  anotados en `FALTAN_SIN_SECCIONES` / `PAGINAS_CREATE`. `/reels` redirige a `/copywriter`: la rama del Copywriter sube
  con o después de ésta.

## QA visual de Create (29/10/2026, tarde) — rama `create-qa-2910`, desde main 1cf06eba9

Martín en producción: «se rompen muchísimo el diseño». Banco de QA (pantallas reales, sin `next dev`): carpeta de notas
del Cerebro `banco-create-qa/`; capturas antes/después a 1920/1440/1366/390 en `C:/dev/revisiones/create-qa-2910/`.
- Offer en 340 px: clase `.of-doc` repetida (ahora `.of-vivo`). Hilo de la tarjeta con márgenes de ventana (56 px): 14.
- Editores: la tarjeta se pliega a una barra fina (`plegable`, `PlegarChatCtx`). Video: rótulos enteros y borde fundido.
- Image: la barra de abajo cede por `@container`. Placeholders «Escribe a MaKo» (Offer y Video).
- Doory: el crédito visible se borró (Martín, a su riesgo); el test 2 de image-editor-integracion exige que no vuelva.
- Falta: el editor de Video no carga en el banco (queda «Cargando…», docs/hallazgos-video-editor.md); AI Avatar es de su chat.
- VERDE (punta 5031af55a): 70 tests dirigidos 613/613; las roturas R1–R9 y la R2 de Doory dan 1 rojo cada una.
  tsc-acotado sin errores en las tres tandas (12, 8 y 9 archivos). Con `--heap=4096`: con 3000, sale con 134.
