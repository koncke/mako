# Retomar: «MaKo en WhatsApp: conexiones, ayuda y tickets» (el doer de los grupos)

**Cuenta:** claude4. **Worktree:** `C:/dev/wt-conex-2510`, **rama** `wa-fallas-2710` (los merges de main son merge commits, nunca
rebase). **Quién reparte:** el Cerebro (cada tanda llega por SendMessage; el VERDE se le devuelve igual, con la lista de .ts).
Las puntas las sube el Cerebro. Al 28/10 23:20 (AR) este archivo está al día (cuenta al 91 %). **Desde el 28/10 21:40, la tanda A va en otro
worktree:** `C:/dev/wt-credito-2810`, rama `wa-credito-grupos-2810` (con `wa-fallas-2710` adentro, sin tocar esa rama).

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
  - **c358fd0c4 la verificación de 5b7a1917d** (ALTAS 1-4, MEDIA, BAJAS): VERDE mandado; el Cerebro la verifica con
    refutador (28/10 21:40). Si da defectos, se arreglan en `wa-fallas-2710`.
- **En `wa-credito-grupos-2810`, SIN subir:** 80a4bccd4 (el texto del grupo con Claude y el crédito de los planes 200),
  98c18d4a4 (merge de `wa-fallas-2710`), y la tanda A: las cuentas del crédito para N (una sola lista, la del Uso).

## Lo que falta, en orden (el plan del Cerebro)

0. **PRIMERO: los defectos de c358fd0c4** (el Cerebro, 28/10 22:50; «no entra al tren»; informe con la entrada exacta y los
   scripts en C:/dev/revisiones/2810-verificacion-wa-c358fd0c4.md, scripts en scratch-c358/). Se arreglan en `wa-fallas-2710`
   (worktree `C:/dev/wt-conex-2510`), cada uno con su test por la entrada real probado rompiéndolo, y VERDE sin tipos con el sha:
   - ALTA: `pideAlgoAMaKo` (lib/doer-equipo.ts) no ve 21 de 28 pedidos reales (todos los de Leila): con una pregunta del equipo
     viva, el primer pedido de esa persona queda callado y cierra la ventana, y después su respuesta real va a MaKo.
   - **Hechos en `wa-fallas-2710`, con test por la entrada real y roturas, SIN VERDE todavía:** c6d63791a (el aviso de arreglo
     ya no abre la ventana: el «?» entre «…» no cuenta; `[[ya-pedido]]` con raya o un corchete) y 78543b7dd (el acuse después
     de la cita; sin cita, sólo gracias y saludos). Quedan: `pideAlgoAMaKo` (ALTA), el cierre de la ventana (MEDIA) y dos
     BAJAS (la firma pegada por un cliente y la lectura estricta de las re-entregas). Después: tests-afectados y VERDE.
   - ✅ ALTA: el aviso de ARREGLO de un ticket cuyo título es una pregunta (`avisarArregloAlGrupo` → `enviarAlGrupoMaKo(ws, texto,
     'equipo')` SIN ticket, lib/aviso-arreglo.ts:89) abre la ventana para cualquiera. Que mande `{de:'equipo', ticket}`, o que no
     cuente el «?» entre «…».
   - ✅ MEDIA: «dale», «ok», «listo», «perfecto» contestándole al equipo son acuse porque `esAcusePuro` corre ANTES de la cita
     (mako-doer-in.ts:811). Con cita o firma, el acuse no se mira; sin cita, sólo gracias y saludos.
   - MEDIA: la ventana se cierra con el primer mensaje de quien fue preguntado aunque conteste en dos o el primero tenga la @ de
     otro. Un mensaje para otro no cierra, y la ventana sigue unos minutos para el mismo autor.
   - BAJAS: citar el mensaje de un cliente que pegó la firma calla a MaKo; si falla la lectura estricta de las re-entregas, la
     respuesta se pierde; `[[ya-pedido]]` con raya (—, –) o con un solo corchete todavía sale.

1. **A:** hecha la parte de N cuentas. **Falta el banco de casos de nivel 2** (con modelo): correr los casos del diagnóstico
   (C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md) por el turno real con Claude y calificarlos. Gasta crédito: con el
   Cerebro. Y la claude5: su línea en `CUENTAS_DEL_CREDITO` si es Max 20x (lo sabe Martín).
1b. **Los pedidos perdidos** (el Cerebro, 28/10 22:30; `docs/relevo/pedidos-perdidos-2810.md` de la rama `tren-w`, «Lo
   urgente»). Van DESPUÉS de la tanda A y antes que todo lo demás; cada uno, si es código, con su test probado rompiéndolo:
   1. ✅ Mauricio (ws1), MEDIDO 28/10 22:45: la entrada no está rota; en su grupo nadie escribe desde el 08/10 (sus tres
      participantes son líneas de MaKo). El detalle en docs/hallazgos-comunicacion.md («Mauricio no escribe desde el 04/10»).
      Falta que el Cerebro decida qué hacer.
   2. ✅ Joan (ws13), datos mandados al Cerebro el 28/10 23:05 (él contesta): del 19/09 al 26/10, 28 no-shows (8+20) y 9 sin
      marcar, con nombres; de la semana del 19 al 25/10, 10 reuniones sin grabación (sólo el link de Meet). Abierto en código:
      «los sin marcar con nombre» terminó en «no se lista nominalmente» (conv 1584): la herramienta da el total, no la lista.
      Script: el scratchpad de claude4, `joan2.mjs` y `joan4.mjs`.
   3. ✅ (código, en `wa-credito-grupos-2810`) El link con dominio inventado («hola-malo.com/crm/2761», conv 1502):
      `conElDominioDeMaKo` (lib/links-con-ws.ts) en `partes` del doer; tests/links-con-ws.test.ts 4 y 5. **Faltan sus roturas
      D1-D3** (el script: el scratchpad de claude4, `roturas-dominio.mjs`; se cortó para no pisar el barrido) y su VERDE.
   4. Leila (ws11): el panel de Vida Poderosa dice que Ana Gómez no tiene datos de Fathom (buffer 293), y el Closing tiene
      168-193 análisis en error por el crédito de Claude (buffer 301).
   5. ✅ Los tres audios de Leandro (buffer 316, 318 y 327), transcritos con Groq el 28/10 22:55 y mandados al Cerebro: 316 y
      318 son el ticket #18 (responder comentarios de Instagram); 327 pide avisos ANTES de que se acaben los límites de Instagram y
      Zernio (respuestas y DMs), cuánto pagar u otra cuenta de Zernio, y que la automatización nunca se pare en silencio (de
      Automations y Zernio: lo reparte el Cerebro). Script: el scratchpad de claude4, `audios-leandro.mjs`.
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
