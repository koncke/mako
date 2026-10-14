# Retomar: Plan · Perro Guardián

## ⏩ Lo último (14/10, cuenta `claude2`): cierre por pedido de Martín

**Lo PRIMERO que espera a Martín:** confirmar el borrador con lo de sus últimas 3 reuniones y su
feedback de 18 puntos → **https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6** (50 ítems,
`pendiente`). Recién cuando lo aplique, el Perro los puntúa, y **después** se le manda a cada
chat lo suyo (memoria `cerebro-reparte-a-chats`). No antes.

**Lo que decidió el 13/10, y no se re-pregunta:**
- Las tres tareas de automatizaciones que el ruteador puso en CRM van a **Chatbot**.
- Las **cuatro de Mauricio** (sus upsells, Teriyaki, explorar MaKo, el goteo) **no se cargan**.
- Salen «Terminar pendientes de MaKo» (repetía otras dos) y el funnel de Renovación.
- Las tres de «pregunta a qué funnel va el lead» van como **una sola**.
- Punto 16: se pueden usar referentes conocidos generados con IA, **sin aclarar nada**.
- Punto 18: la IA de Ads Manager decide **todo sola, dentro de topes** configurables.
- Puntos 13 a 15 (Stories, Calendario, publicar): **un solo proyecto**, el Calendario.

**Lo hecho en esta ventana** (todo en main):
| Qué | Commit |
|---|---|
| El rojo de `tests/plan-proyectos-catalogo.test.ts`: no era Analysts, era el ORDEN de la barra; el guard compara conjuntos | `5e829212` |
| Los dos tramos de reunión sin leer: uno no era Google, era el detalle sin su comilla de apertura (arreglado en `repararJson`) | `aed3ccb7` |
| Borrado de lo que el alta sin preguntas dejó sin call site: `PreguntaCampo` y tres textos del contrato de preguntas | el commit de este relevo |

**Cerrado después, el 14/10 a la tarde (cuenta `claude1`):**
- **Las TABLAS corren a las de abajo** al arrastrar una fila, igual que el Kanban (la tabla de
  Tareas y la de adentro de un proyecto). Tenía una segunda mitad: la tabla desempataba por orden
  de llegada y no por `num`. Detalle en `docs/hallazgos-plan.md` → «La tabla de tareas, el mismo
  gesto». Sin verificar con un arrastre: no había RAM.
- La línea de AGENTS.md que nombraba `PreguntaCampo`, corregida.
- **La corrida del Perro ya no deshace el arrastre.** Era más grave que «re-empatar»: medido,
  240 de 513 arrastres se deshacían en la primera corrida (cada día y con cada alta). Ahora 0
  (`respetarFijadas`). El porqué y lo que falló antes, en `docs/hallazgos-plan.md` → «La corrida
  del Perro deshacía el arrastre».

**Lo que sigue en la cola, sin tocar:**
- `puntuarPlan` (la re-puntuación completa con el modelo, `lib/mako-guardian.ts`) también curva
  con `curveTaskScores` y no pasa por `respetarFijadas`: no se midió si respeta a las fijadas.
- Nada de lo del arrastre se probó con un arrastre en un navegador (sin RAM para un dev server).

**Una trampa medida que sirve para el que pushee:** `tsc --noEmit` sobre el proyecto entero sale
con código 1 sin un solo error (también con 6 GB de heap), pero el MISMO tsc con un `include`
acotado a unos archivos y todo lo que importan termina en 0. O sea que tsc anda: lo que lo tumba
es algo del conjunto completo (memoria `pc-techo-ram-chrome`: pide 4 GB y con muchos chats no los
hay).

Lo que sigue abajo es el relevo del 09/10, que sigue valiendo.


**Dónde quedó:** 09/10/2026, cuenta `claude2`, sesión `153a499a` (chat «Plan - Perro
Guardián»). Lo anterior, del 05-06/10 en la cuenta 1, está en el historial de este archivo.

## 1. Lo que está hecho

| Qué | Commit | Dónde vive |
|---|---|---|
| **Soltar una tarea en el Kanban la deja donde se soltó**: se corren las de abajo un punto, sin cruzarse ni cambiar de columna; el deshacer las devuelve. En los dos tableros (el tuyo y el de cada cliente) | `27ef6b28` (09/10) | `app/plan/board/lugar-al-soltar.ts` (la regla, pura) · `BoardShell.tsx` (el `onDrop` y el pop-up) · `lib/plan-reprio.ts` · `app/plan/TodoBoard.tsx` · guard `tests/plan-lugar-al-soltar.test.ts` |
| Cargar tareas no pregunta nada (las tres puertas) | `d763c2b9` (05/10) | `tests/alta-sin-preguntas.test.ts` |
| La casilla de selección de las tarjetas se anima como la del CRM | `d988fc98` (06/10) | `tests/plan-casilla-tarjeta.test.ts` |
| La prueba de un cierre tiene UN tope (otra sesión) | `6641b6d8` (07/10) | `lib/cierre-tarjeta.ts` |

Los porqués están en `docs/hallazgos-plan.md` → «El punto medio es correcto y la tarjeta igual NO
queda donde se soltó» (la medición del 06/10 y la cura del 09/10). Los pedidos textuales, en la
bitácora de `/admin/dev/plan`.

## 2. Lo que Martín decidió el 09/10 (no se re-pregunta)

- **El arrastre: «Correr las de abajo».** Lo eligió dos veces, la segunda con el costo medido:
  sobre el tablero real se corren p50 1 tarea, p90 29, máximo 52, un punto cada una.
- **Los scores de los 14 proyectos que reordenó la corrida del 03/10: «Dejarlos».** Son el plan
  de las cinco etapas que está vigente. Los diez deadlines que esa corrida pisó ya se habían
  revertido en `3cc5ecb2` (04/10).
- **`docs/proyeccion-04oct.md`: «Mostrame qué cambiaría», y después «Sólo las 7 que faltan».**
  Se cargaron el 09/10 como tareas #835 a #841, SIN FECHA (el Perro les había puesto del 10 al
  16/10 y se las saqué, con su entrada en el historial) y sin tocar ninguna fecha existente. Las
  dos fechas que la proyección cambiaba (Prospección al 19/10, Anuncios al 1/11) NO se tocaron.
  El cruce está en el punto 4.

## 3. Lo que quedó a medio hacer

- **Las TABLAS no corren a las de abajo.** Arrastrar una fila de la tabla de tareas
  (`useArrastreFilas`, `app/plan/board/Tablas.tsx`) sigue con el punto medio solo: el mismo gesto
  da otro resultado según la vista. Es la misma regla (`hacerLugar`) con su `lugar`.
- **El Perro puede re-empatar al día siguiente** a una tarjeta fijada con una vecina que no lo
  está: `recurvarPlanOwner` reparte números por rango y no sabe dónde estaba la fijada. No es
  nuevo (le pasa a toda tarjeta fijada a mano) y se arregla ahí, no en el arrastre.
- **Código sin call site** del alta sin preguntas: `PreguntaCampo` y cuatro exports de
  `lib/preguntas-contrato.ts`.

## 4. La proyección del 04/10 contra el tablero de hoy (sólo lectura, 09/10)

| Lo que propone | En el tablero |
|---|---|
| P1 técnico al 7/10 · Onboarding y oferta 8-9/10 · Video e Imagen 10-14/10 · Landing y VSL al 18/10 | **Ya coinciden** |
| Prospección cobrando el grupal a mano, **19/10** | «Vender MaKo: Prospección» vence el **31/10** |
| Anuncios con la pasarela aprobada, **1/11** | «Vender MaKo: Ads» vence el **18/10** |
| Stripe propio · `/terminos` con la cláusula de cobro · el documento de oferta | Existen **sin fecha**: #388, #551, #783 (`/reembolsos` no aparece) |
| Tu CRM + tu embudo · el embudo de la app · filtro de embudo en broadcasts · la capa nueva + migración · el webhook de pago · precios y botón de compra en la landing · anuncios + pasarela | **No existen** (7) |

Nada de eso pisaba algo que una persona tocó después del 04/10: los únicos toques a mano eran el
trimestre de Chatbot y de Customer Success (07/10), que la proyección no cambia.

**Cargadas las 7 que no existían** (09/10, por el camino de siempre: borrador y aplicación):
#835 acceso al CRM del super admin y #836 el embudo de la app y #837 el envío masivo por embudo →
Feature: CRM · #838 el nivel de acceso del plan de la app y #839 el webhook de pago → Feature:
Cobros y planes · #840 precios y botón de compra → Vender MaKo: Landing y VSL · #841 la pasarela
aprobada → Legal y fiscal. Dos cayeron en otro proyecto que el que propuse (#836 y #841): el
Perro rutea por tema. Al aplicar, el Perro subió «Feature: Cobros y planes» de 80 a 81 y
re-curvó las tareas no fijadas, que es lo que hace toda alta; ninguno de los 14 proyectos de la
corrida del 03/10 cambió de número.

## 5. Trampas del área

- **Verificar el Plan ESCRIBE en producción.** «Agregar N al plan» crea tareas reales y «Cambiar»
  en el pop-up fija el número. Para verificar sin escribir: `page.route` de Playwright contestando
  todo lo que no sea GET a `/api/*`.
- **Levantar el dev server local escribe credenciales en prod** (memoria `boot-local-escribe-prod`),
  y Next 16 deja UN dev server por carpeta. Un dev server ajeno puede escuchar y no contestar: el
  del puerto 3021 no contestó ni el login en dos minutos el 09/10.
- **La máquina se queda sin memoria con varias sesiones**: el 09/10 había 0,6 GB libres de 16 y
  42 procesos de node. El typecheck va por `scripts/typecheck-lock.mjs`, de a uno por máquina, y
  puede esperar varios minutos su turno; la suite completa da falsos rojos por timeout (se
  confirman corriendo esos archivos solos).
- **El scratchpad de la sesión se vacía en el relevo de cuenta.** Lo que haya que conservar va al
  repo.
- **Las tareas admiten empates; los proyectos no.** `Hist.ts` es epoch en MILISEGUNDOS: un filtro
  de fecha contra un string ISO da cero sin error (pasó en el cruce de la proyección).
- **`updated_at` no distingue al Perro de una persona**: lo que lo dice es `actor: 'user'` en el
  historial y `score_manual`.

## 6. Sin verificar, y cómo medirlo

- **El arrastre nuevo no se probó con un arrastre en el navegador** (sin dev server que contestara
  y sin memoria para levantar otro). Para medirlo: dev server propio con las claves del catálogo
  vacías, `/api/auth/dev-login?ws=9&next=/plan/agencia`, vista «Tareas», arrastrar una tarjeta
  entre dos con el mismo número y contestar el `POST /api/plan-board` desde Playwright con las
  vecinas que da `hacerLugar` sobre el `GET /api/plan-board`. Tiene que quedar entre las dos.
- **El alta sin preguntas no se probó con un click**: la próxima reunión con tareas, «Agregar N al
  plan» tiene que cargar directo.
