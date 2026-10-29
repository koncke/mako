# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

**Cuenta:** claude3 (desde el 29/10 03:00; antes claude4). **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los
merges de main son merge commits, nunca rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le
devuelve igual, con la lista de .ts). Las puntas las sube el Cerebro. Al 29/10 09:10 (AR) este archivo está al día.

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
- **El VERDE de f8d2901ce** corre en un worktree APARTE, fijo en ese commit: `C:/dev/verif-f8d2901ce` (detached, `node_modules`
  como junction). Logs en el scratchpad de la sesión: `verde3-tipos.log` y `verde3-tests.log`. Al terminar: el VERDE al Cerebro
  (local_428051c1) y a Integración (local_6c54122e), y `git worktree remove C:/dev/verif-f8d2901ce`.

## Lo que falta, en orden (el plan del Cerebro)

1. El VERDE de f8d2901ce (arriba).
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
