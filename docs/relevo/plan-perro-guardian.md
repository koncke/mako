# Retomar: Plan · Perro Guardián

**Dónde quedó:** 06/10/2026, 16:30. Sesión `153a499a` (chat «Plan - Perro Guardián»), cuenta
`claude1`. Cierre por cambio de cuenta. El árbol de esta sesión está limpio: todo lo mío está
commiteado, pusheado y **en producción** (el deploy Ready de las ~16:04 del 06/10 contiene
`de64b5b7`, que tiene adentro los cuatro commits de abajo).

## 1. Lo que está hecho y desplegado

| Qué | Commit | Dónde vive |
|---|---|---|
| **Cargar tareas no pregunta nada.** Fuera el paso de preguntas en las tres puertas (el modal de reuniones, `/plan/revisar` y lo que entra por WhatsApp, Claude y el proyecto vacío) y en los cuatro productores que las fabricaban con IA | `d763c2b9` (05/10 22:32) | `app/plan/board/TareasRecibidasModal.tsx` · `app/plan/revisar/[id]/RevisarPropuesta.tsx` · `lib/plan-propuesta.ts` (`crearPropuesta` escribe `notas: []`) · guard `tests/alta-sin-preguntas.test.ts` |
| **La casilla de selección de las tarjetas del Plan se anima como la del CRM** (ancho 0 → 15 px con el hover, todas a la vista si hay algo elegido) | `d988fc98` (06/10 00:21) | `app/plan/board/BoardShell.tsx` (CardTile, ProyectoCardTile) · `app/globals.css` (`.mk-sel-tarjeta`) · guard `tests/plan-casilla-tarjeta.test.ts` |
| Cosecha de las dos: el alta tenía otra puerta, la casilla y sus trampas de medición, y la bitácora del área (no existía) | `b8255314` (06/10 00:26) | `docs/hallazgos-plan.md` · `docs/hallazgos-ui.md` · `docs/hallazgos-infra.md` · `app/admin/dev/plan/bitacora.ts` |
| **El arrastre del Kanban, medido sin tocar código** (ver punto 4) | `d59353ca` (06/10 10:54) | `docs/hallazgos-plan.md` → «El punto medio es correcto y la tarjeta igual NO queda donde se soltó» |

La regla del alta quedó también en la memoria `alta-sin-preguntas` y en la tabla de
`AGENTS.md` («Los tipos de pregunta del Perro…»). La bitácora de `/admin/dev/plan` tiene los
pedidos textuales de Martín.

## 2. Lo que quedó a medio hacer

- **Código sin call site que dejó el alta sin preguntas:** `PreguntaCampo` y cuatro exports de
  `lib/preguntas-contrato.ts`. No rompe nada; queda en la cola de la bitácora («Borrar lo que
  quedó sin call site»). No se borró en la misma tanda para no mezclar un borrado con el
  cambio de comportamiento.
- **El orden al soltar una tarjeta** (punto 4): medido, sin implementar, porque cada cura
  choca con una decisión anterior.

## 3. Las trampas del área (las que ahorran tiempo)

- **Verificar el Plan ESCRIBE en producción.** «Agregar N al plan» crea tareas reales;
  «Aplicar» en el pop-up de prioridad fija el número. Para mirar el pop-up se aprieta
  **Cancelar**, que no escribe.
- **Levantar el dev server local escribe credenciales en prod** al arrancar
  (`migrarEnvACredenciales`). Hay que vaciar las keys del catálogo para ese proceso y mirar
  que el log diga «hidratadas» y no «migradas» (memoria `boot-local-escribe-prod`).
- **Next 16 permite UN dev server por carpeta.** Si otra sesión tiene el suyo levantado, el
  tuyo no arranca: worktree hermano + `turbopack.root` subido en la copia descartable;
  `--webpack` ya no sirve (`node:crypto`). Detalle en `docs/hallazgos-infra.md`.
- **Las tareas admiten EMPATES a propósito; los proyectos no.** `fijarPrioridadAMano`
  (`lib/plan-reprio.ts`) escribe el número de una tarea tal cual, sin cascada (241 tareas no
  entran en 100 números). Los proyectos sí corren la cascada `fijarYDesempatar`.
- **`updated_at` no distingue al Perro de una persona.** El cron del Perro re-curva el tablero
  entero y le pone a todas las tarjetas el mismo timestamp al milisegundo. Lo que dice «esto
  lo tocó Martín» es el `actor: 'user'` del historial y `score_manual`.
- **Medir un hover en el tablero:** el mouse en reposo sobre la barra lateral la despliega y
  tapa las tarjetas, y el scroll del tablero es suave (hace falta esperar ~900 ms). Las dos
  dieron falsos negativos (`docs/hallazgos-ui.md`).

## 4. Lo que espera una DECISIÓN DE MARTÍN

1. **Qué hacer cuando se suelta una tarjeta entre dos con el mismo número.** Pedido del 06/10
   (por la sesión de Customer Success): «la posición son PRIORIDADES… Si lo hace bien, que no
   modifique nada». **No lo hace bien:** contra el tablero real, en 472 de 618 lugares (76%)
   la tarjeta queda corrida 1 a 3 lugares, porque 208 tareas abiertas comparten 85 números y
   entre dos con el mismo no hay número que la deje en el medio (desempata `num`). Opciones:
   - **Dejarlo así.** La prioridad que queda es la que se eligió; sólo el lugar entre
     empatadas no es exacto.
   - **Correr a las vecinas** que tienen ese número un lugar para abajo, sin que ninguna cambie
     de columna. Es la que recomendé: mantiene «posición = prioridad». Toca el número de 2 a 5
     tareas ajenas; la cascada completa para tareas se descartó el 23/09.
   - **Una posición manual** como desempate, como el CRM. Es lo que él dijo que el Plan no es.

   Vive en `app/plan/board/BoardShell.tsx` (`scoreEntre`, el `onDrop` del Kanban) y
   `lib/plan-reprio.ts` (`fijarPrioridadAMano`, rama de tareas). El primer punto del pedido
   (un drop que se pierde sobre el hueco) **no pasa en el Plan**: 6 de 6 drops llegaron. No hay
   nada que decidir ahí.
2. **Los SCORES de los catorce proyectos que reordenó la corrida del 03/10.** Esa corrida
   aplicó el plan de la llamada con Leila del 1/10 y **pisó diez deadlines** que Martín había
   depurado a mano catorce minutos antes (seis que había dejado sin fecha a propósito y cuatro
   a los que les había cambiado la fecha). **Los deadlines se revirtieron en `3cc5ecb2`
   (04/10 21:29).** Los **scores** que esa misma corrida reordenó («prioridad 94 a 96», «93 a
   88»…) **NO se revirtieron**: reordenar era lo pedido en ese momento, y deshacerlo sin
   preguntar sería la misma falta al revés. En esta ventana no cambió nada de eso. Detalle:
   `docs/hallazgos-plan.md` → «Un plan tiene FECHA, y el tablero sobre el que se aplica
   también».
3. **`docs/proyeccion-04oct.md` sigue SIN cargarse al tablero, a propósito.** Ningún commit
   lo tocó después de crearlo (04/10 22:33) y en esta ventana no se cargó. Cargarlo es
   decisión de Martín, y si se carga hay que hacerlo con la regla de arriba: comparar contra
   lo que HAY y frenar en todo lo que una persona tocó después (`actor: 'user'`).
4. Dos más de producto, chicas, anotadas en `docs/hallazgos-plan.md`: lo que se crea con el
   filtro de cliente puesto no nace asignado a ese cliente (05/10), y la barra de lote de la
   grilla de Proyectos cuenta sobre todo lo filtrado y no sobre lo dibujado (04/10).

## 5. Lo que quedó SIN verificar, y cómo medirlo

- **El alta sin preguntas no se probó con un click.** «Agregar» crea tareas reales, así que se
  verificó el cableado (el botón llama a `aplicar()`, la misma función que corría al final del
  wizard) y lo fija el guard. Para medirlo: la próxima reunión de Fathom con tareas, apretar
  «Agregar N al plan» y comprobar que carga directo, sin ninguna pantalla en el medio.
- **Por qué el Plan no sufre el drop perdido que sí tenía Customer Success:** no se midió el
  porqué, sólo el resultado (6/6, Chromium headless con Playwright contra el dev server). Si
  Martín lo ve fallar en su Chrome, se repite el arrastre con `channel: 'chrome'` y
  `headless: false`.
- **Que `docs/proyeccion-04oct.md` siga sin cargar lo dicen git y esta sesión, no la base.**
  No consulté el tablero en esta ventana. Para confirmarlo: buscar en `plan_tareas` las
  tarjetas que ese documento nombra y mirar su `created_at`.
- **Las cifras del arrastre (76%, 85 números) son del tablero del 06/10 a la mañana.** El Perro
  re-curva todos los días, así que cambian; el script que las reproduce lee `/api/plan-board`
  en sólo lectura y tiene 60 líneas (está explicado en el hallazgo).
