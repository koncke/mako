# Plan final: MaKo toma la iniciativa en cada chat

Medido contra `origin/main` `4b8f8145d` (29/10/2026, 20:55), leído con `git show` en `C:/dev/wt-push-q` sin tocar el árbol.
Revisado de forma adversarial contra el mismo commit: las líneas citadas se releyeron. Nada se vio en el navegador.

**Base ganadora: `diseno-estado.md`.** MaKo mira el ESTADO (lo que tiene el negocio, la pieza abierta) y pregunta el primer
hecho que falta. Gana porque cumple mejor las reglas de Martín:
- la primera pregunta es un hecho y un test lo exige;
- el estado se lee vivo y una lectura caída no se dice como «no tienes»;
- no hay prompts nuevos;
- vio que las respuestas rápidas del hilo no andan sin la app.

**Lo que se toma de `diseno-guion.md`:**
- las acciones de cada apertura en un `Record` tipado: `tsc` falla si se ofrece algo que la tab no tiene, así no se promete
  lo que no está en producción;
- los pasos comunes (`pasoOferta` con 0, 1 o varias ofertas, `pasoObjetivo` que se salta si el funnel lo dice);
- el `porqué` del funnel escrito con los datos de la persona, y respetando siempre su canal;
- el caso «tiene la app, pero no su IA»;
- el workspace dentro de la clave de la memoria, y que el super admin escriba en SU perfil;
- guardar el link del borrador del plan, que hoy se pierde;
- la tabla de botones de barra.

**Correcciones medidas en `origin/main`:**
- `/api/recorridos` escribe en el perfil de la SESIÓN: mirando un cliente, el super admin escribe en el suyo. `guardado: false`
  es sólo «sin fila propia» (cabecera de app/api/recorridos/route.ts).
- `sinSubtitulos` (subtitles/insert.ts:71) BORRA subtítulos, no los detecta. El detector es `subtitulosDe(...)` (:45).
- `cs_servicio` no se cierra contestando: es «Crea tu producto en el CRM» (ChecklistClientes.tsx:35-37).
- El registro de /configuraciones sólo tiene prompts de IA (system, user, instruction, whisper, vision). Los textos que arma el
  código (`SALUDO_ARRANQUE`, `PEDIDO_DOCUMENTO`, el arranque del Media Buyer) no están. Una apertura no es un prompt.

---

## 1. Qué pidió Martín

> «en todos lados que haya un chat de MaKo, que MaKo te vaya guiando dependiendo del template que se eligió, o […] de la
> situación […] EN LUGAR de que esté en la top bar "adaptar con MaKo" […] que al costado esté "hola, ¿quieres que adapte este
> guión a tu oferta? dime cuál oferta…" […] Es súper importante que cuando esté comenzando el usuario […] que MaKo tome la
> iniciativa […] "lo primero que te recomiendo es que cargues tu oferta" […] "¿qué funnel te gustaría? […] ¿o quieres que te
> recomiende uno?", alimentado por su presupuesto, qué funnel desea, qué ya está haciendo o qué resultado le trajo».

Su frase literal («¿quieres que adapte…?») pregunta una acción. Su regla pide el hecho: «¿Para cuál de tus ofertas es?».
Adaptar es la consecuencia.

---

## 2. El patrón común

### 2.1 Qué es una apertura
Es el primer mensaje de MaKo en un chat:
- lo arma el CÓDIGO, sin IA y sin gastar la IA de nadie;
- es una o dos frases, y la última es UNA pregunta de hecho;
- lleva de 2 a 4 botones, y el primero es el recomendado.

La función de cada superficie devuelve `null` si no falta nada, y entonces MaKo calla. **No es una recomendación**: esas son
`lib/recomendaciones*.ts` (señal medida y plegadas). **No es un recorrido**: no tapa la pantalla.

### 2.2 Los datos (puros, con test)
`lib/aperturas/`: `reglas.ts` (tipos, topes, memoria pura), `comunes.ts` (`pasoOferta`, `pasoObjetivo`), un archivo por
superficie (`ops.ts`, `copywriter.ts`, `crm.ts`…) y `ops-server.ts`, que lee los hechos. El molde es
`lib/media-buyer/arranque.ts` (`pasoDeArranque`, `preguntaDe`, `opcionesDe`, `mensajesDeArranque`).
**No hay un `catalogo.ts` a mano:** cada superficie exporta su `CATALOGO` y sus `EJEMPLOS` (los hechos de prueba) en SU
archivo, y el test los junta leyendo `lib/aperturas/*.ts`. Con una lista central, las tandas T5 a T17 (chats distintos)
editarían el mismo archivo y el mismo test a la vez.

```ts
type Apertura = { id: string; alcance: 'negocio' | 'entidad'; entidad?: string; texto: string; botones: Boton[]; corto?: string };
type Boton =
  | { tipo: 'respuesta'; rotulo: string; valor: string }  // un hecho: la función se vuelve a correr con él
  | { tipo: 'ir'; rotulo: string; href: string }          // un link que la persona elige (nunca navega solo)
  | { tipo: 'hacer'; rotulo: string; accion: string }     // código de la tab, sin IA (crear el funnel, subtítulos…)
  | { tipo: 'pedir'; rotulo: string; pedido: string }     // la IA del negocio, con el texto armado por el código
  | { tipo: 'callar'; rotulo: 'Ahora no' | 'Lo hago yo' | 'Lo edito yo' | 'Lo escribo yo' };
```

Cada superficie exporta tres cosas: `hechosDe…`, `apertura(h)` y `alResponder(h, valor)`. Declara también sus `hacer` y sus
`pedir`, y el montaje los recibe en un `Record` tipado: si el catálogo nombra una acción que la tab no implementa, `tsc` falla.

`tests/aperturas.test.ts` corre cada apertura con hechos de ejemplo y revisa:
- el primer paso y el `corto` terminan en `?` y no preguntan una acción (`PREGUNTA_DE_ACCION`:
  `/¿\s*(quieres que|te ayudo|lo (adapto|armo|escribo|hago|cargo|creo|subo)|(adapto|armo|creo|genero|hago|cargo|conecto)\b|(cargamos|armamos|creamos|conectamos|hacemos|empezamos|arrancamos)\b)/i`;
  sin la primera persona del plural, «¿Cargamos tus clientes?» pasaba);
- el texto tiene 160 caracteres o menos, cada rótulo 28 o menos, y el `corto` 4 palabras o menos;
- `marcasDeVoseo` (lib/puestas-data.ts:499) sale vacío;
- hay de 2 a 4 botones, y cada paso tiene un botón que avanza además del de callar;
- cada `id` del catálogo tiene un llamador en `app/`, porque `primerMensajeDeEjemplo` hoy es código muerto.

### 2.3 El componente: `app/_chat/AperturaMako.tsx`
- El mensaje es un ítem de `HiloMako`. Abajo van sus botones propios, con `.of-pill`; el recomendado va con `.of-pill--mako`
  (app/offer/estilos.ts:38). Es lo que hace `ArranqueMediaBuyer.tsx`, que monta `<style>{CSS_OFFER}</style>` (:115): fuera de
  Offer esas clases no existen.
- **No contradice la regla del bloque** (AGENTS.md:1913, «todo lo que espera a Martín arriba de la caja va en UN bloque»): la
  apertura es un mensaje de MaKo EN el hilo, no una tarjeta arriba de la caja ni una lista. El bloque sigue siendo de las
  decisiones y las sugerencias, y con algo en él la apertura calla (2.7).
- **No usa el bloque `pregunta` del hilo:** su `onResponder` llama a `k.enviar` (PiezasCliente.tsx:109), y `enviar` devuelve
  `false` sin la app (useChatCliente.ts:595). **Tampoco usa `BloqueDePreguntas`:** lo de la tab sale plegado por decisión
  del 22/10 (PreguntasDelChat.tsx:201).
- Lo tocado queda como burbuja local de la persona y aparece el paso siguiente. No hay «Siguiente».
- Un `hacer` termina con un toast de 3 o 4 palabras («Funnel creado», «Subtítulos listos», «Estructura lista»).
- **Lo escrito en la caja no se lee como respuesta.** Va al chat como siempre y la apertura se cierra. La excepción es una
  pregunta explícita de texto libre («¿Qué vas a vender con esto?»). No se escribe otro lector de frases: el onboarding
  necesitó tres rondas de reglas (21/10).
- Mientras hay una apertura, las píldoras genéricas de la superficie se esconden. Es la regla de un paso por pantalla.
- No arma ninguna caja: `tests/chat-unico.test.ts` tiene que seguir verde.

**Dónde se monta:**

| Hilo | Dónde | Archivo |
|---|---|---|
| El Cerebro (Ops Center, la estrella, la tarjeta de Create) | Con el hilo vacío, en lugar de la portada, también bloqueado. Con historia, después del último mensaje, local. Nunca se guarda. | `app/second-brain/PiezasCliente.tsx:81-111`, `app/_chat/MakoEnLaTab.tsx:81/175` (prop `apertura`) |
| Los chats propios | En el lugar del saludo fijo, con el chat vacío | Copywriter `PanelMaKo.tsx:483-498` · Video `PanelChat.tsx:586-596` · Image `PanelMakoIA.tsx:228-234` · Offer `OfferApp.tsx:1076-1087` · Automations `ChatMakoVista.tsx` / `ChatMako.tsx:211-212` · Web `PanelAgente.tsx:1027` |

**La estrella cerrada** (`MakoEnLaTab`, `useState(false)` en :108):
- con una apertura de alcance `negocio`, muestra al lado el `corto` (un hecho: «¿Dónde están tus clientes?»), como mucho uno
  por día en toda la app;
- se abre SOLA una sola vez (D3);
- nunca más se abre sola.
- **Cerrada hoy no le pide nada al servidor** (MakoEnLaTab.tsx:21, «el motor se monta sólo con el panel abierto»). El `corto`
  y D3 necesitan UN `GET /api/aperturas` liviano con el panel cerrado, sin montar el motor. Ese ⚠️ se reescribe en T1.

### 2.4 El registro: la memoria por persona
- **Dónde vive:** en `usuarios.perfil.aperturas`, al lado de `recorridos` (mig 0056). No hace falta migración.
- **La ruta:** `app/api/aperturas/route.ts`, una copia de `app/api/recorridos/route.ts`.
  - La fila sale del email de la SESIÓN.
  - Escribe con compare-and-set sobre `updated_at`.
  - Tiene respaldo en `localStorage` por huella.
  - `GET ?superficie=` devuelve `{ memoria, apertura }`. `POST { clave, d, valor?, pendiente? }` anota y no ejecuta nada.
- **La clave:** `"<ws>:<id>[|<entidad>]"`. El perfil cruza negocios (agencias, el super admin), por eso lleva el workspace.
- **Lo que se anota:** `d` puede ser `vista`, `respondida`, `ahora-no` o `nunca`. Hay un tope de 200 claves y se van las más
  viejas.
- **Lo que se recuerda:** sólo lo que la persona DECIDIÓ y los hechos que contestó (`valor`). Las claves se comparten:
  - `negocio:whatsapp` en la escalera y en Automations;
  - `negocio:clientes` en la escalera y en el CRM;
  - `negocio:funnel` en la escalera, en Offer y en el CRM.
- **El super admin mirando** escribe en SU perfil, con el workspace del cliente en la clave. Los `hacer` usan la misma acción
  que el botón de la tab, con sus mismas guardas.

### 2.5 La IA del negocio
- Entra **sólo con un botón `pedir`**. El código arma el texto con lo contestado («Adapta esta página a «Mentoría 90 días».
  Quien la vea tiene que agendar una llamada.») y ese texto se dibuja como mensaje de la persona.
- Viaja por el camino que la superficie ya tiene:
  - el Copywriter, `adaptar` / `pedirEdicion`;
  - el Cerebro, el turno de `useChatCliente`;
  - el lienzo de Automations, su chat;
  - el Web Generator, su agente.
- **Ningún prompt cambia.** En el Copywriter, la oferta elegida va primera en `{{negocio}}` y lo contestado va en `{{charla}}`
  de `copywriter.adaptar.user`: no hay slots nuevos. Si algún día una superficie necesita instrucciones para la IA, van en una
  key aparte con `add-editable-prompt`.
- La oferta elegida se lee por id con `listarOfertas` (lib/ofertas.ts:64) y nunca del grafo, que tiene caché de 3 minutos.
- El crédito de la plataforma no entra en ninguna apertura: sólo lo usa el onboarding.

### 2.6 Sin la app de escritorio
- **La apertura se dibuja igual.**
  - `PiezasCliente.tsx:99` hoy devuelve `null` bloqueado. Sigue sin dibujar la portada, pero sí la apertura, porque sus
    botones andan.
  - `PanelMaKo.tsx:322` apaga «Solo la estructura» sin la app (`puede` incluye `!appEscritorio.bloqueada`), aunque no usa IA.
    Se separa un `puedeSinIA`.
- **`respuesta`, `ir`, `hacer` y `callar` funcionan siempre.**
- **Un `pedir` sin IA lista** inserta un paso común. Lo contestado queda como `pendiente` en la memoria.
- **Bloqueado, la caja no deja escribir**: una pregunta de texto libre («¿Qué vas a vender con esto?» de `pasoOferta`) no se
  puede contestar. Sin la app, ese paso sale sin el texto libre: [Cargar una oferta ★] (`ir` /offer) · [Ahora no].
- **El «Instalar MaKo» de la apertura es la MISMA pieza que el de la caja** (`InstalarMaKo`, con el «ya lo descargó»
  compartido de app-de-escritorio.ts): bloqueada, la caja ya lo muestra en el lugar del micrófono (AppPrimero.tsx), y los dos
  pasan juntos a «Ya lo instalé: conectar».

| Estado | MaKo | Botones |
|---|---|---|
| Computadora sin la app | «Para escribirlo uso tu Claude o tu ChatGPT, desde la app de MaKo.» | [Instalar MaKo ★] (`InstalarMaKo.tsx`: descargar, después «Ya lo instalé: conectar») · [Ahora no] |
| La app, sin su IA (`?suIA=1` → `conectada: false`) | «Conecta tu Claude o tu ChatGPT y lo escribo.» | [Conectar tu IA ★] (`TusCuentasIA`, ahí mismo) · [Ahora no] |
| Se conectó con algo pendiente (useChatCliente relee bloqueado) | «Ya tengo tu IA. Lo escribo para «Mentoría 90 días» cuando quieras.» | [Escríbelo ★] · [Ahora no] (`callar` sólo admite sus cuatro rótulos: «Después» no compila) |

- **En el teléfono** (`en-la-computadora`) no se bloquea: el `pedir` sale como hoy.

### 2.7 Cuándo MaKo se calla
| Regla | Por qué |
|---|---|
| Una apertura por pantalla. Con un chat de entidad abierto, la estrella no suma la suya | Un paso por pantalla |
| Las de alcance `negocio` hablan una vez por día. Contestada, la cadena sigue; si no, calla hasta mañana | No insiste |
| «Ahora no» → 14 días; dos «Ahora no» → `nunca`. Tres `vista` sin respuesta → 14 días | Lo mismo que el motor de recomendaciones |
| «Lo hago yo», «Lo edito yo», «Lo escribo yo» → `nunca` para ESA pieza | Lo dijo |
| La de una pieza es el vacío de su chat: con un mensaje en ese chat no vuelve | El hilo ya es la conversación |
| Nada mientras corre un recorrido (su velo tapa el chat), un trabajo de MaKo (`k.trabajo`, `k.enCurso`) o hay algo en el bloque de preguntas | Una cosa por vez; lo medido va primero |
| Nada si el hecho cambió | El estado se lee vivo: no hay que «marcarla hecha» |
| Por rol: closer y setter no ven oferta ni funnel. Por capa y plan: se saltea lo que la capa no ve (`requireCapa`) o Esencial tiene con candado (lib/plan-esencial-reglas.ts) | No manda a una pared |
| Una lectura que falla se saltea; ninguna apertura afirma «no tienes…» | Un eje vacío es «no se sabe» |

### 2.8 Decidido (con el porqué)
- **D1. El arranque se queda en `/onboarding`** y el Ops Center lo continúa con la escalera (3.2). Es lo único que paga la
  plataforma, anda sin la app y ya es MaKo hablando primero. Cierra el Anexo C, punto 7, de `docs/ops-center-principal.md`.
  G18 («Propuestas al entrar», 3 tarjetas) queda cubierta con UNA propuesta.
- **D2. El funnel:** primero el hecho («¿Cómo te llegan hoy los clientes?»), después la recomendación con «Ver los 12».
- **D3. La estrella se abre sola una vez** por tab: «si no hay nada de interacción, el usuario se pierde». Se revierte con una
  línea. **El disparador no es «onboarding pendiente»:** de las tabs con estrella, sólo Calendario, Clientes y el Media Buyer
  tienen onboarding en lib/tab-onboarding-catalogo.ts (CRM, Dashboard, General y Plan no), y esas tres ya lo muestran (el
  modal de Google, app/calendario/page.tsx:17; el checklist arriba de la cartera; `ArranqueMediaBuyer`). Se abre sola en la
  primera visita de la persona a una tab con estrella que tiene una apertura de alcance `negocio`, y sólo si no hay nada
  encima: ni un modal, ni un recorrido, ni el checklist o el arranque de la tab.
- **D4. «Editar con IA» de la barra de formato del Web Generator se queda.** Actúa sobre lo elegido, como «Conclusiones con
  MaKo».
- **D5. Los textos de las aperturas viven en el código**, como `SALUDO_ARRANQUE`. Hacerlos editables queda en la sección 6.

**Archivos de `origin/main` que toca la base:**
- `app/_chat/MakoEnLaTab.tsx`
- `app/second-brain/PiezasCliente.tsx`
- `AGENTS.md` (la regla, sección 5, T1)

`app/copywriter/PanelMaKo.tsx` (`puedeSinIA`) NO es de la base: es de T5, el chat Copywriter. Si lo tocaran los dos, serían
dos chats en el mismo archivo.

Se reusan sin tocarlos:
- `lib/recorridos.ts` y `app/api/recorridos/route.ts`, como molde;
- `app/_chat/useAppDeEscritorio.tsx`, `app/_chat/InstalarMaKo.tsx` y `app/integraciones/TusCuentasIA.tsx`;
- `app/m/mako/chat-ui.ts` (`itemsDeOffer`).

---

## 3. El primer ingreso, mensaje por mensaje

### 3.1 En `/onboarding` (admin nuevo, computadora)
«=» = el texto de hoy, sin cambios. «Δ» = cambia.

| # | MaKo | Botones | |
|---|---|---|---|
| 1 | «¡Hola! Soy MaKo. Para dejar tu cuenta lista necesito conocer tu negocio: son unas preguntas rápidas, menos de 5 minutos. Para empezar, ¿cómo te llamas?» | — (Martín, 18/10: sin respuestas rápidas) | = `SALUDO_ARRANQUE` (lib/onboarding-arranque.ts:198). El de hoy no tiene «bienvenido»: el motivo del cambio (el género) no existe, y cambiarlo sólo dispara el guard de «pestaña vieja» |
| 2 | «Un gusto, Ana. ¿Cómo se llama tu negocio?» | — | = |
| 3 | «Gracias, Ana. Lo primero es tu oferta: con ella conozco Cierre Consultivo y te ayudo en todo lo demás.» | — | Δ `arr-oferta` (:1024). Es la frase de Martín |
| 4 | «¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web o landing? Súbelo o pégalo aquí.» | [No tengo, pregúntame] | = `PEDIDO_DOCUMENTO` |
| 5… | La charla de lo que vende (crédito de la plataforma) | | = |
| 6 | «Perfecto: ya tengo claro qué vendes. Te armé un PDF con tu oferta, ¿está correcto?» | [Sí, está correcto] [No, faltan cosas…] | = |
| 7 | «Entendí que cobras así: «2 pagos de USD 650». ¿Es así?» | las lecturas | Δ (:1049): «¿Lo cargo así?» pregunta una acción, el mismo motivo por el que se va `CRM_PREGUNTA` |
| 8 | Las preguntas de fase: facturación, **inversión** (el presupuesto), piezas por mes, **«¿Dónde cierras la venta?»**, volumen, **«¿Cómo está tu funnel hoy?»** (el resultado de lo que ya hace), cuello | sus 5 opciones | = |
| 9 | **«¿Cómo te llegan hoy los clientes?»** (lo que ya hace). Sólo si cierra por llamada o por chat: con webinar, carrito o presencial, el canal ya decide | Llamada: Agendan llamada · Llenan un formulario · Tú les escribes · Todavía no me llegan. Chat: Te escriben · Llenan un formulario · Tú les escribes · Todavía no me llegan (los rótulos de `ENTRADAS`, lib/pipeline.ts:781). Sin «Dejan sus datos en el anuncio»: no se ofrece desde el 29/09 (`ENTRADAS_OFRECIDAS`, :837, «más simple»), tiene 29 caracteres y sería el quinto botón | Δ **reemplaza `CRM_PREGUNTA`** (:178, «…¿Te sirven?», que pregunta una acción) |
| 10 | **«Hay 12 funnels en MaKo. Para ti: «Instagram orgánico». Inviertes menos de $600 al mes: empieza sin pagar anuncios.»** + la tarjeta con las etapas (`crmOffer` las renombra con UN candidato, como hoy) | [Sí, ese ★] [Ver los 12] | Δ el tipo lo decide `recomendarFunnel` (3.3), nunca la IA |
| 11 | «¿Cómo llegaste a MaKo, Ana?» | `ORIGENES` | = |
| 12 | «¿Qué te gustaría que MaKo resuelva primero?» | `INTERESES` | = (ahora ordena la escalera) |
| 13 | El teléfono y el código | [Ahora no] | = |
| 14 | «¡Listo!» y entra al chat «Onboarding» | | Δ guarda en `EstadoArranque` el link del borrador del plan (hoy se pierde: ChatArranque.tsx:71/164) |

### 3.2 En el Ops Center
- **15.** La salida guardada se acorta (Δ `salidaDelOnboarding`, :317): «Listo, Ana: ya conozco tu negocio. Si algo no
  funciona, escríbeme aquí o en tu grupo de WhatsApp y abro un ticket.» Se van el «¿arrancamos por ahí?» sin botones y la
  lista de lo que MaKo «también puede». **«o en tu grupo de WhatsApp» va sólo con `telefono === 'verificado'`**
  (EstadoArranque): el grupo existe con el teléfono verificado, y el paso 13 se puede saltar con «Ahora no». Hoy la salida lo
  promete a todos.
- **16.** El tutorial `sb-inicio` sigue. Bloqueado, su paso 3 dice «Instala MaKo para escribirle. Mientras, toca sus
  respuestas.» (app/second-brain/recorrido-inicio.ts:15).
- **17.** Cuando se cierra el recorrido, **la escalera**: una apertura local después del último mensaje. Las siguientes
  visitas la muestran en el Cerebro (el jefe).

**La escalera** (`lib/aperturas/ops.ts`, con su lector `ops-server.ts`; cada lectura con su `.catch`):
- gana el primer paso que falta;
- el `interes` sube su paso: anuncios → 6; WhatsApp → 5b; ventas → 5e; organizar → 7. Nunca por encima de los pasos 1 a 3:
  el 6 promete «Te escribo uno», y sin su IA eso no se cumple (en el ejemplo de Ana, el 3 sale primero);
- la primera apertura que ve cada persona lleva delante «¡Hola, Ana! Soy MaKo.».

| # | Falta (de dónde se lee) | Para | MaKo | Botones → consecuencia |
|---|---|---|---|---|
| 1 | Oferta: `ofertaPrincipal().origen === 'sin-fila'` (lib/ofertas.ts:106) | admin | «Lo primero es tu oferta: con ella conozco tu negocio. ¿La tienes escrita en algún lado?» | [Sí, en un documento o mi web ★] · [No, te la cuento] → `ir` /offer · [Ahora no] |
| 2 | Funnel: `getFunnelDefault()` sin `declarado` (lib/funnels.ts:66) | admin | (sin canal: «¿Dónde cierras la venta?») → «¿Cómo te llegan hoy los clientes?» → la recomendación de 3.3 | [Sí, ese ★] (`hacer`: declara el funnel que ya existe con `declararEntradasAction([entrada del tipo], null)`, app/crm/actions.ts:3617, que ya escribe con `saveFunnelDe` el MISMO pipeline y frena si la lectura dio `error`; sin tocar etapas ni leads. Sin ningún funnel, `crearCrmAction`) · [Ver los 12] (`ir` /crm?nuevo=1: hoy /crm no abre «Nuevo CRM» por URL, por construir en T7) |
| 3 | Su IA: sin computadora (`pcDe`, app/api/mako/chat/route.ts:89) o sin IA conectada | todos | «Para escribir por ti uso tu propia IA. ¿Cuál usas?» | [Claude ★] · [ChatGPT] → «Instala MaKo en tu computadora y conecta tu Claude.» [Instalar MaKo ★] [Ya lo instalé] · [Ninguna todavía] → «Crea tu cuenta de Claude o de ChatGPT y vuelve.» [Ver cómo] |
| 4 | Oferta sin analizar: `of_conclusion` pendiente (`getEstadoTab('offer')`). Es casi todo recién llegado | admin | «Tu oferta ya está cargada. ¿Ya vende como quieres?» | [Todavía no la vendí ★] · [Vende, pero cierra poco] → «La revisamos en Offer y te digo qué cambiar.» [Abrir Offer] (`/offer?oferta=<sesión del arranque>`) · [Sí, vende bien] → sigue |
| 5a | Entrada `landing`/`agenda_sola` y `landingsDelWorkspace()` vacío | admin | «Tu funnel lleva a la gente a una página. ¿Ya tienes una?» | [Todavía no ★] → «La armo con tu oferta.» (`ir` /web-generator) · [Sí, tengo una] → «Pégala en Web Generator y la reviso.» |
| 5b | `chat_entrante`, sin línea o sin automatización activa | admin | Sin línea: «¿Dónde te escriben más?» · Con línea: «¿Quién contesta hoy esos mensajes?» | [WhatsApp ★] (`ir` /automations, el QR) [Instagram] (sólo con Instagram por Zernio verificado en producción: hoy está en «No verificado») · [Nadie a tiempo ★] [Yo, cuando puedo] [Alguien de mi equipo] → «Te aviso apenas alguien te escribe.» [Usar «Un Lead Te Escribió»] (lib/plantillas-automatizaciones.ts:557). **Esa plantilla AVISA en el grupo, no contesta** («Te avisa en el grupo cuando un lead te escribe y MaKo no le contestó»): «Que conteste MaKo al instante» prometía lo que no hace, y sin teléfono verificado no hay grupo |
| 5c | `formulario_anuncio` y Meta sin conectar (`integracionConectada('meta')`) | admin | «¿Ya tienes una cuenta publicitaria en Meta?» | [Sí ★] (`ir` /ads-manager: su arranque la conecta) · [Todavía no] (`ahora-no`) |
| 5d | `chat_saliente` sin leads | admin | «¿Ya tienes la lista de a quién escribirle?» | [Sí, en una planilla ★] (`ir` /crm?importar=1; con los leads cargados, el paso siguiente ofrece [Usar «Prospección: apertura»]) · [Todavía no] (`ahora-no`). Antes, «Todavía no» llevaba a la plantilla, que le escribe a los leads que se mueven a una etapa: sin lista, a nadie |
| 5e | 0 leads | admin | «¿Dónde tienes hoy a tus clientes?» | lo mismo que el CRM (sección 4) |
| 6 | Inversión de $600 o más y Meta sin conectar o sin anuncios | admin | «¿Ya tienes un anuncio que te traiga clientes?» | [Todavía no ★] → «Te escribo uno con tu oferta.» (`ir` /copywriter, «Anuncio a cámara (PAS)») · [Sí] → «Conéctalo y lo miro.» (`ir` /ads-manager) |
| 7 | Borrador del plan sin revisar | admin | «¿Tu equipo ya sabe qué hacer esta semana?» | [Todavía no ★] → «Te dejé un borrador con 6 tareas.» [Ver el borrador] (`/plan/revisar/<id>`; nunca escribe tareas: pasa por el Perro) · [Sí] |
| 8 | Closer con llamadas hoy | closer | «Hoy tienes 3 llamadas. ¿Ya conoces a Ana, la de las 10:00?» | [No, prepárame ★] (`pedir`: «Prepárame la llamada con Ana de las 10:00.») · [Ver mi agenda] |
| — | No falta nada | | silencio: la portada de siempre; bloqueado, nada | |

Nada de la escalera manda a Video o Image de quien paga Esencial, ni a AI Avatar (`AI_AVATAR_SE_VENDE = false`).

**El ejemplo.** Ana invierte «Nada o menos de $600», cierra por chat, le escriben, «ya vendo… sin sistema», quiere anuncios y
no tiene la app.
- 9 → «Te escriben». 10 → «Instagram orgánico», «Sí, ese».
- Ops Center: paso 3, «Claude», «Ahora no».
- Al día siguiente, paso 4: «Vende, pero cierra poco» → [Abrir Offer]. Offer dice «Instala MaKo para escribir».
- Con la app: el paso 6 no aplica (inversión baja) y sigue el 5b.
- Nunca repitió una pregunta. Dijo una cosa por día.

### 3.3 `recomendarFunnel` (lib/funnel-recomendado.ts, pura)
Recibe `canal`, `entrada`, `inversion` (tramo 0 a 4), `funnelHoy` (0 a 4), `creativos` y `fase`. Devuelve
`{ tipo: TipoCrmId, porque }`.

**Respeta siempre el canal** que dijo. Es la única traducción entre los cuatro catálogos (TIPOS_CRM, FUNNEL_TEMPLATES,
TIPOS_FUNNEL, `funnelSugerido`). Gana la primera regla que aplica:

| # | Si… | Recomienda | `porque` (lo escribe el código con sus datos) |
|---|---|---|---|
| 1 | Canal webinar · carrito · presencial | Webinar · Carrito · Sesión presencial | Uno por canal: «Cierras en un webinar.» · «Vendes en tu página.» · «Cierras en persona.» |
| 2 | Le funciona (`funnelHoy` ≥ 2) y dijo la entrada | El de su canal y su entrada: llamada + formulario o agenda → Llamada de venta; llamada + «Tú les escribes» → LinkedIn; chat + «Te escriben» → Conversaciones por chat; chat + anuncio → Anuncio con formulario; chat + formulario → Recurso gratis | «Ya te funciona: lo medimos como está.» («Ya te escriben» era falso para formulario, agenda o «Tú les escribes») |
| 3 | Chat + «Dejan sus datos en el anuncio» (sólo con esa entrada ya declarada: el onboarding no la ofrece) · chat + «Llenan un formulario» | Anuncio con formulario · Recurso gratis | Uno por entrada: «Te dejan sus datos en el anuncio.» · «Te dejan sus datos en un formulario.» |
| 4 | Chat, inversión de $600 o más | Conversaciones por chat | «Con tu inversión, un anuncio que abre la charla.» |
| 5 | Chat, menos de $600 y 4 o más piezas al mes | DM funnel | «Publicas seguido: que te comenten una palabra.» |
| 6 | Chat, menos de $600 | Instagram orgánico | «Inviertes menos de $600 al mes: empieza sin pagar anuncios.» |
| 7 | Llamada + «Tú les escribes», o llamada con menos de $600 y menos de 4 piezas | LinkedIn | «Les escribes y agendan, sin pagar anuncios.» |
| 8 | Llamada, menos de $600 y 4 o más piezas | YouTube | «Publicas seguido: del video a la agenda.» |
| 9 | Llamada, $600 o más | Dos reuniones (fase 4 o más) · si no, Llamada de venta | «Con tu inversión: anuncios a una página donde agendan.» Desde la fase 2 agrega «con un video de venta en la página»; desde la 3, «y anuncios para quien ya te vio» (el «VSL Funnel» de la fase). La base decía «un video que filtra», que no es una etapa de ninguno de los dos tipos |
| 10 | Sin canal | `tipoRecomendado(null)` = Llamada de venta | (sin porqué) |

Se usa también en la escalera (paso 2), en Offer sin funnels y en el CRM con el funnel sin declarar.

---

## 4. Una apertura por superficie

★ = recomendado. «pasoOferta»: con 2 o más ofertas activas, «¿Para cuál de tus ofertas es?» con hasta 3; con una, «¿Es para
«X»?» [Sí ★] [Para otra cosa]; con ninguna, «¿Qué vas a vender con esto?» (texto libre) [Te la cuento] [Cargar una oferta]
(sin la app la caja no escribe: sale sin el texto libre, 2.6).
«pasoObjetivo»: «¿Qué tiene que hacer quien la vea?» [Agendar una llamada] [Escribirte por WhatsApp] [Registrarse a tu clase]
[Comprar en tu página]; se salta si el funnel lo dice, y el de su funnel va primero.

| Superficie (chat dueño) | Cuándo | Primera pregunta (hecho) | Botones → consecuencia | Botón de barra que se va |
|---|---|---|---|---|
| **Ops Center** | Siempre que falte algo | La escalera (3.2) | (3.2) | — (la salida sin botones se acorta) |
| **Copywriter** · plantilla con ejemplo | `props.plantilla`, quedan restos (`restosDelEjemplo`), charla vacía | «Es un ejemplo de Pulso Dental, un negocio ficticio. ¿Para cuál de tus ofertas es?» | [las ofertas ★] · [Lo escribo yo] (`hacer`: `soloLaEstructura`, «Estructura lista», con Deshacer) → pasoObjetivo → `pedir`: «Adapta esta página a «X». Quien la vea tiene que agendar una llamada.» | **«Adaptar con MaKo» y «Solo la estructura»** de la franja (EditorGuion.tsx:373-374) y el literal del chat (PanelMaKo.tsx:486-491). Queda el contador (:371) |
| **Copywriter** · en blanco | Sin plantilla, cuerpo y charla vacíos | «¿Dónde se va a publicar?» | [Un anuncio ★] [Un reel] [Un email] [Otro lado] → «Para un anuncio te sirve «Anuncio a cámara (PAS)».» [Usar esa plantilla ★] (`hacer`) [Desde cero] → pasoOferta → `pedir` | Las 6 píldoras, mientras haya apertura |
| **Offer** · tarjeta vacía | `of_conclusion` pendiente, fuera del arranque | «¿Tu oferta ya vende como quieres?» | [Todavía no la vendí ★] [Vende, pero cierra poco] → abre «Analizar «X»» (app/offer/arbol.ts:237-246). Son `pedir`: el análisis corre con su IA, así que sin la app vale 2.6 · [Sí, vende bien] → «¿Tienes otra cosa para vender?» | La línea fija (OfferApp.tsx:1085) |
| **Offer** · sin funnels | `bienvenida === 'sin-funnels'` | «¿Cómo te llegan hoy los clientes?» → recomendación | [Sí, ese ★] (`hacer`: crea el funnel ahí) → sigue en Offer | **«Ir al CRM»** (OfferApp.tsx:1081-1082) |
| **CRM y Chats** · estrella | Funnel sin declarar | La del funnel (3.2, paso 2) | igual (`declararEntradasAction`, que ya existe) | — |
| **CRM y Chats** · estrella | 0 leads | «¿Dónde tienes hoy a tus clientes?» | [En una planilla ★] [En otro CRM] → `ImportarLeadsModal` · [En mi WhatsApp] → conectar · [Todavía no tengo] → calla | — (quedan «AI Analyst» y las sugerencias medidas, con leads) |
| **Automations** · lista (estrella nueva en SimuladorWhatsApp.tsx:879) | Sin línea | «¿Por dónde te escriben tus clientes?» | [WhatsApp ★] (señala el QR que ya está) · [Instagram] → «Te Escribieron por Instagram» (:569), sólo con Zernio verificado en producción · [Email] → «Te Escribieron por Email» (:595) | — |
| **Automations** · lista | Con línea, ninguna activa | «¿Quién contesta hoy esos mensajes?» | [Nadie a tiempo ★] [Yo, cuando puedo] [Alguien de mi equipo] → «Te aviso apenas alguien te escribe.» [Usar «Un Lead Te Escribió»] (avisa en el grupo; no contesta) | — |
| **Automations** · lienzo de plantilla | Charla vacía | «¿Qué tiene que lograr este mensaje?» | [Que agende ★] [Que conteste una duda] [Que compre] → `pedir` al chat del lienzo (AI Step: 1 objetivo) | «Cuéntale qué tiene que pasar» (ChatMako.tsx:211-212). Quedan los ✦ y «Otro con MaKo» |
| **Calendario** | Google YA conectado y `cal_semana` pendiente. Sin Google no se suma nada: al entrar ya salta el modal de conectar (app/calendario/page.tsx:17, pedido de Martín), y `cal_agenda` es el último paso y opcional («lo aburrido al final», lib/tab-onboarding-catalogo.ts:185-199) | «¿Tienes alguna llamada esta semana?» | [Sí ★] → el alta de un evento de la tab (cierra `cal_semana` con `crearEventosAction`) · [Todavía no] (`ahora-no`) | «También puedes pedirle a MaKo que la agende» (ListaLlamadas.tsx:254) |
| **Dashboard / General** · estrella | Hoja en blanco (`enBlanco`), sólo con la estrella abierta: el centro ya dibuja `CrearHoja` («¿Qué vas a crear hoy?» y las plantillas, EditorInforme.tsx:1500). Ni `corto` ni D3 acá: serían dos selectores en una pantalla | «¿Qué número miras primero cada lunes?» · General: «¿Qué miras primero al empezar el día?» | [Lo cobrado ★] [Los leads] [Lo invertido en anuncios] [Las llamadas] → la plantilla de `CrearHoja` que corresponde, con `instanciarPlantilla` (lib/graficos-plantillas.ts:191/207), sin IA. En vista, el resto: silencio | **«Editar con MaKo»** (`BotonMako`, EditorInforme.tsx:1394): «Editar» abre el panel. Quedan «Conclusiones…», «Preguntarle…», «Re-evaluar…» |
| **Video Editor** | Hay voz, `subtitulosDe(...)` vacío, charla vacía | «¿Lo van a ver sin sonido?» | [Sí, en el feed ★] (`hacer`: `generarSubtitulos`, Whisper local, anda SIN la app) · [No, con sonido] (`nunca` para ese proyecto) | Las 8 píldoras, mientras haya apertura (PanelChat.tsx:397) |
| **Video Editor** | Línea de tiempo vacía | «¿Ya grabaste tu video?» | [Sí, lo subo ★] (la biblioteca) · [Todavía no] → «Te escribo qué decir.» (`ir` /copywriter) | — (con plantilla: «Es un ejemplo de X. ¿Ya grabaste tu video?» cuando se guarde `plantillaId`) |
| **Image** | Diseño en blanco | «¿Dónde lo vas a publicar?» | [Historia] [Carrusel] [Anuncio] [Miniatura] → `hacer`, sin IA: **hoy** pone el lienzo en blanco a la medida de esa familia. Las 10 plantillas de hoy son las de Doory (bodas, conciertos, currículums; ninguna de carrusel): «la sugerida de esa familia» llega con las 12 de plantillas-reales (README §3.3, sin hacer) | Las 6 píldoras, mientras haya apertura |
| **Web Generator** · editor | `lg_publicar` pendiente | «¿Ya está lista para que la vean?» | [Sí ★] → publicar con la dirección de MaKo (`hacer`, «Página publicada») · [Todavía no] (`ahora-no`). El dominio propio queda en DialogoPublicar, donde ya está: preguntarlo primero era configuración antes del default, y depende de algo «No verificado» | Nada (D4). Se esconden las 6 píldoras (PanelAgente.tsx:637) |
| **Web Generator** · editor | Publicada, funnel con anuncios, sin Pixel | «¿Vas a pautar esta página en Meta?» | [Sí ★] → pegar el Pixel (DialogoAnalitica) · [No] (`nunca`) | — |
| **Clients** | `cs_clientes` pendiente con `cs_servicio` hecho (el orden del checklist es una guarda: `marcarPasoTab`). Sólo con la estrella abierta: el checklist arriba de la cartera ya es su onboarding (ChecklistClientes.tsx), así que ni D3 ni `corto` | «¿Ya tienes clientes en tu programa?» | [Sí, los cargo ★] (`onCargar`) · [Todavía no] → «Cuando cierres el primero, aparece aquí solo.» | — |
| **Plan** · estrella (BoardShell.tsx:1877) | Borrador del plan sin revisar | La del paso 7 de la escalera, con la MISMA clave (`negocio:plan`) | igual | — |
| **AI Avatar** · tarjeta del Cerebro | El primer requisito que falta (`requisitosAvatar`), después la oferta y el guion | «¿Usas Google Chrome en esta computadora?» … «¿Tienes una foto tuya de frente, con buena luz?» → pasoOferta → «¿Ya tienes el guion?» | [Escríbemelo ★] (`pedir` al Cerebro) · [Sí, lo pego]. Nunca «te lo genero» | **«Usar el ejemplo»** (Estudio.tsx:687: filmaba el guion ficticio con créditos) |
| **Mobile** | Hoja del Cerebro (`/m/second-brain`) | La misma escalera | Igual | «Pídele algo a MaKo» y «Pídeselo a MaKo» llevan su texto y su tab (MediaBuyerM.tsx:76/96, InicioVideoM.tsx:216) |
| **Email** | — | — | — | «✨ Generar con MaKo» + `window.prompt` (EmailApp.tsx:351, :723), si la tab sigue en la barra |

**Sin apertura, a propósito:**
- Media Buyer: `ArranqueMediaBuyer` ya es el molde; sólo suma la memoria común.
- Second Brain (el mapa): ya saluda.
- Chats y WhatsApp: no van a la estrella, y el `WhatsAppAdvisor` del panel de Chats ya abre con qué escribirle a ESE lead (modo
  Consejo).
- Configuración y el curso: son formularios.
- La ficha del lead: su saludo ya nombra al lead.
- La portada del Web Generator: «¿Qué vas a crear hoy?» ya es el arranque.
- **La portada de Copywriter sin páginas**, por lo mismo: el centro ya es «¿Qué vas a crear hoy?» con los templates
  (Copywriter.tsx:207, `creandoInicial`). Una apertura «¿Qué necesitas publicar primero?» en el chat de al lado eran dos
  selectores en una pantalla. Se sacó de la tabla.
- **Soporte** (/tickets, `PiezasSoporte`): la persona llega con un problema, y su `SALUDO` (lib/soporte-chat.ts:30) ya lo pide.
  Escribe al equipo de MaKo, no a su IA.
- **Los chats de un gráfico o de un diagnóstico** (`MakoChat`: `ChartIA` del Ads Manager y Marketing, el Diagnóstico del Web
  Generator): abren sobre una pieza ya armada, y sus sugerencias son de esa pieza.
- **`/m/configurar`**: no es un chat, es la pared con «Abrir la configuración» (app/m/configurar/page.tsx). La pregunta que
  tenía («¿Estás en tu computadora ahora?») llevaba al mismo link con las dos respuestas. Se sacó de la tabla y de T16.
- **Calendario sin Google conectado**: ya salta el modal de conectar.

---

## 5. Las tandas, por chat dueño y en orden

Cada tanda:
- queda VERDE con `tsc` acotado, sus tests, `tests/aperturas.test.ts`, `tests/chat-unico.test.ts`,
  `tests/ops-center-bloque-y-estado.test.ts` (el 9 fija con regex la línea de `MakoEnLaTab` en PanelMakoCrm.tsx y el bloque de
  MakoEnLaTab.tsx: `apertura=` va ANTES de `arriba=`) y `tests/app-de-escritorio-todos-los-chats.test.ts` (fija el corte por
  `appEscritorio.bloqueada` de cada chat propio);
- no toca un archivo de otra superficie: cada una suma SU `lib/aperturas/<superficie>.ts` con su `CATALOGO` y sus `EJEMPLOS`
  (no hay lista central, 2.2);
- deja su cosecha en `docs/hallazgos-<área>.md`, con su fila en `docs/hallazgos.md`, en el MISMO commit;
- si toca un prompt, corre `verify-prompt-registry-sync`.

| # | Chat dueño | Qué | Archivos (origin/main; «nuevo» si no existe) | Listo cuando |
|---|---|---|---|---|
| T1 | **Ops Center** (la base) | Tipos, reglas, test del catálogo, `AperturaMako`, la memoria y su ruta, el montaje en el Cerebro (también bloqueado), el `corto` y la primera visita de la estrella, y la primera apertura real: el paso 3 de la escalera («su IA»), para todos los roles. La regla en AGENTS.md: «Una GUÍA de MaKo no es una recomendación: la arma el código, pregunta un hecho, sus botones andan sin la app y la IA entra sólo con un toque; nunca con un botón en la barra ni con un mensaje guardado con botones» (excepción a «toda pantalla que sugiera algo usa el motor de recomendaciones») | nuevos: `lib/aperturas/{reglas,comunes,ops}.ts`, `lib/aperturas/ops-server.ts`, `app/_chat/AperturaMako.tsx`, `app/api/aperturas/route.ts`, `tests/aperturas.test.ts` · tocar: `app/_chat/MakoEnLaTab.tsx` (la prop, el GET con el panel cerrado y su ⚠️ de :21), `app/second-brain/PiezasCliente.tsx` (:99), `tests/app-de-escritorio-primero.test.ts` (:64 fija «vacía y bloqueada, sin la portada ni sus arranques»: pasa a «sin la portada, con la apertura»), `AGENTS.md` | En el ws3 sin la app, con el Cerebro vacío, se ve «¿Cuál usas?» y sus botones andan; dos «Ahora no» la callan para siempre; el super admin mirando escribe en SU perfil; los tests verdes |
| T2 | **Onboarding** (lee TIPOS_CRM del chat CRM, sin tocarlo) | 3.1 y 3.3: `arr-oferta`, «¿Es así?» en el cobro, la pregunta de la entrada en lugar de `CRM_PREGUNTA`, `recomendarFunnel`, `crmOffer` con un candidato, la salida corta (el grupo, sólo con el teléfono verificado), el link del borrador en `EstadoArranque`, y se borran `rutaDeEntrada` e `INTERESES[].ruta` (muertos, apuntan a `/ads-writer`). `SALUDO_ARRANQUE` queda como está | `lib/onboarding-arranque.ts` (:178, :233, :317, :341, :1024, :1049, :1063-1071), `lib/onboarding-arranque-server.ts` (`propuestaDeCrm` :438), `lib/onboarding-crm.ts`, `app/onboarding/ChatArranque.tsx` (:71, :164) · nuevos: `lib/funnel-recomendado.ts`, `tests/funnel-recomendado.test.ts` · `tests/onboarding-*.test.ts` | Un arranque con chat, «Nada o menos de $600» y «Te escriben» termina en «Instagram orgánico» con su porqué; con webinar no pregunta la entrada; la salida no deja preguntas sueltas; el guard de «pestaña vieja» y los tests del onboarding siguen verdes |
| T3 | **Ops Center** (después de T2: usa `recomendarFunnel`) | La escalera completa (pasos 1, 2, 4 a 8), montada en el chat «Onboarding» y en el jefe, y el paso 3 del tutorial bloqueado. Los `ir` que esperan una ruta por construir salen a la portada de la tab hasta que suba su tanda: el 6 (`?plantilla=`, T5), el 5d y el 5e (`?importar=1`, T7) y «Ver los 12» (`?nuevo=1`, T7) | `lib/aperturas/ops.ts`, `ops-server.ts`, `app/second-brain/ChatSecondBrain.tsx` (:472-490), `app/second-brain/recorrido-inicio.ts` · lee: `lib/ofertas.ts`, `lib/funnels.ts`, `lib/tab-onboarding-state.ts`, `lib/landing-config-leer.ts`, `lib/fase-store.ts`, `lib/credenciales.ts`, `app/crm/actions.ts` (`declararEntradasAction`, :3617) y `app/crm/nuevo-crm-actions.ts` (`crearCrmAction`), sin tocarlos | Un negocio recién salido del arranque ve UN paso por día y nunca dos veces el mismo; con una lectura caída, ese paso se saltea; un closer con llamadas hoy ve el paso 8 |
| T4 | **Create** (el shell) | `primerMensajeDeEjemplo` pregunta la oferta (recibe las ofertas); `PantallaCrear` reenvía `apertura`; actualizar el README 2.3 («¿Lo adapto…?» → «¿Para cuál de tus ofertas es?») | `app/_crear/ejemplo.ts`, `app/_crear/PantallaCrear.tsx` (:174-210), `tests/crear-pantalla.test.ts`, `docs/plantillas-reales/README.md` | El test de `ejemplo.ts` pasa con la pregunta nueva y `PREGUNTA_DE_ACCION` no encuentra nada |
| T5 | **Copywriter** | Las dos aperturas del Copywriter (con ejemplo y en blanco); la oferta elegida por id en `{{negocio}}` y lo contestado en `{{charla}}`; `props.para`; `puedeSinIA`; la franja sin botones; `?plantilla=` | `app/copywriter/PanelMaKo.tsx` (:322, :331-338, :483-498), `app/copywriter/editor/EditorGuion.tsx` (:367-376), `app/copywriter/Copywriter.tsx` (:80, :212), `lib/copywriter/referencias.ts` (:33-34), `lib/copywriter/ia.ts` (`editar` con `adaptar`, :209-240: ahí se lee el negocio y se llenan `negocio` y `charla` de `copywriter.adaptar.user`), nuevo `lib/aperturas/copywriter.ts`. **No** `lib/copywriter/experto.ts`: son los defaults del prompt, y ningún prompt cambia | «Anuncio a cámara (PAS)» sin la app pregunta la oferta, la guarda y ofrece instalar; con la app, un toque la adapta a ESA oferta; «Lo escribo yo» anda sin la app |
| T6 | **Offer** | La tarjeta vacía, el funnel ahí mismo, fuera «Ir al CRM». Un campo nuevo de `OfferMensaje` va también a `sanearMensajes` | `app/offer/OfferApp.tsx` (:1043-1112), `app/offer/arbol.ts`, nuevo `lib/aperturas/offer.ts` (no se toca el rechazo sin funnel de app/api/offer/route.ts:373: la apertura crea antes) | Un negocio sin funnels arma funnel y oferta sin salir de Offer; el arranque no cambia (sus tests verdes) |
| T7 | **CRM y Chats** | Las dos aperturas de la estrella; `/crm?importar=1` y `/crm?nuevo=1` (hoy page.tsx:47 sólo lee `funnel` y `embudo`); «Sí, ese» declara el funnel «sin declarar» con `declararEntradasAction`, que ya existe | `app/crm/mako-crm/PanelMakoCrm.tsx` (:176), `app/crm/page.tsx` (:47), `app/crm/ImportarLeadsModal.tsx`, `app/crm/CrmToolbar.tsx`, nuevo `lib/aperturas/crm.ts`. **No** `lib/funnels.ts` ni `nuevo-crm-actions.ts`: `declararEntradasAction` (app/crm/actions.ts:3617) y `crearCrmAction` se usan como están; una acción nueva sobre `saveFunnelDe` duplicaría el guard de `origen === 'error'` | El CRM sin leads pregunta y «En una planilla» abre el importador; un funnel sin declarar con leads queda declarado sin perder etapas ni leads |
| T8 | **Automations** | La estrella en la lista y las tres aperturas | `app/automations/SimuladorWhatsApp.tsx` (:879-909), `app/automations/ChatMako.tsx` (:211-212), `app/automations/ChatMakoVista.tsx`, nuevo `lib/aperturas/automations.ts` | Sin línea, MaKo señala el QR; con línea y ninguna activa, «Usar «Un Lead Te Escribió»» abre la plantilla; contestado en la escalera, acá no se repite |
| T9 | **Calendario** | Su apertura (con Google conectado y `cal_semana` pendiente) | `app/calendario/ListaLlamadas.tsx` (:152, :254), `app/calendario/CalendarioApp.tsx` (:358), nuevo `lib/aperturas/calendario.ts` · lee `app/calendario/actions.ts` (`crearEventosAction`, :37) | Con Google y sin eventos, pregunta y «Sí» abre el alta; sin Google no suma nada al modal que ya salta |
| T10 | **Dashboard** | La hoja en blanco en la estrella; fuera `BotonMako`; «Editar» abre el panel | `app/dashboard/EditorInforme.tsx` (:1394, :1500, :1715), `app/dashboard/PanelEditarMako.tsx`, `lib/graficos-plantillas.ts` (lectura), nuevo `lib/aperturas/dashboard.ts` | Hoja en blanco → la pregunta → la plantilla, sin IA; mirando no edita |
| T11 | **Video Editor** (se puede adelantar: no depende de nada) | Los subtítulos primero; guardar `plantillaId` | `app/video-editor/_opencut/chat/PanelChat.tsx` (:397-406, :586-596), `app/video-editor/_opencut/subtitles/insert.ts` (:45, lectura), `app/video-editor/plantilla/ArmarPlantilla.tsx` (:45), nuevo `lib/aperturas/video.ts` | Un video con voz y sin subtítulos pregunta «¿Lo van a ver sin sonido?» y «Sí» los pone sin la app |
| T12 | **Image** | En blanco; guardar el slug | `app/image-editor/actions.ts` (:26-32), `app/image-editor/mako/chat/PanelMakoIA.tsx` (:123-130, :228-234), nuevo `lib/aperturas/image.ts`. **No** `lib/model-catalogo.ts`: la apertura de Image no tiene `pedir`, y el default de Gemini es un archivo de todas las features (queda en la sección 6) | Un diseño en blanco pregunta dónde se publica y deja el lienzo a esa medida, sin IA |
| T13 | **Web Generator** | Las dos del editor | `app/web-generator/editor/paneles/PanelAgente.tsx` (:637, :1027), `app/web-generator/editor/dialogos/DialogoPublicar.tsx` y `DialogoAnalitica.tsx`, nuevo `lib/aperturas/web.ts` | Una landing sin publicar pregunta si está lista y «Sí» la publica con la dirección de MaKo |
| T14 | **Clients** | Su apertura | `app/customer-success/ClientesApp.tsx` (:1149), `app/customer-success/ChecklistClientes.tsx`, nuevo `lib/aperturas/clients.ts` | Sin clientes, pregunta y «Sí, los cargo» abre la carga |
| T15 | **AI Avatar** | Su apertura; fuera «Usar el ejemplo»; «Antes de generar» se pliega a «Te falta 1 de 4» | `app/ai-avatar/Estudio.tsx` (:168-175, :330, :681-687), `lib/ai-avatar/requisitos.ts` (lectura), nuevo `lib/aperturas/avatar.ts` | Ningún botón pega el guion ficticio. Va recién cuando el motor genere un look en producción |
| T16 | **Mobile** (y Email) | La escalera en la hoja del Cerebro, los «Pídele…» con contexto, Email sin `window.prompt` | `app/m/second-brain/ChatClienteM.tsx` (:55), `app/m/ads/MediaBuyerM.tsx` (:76, :96), `app/m/video-editor/InicioVideoM.tsx` (:216), `app/email/EmailApp.tsx` (:351, :723) | En el teléfono se ve el mismo paso que en la computadora |
| T17 | **Plan** (después de T3: comparte la clave del paso 7) | La apertura de su estrella | `app/plan/board/BoardShell.tsx` (:1877), nuevo `lib/aperturas/plan.ts` | Con el borrador sin revisar, la estrella del Plan ofrece «Ver el borrador»; contestado en el Ops Center, acá no se repite |

**El orden:**
- T1 a T3 resuelven el «se pierde» del primer día, lo «súper importante».
- T4 y T5 son el ejemplo literal de Martín.
- T6 es lo primero que hace cada cliente.
- El resto, por uso de un negocio high ticket. AI Avatar va último porque no se vende.
- **Lo que una tanda espera de otra:** T3 usa `recomendarFunnel` (T2) y las rutas de T5 y T7; T6 y T7 usan
  `recomendarFunnel` (T2); T7, T10, T14 y T17 usan la prop `apertura` de `MakoEnLaTab` (T1); T15 usa el reenvío de
  `PantallaCrear` (T4). Fuera de la cosecha (`docs/hallazgos.md` y los `hallazgos-<área>.md`, que se integran), ningún par de
  tandas de chats distintos toca el mismo archivo.

---

## 6. Trampas y lo que queda sin hacer

### Trampas (dónde viven)
1. **El Cerebro es uno.** Es el mismo en el Ops Center, la estrella y Create. Un saludo guardado sale en todas partes, y el
   jefe es la sesión más vieja (`arbolDelJefe`, lib/chat-mako-reglas.ts:33). La apertura nunca se guarda.
2. **Bloqueado, el hilo vacío no dibuja nada** (PiezasCliente.tsx:99), a propósito desde el 24/10: los arranques invitaban a
   escribir. La apertura sí se dibuja, porque sus botones andan.
3. **Las respuestas rápidas del hilo no hacen nada sin la app**, y no avisan (useChatCliente.ts:595). Por eso la apertura lleva
   botones propios.
4. **Lo de la tab sale plegado** (PreguntasDelChat.tsx:201, decisión del 22/10). Una guía puesta ahí no se ve.
5. **AGENTS.md dice que toda sugerencia usa el motor de recomendaciones.** Si no se escribe la diferencia (T1), el próximo mete
   la guía en `recomendaciones-senales.ts` y rompe sus tres condiciones.
6. **Mirando como super admin, la memoria va al perfil de la SESIÓN**, como `/api/recorridos`. Sin el workspace en la clave,
   una agencia mezcla negocios.
7. **«Sin declarar» no es «sin funnel».** `origen` sale de la columna `declarado` (lib/funnel-fila.ts:111). Crear otro funnel
   duplicaría el del negocio migrado: «Sí, ese» declara el que existe.
8. **Offer exige un funnel**: `'nueva'` sin `funnelId` se rechaza (app/api/offer/route.ts:373).
9. **Hay cuatro catálogos de funnel** (lib/pipeline.ts:855/1147/1367, lib/fase-diagnostico.ts:80). `recomendarFunnel` es la
   única traducción.
10. **El grafo tiene caché de 3 minutos** (lib/cerebro-cache-chat.ts:13). La oferta elegida se lee por id.
11. **El velo del recorrido tapa el chat.** La apertura espera a que se cierre.
12. **Hay tres hilos** (`HiloAgente`, `HiloMako`, `HiloDelCliente`). `AperturaMako` usa `HiloMako` suelto.
13. **«Solo la estructura» del chat se apaga sin la app** (PanelMaKo.tsx:322). Sacar la franja sin `puedeSinIA` la deja
    inalcanzable.
14. **`sinSubtitulos` borra, no detecta** (subtitles/insert.ts:71). El detector es `subtitulosDe` (:45).
15. **`cs_servicio` lo cierra el producto del CRM**, no una respuesta (ChecklistClientes.tsx:35).
16. **Image corre con Gemini por defecto** (lib/model-catalogo.ts:241), contra «sin Gemini».
17. **El guard de «pestaña vieja» del arranque compara textos.** Cambiar `SALUDO_ARRANQUE` o el paso del funnel pide correr sus
    tests.
18. **Un campo nuevo de `OfferMensaje` va a `sanearMensajes`**, que es una lista blanca.
19. **Esencial tiene Video e Image con candado.** AI Avatar no se vende (lib/planes-comparacion.ts:61).
20. **Hay dos `contextoDelNegocio`** (lib/negocio-para-crear.ts y lib/plan-senales.ts). Se importan por ruta.
21. **Lo escrito no se lee con reglas.** Va a la IA o cierra la apertura (hallazgos-onboarding, 21/10).
22. **La estrella cerrada no le pide nada al servidor** (MakoEnLaTab.tsx:21). El `corto` y D3 piden un GET aparte, sin el motor.
23. **«Un Lead Te Escribió» avisa, no contesta** (lib/plantillas-automatizaciones.ts:555-565): manda al grupo «te escribió y no
    le contesté». Hoy ninguna plantilla le contesta sola a quien escribe por WhatsApp.
24. **Declarar un funnel ya tiene su acción** (`declararEntradasAction`, app/crm/actions.ts:3617): reescribe el MISMO pipeline y
    no guarda nada si la lectura dio `error`. Otra acción sobre `saveFunnelDe` tendría que copiar ese guard.
25. **El Calendario ya abre algo al entrar**: sin Google, el modal de conectar (app/calendario/page.tsx:17). Y `cal_agenda` es el
    último paso y opcional.
26. **Las tabs con onboarding a la vista**: Clientes (el checklist arriba de la cartera) y Calendario (el modal). Una apertura
    que se abre sola ahí son dos guías en una pantalla.
27. **Image no tiene hoy plantillas de historia, carrusel ni anuncio**: son las 10 de Doory (bodas, conciertos, currículums).
28. **Tests que fijan con regex lo que se toca:** `tests/app-de-escritorio-primero.test.ts:64` (el hilo vacío y bloqueado),
    `tests/ops-center-bloque-y-estado.test.ts` 9 (la línea de `MakoEnLaTab` en el CRM y el bloque en MakoEnLaTab.tsx) y
    `tests/app-de-escritorio-todos-los-chats.test.ts` (el corte de cada chat propio).
29. **`.of-pill` sólo existe con `CSS_OFFER` montado** (app/offer/estilos.ts): fuera de Offer hay que montarlo, como
    ArranqueMediaBuyer.tsx:115.
30. **Bloqueado no se escribe**: una pregunta de texto libre no se puede contestar sin la app.

### Lo que queda sin hacer (dónde vive)
- **Los textos de las aperturas, editables desde /configuraciones.** Hoy no es un prompt y ningún texto del código lo es. El
  diseño está listo en `diseno-guion.md` §1.4: un grupo generado del catálogo, `kind: 'guion'`, el override leído paso por
  paso y primero el negocio, después la plataforma. Iría en `lib/prompt-registry.ts`.
- **Huecos del catálogo de funnels** (lib/pipeline.ts:1367): no hay prospección que cierre por chat (`chat_saliente` sólo está
  en «LinkedIn», que cierra en llamada), y «Escalera de valor» (fase 5) no es un tipo. Renombrar «LinkedIn» a «Prospección» es
  sólo el `label`, para el chat CRM.
- **Por construir en sus tandas:** `?plantilla=` del Copywriter (hoy `?nuevo=` sólo ordena la grilla), `/crm?importar=1`,
  `/crm?nuevo=1` («Ver los 12»; app/crm/page.tsx:47 sólo lee `funnel` y `embudo`), y el Web Generator abierto en un modo por
  URL (si no lo acepta, el `ir` va a la portada).
- **Una plantilla que le CONTESTE sola a quien escribe por WhatsApp** (`chat_entrante`): no existe. «Un Lead Te Escribió» avisa
  y «Un Lead Entró» saluda a quien dejó sus datos. Hasta que exista, la escalera (5b) y Automations ofrecen el aviso, no la
  respuesta. Vive en lib/plantillas-automatizaciones.ts, del chat Automations.
- **El default de Gemini de `image-editor-ia`** (lib/model-catalogo.ts:241), contra «sin Gemini»: no lo resuelve T12, porque la
  apertura de Image no usa IA. Es del chat que lleva los modelos.
- **Tabs con estrella y sin onboarding en el catálogo** (CRM, Dashboard, General, Plan; y Copywriter, Video e Image, que
  `PantallaCrear` declara «sin onboarding: la plantilla es el arranque»): la regla es que toda tab tiene onboarding y su estado
  alimenta a MaKo (skill tab-onboarding). Las aperturas no lo reemplazan: leen el estado vivo, no escriben pasos. Queda sin
  decidir si esas tabs suman su entrada en lib/tab-onboarding-catalogo.ts o si la excepción de Create se escribe en la skill.
- **Faltan las piezas de plantillas-reales** (`docs/plantillas-reales/README.md` §4): `video_editor.adaptar.user`,
  `image_editor.adaptar.user`, el Director de AI Avatar y la plantilla «Primera camada» de Offer. Hasta entonces esas tabs no
  ofrecen `pedir` de adaptar, y el `Record` tipado lo impide.
- **`resumenOnboardingTabs` lista tabs fantasma** (lib/tab-onboarding-state.ts:221 → lib/mako-context.ts:178). Las aperturas
  no lo usan.
- **Más adelante:** `crm.lead` (la llamada de hoy, el no show) y el Second Brain con el grafo flaco.

### No verificado
- Si la descarga de la app anda para un cliente nuevo, y cuántos clientes la tienen. Hay que leer la base: decide cuántos ven
  el paso 3 primero.
- Si Instagram por Zernio y el dominio propio de `DialogoPublicar` están en producción.
- Si existe un envío por correo desde el teléfono.

### Para la cosecha (en el commit de cada tanda)
| Documento | Hallazgo |
|---|---|
| `hallazgos-chat.md` | `enviar` devuelve false bloqueado, sin aviso; una guía no puede usar el bloque `pregunta` |
| `hallazgos-copywriter.md` | `puede` apaga «Solo la estructura» sin la app |
| `hallazgos-onboarding.md` | La propuesta de CRM no veía presupuesto ni funnel; `CRM_PREGUNTA` preguntaba una acción; la salida sin botones; `rutaDeEntrada` muerta; el link del plan perdido |
| `hallazgos-crm.md` | El hueco de `chat_saliente`; «Sí, ese» sobre un funnel sin declarar, con `declararEntradasAction` y no una acción nueva |
| `hallazgos-chatbot.md` | «Un Lead Te Escribió» avisa, no contesta: ninguna plantilla le responde sola a quien escribe |
| `hallazgos-calendario.md` | Sin Google ya salta el modal de conectar: una guía más al entrar son dos |
| `hallazgos-video-editor.md` | `sinSubtitulos` no es un detector |
| `hallazgos-second-brain.md` | La memoria del super admin va a su sesión, y la clave lleva el workspace |
