# Retomar: Customer Success

**Dónde quedó:** 07/10, 18:45. Sesión `7a6bc4be` (cuenta `claude2`). Último pedido: la tab Curso
sin barra y personalizable (abajo). El de la tanda anterior: «Revisa todo lo que falta en el
proyecto de Customer Success y terminalo todo, cierra las tareas».

## ⚠️ Corrección medida el 06/10 21:40, gana sobre todo lo de abajo

- **08/10, 07:55: la TANDA 2 también está en `main`** (`bccbebae`, migs 0220 y 0221 APLICADAS): módulos que
  pueden no ser etapas, candados, arrastre, la lección editable, el portal del alumno con su comunidad y
  Conocimientos editable por el super admin. Lo que quedó sin hacer y las decisiones de Martín, en
  docs/hallazgos-customer-success.md → «El curso tipo Skool, tanda 2». Lo de abajo describe la tanda 1.
- **08/10: el curso tipo Skool (los 19 pedidos del 07/10).** La **tanda 1 está en `main`**
  (`1080f74c`, 02:35, migs 0216-0219 APLICADAS): comunidad, tipos de tarea, invitar y permisos con
  link mágico, editor rico, portadas diseñadas y recorrido — el recorrido, el editor, las láminas en
  las tarjetas, invitar desde el editor y la comunidad del alumno están escritos y SIN MONTAR. La
  **tanda 2 está en curso**: módulos, bloqueos, arrastre, la lección editable y el portal (ahí se
  monta lo anterior). Después, **Conocimientos editable** por el super admin (item 1). El pedido 19
  (invitar al curso al ganar) lo hizo **el CRM en su chat** (`77279ea4`, apagado por default). Lo
  aprendido y la lista de lo que falta, en `docs/hallazgos-customer-success.md` → «El curso tipo
  Skool, tanda 1»; el diseño, en `docs/diseno-curso-skool.md`; el pedido literal, en la bitácora
  de `/admin/dev/customer-success`. Nada de la tanda 1 se vio todavía en el navegador.
- **`envio_whatsapp_enabled` del ws1 está en TRUE.** Lo que dice más abajo («apagado desde el
  29/09») quedó viejo. Mover a un cliente por el camino AUTOMÁTICO del curso le manda un WhatsApp
  real: no se prueba nada sobre el ws1 que dispare mensajes.
- La auditoría de las 12 tareas contra HEAD dio **cero hechas**. Primera tanda (`54e31272`,
  `ab81f03f`, migs 0208-0210 APLICADAS): llamadas de entrega analizadas (#107), grabar/no grabar
  (#693), notas y adjuntos por clase (#692), purga de huérfanos, onboarding de la tab Curso, CAS +
  autor + puerta en el choke point, ficha linkeable, fase en la tabla, MaKo ve vencidas y avance
  del curso, secuencias de entrega con los clientes sin fila, compromisos de la junta al DUEÑO,
  #694 aplicado en la base del ws1, borrador de graduación (#667).
- Segunda tanda, con las decisiones de Martín (memoria `cs-decisiones-cierre-0610`), en
  `f6b33ed0` (migs 0211-0213 APLICADAS, 13 clases marcadas por área en el ws1): cartera con
  «Último contacto» y «Vencidas» + alerta de baja al dueño (#109), «Sin cobro» en el CRM (#747),
  recordatorio de clases por WhatsApp a los 3 días (#780) y las tres piezas de #665.
- **El borrador del Plan con los cierres está en https://hola-mako.com/plan/revisar/propavremjgpwd98**
  (2 a medias, 3 enriquecidas y 7 tarjetas nuevas; las 7 hechas se cerraron el 07/10 por pedido de
  Martín, con su prueba en el historial). Y lo que se hizo, tarjeta por
  tarjeta, en `/admin/runway#customer-success`.
- **El análisis de las llamadas de entrega (#107) no analizó ninguna todavía**: `gemini-flash-latest`
  contesta 503 («high demand») desde el 07/10 a la madrugada. Reintenta cada hora sin gastar el
  intento de la sesión y NO baja de modelo a propósito. Mirar `closing_analyses` con
  `analysis_version = 3` antes de dar #107 por cerrada.
- **La clienta del ws1 en «onboarding»** (Teresa, lead 21) es una etapa que su producto no tiene;
  la causa probable era el choke point validando contra las etapas de FÁBRICA con el catálogo sin
  leer (ya arreglado). Dónde ponerla lo decide Martín: se mueve con un clic desde su ficha.
- **El portal del alumno y la tab Curso se dibujan con el diseño de Conocimientos** (07/10,
  `70a207df`, pedido de Martín): `app/_cursos/CursoUgc.tsx` ya está enchufado. Lo que aprendió y
  lo que falta, en `docs/hallazgos-customer-success.md` → «El portal del alumno y la tab Curso con
  el diseño de Conocimientos».
- **La tab Curso sin barra y personalizable** (07/10, `5cbaedbb`, mig 0214 APLICADA): la marca de
  la barra oscura es el desplegable de cursos y color; color, portadas y títulos con un clic. El
  título NO renombra el producto del CRM (a propósito); la etapa SÍ renombra la columna. **Espera
  una decisión de Martín: ¿las clases van por link o se suben?** Lo medido y la recomendación, en
  `docs/hallazgos-customer-success.md` → «La tab Curso sin barra, el curso personalizable».

---

**Lo de abajo es del relevo anterior (06/10, 18:30, cuenta `claude1`).** Cerró el trabajo del
**curso con invitación** que otra sesión dejó a medias, sin commitear, al quedarse sin cuota.

## ⚠️ Lo que cambió desde el relevo anterior, y lo cambia todo

**La decisión grande YA ESTÁ TOMADA.** El relevo del 05/10 decía que dónde vivía el programa de
Mauricio «seguía sin decidir». Se decidió el 06/10: **el curso vive EN MaKo, colgado de las etapas
de la entrega, y Whop salió del producto.** El pedido literal de Martín (7 puntos, incluido
«implementa todo esto, no preguntes») está sin resumir en la bitácora de
`/admin/dev/customer-success`, hito «6 oct 12:38». El detalle de esa tanda, en
[`docs/relevo/instagram-afuera-y-curso.md`](instagram-afuera-y-curso.md).

Y el **mensaje de 4 preguntas a Mauricio** quedó medio desactualizado: dos de las cuatro eran
sobre Whop (¿sus clientes entran gratis?, ¿quién los da de alta?), que ya no está. No sé si se
mandó: preguntale a Martín antes de mandarlo, y si sigue en pie, sacale las dos de Whop.

## Lo que SÍ está hecho

| Qué | Dónde vive |
|---|---|
| El kanban de la entrega por producto, con FASES | `app/customer-success/KanbanEntrega.tsx` · `lib/servicio-etapas.ts` · mig 0188 |
| El curso: la tab, el portal, la ficha y el paso de etapa | `app/customer-success/curso/` · `lib/curso*.ts` · mig 0202 — el ws1 tiene 107 clases cargadas |
| **La invitación al curso y la cookie del alumno** (06/10 tarde) | `lib/alumno-sesion.ts` · `lib/alumno-acceso.ts` · `app/mi-curso/` · `app/api/compartido/curso/entrar/` · mig 0206 (**aplicada**) |

Las decisiones que gobiernan la tab —son 14— están en la memoria `cs-ficha-cliente`. La cosecha
de cada tanda, en [`docs/hallazgos-customer-success.md`](../hallazgos-customer-success.md): la de
la invitación es la subsección «Invitar al cliente al curso: la cookie del alumno».

## Lo que falta, en orden

1. ⚠️ **Prender `envio_whatsapp_enabled` en el ws1.** Es el interruptor entre «está hecho» y «está
   funcionando»: apagado desde el 29/09, así que a ninguno de los 14 clientes de Mauricio le llega
   el link, la etapa nueva ni los avisos de las llamadas. **La invitación por MAIL no depende de
   ese flag**: sale por Resend aunque el WhatsApp esté apagado. Es decisión de Martín.
2. **Nadie fue invitado todavía** (0 invitaciones, medido el 06/10 18:05). La invitación no se
   probó de punta a punta con un email real.
3. **El PAS fuera de orden**: el kanban lo pone tercero y la planilla de Mauricio después de
   Tablero y Ritmo, a propósito. Se arregla moviendo la etapa en el editor (las clases viajan
   solas). Lo decide Martín.
4. **Los 14 clientes de Mauricio están todos en Bienvenida**: falta ubicarlos en su etapa real.
5. ~~`app/_cursos/` sin enchufar~~: **enchufado el 07/10** (`70a207df`), lo montan el portal y la
   tab Curso. Falta que lo monte Conocimientos (`CursoReplica`, que sigue con su copia).
6. Las secuencias de nutrición no se disparan por la etapa de entrega; la ficha no es linkeable;
   el onboarding de la tab Curso; lo que MaKo puede leer del curso por la API. El resto, en la
   memoria `cs-ficha-cliente`, sección «Lo que quedó SIN hacer».

## ⚠️ Lo que hay en el árbol y NO es de esta área — no lo commitees

Al 06/10 18:30 el clon tenía ~50 archivos sin commitear de otras sesiones. Los que tocan bordes de
esta área:

- **`app/_cursos/` (+ el campo `extra` de `app/conocimientos/posicion.ts`)**: una extracción del
  dibujo de un curso cuya cabecera dice que la montan tres pantallas, y que tiene **CERO
  `import`**. Se dejó afuera A PROPÓSITO: nada depende de ella y commitearla dejaría una cabecera
  que miente. Quien la retome toca `/conocimientos`, que tiene alumnos reales.
- **`lib/workspace.ts` y `lib/tablas-de-inquilino.ts`**: traen sólo `lead_funnel` (mig 0207), que
  es del **CRM**.
- **`AGENTS.md`**: trae «LO PRIMERO AL ABRIR», de la sesión de Estrategia 2 Cuentas.
- **`tests/crm-auto-asistencia.test.ts` está ROJO** sobre el árbol compartido: alguien cambió en
  `lib/crm-auto.ts` el texto `Asistió R…` por `Asistió ${reunion}` y el guard busca el literal. Es
  del CRM/Fathom. El pre-push no corre tests, así que no frena a nadie, pero aparece en todo
  `npm test`.
- **Un archivo vacío llamado `=`** en la raíz del repo (06/10 11:16, 0 bytes): huele a un `>` que se
  escapó en un comando. No es de nadie que se sepa; no lo borres sin preguntar.

## Las trampas que más tiempo ahorran en esta tab

1. ⚠️ **El alumno del curso NUNCA recibe `mako_session` ni una fila en `usuarios`.** Está medido:
   con una fila, leía el CRM de Mauricio. Tiene su cookie propia, que el proxy no toma por sesión,
   y lo único que abre es `/mi-curso`. **Si alguien propone «darle una cuenta de MaKo con rol de
   alumno», es esto lo que rompe.**
2. ⚠️ **Antes de declarar ajeno un hunk, grepeá qué TEST lo nombra.** El 06/10 dejé afuera dos
   arreglos de `app/api/admin/agencia/*` por «no ser del curso», y los delató un test del curso que
   los cuidaba. La forma de que salga sola: verificar el conjunto en un **worktree limpio con SÓLO
   lo tuyo** (`git worktree add --detach`, junction a `node_modules` con PowerShell). Ojo: ahí
   falla `tests/dev-areas.test.ts` por un archivo local (`.claude/settings.local.json`) que un
   worktree no tiene — eso es del entorno, no tuyo.
3. ⚠️ **El reparto de clientes en columnas es DERIVADO**: un cliente sin fila en `cliente_entrega`
   está en la PRIMERA etapa. Toda función que aplique esa regla necesita el UNIVERSO de clientes,
   no las filas.
4. ⚠️ **Los templates de estilos de `KanbanEntrega` y `EtapasEntregaModal` no admiten NI UN
   backtick**, ni en un comentario: cierra la cadena a la mitad y el typecheck señala otra línea.
5. ⚠️ **Verificar esta tab ESCRIBE en producción.** El ws3 está en cero; abrir la pestaña Curso de
   un cliente le CREA su fila de `curso_accesos` (hay que borrarla después).

---

## Lo que vale para cualquier chat de este relevo

- **Somos `claude1` (Mauricio).** Antes de firmar releé `head -1 ~/.claude/cuenta-activa.txt`: lo
  que inyecta el hook al arrancar es una foto.
- El trailer `Claude-Cuenta:` va **pegado** a `Co-Authored-By:`, sin línea en blanco.
- **Suele haber varias sesiones sobre el mismo clon.** `git status` antes de commitear, y
  `git commit -- <rutas>` por ruta explícita: un commit pelado se lleva el índice entero.
- ⚠️ **`/tmp` es compartido entre las sesiones.** Todo temporal va al scratchpad de tu sesión;
  `git commit -F /tmp/msg.txt` puede commitear el mensaje de otra.
- ⚠️ **Un reporte sobre el árbol se FECHA o no se entiende**, y se vuelve a medir antes de mandarlo.
- ⚠️ **Bootear local ESCRIBE en la Supabase de PRODUCCIÓN.**
