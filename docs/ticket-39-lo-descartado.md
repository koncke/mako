# Ticket #39 — tres causas descartadas, y por qué lleva 7 días abierto (7/11/2026)

**El ticket:** «La pantalla CRM se rompió», Brigitte Eberlin (ws 15), `/crm?funnel=17`, **React #418
con `args[]=HTML`**. Levantado el **1/11 11:35**, clasificado para arreglo automático y entregado a
un chat a las **11:55**. Siete días después sigue abierto, y el cliente lo ve «En curso» desde
entonces.

## ⚠️ Lo primero, porque es la causa real de los 7 días

**Este ticket se investigó DOS veces, por dos sesiones distintas, cada una desde cero, y ninguna
escribió el resultado en el ticket.** Los descartes quedaron en dos documentos de hallazgos de áreas
que no son la del ticket:

- `docs/hallazgos-competitors-spy.md` (6/11) — buscando el #39 encontraron **otro** bug, lo
  arreglaron en Spy, y de paso midieron que **el CRM estaba limpio**.
- `docs/hallazgos-plan.md` (4/11, ticket #52) — descartaron la causa del reloj y anotaron, al pasar:
  «El #39 (Brigitte, /crm, `args[]=HTML`) **sigue abierto y sin causa: no es éste**».

Quien abra el ticket hoy no ve nada de eso: el historial dice «creado · clasificado · entregado».
**Un descarte que no está en el ticket es un descarte que el próximo vuelve a hacer.**

## Lo que YA está descartado (no rehacerlo)

| Causa | Quién la descartó | Cómo |
|---|---|---|
| **El emoji en el nombre** (`charAt(0)` parte un emoji y el server manda «�») | 6/11, buscando esto mismo | «El CRM resultó estar limpio: **todas sus iniciales ya salen de `iniciales()`**». Era real, pero en Spy, y ahí se arregló |
| **El reloj / la zona horaria** (`hoyISO()` en el render) | 4/11, ticket #52 en `/plan` | Ésa da **`args[]=text`**, y el #39 es **`args[]=HTML`**. Lo dejaron escrito: «no es éste» |
| **Los filtros guardados en `localStorage`** | 7/11, esta vuelta | `CrmBoard.tsx:2121` lee `window.localStorage` dentro de un **`useLayoutEffect`**, que corre DESPUÉS de hidratar. No puede causar un desajuste |

## La pista que acota, y que todavía nadie usó

**`args[]=HTML` no es lo mismo que `args[]=text`.** React dice «el HTML que dibujó el server no
coincide», no «el texto no coincide»: **es un desajuste de ELEMENTO**, no de contenido. Eso descarta
de entrada toda la familia de causas de texto (nombres, fechas, números, formatos) —que es donde
miraron las dos investigaciones anteriores— y deja tres candidatas:

1. **Anidado de HTML inválido que el navegador corrige solo** (`<div>` dentro de `<p>`, `<a>` dentro
   de `<a>`, una `<table>` sin `<tbody>`). El server manda una cosa, el parser del navegador arma
   otra, y React ve dos árboles distintos. **Es la más probable en un tablero kanban.**
2. **Un render condicionado por algo que sólo existe en el navegador** (ancho de pantalla,
   `matchMedia`). Medido hoy: en `app/crm/` no hay ninguna lectura de ésas en un primer render.
3. **Una extensión del navegador** que inyecta nodos. El criterio del #52 para descartarla es mirar
   las `pistas` del error (`font=0` y sin extensiones → «entonces sí es nuestro»).

## Lo que lo cerraría, y es UNA medición

Leer las **`pistas` del registro de `errores_app` de ese error** (ws 15, 1/11 11:35): dicen si había
extensiones y qué elemento no coincidía. Con eso se decide entre las tres candidatas sin adivinar.
Es una lectura de producción.

⚠️ **Y si las pistas dicen que había una extensión, el ticket se RECLASIFICA, no se arregla**
(`tickets.ts reclasificar 39 pedido --porque "…"`). Hoy nadie lo cerró **ni lo descartó**, que es la
peor de las dos opciones: el cliente sigue viendo «En curso» por algo que quizá no es nuestro.

## La regla que queda

**Un ticket entregado a un chat no tiene a nadie mirándolo.** El Runner clasifica y entrega en
minutos —eso funciona—, pero después nadie vigila el hueco entre «entregado» y «hecho». Por eso se
armó `~/.claude/guardia/vigia-tickets.mjs` el 7/11: avisa cuando un ticket pasa un día en curso sin
cerrarse. **Es un Monitor que el Cerebro arma al abrir, y se pierde al cambiar de cuenta o con
`/clear`** — ya había pasado el 29/10 y volvió a pasar.
