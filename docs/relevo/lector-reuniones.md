# Relevo · Lector de reuniones (13/10/2026, claude3)

## ✅ Actualización (13/10, noche, claude2): los dos tramos ya están leídos

**La lista está completa: 42 tareas** (35 + 7). Las 7 nuevas están al final de
`C:\Users\marti\Downloads\mako-feedback-y-tareas.md`, en «Lo que faltaba». Sigue **sin
cargarse nada al plan**: falta que Martín valide el reparto.

- **13/10:** releída entera (5 tramos, 0 fallidos). De 17 tareas, cuatro ya estaban con otro
  minuto (cobranza, pagos, Kanban del Plan, fallo del chatbot): **1 nueva**, el funnel de
  Renovación, que el detalle cuenta en pasado y puede haber quedado hecho en la reunión.
- **12/10 18:26:** **no era Google.** El tramo 1 fallaba siempre porque el modelo escribía
  `"detalle": **Qué hay…` sin la comilla de apertura y `repararJson` no lo arreglaba. Arreglado
  en lib/json-del-modelo.ts (con test probado rompiéndolo). Releída: 4 tramos, 0 fallidos,
  **6 nuevas**, tres de ellas la misma regla («todo lead que entra pregunta el funnel»).
- La cosecha, en `docs/hallazgos-ia.md` → «"Google estaba saturado" explicaba UNO de los dos
  tramos perdidos».

Lo de abajo es el relevo original, que sigue valiendo salvo el «puede faltar alguna».


Ventana corta y de una sola cosa: **sacar las tareas de las últimas 3 reuniones de Martín**.
No se tocó una línea de código: el trabajo fue correr el pipeline que ya existe y leer lo que
devolvió.

## Qué se hizo

`listReunionesRecientes` + `extraerTareasDeReunion` (lib/plan-fathom.ts) sobre el Fathom de
**Martín**, que es el token del **ws9** (`FATHOM_API_KEY` está cargada en ws1, ws4, ws9 y ws11;
la de Martín es la del superadmin). Las tres reuniones y lo que salió:

| Reunión | Cuándo | Tareas |
|---|---|---|
| Impromptu Google Meet Meeting | 13/10 01:17 | 13 · ⛔ 1 de 5 tramos sin leer |
| Mau <> Martín | 12/10 20:21 | 5 |
| Impromptu Google Meet Meeting | 12/10 18:26 | 17 · ⛔ 1 de 4 tramos sin leer |

**35 tareas en total.** Se le entregaron a Martín como un MD (lista por reunión, separadas en
«mías» y «de otra persona», con link al minuto de cada una). **No se cargó ninguna al plan**:
el camino sigue siendo el borrador que confirma una persona y puntúa el Perro.

## Lo que se midió, y es lo que vale para el que siga

**Google estaba saturado y el extractor pierde tramos, en silencio para quien mire el
resultado.** Durante toda la corrida, las tres cuentas de Gemini alternaron **HTTP 503 («high
demand») y 429**, con los reintentos de `chatCheap` adentro. Como `plan-fathom` tiene
`fallback: []` —a propósito: antes que degradar a un modelo peor, falla y se reintenta— **dos
de las tres reuniones quedaron con un tramo sin leer**, y el aviso vive sólo en el log
(`1 de 5 tramos no se pudieron leer — el resultado está INCOMPLETO`).

Para el cron nocturno eso está bien (reintenta en la corrida siguiente). Para una extracción
pedida a mano, no: **el que la pide no ve el log y recibe una lista que parece completa.** Dos
cosas que quedan abiertas, con su archivo:

- El borrador que deja `procesarReunionesNuevas` (lib/reunion-auto.ts) ya distingue la lectura
  parcial —no cierra la reunión y la reintenta—, pero **nada de eso llega a la pantalla**: la
  tarjeta del borrador no dice «esta reunión se leyó a medias». Vive en
  `app/plan/board/TareasRecibidasModal.tsx` + `lib/plan-propuesta.ts` (el borrador no guarda
  `partesFallidas`).
- Una extracción pedida a mano con un tramo caído **debería decirlo donde se lee el
  resultado**, no sólo en `console.error` (lib/plan-fathom.ts, `extraerTareasDeTexto`).

Y un dato de calidad: en una de las partes el modelo devolvió **JSON inválido por los asteriscos
del molde del detalle** (`"detalle": **Qué hay que hacer`…) y el reparador no pudo con eso
(lib/json-del-modelo.ts). Es un modo de falla distinto del 503 y se contabiliza igual: tramo
perdido.

## Estado del árbol

Sin cambios propios: los modificados de `git status` son de otras sesiones. Lo único escrito por
esta ventana es este relevo.
