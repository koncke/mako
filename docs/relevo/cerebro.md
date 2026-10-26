# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 26/10/2026 ~08:15, cuenta 5 «Ananda» (claude5)

**Si sos una cuenta NUEVA**, Martín te escribe «Hola, eres la Nª cuenta, la voy a llamar X. Continúa con todo» y con eso
alcanza. No preguntes: hacé esto en orden (en la cuenta 5 tardó 10 minutos).

1. **La cuenta:** `claude<N>` en `~/.claude/cuenta-activa.txt`; su línea en `~/.claude/cuentas.tsv` (sin gmail declarado,
   el alias); `get_usage` → `uso-semanal.txt` y `uso-cinco.txt` con la cuenta en el 4º campo. El reset semanal es la
   prueba barata de que es otra cuenta.
2. **El Runner:** `node ~/.claude/operaciones/cartero.mjs cartero claude<N> app ~/.claude` y `… carpeta <uuid> claude<N>`
   (la carpeta NUEVA de `%APPDATA%/Claude/claude-code-sessions`); sumala también a `C:/dev/cerebro-herramientas/listar.cjs`.
   Después `start_session` «Runner», `claude-haiku-5-5`, esfuerzo bajo, `INSTRUCCIONES_RUNNER` (lib/runner.ts) + «hacé una
   vuelta ya». A los 3 minutos existe `~/.claude/operaciones/uso/claude<N>.json`: `detach_session` y al grupo «Cerebro».
   ⚠️ **Una cuenta recién comprada no tiene el modo bypass** (se prende en sus Settings y es de Martín). La sesión está en
   **auto** aunque `get_session` diga «default»: los chats se abren con `permission_mode: 'auto'` y andan.
3. **Este chat se llama «Cerebro» y se fija.** Los de área se abren EN EL TURNO de Martín, cada uno con su brief y su
   worktree propio (`C:/dev/wt-<área>-<fecha>`). Anidados bajo el Cerebro; sólo el Runner va suelto.
4. **El estado de la cuenta anterior se VERIFICA con git, no se copia.** Un Workflow con un lector Sonnet por chat sobre su
   cronología (`cola.cjs`) + git. El de la cuenta 5 (8 lectores, 18 minutos) encontró 4 puntas listas sin subir, 6 pedidos
   de Martín sin ejecutar, una cosecha equivocada (la de Vercel) y las capturas que sólo vivían en el transcript. Lo que
   corrige se les manda a los chats nuevos por mensaje.
5. **`/admin/dev`:** sumá la cuenta a `CUENTAS` (`app/admin/dev/_registro/tipos.ts`): sin la fila, un hito firmado por
   ella rompe la pantalla.

## Estado al escribir (26/10 ~08:15)

- **`main` = `ede2bbaab` (tren-l), desplegado y sirviendo en hola-mako.com desde las 08:02.** Entraron Settings sin
  General ni Método (la zona del negocio en Perfil, el enchufe en Integraciones), Automations sin «MaKo Messages», la
  extensión 0.71.2 (los nombres de empresa de `verified-business-name` y la recarga sola que no corta un trabajo), el
  cierre de las landings con los planes y los 7 días, el editor de Web Generator de punta a punta (los 7 puntos de
  Martín, más el tachado, el enlace a otra página y los precios con formato que se perdían al guardar), «Aplicar» del
  analizador y Replicar, y el Media Buyer con la foto de perfil como la captura 04.
- **Landings hace los clics en producción** sobre las copias #44, #45 y #46 (sin publicar) y trae las capturas.
- **El tren siguiente es `tren-m`,** en `C:/dev/wt-push-q`, armado sobre `ede2bbaab`: Media Buyer `7b50660e8` (las 10
  fallas de la revisión), Zernio `d2116184e` (un negocio sin token administra sus campañas; `CORTE_TOKEN_META =
  '2026-11-03'`), Ops Center `738ffba0d` (avances en una burbuja, la voz como audio, respuestas como Claude), MaKo en
  WhatsApp `fd6c7ac1c` (sigue la conversación), Customers `6fe3bc7ac`, Grabadores `24752ffdd` (tl;dv, Fireflies, Zoom y
  Otter; el aviso cuando la IA del negocio se cae). Todas pasaron por la revisión adversarial y sus arreglos.
  **MaKo recomienda NO va:** la verificación de sus arreglos dio 5 de 9 cerrados y una falla nueva (la cascada todavía
  marca saturado un modelo sano para todos); respaldo en la etiqueta `respaldo/tren-m-con-recomienda`.
- **Revisiones de esta noche:** detalle en `%APPDATA%/Claude/side-session-notes/local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8/`
  (`revision-tren-l-2.md`, `revision-tren-m.md`). Las tres juntas confirmaron 40 fallas invisibles; todas arregladas.
- **Motion y el Image Editor:** SUSPENDIDO por Martín el 26/10 ~02:00, para seguirlo con otra cuenta: rama LOCAL
  `motion-imagen-2610` @ `7e7a49d96` (WIP, sin pushear; respaldo en la etiqueta `respaldo/motion-imagen-2610`; worktree
  `C:/dev/wt-motion-imagen`). Su relevo y su cosecha viven SÓLO en esa rama. Al retomarla: mezclar main primero (Landings
  cambió el Web Generator) y desplegar el bloque motion antes de que una landing lo use.
- **Leila (ws11):** memoria `leila-apps-y-pro-97`. Su análisis de llamadas falló 168 veces en silencio por su crédito de
  Claude; el aviso nuevo va en tren-m.
- **Aviso del token de Meta:** tarea programada `aviso-token-meta-lunes`, el 27/10 a las 10:00 (ws 1, 13, 14, 15 y 19).
- **La RAM del push:** esperar SIN reservar y reservar recién con 4,5 GB (scratchpad `push-oportunista.sh`; la lección, en
  docs/hallazgos-infra.md). Archivar chats NO libera RAM; reiniciar la app de Claude, sí.
- **Ojo con el tope de mensajes:** la app frena a 10 mensajes del Cerebro a otros chats sin un mensaje de Martín EN ESTE chat
  (los del Ops Center no cuentan como suyos). De noche se gasta rápido: guardar los últimos para lo que traba un tren.

## Lo que NO se vuelve a discutir

- **Nunca `--no-verify`.** El 24/10 el hook de pre-push frenó un tren con 5 errores de tipos.
- **Un chequeo que decide si se sube NO se pipea:** `cmd > salida 2>&1; rc=$?; tail -6 salida; [ "$rc" -eq 0 ] && git push`.
- **Vercel SÍ guarda el commit, pero lo encuentra sólo con el sha ENTERO** (`git rev-parse <corto>`); con el corto contesta
  «No deployments found» sobre un despliegue vivo. El relevo anterior decía lo contrario y estaba mal (medido el 24/10 a
  las 21:00; `docs/hallazgos-infra.md`). La prueba de producción es el despliegue que SIRVE el dominio
  (`vercel inspect hola-mako.com`).
- **El tren se arma ANTES de pushear,** y dos pushes a `main` en paralelo se traban en el candado del typecheck: de a uno.
- **Una rama entregada al tren NO se rebasa.** Para poner commits a salvo, una etiqueta `refs/tags/respaldo/<nombre>`,
  no una rama (las ramas en origin disparan builds de preview).
- **Nunca `AskUserQuestion`:** traba el turno y Martín no puede contestar desde el teléfono. Se pregunta con
  `cartero preguntar <archivo.json>` y se termina el turno.
- **El `tsc` entero no entra en la PC:** cae al respaldo de 3 tandas (`scripts/tipos-respaldo-push.mjs`, ~6 min).
- **Un pedido viejo de diseño no se hace por antigüedad:** se busca en `docs/hallazgos-<área>.md` y se compara con lo
  que Martín pidió después.
- **Un lector que mira un worktree a mitad del checkout ve el índice VACÍO** (18.900 «borrados»): se vuelve a medir antes
  de alarmar a nadie.

## Trabado esperando a Martín

1. **Qué landings se publican.** Las 14 con el cierre nuevo están en https://claude.ai/artifact/4hKutkW7PX1sPMMHDC72YR
   y la pregunta está en el Centro. `--subir` escribe en el ws9.
2. **La 0338 de Grabadores y su aviso:** la pregunta está en el Centro. Ya no depende del orden con el deploy.
3. **La IA paga de último recurso para lo interno de MaKo** (Claude de la plataforma u OpenAI): pregunta en el Centro.
4. **El reclamo a Zernio** por el `testCode` (Ana, hasta US$1, o el mail): pregunta en el Centro.
5. **Las lecturas de producción** que el clasificador frenó: las aprueba Martín en los chats MaKo inteligente, MaKo en
   WhatsApp y Grabadores. El Cerebro no las hace por ellos.
6. **La extensión:** tocar «Recargar» en chrome://extensions para estrenar la 0.71.2.
7. **La limpieza de P6**, **la pasarela** (Paddle y Creem) y **la RAM** (memoria `pc-de-martin-hardware`).

Las migraciones 0332, 0333, 0335, 0336 y 0337 están todas aplicadas con su sí.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
