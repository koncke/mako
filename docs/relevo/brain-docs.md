# Relevo — chat «brain-docs» (tickets #44 y #43, 3/11/2026, cuenta claude2)

Rama `brain-docs-0311` en `C:/dev/wt-brain-docs`, desde `origin/main` (7c0cff10c). Sin pushear: el Cerebro integra.

## #44 — HECHO (falta el deploy)

- `27a0e7565` la ingesta de El Archivero sale de su ruta a `lib/archivero-ingesta.ts` (la ruta hace lo mismo).
- `b97ff33c6` la operación `sumar_documento_second_brain` («Sumar un documento al Second Brain», área `negocio`,
  confirmación por chat), el clasificador que lee lo ESCRITO y no el documento pegado, y la familia `documento-al-cerebro`.
- `d0fcf63ea` el hito con `tickets: [44]` en `app/admin/dev/second-brain/bitacora.ts` y el aviso sin El Archivero.
- El ticket está `arreglado` con la respuesta para la clienta (scripts/tickets.ts): se cierra solo con el deploy.
- Tests: `tests/sumar-documento-second-brain.test.ts` (8 roturas, cada una cae) + 670 de lo tocado en verde.
- `node scripts/tsc-acotado.mjs --rama --heap=4096`: **17 archivos sin errores** (3/11, con main traído, sobre `379fdf6a6`). Después de eso entró una sola línea en la tabla `lib/api-mako/rest.ts`: ahí el acotado dio 99 (lo mató el vigía de RAM), así que esa línea la cubren los tests `api-mako-rest` y `api-mako-http`, no los tipos.
- Al traer main, `api-mako-rest` dio rojo: la operación nueva no tenía ruta REST ni estaba en la referencia. Ya las tiene (`POST /negocio/archivero/documentos`).
- Lo que costó: docs/hallazgos-api-mako.md → «"No tengo una herramienta" era la mitad».

⚠️ **A la clienta le falta el documento ENTERO.** Lo pegó el 2/11 y el chat lo cortó en 12.000 caracteres sin guardarlo (su
negocio tiene su Claude sólo en la computadora: D6b). La respuesta del ticket le pide que lo pegue de nuevo en dos partes.

**Sin hacer (no entró):** con su Claude en la computadora, el pegado de más de 12.000 se sigue cortando y lo que pasa se pierde
(`TOPE_PEGADOS_MENSAJE`, lib/chat-pegado.ts; `recortarMensaje` en lib/mako-turno-app.ts). Arreglo posible: guardar el texto
entero en El Archivero SIN extraer (fila sin campos) y que la tarjeta lo extraiga después; o que el modelo lea el pegado
completo desde `ctx.mensajeUsuario` en vez de copiarlo.

## #43 — PLAN (no entró en esta cuota)

El pedido (ws 13, la agencia, por WhatsApp): «quiero darle de comer y cargar un archivo al second brain de mi cliente
marcela, ¿cómo hago?». Martín: «una agencia sí puede, inspeccionando».

**Hoy, sin código (después del deploy del #44):** la agencia entra a la cuenta de su cliente desde la app (inspeccionar, desde
su cartera) y pega el documento en el Second Brain de ESA cuenta con «súmalo al Second Brain». Se le puede contestar así ya.

**Por WhatsApp desde el grupo de la agencia, lo que falta:**

1. **Un parámetro `negocio` en `sumar_documento_second_brain`** (el cliente, por nombre o id de la cartera). La guarda va en
   el runner, nunca en el prompt: el ws del cliente sale de `carteraDeAgencia(ctx.ws)` / `agenciasAprobadasDe(clienteWs)`
   (lib/agencia.ts) y SÓLO si la relación está aprobada. Un id que no está en la cartera aprobada → error, sin decir si existe.
2. **Correr la ingesta como el CLIENTE:** `runWithWorkspace(clienteWs)` + `conSuIADelNegocio(clienteWs)` — la IA del
   cliente, no la de la agencia (D6b mira el negocio dueño de los datos). Con su Claude sólo en la computadora, el camino del
   modelo: el turno del grupo de la agencia corre con la IA de la AGENCIA, así que el documento de un cliente pasaría por la
   IA de otro negocio. **Esto lo decide Martín** antes de escribir una línea.
3. **La confirmación en el grupo de la agencia** (`confirmacion: 'chat'`), y lo hecho anotado en el cliente con quién fue
   (registro de acciones del superadmin / `anotarAgency`), como lo deja la inspección.
4. **Los adjuntos de WhatsApp:** el turno del grupo tiene que leer un .docx / .pdf adjunto (el lector del chat de la app es
   `app/_chat/adjuntos-que-se-leen.ts` + `textoDelArchivo`, lib/chat-formatos.ts). Revisar qué hace hoy el turno del grupo
   con un documento (lib/nucleo-grupo.ts, el canal WhatsApp) antes de suponer.
5. **Tests de aislamiento, probados rompiéndolos:** agencia sin ese cliente → rechazo; relación pendiente → rechazo; ws de un
   cliente de OTRA agencia → rechazo; y la fila queda en el ws del cliente, nunca en el de la agencia.
