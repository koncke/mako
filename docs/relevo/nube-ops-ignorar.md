# Relevo — Ops Center: la fecha de cada pregunta y «Ignorar» (nube, 5/11/2026)

Lo escribió la sesión de la nube que lo hizo (`cli_ded761e9-beda-55f4-999d-47d4c746f016`, cuenta `nube`). Esta sesión no le puede
escribir al Cerebro: todo lo que hace falta está acá.

## Lo pedido

Martín, textual: «debería haber una sección que marque la fecha de los pedidos o decisiones y un botón de ignorar». Le llegó para
contestar una pregunta del 30/10 sobre una revisión que ya no importaba, y no había cómo saber que era vieja ni cómo sacarla.

## Lo hecho

En la punta **`punta/ops-ignorar`** (commit `c90f7f5f0` y el de este relevo):

- **La fecha a la vista** en cada pregunta o decisión del bloque de arriba de la caja: «hace 6 días · 30 oct, 10:52», con la fecha
  entera al dejar el cursor. Con más de 48 horas lleva «Vieja», en el color de aviso.
- **La más nueva primero.** Las respuestas le llegan al chat igual que antes: en el orden en que preguntó.
- **«Ignorar»:** la saca sin contestarla y sin mandarle nada al chat, con «Deshacer» unos segundos. Queda en «Ignoradas · N» (un link
  chico arriba del bloque), con «Volver a mostrar».
- **Una ignorada no se vuelve a repartir:** la vuelta del Runner cancela, antes de reclamarla, cualquier respuesta firmada de una
  pregunta ignorada (por ejemplo, contestada en otro dispositivo). Si no puede leer las preguntas, no entrega respuestas en esa vuelta.
  Al ignorar, la respuesta que esperaba un chat cerrado se cancela en el acto.
- **Sirve igual para lo que pregunta la app de Claude** (AskUserQuestion): ignorarla saca el aviso de «el chat no lee lo que le
  escribas» y la caja vuelve a mandar.
- **En el teléfono, igual**, con botones del alto de un dedo (medido: 44 px, sin scroll lateral a 390).
- **API de MaKo:** `ignorar_pregunta_operaciones` (con `volver: true` vuelve a mostrar; sólo plataforma, sin HTTP, con un «sí»). Y
  `ver_mensajes_operaciones` ahora da el `id` de cada pregunta y `ignorada` si lo está.
- **Las decisiones de la Ticketera** que salen en ese bloque se ignoran igual, **cuando se aplique la migración 0394** (abajo).

## ⚠️ Migración 0394 — SIN APLICAR

`supabase/migrations/0394_decisiones_ignoradas.sql`: `alter table admin_decisiones add column if not exists ignorada_at timestamptz;`

- **Sólo agrega. Orden de despliegue: da igual.** Sin la columna, nada está ignorado; «Ignorar» en una decisión de la Ticketera dice
  «Todavía no se puede: falta un cambio en la base» y no cambia nada. Las preguntas de los chats (`cartero preguntar`, wrap_up, la app)
  se ignoran sin migración: viven en app_settings.
- **El número:** elegido barriendo `origin/main`, todas las ramas y todas las etiquetas de origin el 5/11 (0393 era la última). Desde la
  nube no se ven los números reservados ni los worktrees de la PC: **confirmarlo antes de aplicarla**; si está tomado, se renumera el
  archivo (nada lo nombra por número salvo su propio encabezado y este relevo).
- Se aplica con `node scripts/apply-migration.mjs supabase/migrations/0394_decisiones_ignoradas.sql` desde la PC.

## Cómo se comprobó

- `tests/ops-center-ignorar.test.ts` (9): corre la vuelta REAL del Runner (`cicloCartero`) y lo de la base de las decisiones sobre un
  PostgREST de mentira (`tests/_ops-ignorar-hijo.ts`), dibuja el bloque y el hilo, y fija el orden. **15 roturas en rojo** (la lista,
  al pie del test).
- Los 110 archivos de test que tocan esto, con Node 24: **738 en verde, 0 rojos**, incluida `tests/ops-center-bateria.test.ts`.
- Mirado en pantalla con el bloque real y sus estilos reales, armado en una página suelta: computadora (1280) y teléfono (390), con los
  clics de «Ignorar», «Ignoradas · 1», «Volver a mostrar» y «Deshacer». **No** con la sesión de Martín: en la nube no hay base.

## Lo que falta

1. Aplicar la 0394 (confirmar el número primero).
2. Mirarlo en el Ops Center de verdad, en el teléfono de Martín, cuando esté en producción.
3. Si Martín quiere más: «Ignorar todas las viejas» de un toque. No se hizo porque no lo pidió.
