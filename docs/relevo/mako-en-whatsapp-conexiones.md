# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

## ⚡ 12/11/2026 ~02:30 UTC (claude4): «que todos los chats conversen como un chat con Claude» (el plan del Cerebro)

El plan y sus mapas: `C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/6ea62e88-206b-49e4-b5fe-e446feb70ded/scratchpad/chats-plan.md`
(y chats-grupos/privados/app/saber.md). Rama `punta/wa-sorda-1011`, worktree `C:/dev/wt-wa-1011`.
- **Subido:** c88df3ff6 (el contexto: memoria del SuperAdmin, aviso al dueño, historial, chat de la línea con lib/hilo-real.ts, aviso
  del comprobante en pregunta, cobros con pagar/mensualidad/comprobante, marcar el pago en una ACCIÓN, lib/doer-plataforma.ts,
  mes_que_viene desde hoy = Código dic US$426). «Planes y cobros» parte de ese commit (la agencia por nombre y buscar_negocio son suyos).
- **El módulo común (siguiente commit):** lib/conversacion-reglas.ts (puro) + lib/conversacion.ts (`conversacionDelTurno`,
  `conversacionPrendida`: plataforma y ws13). Cableado en lib/mako-doer-in.ts (historial, ultimoDeMako, rol del equipo y
  preguntaDelEquipo al clasificador). Tests: conversacion-reglas 5/5, hilo-del-superadmin 7/7 (roturas C1-C6).
- **Falta del plan, en orden:** paso 2 (guardar el mensaje antes de CHARLA/NO_REPLY en el privado), paso 5 (áreas por `aviso_tipo`;
  y que `enviarAlGrupoSuperAdmin` copie con `avisoTipo`), paso 6 (cobros sólo en la plataforma, cuidando lib/mako-intencion.ts:553;
  `buscarNegocio` suma cobros), paso 7 (privado: identidad al modelo, el super admin no salta al ws del cliente, cada skip del bot
  deja registro, lo mandado a mano queda como equipo), la caché de prompt en lib/anthropic.ts (lo estable primero con
  `cache_control`), el resumidor lib/conversacion-resumen.ts, y medir con `scripts/medir-turnos-por-sha.mts --exigir-igual`.

## ⚡ 11-12/11/2026, noche (claude4): la causa de fondo de la voz sorda, y lo que va en el despliegue del 12/11 11:05 UTC

**Rama** `punta/wa-sorda-1011` (worktree `C:/dev/wt-wa-1011`). Lo de esta tanda, con el pedido del Cerebro (B1-B4):
- **La causa (informe del Cerebro, sólo lectura):** Evolution 2.3.7 + Baileys rc.9 traba dispositivos; 5 de 10 líneas (ws20, ws21,
  ws22, ws9 y la voz) reciben con ~24 h de atraso. Restart no cura; QR sí, por menos cada vez. El arreglo de fondo (la versión en
  Railway) lo decide Martín: no se toca desde acá. Todo cosechado en docs/hallazgos-comunicacion.md («La causa de fondo»).
- **B1** la alarma de demora mide `wa_mensajes` en todas las líneas (mail + campanita con el nombre del negocio; marca
  `mako.lineas.atrasadas`). **B2** la voz suma la ráfaga («2 o más a grupos en 30 min y no entró nada») y **dejó de reiniciar**.
  **B3** «Conectar» (voz y negocios) desvincula y da el QR en un paso con la línea marcada sobre su vinculación actual
  (lib/lineas-enfermas.ts). Tests: linea-sorda, lineas-atrasadas, linea-enferma-qr (roturas S1-S7, L1-L7, Q1-Q4).
- **Después del despliegue, medir en producción (sólo lectura):** el primer mail/campanita de ws21 (tiene que sonar el primer día),
  la marca `mako.lineas.atrasadas` con sus `vinculadaDesde`, y que no salga ninguna falsa (ws10, ws11, ws13, ws18, ws19 al día).

## ⚡ 10-11/11/2026, noche (claude4; el chat se llama «MaKo en WhatsApp» desde el 10/11): «No funciona MaKo en WhatsApp»

**Worktree** `C:/dev/wt-wa-1011`, **rama** `punta/wa-sorda-1011` (desde origin/main 482ac79f7). En GitHub: 9ef17d692. La despliega el
Cerebro cuando su corrida da verde.
- **Qué fallaba (medido, sólo lectura):** la voz (`mako_superadmin_muylqv8r`, …2605) `open` y entregando TODO tarde, en tandas, de
  30 a 115 min, por horas; la línea de Martín (`mako_ws9`, …3479) sorda (ni lo que él manda) y entregando cosas de un día. Y el
  clasificador tomó «Dile a Claude que…» de Martín por un mensaje a otra persona (NO_REPLY): 👍 y silencio.
- **Lo hecho:** 35971f31b (lo de más de 6 h de atraso va a SuperAdmin y no lo atiende MaKo; la alarma de demora por mail en el
  cron alerta-critica) y 9ef17d692 («Dile a Claude / al equipo…» es ticket; los hijos con horas viejas corridas a ahora). El
  archivo que pidió Martín (las transcripciones del curso de anuncios) se le mandó a su grupo a las 02:46 UTC.
- **Espera a Martín (el Cerebro se lo pasa):** volver a escanear el QR del …2605 (en el teléfono: Dispositivos vinculados → cerrar la
  sesión de MaKo; después /agencia → «Conectar por QR»; el panel no reconecta una línea que contesta la sonda) y el de su …3479.
- **Sin hacer** (en docs/hallazgos-comunicacion.md, «La línea sorda»): la alarma de una línea sorda del todo (un mensaje propio de
  prueba que vuelva por el webhook); dos pendientes y dos «sí» pierden una (ws 17); dos notas en un lote proponen una (ws 22, #81).

**Cuenta:** claude3 (desde el 29/10 03:00; antes claude4). **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los
merges de main son merge commits, nunca rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le
devuelve igual, con la lista de .ts). Las puntas las sube el Cerebro. Al 29/10 ~15:00 (AR) este archivo está al día.

## ⚡ LO QUE ESTÁ EN CURSO (29/10, desde las 13:30): MaKo en el grupo es un DESPACHANTE

Martín, por el Cerebro: «Es una verdadera desgracia cómo está respondiendo MaKo… Que sepa cuándo es un ticket, cuándo es una
pregunta, o una acción dentro de MaKo». Decisiones del Cerebro (con Martín): **sigue Haiku, no se toca el veto**; MaKo es un
despachante: ACCIÓN simple (`ACCIONES_SIMPLES`, lib/despacho-grupo.ts) la hace él; la compleja se DELEGA como «pedido delegado» a la
Ticketera (el Runner 1.24.0 se la lleva al Cerebro como «Pedido delegado #N»; el «listo» corto vuelve al grupo al cerrarla; uno del
ws1 lo dice en su ticket); TICKET con texto fijo y sin modelo; PREGUNTA sólo con lecturas, voz corta y números chequeados; DEBUG
(sólo ws9) con `diagnosticar_negocio` y el ticket al Cerebro con la evidencia; CHARLA el 👍; NO_REPLY silencio.
- Commiteado: 953f9610e (el crédito de los grupos), 687bc14d0 (`sinMuletillas`, links), 61ae98de2 (`diagnosticar_negocio`),
  ffc63aced (REENVIADO + imágenes del lote), fd7b00a45 (el clasificador IA, el TICKET por código, el banco en `tests/fixtures/`).
- **La llamada con Thiago (29/10 ~19:00, decidido por el Cerebro): db1c0fd1e.** Directo desde el grupo: replicar/analizar landing,
  pausar/prender campaña o anuncio; presupuesto por pantalla; WhatsApp a un lead se aprueba en la app (`SE_APRUEBAN_EN_LA_APP`);
  pedido compuesto delega lo que no hizo; delegado sin tomar en 30 min avisa (cron de tickets). Banco con el prompt nuevo: 75/77,
  0 escrituras en la clase equivocada. La lista: `git show promesas-thiago-2910:docs/promesas/2910-llamada-thiago.md`.
- **«Súbeme este anuncio»: b860ef8f8 (29/10 ~22:00).** `proponer_anuncio_desde_archivo` (ads), detrás de ZERNIO_ANUNCIOS_PROBADO
  (sigue en false: lo prende la prueba de Martín); el doer lee el videoMessage; la regla de una guarda ya no se delega. Roturas D2 y
  D23–D27 cazadas. Verificación final en `C:/dev/verif-b860ef8f8` (sacarlo después: `cmd /c rmdir` del junction primero).
- **La revisión de privacidad de Integración (29/10 ~23:00 y 30/10 ~01:00): d30862b59 y 3f3b23eda.** El despachante SALIÓ del
  tren-ae por dos ALTA. d30862b59 fue la primera vuelta; el Cerebro pidió lo estricto y está en 3f3b23eda. A1: un hito va al turno
  de un negocio sólo si TODOS sus tickets son de ese negocio (`hitosDelNegocio`). A2: `crearTicket` manda a la decisión de Martín
  todo pedido delegado con plata, envíos o borrados, o de quien no es admin del negocio (`delegadoQueDecideMartin`, guarda dura en
  `clasificar`). Quién escribe sale de `participantAlt` en los grupos de `@lid` (antes, todo con el pushName). M1: el «listo» es
  fijo. M3: el DEBUG por persona, y el modelo sin `diagnosticar_negocio`. Roturas D28–D37 (en el scratchpad,
  `roturas-despacho.mjs`). Sin hacer: el tope de crédito por negocio (M2, plata: Martín), B1, B2 y B4. El informe:
  `C:/dev/revisiones/2910-revision-privacidad-wa-despachante-85a0d9ead.md`. Va en el tren-af, con una revisión nueva (también de
  plata: desde el grupo se pausan y prenden campañas y anuncios). **Verificación (30/10 ~02:00):** roturas D3, D6, D8, D15 y
  D28–D37 cazadas (D37 sólo por el cableado, el 15 del despacho), sin respaldos; despacho-grupo 15/15, clase-del-grupo 11/11, tsc
  acotado 0 propios (sobre 3f3b23eda antes del commit); tests-afectados `--rapido` de 3f3b23eda en `C:/dev/verif-3f3b23eda`: 11
  tandas verdes, barredoras con los 2 `todo` de siempre y `mako-en-whatsapp-pablo` (fijaba el actor viejo: arreglado en el commit
  siguiente, 8ab517c12, que además lleva `participantAlt` y el lote de varios al rescate del cron; su tsc acotado: 0 propios).
  **Entregado (30/10 ~03:30):** Integración recibió 8ab517c12 con el tsc; lo re-verifica (arreglo por arreglo, más la plata de
  pausar/prender campañas y subir anuncios) y, si da bien, va en el tren-ah. Si Integración devuelve algo, se arregla acá y se le
  pasa el sha nuevo. El worktree de verificación ya se sacó. El VERDE está en la carpeta compartida del Cerebro.
- **La re-verificación de d49539722 (30/10 ~04:00, C:/dev/revisiones/3010-reverificacion-wa-despachante-d49539722.md): «entra con
  bajas», sin ALTA.** Pidió dos cosas, hechas en fa0ad711a: N1, el «hazlo» del delegado sólo con una lista CERRADA de lo seguro
  (`DELEGADO_SEGURO`; las 23 frases de la re-verificación van a Martín), y N2, lo del Cerebro filtrado también en el bloque del turno
  y en /tickets (más «Nombre Apellido» en `sinLoInterno`). Roturas D38–D42. Cosecha en hallazgos-ticketera y hallazgos-comunicacion.
  NO tocar (lo decide Martín, N3): pausar o prender campañas desde el grupo lo pide cualquiera (`rol: 'admin'` fijo). Integración
  recibió cc2aaa6ce con los tests afectados VERDES (4515): va en el tren-ai.
- **El ticket #35 (Código Inmobiliario, ws13, 30/10, pedido del Cerebro): 8319854ec.** «La reunión es a las 11 y MaKo dice 10». La
  base estaba bien; `resumenLead` (lib/mako-tools.ts) pasaba sólo `fecha_junta_1` (un DATE) y el modelo completaba «10:00». Ahora
  `horasDeLasReuniones` (lib/mako-ficha-lead.ts) lleva la hora en la zona del negocio, o la nota de que no hay. Test con los datos
  reales y 2 roturas cazadas; hito en mako-doer con `tickets: [35]`; cosecha en docs/hallazgos-ia.md. FALTA al escribir esto: el
  tsc y los tests afectados (corriendo en `C:/dev/verif-8319854ec`: sacarlo con `cmd /c rmdir` del junction primero) y mandarle el
  sha al Cerebro (local_428051c1-…). Sin escrituras en producción (sólo se leyó la base).
- **(lo que había antes de esa tanda, para la historia)** «subime este anuncio» con un Drive, o un video o una imagen
  mandados al grupo. Lo que hay: `proponer_agregar_anuncio` (ads.def.ts: anuncio EN PAUSA, pantalla /mako/revisar, pide
  `image_hash`/`video_id` ya subidos), `uploadAdImage` / `uploadAdVideo` / `uploadAdVideoByUrl` (lib/meta-ads-create.ts, por el
  token), el camino de Zernio apagado por `ZERNIO_ANUNCIOS_PROBADO = false` (lib/zernio-ads-cuerpo.ts; la prueba es
  scripts/prueba-zernio-anuncio.mts y el clic es de Martín), y lib/drive-acceso.ts para Drive. Falta: una operación que baje el
  archivo y lo suba (por Zernio, detrás de la bandera), que el doer acepte `videoMessage` además de `imageMessage` (hoy
  `adjuntoDe` es imagen o PDF), y que el despachante la PROPONGA (no la delegue). Con la bandera apagada: decir que falta la prueba.
- **El ticket #30 de Leandro (29/10 ~17:30, pedido del Cerebro): 9ac30e8c8.** «pídemelo otra vez y lo hago» ya no sale ante lo que
  MaKo no puede (`noLoPuedeHacer`, lib/doer-salida.ts); el turno ve lo que salió en producción para cada pedido resuelto
  (`hitosDesplegados`); el hito de mako-doer lleva `tickets: [30]`; el caso al banco (conv:1728, retenido): PREGUNTA con Haiku.
  Roturas D1–D15: 15/15 cazadas (base verde). tsc acotado `--rama`: 0 propios. tests-afectados: en el worktree de verificación
  `C:/dev/verif-9ac30e8c8` (junction a node_modules: para sacarlo, `cmd /c rmdir` del junction ANTES de `git worktree remove`).
  El VERDE va a Integración para el tren-ad o el tren-ae (borrador en la carpeta compartida del Cerebro,
  `mako-whatsapp-despachante-verde.md`).
- **Lo de esta tanda: 4a15d0775** (el despachante), **de5778615** y **6af2bb1e0** (los rojos de tests-afectados: cableado de la
  forma vieja, el test que importaba un `server-only`, «acá», el hijo de Leandro con la pregunta del equipo viva). tsc acotado de
  la rama: 0 propios. La app se cayó a las 15:31 en medio de la verificación; se retomó igual. En detalle: `lib/despacho-grupo.ts`, el cableado en `procesarDoer` (DEBUG, delegación,
  `VOZ_DE_LA_CONSULTA`, `numerosSinFuente`), cartero 1.24.0 y los tests que fijan la versión, `textoDelAviso` del delegado, los
  ejemplos fijos del clasificador (sólo del 60 % de ajuste), `tests/despacho-grupo.test.ts` y las escenas 5–7 de
  `tests/clase-del-grupo.test.ts`. Roturas: `roturas-despacho.mjs` (D1–D9) en el scratchpad.
- **El banco:** `node --env-file=<.env.local del clon> --import tsx --conditions=react-server scripts/banco-clases.mts --modelo
  claude-haiku-4-5 --salida <json>` (con tope: una llamada por caso). Antes con reglas: 49/76 (64 %), TICKET 0/11. Con Haiku, la
  corrida que vale (la 2ª: la 1ª, 89 %, tenía dos errores del banco): 75/76 (99 %), retenido 31/31, difíciles 22/24, 2 escrituras
  en la clase equivocada (conv:1712 y derivado:7). Las salidas, en el scratchpad: `banco/haiku-2910*.{txt,json}`.
- Después del deploy, el Cerebro corre `cartero.mjs instalar` (el Runner a 1.24.0).

## Cómo se trabaja acá (lo que pidió el Cerebro, y no se negocia)

- Arreglo sobre la última punta; test rojo-verde por la entrada REAL (`manejarEntranteDoer`, o el turno con
  `crearPostgrest({ candado: true })`) con el payload REAL (Evolution v2: `message.conversation` y el `contextInfo` ARRIBA).
- Probado rompiéndolo (script de roturas con respaldo `.rotura-bak`, base verde obligatoria, restaurado en finally).
- Cosecha en `docs/hallazgos-comunicacion.md` + el índice `docs/hallazgos.md`, en el mismo commit.
- Commit por ruta explícita, con `Co-Authored-By` y `Claude-Cuenta: claude3` pegados. Commitear seguido (reglas de la noche).
- TODO lo pesado (tsc, tests-afectados, un `node --test`, las roturas) va por `node C:/dev/con-turno.mjs <comando>`, uno por
  vez en toda la PC. Una corrida de tests lleva `--test` entre sus argumentos para caer en la fila de tests. tsc-acotado da rc=1
  por 14 errores de `app/video-editor/_opencut` (opencut-wasm del entorno, no nuestro).
- ⚠️ Si después de una caída queda un `*.rotura-bak` en el árbol, el archivo de al lado está ROTO: copiar el `.rotura-bak`
  encima y borrarlo, antes de nada.

## Lo hecho y dónde está

- **En main (tren-v, 23b329b5e):** todo hasta dda95f98d.
- **En la rama, SIN subir** (`git log origin/main..wa-fallas-2710`): hasta 450677f90 (su VERDE ya salió al Cerebro y a
  Integración) y después las 6 fallas de Leandro: **152cfcd27** (las seis), **2f7bf68af** (IA caída, SuperAdmin, R9, ESCENAS),
  **cfcdac6e9** (el `/s` del test) y **f8d2901ce** (los 7 tests de cableado que el barrido dio en rojo: leían la forma vieja de
  `conMemoria`, del lote y de `eraDePlan`). tests/grupo-leandro-2910.test.ts 6/6, 14 roturas cazadas (`roturas.mjs` del scratchpad).
- **COMMITEADO (29/10 ~11:30): 1540681ca (los tickets) y 2d961c1ee (la ALTA 2).** Roturas: tickets T1–T15 cazadas (base 6/6);
  ALTA 2 A1–A4 cazadas (respuesta-al-equipo base 4/4; el 7 de grupo-leandro caza A1). tsc acotado `--rama --heap=4096`: 0
  errores propios (los 14 de `_opencut`).
- **VERDE MANDADO (29/10 ~12:15) al Cerebro y a Integración, punta final ac593ce1d:** tests-afectados de 43605fd59 con las 13
  tandas verdes (76 archivos, 847 tests) y las barredoras con un solo rojo real (rutas de Windows en mi test de tickets,
  arreglado en ac593ce1d); doer-recetas-video-imagen y chats-mako-envio son sus `todo` de siempre. El worktree de verificación
  ya se sacó. Después del deploy, el Cerebro corre `cartero.mjs instalar` desde main (el Runner a 1.23.0).
- Lo que había en el árbol antes de esos dos commits: (a) **la ALTA 2** de la verificación de c358fd0c4, que frenó
  Integración: `lib/doer-equipo.ts` (`PIDE_O_SE_QUEJA`, `esSoloUnPedidoAMaKo`), la guarda en `lib/mako-doer-in.ts`, la escena 10d
  de `tests/_respuesta-equipo-hijo.ts` y el test 7 de `tests/grupo-leandro-2910.test.ts` (turno entero: MaKo contesta). Las dos
  corridas pasan salvo un ajuste del test (reacciones ≥ 1). (b) **los tickets al Cerebro**: mig **0343** (número del Cerebro; YA
  APLICADA en producción el 29/10, por el Cerebro con el sí de Martín: los 22 tickets en 'pendiente'), `lib/tickets-aviso.ts`, `lib/tickets-runner.ts`, `lib/operaciones.ts`,
  `lib/tickets-cierre.ts`, `scripts/operaciones/cartero.mjs` (1.23.0), los cinco tests que fijan la versión, `tests/tickets.test.ts`,
  `tests/_postgrest-de-mentira.ts` (`orCompleto`) y el test nuevo `tests/tickets-al-cerebro.test.ts` + hijo. La cosecha de los dos
  ya está en `docs/hallazgos-comunicacion.md`, `docs/hallazgos-ticketera.md` y el índice.
- **Corriendo con turno:** las roturas (`roturas-tickets.mjs` T1–T15 y `roturas-alta2.mjs` A1–A4, en el scratchpad) y el tsc
  acotado con `--heap=4096` (con 2560 aborta con código 134: la lista de la rama creció). Después: commit de las dos piezas, un
  worktree `C:/dev/verif-<sha>` limpio (junction a node_modules; para sacarlo, `cmd /c rmdir` del junction ANTES de
  `git worktree remove`), tests-afectados ahí, y el VERDE de esa punta al Cerebro y a Integración (el de f8d2901ce no vale: la
  ALTA 2 y los tickets lo cambian, e Integración mató sin querer ese barrido).
- ⚠️ Texto con comillas invertidas: nunca adentro de un `node -e "…"` de bash (las ejecuta como comandos). Con el Edit.

## Lo que falta, en orden (el plan del Cerebro)

1. ~~El VERDE de la punta~~ y ~~los tickets al Cerebro~~: hechos (arriba). Lo que queda de los tickets, en
   `docs/hallazgos-ticketera.md` → «Lo que quedó sin hacer»: que la bandeja dibuje «Entregado al Cerebro» para los nuevos (la 0343
   ya está), y que el Runner pase a 1.23.0 después del deploy (lo corre el Cerebro). De la ALTA 2, en `docs/hallazgos-comunicacion.md`:
   después de que MaKo contesta el pedido, la respuesta al equipo sin citar va a MaKo (`ultimaDeMaKo`).
2. Si Integración o el refutador devuelven algo de esta punta (ac593ce1d), eso va primero.
3. **A:** Claude PRIMERO con el crédito Max, desde la rama `wa-credito-grupos-2810`, «armalo para N cuentas»; el banco de
   casos de nivel 2 (con modelo) va en esa tanda.
4. **F4** completo. **G3:** lo que llega durante un turno queda huérfano hasta el cron. **F5** y **F6**.
5. **La cola de Teo:** video, imagen o PDF dentro de un lote; .doc/.xls/.ppt/.zip; audio fuera del grupo; `generarVariantes`;
   el aviso WhatsApp oficial vs QR.
6. **Robustez** (escritos en `docs/hallazgos-comunicacion.md`, con su archivo): helpers sin `falla`, `.catch(() => null)` que
   dicen «No existe», `confirmar_accion` que falla sin ticket, el audio como ARCHIVO yendo a Gemini, Groq vacío.

**Sin hacer de las últimas tandas** (en `docs/hallazgos-comunicacion.md`): un audio sin citar que le contesta al equipo va a MaKo;
la pregunta del equipo a «todos» abre la ventana para cualquiera; la citada que se bajó pero Groq no escuchó todavía dice «tu
audio»; el encabezado de todo lote dice «carga TODAS las tareas juntas»; los nombres del equipo son una lista fija.

## Lo que espera a Martín

- Leer la Ticketera de PRODUCCIÓN pide su sí. Las claves las carga él.
