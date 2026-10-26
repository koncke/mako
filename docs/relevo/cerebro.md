# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 26/10/2026 ~02:15, cuenta 5 «Ananda» (claude5)

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

## Estado al escribir (26/10 ~02:15)

- **`main` = `c8f1c4a57` (tren-k), desplegado y sirviendo en hola-mako.com desde ~01:40.** Entraron las variantes de
  Automations, la tarjeta «Prueba A/B», Meta por Zernio prendido, las landings editables, los alojadores de video (Wistia,
  Bunny, Vimeo, Cloudflare), la limpieza de Integraciones, Partners, Agency, Customers, Classroom, las conexiones sin
  Gemini, el «Completado» rediseñado, la extensión 0.71 y 9 arreglos de la revisión.
- **El tren siguiente es `tren-l`,** en `C:/dev/wt-push-q` (por ahora sólo la cosecha de Closing). Puntas para juntar:
  crm-ext-2510 (scraper de WhatsApp), integraciones-2510 (Settings sin General, Criterio ni Método), landings-2510-b (el
  cierre de las landings, `ccb2e8e75` en adelante), aut-2510 (`7faa975da`), Ops Center (Avance agrupado, audios, formato
  como Claude), mediabuyer-2510 (la foto de perfil como AdAmigo), zernio-2510 (`CORTE_TOKEN_META='2026-11-03'`), agencias
  (Customers y la sidebar del super admin), mako-wa-conexiones, mako-inteligente y grabadores. Voz y desktop-voz entran
  sólo con MaKo Desktop 0.5.0 publicado.
- **El plan de la noche del 26/10** (memoria `noche-26-10-cinco-puntos`): MaKo inteligente → chat mako-inteligente; el
  scraper de WhatsApp → CRM; la llamada de Leila → hecha (el informe quedó en este chat; `docs/hallazgos-closing.md`);
  otros grabadores → Grabadores; Motion y el Image Editor → **SUSPENDIDO por Martín el 26/10 ~02:00, para seguirlo con
  otra cuenta**: rama `motion-imagen-2610`, relevo en `docs/relevo/motion-imagen.md`.
- **Web Generator de punta a punta → chat Landings** (pedido de Martín del 26/10 ~02:00): textos y botones que no se
  editan, secciones que no se reordenan, video, SVG y Calendly que no aparecen, botones flotantes que se van al hacer
  scroll, el menú de clic derecho que no se cierra, «Aplicar» del analizador y replicar una landing de la competencia.
  «TODO debe ser editable, absolutamente todo».
- **Leila (ws11):** su análisis de llamadas falló 168 veces en silencio porque su Claude se quedó sin crédito (lo tiene
  Grabadores). Para venderle Pro, primero hay que saber cuánto paga de GoHighLevel y de CapCut: lo demás que MaKo
  reemplaza no llega a los US$97.
- **Aviso del token de Meta:** tarea programada `aviso-token-meta-lunes`, el 27/10 a las 10:00 (ws 1, 13, 14, 15 y 19,
  con el sha `c8f1c4a57…`). Los textos y el script están en `~/.claude/operaciones/avisos/`.
- **La RAM del tren:** `~/.claude/guardia/reserva-tren` (JSON `{sesion, hasta, motivo}`) hace esperar a los pasos pesados
  de los otros chats, y `MAKO_TIPOS_RAM_MIN_GB=4.4` baja a mano el piso del respaldo de tipos. Archivar chats NO libera RAM.
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
2. **La limpieza de P6:** la corre Martín (lo decidió el 25/10 09:01). El comando está en el cierre af96b761. Después, avisarle
   a la agencia de Código Inmobiliario lo de su página de gracias.
3. **La pasarela:** aplicar a Paddle y a Creem el mismo día. Stripe no: Argentina no es país habilitado.
4. **La RAM:** memoria `pc-de-martin-hardware` (32 GB; 64 GB si en su PC corre también el Claude de Leandro).
5. **La lectura de producción del chat mako-inteligente:** el clasificador se la frenó y la aprueba Martín en ese chat.
   El Cerebro no la hace por él.
6. **La extensión:** recargarla en chrome://extensions y tocar «Usar aquí» en WhatsApp Web.

Las migraciones 0332, 0333, 0335, 0336 y 0337 (`mako_knowledge_modelo`, 25/10 20:56) están todas aplicadas con su sí.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
