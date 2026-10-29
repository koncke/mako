# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

**Cuenta:** claude3 (desde el 29/10 03:00; antes claude4). **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los
merges de main son merge commits, nunca rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le
devuelve igual, con la lista de .ts). Las puntas las sube el Cerebro. Al 29/10 04:20 (AR) este archivo está al día.

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
- **En la rama, SIN subir** (`git log origin/main..wa-fallas-2710`): aafff48d0, 27d84020e, 8a2fe2e3e, 20d3d6806, 62876b064,
  694f36f74, 43ac63cc3, 5b7a1917d, c465a407b, c1b3d3a2a, c358fd0c4 y la verificación de c358fd0c4 en tres commits (c6d63791a,
  78543b7dd, **450677f90**).
- **El VERDE de 450677f90** corre en un worktree APARTE, fijo en ese commit: `C:/dev/wt-verde-450677` (detached, con el
  `node_modules` enlazado), para que los arreglos nuevos no lo contaminen. Logs en el scratchpad de la sesión (`verde-tipos.log`).
  Al terminar: el VERDE al Cerebro (local_428051c1) y a Integración (local_6c54122e), y `git worktree remove C:/dev/wt-verde-450677`.
- **Las 6 fallas de Leandro (29/10), EN EL ÁRBOL, sin commit todavía:** `lib/mako-intencion.ts`, `lib/doer-salida.ts`,
  `lib/doer-para-quien.ts`, `lib/audio-citado.ts`, `lib/nucleo-grupo.ts`, `lib/mako-doer-in.ts`, `tests/grupo-leandro-2910.test.ts`
  (+ su hijo `_grupo-leandro-2910-hijo.ts`, ~3 min) y la cosecha en `docs/hallazgos-comunicacion.md` + `docs/hallazgos.md`. El
  test pasa 6/6; las doce roturas corren. Falta: excluir el workspace SuperAdmin de «Hola Martín» (`paraElEquipo` en
  `procesarDoer`: en el grupo del equipo no abre un ticket por mensaje), tsc-acotado de esos archivos, tests-afectados, commit.

## Lo que falta, en orden (el plan del Cerebro)

1. Cerrar las 6 fallas de Leandro (arriba) y su VERDE.
2. **Los tickets al Cerebro al INSTANTE** (el Cerebro, 29/10): el Runner le entrega al Cerebro TODO ticket nuevo (hoy sólo
   `despacho='runner'` + `en_curso`, `lib/tickets-runner.ts`, `ticketsParaElCartero`), con texto fijo y el número, sin cambiar
   el triage ni la aprobación ni los `aviso_*`: otra marca de entrega y un cartero nuevo (subir su versión y su lista de textos
   fijos). Y que el hito de un deploy cierre también los `esperando_decision` (`cerrarLosDesplegados`, `lib/tickets-cierre.ts`,
   sólo mira `en_curso`: pasó con el #15). Cosecha en `docs/hallazgos-ticketera.md`.
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
