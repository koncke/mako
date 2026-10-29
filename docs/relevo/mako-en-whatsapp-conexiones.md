# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

**Cuenta:** claude4. **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los merges de main son merge commits, nunca
rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le devuelve igual, con la lista de .ts).
Las puntas las sube el Cerebro. Al 28/10 20:15 (AR) este archivo está al día.

## Cómo se trabaja acá (lo que pidió el Cerebro, y no se negocia)

- Arreglo sobre la última punta; test rojo-verde por la entrada REAL (`manejarEntranteDoer`, o el turno con
  `crearPostgrest({ candado: true })`) con el payload REAL (Evolution v2: `message.conversation` y el `contextInfo` ARRIBA).
- Probado rompiéndolo (script de roturas con respaldo `.rotura-bak`, base verde obligatoria, restaurado en finally).
- Cosecha en `docs/hallazgos-comunicacion.md` + el índice `docs/hallazgos.md`, en el mismo commit.
- Commit por ruta explícita, con `Co-Authored-By` y `Claude-Cuenta: claude4` pegados.
- Lo pesado SIEMPRE por `node C:/dev/con-turno.mjs node scripts/tsc-acotado.mjs --heap=3000 <archivos>` y
  `node C:/dev/con-turno.mjs node scripts/tests-afectados.mjs --base origin/main`, de a uno («Nunca dos procesos pesados tuyos
  en paralelo»). tsc-acotado da rc=1 por 14 errores de `app/video-editor/_opencut` (opencut-wasm del entorno, no nuestro).

## Lo hecho y dónde está

- **En main (tren-v, 23b329b5e):** todo hasta dda95f98d (las tandas del 27/10 22:00 al 28/10 10:50: el ticket solo de lo que
  MaKo no pudo, la confirmación de terceros y de plata, el anti-eco de la línea de MaKo, la guarda con su marca, la nota de voz
  del grupo a Groq).
- **En la rama, SIN subir** (`git log origin/main..wa-fallas-2710`):
  - aafff48d0 lo sin señal es consulta con MaKo y el CRM; el system propio del grupo (G1+F1+G2);
  - 27d84020e, 8a2fe2e3e la firma del equipo, el grupo ve al equipo, los pedidos del negocio y `[[ya-pedido]]` (F2a, F2b);
  - 20d3d6806 la respuesta al EQUIPO no es para MaKo (Leila, ws11); 62876b064 la nota de voz CITADA se escucha (Leandro, ws10);
  - 694f36f74 el banco de casos del «sí» a una pendiente; 43ac63cc3 los pendientes de robustez, escritos;
  - 5b7a1917d el barrido; c465a407b el merge de main; c1b3d3a2a F2c (el catálogo de funciones de MaKo inteligente en el system);
  - **c358fd0c4 la verificación de 5b7a1917d** (ALTAS 1-4, MEDIA, BAJAS): VERDE en curso al 28/10 20:15.

## Lo que falta, en orden (el plan del Cerebro)

1. **A:** Claude PRIMERO con el crédito Max, desde la rama `wa-credito-grupos-2810`, «armalo para N cuentas»; el banco de
   casos de nivel 2 (con modelo) va en esa tanda.
2. **F4** completo. **G3:** lo que llega durante un turno queda huérfano hasta el cron. **F5** y **F6**.
3. **La cola de Teo:** video, imagen o PDF dentro de un lote; .doc/.xls/.ppt/.zip; audio fuera del grupo; `generarVariantes`;
   el aviso WhatsApp oficial vs QR.
4. **Robustez** (escritos en `docs/hallazgos-comunicacion.md`, con su archivo): helpers sin `falla`, `.catch(() => null)` que
   dicen «No existe», `confirmar_accion` que falla sin ticket, el audio como ARCHIVO yendo a Gemini, Groq vacío.

**Sin hacer de la última tanda** (en `docs/hallazgos-comunicacion.md`): un audio sin citar que le contesta al equipo va a MaKo;
la pregunta del equipo a «todos» abre la ventana para cualquiera (la cierra la primera respuesta); la citada que se bajó pero
Groq no escuchó todavía dice «tu audio» (puede ser de otro).

## Lo que espera a Martín

- Leer la Ticketera de PRODUCCIÓN pide su sí. Las claves las carga él.
