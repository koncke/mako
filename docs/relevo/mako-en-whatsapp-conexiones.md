# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

**Cuenta:** claude3 (desde el 29/10 03:00; antes claude4). **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los
merges de main son merge commits, nunca rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le
devuelve igual, con la lista de .ts). Las puntas las sube el Cerebro. Al 29/10 10:30 (AR) este archivo está al día.

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
  errores propios (los 14 de `_opencut`). **El VERDE de la punta corre en `C:/dev/verif-<sha de la punta>`**; logs `verde4-*.log`
  en el scratchpad. Al terminar: VERDE al Cerebro y a Integración, con que el Runner pase al cartero 1.23.0 (`cartero.mjs
  instalar` desde main: lo corre el Cerebro) y sacar el worktree (junction primero).
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

1. El VERDE de la punta con la ALTA 2 y los tickets (arriba).
2. **Los tickets al Cerebro al INSTANTE** (el Cerebro, 29/10): el Runner le entrega al Cerebro TODO ticket nuevo (hoy sólo
   `despacho='runner'` + `en_curso`, `lib/tickets-runner.ts`, `ticketsParaElCartero`), con texto fijo y el número, sin cambiar
   el triage ni la aprobación ni los `aviso_*`: otra marca de entrega y un cartero nuevo (subir su versión y su lista de textos
   fijos). Y que el hito de un deploy cierre también los `esperando_decision` (`cerrarLosDesplegados`, `lib/tickets-cierre.ts`,
   sólo mira `en_curso`: pasó con el #15). Cosecha en `docs/hallazgos-ticketera.md`. **El diseño, con borradores en el
   scratchpad (`borrador/`):** columnas `cerebro_*` (estado `not null default 'pendiente'`, para filtrar con `in` sin el null de
   `<>`; el número de la migración lo da el Cerebro: 0340/0341/0342/0346 ya están tomados); `ticketsNuevosParaElCartero` y
   `ticketsNuevosSinEntregar` (sólo `despacho is null` y `nuevo`/`esperando_decision`), `acusarTicketNuevo` (renglón «llegó al
   Cerebro»), un array APARTE `ticketsNuevos` sólo para el cartero ≥ 1.23.0 con `mensajeTicketNuevo` en los dos lados y en la
   lista de textos que no se suben como conversación; el cierre toma todo lo ABIERTO. Sin la migración no se cae
   (`ticketsNuevosError`). Test por la vuelta REAL (`cicloCartero` dentro de un `workAsyncStorage` de mentira, por `after`) y
   por `cartero.mjs ciclo` de verdad (el molde de tests/cartero-carpetas.test.ts). El PostgREST de mentira necesita `orCompleto`
   (el `or` de `ticketsSinEntregar` trae `in.(…)` y `and(…)`).
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
