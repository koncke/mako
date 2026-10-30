# AI Avatar: plantillas reales y el Director de avatar (29/10/2026)

> Parte de [Plantillas reales en Create](README.md). La regla común, el elenco, el patrón del agente experto, la tabla única de licencias y el orden de implementación viven en el README; este archivo es la parte de AI Avatar, entera, con sus ejemplos completos.

**Qué es:** el plan para que «Nuevo avatar» deje de mostrar baldosas con un degradado y un nombre y muestre **anuncios de ejemplo completos**: la escena, el guion entero que dice el avatar, los textos en pantalla y la miniatura con contenido real. Al abrir uno, el **Director de avatar** (un prompt editable en `/configuraciones`) lo adapta al negocio de la persona.

**Estado:** es un plan. No hay nada implementado. Se midió contra `origin/main` `1cf06eba9` (29/10/2026, 13:55).

**Se apoya en la regla común del [README](README.md) (sección 2):**
- el elenco de cinco negocios ficticios (Cierre Consultivo, Consulta Rentable, Pulso Dental, Torre Alameda y Voz de Líder) y sus clientes inventados;
- el aviso «Ejemplo: <negocio> (negocio ficticio)»;
- el turno «Adaptar a mi negocio»;
- el detector de texto de muestra.

Lo que sigue vale solo para AI Avatar. Cada cifra que una plantilla comparte con otra tab está en la tabla del elenco (README, sección 2.2): la mensualidad del crédito de Torre Alameda, el embudo de 60 → 18 → 11 de una alumna de Mariana, el análisis de 50 anuncios de Pulso Dental. La revisión del 29/10 encontró dos cifras que no estaban en ningún lado («la última cohorte se llenó en cuatro días» y los 18,900 pesos): la primera se quitó y la segunda pasó al elenco con su tasa y su plazo.

**De dónde sale:** de la investigación completa del 29/10 (Arcads, HeyGen, Creatify, Higgsfield, Captions y las skills MIT), del código de `origin/main` (`lib/ai-avatar/*`, `app/ai-avatar/*`, `lib/puestas-data.ts`, `lib/prompts-video.ts`, `app/video-generator/actions.ts`) y de `docs/hallazgos-ai-avatar.md`. Las licencias y las páginas marcadas «verificado» se abrieron hoy.

---

## 1. Cómo lo hacen los mejores, y qué copiamos de esa forma de mostrar

Ninguna de las apps que se miraron muestra una plantilla vacía. **Muestran un video que ya funciona.**

| Quién | Cómo lo muestra | Fuente |
|---|---|---|
| **Arcads** | Cada ejemplo es una tarjeta de feed con «Sponsored», la marca, el estado ACTIVE, el copy, el video y métricas («Revenues Generated», vistas con % de variación). Otras imitan un perfil de TikTok. Nombra los formatos: Product Showcase, Unboxing, UGC Studio, Talking Actors. | https://www.arcads.ai/ (verificado). Filtra actores por «situación» (en el auto, afuera): https://intercom.help/arcads/en/articles/13239650-how-to-create-a-talking-actor-video-no-product |
| **HeyGen (UGC)** | Una avatar en un AUTO con el gancho escrito arriba, siete versiones del mismo video, una barra «Testing Scripts» y la ganadora marcada «Winning Script». **Enseña el método (probar ganchos), no solo la escena.** | https://www.heygen.com/avatars/ugc (verificado) |
| **HeyGen (gestos)** | El gesto se pide como parte del cuerpo + acción + emoción, uno por prompt. Dura hasta 10 s y después se repite o se congela. No controla cámara, fondo, luz, objetos ni desplazamientos. | https://help.heygen.com/en/articles/12805098-fine-tune-avatar-gestures-and-movements-with-custom-motion-prompts-avatar-iv-v (verificado; solo hechos) |
| **Creatify** | Grillas de avatares rotuladas «AI GENERATED». Las categorías van por estilo de anuncio y por rubro (eCommerce, Apps, Services). Los casos son tarjetas con CTR y ROAS. | https://creatify.ai/features/ai-avatar (investigación) |
| **Higgsfield** | Galería de presets con el nombre arriba a la izquierda y «Use preset» al pasar el cursor (relevado el 29/10, `docs/hallazgos-ai-avatar.md`). Marketing Studio trae 9 presets, cada uno con su gramática de cámara (UGC: selfie a la altura de la vista en una toma; TV Spot: dolly, producto y logo), con clips de 4 a 15 s. | https://claudskills.com/skills/higgsfield-marketing-studio/SKILL.md (de terceros y sin licencia: solo los hechos) |
| **Captions (AI Ads)** | Pegas la URL del producto y completa sola el avatar, el guion y la voz. | https://captions.ai/help/guides/marketing/ugc-ad (investigación) |
| **La casa** | `lib/puestas-data.ts`: «Sin ejemplo no entra — no por prolijidad, sino porque ofrecer un formato que nadie produjo es prometer sin haber medido». | código |

**Qué copiamos:**
1. **La tarjeta ES el ejemplo:** la imagen del avatar en su escena, con el texto del gancho arriba (como en el anuncio real) y la primera frase que dice. Nunca un rectángulo con un nombre.
2. **Tres datos en la tarjeta:** el nombre del formato («Confesión en el auto»), el rubro («Coach de ventas») y la duración («~33 s»).
3. **Al abrirla:** el guion completo y **tres ganchos para probar** sobre el mismo cuerpo (la barra «Testing Scripts» de HeyGen).
4. **Preset y plantilla son cosas distintas** (Higgsfield):
   - el **preset** es la escena (hoy hay 28 en `lib/ai-avatar/plantillas.ts`, y se quedan en la galería del estudio);
   - la **plantilla de venta** es escena + guion + textos + negocio de ejemplo.

**Qué NO copiamos:**
- **Las métricas de Arcads** («Revenues Generated», ACTIVE): en un negocio ficticio serían cifras inventadas.
- **El actor de stock que «testimonia»:** la regla de la FTC prohíbe los testimonios de personas que no existen, incluidos los hechos con IA (https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials, verificado).
- **El catálogo de 40 plantillas de UGC Factory:** su lista no es pública.

---

## 2. Las plantillas (10)

**Cómo leer cada ficha:**
- **Preset:** la escena que ya existe en `lib/ai-avatar/plantillas.ts` o una nueva. Su `puestaId` decide si el avatar **habla**, y eso es la trampa 1.
- **Escena:** el prompt del look, en inglés y solo con la composición, nunca la cara. Lleva además el `detalle`, en español, que se agrega al final como «AJUSTES QUE PIDIÓ LA PERSONA» (`lib/ai-avatar/prompt-look.ts`).
- **Guion:** lo que dice el avatar, tal cual. Las etiquetas en mayúsculas, solas en su línea, **no se pronuncian**: `soloHablado` las saca, y son las mismas de `lib/guion-estructuras.ts`, así el guion se abre igual en Copywriter. Los números van con letras. La duración sale de contar las palabras habladas con la densidad de la puesta (3 palabras/s hablando a cámara; 2,1 en «The Office»).
- **Tramos:** el texto en pantalla (lo pone el editor, nunca el video) y lo que se ve en cada tramo.
- **Miniatura:** cómo se dibuja la tarjeta con contenido real.

**Reparto:** dos plantillas por negocio del elenco. Los 10 guiones se pasaron por la regex `VOSEO` de `lib/puestas-data.ts` (cero marcas) y se contaron con la regla de `soloHablado`.

| # | Plantilla | Negocio | Preset | ¿Habla? | Estructura | Palabras · s |
|---|---|---|---|---|---|---|
| 1 | Confesión en el auto | Cierre Consultivo | `auto-testimonio` | siempre | `pas` | 97 · ~33 |
| 2 | Respondo un comentario | Cierre Consultivo | `selfie-iphone` | siempre | `gancho-valor-cta` | 81 · ~27 |
| 3 | Pizarra: el método en 3 pasos | Consulta Rentable | **`pizarra-estudio` (nuevo)** | siempre | `gancho-valor-cta` | 70 · ~24 |
| 4 | Mañana en la cocina | Consulta Rentable | **`cocina-manana` (nuevo)** | siempre | `reel-nicho` | 76 · ~26 |
| 5 | Episodio de podcast | Pulso Dental | `podcast-experto` | siempre (a medir: trampa 6) | `gancho-valor-cta` | 76 · ~26 |
| 6 | Caso de un cliente, caminando por la oficina | Pulso Dental | `oficina-presentador` | alterna (H O H O…) | `gancho-historia-cta` | 80 · ~39 |
| 7 | Recorrido de la preventa | Torre Alameda | `oficina-presentador` | alterna | `cuatro-p` | 74 · ~36 |
| 8 | Entrevista en la calle | Voz de Líder | **`calle-microfono` (nuevo)** | siempre | `reel-nicho` | 76 · ~26 |
| 9 | Carta del fundador (cierre de cohorte) | Voz de Líder | **`despacho-noche` (nuevo)** | siempre | `gancho-propuesta-cta` | 81 · ~27 |
| 10 | Pantalla dividida: renta o mensualidad | Torre Alameda | **`sala-de-ventas` (nuevo)** | siempre | `bab` | 89 · ~30 |

**Fuera de las plantillas de venta:**
- **Testimonio en el sillón:** un avatar no se presenta como cliente (trampa 4). Queda reemplazado por la plantilla 6, donde el dueño cuenta el caso.
- **Kit de bienvenida (unboxing):** pide dos escenas (manos desde arriba y el fundador), y ninguna oferta del elenco tiene un kit físico (trampa 5).
- **Los 9 presets donde el avatar no habla** (trampa 1) y los de cuerpo, gimnasio y lujo.

### 1. Confesión en el auto

- **Ejemplo:** Cierre Consultivo. Andrea Salcedo (CDMX), coach de ventas para coaches. Programa de 90 días, USD 1,500.
- **Cuándo usarla:** con público frío que no te conoce, para vender una llamada de diagnóstico. Es lo-fi: parece grabado con el celular.
- **Preset:** `auto-testimonio` «Charla en el auto», que ya existe. Usa el formato `selfie-movimiento`, con prompt validado: es el ÚNICO preset que puede usarlo. Voz para escuchar el tono: `mexicano-mujer-1`.
- **Escena:** el prompt validado del formato (auto estacionado de día, cinturón puesto, celular con el brazo estirado) + detalle «Con blusa blanca de lino».

```
GANCHO
Esta semana tres personas me dijeron «lo voy a pensar». Y no, no era el precio.
PROBLEMA
Yo explicaba mi programa veinte minutos seguidos. Les encantaba, me decían que sí, y nunca me volvían a escribir.
AGITACION
Cada «lo voy a pensar» eran mil quinientos dólares que se quedaban en un chat. Y al mes siguiente, yo bajaba el precio.
SOLUCION
Ahora la persona habla primero: seis preguntas, siempre en el mismo orden. El precio llega al final, cuando ya me dijo cuánto le cuesta seguir igual.
CTA
Si haces llamadas de venta, toca «Más información» y agenda treinta minutos conmigo.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | «3 "lo voy a pensar" esta semana» | Andrea al volante, mirando al lente. |
| PROBLEMA | — | La misma toma. |
| AGITACION | «USD 1,500 en un chat» | Zoom digital al 110 % para disimular el corte. |
| SOLUCION | «6 preguntas · el precio al final» | La misma toma. |
| CTA | «Diagnóstico gratis · 30 min» | La misma toma; subtítulos en todo el video. |

**Ganchos para probar:**
- **Identidad:** dice «Si eres coach y tus llamadas terminan en "déjame consultarlo", esto es para ti.» · en pantalla «Coaches: "déjame consultarlo"».
- **Idea contraria:** dice «Bajar el precio no cierra más llamadas. Cambiar el orden de la llamada, sí.» · en pantalla «No es el precio».
- **Curiosidad:** dice «Hay una pregunta que hago antes de decir el precio, y cambió mis llamadas.» · en pantalla «La pregunta antes del precio».

**Miniatura:**
- Andrea en el asiento del conductor con luz de mediodía por el parabrisas.
- Franja arriba: «3 "lo voy a pensar" esta semana».
- Al costado, la frase «Esta semana tres personas me dijeron "lo voy a pensar"…».
- Chips: «Coach de ventas» · «~33 s» · «PAS».

**Datos que pide al negocio:** precio, qué pasa hoy en sus llamadas, cuántas preguntas o pasos tiene su método y la acción.

### 2. Respondo un comentario

- **Ejemplo:** Cierre Consultivo.
- **Cuándo usarla:** retargeting y la objeción de precio más común. Para quien ya vio otro anuncio.
- **Preset:** `selfie-iphone` «Selfie de iPhone», que ya existe. Usa el formato `ugc-sin-producto` (habla siempre). Voz: `mexicano-mujer-1`.
- **Escena:** el prompt del preset (cámara frontal, afuera, luz de día) + detalle «Con suéter gris claro, en un parque de la ciudad».
- **Comentario:** en el ejemplo es de un usuario ficticio. En la versión de la persona, va la **captura real**, con el nombre tapado y su permiso.

```
GANCHO
Me escribieron esto: «¿Mil quinientos dólares, si en YouTube está todo gratis?». Tienes razón. Y te explico por qué igual lo cobro.
VALOR
En YouTube están las seis preguntas. Lo que no está es alguien que escuche tu llamada grabada y te diga en qué minuto la perdiste. En el programa reviso seis llamadas tuyas, una por una. Por eso son quince lugares: cada llamada la escucho yo.
CTA
Si quieres saber si es para ti, toca el botón y responde cuatro preguntas.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | El comentario como globo de respuesta, arriba a la izquierda | Andrea a cámara. El globo es una imagen hecha en el Image Editor y puesta encima en el Video Editor. |
| VALOR | «6 llamadas tuyas, revisadas una por una» | La misma toma. El programa revisa 6 (Offer, plantilla 1); la «Revisión de 3 llamadas» es la entrada paga. |
| CTA | «15 lugares por cohorte» | La misma toma. |

**Ganchos para probar:**
- **Idea contraria:** «Todo lo que enseño está gratis en internet. Lo que no está gratis es que alguien escuche tu llamada.» · en pantalla «Gratis en internet».
- **Pregunta:** «¿Por qué pagarías por algo que está en YouTube?» · en pantalla «¿Pagar por lo gratis?».
- **Identidad:** «Si ya viste diez videos de ventas y sigues sin cerrar, lee este comentario.» · en pantalla «10 videos y 0 cierres».

**Miniatura:**
- Andrea en selfie al aire libre, con el globo del comentario arriba.
- Chips: «Coach de ventas» · «~27 s» · «Objeción».

**Datos que pide:** el comentario real (la captura), qué incluye el programa que no está gratis y por qué hay cupo.

### 3. Pizarra: el método en 3 pasos

- **Ejemplo:** Consulta Rentable. La Dra. Mariana Ochoa (Guadalajara), programa de 90 días para nutriólogas, USD 1,200, con 140 alumnas desde 2023.
- **Cuándo usarla:** para invitar a una clase gratuita en vivo que vende un programa high ticket. Educa con el mecanismo y cierra en el registro.
- **Preset:** `pizarra-estudio`, **nuevo**, categoría Negocio. Usa el formato `ugc-sin-producto`. Voz: `mexicano-mujer-2`.
- **Escena:**
  - prompt: `Vertical medium-wide shot of a person standing beside a clean blank whiteboard in a bright studio, holding a marker and pointing at the empty board, high-key softbox lighting, white background, static tripod, 35mm lens, deep focus, clean educational video look`
  - detalle: «Con blazer azul marino».
  - **La pizarra va vacía:** la IA no escribe texto legible (trampa 9).

```
GANCHO
Si eres nutrióloga, publicas recetas todos los días y tu agenda sigue vacía, te falta un paso.
VALOR
Uno: una oferta de entrada clara, con resultado y tiempo. Dos: el paso del medio, una valoración de veinte minutos. Tres: el mensaje del precio. El paso dos es el que casi nadie diseña.
CTA
El jueves doce lo explico en una clase gratuita en vivo, con ejemplos. Reserva tu lugar en el enlace.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | «Agenda vacía con recetas diarias» | Mariana junto a la pizarra vacía. |
| VALOR | Sobre la pizarra, uno por vez: «1 Oferta de entrada» · «2 El paso del medio» · «3 El mensaje del precio» | El editor anima los tres textos sobre la pizarra. |
| CTA | Placa: «Clase gratuita · jueves 12 · en vivo» | La fecha REAL de la clase. |

**Ganchos para probar:**
- **Idea contraria:** «Publicar recetas no te trae pacientes. Te trae seguidores que cocinan.» · en pantalla «Menos recetas, más citas».
- **Prueba:** «Así trabajan las ciento cuarenta alumnas del programa.» · en pantalla «140 alumnas desde 2023».
- **Curiosidad:** «Entre "me interesa" y "agendé" hay un paso que nadie diseña.» · en pantalla «El paso que falta».

**Miniatura:**
- Mariana junto a la pizarra, con «1 · 2 · 3» dibujado encima por la tarjeta (no por la imagen).
- Chips: «Infoproducto» · «~24 s» · «Clase gratuita».

**Datos que pide:** los pasos de su método, día y hora de la clase, y la prueba (cantidad de alumnos o un caso con permiso).

### 4. Mañana en la cocina

- **Ejemplo:** Consulta Rentable.
- **Cuándo usarla:** orgánico o tráfico tibio en Instagram. El método aparece dentro de la rutina y el CTA es por mensaje.
- **Preset:** `cocina-manana`, **nuevo**, categoría Instagram. Usa el formato `ugc-sin-producto`.
  - El preset `cafe-un-dia` («Un día conmigo») NO sirve: su formato es `voz-en-off` y el avatar no habla (trampa 1).
  - Voz: `mexicano-mujer-2`.
- **Escena:**
  - prompt: `Vertical medium close-up of a person leaning on a bright kitchen counter at 7 a.m., holding a steaming mug and talking to a phone propped on the counter, warm low morning sun from a side window, steam backlit, phone on a mini tripod at a slightly low angle, 28mm lens, authentic day-in-the-life creator footage`
  - detalle: «Con suéter de punto color crema».
- **Estructura:** `reel-nicho` (GANCHO · PROBLEMA · SOLUCION · CTA), que no fija duración. La primera versión usaba `reel-viral`, cuya guía pide de 50 a 60 s (HISTORIA de 30 a 40), y el guion dura ~26: es el error que la trampa 12 de copywriter.md ya había corregido en el Reel, y el guion se abre igual en Copywriter.
- **Los números son de una alumna**, no de Mariana (que atiende 40 pacientes al mes): el embudo 60 → 18 → 11 es el de la clase 11 de Copywriter (README, 2.2).

```
GANCHO
Son las siete de la mañana y, antes del café, reviso una sola cosa: cuántas valoraciones tengo hoy.
PROBLEMA
Casi todas las nutriólogas que me escriben publican todos los días. Les llegan mensajes, pero nadie agenda.
SOLUCION
A una alumna le escribieron sesenta personas el mes pasado. Dieciocho llegaron a la valoración de veinte minutos, y once hoy son sus pacientes.
CTA
Si quieres el mensaje exacto con el que invita a la valoración, escríbeme VALORACIÓN por mensaje directo.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | «7:00 a. m. · valoraciones de hoy» | Mariana con la taza. |
| PROBLEMA | «Mensajes sí, citas no» | La misma toma. |
| SOLUCION | «Una alumna: 60 mensajes → 18 valoraciones → 11 pacientes» | B-roll de 1 s: la agenda. En el ejemplo es una maqueta del Image Editor con nombres ficticios difuminados; en la versión de la persona, su captura real o la de un cliente con permiso. Debajo: «Resultado de un caso». |
| CTA | «Escríbeme VALORACIÓN» | Va SOLO si existe la respuesta automática a esa palabra. Si no, «Agenda desde el enlace». |

**Ganchos para probar:**
- **Escena con resultado:** «Antes de abrir la consulta ya sé quién viene hoy, y no publiqué nada ayer.» · en pantalla «Sin publicar ayer».
- **Curiosidad:** «A una alumna le escribieron sesenta personas y once hoy son sus pacientes. Te cuento qué pasa en el medio.» · en pantalla «60 → 11».
- **Identidad:** «Si eres nutrióloga y te escriben pero no agendan, mira esto.» · en pantalla «Te escriben y no agendan».

**Miniatura:**
- Mariana en la cocina con luz lateral y vapor a contraluz.
- Franja: «7:00 a. m. · valoraciones de hoy».
- Chips: «Infoproducto» · «~26 s» · «Día en la vida».

**Datos que pide:** los números reales de mensajes, valoraciones y pacientes, suyos o de un cliente con permiso (si no los tiene, la solución pasa a ser de proceso), y si tiene la respuesta automática para la palabra clave.

### 5. Episodio de podcast

- **Ejemplo:** Pulso Dental. Diego Ferrer (Bogotá), agencia para clínicas dentales. USD 1,200 al mes, contrato de 3 meses.
- **Cuándo usarla:** para vender autoridad a dueños de clínicas en frío. Abre con una idea contraria a lo que cree el mercado y cierra en la auditoría gratis.
- **Preset:** `podcast-experto`, que ya existe. Su formato `podcast` declara **dos personas**: se mide antes de venderla (trampa 6). Voz: `colombiano-hombre-1`.
- **Escena:** el prompt del preset (escritorio de podcast, micrófono de brazo, paneles acústicos) + detalle «Con suéter negro de cuello redondo y auriculares al cuello».
  - **Segundo ángulo para cortar:** un segundo look con «Recrear» y el detalle «plano de perfil desde la izquierda, lente de 85 mm». El look es gratis; cada toma de video cuesta créditos.

```
GANCHO
Revisé cincuenta anuncios de clínicas dentales. Cuarenta y tres están quemando dinero, y el problema no es el anuncio.
VALOR
Les escribimos a las cincuenta como si fuéramos pacientes. Tardaron, en promedio, tres horas y cuarenta minutos en contestar. Once nunca contestaron. Quien pregunta por un implante no espera tres horas: le escribe a la clínica de al lado.
CTA
Si tienes una clínica, agenda la auditoría gratis de treinta minutos y revisamos juntos tus últimos veinte mensajes.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | «43 de 50 anuncios queman dinero» | Diego en el set, plano medio. |
| VALOR | «3 h 40 min para responder» · «11 nunca contestaron» | Corte al segundo ángulo en «Once nunca contestaron». |
| CTA | «Auditoría gratis · 30 min» | Primer ángulo. |

**Ganchos para probar:**
- **Pregunta:** «¿Cuánto tarda tu clínica en contestar un mensaje? Mídelo hoy.» · en pantalla «¿Cuánto tardas en responder?».
- **Idea contraria:** «Tu problema no son los anuncios. Es lo que pasa después del anuncio.» · en pantalla «Después del anuncio».
- **Prueba:** «Una clínica pasó de seis a veintitrés valoraciones sin subir la inversión.» · en pantalla «6 → 23 valoraciones».

**Miniatura:**
- Diego frente al micrófono, con luz cálida y paneles detrás.
- Franja: «43 de 50 anuncios queman dinero».
- Chips: «Agencia» · «~26 s» · «Autoridad».

**Datos que pide:** un dato propio medido (no se inventa: sin dato, el gancho pasa a ser una pregunta) y la oferta de entrada (auditoría, diagnóstico).

### 6. Caso de un cliente, caminando por la oficina

- **Ejemplo:** Pulso Dental. El cliente es la Clínica Dental Altamira del Dr. Felipe Cárdenas (Medellín), también ficticio.
- **Cuándo usarla:** prueba social contada **por el dueño**, no por un avatar que se hace pasar por el cliente. Para retargeting o público tibio.
- **Preset:** `oficina-presentador`, que ya existe. Es el formato `plano-secuencia`, **medido** y con video real en `/formatos/plano-secuencia.mp4`.
  - Alterna tomas habladas y en off (H O H O H O H H). En las tomas en off va el B-roll.
  - Voz: `colombiano-hombre-1`.
- **Escena:** el prompt del preset (oficina luminosa con ventanales, cámara que acompaña) + detalle «Con camisa oxford celeste».

```
GANCHO
Esta clínica de Medellín invertía lo mismo que hoy en anuncios y tenía seis valoraciones al mes.
HISTORIA
Los anuncios funcionaban. El problema venía después: los mensajes se contestaban por la tarde y nadie decía el rango de precio. Cambiamos tres cosas: respuesta en menos de cinco minutos, cinco preguntas de filtro y una sola invitación, la valoración. Al tercer mes tuvieron veintitrés valoraciones y nueve tratamientos.
CTA
Si tu clínica recibe mensajes pero no pacientes, agenda la auditoría de treinta minutos.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | «Clínica Dental Altamira · Medellín» | Diego camina por la oficina y habla. |
| HISTORIA (off) | «Respuesta en < 5 min · 5 preguntas · 1 invitación» | B-roll: un chat de WhatsApp respondido en 4 min. En el ejemplo, maqueta del Image Editor. |
| HISTORIA (habla) | «6 → 23 valoraciones al mes · misma inversión» | Diego a cámara. |
| HISTORIA (off) | «9 tratamientos al tercer mes» + «Resultado de una clínica en particular» | B-roll: el tablero semanal. En el ejemplo, maqueta. |
| CTA | «Auditoría · 30 min» | Diego a cámara. |

**Ganchos para probar:**
- **Antes y después:** «Seis valoraciones al mes. Tres meses después, veintitrés. Mismo presupuesto.» · en pantalla «6 → 23».
- **Curiosidad:** «No cambiamos ni un anuncio de esta clínica, y casi cuadruplicó sus valoraciones.» · en pantalla «Sin tocar los anuncios».
  - Ojo: «casi cuadruplicó» sale de 6 → 23. El agente recalcula la palabra con los números de cada caso: nunca la copia.
- **Identidad:** «Si tu clínica recibe mensajes y no pacientes, este caso es el tuyo.» · en pantalla «Mensajes ≠ pacientes».

**Miniatura:**
- El primer cuadro del video real del formato, con Diego en el look.
- Franja: «6 → 23 valoraciones al mes».
- Chips: «Agencia» · «~39 s» · «Caso».
- Sin look propio todavía, la tarjeta usa el póster que ya existe en `/formatos/plano-secuencia.jpg`.

**Datos que pide:**
- el caso real, con el **permiso escrito** del cliente para decir su nombre y sus números (sin permiso, va sin nombre);
- qué cambió;
- en cuánto tiempo.

### 7. Recorrido de la preventa

- **Ejemplo:** Torre Alameda (Querétaro), preventa de departamentos de 2 recámaras y 78 m², desde MXN 2.4 M, con enganche del 10 % diferido a 18 meses. La desarrolladora no lleva nombre (README, 2.2).
- **Cuándo usarla:** inmobiliarias en preventa con público tibio. La asesora presenta y **el departamento se ve solo en el video o los renders oficiales**.
- **Preset:** `oficina-presentador`, que ya existe (`plano-secuencia`). Las tomas en off son justo las que cubre el recorrido real. Voz: `mexicano-mujer-1`.
- **Escena:** el prompt del preset + detalle «Con blazer color camel, en una oficina de ventas».
  - Nunca «en el departamento muestra»: un interior hecho por la IA sería publicidad engañosa (trampa 7).

```
PROMESA
Si estás comparando preventas en Querétaro, este recorrido te ahorra dos visitas.
PINTURA
Setenta y ocho metros, dos recámaras y dos baños. Enfrente hay un parque municipal. Además, alberca, gimnasio y roof garden.
PRUEBA
La etapa uno se entregó en noviembre de dos mil veinticinco, en la fecha del contrato. La etapa dos va en el sesenta por ciento.
CTA
Escríbeme por WhatsApp y hoy te mando la lista de precios y la corrida con enganche diferido.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| PROMESA | «Desde MXN 2.4 M · 2 recámaras · 78 m²» | La asesora en la oficina de ventas. |
| PINTURA (off) | «Vista al parque · alberca · roof garden» | **Video o renders OFICIALES**. En el ejemplo, un cuadro rotulado «Video oficial del departamento muestra»: la regla es la lección. |
| PRUEBA | «Etapa 1 entregada a tiempo · avance de obra 60 %» | La asesora a cámara; foto oficial de la obra si existe. |
| CTA | «Enganche 10 % a 18 meses» | La asesora a cámara. |

**Ganchos para probar:**
- **Pregunta:** «¿Rentar tres años más o dar el enganche este año?» · en pantalla «La cuenta que nadie te hace».
- **Prueba primero:** «La etapa uno se entregó a tiempo. Esta es la etapa dos.» · en pantalla «Entregamos lo que prometimos».
- **Cuenta regresiva:** «Quedan catorce departamentos con vista al parque.» · en pantalla «14 con vista al parque». Solo si es real. Nunca «14 de 96»: se lee como «quedan 14 en total», y quedan 46.

**Miniatura:**
- La asesora en la oficina de ventas.
- Franja: «Desde MXN 2.4 M · 2 recámaras».
- Chips: «Inmobiliaria» · «~36 s» · «Preventa».

La PINTURA dice solo el hecho («Enfrente hay un parque municipal»). La primera versión agregaba «la vista no te la tapa nadie»: una desarrolladora no puede garantizar que nadie construya enfrente, y en un anuncio de vivienda eso es publicidad engañosa.

**Datos que pide:** precio desde, metros y ambientes, forma de pago, fecha de entrega, avance de obra, y **si tiene video o renders oficiales** (sin eso, la plantilla no se ofrece: se propone la 10).

### 8. Entrevista en la calle

- **Ejemplo:** Voz de Líder. Rodrigo Ibarra (Lima), oratoria para gerentes. Programa de 90 días en cohortes de 12, USD 2,000.
- **Cuándo usarla:** público frío. Responde la pregunta que se hace el cliente ideal, y la pregunta aparece en pantalla.
- **Preset:** `calle-microfono`, **nuevo**, categoría UGC y TikTok. Usa el formato `ugc-sin-producto`. Voz: `latino-hombre-1`.
- **Escena:**
  - prompt: `Vertical medium close-up on a busy downtown sidewalk, person holding a handheld wireless microphone with a plain black foam windscreen, answering an interviewer behind the camera, handheld camera at chest height with slight natural sway, 35mm lens, bright overcast daylight, pedestrians and storefronts softly blurred`
  - detalle: «Con chaqueta de mezclilla».

```
GANCHO
Casi siempre te interrumpen por lo mismo: tardaste en llegar al punto.
PROBLEMA
Un gerente me dijo: «Sé exactamente qué decir, hasta que me toca el directorio». No son nervios. Nunca preparó los primeros veinte segundos.
SOLUCION
Abre con la conclusión, no con el contexto: qué decidiste, cuánto cuesta y qué necesitas de ellos. Lo demás va después, si te lo piden.
CTA
Si presentas ante un directorio, escríbeme JUNTA y te cuento si la cohorte es para ti.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| (0 a 3 s) | La pregunta: «¿Qué haces si te interrumpen en una junta?» | Rodrigo con el micrófono, en la calle. |
| PROBLEMA | «Los primeros 20 segundos» | La misma toma. |
| SOLUCION | «Conclusión → costo → pedido» | La misma toma. |
| CTA | «Escríbeme JUNTA» | Solo si existe la respuesta automática a esa palabra. |

**Ganchos para probar:**
- **Identidad:** «Si eres gerente y te cortan a mitad de la presentación, esto es para ti.» · en pantalla «Gerentes: te cortan».
- **Idea contraria:** «No te falta seguridad. Te sobra contexto.» · en pantalla «Te sobra contexto».
- **Prueba:** «Una alumna presentó el presupuesto anual y nadie la interrumpió.» · en pantalla «0 interrupciones».

**Miniatura:**
- Rodrigo con el micrófono negro sin marca, con la calle desenfocada.
- Franja: la pregunta.
- Chips: «Coach» · «~26 s» · «Pregunta en la calle».

**Datos que pide:** la pregunta que más le hacen sus clientes, la respuesta corta de su método y la acción.

### 9. Carta del fundador (cierre de cohorte)

- **Ejemplo:** Voz de Líder.
- **Cuándo usarla:** público que ya te conoce, al cierre de inscripciones. Es la oferta directa, con fecha y cupo **reales**. El tono es sobrio, como un spot.
- **Preset:** `despacho-noche`, **nuevo**, categoría Negocio. Usa el formato `ugc-sin-producto`. Voz: `latino-hombre-1`.
- **Escena:**
  - prompt: `Vertical cinematic medium shot of a person in a dark blazer leaning on the edge of a walnut desk in an executive office at dusk, bookshelves behind and city lights as soft bokeh through the window, Rembrandt key light from the window side, warm desk lamp practical, low-key contrast, subtle teal and amber grade, 50mm lens, shallow depth of field, slow dolly-in`
  - detalle: «Con camisa blanca de cuello abierto».

```
GANCHO
Te voy a decir algo incómodo: tu próximo ascenso depende menos de lo que sabes y más de cómo lo dices frente a un directorio.
PROPUESTA
La cohorte de mayo son diez semanas en vivo, los martes, con doce personas. Cada semana presentas, te grabamos y te corrijo yo. Carla, de la cohorte pasada, presentó el presupuesto anual y nadie la interrumpió. La inversión es de dos mil dólares.
CTA
Quedan cuatro lugares y cierro inscripciones el viernes. Si quieres uno, escríbeme JUNTA.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| GANCHO | — (sostiene el silencio) | Rodrigo apoyado en el escritorio. |
| PROPUESTA | «Cohorte de mayo · 90 días · 12 personas» · junto a Carla: «Resultado individual. No es garantía.» | Captura autorizada del mensaje de Carla. En el ejemplo, maqueta. |
| CTA | «Quedan 4 lugares · cierra el viernes» | Solo si es verdad. |

**Ganchos para probar:**
- **Urgencia real:** «Cierro inscripciones el viernes y quedan cuatro lugares.» · en pantalla «Quedan 4».
- **Aspiración:** «La próxima vez que presentes, que nadie te interrumpa.» · en pantalla «Sin interrupciones».
- **Prueba:** «Doce gerentes, diez semanas, una presentación por semana.» · en pantalla «12 · 10 · 1».

**Miniatura:**
- Rodrigo con luz baja y la ciudad desenfocada.
- Franja: «Quedan 4 lugares».
- Chips: «Coach» · «~27 s» · «Cierre».

**Datos que pide:** la fecha de inicio, el cupo y la fecha de cierre reales, el precio, y un caso con permiso. **Sin cupo ni fecha reales, el CTA pasa a «agenda una llamada»**, sin escasez.

### 10. Pantalla dividida: renta o mensualidad

- **Ejemplo:** Torre Alameda.
- **Cuándo usarla:** para la objeción «rentar o comprar», con público que ya conoce el producto. A la izquierda, lo que paga hoy; a la derecha, la asesora.
- **Preset:** `sala-de-ventas`, **nuevo**, categoría Negocio. Usa el formato `ugc-sin-producto`. Voz: `mexicano-mujer-1`.
- **Escena:**
  - prompt: `Vertical medium shot of a person in a camel blazer seated at a tidy desk in a bright real estate sales office, large window with soft daylight, plants and a plain neutral wall behind, static tripod, 50mm lens, natural colors, calm professional look`
  - detalle: «Con blusa clara». Nada de accesorios en la cara (aretes, lentes): quedan pegados a los rasgos, y la identidad la pone la foto.

- **La cifra:** MXN 18,900 al mes es el crédito estimado del elenco (README, 2.2): MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %. La renta típica de la zona es de MXN 14,000, así que «el mismo pago» sería falso para casi todos: el guion y los ganchos lo dicen siempre como condición.

```
ANTES
A la izquierda, tu recibo de renta. A la derecha, el crédito de un departamento en Torre Alameda: desde dieciocho mil novecientos pesos al mes, a veinte años.
DESPUES
Si hoy pagas una renta parecida, en veinte años uno de los dos es tuyo. Si pagas menos, hagamos la cuenta antes de que decidas.
PUENTE
Y el enganche no lo juntas de golpe: es del diez por ciento, diferido a dieciocho meses. La entrega es en diciembre de dos mil veintisiete.
CTA
Escríbeme y te mando la corrida con tu mensualidad exacta.
```

| Tramo | Texto en pantalla | Lo que se ve |
|---|---|---|
| ANTES | Izquierda: «Renta: $ ____ al mes». Derecha: «Crédito desde $18,900 al mes*» y, chico, «*Estimado a 20 años. Depende del banco.» | Dos mitades, armadas a mano en el Video Editor. El recibo es un gráfico del Image Editor, sin marca ni persona. |
| DESPUES | «Si tu renta es parecida, en 20 años uno es tuyo» | La asesora a cámara. |
| PUENTE | «Enganche 10 % a 18 meses · entrega dic. 2027» | La misma toma. |
| CTA | «Corrida con tu mensualidad» | La misma toma. |

**Ganchos para probar:**
- **Contraste:** «Si tu renta ronda los diecinueve mil, ese mismo pago podría ser de algo tuyo.» · en pantalla «Renta o crédito». Solo si la renta de la zona lo confirma.
- **Objeción:** «¿Cuánto pago al mes? Te lo muestro.» · en pantalla «Crédito desde $18,900 al mes».
- **Situación:** «Cuando el segundo hijo ya no cabe en la recámara…» · en pantalla «Necesitas otra recámara».

**Miniatura:**
- La tarjeta parte el marco 9:16 en dos: a la izquierda el recibo gris, a la derecha la asesora.
- Chips: «Inmobiliaria» · «~30 s» · «Comparación».

**Datos que pide:** la mensualidad del crédito con su plazo y su tasa de referencia, el enganche y su plazo, la entrega y la renta típica de la zona. La frase de la renta queda siempre condicional, como en el ejemplo; si la renta típica es mucho menor que la mensualidad, el gancho de contraste no se usa.

### Cómo se ve la tarjeta (las 10)

La tarjeta de «¿Qué vas a crear hoy?» (`cr-plantilla`, miniatura 4:3) cambia así cuando la plantilla trae contenido:
- **Izquierda, un marco 9:16 (el «teléfono»):**
  - el póster del look o, mientras no exista, el degradado de la categoría (`TONO_CATEGORIA`);
  - arriba, la franja con el texto en pantalla del GANCHO;
  - abajo, el subtítulo de la primera frase;
  - la insignia «Ejemplo».
- **Derecha:**
  - la primera frase hablada entre comillas, en 3 líneas como máximo;
  - los chips: rubro, duración y estructura.
- **Abajo:** el nombre.

**Con eso la tarjeta muestra contenido real desde el día 1, sin una sola imagen.** El póster llega después: el motor de looks nunca generó uno en producción (medido el 29/10).

### De dónde salen las imágenes y los clips

| Qué | Fuente | Términos |
|---|---|---|
| **La cara de cada persona del elenco** (Andrea, Mariana, Diego, la asesora y Rodrigo) | Un retrato de una persona **inexistente**, hecho una vez en Flow con texto (sin foto). Después se usa como «foto» en el motor de looks, con el preset y el detalle de cada plantilla. Una cara por persona del elenco: Andrea es la misma en sus dos plantillas. | Política de uso de IA generativa de Google (verificada): prohíbe suplantar a una persona sin avisarlo y hacer pasar el contenido por humano para engañar. Por eso la tarjeta lleva la cinta «Ejemplo» y, al abrirla, el rótulo común «Ejemplo: <negocio> (negocio ficticio)». Los términos adicionales de IA generativa **no dicen quién es dueño del resultado**: queda sin verificar. |
| **Póster** (`public/ai-avatar/plantillas/<id>.jpg`, ~25 KB como los de `/formatos`) | El look generado (gratis en Flow) | Propio |
| **Loop de 3 a 5 s, mudo** (`<id>.mp4`, ~300 KB) | La primera toma del video del ejemplo | Cada toma cuesta unos 15 créditos de la cuenta de Flow del super admin (unos 150 por las 10). Se hace **después** de la prueba de punta a punta del motor. |
| **Capturas del B-roll** (chat, agenda, tablero, comentario, recibo) | Maquetas en el Image Editor con datos del elenco | Propio. Nunca la captura de un cliente real. |
| **Interiores del departamento** (plantilla 7) | Ninguna: un cuadro rotulado «Video oficial del departamento muestra» | Si Martín prefiere imagen: un clip de Pexels **sin personas**, elegido a mano y bajado una vez, sin API. La licencia de Pexels (verificada) permite el uso comercial y no exige crédito, pero prohíbe dar a entender que las personas de la imagen respaldan algo. Si se usara la API, exige un enlace visible a Pexels y tiene un límite de 200 pedidos por hora y 20.000 por mes (verificado). |
| **Caras de stock** | **Nunca** | Animar a una persona de un banco de imágenes para vender viola «implicar respaldo» (Pexels) |

---

## 3. El Director de avatar (el agente experto de la tab)

### Método

1. **Leer antes de preguntar.** Primero lee el negocio con `contextoDelNegocio` (`lib/copywriter/contexto.ts`, Second Brain, 1.800 tokens) y la voz del cliente. Nunca pregunta lo que ya está.
2. **Diagnosticar en una línea:** plantilla nueva, guion propio que hay que respetar o cambio puntual.
3. **Nivel de conciencia del público** (Schwartz, contado con palabras propias):
   - situación sin producto → dolor → diferencia → objeción y prueba → oferta con fecha.
4. **Reescribir el ejemplo ENTERO.**
   - **Se conserva:** las etiquetas, la función de cada tramo, la escena y el rango de largo.
   - **Se reemplaza:** todo dato (nombres, ciudades, cifras, casos, precio, fecha, destino del CTA).
   - Lo que falta va como `[DATO: …]`.
5. **Tres ganchos sobre el mismo cuerpo**, cada uno con otro disparador. Cada gancho trae lo que se dice y el texto en pantalla, y los dos no se repiten. Es la «prueba de guiones» de HeyGen: el mismo cuerpo con 3 aperturas.
6. **Escena en una línea en español:** ropa, momento del día, un objeto. **Nunca rasgos:** la cara la pone la foto.
7. **El código revisa lo que el modelo no puede garantizar**, con una pasada de corrección:
   - el largo, con `cabidaDeGuion` sobre la puesta del preset;
   - el voseo con `marcasDeVoseo`, **solo si el acento del negocio no es voseante**;
   - que las etiquetas sean las de la estructura;
   - que el detalle pase la regex de cara del test y entre en `MAX_DETALLE`;
   - que no queden **marcas del ejemplo** (los nombres y las cifras propias de cada plantilla).
8. **Entrega una propuesta** que la persona acepta: «Usar este guion». **Nunca filma:** cada toma cuesta créditos y filmar es un botón.

### Las preguntas (por hechos, de a una, como máximo 3, y solo si el dato no está)

En este orden:
1. ¿Qué vendes, cuánto cuesta y cómo se paga?
2. ¿A quién se lo vendes? Descríbeme a una persona: a qué se dedica y qué la frena hoy.
3. ¿Qué frase repiten tus clientes sobre su problema?
4. ¿Qué prueba real tienes? Un número tuyo, un caso con permiso, años de experiencia o una garantía.
5. ¿Qué tiene que hacer quien vea el video? Agendar, escribir por WhatsApp, registrarse a la clase o postular.
6. ¿Este público ya te conoce?

Las preguntas que dependen de la plantilla (salen de su lista `pide`):
- **Plantilla 6:** ¿Tienes el permiso del cliente para decir su nombre y sus números?
- **Plantilla 7:** ¿Tienes video o renders oficiales del departamento?
- **Plantillas 7 y 9:** ¿El cupo o la fecha son reales? ¿Hasta cuándo?
- **Plantilla 3:** ¿Qué día y a qué hora es la clase?
- **Plantillas 4, 8 y 9:** ¿Tienes una respuesta automática para esa palabra?
- **Plantilla 2:** ¿Tienes la captura del comentario real?
- **Si dice que la cara es de otra persona:** ¿Esa persona dio su permiso? Sin permiso no se sigue.

### Cómo adapta la plantilla con los datos del negocio

| Del ejemplo | En la versión de la persona |
|---|---|
| Nombre, ciudad y rubro del elenco | Los del negocio. Si queda alguna marca del ejemplo, el código la caza y pide corregir. |
| Cifras del ejemplo («seis a veintitrés») | Solo cifras del negocio. Sin cifras, prueba de proceso («respondemos en menos de cinco minutos») y una línea: «Con tu número de valoraciones esto pega más fuerte». |
| Cupo o fecha («quedan cuatro lugares») | Solo si la persona confirma que es real. Si no, el tramo pasa a la oferta sin escasez. |
| CTA con palabra clave | Solo si existe la respuesta automática. Si no, «agenda desde el botón» o «escríbeme por WhatsApp». |
| Caso de cliente con nombre | Con permiso, con nombre. Sin permiso, sin nombre («una clínica de Medellín»). Sin caso, la plantilla 6 no se ofrece. |
| Interior inmobiliario | Solo con material oficial. Sin material, propone la plantilla 10. |
| Largo | El rango de la puesta del preset: de 20 a 40 s × densidad (60 a 120 palabras hablando a cámara; 42 a 84 en «The Office»). |
| Idioma | `bloqueIdiomaCopy(acento)` de `lib/copywriter/ia-reglas.ts`, el mismo del Copywriter. Si el negocio es voseante, el guion hablado puede serlo, igual que el plan del Video Generator (`acentoEsVoseante`). |

### El turno en la pantalla

**Primer mensaje** (estático, no llama a la IA):
- «Es un ejemplo de Cierre Consultivo, un negocio ficticio. ¿Lo adapto a tu negocio?» (el texto común de las cinco tabs, README 2.3; el rubro ya está en el rótulo y en la tarjeta).
- Dos botones: **Adaptar a mi negocio** y **Ver el ejemplo completo**.

**Después:**
- vienen las preguntas;
- al final, la tarjeta con el guion y los 3 ganchos para elegir;
- el botón **Usar este guion** deja el guion listo y pone el detalle en la barra.

### PROMPT BASE (system), listo para registrar como `ai_avatar.director.system`

Slots: `{{idioma}}` (de `bloqueIdiomaCopy`) y `{{formato}}` (el JSON, que sale del código).

```
Eres el Director de avatar de MaKo. Conviertes una plantilla de video con avatar en el anuncio de UN negocio real: el guion que dice el avatar, el ajuste de la escena y los textos que van en pantalla. Trabajas para negocios high ticket de Latinoamérica: coaches, infoproductores, agencias e inmobiliarias.

{{idioma}}

QUÉ RECIBES
- La plantilla: su estructura (las etiquetas en mayúsculas), su escena, el largo que admite y un ejemplo completo de un negocio FICTICIO. El ejemplo muestra la forma; sus datos no son de nadie.
- El negocio de la persona (oferta, precio, cliente ideal, promesa, garantía, pruebas, objeciones) y su voz.
- Los datos que esta plantilla necesita y la conversación hasta ahora.

CÓMO TRABAJAS
1. Lee el negocio antes de preguntar. Nunca preguntes lo que ya está.
2. Si falta un dato imprescindible, haz UNA pregunta por mensaje, sobre un hecho, con 2 a 4 opciones cuando se pueda. Como máximo tres preguntas en toda la conversación; lo que siga faltando va como [DATO: …]. Orden: qué vende y a qué precio; a quién (una persona concreta); qué dolor o deseo resuelve, con las palabras de su cliente; qué prueba real tiene; qué acción quiere; si este público ya lo conoce.
3. Define el nivel de conciencia del público:
- No sabe que tiene el problema: abre con una situación, sin nombrar el producto.
- Sabe que tiene el problema: nombra el dolor con sus palabras.
- Compara soluciones: di en qué es distinto de lo que ya probó.
- Conoce el producto: responde la objeción, muestra la prueba y la garantía.
- Está listo: la oferta, el cupo o la fecha (solo si son reales) y la acción.
4. Reescribe el ejemplo ENTERO con los datos del negocio. Conserva las etiquetas de la estructura, en mayúsculas, sin tildes y solas en su línea: no se pronuncian y ordenan el video. No arrastres ningún nombre, número, ciudad ni caso del ejemplo.
5. Escribe para decirlo en voz alta: frases cortas, una idea por frase, los números con letras («mil quinientos dólares», nunca «USD 1,500»), porque el largo del video se calcula contando palabras. Si una línea suena a locutor, reescríbela. Respeta el largo que te indican.
6. El gancho usa uno o dos de estos disparadores: interrupción, identidad («Si eres…»), dolor, curiosidad, prueba, idea contraria, aspiración, urgencia real. Nunca abras con el nombre de la marca, con «Descubre», con «Presentamos» ni con «¿Estás buscando…?». Escribe además dos ganchos alternativos con otros disparadores, para probarlos sobre el mismo cuerpo.
7. Un solo mensaje, dos o tres beneficios como máximo y un solo CTA concreto («agenda desde el botón», «escríbeme por WhatsApp», «reserva tu lugar en el enlace»). Un CTA con palabra clave («escríbeme JUNTA») va solo si el negocio tiene la respuesta automática para esa palabra; si no lo sabes, usa otro.
8. Textos en pantalla: uno por tramo, de 2 a 6 palabras, con los números en cifras, sin repetir lo que se dice. Los pone el editor: el video nunca escribe texto.
9. La escena se ajusta en una línea, en español: ropa, momento del día o un objeto. NUNCA describas la cara, el pelo, la piel, la edad ni los rasgos: la identidad la pone la foto de la persona.

LO QUE NO SE NEGOCIA
- Nunca inventes cifras, clientes, testimonios, reseñas, resultados, garantías, fechas ni cupos. Cada prueba sale del negocio y dices de dónde. Si no hay prueba, usa una de proceso (cómo trabajas, qué revisas, cuánto tardas) y dile a la persona qué dato real la haría más fuerte.
- El avatar es la persona dueña del negocio o alguien de su equipo que dio su permiso. Nunca se presenta como cliente. Un caso de cliente lo cuenta el dueño, con el permiso del cliente; sin permiso, va sin nombre.
- Inmobiliarias: el departamento se muestra solo con video o renders oficiales. El avatar presenta; no recorre un interior inventado.
- Escasez y urgencia, solo si son verdad. Un resultado fuera de lo común lleva en pantalla «Resultado individual. No es garantía.»
- Nada que señale la salud, el cuerpo, las deudas o los ingresos de quien mira, ni ingresos garantizados.
- Prohibido: revolucionario, secreto, transforma tu vida, en el mundo actual, descubre, potencia, sin más preámbulos; la fórmula «no es X, es Y» repetida; las listas de tres por reflejo; las preguntas que respondes tú mismo.
- No filmas ni gastas créditos: entregas el guion. Filmar es un botón de la persona.

ANTES DE RESPONDER, REVISA
¿El gancho habla del dolor o del deseo y no de la marca? ¿Cada número lo dio el negocio? ¿Queda algo del ejemplo (nombres, cifras, ciudades)? ¿El largo está en el rango? ¿Las etiquetas son las de la estructura y están en orden? ¿El CTA dice exactamente qué hacer? Si algo falla, corrígelo antes de responder.

RESPONDES SOLO CON ESTE JSON, SIN TEXTO ALREDEDOR:
{{formato}}
```

### Mensaje de usuario, `ai_avatar.director.user`

Slots: `plantilla`, `estructura`, `escena`, `largo`, `ejemplo`, `negocio`, `pide`, `charla` y `pedido`. Los cuatro últimos van envueltos con `contenidoNoConfiable`.

```
La persona abrió la plantilla «{{plantilla}}».
Estructura (etiquetas, en este orden): {{estructura}}
Escena: {{escena}}
Largo del guion: {{largo}}

EJEMPLO DE UN NEGOCIO FICTICIO (muestra la forma; nunca copies sus datos):
{{ejemplo}}

EL NEGOCIO DE LA PERSONA (lo que no está aquí, no existe):
{{negocio}}

DATOS QUE ESTA PLANTILLA NECESITA (búscalos en el negocio; pregunta solo los imprescindibles que falten):
{{pide}}

LA CONVERSACIÓN HASTA AHORA:
{{charla}}

LO ÚLTIMO QUE ESCRIBIÓ LA PERSONA:
{{pedido}}

Si falta algo imprescindible, devuelve una pregunta. Si no, devuelve el guion completo.
```

### `{{formato}}` (constante en código, `FORMATO_DIRECTOR`)

```
{"tipo":"pregunta","pregunta":"…","opciones":["…","…"]}
o bien
{"tipo":"guion","guion":"GANCHO\n…\nCTA\n…","textos":[{"etiqueta":"GANCHO","texto":"…"}],"ganchos":[{"disparador":"…","dice":"…","texto":"…"}],"escena":"…","faltan":["[DATO: …]"],"porque":"una línea"}
```

**Calls:**
- Con `chatClaude(brandSystem(sys + REGLA_NO_EXISTE), …, { feature: 'ai-avatar-director', hastaMs: 60_000 })`, igual que el Copywriter (`lib/copywriter/ia.ts`). La paga la IA del negocio.
- La salida pasa por `objetoConUnaReparacion` (`lib/editor-landing/ia-reglas.ts`) y por las revisiones del paso 7 del método.

---

## 4. Qué se copia y de dónde (licencias abiertas hoy)

| Fuente | Licencia (leída) | Uso | Qué se toma |
|---|---|---|---|
| https://github.com/motion-creative/skills | **MIT, «Copyright (c) 2025 Motion»**. Verificado: `raw.githubusercontent.com/motion-creative/skills/main/LICENSE` | copiar con crédito | Se traducen y reescriben `hook-writing` (los 8 disparadores y la terna dicho / visual / texto) y `ugc-scriptwriter` (el arco y los errores frecuentes). El aviso va en `lib/avisos/LICENSE-MOTION-SKILLS` (README, sección 5). Se saca la promoción de «Motion». |
| https://github.com/coreyhaines31/marketingskills | **MIT, «Copyright (c) 2025 Corey Haines»**. Verificado | copiar con crédito | De `skills/video/SKILL.md` (leído hoy): cuándo conviene un avatar y cuándo filmarse, la fórmula sujeto + acción + cámara + estilo + ánimo, «los subtítulos siempre» y «el texto por overlay, el modelo no lo escribe». El aviso va en `lib/avisos/LICENSE-MARKETINGSKILLS`, la misma copia que usan Copywriter, Image y Offer. |
| https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide | **«Creative Commons Attribution 4.0» el contenido y «Apache 2.0» el código**. Verificado en el pie | copiar con crédito | El vocabulario de cámara, lente y luz de los prompts de los presets nuevos, más la regla del negativo («listar lo que no se quiere, sin "no"»). El crédito va en la cabecera de `lib/ai-avatar/plantillas.ts`: «Vocabulario: Google Cloud, CC BY 4.0». **Sin** «eye-level», «hair light» ni «skin» (trampa 2). |
| https://help.heygen.com/en/articles/12805098-… | Documentación propietaria | solo idea | Los hechos: parte del cuerpo + acción + emoción, un gesto por toma, 10 s y después se repite, y que no controla la cámara. Hoy el motor no recibe gestos (trampa 3). |
| https://www.heygen.com/avatars/ugc · https://www.arcads.ai/ · https://creatify.ai/features/ai-avatar · https://captions.ai/help/guides/marketing/ugc-ad | Productos con copyright | solo idea | La tarjeta-ejemplo, «Testing Scripts», el chip de rubro y la duración |
| https://claudskills.com/skills/higgsfield-marketing-studio/SKILL.md | **Sin licencia declarada** | solo idea | Los nombres de los 9 presets y su gramática de cámara, como dato |
| https://github.com/fal-ai-community/skills | **Sin LICENSE**: el archivo dio 404 y la API de licencias de GitHub también. El README dice «MIT», pero no alcanza | solo idea | El orden gancho → contexto → producto → prueba → cierre y la regla «nunca inventar testimonios». Texto propio. |
| https://www.pexels.com/license/ · https://www.pexels.com/api/documentation/ | Licencia de Pexels (verificada): uso libre; prohíbe implicar respaldo, mostrar personas de forma ofensiva y redistribuir en otras plataformas de stock. La API pide un enlace visible y tiene un límite de 200 pedidos por hora y 20.000 por mes. | solo idea (opcional) | Solo un interior sin personas para la plantilla 7, si Martín lo pide |
| https://www.jordanglickman.com/writing/meta-creative-formats-100m-spend-playbook | Blog con copyright; las cifras son del autor, sin metodología | solo idea | Los formatos (fundador en estudio de podcast, entrevista en la calle, día en la vida). **Ninguna cifra.** |
| AIDA, PAS, BAB, Schwartz, «gancho de 3 s» | Métodos: no tienen licencia | solo idea | Con texto propio |

**No se copia:**
- `snubroot/Veo-3-Prompting-Guide`: el repo da 404 y otra fuente le atribuye una licencia «Professional».
- Los paquetes de prompts pagos.
- Las listas de presets de UGC Factory: no son públicas.
- `wide-trace/open-higgsfield`: sin licencia (ya registrado en `hallazgos-ai-avatar.md`).

---

## 5. Cómo implementarlo sobre el código actual

**Orden:** se hace en tandas y cada una sube sola. AI Avatar sigue siendo solo de super admin (`app/ai-avatar/acceso.ts`) hasta la prueba de punta a punta, así que esto no toca a ningún cliente.

### Tanda AV-1: los datos (sin pantalla)

1. **`lib/ai-avatar/plantillas.ts`:** sumar 5 presets: `pizarra-estudio`, `cocina-manana`, `calle-microfono`, `despacho-noche` y `sala-de-ventas`.
   - Todos con `puestaId: 'ugc-sin-producto'` y los prompts de la sección 2.
   - Cada uno con `guion` corto de ejemplo en tú y `voz` de las claves que ya existen.
   - En la cabecera, el crédito de Google (CC BY 4.0).
2. **Nuevo `lib/ai-avatar/plantillas-venta.ts`** (puro, sin `server-only`), con el tipo:

```ts
export type PlantillaVentaAvatar = {
  id: string;                 // 'confesion-auto'
  nombre: string;             // «Confesión en el auto»
  cuando: string;             // una línea, como `cuando` de lib/guion-estructuras.ts
  negocio: IdElenco;          // del elenco común (Tanda 0): 'cierre-consultivo' | …
  rubro: string;              // el chip: «Coach de ventas»
  presetId: string;           // un id de PLANTILLAS_AVATAR
  detalle: string;            // el ajuste de escena, en español (≤ MAX_DETALLE, sin cara)
  estructuraId: string;       // un id de ESTRUCTURAS_GUION_DEFAULT
  voz: string;                // clave de vozSugerida
  guion: string;              // con las etiquetas en su línea; números con letras
  tramos: { etiqueta: string; texto: string; seVe: string }[];
  ganchos: { disparador: string; dice: string; texto: string }[];  // 3
  pide: string[];             // los datos que el Director busca o pregunta
  marcas: string[];           // nombres y cifras del ejemplo que no pueden quedar en la versión adaptada
  miniatura?: { poster: string; video?: string };  // en public/ai-avatar/plantillas/
};
```

   Las 10 plantillas de la sección 2 van tal cual.
3. **Tests en `tests/ai-avatar.test.ts`:**
   - Todo `presetId` existe y **su puesta habla** (`puestaPorId(...).habla !== 'nunca'`). Es la red de la trampa 1.
   - Las etiquetas del guion son, en orden, las de `estructuraId`, y si la guía de esa estructura fija una duración (`reel-viral`: de 50 a 60 s), la del guion entra en ella.
   - `cabidaDeGuion(puesta, soloHablado(guion))` no desborda y queda entre 15 y 45 s.
   - Sin dígitos en `soloHablado(guion)`.
   - Cero `marcasDeVoseo` y cero argentinismos (`remera|campera|vereda|chomba|celu`, y «dar vuelta» en el sentido de invertir: `\b(dar|da|dé|darla|darlo)\s+vuelta\b`; «darle la vuelta» es neutro). La misma lista sirve para los tests de las otras tabs: en este plan se colaron «darla vuelta» y «dé vuelta» en Image y en el prompt de Offer.
   - El `detalle` pasa la regex `CARA` y entra en `MAX_DETALLE`.
   - Si hay póster o video, el archivo existe en `public/`.
   - Los 10 ids son únicos.
   - **Probarlo rompiéndolo:** poner `presetId: 'cafe-un-dia'` en la 4 tiene que fallar «el avatar no habla».
4. **`tests/variables-aviso.test.ts`:** sumar `lib/ai-avatar/plantillas-venta.ts` al recorrido de `REALES`, leyendo el fuente como hace con los placeholders.

### Tanda AV-2: la tarjeta con contenido

5. **`app/_crear/reglas.ts`:** `PlantillaCrear` usa los campos comunes de la tanda 0 (README, sección 6). AI Avatar llena estos:
   - `extracto?: string` (el texto en pantalla del gancho);
   - `frase?: string` (la primera frase hablada);
   - `chips?: readonly string[]`;
   - `video?: string | null`;
   - `insignia?: string` (el formato y la duración, «9:16 · 33 s»). La cinta «Ejemplo» sale de `ejemplo`, el nombre del negocio ficticio, como en las otras tabs.
6. **`app/_crear/PantallaCrear.tsx`** (en `NuevaCrear`) **y `app/_crear/crear.css`:** cuando hay `extracto`, la miniatura dibuja el marco 9:16 a la izquierda (con el póster o el degradado, la franja arriba y la insignia) y a la derecha la frase y los chips. El video solo arranca al pasar el cursor, `muted playsInline loop`, y nunca en el teléfono.
7. **`tests/crear-pantalla.test.ts`:** una plantilla sin campos nuevos se dibuja igual que hoy, y una con `extracto` no rompe el marco.

### Tanda AV-3: el estudio usa las plantillas

8. **`app/ai-avatar/Estudio.tsx`:**
   - `plantillas` de `PantallaCrear` pasa a ser `PLANTILLAS_VENTA_AVATAR` con título «Plantillas». Los 28 presets se quedan en la galería del estudio (`Nueva` y `SelectorPresets`) con el título «Presets».
   - `onPlantilla` hace `setPresetId(t.presetId)`, `setDetalle(t.detalle)` y `setPlantillaVenta(t.id)`.
   - Mientras hay una plantilla de venta abierta, `chat={(volver) => <Director … />}` en lugar del Cerebro.
   - En `Proyecto`, la pastilla «Usar el ejemplo» pasa a ser «Usar el guion de la plantilla» y toma `look.guion`. **Ya no ofrece meter el guion ficticio del preset.**
9. **`app/ai-avatar/looks.ts`:** `Look` suma `plantillaVentaId: string` y `guion: string`, **y `sano` los copia**. Si no, se pierden en la primera lectura (trampa 10).
10. **`app/ai-avatar/actions.ts`:**
    - `crearLookAction` acepta `plantillaVentaId` y `guion` y los guarda en el look; `LookCard` los expone.
    - **`crearVideoAction` rechaza un guion que todavía tiene `marcas` del ejemplo**: «Este guion todavía es el del ejemplo (Cierre Consultivo). Adáptalo antes de filmar: cada toma gasta créditos.» Es una guarda en positivo, en el server: el botón de la pantalla no alcanza.
    - Nueva `dirigirPlantillaAction({ plantillaId, charla, pedido })` → `lib/ai-avatar/director.ts`, que pasa por `puerta()`.
11. **`app/ai-avatar/estudio.css`:** estilos del chat del Director, con la misma tarjeta del chat de Create.

### Tanda AV-4: el Director editable

12. **Nuevos `lib/ai-avatar/director-reglas.ts`** (puro: `DIRECTOR_SYSTEM`, `DIRECTOR_USER`, `FORMATO_DIRECTOR`, `PROMPTS_DIRECTOR = { system: { key: 'ai_avatar.director.system', tpl }, user: { key: 'ai_avatar.director.user', tpl } }`, el parseo, las revisiones del paso 7 y `largoDe(puesta)`) **y `lib/ai-avatar/director.ts`** (`server-only`: `contextoDelNegocio`, `bloqueIdiomaCopy`, `renderPrompt`, `chatClaude`, `objetoConUnaReparacion`).
13. **`lib/prompt-registry.ts`:** un grupo nuevo después de «Copywriter»:

```ts
{
  group: 'AI Avatar',
  icon: '🎥',
  blurb: 'El Director de avatar: adapta una plantilla de video con avatar al negocio (guion, escena y textos en pantalla) preguntando de a un dato.',
  entries: [
    {
      key: 'ai_avatar.director.system', source: 'override',
      label: 'Director de avatar (system)', kind: 'system', dynamic: true,
      variables: [v('idioma', 'el idioma y el acento del guion (sale del código)'), v('formato', 'forma del JSON de la respuesta (sale del código)')],
      scope: 'full', sensitive: true,
      default: DIRECTOR_SYSTEM,
      context: 'Adapta una plantilla de AI Avatar al negocio. NO borres «Nunca inventes cifras…», la regla de la cara («la identidad la pone la foto») ni {{formato}}: sin él nada se aplica. El código revisa igual el largo, el voseo y que no queden datos del ejemplo.',
    },
    {
      key: 'ai_avatar.director.user', source: 'override',
      label: 'Plantilla + negocio + conversación (user)', kind: 'user', dynamic: true,
      variables: [v('plantilla', 'el nombre'), v('estructura', 'las etiquetas en orden'), v('escena', 'el preset y si el avatar habla'), v('largo', 'el rango de palabras de la escena'), v('ejemplo', 'el ejemplo completo del negocio ficticio'), v('negocio', 'lo que MaKo sabe del negocio'), v('pide', 'los datos que la plantilla necesita'), v('charla', 'lo último del chat'), v('pedido', 'lo que escribió la persona')],
      scope: 'full', sensitive: false,
      default: DIRECTOR_USER,
      context: 'Le pasa al Director la plantilla, el ejemplo y el negocio. Conserva los slots: {{negocio}}, {{charla}} y {{pedido}} llegan delimitados como dato no confiable.',
    },
  ],
},
```

    Después se corre la skill `verify-prompt-registry-sync`.
14. **`lib/model-catalogo.ts`:** la feature `ai-avatar-director` («MaKo en AI Avatar: adapta una plantilla al negocio»), con el mismo `def` que `copywriter-ia`. El test de `model-registry` exige `pagoPorque` si el proveedor cobra.
15. **Nuevo `tests/ai-avatar-director.test.ts`:**
    - las keys de `PROMPTS_DIRECTOR` coinciden con el registro;
    - cada `{{slot}}` del default está declarado y se pasa;
    - un guion con «Andrea» o «mil quinientos» se rechaza en la plantilla 1;
    - «tenés» se rechaza con acento mexicano y pasa con rioplatense;
    - un detalle con «pelo corto» se rechaza.

### Tanda AV-5: lo que completa la regla de la casa

16. **`lib/api-mako/areas/video.def.ts` y `video.run.ts`:** `ver_avatares` también devuelve las plantillas de venta (id, nombre, negocio de ejemplo y cuándo usarla). Es solo lectura: crear sigue fuera por el veredicto §8.
17. **`app/m/ai-avatar/EstudioM.tsx`:** la misma lista de plantillas en el teléfono, en una columna, con la tarjeta de la tanda AV-2.
18. **Las miniaturas:** se hacen **después** de la prueba de punta a punta del motor (está en «Lo que quedó sin hacer» de `hallazgos-ai-avatar.md`).
    - 5 retratos ficticios del elenco;
    - 10 looks, gratis;
    - los pósters a `public/ai-avatar/plantillas/`;
    - los 10 loops cuando el video ande (unos 150 créditos).
19. **Cosecha:** las trampas de la sección 6 van a `docs/hallazgos-ai-avatar.md`, con su línea en `docs/hallazgos.md`, en el mismo commit.

**Fase 2 (no entra en estas tandas):**
- **Gestos y acciones por toma:** pasar un `queSeVe` sugerido por tramo al planificador (`generarPlanAction` hoy no lo recibe).
- **Textos en pantalla automáticos:** que «Editar y exportar» (`rutaEditarEnEditor('anuncio:…')`) llegue al Video Editor con los textos del template ya puestos en sus tiempos. Hoy el `desde` trae solo el mp4, y los textos se muestran en el proyecto como una lista para copiar.
- **Pantalla dividida y chroma:** se arman a mano en el Video Editor (existe `croma`, pero el chat del editor no lo aplica: `NO_SE_PUEDE_CHAT`).

---

## 6. Trampas

1. **El preset decide si el avatar HABLA, y 9 de los 28 lo dejan mudo.**
   - `generarPlanAction` reparte el guion con `ritmoDeClips(puesta)`. Las puestas `voz-en-off` y `trends-virales` declaran `habla: 'nunca'`, así que todo el guion sale en off y el avatar queda en cuadro sin mover la boca.
   - Son `calle-promo`, `cafe-un-dia`, `metro`, `cabina-fotos`, `selfie-gran-angular`, `ojo-de-pez`, `camara-seguridad`, `biblioteca` y `niebla`.
   - `plano-secuencia` (8 presets) alterna habla y off (H O H O H O H H).
   - **El diagnóstico obvio («falla el lip-sync») es el equivocado.** Además, el borrador anterior asignaba justo `calle-promo` («Cierro el viernes»), `biblioteca` (invitación a clase) y `cafe-un-dia` (historia del fundador) a anuncios a cámara.
   - **Regla:** una plantilla de venta solo usa presets con puesta `siempre` o `mixto`, y un test lo fija.
2. **La guarda de la cara choca con el vocabulario de cámara.**
   - La regex de `tests/ai-avatar.test.ts` («ningún prompt describe la cara») caza «eye-level», «hair light» y «natural skin texture». Son tres términos estándar de la guía de Google y de la investigación, y `\beye\b` también ve el «eye» de «eye-level». Probado con los prompts de la investigación.
   - Además, los prompts de la investigación describen al sujeto («35-year-old», «salt-and-pepper beard», «short gray hair»), y eso es justo lo que rompía el parecido (`hallazgos-generativa.md`).
   - **En la casa:** «a person», la ropa y la composición.
3. **El prompt por toma de la investigación no tiene dónde ir.**
   - El video es el plan del Video Generator con UN look como escena de todas las tomas (`conAvatar`: `escenas: [{ n: 1, desde: 1, hasta: total }]`).
   - El prompt de cada toma lo escribe el código, en español («Esta persona dice: "…"», `lib/prompts-video.ts`).
   - El acento lo pone `conAcento` desde el cliente, y **borra** cualquier «Spoken in…» o «He says in neutral Latin American Spanish» que venga escrito.
   - Por eso «prompt en inglés con el diálogo entre comillas» solo vale para la composición del look. El gesto de HeyGen tampoco entra: el motor no recibe gestos (fase 2).
4. **Un avatar no testimonia.**
   - La regla de la FTC (verificada) prohíbe testimonios de personas que no existen, incluidos los hechos con IA.
   - La política de uso de Google (verificada) prohíbe suplantar sin avisar.
   - «Testimonio en el sillón» queda afuera. El caso lo cuenta el dueño (plantilla 6) con el permiso del cliente.
5. **Las plantillas de dos escenas no caben en un look.** El unboxing (cenital y fundador), el recorrido y la pantalla dividida necesitan un segundo look (otro proyecto) o B-roll en el Video Editor. Se resolvieron con tomas en off cubiertas por material real (7) o con un armado a mano (10).
6. **`podcast-experto` usa la puesta `podcast`, que declara DOS personas** («Dos imágenes de referencia, una por persona»). `conAvatar` fuerza una sola escena. Antes de ofrecer la plantilla 5 se filma un video de 2 tomas. Si el plan reparte el guion entre dos voces, el preset pasa a `ugc-sin-producto`.
7. **Inmobiliarias:**
   - Un interior generado por IA de una unidad que no existe es publicidad engañosa.
   - Tampoco sirve generar la asesora «en el departamento muestra»: el fondo sería un interior inventado.
   - **Regla:** la escena es una oficina de ventas neutra y el departamento entra solo como material oficial, en las tomas en off.
8. **Las palabras por toma no son las de la investigación.**
   - La investigación propone «18 palabras o menos por toma de 8 s» (una estimación propia, sacada de referencias en inglés).
   - La casa midió otra cosa (`lib/puestas-data.ts`): 3 palabras por segundo a cámara, y en un clip de 10 s «menos de 26 tartamudea, más de 30 no entra»; 2,1 en «The Office».
   - Y el motor reparte las tomas solo, desde el TOTAL (`cabidaDeGuion`).
   - **La plantilla fija el total, no las tomas.**
9. **Los dígitos achican la duración.** `contarPalabras` cuenta «1,500» como una palabra y «2027» como una, pero se dicen «mil quinientos» y «dos mil veintisiete». Un guion con cifras se planifica corto y la voz se apura. Por eso los números del guion van con letras y los del texto en pantalla, en cifras. Deducido del código: no se midió en Flow.
10. **`sano` de `app/ai-avatar/looks.ts` es una lista blanca.** Un campo nuevo del look (`guion`, `plantillaVentaId`) que no se agrega ahí desaparece en la primera lectura, sin error.
11. **«Usar el ejemplo» puede filmar el guion ficticio.** Hoy la pastilla mete `preset.guion` en la caja y «Generar video» lo filma: créditos pagados por un texto que no es del negocio. La guarda va en `crearVideoAction`, en el server.
12. **El motor nunca generó un look en producción** (medido el 29/10). Las miniaturas con imagen no existen todavía, así que la tarjeta tiene que mostrar contenido real sin imagen (el marco con el texto y la frase). No se prometen loops hasta la prueba.
13. **Hay dos grillas.** «Nuevo avatar» (`NuevaCrear`, de `PantallaCrear`) y la galería estilo Higgsfield del estudio (`Nueva` y `SelectorPresets`). Hoy las dos muestran los presets. El plan las separa: plantillas de venta en la primera, presets en la segunda.
14. **El voseo depende del acento.**
    - Aplicar `marcasDeVoseo` siempre al guion adaptado rechaza el guion correcto de un negocio rioplatense: el plan ya tiene `acentoEsVoseante` y el Copywriter respeta la variedad con `bloqueIdiomaCopy`.
    - No aplicarlo deja pasar «tenés» en un negocio mexicano.
    - Los ejemplos del producto van siempre de tú.
    - La guarda de voseo no caza argentinismos («remera», «campera», «vereda», «chomba»), y la investigación los usaba. Tampoco «dar vuelta» por invertir, que se coló en Image y en el prompt `offer.experto` («darla vuelta», «dé vuelta»): el neutro es «darle la vuelta» o «responder a».
15. **CTA con palabra clave** (LLAMADA, JUNTA, VALORACIÓN): solo si existe la respuesta automática. Si no, el anuncio promete algo que nadie contesta.
16. **Las métricas de las tarjetas de Arcads** («Revenues Generated») no se copian: en un ejemplo ficticio serían cifras inventadas.
17. **La voz.** El video habla con la voz de Flow en el acento del negocio, y la `voz` del preset solo sirve para escuchar el tono. No hay que prometer «con la voz de Andrea» ni «con tu voz»: la voz clonada sigue sin motor (`SIN_MOTOR.voz`).
18. **Licencias que parecían copiables:**
    - `fal-ai-community/skills` dice «MIT» en el README, pero el LICENSE da 404 y la API de licencias de GitHub también.
    - El SKILL.md de Higgsfield en claudskills no tiene licencia.
    - La documentación de HeyGen es propietaria.
    - De las tres, solo los hechos.
    - Los términos de IA generativa de Google no dicen quién es dueño de lo generado: las caras ficticias se usan con el aviso «negocio ficticio», y la propiedad queda sin verificar.
19. **La IA no escribe texto legible.** Pizarras, pantallas, carteles y micrófonos van vacíos o sin marca, y el texto lo pone el editor. El negativo se escribe como lista, sin «no» (guía de Google, verificada).

### Lo que queda sin hacer (con dónde vive)

- **La prueba de la plantilla 5** (podcast, dos personas). Vive en `lib/ai-avatar/plantillas.ts` (`podcast-experto`).
- **Gestos y `queSeVe` por toma.** Viven en `app/video-generator/actions.ts` (`generarPlanAction`) y `lib/video-planner.ts`.
- **Los textos en pantalla automáticos en el Video Editor.** Viven en `app/video-editor/desde/desde.ts`.
- **Los 5 retratos ficticios, los 10 pósters y los 10 loops.** Viven en `public/ai-avatar/plantillas/` y esperan la prueba de punta a punta del motor (`docs/hallazgos-ai-avatar.md`).
- **Sin verificar:**
  - quién es dueño de lo que genera Flow;
  - el texto oficial de Meta sobre la etiqueta «AI info»;
  - si el planificador lee `personas` de la puesta;
  - el efecto de los dígitos medido en Flow.
- **Antes de publicar:** buscar en la web los nombres del elenco, como pide el README (sección 2.2).
