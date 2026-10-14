# Customer Success, el curso y la comunidad

<sub>Escrito el 10/10/2026 para una cuenta de Claude que arranca **sin una sola línea de
historial**. Cubre la ventana del commit `6785dc16` (05/10/2026 12:33) a `a6481b4d`
(10/10/2026 19:05). Reemplaza entero al briefing anterior (del 09/10 16:09): lo que ése
afirmaba y hoy es falso está más abajo, en «Lo que el briefing viejo decía mal».</sub>

<sub>**Puesto al día el 13/10/2026** por la sesión que cerró lo planificado (ver «0.» abajo). Lo que
se cerró está marcado ✅ en su lugar, con la fecha.</sub>

## Qué es esta parte del producto, para alguien que nunca la vio

MaKo es la plataforma de Martín Koncke. Cada cliente de MaKo es un **negocio** (un
*workspace*, con su número: ws1, ws3, ws13…) y ese negocio tiene a su vez **sus propios
clientes**. Customer Success es la tab donde el negocio administra la **ENTREGA** de lo que
ya vendió: un kanban por producto, con columnas que son las etapas de ese servicio. Y de
ahí cuelgan dos cosas que nacieron en esta ventana:

- **El CURSO**: las clases que el negocio le da a sus clientes. El negocio las edita en
  `/customer-success/curso`; el cliente las ve en un **portal personal** que se abre con un
  link firmado (`/compartido/curso/<token>`) o con su propia cookie (`/mi-curso`), **sin
  tener cuenta de MaKo**.
- **La COMUNIDAD**: un foro tipo Skool **por producto** (`/customer-success/comunidad` para
  el equipo del negocio; adentro del portal, para el alumno). Categorías, posts,
  comentarios, likes que son puntos, niveles, ranking, calendario de eventos, campana de
  notificaciones, moderación y una página «About».

«Alumno» = un cliente del negocio con acceso al curso. «Entrega» = la parte post-venta.
«Lead» = la ficha de una persona en el CRM; un alumno siempre es un lead ganado.

## Las cuatro pantallas, y dónde vive cada una

| Ruta | Quién entra | Archivo que manda |
|---|---|---|
| `/customer-success` | el equipo del negocio | `app/customer-success/page.tsx` · `KanbanEntrega.tsx` |
| `/customer-success/curso` | el equipo (editor del curso) | `app/customer-success/curso/CursoApp.tsx` |
| `/customer-success/comunidad` | el equipo | `app/customer-success/comunidad/page.tsx` |
| `/compartido/curso/<token>` y `/mi-curso` | **el alumno, sin sesión de MaKo** | `app/compartido/curso/[token]/PortalAlumno.tsx` |

El dibujo del curso es **UNO** y lo comparten el editor, el portal del alumno y la tab
Conocimientos: `app/_cursos/CursoUgc.tsx`.

---

## ★ Para la reunión de cierre de Customer Success: viernes 16/10, 4 PM de México

Se lee en cinco minutos. Medido el 13/10/2026; lo que no se midió, lo dice.

### Lo que quedó CERRADO en la etapa

- **El curso vive en MaKo**: el negocio lo arma en la tab Curso y el alumno lo ve en un portal
  personal, con su link, **sin cuenta de MaKo**. Whop salió del producto.
- **Módulos y candados**: cada etapa del kanban es un módulo, y además hay módulos sueltos. Un
  módulo o una clase se abre al llegar a su etapa, al terminar el anterior, N días después de
  entrar, en una fecha, con la tarea de otra clase, con un nivel de la comunidad o a mano.
- **El goteo atado al kanban, VERIFICADO DE PUNTA A PUNTA el 13/10 en el ws3** (lo que va a probar
  Mauricio, ver abajo): mover la tarjeta abre la etapa en el portal, y mandar las tareas
  obligatorias de la etapa mueve la tarjeta solo y abre la siguiente.
- **La comunidad tipo Skool** por producto (posts, comentarios, niveles, ranking, eventos,
  moderación) y los comentarios por clase.
- **El acceso por producto**: cada alumno ve sólo los cursos a los que se lo invitó.
- **La invitación** por mail (con el remitente del negocio) y, si se elige, por WhatsApp.
- **El editor**: la lección se guarda a mano con aviso al salir, papelera con Deshacer, tareas en
  contenedores con quiz, escala, archivos, audio y agenda, videos por embed.
- **El nombre del curso sale de su OFERTA** (13/10) y **nunca del producto, que es el CRM** (14/10):
  sin título ni oferta, el alumno ve «Tu programa» y el equipo «Curso sin nombre». Vale también para
  la comunidad, la ficha, el mail y la API.

### Lo que FALTA

- **Decisiones de Martín**: las de §6 (Leandro, Brigitte, el PAS, Teresa, las correctas del quiz,
  «+ Nuevo campo», reabrir el tutorial, fuente en Conocimientos, autoplay de Panda, ideas).
- **Que alguien lo vea en la pantalla**: todo se verificó con las funciones reales o en bancos de
  prueba, nunca clickeando la app andando. Desde el 13/10 hay con qué: el fixture del ws3 (abajo).
- **De otros chats**: la invitación al ganar en un producto agregado, el **CRM**. (CURSOS ya hizo el
  buscador de leads en cualquier etapa al invitar —pestaña «Del embudo»— y el mail que nombra el
  curso por su oferta, el 13/10.)
- **Las ventas no son código**: el upsell a Teriyaki y los tres upsells de Mauricio son tareas suyas
  de venta, y las carga el Perro Guardián.

### Para la prueba de Mauricio del goteo (Fathom 858473424 @30:53)

- **Cómo se configura**: tab Curso → el «…» del módulo → «Público | Privado». Un módulo que es una
  etapa del kanban arranca en **Privado → «Se abre: Al llegar a su etapa»**: no hay que tocar nada
  para que el kanban libere.
- ⚠️ **Si elige «Público», se abre para todos sin mirar la etapa**; y si en Privado elige otra
  condición («A mano», «Días después de entrar»…), **la etapa deja de importar**: llega la tarjeta
  y sigue cerrado. Medido: con «A mano» quedó cerrado estando en su etapa.
- ⚠️ **Mover la tarjeta HACIA ATRÁS vuelve a cerrar** lo de adelante (el estado sale de la posición).
- ⚠️ **Que pruebe con un cliente de prueba, no con uno real**: en el ws1 el WhatsApp está prendido,
  y mover una tarjeta enrola en las secuencias de entrega de esa etapa (si tiene), y completar una
  etapa le avisa al alumno por WhatsApp. En el ws3 ese aviso no salió («envío de WhatsApp
  apagado»). Lo del ws1 está heredado de un briefing anterior; no lo volví a medir.
- **El fixture del ws3** (Cliente de Prueba): producto 43 «Prueba goteo kanban» (oferta 16, embudo
  30), alumno lead 2664 «Alumno de prueba goteo» (sin teléfono ni email: no le sale nada), clases
  165 (Onboarding, obligatoria con una tarea ya enviada), 166 (Arranque) y 167 (Hito 1). Hoy está
  en «Arranque».

---

## 0. 13/10/2026: lo planificado que se cerró, y lo que sigue

Pedido de Martín (por «Estrategia 3 CUENTAS»): «dile a esos chats que continúen y cierren lo que ya
habíamos planificado». Cerrado, cada cosa con su test probado rompiéndolo:

- ✅ **`app/_ui/Modal.tsx`, el arreglo de raíz del foco** (`onCerrar` por ref, foco cuando la capa se
  ve, `data-autofocus`): los nueve diálogos que perdían el foco letra por letra se arreglan sin
  tocarlos. `tests/modal-foco.test.ts`.
- ✅ **`InvitarAlCurso` / `InvitarAlumnos`** con `useCerrarEstable`, y el foco al abrir con
  `useFocoInicial`.
- ✅ **Un solo scroll en la lección del editor** (`CursoApp` → `<CursoUgc unSoloScroll>`).
- ✅ **La ficha numera las tareas que ve el alumno** (`gruposPorTarea` con la consigna y `tareaVacia`).
- ✅ **«Comentar en la comunidad» exige el post pedido** (o un fijado que no sea hilo de clase).
- ✅ **Borrar la clase ABIERTA con cambios sin guardar pregunta antes.**
- ✅ **«Permisos del curso» dice «No se le abrió este curso.»** en un curso que el acceso no abre.
- ✅ **El STT de los cursos pasa el detector de bucles** (`lib/transcribe.ts`, los tres pedidos).
- ✅ **El `vive[]` del área** declara lo que faltaba (la deuda de registro de abajo).

El detalle, en `docs/hallazgos-customer-success.md` → «Lo que quedó planificado y se cerró el
13/10/2026». **Nada de esto se abrió en la app real** (el ws3 sigue con 0 productos).

**Sigue SIN hacer, a propósito:** las imágenes huérfanas de un borrador descartado (borrar de
storage sin prueba con datos), la portada de un módulo vinculado sin candado que se elimina, la
vista previa de «Comentar», el código muerto, y la revalidación de las acciones inmediatas
(parpadea el editor). Ninguno espera a Martín.

⚠️ **La negrita del curso en Arial NO es una decisión**: era un 404 de 38 fuentes copiadas del
origen, y la sesión de Conocimientos lo está cerrando el 13/10 (`docs/hallazgos-conocimiento.md` →
«La hoja del curso pedía 38 fuentes…»). Se sacó de la lista de §6.

---

## 1. En qué quedó

**El área está quieta desde el 09/10/2026 a las 16:09.** Medido: `git log
6785dc16..HEAD -- app/customer-success app/_comunidad app/compartido 'lib/curso*.ts'
'lib/cs-*.ts'` no devuelve **ni un commit del 10/10**. Los **76 commits del 10/10**
(`git log --since='2026-10-10 00:00' --oneline | wc -l`) fueron de Automations, CRM,
Referidos y Strategy — ninguno de acá. Y todo lo del área **está en
`origin/main`** (`git merge-base --is-ancestor 594a31fb origin/main` → sí).

⚠️ **Pushear no es desplegar.** Que esté en `origin/main` no prueba que Vercel lo haya
compilado: eso se confirma con `vercel ls`. **No lo verifiqué.**

Los 19 commits del área, con su migración, todos en `main`:

| Commit | Fecha | Qué dejó | Migración |
|---|---|---|---|
| `42d91a41` `9b5a4c9b` `a9d4471c` | 05/10 | acciones en lote, tabla del Plan, el deshacer que devuelve el reloj de la etapa, un solo menú de etapas | — |
| `41566563` | 05/10 23:27 | casilla del CRM, fases al filtro, editor nuevo, ficha por pestañas | — |
| `b7a72267` `dac568b9` | 06/10 | clientes **por producto**, la ficha con las tabs del CRM, editor por cajas, la foto del cliente | — |
| `d9ee19cd` | 06/10 03:42 | «quitar de un producto» y el orden manual | **0196** |
| `eba4f12f` `d57bed5e` | 06/10 12:38 | **el curso nace**: tab Curso, portal del cliente, la ficha, paso de etapa por tareas. Whop sale del producto | **0202** |
| `c0e2570b` | 06/10 18:20 | el alumno entra con **su cookie**, nunca con sesión de MaKo | **0206** |
| `54e31272` `ab81f03f` | 06/10 23:40 | las llamadas de entrega se analizan, el curso se anota y se limpia, el choke point deja de mentir | **0208 0209 0210** |
| `f6b33ed0` `823b7122` | 07/10 01:28 | cartera con señal, «Sin cobro», recordatorio de clases, el bucle de #665 | **0211 0212 0213** |
| `70a207df` | 07/10 16:30 | el portal y la tab Curso con el diseño de Conocimientos | — |
| `5cbaedbb` | 07/10 18:44 | la tab **sin barra** y el curso personalizable (color, portadas, títulos) | **0214** |
| `1080f74c` | 08/10 02:35 | **curso tipo Skool, tanda 1**: la comunidad entera, tipos de tarea, invitar y permisos con link mágico, editor rico, portadas diseñadas, recorrido | **0216 0217 0218 0219** |
| `bccbebae` | 08/10 07:26 | **tanda 2**: módulos, candados, arrastre, la lección editable en su lugar, el portal, Conocimientos editable | **0220** (+0221) |
| `d188f3a8` | 08/10 10:24 | **los 20 ajustes de Martín**: la lección, la tarea, el editor, los menús, la papelera con Deshacer, dos tutoriales | **0223_curso_papelera** |
| `dbae4da9` | 08/10 15:06 | **feedback del audio del 08/10**: la lección se guarda a mano, la tarea en contenedores, videos y agendas por embed, comentarios de clase, el STT que contaba un bucle | **0226 0227** |
| `594a31fb` | 09/10 16:09 | **acceso por producto**: cada alumno ve sólo los cursos a los que se lo invitó. Más la vista del alumno (quiz que dice el resultado, un scroll, pie «Este curso es personal»), el borrador al invitar, el correo configurable ahí mismo, el teléfono opcional, y el foco que se perdía al tipear | **0232** |

Y seis commits **de otras sesiones** tocaron archivos del área el 09/10 a la tarde, sin
pedirlo nadie de acá (son barridos de toda la app, y hay que saberlo porque aparecen en el
`git log` del área): `16942e70` (la tarjeta dice cuándo nadie puede entrar), `71690b4b` (el
tacho de borrar, rojo), `06fc917c` y `abc88da0` (íconos en menús y desplegables),
`042eaf26` (**grabar audio en la tarea del alumno**, `TareaAlumno.tsx`, +123 líneas),
`04f40af4` (el renombre de /chatbot a /automations tocó `EtapasEntregaModal.tsx`).

**Medición propia, 10/10/2026:** los 70 archivos de test del área
(`tests/curso*.test.ts tests/cs-*.test.ts tests/comunidad-*.test.ts` + 5 más) dan
**1067 pass, 0 fail**, en 30,9 s.

---

## 2. Lo que NACIÓ en la ventana (el 05/10 no existía nada de esto)

1. **El curso adentro de MaKo** (06/10, `eba4f12f`). La decisión grande: **el curso vive en
   MaKo y Whop salió del producto**. Whop era la plataforma externa donde estaba el programa;
   hoy es historia (`ab81f03f`).
2. **El alumno sin cuenta de MaKo** (06/10, `c0e2570b`). Tiene su propia cookie
   (`mako_alumno`), **nunca** `mako_session` ni fila en `usuarios`.
3. **La comunidad entera** (08/10, `1080f74c`, mig **0217**): 12 tablas de una sola vez
   (`comunidad_ajustes`, `_categorias`, `_posts`, `_comentarios`, `_likes`, `_votos`,
   `_perfiles`, `_notificaciones`, `_seguimientos`, `_baneos`, `_eventos`,
   `_evento_avisos`). 18 componentes en `app/_comunidad/` y 10 módulos `lib/comunidad-*.ts`.
4. **Módulos y candados** (08/10, mig **0220**): `curso_modulos`, `curso_desbloqueos`, el
   `bloqueo` por clase. Un módulo puede no ser una etapa del kanban.
5. **La papelera** (08/10, mig **0223_curso_papelera**): borrado suave con `borrada_at` /
   `borrado_at`, y **todas** las lecturas de clases filtran por eso.
6. **Las entregas del alumno** (08/10, mig **0218**): bucket privado `curso-entregas`,
   100 MiB por archivo, y la nota de los quizzes en `curso_progreso.calificacion`.
7. **El acceso por producto** (09/10, mig **0232**): `curso_accesos.productos` dice qué
   cursos abre cada acceso. **`NULL` = todos**, que es como funcionaba antes.
8. **El análisis de las sesiones de entrega** (06/10, mig **0209**): `closing_analyses` con
   `analysis_version = 3` para riesgos y próximos pasos de una junta de entrega (#107).

---

## 3. Lo que quedó a medio hacer o SIN VERIFICAR, con el archivo

### Lo que nunca se vio en la app real (lo más grande)

⚠️ **Nada del acceso por producto (09/10) se abrió en la app real.** Ni el modal de invitar
con su borrador, ni el correo embebido, ni la lista desde el curso, ni la tarjeta, ni
Avance, ni la ficha por producto. Y los 20 ajustes del 08/10 y el feedback del audio
tampoco. Se verificó en bancos de prueba y con Chromium apuntando a un dev server, **nunca
en el producto andando**. El motivo está medido: el ws3 («Cliente de Prueba», el workspace
donde se puede romper cosas) tiene **0 productos**, y el único con datos es el **ws1, que es
de Mauricio Bustos — un CLIENTE real**.

### Arreglos escritos y no aplicados, con las líneas exactas

- ✅ **CERRADO EL 13/10 (ver §0).** ~~**`app/_ui/Modal.tsx` — el arreglo de raíz del foco. VERIFICADO HOY QUE SIGUE SIN HACER**
  (`app/_ui/Modal.tsx:152` todavía dice `}, [onCerrar, arriba]);`). El efecto de foco
  depende de `onCerrar`, así que un `onCerrar={() => …}` nuevo en cada render lo re-dispara
  con cada tecla y **el campo pierde el foco letra por letra**. El parche exacto (dos
  partes, con el código línea por línea y medido en un banco) está en
  `docs/hallazgos-customer-success.md` → «El feedback del audio del 08/10 a la noche» →
  «Lo que quedó SIN hacer». Mientras tanto el mismo bug vive, **medido**, en
  `app/customer-success/CuentaDeMaKo.tsx:217` («Abrir cuenta»: tipear «ana@x» deja «a» —
  verifiqué que la flecha sigue ahí), y con la misma forma y **sin medir** en
  `AdminView.tsx:1025`, `EditarObjetivo.tsx:94` y `:172`, Pricing, CampanasBrowser, CrmBoard
  y VideoGeneratorApp. El workaround del área es `useCerrarEstable`
  (`app/customer-success/curso/dialogo-foco.ts`), hoy puesto en sólo 3 diálogos:
  `NuevoProducto.tsx`, `QuitarEtapa.tsx`, `LeccionEditable.tsx`.~~
- ✅ **CERRADO EL 13/10** para los dos de Invitar; `PortadaPicker` y `Dropdown` siguen sin medir.
  ~~**`InvitarAlCurso.tsx:136` y `InvitarAlumnos.tsx:163`** siguen con
  `alCerrar.current = onCerrar;` **en el cuerpo del render** (verificado hoy): eslint lo
  marca y va `useCerrarEstable`. Y en `InvitarAlCurso.tsx:139-144` el foco al abrir no llega
  al campo (medido por la sesión anterior): va `useFocoInicial(id)`. Mismo patrón, sin
  medir: `PortadaPicker.tsx:243-277` y `Dropdown.tsx:704-738`.~~
- ✅ **CERRADO EL 13/10.** ~~**El editor de la tab Curso tiene DOS scrolls en la lección.** Verificado:
  `app/customer-success/curso/CursoApp.tsx:1112` monta `<CursoUgc` y **no** le pasa
  `unSoloScroll`, el prop que ya existe (`app/_cursos/tipos.ts:405`) y que el portal del
  alumno sí usa (`PortalAlumno.tsx:314`). Es pasárselo.~~
- ✅ **CERRADO EL 13/10 lo que mentía**: «Permisos del curso» ya no dibuja «Todos los módulos» en un
  curso que el acceso no abre. Sacar UN curso del acceso sigue siendo «Quitar de este producto» o
  «Cortar acceso». ~~**La ficha del cliente no muestra qué cursos abre el acceso**, ni deja sacar uno salvo con
  «Quitar de este producto» o «Cortar acceso». El dato ya viaja hasta la pantalla
  (`accesoParaPantalla.productos`; el componente es `Permisos` en
  `app/customer-success/FichaCurso.tsx:602`).~~
- **La invitación al ganar, en un producto AGREGADO: SIN MEDIR.** Con el producto puesto, si
  el lead no tiene fila en `cliente_entrega` de ése, el núcleo contesta «No es cliente de
  ese producto» y no invita (`lib/crm-curso-al-ganar.ts`). Antes invitaba a lo que veía.
- **La foto subida en la vista de agencia queda en la carpeta del que mira**
  (`/api/perfil/avatar` arma la ruta con la sesión). Se ve bien; el archivo no es «de» la
  cuenta.
- **Los otros lectores de `getPerfil`** (el usuario del menú en /plan y /customer-success, el
  guion del audio) ahora muestran al cliente en la vista de agencia. **No se miraron uno por
  uno en el navegador.**

### Datos de producción que NO pude medir (no tengo acceso a la base; lo heredo del briefing anterior y va MARCADO)

- **`envio_whatsapp_enabled` del ws1 estaría en TRUE** (afirmado el 06/10). Si es cierto,
  mover a un cliente por el camino automático del curso **le manda un WhatsApp real a una
  persona real**. **Hasta comprobarlo, no se prueba nada sobre el ws1 que dispare mensajes.**
- **El ws1 tendría 107 clases cargadas** y 13 marcadas por área (afirmado el 06-07/10).
- **La fila de acceso de Leandro** (ws10, lead 2625, `curso_accesos.id = 5`) seguiría
  abriendo **los DOS cursos**: es un `productos = NULL` ya usado, y ninguna invitación nueva
  lo acota (`yaSeLeDio`, `lib/curso-invitar-reglas.ts`). Afirmado el 09/10.
- **El acceso de Brigitte Eberlin (ws15)**: `usuarios where workspace_id = 15` daba **0** el
  09/10, y su email **no está en ninguna columna de texto de la base**. No hay a quién
  mandarle la invitación, y por eso nunca salió. **Falta que alguien consiga su email.**
- **El análisis de las llamadas de entrega (#107) no habría analizado ninguna todavía**:
  `gemini-flash-latest` contestaba 503 («high demand») desde el 07/10. Se comprueba mirando
  `closing_analyses` con `analysis_version = 3`.
- **La clienta del ws1 en la etapa «onboarding»** (Teresa, lead 21) está en una etapa que su
  producto no tiene. La causa (el choke point validando contra las etapas de FÁBRICA con el
  catálogo sin leer) ya está arreglada; **dónde ponerla la decide Martín**, y se mueve con un
  clic desde su ficha.

### Deuda de registro (verificada hoy) — ✅ CERRADA EL 13/10 (`app/admin/dev/areas.ts`)

**Cuatro archivos del último commit no están declarados en el área**, así que
`/admin/dev/customer-success` no ve ese trabajo. Medido con `grep -c` sobre
`app/admin/dev/areas.ts`: `supabase/migrations/0232_curso_accesos_productos.sql` → 0,
`lib/curso-invitar-reglas.ts` → 0, `app/customer-success/curso/dialogo-foco.ts` → 0,
`docs/feedback-curso-08oct-noche.md` → 0. El `vive[]` del área arranca en
`app/admin/dev/areas.ts:422`.

---

## 4. Las trampas del área (las que más tiempo ahorran)

1. ⚠️ **El alumno NUNCA recibe `mako_session` ni una fila en `usuarios`.** Está medido: con
   una fila, **leía el CRM de Mauricio**. Tiene su cookie propia, el proxy no la toma por
   sesión, y lo único que abre es `/mi-curso`. **Si alguien propone «darle una cuenta de MaKo
   con rol de alumno», es esto lo que rompe.** El porqué, en `lib/alumno-sesion.ts`.
2. ⚠️ **Verificar esta tab ESCRIBE en producción**, y bootear local también (local apunta a
   la Supabase de PROD). Abrir la pestaña Curso de un cliente le **CREA** su fila de
   `curso_accesos`, y abrir el portal le **cuenta un ingreso**: de los 6 ingresos del lead
   2625, hasta 5 son de mediciones.
3. ⚠️ **El reparto de clientes en columnas es DERIVADO**: un cliente **sin** fila en
   `cliente_entrega` está en la PRIMERA etapa. Toda función que aplique esa regla necesita
   el **universo de clientes**, no las filas de la tabla — pasarle `Object.values(<mapa de
   filas>)` hace que el editor diga «0 clientes» al lado de 5 tarjetas dibujadas, y con ese
   0 **la columna se borra sin preguntar**.
4. ⚠️ **HAY DOS MIGRACIONES CON EL NÚMERO 0223**: `0223_curso_papelera.sql` (de esta área,
   `d188f3a8`) y `0223_flujo_grafo.sql` (de Automations). Las dos están en `main` y las dos
   dicen «ANTES del deploy». Es exactamente la colisión que AGENTS.md advierte, y pasó.
   **Y el próximo número del área NO es 0233**: el repo ya tiene 0233 y 0240-0245 de otras
   áreas. Antes de nombrar una, `git pull` y `ls supabase/migrations/ | tail -5`.
5. ⚠️ **Los templates de estilos de `KanbanEntrega.tsx` y `EtapasEntregaModal.tsx` no
   admiten NI UN backtick**, ni en un comentario: cierra la cadena a la mitad y el typecheck
   señala otra línea.
6. ⚠️ **Apagar «Etapa del kanban» QUITA la etapa y mueve a sus clientes en silencio.** Eso
   se construyó el 08/10 (`d188f3a8`) y **no se probó en la app real**.
7. ⚠️ **Antes de declarar ajeno un hunk, grepeá qué TEST lo nombra.** El 06/10 se dejaron
   afuera dos arreglos de `app/api/admin/agencia/*` por «no ser del curso», y los delató un
   test del curso que los cuidaba.
8. **Trampas de verificar con Playwright en este área** (cada una costó minutos y se lee
   como un bug del código):
   - `route.continue({ headers: { 'sec-fetch-dest': 'empty' } })` **no pisa
     `sec-fetch-dest`** en Chromium. Lo que funciona es pedir el documento con `route.fetch`
     desde Node, con «preview» en el user-agent, y servirlo con `route.fulfill`.
   - Un documento servido con `route.fulfill` hace que **Local Network Access bloquee el
     websocket del HMR**: la página queda en «Abriendo el curso…» para siempre, sin un solo
     error. Se lanza con
     `--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests`.
   - En headless, con la página recién cargada, **el primer `requestAnimationFrame` llega
     570 ms tarde**: un banco de foco se abre con un clic, nunca montado al cargar.
9. ⚠️ **Si el portal entero contesta «No pudimos cargar tus clases»**, antes de diagnosticar
   un portal caído: `git status` de `lib/curso-datos.ts` y comprobar que la columna que lee
   exista en `information_schema`. Una lectura nueva en el árbol con su migración sin aplicar
   tira el portal completo.
10. ⚠️ **Cinco `tsc` a la vez llevaron el typecheck a 35 minutos**, y el lock se vence a los
    10. Lo que alcanza es un tsconfig acotado en el scratchpad: `files` con los archivos
    tocados, `include: []`, `incremental: false` y `plugins: []` (1509 archivos, ~1,5 min).

---

## 5. Lo que el briefing viejo decía mal (corregido con su prueba)

| Lo que decía (09/10 16:09 o antes) | La verdad, medida el 10/10/2026 |
|---|---|
| «Los archivos están en `git status` (tres pistas y el cierre): **commitear por ruta**» | **Ya se commitearon**: `594a31fb`, 09/10 16:08:46, 45 archivos. `git status` del área está limpio |
| «Espera a Martín: **`lib/resend.ts:37`**, leer la key de MaKo con `envCred`» | **Hecho por la sesión de Integraciones**: `3677e675`, 09/10 15:50:44. Verificado en `lib/resend.ts:47` → `await envCred('RESEND_API_KEY')` |
| «**`tests/crm-auto-asistencia.test.ts` está ROJO** sobre el árbol compartido» | **Verde**: 5 pass / 0 fail, corrido hoy |
| «Un archivo vacío llamado **`=`** en la raíz del repo; no lo borres sin preguntar» | **Ya no existe** (`ls '='` → No such file or directory) |
| «**`app/_cursos/` tiene CERO `import`**, se dejó afuera a propósito, su cabecera miente» | **Falso desde el 07/10** (`70a207df`): lo importan 20+ archivos y es el dibujo único del curso |
| «Falta que lo monte Conocimientos (**`CursoReplica`**, que sigue con su copia)» | **Hecho el 08/10**: `CursoReplica.tsx` pasó a ser `app/conocimientos/CursoConocimientos.tsx`, que monta `CursoUgc` (ver su cabecera, líneas 12 y 26) |
| «Último pedido: la tab Curso sin barra y personalizable» (fechado 07/10 18:45) | **Hecho a las 18:44 de ese mismo día**: `5cbaedbb`, mig 0214 |
| «`envio_whatsapp_enabled` del ws1 apagado desde el 29/09» | Corregido ya el 06/10: estaría en **TRUE**. Sigue **sin verificar** por mí |

---

## 6. Qué espera una decisión de Martín

1. **La fila de acceso de Leandro** (ws10, lead 2625) abre los dos cursos y no se achica
   sola. Dos opciones: (a) la línea SQL —
   `update curso_accesos set productos = '{39}' where id = 5 and workspace_id = 10 and
   lead_id = 2625 and area is null;` — o (b) «Quitar de este producto» en Service Delivery
   (producto 10). En los dos casos conviene que **pruebe con un alumno NUEVO**, porque un
   `NULL` ya usado no se acota. Y el «Entró N veces» de esa fila subió por las mediciones:
   corregirlo es otra escritura, también suya.
2. **El acceso de Brigitte Eberlin (ws15)**. Hace falta **su email**, que no está en la
   base. Con él hay dos caminos: Joan (la agencia, ws13) desde la tarjeta → «Acciones» →
   «Pedir sumar a alguien», y Martín aprueba; o Martín directo desde la ficha → Equipo →
   «Sumar y mandarle el acceso». Después se verifica `invitacion_enviada_at` en su fila.
3. **El PAS fuera de orden.** El kanban pone la etapa PAS tercera y la planilla de Mauricio
   la pone después de Tablero y Ritmo. Se arregla moviendo la etapa en el editor (las clases
   viajan solas). **Lo decide él.**
4. **Dónde va Teresa** (ws1, lead 21), hoy en una etapa que su producto no tiene. Se mueve
   con un clic desde su ficha.
5. **Las respuestas correctas de un quiz**: hoy se muestran sólo con el quiz cerrado y
   **nunca por área** (default puesto por la sesión anterior, sin confirmar). Lo mismo para
   un quiz reabierto (`darOtroIntento`, `lib/curso-entregas.ts`): las de un reabierto ya se
   ven. **Confirmar o cambiar.**
6. **La ficha mira la invitación desde el curso elegido** (otro default sin confirmar).
7. **«+ Nuevo campo»**: Martín lo pidió ARRIBA a la mañana del 08/10 y la prueba de la tarde quiere
   los campos nuevos ABAJO. Hoy nace abajo. **Confirmar.**
8. **El recorrido del curso conserva la clave `cs-curso`**: quien ya lo vio no ve los pasos nuevos
   solo (sí con el «?»). Cambiar la clave (`recorridos-curso.ts`) se lo reabre a todos. **¿Se reabre?**
9. **La fuente en Conocimientos** (el selector que ya tiene la tab Curso) necesita una migración (el
   CHECK de `conocimiento_ajustes.campo`). **¿Se hace?**
10. **Un Panda insertado en la descripción arranca solo** si la cuenta de Panda del negocio tiene el
    autoplay prendido. Es de Panda, no nuestro. **¿Se fuerza apagado?**
11. **Ideas sin pedido, para decidir si se hacen**: el diseño del mail de invitación; el
   Curso como pestaña de la comunidad (a Leandro le gusta separado, no hay pedido); los
   niveles del ranking, que hoy salen sin configurar; crear el grupo de WhatsApp del curso
   desde MaKo.
12. **Del audio del 08/10 a la noche quedan los puntos 13, 14 y 15** (el correo con
   Google/Gmail entre ellos): **son de Integraciones**, no de acá.
13. **La oferta que nace junto con un CRM se llama como el CRM** (`crearProductoConFunnel` crea los
    tres con el mismo nombre), así que un curso nuevo hereda el nombre del CRM por ahí. ¿Esa oferta
    puede nombrar el curso, o el curso queda «sin nombre» hasta que alguien la renombre en Offer?

---

## Lo que había en el árbol sin commitear cuando escribí esto (10/10/2026 19:20) — NO es mío

Hay otras sesiones trabajando sobre este mismo clon. Al momento de escribir, `git status`
mostraba, **todo ajeno**, de la sesión del CRM: `app/crm/CrmBoard.tsx`,
`app/crm/CrmToolbar.tsx`, `lib/campana-atribucion.ts`, `tests/crm-filtro-ads.test.ts`,
`app/crm/arbol-seleccion.ts` (nuevo) y `docs/relevo/chatbot.md`. **No los toqué.** Uno
importa acá: `CrmBoard.tsx` es uno de los archivos que arrastran el bug de foco de
`app/_ui/Modal.tsx`, así que si alguien arregla Modal de raíz, ese archivo puede estar a
medio escribir por otro — se mira `git status` de la ruta **en su propio comando** antes de
tocarla.

## Dónde está lo demás

- **La cosecha completa del área** (síntoma → causa → regla, 5.300 líneas):
  `docs/hallazgos-customer-success.md`. **No lo abras entero** (~17.000 tokens): cada entrada
  trae `**Vive en:** <archivo>`, así que se busca con `Grep` de la ruta que te importa.
  Las secciones de esta ventana arrancan en «El kanban de la ENTREGA de un servicio
  (05/10/2026)» y la última es «No se le envió la invitación a Brigitte (09/10/2026)».
- **Las fuentes literales de los pedidos**: `docs/feedback-curso-08oct.md`,
  `docs/feedback-curso-08oct-noche.md`, `docs/diseno-curso-skool.md` (el diseño, con las
  decisiones D1-D8), y la bitácora de `/admin/dev/customer-success`
  (`app/admin/dev/customer-success/bitacora.ts`), cuyo último hito es del 9 oct 16:08.
- **El índice de todos los chats** (lo que contesta «¿en qué estuve trabajando?»):
  `docs/relevo/chats.md`, escrito el 10/10 19:05 por el hook de cierre de otra sesión. Ojo:
  ese commit (`a6481b4d`) **está sin pushear**.
- **Las reglas que gobiernan código nuevo** salieron a `AGENTS.md`: «Todo `<Modal>` recibe un
  `onCerrar` de identidad FIJA», «Una regla DERIVADA necesita el UNIVERSO, no las filas», «Si
  una fila de una tabla compartida pasa a significar OTRA cosa, cada LECTOR decide».
