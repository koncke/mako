# Retomar: Instagram afuera y el curso del servicio dentro de MaKo

**Qué cubre.** Dos cosas que no tuvieron chat propio y que son las dos decisiones de
producto YA tomadas: **Instagram salió del producto** (la tab, su API y su integración) y
**el curso del servicio de Mauricio volvió ADENTRO de MaKo** (con Whop afuera). Se suma el
aviso del **tope de 2 cuentas de Zernio**, porque se escribió y se borró en esta misma
ventana.

**Ventana:** del commit `6785dc16` (05/10/2026 12:33) a `de64b5b7`. **Todo pusheado**
(`git log origin/main..HEAD` vacío) y **producción Ready** (`vercel ls` el 06/10: el último
deploy, 35 min antes del cierre).

> ⚠️ **El árbol NO está limpio, y lo sucio no es de esta área ni es mío.** Hay otras
> sesiones trabajando sobre este clon. Lo que toca al curso está en el punto 3.

---

## 1. En qué quedó

### Instagram afuera (#792) — `8d16c6ff` (06/10 14:23) + `74e1f5e7` (06/10 14:45)

Decisión de Martín del 06/10: **«C: sacar la tab»** — entera, la bandeja de DMs **y** el
programador de publicaciones. Lo que la justifica, medido ese día en producción (sólo
lectura): **0 filas en `ig_conversaciones`, `ig_mensajes` y `contenido_posts` en toda su
historia**, 0 propuestas de MaKo de Instagram, y dos workspaces (**ws11 y ws13**) que
llegaron a conectar Zernio.

Lo que se fue: la entrada del nav · `app/instagram/` (las pantallas) ·
`app/api/instagram/enviar` · `lib/ig-chatbot.ts` · `lib/ig-contenido.ts` · `lib/zernio.ts` ·
las **21 operaciones** del área `instagram` de la API de MaKo y `crear_borrador_instagram`
(**14 operaciones menos por `/api/v1`**, con `docs/api-mako.md` y el snapshot de HTTP
regenerados) · el onboarding de la tab y el paso «Tu cuenta de Instagram» de Reels,
Carousels y Stories · **Zernio de los cuatro registros de una integración** (tarjeta,
campos, ping, logo) · el área `instagram` de `areasDelMensaje` y de los dos `ORDEN_CONFIG`.

Lo que **queda a propósito**:

| Qué | Por qué |
|---|---|
| `/instagram` **redirige** a `/chatbot`, con `rutaConWs` (`app/instagram/page.tsx`) | Hay links viejos afuera del repo: marcadores, avisos ya mandados, el `redirect_uri` del OAuth de Zernio. Un 404 ahí es peor. |
| El webhook de Zernio contesta **200 sin procesar nada** y deja un `console.info` con el motivo (`app/api/webhooks/zernio/route.ts`) | La URL puede seguir registrada del lado de Zernio: un 404 o un 5xx lo haría **reintentar 7 veces con backoff por evento, para siempre**. Y un 200 mudo no distingue «no llegó» de «lo tiramos nosotros». |
| Las **tablas** (sin migración de drop) y su scoping en `TENANT_TABLES` / `lib/tablas-de-inquilino.ts` | Si Instagram vuelve, vuelve con sus datos. |
| Reels, Carousels y Stories **siguen vivos como writers** | «Enviar a publicación» pasó a **«Copiar»**: la pieza se sube a mano. |

**La segunda pasada (`74e1f5e7`) es la que importa leer.** La fuente de KPI
`contenido_publicado` contaba `contenido_posts` con estado `publicado` — filas que **sólo**
escribía el programador borrado — así que **daba 0 para siempre**, y `CANDIDATOS_KPI` la
sembraba como KPI **automático** con 7 por semana a los negocios con cuello `foco` o
`delegacion` (en `delegacion`, primera): un KPI que nace en rojo por un problema nuestro.
Medido en producción: 0 KPIs la usaban y la tabla tenía 0 filas, así que no le pasó a nadie.
Se fueron la fuente, su lector, su capacidad en `lib/focus.ts`, su entrada en
`FUENTES_BORDE_UTC` y el candidato. En la misma pasada: Carousels dejó de decir «Imágenes
SOLO en JPEG» (era el tope de la API de publicación de Zernio; subido a mano, acepta PNG) y
`lib/setting-simulador.ts` dejó de nombrar Instagram como el modo asistido del setter.

**El guard: `tests/sin-instagram.test.ts`**, 7 tests, probado rompiéndolo con siete roturas
(cada una 5/1 cayendo exactamente el test que la cuida, restaurado 6/0). **Lo volví a correr
sobre `de64b5b7` el 06/10: 7/7 en verde**, junto con `tests/sin-whop.test.ts` (3/3) → **10
pass / 0 fail**. Si Instagram vuelve, este archivo falla hasta que alguien lo decida.

Registro: `app/admin/dev/areas.ts` reescribió el alcance del Chatbot (**sólo WhatsApp** por
la línea no oficial) y el área `instagram` quedó con su nota de retiro (`:287-291`).
`AGENTS.md` suma el párrafo «y el Chatbot es SÓLO WhatsApp».

### El curso del servicio, adentro de MaKo — `eba4f12f` (06/10 12:38) + `d57bed5e` (06/10 13:00)

⚠️ **Esto cierra la decisión grande que el relevo anterior daba por abierta.**
`docs/relevo/customer-success.md` decía que el programa de Mauricio «salió del producto
entero el 26/09» y que «**dónde vive ahora SIGUE SIN DECIDIR**». Se decidió el 06/10: **vive
en MaKo, colgado de las etapas de la entrega, y Whop sale**. El pedido literal de Martín (7
puntos, incluido «**implementa todo esto, no preguntes**») quedó sin resumir en
`app/admin/dev/customer-success/bitacora.ts`, hito «6 oct 12:38».

El modelo, en una línea: **cada clase cuelga de una ETAPA de `producto_entrega`**, así que
«la próxima etapa tiene tutorial» es una consulta y pasar de etapa usa el choke point que ya
existía (`moverClienteDeEtapa`, con `por: POR_MAKO`).

| Qué | Dónde vive |
|---|---|
| Las tablas y el bucket privado `curso-videos` | `supabase/migrations/0202_curso.sql` — **el commit la reporta aplicada a prod; no lo verifiqué desde acá** |
| Reglas puras | `lib/curso.ts` · `lib/curso-avance-regla.ts` |
| Lecturas y escrituras | `lib/curso-datos.ts` · `lib/curso-admin.ts` · `lib/curso-portal.ts` · `lib/curso-avance.ts` |
| El acceso firmado | `lib/curso-acceso.ts` |
| Los mensajes | `lib/curso-mensajes.ts` + `lib/curso-mensajes-texto.ts` |
| La tab | `app/customer-success/curso/` (clases por etapa, editor, reordenar, vista Avance) |
| El portal del alumno | `app/compartido/curso/[token]/` + `app/api/compartido/curso/` |
| La pestaña Curso de la ficha | `app/customer-success/FichaCurso.tsx` + `curso-ficha-*.ts` |
| El cron horario | `app/api/cron/curso-sesiones/` — registrado en `vercel.json:141` |
| El programa de Mauricio | `scripts/curso-cargar-programa.ts` (idempotente) + `lib/curso-programa-nqe.ts` |

**El programa cargado en el ws1 son 107 clases en las 9 etapas**: 63 videos de su planilla
«Arquitectura_Tutoriales_NqE», 43 formularios del catálogo borrado el 26/09, y la logística.
Cada etapa la cierra su última Demostración.

Las cuatro reglas que gobiernan el área (todas elegidas sin preguntar, porque Martín dijo
que no preguntara — el detalle y dónde se cambian, en `docs/hallazgos-customer-success.md`,
sección «El curso del servicio, adentro de MaKo»):

1. **El acceso es un LINK FIRMADO, no una cuenta** (`c1.<ws>.<lead>.<version>.<hmac>`): el
   login de MaKo es sólo con Google y **10 de los 14 clientes no tienen Gmail**. Revocar =
   subir la versión en `curso_accesos`.
2. **La etapa cierra al ENVIAR, no al aprobar.** «Marcar revisada» es una marca del equipo.
3. **El mensaje de etapa nueva sale sólo en el paso AUTOMÁTICO**, no cuando alguien mueve al
   cliente en el kanban (el deshacer mandaría un mensaje por arrepentimiento).
4. **Todo lo que le escribe al cliente respeta `envio_whatsapp_enabled`** — ver el punto 3.

**Whop afuera** en el mismo commit: `lib/whop*`, sus tres registros de integración y el
logo, con `tests/sin-whop.test.ts` como guard. Las credenciales guardadas se quedan (son del
cliente).

**Verificado en el navegador contra el ws1** el 06/10 (`d57bed5e`), sin escribir salvo un
acceso que la ficha crea al abrir la pestaña (se borró al terminar): la tab con las 107
clases, el Avance de los 14 clientes, la pestaña Curso de la ficha, y el portal en
escritorio y en 390 px (sin scroll lateral, sin el menú de MaKo, la etapa siguiente
bloqueada, un token torcido da el aviso).

---

## 2. Lo que está a medio hacer, y dónde vive

### ⚠️ Primero: hay trabajo del curso EN VUELO y SIN COMMITEAR, que no es de esta área

Al cierre del 06/10 el árbol tiene, **sin commitear**, una extensión del curso que **otra
sesión está escribiendo ahora mismo**. Sin trackear:
`supabase/migrations/0206_curso_invitacion.sql` · `app/mi-curso/` ·
`app/api/compartido/curso/entrar/` · `app/customer-success/curso/InvitarAlCurso.tsx` ·
`FilaAvance.tsx` · `tests/curso-invitar.test.ts`. Modificados: `lib/curso.ts` ·
`lib/curso-datos.ts` · `FichaCurso.tsx` · `curso-ficha-actions.ts` ·
`curso-ficha-lectura.ts` · `AvanceCurso.tsx` · `curso/reglas.ts` ·
`tests/curso-{admin,ficha,portal}.test.ts`.

Qué hace, leído de `app/mi-curso/page.tsx`: «*Al igual que en la vista de Agencia, se
debería poder INVITAR al cliente a MaKo para que tenga acceso al curso*» (Martín, 06/10). El
invitado entra con una cookie `mako_alumno` —**no** `mako_session`— y `/mi-curso` dibuja
exactamente lo mismo que `/compartido/curso/<token>`, traduciendo la cookie al token `c1.`
de esa misma `(ws, lead, versión)`. **Eso cierra el punto 6 del pedido de las 12:38** («un
nivel de acceso especial» dentro de MaKo), que la primera pasada resolvió con el link
firmado.

**No lo toqué y no es mío.** Lo primero que tiene que hacer quien entre: mirar si quedó
commiteado. Si el árbol sigue sucio, se commitea **por ruta explícita**, nunca con
`git add -A`.

### Lo demás, del curso

- **`envio_whatsapp_enabled` está en `false` en el ws1 desde el 29/09**, así que **a ninguno
  de los 14 clientes de Mauricio le llega nada**: ni el link, ni la etapa nueva, ni el previo
  ni el posterior. *(Lo reporta el commit; no lo verifiqué contra la base desde acá.)* A
  Mauricio **sí** le llegan sus avisos, porque ese flag gobierna sólo lo que se le escribe a
  un lead. Y si después se prende, **el dedup de 72 h se come el aviso corregido**.
- **Falta compare-and-set en `moverClienteDeEtapa`** (`lib/cs-mover-etapa.ts`): si el cliente
  manda las dos últimas tareas en el mismo segundo (dos pestañas), el mensaje de la etapa
  nueva sale **dos veces** y quedan dos líneas de historial (la fila queda bien). Se dejó
  porque cuatro tests fijan la FORMA de ese upsert y el caso es raro.
- Una sesión marcada que no salió por algo arreglable (sin teléfono, línea caída) **no se
  reintenta**, a propósito; el motivo queda en `aviso_motivo`.
- **Lo que Mauricio pidió el 8/9 no está**: «los compromisos de la junta» sacados del Fathom.
  El posterior manda las tareas que le quedan al cliente en su etapa.
- Sin hacer: el **onboarding de la tab Curso** (regla de la casa), la limpieza de videos
  huérfanos del bucket, la **sincronización de las llamadas con Calendly**, y lo que **MaKo**
  puede leer del curso por WhatsApp o la API (no está declarado en `lib/api-mako/areas/`).
- **`app/admin/dev/customer-success/roadmap-cs.ts` todavía dibuja Whop como pieza viva**
  (`:88` «Whop — El cliente — Ve los videos del programa»; `:110` «Cargar el programa de
  Mauricio en Whop»). La cabecera tiene el aviso del 06/10; el cuerpo, no. Verificado en
  `de64b5b7`.

### Residuos de Instagram que siguen enchufados (verificados en `de64b5b7`)

- **ws11 y ws13 conservan su `ZERNIO_API_KEY`, su fila en `zernio_workspace` y su webhook
  registrado en Zernio, y como la tarjeta salió del catálogo NINGUNA pantalla puede
  borrarla.** *(Lo reporta el commit; no lo verifiqué contra la base.)*
- El proyecto **«Instagram» sigue en `lib/plan-proyectos-catalogo.ts:167`** y el Perro
  Guardián puede rutear tareas a una tab que ya no existe.
- **En el sidebar sigue habiendo un ítem que dice «Instagram»**: es el GRUPO de writers
  (Reels / Carousels / Stories) dentro de Content Machine
  (`app/_components/nav.ts:293`, `key: 'ig-formatos'`), y está así a propósito — esas tabs
  escriben piezas *para* Instagram. **Si alguien reporta «Instagram no se fue», es esto.**
- Los límites de `lib/ig-formatos.ts` (90 s, 10 ítems, JPEG) son **los de publicar por API**,
  y publicar ahora es a mano. `lib/ig-writer.ts` queda como motor compartido.
- `/admin/dev/instagram` conserva su bitácora y su entrada de nav (`dev-instagram`): es la
  **historia** de lo que se pidió y se hizo, y el guard la exceptúa por nombre.
- Whop deja en la base **4 credenciales** (ws1 y ws4) y **una fila de `webhook_routing`** del
  ws1, inertes: ningún camino del producto las limpia. En el tablero del super admin, las
  **#659 y #660** (Whop) siguen abiertas.

---

## 3. Las trampas del área

1. ⚠️ **La más caruchi, y la que define este relevo: el aviso del tope de Zernio se escribió
   el 05/10 22:20 y se BORRÓ el 06/10 14:23, sin que nada avise.** El tope («Zernio incluye 2
   cuentas conectadas; desde la 3.ª te cobra por cada una, aunque no la uses») tenía
   exactamente **dos casas**, las dos elegidas por permanentes: la nota del campo
   `ZERNIO_API_KEY` en `lib/metodo-catalogo.ts` y el paso de Zernio del onboarding de
   `/instagram`. **La retirada de Instagram se llevó las dos**: hoy
   `lib/metodo-catalogo.ts:263` es un comentario que dice que Zernio se fue, y
   `OnboardingInstagram.tsx` no existe. Resultado: la tarea **#829 figura cumplida** en
   `app/admin/dev/integraciones/bitacora.ts` (hito «5 oct 22:20») **con sus dos punteros de
   archivo muertos**, y el reclamo de Leila —«*aparecieron cargos de Cernio y de Wok y no los
   usé, o sea, simplemente los vinculé*»— **no tiene dónde contestarse en el producto**: el
   06/10 **las dos** integraciones que le cobran (Zernio y Whop) salieron de MaKo.
   **La lección: un aviso que vive sólo en la UI de una tab muere con la tab**, y dos commits
   a 16 horas de distancia en chats distintos no se ven entre sí.
2. ⚠️ **Retirar una pantalla son TRES enumeraciones, no dos: quién la importa, quién la
   enlaza, y quién LEE lo que ella escribía.** La tercera es la que se saltó, y cayó en otra
   área (la fuente de KPI que contaba `contenido_posts`). La regla quedó escrita en
   `docs/hallazgos-objectives.md`.
3. ⚠️ **El diagnóstico obvio —«borrar `app/instagram` y redirigir»— dejaba TRES tabs vivas
   rotas**: Reels, Carousels y Stories importaban de esa carpeta y mandaban sus piezas como
   borrador a `/instagram`. Hay que grepear quién importa la carpeta, **incluidos los
   `../instagram/` relativos**.
4. ⚠️ **Un guard que busca una tabla como `.from('<tabla>')` no ve `contar('<tabla>', …)`.**
   Dejó pasar justo el consumidor que importaba. Ahora busca el nombre **como cadena**, con
   las dos listas de scoping de inquilino exceptuadas por nombre.
5. ⚠️ **Un `gating.tab` que apunta a una tab que ya no existe esconde la operación sin dar
   error**: `tabsDeCapa` la filtra para toda capa con lista de tabs. Pasó con
   `limites_formato_instagram`, re-gateada a `reels`.
6. ⚠️ **Retirar el CONSUMIDOR de una integración no retira la integración.** Diez días
   después de que el 26/09 saliera el programa de Mauricio, **la tarjeta de Whop seguía en
   `/integraciones` para TODOS los clientes**: se podía conectar, el tilde se ponía verde con
   el nombre del negocio, y el tutorial mandaba pegar una URL que daba 404. **Retirar una
   integración son SIETE cosas**: tarjeta, campos, ping, logo, sus `AYUDA_CAMPO`, su lib, y un
   `tests/sin-<x>.test.ts` que falle si vuelve. (`docs/hallazgos-integraciones.md`.)
7. ⚠️ **Falso diagnóstico, y lo cometió el orquestador:** «el desplegable de Customer Success
   queda de una sola fila en la capa superadmin porque sus `navKeys` no traen `cs-curso`». Se
   agregó la key y **se revirtió**: `tabEnCapa` **une** `navKeys` con `userNavKeys`, y
   superadmin tiene `userNavKeys: null`, o sea que contesta que sí a CUALQUIER key. **Antes de
   agregar una key a una capa, o de creer que una lista la restringe, mirá su `userNavKeys`.**
8. ⚠️ **Falso diagnóstico 2:** «los avisos a Mauricio necesitan su entrada de catálogo para
   salir». `emitirAviso` **acepta un tipo que no está en el catálogo y lo manda igual**, con
   el rótulo «SISTEMA» y sin poder apagarse ni renombrarse. Las dos entradas se agregaron
   para eso, no para habilitarlos.
9. **«Enviado» significa «se procesó», no «le llegó».** El cron marca `aviso_previo_at`
   ANTES de mandar (compare-and-set, para no mandar dos veces) y no la deshace si falló. Lo
   que distingue es el motivo de ESA fase (`motivoDeFase`); la ficha leía sólo la marca.
10. **Repartir trabajo por archivo DUPLICA las reglas puras que necesitan dos pantallas**:
    dos `videoDeClase` con formas distintas decidían cada una si un video «se mide». Esa regla
    se define en un módulo compartido **antes** del reparto.

El resto de las trampas del curso —el 100 % falso con un POST, la tabla de filas fijas que
contaba como contestada, «entró N veces» midiendo la vista previa de WhatsApp, el upsert
contra un índice único PARCIAL en PostgREST, el `jsonb` que Postgres reordena, la URL firmada
de 4 h, el `timeupdate` en 0, YouTube y `onYouTubeIframeAPIReady`— están en
`docs/hallazgos-customer-success.md`. Vale leerlas antes de tocar el portal.

---

## 4. Qué espera una decisión de Martín

1. ⚠️ **El tope de Zernio quedó sin ningún lugar en el producto. ¿Vuelve, y adónde?**
   Opciones: **(a)** que no vuelva — Instagram salió y los únicos dos workspaces con key
   propia (ws11, ws13) ya la conectaron; **(b)** volver a la nota del campo
   `ZERNIO_API_KEY`, que sin tarjeta en `/integraciones` ya no se dibuja en ningún lado — o
   sea que habría que devolver la tarjeta sin la tab, que contradice la retirada; **(c)**
   cerrarlo fuera del producto: un mensaje a ws11 y ws13 a mano y la #829 cerrada así.
   **Y lo más grande, que es lo mismo visto de lejos:** Leila paga Zernio **y** Whop por dos
   integraciones que MaKo ya no ofrece, y **nada en el producto le dice que las desvincule**.
2. **El precio de Zernio sigue sin verificar.** La nota del 15/08 dice **US$6** por cuenta al
   mes; Leila reportó **~US$16**. Se dejó fuera del aviso a propósito (un precio ajeno no es
   un dato hasta leerlo en la página del proveedor ESE día). Alguien tiene que mirarlo.
3. **Las llaves de Zernio de ws11 y ws13**: nadie las lee y ninguna pantalla puede borrarlas.
   ¿Se borran a mano o se dejan? (Ya figura como decisión suya en
   `app/admin/dev/chatbot/bitacora.ts:680`.)
4. **El proyecto «Instagram» del catálogo del Plan** (`lib/plan-proyectos-catalogo.ts:167`):
   ¿sale, o queda como historia aunque el Perro pueda rutear tareas ahí?
5. ⚠️ **El PAS fuera de orden.** El kanban lo pone **tercero** y la planilla de Mauricio lo
   pone **después de Tablero y Ritmo**, a propósito («Contexto en dos pasadas»; su video 9.1
   se llama literalmente «Por qué el propósito va después del tablero»). **Hoy un cliente
   llega a esa tarea sin tener tablero.** Se arregla moviendo la etapa `pas` entre `ritmo` e
   `instalado` en el editor de etapas: las clases cuelgan de la CLAVE y viajan solas. Es un
   movimiento en el editor y nadie lo decidió.
6. ⚠️ **Prender `envio_whatsapp_enabled` en el ws1.** Es el interruptor entre «está hecho» y
   «está funcionando»: mientras siga apagado, los 14 clientes de Mauricio no reciben nada.
   Ojo con el dedup de 72 h al prenderlo.
7. **¿`contenido_publicado` vuelve como KPI MANUAL?** Es una línea en `CANDIDATOS_KPI`
   (`lib/objectives-modelo.ts`) y se dejó afuera porque es decisión de producto. Un KPI viejo
   que la nombrara cae hoy en «fuente desconocida», que es el camino que el catálogo ya tiene.
8. **El roadmap de `/admin/dev/customer-success` todavía dibuja Whop como pieza viva**:
   ¿se reescribe o se retira? (`roadmap-cs.ts`.)
9. **Lo que falta del pedido de las 12:38** — el punto 7 era «*si se me olvidó algo en estos
   items, dimelo*»: los compromisos de la junta sacados del Fathom (lo pidió Mauricio el 8/9),
   el onboarding de la tab Curso, la sincronización de las llamadas con Calendly, y qué puede
   leer MaKo del curso por WhatsApp.

---

## Repaso del 13/10/2026 — qué de todo esto seguía abierto

⚠️ **Este relevo estaba VIEJO en cuatro de sus pendientes.** Es material de segunda mano y
se verificó uno por uno antes de tocar nada; cuatro los habían cerrado otras sesiones entre
el 08 y el 13/10 sin pasar por acá:

| Lo que decía el relevo | Medido el 13/10 |
|---|---|
| «Falta compare-and-set en `moverClienteDeEtapa`» | **HECHO** — `lib/cs-mover-etapa.ts:267` hace `.eq('id', previa.id).eq('etapa', previa.etapa)` |
| «`roadmap-cs.ts` todavía dibuja Whop como pieza viva» | **HECHO** — lo que queda de Whop ahí es HISTORIA, con su nota de retiro, y lo fija `tests/sin-whop.test.ts` |
| «Lo que MaKo puede leer del curso no está declarado en `lib/api-mako/areas/`» | **HECHO** — existen `curso.def.ts` / `.run.ts` / `.helpers.ts` |
| «Sin hacer: el onboarding de la tab Curso» | **HECHO** — es un RECORRIDO (`app/_ui/Recorrido.tsx`, `cs-curso`) desde el 08/10 |
| «Hay trabajo del curso EN VUELO y SIN COMMITEAR» | **EN MAIN** — `app/mi-curso/`, mig `0206_curso_invitacion.sql`, `InvitarAlCurso.tsx` y `tests/curso-invitar.test.ts` |

### Cerrado en este repaso: las fuentes de la hoja del curso

**«La negrita del curso sale en Arial»** estaba anotado como una DECISIÓN que esperaba a
Martín, con la nota de que arreglarlo «cambia también los 132 cursos de Conocimientos». No
era una decisión: era un **404**.

`public/cono-doc/ugc.css` traía 38 `@font-face` copiados del origen que apuntan a
`/_next/static/media/<hash>.woff2` — el build DE ELLOS. Medido contra producción: los 38 dan
404. Y como van después del `@import` de Google que la cabecera agrega, le ganaban: tapaban
la cara buena con una que no carga. Antes/después en Chrome, con las 8 caras dibujadas:
**antes 6 de 8 muertas y 12 respuestas 404; después las 8 cargan y 0 fallidas.** Archivo 400
andaba y Archivo **700** no — de ahí que sólo la negrita se viera mal.

Se arregló en los dos lugares, porque son dos preguntas: el **generador**
(`scripts/avatarhype-css.mjs`) descarta esos `@font-face` y cuenta cuántos tiró, y la **hoja
servida** se arregló en el mismo commit (regenerar necesita el archivo capturado del origen,
que no está en el repo). Guards en `tests/cursos-ugc.test.ts`, probados rompiéndolos: 27 / 0
con todo en su lugar, 26 / 1 en las cuatro roturas. El detalle, en
`docs/hallazgos-conocimiento.md` → «La hoja del curso pedía 38 fuentes al dominio del
ORIGEN».

### Lo que sigue esperando una decisión de Martín (preguntado el 13/10)

1. **El arrastre no anda en pantallas táctiles.** Es HTML5 nativo (`draggable` +
   `onDragStart`, `app/customer-success/curso/arrastre-campos.ts`), y ese gesto no existe en
   touch. Arreglarlo es escribir un SEGUNDO camino con pointer events — no es un ajuste.
2. **La vista Avance no cuenta los módulos sueltos.** Hoy es coherente con la D1 del 08/10
   (`lib/curso-avance.ts:16`: «un módulo SUELTO no es una etapa»), así que la pregunta es qué
   tiene que significar el %: si los sueltos cuentan, quien termine todas las etapas no llega
   a 100.
3. **«+ Nuevo campo» arriba con el campo naciendo abajo** — lo pidió él, y la prueba pidió lo
   contrario.
4. **Reabrir el tutorial del curso a todos.**
5. **La fuente en Conocimientos** (necesita migración) — además se pisa con el pedido nuevo
   de «biblioteca de tipografías» de `mako-feedback-y-tareas.md`, que sigue PROVISIONAL.

### Lo que sigue sin hacer, con su archivo

Igual que antes: la limpieza de videos huérfanos del bucket `curso-videos`, la
sincronización de las llamadas con Calendly, y los «compromisos de la junta» que Mauricio
pidió el 8/9 sacados del Fathom. Y `envio_whatsapp_enabled` sigue gobernando que a los 14
clientes del ws1 no les llegue nada.
