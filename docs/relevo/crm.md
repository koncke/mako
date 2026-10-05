# Relevo — CRM

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
