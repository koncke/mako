# Relevo — CRM

## 📌 PEDIDO NUEVO de Martín (10/10/2026), sin empezar — dejado por el chat de Ads Manager

No había un chat de CRM abierto en la cuenta 2, así que el pedido queda acá. Textual:

> «Acá al filtrar, en campaña, y en Origen, aparece lo mismo. Y falta el filtro de ANUNCIO,
> para filtrar por un ad específico. Mandale esta tarea al CRM»

La captura que mandó (el menú «Filtrar» del tablero, con Etapa / Origen / Campaña / Ordenar, y
tarjetas «VSL FUNNEL inmobiliarios CI» — o sea, muy probablemente Código Inmobiliario, ws13):
`C:\Users\marti\.claude\uploads\b1c92d31-61a4-43c0-b089-2f07f6ef8d51\241e1994-image.jpg`

**Lo que se leyó del código el 10/10 a las ~16:50, para no arrancar de cero (sin medir datos):**

- **El filtro por anuncio YA EXISTE**: es la categoría «Creativo» (`app/crm/CrmBoard.tsx`,
  `listasFiltro` ~línea 1615; pedido de Martín del 06/10, commit `117ea2bd`). **Sólo se ofrece si algún
  lead del tablero tiene `anuncioKey`** —«una categoría sin opciones no se ofrece»,
  `CrmToolbar.tsx:449`—. En la captura no aparece, así que en esa cuenta ningún lead cargado
  trae el anuncio. La pregunta no es «falta el filtro» sino **por qué esos leads llegan sin
  `anuncioKey`**: si es el camino de entrada de ese workspace (la landing/VSL, que no trae el
  `ad_id` como trae un formulario de Meta) o el mapeo. Y además el rótulo dice «Creativo» y él
  lo busca como «Anuncio».
- **Campaña y Origen «iguales»**: Origen son los valores distintos de `l.origin`; Campaña,
  `campanaKey`/`campanaNombre`. Si en ese workspace el `origin` guarda el nombre de la campaña,
  las dos listas salen idénticas. **Hipótesis, no medida**: lo primero es mirar en la base qué
  traen esos dos campos para los leads de ws13.

*Dejado el 10/10/2026 por el chat de Ads Manager (claude2), a pedido de Martín.*


## ⚡ Actualización del 09/10/2026, 15:10 — sesión CRM, cuenta claude2

Commit `5a4e3f04` (pusheado en esta misma tanda). Dos cosas, las dos sin decisión pendiente:

- **#800 cerrado en código:** pastilla «Plazo» por etapa en el editor de etapas y aviso diario
  `crm-lead-quieto` (los que pasaron el plazo, sin moverlos, sin depender del CRM automático).
  → `docs/hallazgos-crm.md` → «El lead QUIETO». Nace sin efecto: nadie tiene plazos todavía.
- **La revisión de propuestas (`/crm/revisar`) perdía al contacto repetido de la landing**, sus
  productos y su campaña. Arreglado. → `docs/hallazgos-crm.md` → «Confirmar una propuesta de la
  landing…». ⚠️ **Leila (ws11) tiene 5 contactos de su landing esperando ahí**, uno de hoy: con
  el arreglo desplegado ya se pueden confirmar sin perder nada.

**Lo que espera a Martín** (se lo pregunté en el chat; nada de esto se decide solo):
1. ws11: la mensualidad de Nadia #2605 (4.235,29 es el total del contrato), ¿los 444 de Fabi
   #2606 son USD o pesos?, y Fabi sigue en dos productos (Nora ya no).
2. Ganar en un producto AGREGADO no marca ganado al lead: ¿así?
3. #18: el texto de los follow-ups, cuántos y cada cuánto (se puede armar en /chatbot).
4. #15: en qué cliente se prende el piloto del CRM automático.
5. #20: n8n, ¿se apaga o pasa el acceso?
6. #671: «Agendar R2» necesita un Calendly conectado para probarlo (sólo lo tiene el ws1).
7. Prender en quien lo quiera lo que nació apagado (página de gracias → Ganado, invitar al curso).

**Quedan abiertos en el plan:** #671, #18, #15, #40 (el planificador del CRM automático sigue
en R1/R2 y necesita una migración para la reunión N) y #20. **Sin hacer y sin decisión:** la
COHORTE del panel lateral (punto 1 del relevo del 05/10) y que confirmar una propuesta la marque
ANTES de crear (dos pestañas pueden crear dos veces).

⚠️ Dos rojos de la suite que NO son del CRM (09/10, 14:50): `tests/curso-tareas-secciones` lee
archivos del curso que Customer Success tiene a medio editar, y `tests/inbox-agregar-al-crm`
cuenta 4 montajes de la bandeja de WhatsApp donde espera 5 desde `c09e16ad` (14:28).

## ⚡ Actualización del 08/10/2026, 08:00 — sesión CRM, cuenta claude2

El feedback de Leila (ws11) y la grabación de sesiones, en producción:

- **«Completar datos» ya no mueve al lead** y la ficha se relee al guardar (era el «loop» de la
  empresa, y des-ganó al #2605). → `docs/hallazgos-crm.md` → «"Completar datos" devolvía al lead…».
- **El monto de Ganado**: sí se guardaba (en `suscripcion_monto_usd`); la tarjeta ahora muestra
  «$X/mes», el contrato precarga sin esconder el paso, y Deal Details edita la mensualidad.
- **«+ Agregar al CRM» desde WhatsApp** elige el producto.
- **La grabación de sesiones** (área landing): la ficha dice la verdad, el r.js v2 graba a quien mira
  sin tocar (sin repegar) y el reproductor por fin abre las grabaciones. ⚠️ El r.js v2 se le sirve a
  TODAS las páginas con Pixel v21/v22 en cuanto el servidor contesta `rec.v=2`.

**Lo que espera a Leila / Martín:** corregir los datos de ws11 que entraron mal (Nadia #2605: la
mensualidad dice 4.235,29 y es el total del contrato, con 12 cuotas de 4.235,29 pendientes que inflan
el MRR un 85%; Fabi: ¿444 USD o pesos?; Nora #2610 y Fabi #2606 siguen en dos productos), y decidir si
sacar el producto donde se ganó des-gana al lead. **Sin verificar en un navegador** ninguna de las
pantallas; el grabador sí, con el snippet real en headless y contra la página real de ws1.

## ⚡ Actualización del 08/10/2026, 02:50 — sesión CRM, cuenta claude2

Tres cosas salieron y están desplegadas, las tres APAGADAS para todos hasta que alguien las prenda:

- **Lo que contestó en el formulario de Meta** (`e21003d6`): en el pop-up y en la ruta de la ficha,
  legible, y su WhatsApp nace apagado en /chatbot. → `docs/hallazgos-crm.md` → «Lo que contestó en
  el formulario de Meta».
- **La página de gracias pasa a Ganado** (`76cfa80f` + `ec90fddc`): interruptor «Es la página de
  gracias» en el paso 2 del Pixel. ⚠️ La visita no prueba la compra: quien tenga la URL la abre sin
  pagar. → `docs/hallazgos-landing.md` → «La página de GRACIAS pasa a Ganado».
- **Invitar al curso al ganar** (`77279ea4`): «Invitar al curso al ganar» en el «⋯» de la columna
  Ganado, por embudo. La invitación es la de Customer Success (`invitarAlCursoSinSesion`); el CRM
  decide cuándo, en los TRES caminos a Ganado. → `docs/hallazgos-crm.md` → «La invitación al curso
  AL GANAR».

**Lo que espera a Martín:** prender cada cosa en el cliente que la quiera (nada nace prendido), y
decidir si la página de gracias necesita la verificación de la compra (el webhook de la plataforma de
pago, que no existe). **Sin hacer:** el aviso `lead-de-landing` tiene su texto armado en código
(`app/api/track/optin/route.ts`), y las respuestas del formulario de la LANDING no se guardan en el
lead. Ninguna de las dos pantallas nuevas se miró en el navegador (la máquina no daba).

## ⚡ Actualización del 06/10/2026, 19:00 — sesión CRM, cuenta claude2

**Lo que hay que saber primero:** `lead_funnel` (un lead en VARIOS productos, mig 0207) está
**commiteado** (`f26c0a94`) y verificado en el navegador. Lo había escrito la sesión de claude1
con nueve agentes y se cortó la cuota a mitad de la verificación: nada estaba commiteado. El
porqué del modelo y sus trampas: `docs/hallazgos-crm.md` → «Un lead en VARIOS productos».

- **Qué es:** la casa de un lead sigue en `leads.funnel_id` + `pipeline_stage`; cada otro
  producto es una fila de `lead_funnel` con su etapa. «Agregar», nunca «mover»: ficha (X / ＋),
  tablero, lote, «Traer», alta, campañas y el opt-in de la landing. Todo lo demás (métricas,
  CAPI, MaKo, nutrición, Customer Success) lee sólo la casa.
- **El lead que se movió por error** (Fernando Muñoz, 2381, ws1) ya está de vuelta en el producto
  principal y en «Agenda R2».
- **Calendly y la fuga de `dispararEvento`** salieron de la misma corrida y son de la sesión de
  **Chatbot**, que los está terminando. No están en `f26c0a94`.

**Decisiones de Martín que quedaron abiertas** (detalle en el hallazgo):
1. Ganar en un producto AGREGADO no marca ganado al lead (la venta no existe hasta que ese
   producto sea la casa).
2. La casa de un opt-in con varios productos es el primero tildado: ¿alcanza o hace falta marcar
   el principal?
3. Mover entre dos etapas abiertas (Facturando → Falta pago) limpia la venta: ¿sólo cuando el
   estado cambia?
4. ¿El monto de cierre puede vivir en un lead abierto? (hoy su «Deshacer» no hace nada).
5. Dos Ganados sin fecha de cierre (ws1 y ws13): se completan a mano.

**Sin hacer y sin decisión pendiente:** la COHORTE del panel lateral (abajo, punto 1) sigue
abierta; el duplicado del opt-in no lleva los productos; `AGENTS.md` sigue citando el opt-in
viejo como ejemplo de «un alta que crea N filas».

_Lo que sigue abajo es el relevo del 05/10 y vale como historia._

---

**Escrito el 05/10/2026 por la sesión `claude2` (CRM), al agotarse la cuota.**
Lo lee la sesión de la otra cuenta: es el único canal entre las dos.

---

## Lo primero que hay que mirar

1. **`git log --oneline -12`** y después `docs/hallazgos-crm.md` (85+ secciones; se
   busca con `Grep` de la ruta del archivo que vas a tocar, NUNCA abriéndolo entero).
2. **El tablero** `Feature: CRM`: 28 cerradas, 7 abiertas al empezar el día; hoy se
   cerraron #627 y se dejaron al 50% #800, #18, #40, #671, #701 y #19.
3. **Hay TRES sesiones sobre este clon** (CRM, Chatbot, Perro Guardián, y entró una
   cuarta: Customer Success). El árbol no tiene un estado, tiene una hora.

## Lo que quedó SIN TERMINAR, en orden de riesgo

### 1. La ficha sin botón «Editar»: VERIFICADA, con un bug arreglado y otro abierto
La corrida terminó y se leyó. Veredicto: el botón se fue por las dos puertas (cero
controles de editar en 10 pasadas), la edición de texto guarda de verdad y «Borrar
lead» sigue existiendo en las dos con su confirmación.

**Arreglado (commit 1c08d4d7):** vaciar el setter en un workspace sin equipo cargado
hacía DESAPARECER el desplegable al recargar — el campo quedaba inasignable justo
después de vaciarlo, y la única salida era «Restaurar» desde el historial, que además
borra esa entrada. Le pegaba a todo cliente nuevo.

**ABIERTO:** al panel lateral le falta la COHORTE que la ruta sí dibuja. No se arregla
pasando la prop: sale de `lib/leads.ts` (2.600 líneas con dependencias de servidor) y
`LeadSheet` es `use client`. Se calcula en el server y baja por props, como hace la ruta.

### 2. ⚠️ El replay de sesión: completo pero sin la vuelta entera
Está todo: grabador, ingesta, retención, reproductor, artefactos en `public/replay/1/`
y las dos migraciones aplicadas. **Lo que falta es volver a correr la prueba de punta
a punta**, porque la que existe se hizo ANTES de que se agregaran los artefactos y la
migración, y dio «anda a medias» por eso.

Lo comprobado a mano después: `/replay/1/r.js` y `/replay/1/player.js` dan 200
(63.925 y 226.921 bytes), `replay_sesiones` y `replay_lotes` existen, y el
healthcheck publica el tope correcto (262.144, no 1.048.576).

**⚠️ Está APAGADO en todos los workspaces menos el 4**, donde se prendió para probar
(`app_settings`, key `landing.replay`). Eso es a propósito: un sistema que graba
personas no se enciende por un deploy.

### 3. Tres pedidos de Martín que llegaron por la sesión de Customer Success
No se empezaron. Ella ya dejó el arrastre extraído y listo para importar:

1. **Sacar la tab «Pendientes»** y llevarla al desplegable de abajo. El título
   («MaKo movió 3 leads») hay que cambiarlo: va a contener dos cosas y hoy afirma
   una. Criterio propuesto: que diga **qué hay que decidir**, no qué hizo el sistema.
2. **El toggle Kanban/Tabla con íconos**, los mismos de Customer Success
   (`app/customer-success/BarraClientes.tsx` → `VISTA_META` y `VistaToggleClientes`).
   Esa barra ya la montan dos pantallas: conviene montarla, no clonar los SVG.
3. **El arrastre del Plan en el CRM**: `import { fotoVaciaDeArrastre, useArrastreCopia }
   from '@/app/plan/board/arrastre-copia'`. ⚠️ Y lo que no está en el hook: **al nodo
   origen no se le toca nada** — el CRM hoy le pone `opacity: .5` y `scale(0.97)`, y
   con la copia y el hueco eso hace que la misma tarjeta aparezca TRES veces. Falta
   además el hueco (molde corto: `app/customer-success/KanbanEntrega.tsx`).

### 4. Lo que espera una decisión de Martín
- **Las 11 secuencias de nutrición sin embudo declarado.** El código ya respeta el
  embudo que una secuencia declare; falta la regla: con dos embudos vivos, ¿las
  existentes son del principal o se declara una por una? Sólo 4 workspaces tienen dos.
- **#20 (n8n):** hace falta la URL/credencial de la instancia, o la decisión de matarlo.
- **#18:** el texto del follow-up post-llamada. Es su voz.
- **#15:** prender el motor automático en su workspace.
- **El dataset de CRM de Meta:** es lo único que no se puede automatizar (no tiene
  endpoint). El tutorial ya está escrito en el catálogo; falta que alguien lo haga.

## Trampas de este clon que cuestan tiempo si no se saben

- **`sed -i` puede no aplicar y NO avisar.** Un test dio 8/0 sobre un archivo que yo
  creía roto. Las roturas se hacen con un script y se verifica el conteo.
- **Un backtick dentro de `python -c "…"` o `node -e "…"` lo come bash.** Me borró una
  palabra de un comentario sin decir nada.
- **El fin de línea es POR ARCHIVO.** `ComportamientoCard.tsx` es CRLF puro,
  `[id]/page.tsx` es LF. Un script de parcheo detecta el del archivo, convierte sus
  anclas, y **valida ANTES de escribir** (yo lo hice al revés y dejé uno mezclado).
- **Un guard que fija el texto EXACTO de un `select` se pone rojo cuando el vecino
  agrega una columna legítima.** Pasó hoy con `tests/nutricion-ambito-embudo.test.ts`.
- **Dos migraciones con el número 0190.** La mía (`0190_clic_con_su_punto`) está
  commiteada y aplicada; `0190_secuencia_cron` es de otra sesión y estaba sin
  commitear. Si sigue ahí, hay que renumerarla.

## Archivos que son del CRM (míos)

`app/crm/**`, `lib/leads.ts`, `lib/leads-duplicados.ts`, `lib/crm-auto*.ts`,
`lib/calificado-reunion.ts`, `lib/clic-ruido.ts`, `lib/funnel-comercial.ts`,
`lib/landing-funnel.ts`, `lib/landing-token.ts`, `lib/landing-pulso*.ts`,
`lib/meta-capi*.ts`, `lib/insights-llamada*.ts`, `lib/replay-*.ts`,
`app/api/track/**`, `app/api/crm/replay/**`, `app/api/cron/replay-purga/**`,
`app/landing-analyst/**`, `public/replay/**`, `scripts/replay-libs.mjs`.

**NO son míos:** `app/chatbot/**`, `app/agencia/**`, `lib/flujo*.ts`,
`lib/nutricion*.ts` (hoy lo tiene el Chatbot), `lib/servicio-etapas.ts`,
`lib/setting-secuencias.ts`, `app/customer-success/**`, `app/plan/**`.

## Lo que se cosechó hoy

`docs/hallazgos-crm.md` (el duplicado de 1.153 teléfonos, el sello del constructor,
el `funnel_id` del opt-in, el análisis huérfano por email, una fusión no es un
reorden), `docs/hallazgos-landing.md` (Clarity y el iframe, el default de privacidad
de rrweb), `docs/hallazgos-ads.md` (el dataset de CRM) y `AGENTS.md` (las tres
sesiones, el `tmp-` como candado, el «remote rejected» que es «ya está subido», y el
chequeo número trece del pre-push).
