# Relevo: qué incluye cada plan en su columna (14/11/2026)

Esto es sobre **la columna de cada plan en la tabla de precios** — los checks de «qué incluye» —, no sobre
la tabla comparativa de abajo («Compara los planes», `lib/planes-comparacion.ts`). Es un relevo para que
Martín lo apruebe: nada está implementado.

El pedido, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la
idea es que cada uno se sienta único y justamente tiene que pensarse como usuario… el de 47 debería estar
bien limitado y restrictivo. En cambio el de 97 ya podés generar avatares de IA, podés editar videos,
podés replicar landing… **La idea es que compren el de 97, no el de 47.**»

---

## 1. Lo que hay hoy

### 1.1 Hay CUATRO listas distintas de «qué incluye cada plan», y tres dicen «todo lo de X»

Ninguna es la fuente de las otras. Cada una se escribió en una vuelta distinta y se mantiene a mano:

| # | Lista | Dónde | Quién la dibuja | ¿Dice «todo lo de X»? |
|---|---|---|---|---|
| 1 | `PLANES_MAKO_DEFAULT[].incluye` | `lib/planes-mako.ts:130-141` (Esencial, 7 renglones) y `:153-169` (Pro, 10) | **nadie** (ver 1.4) | **Sí**, `lib/planes-mako.ts:156`: `'Todo lo de Esencial, sin tope de leads, landings ni automatizaciones'` |
| 2 | `listaCorta(capa)` | `app/planes/Tarjetas.tsx:67-90` | las tarjetas de `/planes` y de la landing (`app/planes/Tarjetas.tsx:190`, `:212-213`) | **Sí**, `app/planes/Tarjetas.tsx:70`: título de la columna Pro = `'Todo lo de Esencial, más:'` |
| 3 | `INCLUYE_EN_EL_CHECKOUT` | `lib/planes-mako.ts:233-251` (6 renglones por plan) | el checkout de un plan (`app/planes/[plan]/page.tsx:93`) | **No**: es autosuficiente, y su comentario (`lib/planes-mako.ts:227-232`) ya dice el porqué — «En el checkout se ve UN plan: "Todo lo de Esencial, más:" no dice nada ahí» |
| 4 | `filasDeComparacion()` | `lib/planes-comparacion.ts:100-157` (44 filas en 7 grupos) | la tabla «Compara los planes» (`app/planes/Vitrina.tsx:152`, `:167`, `:171`) | No aplica: es matriz, una celda por plan |

Y el Acelerador, la cuarta columna, también acumula: `app/planes/Tarjetas.tsx:231`, título
`'Todo lo de MaKo Pro, más:'`, con 4 renglones (`LISTA_PROGRAMA`, `app/planes/Tarjetas.tsx:93-98`).

**O sea: el patrón que Martín quiere sacar está en los tres lugares que una persona lee primero** (la
tarjeta de `/planes`, la misma tarjeta embebida en cada landing, y la del Acelerador). El único que ya está
escrito como él lo pide es el checkout, que se ve DESPUÉS de haber elegido.

### 1.2 Qué dice hoy cada columna, textual

**MaKo Esencial · US$47/mes · US$470/año** (`lib/planes-mako.ts:122-144`)

- «para quién es» (`resumen`, `lib/planes-mako.ts:129`): *«Para empezar a vender por internet, por tu cuenta.»*
- Título de la lista: `'Incluye:'` (`app/planes/Tarjetas.tsx:81`)
- Los 7 checks (`app/planes/Tarjetas.tsx:81-89`), con los números leídos de `lib/topes-plan.ts`:
  1. Tu asistente con IA
  2. Hasta 2.000 leads en tu CRM
  3. 1 WhatsApp e Instagram
  4. 2 automatizaciones activas
  5. 1 landing
  6. 1 competidor en tu radar
  7. Editor de imágenes y de video

**MaKo Pro · US$97/mes · US$970/año · `destacado: true`** (`lib/planes-mako.ts:145-173`)

- «para quién es» (`lib/planes-mako.ts:152`): *«¿Ya vendes? Para escalar con anuncios, contenido y equipo.»*
- Título de la lista: `'Todo lo de Esencial, más:'` (`app/planes/Tarjetas.tsx:70`)
- Los 8 checks (`app/planes/Tarjetas.tsx:70-79`):
  1. Leads, landings y automatizaciones sin tope
  2. Setter con IA
  3. Piloto automático de ads, Instagram y YouTube
  4. Competidores sin tope y copiar sus landings
  5. Edición con IA
  6. Análisis de llamadas con IA
  7. Comunidad y dominio propio
  8. 3 WhatsApp y 5 personas de tu equipo

**MaKo Acelerador · US$1.500 en 3 cuotas** (`lib/planes-mako.ts:253-278`)

- Arriba no va el `resumen` sino la **promesa** (`app/planes/Tarjetas.tsx:221`, texto en
  `lib/planes-mako.ts:276`): *«En 90 días, Martín Koncke, el creador de MaKo, te instala el sistema de
  adquisición de clientes a la medida de tu oferta, y como mínimo recuperas la inversión que hiciste,
  garantizado por contrato.»*
- Título de la lista: `'Todo lo de MaKo Pro, más:'` + 4 renglones.

### 1.3 Cómo está armada la columna hoy (el molde actual)

`app/planes/Tarjetas.tsx:105-160` (CSS) y `:164-237` (el componente). Lo que ya se copió, y de dónde, está
escrito en la cabecera del archivo (`app/planes/Tarjetas.tsx:1-39`): ClickFunnels (el botón arriba de la
lista), Kajabi (la frase de etapa del negocio) y **beehiiv** en el rediseño del 12/11 (tarjetas blancas
iguales, lista corta, insignia arriba).

- Las filas son las mismas en las cuatro tarjetas, con `subgrid`, para que los botones queden alineados
  (`app/planes/Tarjetas.tsx:109-111`). Orden: nombre → frase → precio → botón → **lista** (la lista va
  ABAJO del botón).
- La insignia `'Recomendado'` sólo en el `destacado` (`app/planes/Tarjetas.tsx:193`), azul `#2F6FED`, arriba
  a la izquierda; la tarjeta destacada lleva borde azul y sombra azul (`:112-114`).
- El Acelerador es la única oscura (`.mkpl-programa`, `:136-142`) y no la toca el sol/luna del sitio.
- Selector mensual/anual con dos radios y `:has()`, mensual por defecto (`:175-183`), con la pastilla
  «2 meses gratis» (`MESES_GRATIS_ANUAL`, `lib/planes-mako.ts:69`).
- Debajo del precio hay **una sola cosa**: «7 días gratis» o «Se paga al empezar» (`bajoElPrecio`,
  `app/planes/Tarjetas.tsx:101-103`). Desde el 14/11 los dos planes tienen prueba (`PLANES_CON_PRUEBA`,
  `lib/planes-mako.ts:100`), así que las dos columnas dicen «7 días gratis».
- Lo que un plan **no** trae ya no va en la tarjeta: se sacaron los 8 renglones con ✗ el 12/11
  (`app/planes/Tarjetas.tsx:30-31`); eso lo dice la comparación (`noIncluyeDe`, `lib/planes-comparacion.ts:228-230`).

### 1.4 Hallazgo: `incluye` es código muerto para los dos planes que se venden

`planesParaLanding()` sigue pasando `incluye` a las tarjetas (`lib/compra-plan.ts:516-523`) y el tipo de la
tarjeta lo declara (`app/planes/Tarjetas.tsx:48`), pero **la tarjeta no lo lee**: desde el rediseño del
12/11 dibuja `listaCorta(p.capa)` (`app/planes/Tarjetas.tsx:190`).

El único consumidor vivo es el checkout, y ahí es un *fallback* que nunca entra:
`INCLUYE_EN_EL_CHECKOUT[plan.id] ?? plan.incluye` (`app/planes/[plan]/page.tsx:93`), y
`INCLUYE_EN_EL_CHECKOUT` tiene entrada para `'esencial'` y para `'pro'` (`lib/planes-mako.ts:235`, `:243`).
El bot de WhatsApp tampoco lo usa: sólo nombre, precio y `resumen` (`lib/mako-bot.ts:152`).

**Consecuencia práctica:** los 17 renglones de `incluye` (Esencial 7 + Pro 10) **no se muestran en ninguna
pantalla**, y son los que más se trabajaron el 14/11. Sólo volverían a renderizar si el super admin escribe
un plan a mano en el setting `planes.mako` con un id que no sea `esencial` ni `pro` (`planValido`,
`lib/planes-mako.ts:294-315`; corta la lista a 8 renglones de 80 letras, `:309`). Cualquier decisión que se
tome hay que aplicarla en `listaCorta` o esto se repite.

### 1.5 La clave: `listaCorta` depende de la CAPA, no del plan

`listaCorta(capa)` (`app/planes/Tarjetas.tsx:67`) decide con `capa === 'agencia'`. Esencial = capa
`completo`, Pro = capa `agencia` (`lib/planes-mako.ts:125`, `:148`; el mapeo está documentado en
`lib/topes-plan.ts:9-12`). Es a propósito, y es bueno: un plan nuevo del setting con capa `agencia` dice lo
de Pro sin tocar código. Pero significa que **no se puede diferenciar dos planes con la misma capa**.

### 1.6 Y el fondo del problema: Esencial y Pro ven EL MISMO producto

`lib/capas.ts:186-242` (capa `completo`) y `lib/capas.ts:259-272` (capa `agencia`) tienen las dos
`navKeys: null` y `userNavKeys: null` — es decir, **todas las pantallas**. Lo dice el comentario de
`lib/capas.ts:255-257`: «VE LO MISMO QUE `completo`, y eso es a proposito».

Eso viene del 23/10, copiado de Systeme.io: «Esencial y Pro se diferencian por TOPES, no por funciones
escondidas (*el cliente ve todo MaKo desde el primer día*)» (`lib/topes-plan.ts:4-6`). Hoy la única tab con
candado es Closing Analyst (`TABS_SOLO_PRO`, `lib/topes-plan.ts:55`), y lo demás que es sólo de Pro son 6
funciones sueltas adentro de pantallas abiertas (`FUNCIONES_SOLO_PRO`, `lib/topes-plan.ts:70`).

**Esa decisión es exactamente la que el pedido de Martín invierte.** Y tiene un costo de implementación que
conviene saber antes: `lib/topes-plan.ts:48` lo dice textual — «una capa "esencial" que las esconda es del
área de capas». Esconder una pantalla en Esencial es una capa nueva (`CapaId`, `lib/capas.ts:94`;
`IDS_VENDIBLES`, `lib/capas.ts:353`; el CHECK `workspaces_capa_valida` de la base, `lib/capas.ts:372-373`),
no un cambio de copy. Lo que SÍ se puede hacer sin capa nueva es sumar entradas a `FUNCIONES_SOLO_PRO` y
bajar números en `TOPES` — que es cómo se hicieron los recortes del 14/11.

---

## 2. Las funcionalidades reales de MaKo, y si hoy están topeadas

### 2.1 Lo que promete la landing principal

La portada son 14 filas (`TARJETAS_PORTADA`, `app/vsl/_sitio/datos.ts:242-271`), en el orden de una venta
high ticket de punta a punta (el criterio, en `app/vsl/_sitio/datos.ts:232-241`). Además hay **19 landings
de funcionalidad** (`LANDINGS_COMPETENCIA`, `app/vsl/_competencia/registro.ts:33-35`) agrupadas en cuatro
columnas del menú «Producto» — Today, Sales, Marketing, Create (`app/vsl/_sitio/datos.ts:64-69`).

Cruce de las 14 filas de la portada contra el tope que el código hace cumplir hoy:

| # | Lo que promete la portada | Dónde lo dice | Tope hoy en Esencial | Dónde se aplica |
|---|---|---|---|---|
| 1 | Second Brain: tu negocio en un mapa | `app/vsl/_sitio/datos.ts:248` | **sin tope** | — |
| 2 | Chatear con los referentes del mercado | `:249` | **sin tope** | — (la fila está en los tres: `lib/planes-comparacion.ts:143`) |
| 3 | Mirar todo lo que publica tu competencia | `:250` | **1 competidor** | `lib/spy-tope-reglas.ts:21-33` (`spy.competidores`, `lib/topes-plan.ts:38`) |
| 4 | Replicar y adaptar un guion de la competencia | `:251` | **sin tope** | — |
| 5 | Replicar los carruseles que funcionan | `:252` | **sin tope** | — (`lib/planes-comparacion.ts:116`, en los tres) |
| 6 | Editar tus videos con IA | `:253` | **solo Pro** | `lib/editores-ia-pro.ts:31`, `:40`; `app/video-editor/_opencut/clips/resultado.ts:22`; `app/video-editor/_opencut/enjambre/correr.ts:86` (`'ia-editores'`) |
| 7 | Anuncios UGC con tu cara (AI Avatar) | `:254` | **sin tope** y **no se vende** | abierta en los tres: `app/ai-avatar/acceso.ts:4-5`; la vitrina no la vende: `AI_AVATAR_SE_VENDE = false`, `lib/planes-comparacion.ts:67` |
| 8 | Anuncios, Instagram y YouTube con IA | `:256` | **2 recomendaciones/día; los 3 pilotos son de Pro** | cupo: `lib/media-buyer/plan.ts:26`, `lib/media-buyer/store.ts:46`; piloto de redes: `lib/copiloto/piloto.ts:37` (`'piloto-redes'`) |
| 9 | Replicar una landing de tu competencia | `:257` | **solo Pro** | `app/web-generator/crear/Replicar.tsx:68` (`'replicar-landing'`) |
| 10 | El CRM trackea tus leads solo | `:261` | **2.000 leads, 1 pipeline** | `lib/topes-crm.ts` vía `lib/api-mako/areas/crm.run.ts:1727`, `:2870-2890`, `:3499`; `lib/perfil-captura-db.ts:106`; `lib/migracion-leads-server.ts:91` |
| 11 | Automatizar WhatsApp, Instagram y email | `:264` | **2 automatizaciones; el setter con IA es de Pro** | tope: `lib/tope-automations.ts:37-43`; setter: `lib/setter-ia-reglas.ts:32`, `:88` (`'setter-ia'`) |
| 12 | WhatsApp, Instagram, Messenger y email en MaKo | `:265` | **1 línea de WhatsApp** | `lib/tope-lineas.ts:28` (`chats.lineas_whatsapp`) |
| 13 | Tus números, en tableros | `:266` | **sin tope** (menos la hoja Closing) | `app/dashboard/page.tsx:174`, `app/m/dashboard/[hoja]/page.tsx:56` |
| 14 | Tu curso y tu comunidad en MaKo | `:269` | **1 curso; la comunidad es de Pro** | cursos: `lib/tope-cursos-reglas.ts:41-46`; comunidad: `app/customer-success/comunidad/pantalla.tsx:42`, `app/m/comunidad/page.tsx:53`, `app/compartido/curso/[token]/page.tsx:60` (`'comunidad'`) |

**El número que importa: de las 14 cosas que la landing principal promete, sólo 2 están cerradas enteras en
Esencial** (editar con IA y replicar una landing). Otras 3 están cerradas a medias (el setter, los pilotos,
la comunidad). Y **5 están abiertas sin ningún tope** — entre ellas AI Avatar, que es justamente la que
Martín nombra como ejemplo de lo que debería ser de Pro, y las dos de «replicar» (guion y carrusel), que son
la misma palanca que «replicar landing» pero no están cerradas.

### 2.2 El resto del catálogo vendible

Lo que ya está topeado, completo (`TOPES`, `lib/topes-plan.ts:30-46`):

| Tope | Esencial (`completo`) | Pro (`agencia`) | Dónde se aplica |
|---|---|---|---|
| `crm.leads` | 2.000 | sin tope | `lib/topes-crm.ts` (ver 2.1 #10) |
| `crm.funnels` (pipelines) | 1 | sin tope | `lib/api-mako/areas/crm.run.ts:2870-2890` |
| `chats.lineas_whatsapp` | 1 | 3 | `lib/tope-lineas.ts:28` |
| `automations.activas` | 2 | sin tope | `lib/tope-automations.ts:37-43` |
| `web.landings_publicadas` | 1 | sin tope | `lib/editor-landing/tope-landings.ts:51` |
| `web.dominios` | **0** (= no lo trae) | sin tope | `lib/editor-landing/tope-landings.ts:53`, texto en `:21` |
| `cobros.cuentas` | 1 | sin tope | `lib/tope-cuentas-reglas.ts:28` |
| `equipo.usuarios` | 1 | 5 | `lib/tope-equipo-reglas.ts:22` |
| `ads.recomendaciones_dia` | 2 | sin tope | `lib/media-buyer/plan.ts:26` |
| `spy.competidores` | 1 | sin tope | `lib/spy-tope-reglas.ts:21` |
| `classroom.cursos` | 1 | sin tope | `lib/tope-cursos-reglas.ts:41` |

Lo que es sólo de Pro y no es un tope (`FUNCIONES_SOLO_PRO`, `lib/topes-plan.ts:70`; los textos del candado,
`lib/topes-plan.ts:73-82`): `scraper-whatsapp` (`app/crm/grupo-wa-actions.ts:34-35`), `replicar-landing`,
`ia-editores`, `comunidad`, `setter-ia`, `piloto-redes`. Más la única tab con candado:
`closing-analyst` (`lib/topes-plan.ts:55`, puerta en `app/api/closing/puerta.ts:38`).

Y lo que **no tiene tope de ningún tipo** y se vende igual (`enTodos(...)`, `lib/planes-comparacion.ts`):
Ops Center y el asistente con IA (`:141`), el chat con los referentes (`:143`), Offer/Funnel Coach (`:144`),
los reportes (`:145`), el Plan y el Perro Guardián (`:146`), Copywriting con IA (`:115`), el editor de
imágenes (`:116`), el editor de video (`:117`), el calendario de contenido (`:119`), el tracking de leads
(`:128`), la agenda (`:129`), los planes de pago en cuotas (`:131`), la bandeja única (`:134`) y el email
marketing (`:138`).

Dos cosas más, para que el relevo esté completo: **MaKo Partners es de cualquier plan** desde el 29/10
(`lib/topes-plan.ts:63-64`), y **las cuentas de clientes de una agencia** son de Pro por la capa
(`lib/capas.ts:259`) pero Martín las sacó de la tabla el 14/11 a la noche (`lib/planes-comparacion.ts:93-94`).

---

## 3. Cómo lo hacen otros

Las siete páginas se leyeron renderizadas en el navegador el 14/11/2026. Aviso de método, porque vale para
la próxima: **ninguna de las siete se deja leer bien con un fetch de texto**. `activecampaign.com/pricing`
devuelve los precios como `--` (no falla ni avisa: entrega placeholders); `systeme.io/pricing` devuelve
*skeletons* vacíos hasta que corre el JS; `beehiiv.com/pricing` devuelve un *payload* viejo con otras
taglines y encabezados «Everything on Free +» que ya no existen; `gohighlevel.com/pricing` devuelve los
precios anuales mal emparejados con sus planes. El diagnóstico obvio («me bloquearon») era el equivocado.

### 3.1 GoHighLevel — <https://www.gohighlevel.com/pricing>

- **Acumulativo, y cruzado a propósito.** Starter no tiene encabezado; Founder dice
  **«Everything in Unlimited, plus:»**; Unlimited dice **«Everything in Starter Plan and...»**. El cruce es
  que Founder nombra a Unlimited y Unlimited está a su *derecha*: leyendo de izquierda a derecha te comés la
  referencia antes de conocer el plan referido.
- **Bullets: 7 / 7 / 3.** La columna de US$297 es la más corta de las tres por lejos.
- **Recomendado:** badge «MOST POPULAR» en pestaña blanca montada sobre el borde, azul brillante sólido
  contra el azul casi negro de las otras, tarjeta más alta, y **el orden de precio roto: $97 → $497 → $297**.
  Lo más caro, en el centro. (En el HTML quedó un bloque anual apagado con el orden viejo —ascendente—:
  mover el caro al medio fue una decisión posterior y deliberada. El mapeo correcto lo confirma
  <https://revenuegeeks.com/guides/gohighlevel-unlimited-plan>.)
- **Fuera del barato:** white-label de la app, API access, pass-through billing, SaaS mode / reventa,
  project management, meeting rooms, events. **Y el tope que de verdad duele no está en la tarjeta:**
  Starter = 3 sub-cuentas, los de arriba ilimitadas, y eso sólo aparece en el FAQ.
- **«Para quién es»: una línea** bajo el precio, en los tres. Starter: *«For one business or a few
  clients»*. Founder: *«Perfect for founders, agencies, consultants, and service providers looking to
  scale»* — se parte en 3 renglones, lo que hace la tarjeta más alta que las vecinas.

### 3.2 Systeme.io — <https://systeme.io/pricing>

- **Ni acumulativo ni repetido: no hay lista.** Cada tarjeta es nombre + **un párrafo en prosa** + precio +
  botón. Los checks viven en una tabla aparte de ~60 filas en 19 grupos. La única frase acumulativa de toda
  la página está en la quinta tarjeta («For teams»).
- **Recomendado: no marcan ninguno.** Sin badge, sin borde, sin columna más grande, sin preselección, y en
  desktop angosto se acomodan en grilla 2×2, lo que directamente elimina la comparación lado a lado.
- **Fuera del barato: casi nada.** De ~27 filas booleanas sólo 3 están cerradas, y las tres se abren
  únicamente en el tope: coaching de arranque 1-a-1, migración gratis y acceso temprano. Todo lo demás
  —incluidas las 8 pasarelas y el programa de afiliados— está hasta en el Free. **La única función entera
  que separa tiers es «Evergreen webinars»**, y por eso el plan del medio se llama literalmente «Webinar».
  El resto es puro tope numérico.
- **«Para quién es»:** no como línea aparte, fundida en el párrafo («*Perfect for testing the platform*»).
- Y el FAQ hace la recomendación que la tarjeta no hace, **por cantidad de contactos, no por función**.
  Precios confirmados también en <https://www.g2.com/products/systeme-io/pricing>.

### 3.3 ClickFunnels — <https://www.clickfunnels.com/pricing>

- **Repite la lista COMPLETA en cada columna.** No hay ningún «Everything in X, plus». Las 4 columnas tienen
  **los mismos labels en el mismo orden**; sólo cambian los números. Es una matriz comparativa disfrazada de
  columnas autosuficientes. Bullets: 11 / 13 / 13 / 14.
- **El truco más copiable de las siete: negrita selectiva.** En cada columna van en negrita **sólo los
  bullets que mejoran respecto de la columna de la izquierda**. En Launch (el barato) **no hay ni un bullet
  en negrita**: se ve plano y gris sin que le falte un renglón, así que no se le puede acusar de esconder
  nada y aun así no engancha el ojo. En Optimize, los dos bullets que ya estaban en Scale **vuelven a peso
  normal**.
- **Recomendado:** badge «Most Popular» naranja sobre el borde de Scale, tarjeta más alta, y **el único
  botón naranja** de la grilla. El toggle **anual viene preseleccionado**, con el precio mensual tachado y
  «Save $394/year».
- **Fuera del barato:** Custom Code Editor, Webhooks/Full API Access, Priority + Live Chat Support,
  dominios ilimitados. **Y el diseño fino: de Optimize para arriba no se agrega NINGUNA función nueva.** El
  único salto funcional de toda la grilla es Launch → Scale, que es exactamente el plan del badge.
- **«Para quién es»: una línea** entre el precio y el botón. Launch: *«Includes all the tools to launch your
  business online.»* Scale: *«Get everything you need to scale your businesses fast.»*
- Extra: el primer bullet es el mismo en las 4 columnas («Unlimited Funnels», con pastilla verde «Limited
  Time»), lo más valioso y gratis en todos, puesto arriba como ancla. Y los nombres son verbos de etapa
  (Launch → Scale → Optimize → Dominate): quedarte abajo se lee como un estado transitorio.

### 3.4 Kajabi — <https://www.kajabi.com/pricing>

- **Acumulativo explícito, con el encabezado escrito arriba de los checks.** Basic: `What you can build:`.
  Growth: **`Everything in Basic and:`**. Pro: **`Everything in Growth and:`**. (Dicen «and:», no «plus:».)
- **Bullets: 5 / 6 / 4.** La columna recomendada es la que tiene **más** bullets, y el plan más caro tiene
  la lista más corta de las tres.
- **Cero topes numéricos dentro de los bullets.** El único número está en una línea aparte, arriba del
  encabezado, con el número en negrita: *«**2.500 contacts** included, unlimited email sends»*.
- **Recomendado: cinco señales apiladas** sobre Growth — banner verde sólido a todo el ancho con
  `MOST POPULAR` que sobresale por arriba y hace la columna más alta; borde verde; botón verde contra el
  negro de las otras dos; posición central; y **el CTA global del header apunta a
  `v3_kajabi_growth_monthly`**, o sea que quien entra por arriba cae preseleccionado en Growth, nunca en
  Basic. El ancho y el alto del cuerpo son iguales en las tres: el énfasis es color, no escala.
- **Fuera del barato (funciones enteras):** cohortes en vivo, programa de afiliados, automatizaciones
  avanzadas, webhooks, comment-to-DM. Y dos castigos que no son bullets: **AI credits = 0** en Basic (cero,
  no «—»: te muestran el contador en cero) y **«Powered by Kajabi» on footer** — no dicen «no incluido»,
  escriben el texto de la marca ajena que te va a quedar en el pie. Además **te cobran más por vender**:
  2,9 % vs 2,7 % de tarjeta, y 2 % vs 0,5 % por procesador externo.
- **«Para quién es»: una línea, entre el nombre y el precio**, y segmenta por **facturación**:
  *«Best for experts making their first $10k a year.»* / *«Perfect for getting to $50k a year and
  beyond.»* / *«Built for $200k+ a year businesses that want their own app.»*
- Extra: el pill `SAVE $600/YEAR` va al lado del **nombre** del plan, no del precio; y los dos últimos
  bullets de Growth y Pro son plata, no features («Discounted Kajabi Payments rate»), para cerrar con ROI.
  La tabla de 30+ filas está **colapsada** detrás de «Not sure what plan? Compare every feature».

### 3.5 beehiiv — <https://www.beehiiv.com/pricing>

- **Acumulativo explícito.** Free: `What's included...`. Lite: **`Everything in Free plan, plus:`**. Pro:
  **`Everything in Lite plan, plus:`**. Enterprise: igual.
- **Rompen su propia regla una vez, a propósito:** repiten el bullet `Ad monetization` en Lite **y** en Pro.
  Es el único bullet duplicado de toda la grilla, porque es el argumento de «esto te paga el plan».
- **Bullets: 6 / 6 / 8 / 7.** La recomendada (Pro) tiene la lista más larga. **Y cero topes numéricos en los
  bullets**: los suscriptores viven en un slider arriba de las tarjetas, que arranca en el tramo más chico
  (1.000) para que el primer precio que ves sea el mínimo.
- **Recomendado: tres señales** sobre Pro — badge `Most Popular` chico, **inline a la derecha del nombre**
  (no un banner), borde magenta, y la lista más larga. **No lo centran** (es la 3ª de 4), no es más grande,
  y **el botón es del mismo color que el de Lite**. Mucho menos agresivo que Kajabi.
- **Fuera del barato:** Free no puede cobrar nada (sin suscripciones pagas, sin red de anuncios) y no tiene
  **ninguna** automatización. Y para empujar de Lite a Pro: **«Remove beehiiv branding» es el bullet #1 de
  Pro**, antes que cualquier función técnica.
- **«Para quién es»: una oración en dos renglones, entre el nombre y el precio**, y segmenta por **momento /
  identidad**: *«The basics for creators just getting started.»* / *«For those ready to grow faster and
  start monetizing.»* / *«For creators and brands scaling content-led business.»*
- Extra, y es el recurso más replicable de toda la investigación: **micro-pills de valor pegadas al
  bullet** — `0% take rate` sobre «Paid subscriptions», y **`Avg. $39/mo` sobre «Ad monetization» en un plan
  que cuesta $49**. Cuantifican el ROI adentro de la propia lista. Y una barra **«All plans include»**
  arriba de todo, con 5 iconos, que neutraliza el miedo a que el plan barato esté mutilado *antes* de que
  mires las columnas. Headline: «EVERY PLAN IS BUILT FOR GROWTH».

### 3.6 ActiveCampaign — <https://www.activecampaign.com/pricing>

- **Acumulativo puro, repetido en las cuatro columnas:** **«Everything in Pro, and»** / **«Everything in
  Plus, and»** / **«Everything in Starter, and»**, y el único que no hereda, Starter, dice **«Includes»**.
  Ninguna columna se explica sola.
- **Dos bloques por columna, separados por una raya:** arriba 3 métricas con check azul, iguales en posición
  en las cuatro (contactos / envíos / asientos), para que el ojo compare números antes que funciones; abajo
  los diferenciales con punto, bajo el encabezado heredado. Total: 7 / 8 / 8 / 7.
- **Recomendado: cinco señales** sobre Pro — badge «RECOMMENDED» montado sobre el borde; **preseleccionado**
  (las tarjetas son `<input type=radio>` y `value:"professional"` llega con `checked: true`); degradado
  violeta con glow contra el azul plano de las otras; **el único botón sólido**; y posición 2 de 4.
- **El orden de columnas está INVERTIDO: Enterprise → Pro → Plus → Starter.** Lo más caro se lee primero.
  Es anclaje puro: ves $145 antes que $79. No hay tachado ni «ahorrás X%»: **su ancla es el orden**.
- **Fuera del barato (funciones enteras):** cross-channel marketing, IA generativa de texto e imagen,
  landing pages, site messages, ads de retargeting, sales automation, reporting de ventas e ingresos,
  catálogo de productos, cupones, las integraciones de Slack/Stripe/Calendly, y toda la marca blanca. Y
  graduaciones hechas para doler: segmentación Limited → Standard → Advanced → Premium; A/B testing «Email
  only» → «Email & Automation»; **business goals 15 → 25 → 200**; usuarios 1 → 1 → 3 (Plus no te da ni un
  asiento más que Starter: el asiento se compra con Pro).
- **«Para quién es»: una línea**, entre el nombre y el precio, siempre arrancando con «For»:
  *«For getting your first automations live.»* / *«For growing teams that want more personal messages.»* /
  *«For marketers who want AI to optimize every send.»*

### 3.7 HubSpot — <https://www.hubspot.com/pricing/marketing> y <https://www.hubspot.com/pricing/suite>

Es el contraejemplo útil, y vale leerlo al revés.

- **No hay lista de features en las tarjetas. Ninguna. Cero bullets.** No existe «Everything in Starter,
  plus» en ningún lado. La tarjeta es: nombre → párrafo de para-quién → «Starts at» → precio con el viejo
  tachado → asientos incluidos → toggle de facturación → CTA → **sólo dos ítems** con (i) (créditos y
  contactos) → `› See Details` colapsado → letra chica con el fee de onboarding obligatorio ($3.000 en
  Professional). Toda la diferenciación vive en una matriz de ~60 filas abajo.
- **No marcan ningún plan recomendado:** sin badge, sin preselección, sin borde, sin color, sin columna más
  grande; los cuatro CTA son naranja idéntico. **El «BEST VALUE» que aparece no es de un plan: es del
  toggle, pegado a «Pay Annually», que viene preseleccionado.** HubSpot no empuja un plan: empuja un plazo
  de pago.
- **«Para quién es»: 2 a 4 renglones**, y con un detalle que importa: *Free y Starter se describen por lo
  que son* («Essential marketing, sales, service, content, and data management software»), *Professional y
  Enterprise por a quién apuntan* («For marketing teams who want to effectively run omni-channel
  campaigns…»). Los de arriba son visiblemente más largos y empujan el precio hacia abajo en la tarjeta.
- **Fuera del barato:** A/B testing, contenido inteligente, automatización omnicanal (Starter: 10 acciones),
  lead scoring, publicar en redes (Starter no publica), reportes personalizados, SEO, gestión de campañas,
  WhatsApp, y los agentes de IA.
- **La lectura de negocio:** vacía la tarjeta a propósito porque no quiere que elijas solo arriba de $800:
  quiere que hables con ventas (Professional y Enterprise dicen «Talk to Sales», no «Buy now»).
  **Para MaKo es el molde a NO copiar**, porque Esencial y Pro se compran sin hablar con nadie.
- Nota de entorno: `hubspot.com/pricing/customer-platform` da 404; la URL real del Customer Platform es
  `/pricing/suite`.

### 3.8 Lo que se saca de los siete

| | GHL | Systeme | ClickFunnels | Kajabi | beehiiv | ActiveCampaign | HubSpot |
|---|---|---|---|---|---|---|---|
| Patrón de lista | «Everything in X, plus» | sin lista (prosa) | **lista completa repetida** | «Everything in X and:» | «Everything in X plan, plus:» | «Everything in X, and» | **sin lista** |
| Bullets por columna | 7/7/3 | 0 | 11/13/13/14 | 5/**6**/4 | 6/6/**8**/7 | 7/8/8/7 | 0 |
| Topes dentro de los bullets | sí | — | **sí, son los bullets** | **no** (línea aparte) | **no** (slider) | sí (3 arriba) | no |
| Recomendado marcado | 4 señales | **ninguno** | 3 señales | **5 señales** | 3 señales | 5 señales | **ninguno** |
| «Para quién es» | 1 línea | en prosa | 1 línea | **1 línea** | 1 oración / 2 renglones | 1 línea | 2-4 renglones |

1. **Cinco de siete usan «todo lo del anterior más».** Es la norma del rubro, y Martín lo está rechazando a
   propósito. El único que lista cada columna completa es ClickFunnels — **que es el que más se parece al
   cliente de MaKo** — y lo resuelve con los mismos labels en todas las columnas y **negrita selectiva**.
2. **Los dos que mejor venden el plan del medio (Kajabi y beehiiv) sacaron los números de los bullets.** Los
   topes van en una línea aparte o en un slider; los checks son funciones puras, cortas, 4 a 8. La columna
   de Esencial de MaKo hoy tiene **5 de 7 renglones que son números** (`app/planes/Tarjetas.tsx:81-89`):
   es, literalmente, una lista de lo que no te alcanza.
3. **Nadie pone 15 bullets.** El rango de las siete es 0 a 14, y la mediana de las que sí tienen lista es 7.
4. **La palanca de upgrade más barata que existe es sacar la marca ajena**, y los dos la ponen en el plan
   del medio: «No Kajabi branding anywhere» en Growth, «Remove beehiiv branding» como bullet **#1** de Pro.
   MaKo ya tiene esa palanca y la está desperdiciando: `web.dominios: 0` en Esencial
   (`lib/topes-plan.ts:37`) está hoy en la columna de Pro escondido en un renglón compartido
   («Comunidad y dominio propio», `app/planes/Tarjetas.tsx:76`).
5. **El primer bullet de la columna del medio no es la función más grande: es la que más duele.**
6. **Lo que separa tiers tiene que ser una función con nombre propio.** Systeme le puso el nombre del plan a
   una sola función («Webinar») y no necesita badge. ClickFunnels concentra **todo** el salto funcional en
   Launch → Scale.

---

## 4. La propuesta para MaKo

### 4.1 La frase de «para quién es», una línea por plan

Va **entre el nombre y el precio**, que es donde la ponen Kajabi, beehiiv y ActiveCampaign, y es donde ya
está hoy (`resumen`, `app/planes/Tarjetas.tsx:195`). Reemplaza a los `resumen` de
`lib/planes-mako.ts:129`, `:152` y al `resumen` del programa.

Escritas en **español neutro con tuteo**, como el resto de lo que lee un cliente (la regla de la casa:
`lib/capas.ts:106-109`), y segmentando por **momento del negocio**, que es lo que pidió Martín («si estás
solo o si sos una empresa chiquitita» / «si ya tenés equipo» / «si querés impulsar tu negocio en poco
tiempo»):

- **MaKo Esencial** — «Para quien vende solo: tu página, tus leads y tu WhatsApp, por fin en un solo lugar.»
- **MaKo Pro** — «Para quien ya vende y tiene equipo: MaKo produce, pauta y responde, y tú apruebas.»
- **MaKo Acelerador** — «Para quien quiere su sistema de ventas instalado en 90 días, no armarlo solo.»

El eje de las dos primeras es el que hace que cada columna «se sienta única» sin decir «todo lo de X»:
**Esencial = lo haces tú, con MaKo al lado. Pro = MaKo lo hace, tú apruebas.** No es una metáfora de
marketing: es exactamente lo que el código ya cierra (`ia-editores`, `setter-ia`, `piloto-redes`, el piloto
de ads, `replicar-landing`, `closing-analyst` son todas «MaKo lo hace solo»). Y MaKo ya tiene las dos
cejas escritas para el otro eje: `CEJA_SOFTWARE` / `CEJA_PROGRAMA` (`app/planes/Tarjetas.tsx:56-57`).

### 4.2 Los checks de cada columna, completos y autosuficientes

El molde es **ClickFunnels con la prosa de Kajabi**: las dos columnas cubren **las mismas 8 áreas, en el
mismo orden**, cada una completa y autosuficiente; ninguna dice «todo lo de X»; y la de Pro gana renglón por
renglón, con el mismo par de ojos. Los números salen de la columna y van en una **línea aparte arriba de los
checks**, como Kajabi, para que los bullets sean funciones puras.

#### MaKo Esencial — US$47/mes

> **Lo haces tú, con MaKo al lado**
> 2.000 leads · 1 pipeline · 1 página · 1 WhatsApp · 2 automatizaciones
> 1 competidor · 1 curso · 1 cuenta de cobro · 1 usuario

1. Tu página de venta, escrita por IA y publicada en un clic
2. Tu CRM: cada lead con su etapa, su historia y de qué anuncio vino
3. WhatsApp, Instagram, Messenger y email en una sola bandeja
4. Guiones de reels, anuncios, VSL y emails, escritos por IA
5. Editor de imágenes y editor de video, con tu marca y tus colores
6. El radar de tu competencia: su web, sus redes y sus anuncios
7. Mejoras para tus anuncios cada día, y tú decides si las aplicas
8. Tu curso para tus alumnos, dentro de MaKo

#### MaKo Pro — US$97/mes · **Recomendado**

> **MaKo lo hace, tú apruebas**
> Leads, pipelines, páginas, automatizaciones, competidores y cursos sin tope
> 3 WhatsApp · 5 personas de tu equipo

1. **Copia la landing de cualquier competidor con tu oferta**, con tu dominio propio
2. **Edición con IA de tus videos:** corta las pausas, subtitula y propone B-roll solo
3. **Un setter con IA** que responde y agenda por WhatsApp e Instagram
4. **Piloto automático** de tus anuncios, tu Instagram y tu YouTube
5. **Toda tu competencia en el radar**, con sus guiones y sus carruseles replicados
6. **Tus llamadas de venta analizadas con IA**, llamada por llamada
7. **Cursos sin tope y la comunidad de tus alumnos**, como en Skool
8. **Tu equipo adentro:** hasta 5 personas, cada una con su acceso

Detalles del molde, con el porqué:

- **Las 8 áreas se corresponden una a una** (página / CRM-ventas / chats / contenido escrito /
  contenido visual / competencia / anuncios / entrega-equipo). Leído en paralelo, Pro gana en las 8 sin que
  en ningún renglón diga «lo de Esencial». Leído solo, cada uno se entiende.
- **Toda la negrita de Pro, ningún renglón en negrita en Esencial** (ClickFunnels, 3.3). La columna barata
  queda visualmente plana sin que le falte un solo renglón: no se le puede acusar de esconder nada.
- **Ningún número adentro de un bullet** (Kajabi y beehiiv, 3.4 y 3.5). Los números van arriba, en una
  línea sola. Hoy 5 de 7 renglones de Esencial son números: eso hace que la columna barata se lea como una
  lista de carencias, lo cual está bien para empujar a Pro pero mal para vender Esencial, y Esencial
  igual hay que venderlo.
- **El bullet #1 de Pro es el que más duele, no el más grande** (beehiiv). «Copiar la landing del
  competidor» es la línea que Martín nombró primero y la que un negocio que ya vende quiere ya mismo. El
  dominio propio va pegado ahí, no escondido en el renglón 7 como hoy: es la palanca de la marca ajena
  (3.8 §4).
- **El último bullet de las dos columnas es tranquilidad** (beehiiv): la entrega de lo que vendiste.
- **La insignia «Recomendado» suma dos señales a las que ya tiene.** Hoy son tres (insignia + borde azul +
  sombra azul, `app/planes/Tarjetas.tsx:112-114`, `:193`). Kajabi y ActiveCampaign apilan cinco. Faltan: el
  botón de Esencial en outline y el de Pro sólido (hoy ya pasa: `borde` se calcula de `destacado`,
  `app/planes/Tarjetas.tsx:188`, así que esto ya está) y **la lista de Pro más larga o igual que la de
  Esencial** — en los dos casos que mejor venden el del medio, la columna recomendada tiene **más** bullets
  (Kajabi 5/6/4, beehiiv 6/6/8/7). Con 8 y 8 queda parejo; si hay que desempatar, el que suma un renglón es
  Pro, nunca Esencial.
- **Una barra «En los dos planes» arriba de las columnas** (el «All plans include» de beehiiv): MaKo tu
  asistente con IA, el chat con los referentes, tu oferta revisada con IA, tus tableros y tus tareas
  priorizadas. Son las 5 cosas sin tope de §2.2 y hoy ocupan renglón en la columna de Esencial sin
  diferenciar nada; arriba, neutralizan el miedo a que el barato esté mutilado **antes** de comparar.

#### MaKo Acelerador — US$1.500 en 3 cuotas

La columna del programa es la única donde «Todo lo de MaKo Pro, más:» **sí funciona**, porque no compite
contra Pro: compite contra «me lo armo solo». Pero se puede escribir sin la fórmula, poniendo MaKo Pro como
un check más y primero:

1. MaKo Pro completo, los 3 meses
2. Tu página, tus mensajes y tus seguimientos armados la primera semana
3. 12 asesorías en vivo con Martín, una por semana, con su grabación
4. Plantillas probadas de páginas, mensajes y guiones
5. Un grupo de WhatsApp con respuestas de Martín

La promesa (`lib/planes-mako.ts:276`) se queda donde está, arriba de los checks, que es lo que la hace la
única columna con «factor de promesa».

### 4.3 Qué queda FUERA del Esencial a propósito

**Lo que ya está cerrado y se queda cerrado** (§2.2), con el argumento de cada uno:

| Qué | Por qué no mata al cliente chico | Por qué empuja a Pro |
|---|---|---|
| **Edición con IA** de video e imagen (`ia-editores`) | Le quedan los dos editores enteros, a mano, que es lo que hacía en CapCut y Canva. Y los subtítulos y quitar el fondo corren en su navegador: siguen en los dos planes (`lib/planes-comparacion.ts:76-77`) | El que publica todos los días no edita 20 clips a mano. Es la línea que Martín nombró textual |
| **Copiar la landing de un competidor** (`replicar-landing`) | Arma su landing desde cero con IA, y la publica. Tiene página | El que ya vende no quiere empezar de cero: quiere la landing que YA convierte |
| **Setter con IA** (`setter-ia`) | Le quedan «Para aprobar» y «Sólo te avisa» (`docs/ofertas-mako.md:26-27`): la automatización le redacta y él manda | Con volumen de DM no contesta él. Es el renglón que convierte conversaciones en llamadas |
| **Los tres pilotos automáticos** (ads, Instagram, YouTube) | Ve 2 mejoras por día y las aplica con un toque: entiende qué cambiar | Con 5 campañas, 2 por día no alcanza, y nadie entra todos los días a apretar |
| **La comunidad** (`comunidad`) | Entrega su curso igual, con módulos y clases | El que vende high ticket vende la comunidad como parte de la oferta |
| **Closing Analyst** | El que vende solo escucha sus propias llamadas | Con closers no puede escuchar 40 llamadas por semana |
| **Dominio propio** (`web.dominios: 0`) | Publica en el subdominio de MaKo: tiene una URL que funciona hoy | Es la marca ajena en su página. La palanca más barata del rubro (3.8 §4) |
| **Scrapear grupos de WhatsApp** | Carga sus contactos a mano o por CSV | El que ya tiene grupos los quiere adentro del CRM en un clic |

**Lo que hay que cerrar y hoy está abierto** — esto es lo que falta para que Esencial quede «bien limitado y
restrictivo» y para que Pro sea «la gran mayoría de cosas que están en la landing principal». Son cuatro
cosas, y **las cuatro son cambio de código, no de copy**:

1. **AI Avatar.** Martín lo nombró primero («el de 97 ya podés generar avatares de IA») y hoy está abierto
   en los tres planes desde el 29/10 (`app/ai-avatar/acceso.ts:4-5`). Es la fila 7 de la portada. Hay que
   volverlo a `TABS_SOLO_PRO` (`lib/topes-plan.ts:55`) o sumarlo a `FUNCIONES_SOLO_PRO`. **Ojo:** la tabla
   todavía no lo vende (`AI_AVATAR_SE_VENDE = false`, `lib/planes-comparacion.ts:67`), así que cerrarlo en
   Esencial y venderlo en Pro son dos decisiones distintas: la segunda espera que ande de punta a punta.
2. **Replicar el guion y replicar el carrusel de la competencia** (filas 4 y 5 de la portada,
   `app/vsl/_sitio/datos.ts:251-252`). Hoy sin tope en los tres (`lib/planes-comparacion.ts:115-116`). Son
   la misma palanca que «copiar la landing», que sí es de Pro: el criterio tiene que ser uno. Si copiar lo
   que ya funciona es de Pro, es de Pro en los tres lugares donde MaKo lo hace.
3. **El chat con los referentes** (`lib/planes-comparacion.ts:143`). Es la fila 2 de la portada y hoy no
   tiene tope. Un tope limpio: **un referente en Esencial, todos en Pro** — es un tope nuevo
   (`asesores.referentes`) en `lib/topes-plan.ts:30-46` y un freno en el chat.
4. **El Video Generator** (generar el anuncio con IA, `lib/planes-comparacion.ts:112`): tampoco se vende
   todavía, y cuando se venda tiene que nacer en Pro, no en los tres.

Y una cosa que **NO** hay que cerrar, por si aparece en la discusión: el Second Brain, el Ops Center, el
Plan con el Perro Guardián y los tableros. Son el motor que hace que alguien se quede, y son justamente lo
que la prueba gratis deja usar entero a propósito (`lib/topes-plan.ts:88-89`: «El resto del motor… anda
entero: es lo que los hace quedarse»). Limitar eso baja la retención del de 47 sin mover a nadie a Pro.

### 4.4 Lo que hay que tocar si Martín lo aprueba

En orden, y nada de esto está hecho:

1. **`app/planes/Tarjetas.tsx:67-90`** (`listaCorta`): las dos listas nuevas, el título de la columna Pro
   (hoy `'Todo lo de Esencial, más:'`, `:70`), la línea de topes arriba de los checks y la negrita selectiva
   (hoy el CSS de la lista no tiene variante en negrita, `:129-133`). **Es acá y no en `incluye`** (§1.4).
2. **`lib/planes-mako.ts:129`, `:152`, `:258`**: los tres `resumen`.
3. **`app/planes/Tarjetas.tsx:231`, `:93-98`**: el título y la lista del Acelerador.
4. **La barra «En los dos planes»**: componente nuevo arriba de `.mkpl-grilla`
   (`app/planes/Tarjetas.tsx:184`).
5. **`lib/planes-mako.ts:130-141`, `:153-169`**: o se borra `incluye` de los dos planes (y el `??` del
   checkout queda como fallback real del setting), o se deja y se documenta que no se renderiza. Hoy miente.
6. **Los cuatro cierres de §4.3**: `lib/topes-plan.ts:55` y `:70`, más el tope nuevo de referentes en
   `:17-27` y `:30-46`, cada uno con su freno en su área.
7. **`tests/planes-tres-bloques.test.ts`** fija el contenido de las tarjetas y la paridad con
   `/reembolsos`: cualquier cambio de copy pasa por ahí. Y los topes nuevos tienen sus tests
   (`tests/classroom-topes-esencial.test.ts`, `tests/crm-topes-plan-23-10.test.ts`,
   `tests/media-buyer-topes.test.ts`, `tests/plan-esencial.test.ts`) como molde.
