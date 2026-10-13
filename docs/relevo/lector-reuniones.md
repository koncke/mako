# Relevo · Lector de reuniones (13/10/2026, claude3)

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
