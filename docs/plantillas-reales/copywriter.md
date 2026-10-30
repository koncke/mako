# Copywriter: plantillas reales y su agente experto (plan, 29/10/2026)

> Parte de [Plantillas reales en Create](README.md). La regla común, el elenco, el patrón del agente experto, la tabla única de licencias y el orden de implementación viven en el README; este archivo es la parte de Copywriter, entera, con sus ejemplos completos.

**Qué es:** el plan para que «Nueva página» del Copywriter muestre 12 plantillas **llenas** (un ejemplo completo de un negocio ficticio) y para que MaKo, con un método de director de respuesta directa, las adapte al negocio de quien las abre.
**Medido contra:** `origin/main` `1cf06eba9` (29/10/2026, 13:55), leído con `git -C C:/dev/wt-push-q show origin/main:<ruta>`. No se tocó ese árbol.
**De dónde sale:** la investigación completa del 29/10 (`aae4c813b8a3a4a96.json`), la del patrón de agente (`a13fe8c023075188f.json`), la regla común y el elenco del [README](README.md) (sección 2) y el código de la tab. Las licencias se releyeron hoy en `raw.githubusercontent.com`.

**Lo que cambia respecto del borrador anterior** (que se escribió con la investigación cortada y sin mirar bien el código):
- El editor guarda JSON de ProseMirror y dibuja con **BlockNote 0.56** (`app/copywriter/editor/esquema.tsx`). Hoy MaKo **no puede escribir tablas** (`TIPOS_BLOQUE_IA` no tiene `tabla`): al «adaptar» el Reel, las Stories o el Carrusel, la tabla se perdería. Va en la tanda.
- Las plantillas existentes tienen **secciones fijadas por test** (`tests/copywriter-plantillas.test.ts`): Reel = GANCHO · HISTORIA · MORALEJA · CTA · CAPTION; Copy = TEXTO PRINCIPAL · TITULO · BOTON · LINK; Email = ASUNTO · VISTA PREVIA · CUERPO · BOTON. Los ejemplos nuevos se escriben **dentro** de esas secciones; no hacen falta las estructuras `story-venta` ni `banco-ganchos` que proponía el borrador.
- La estructura de YouTube sigue sin existir (`docs/diseno-copywriter.md`, D6: «no se inventa: falta la fuente»). Ahora la fuente está (claude-youtube, MIT): se agrega `youtube-retencion`.
- La API de MaKo también crea páginas desde plantillas (`lib/api-mako/areas/copywriter.run.ts`). Si `contenido()` pasa a ser el ejemplo, un agente externo crearía páginas con los datos de Cierre Consultivo. La API usa el **esqueleto**.

---

## 1. Cómo lo hacen los mejores, y qué copiamos de esa forma de mostrar

| Quién | Cómo muestra una plantilla | Qué tomamos |
|---|---|---|
| Notion, galería de plantillas (https://www.notion.com/templates/category/marketing) | Cada tarjeta trae una vista previa. «View template» abre la página **ya llena** con contenido de muestra y «Duplicate» la copia a tu espacio. | **El modelo:** la tarjeta abre la página llena y editable. |
| Canva (https://www.canva.com/templates/) | La miniatura **es** la pieza terminada, con textos y precios de muestra. WebFetch devolvió 403: se sabe del producto, no se verificó en esta corrida. | La miniatura muestra contenido real, no un marco vacío. |
| Swiped (https://swiped.co/) | Piezas reales anotadas («Swipe Studies»), ordenadas por nicho y por tipo, con la explicación de por qué funciona cada parte. | La línea de «cuándo usarla» y el destacado de arriba (para quién es y cómo se mide). **Los anuncios no**: tienen el copyright de cada anunciante. |
| marketingskills, `skills/ad-creative/references/static-ad-templates.md` y los `evals/evals.json` (https://github.com/coreyhaines31/marketingskills) | Cada plantilla trae su estructura, un ejemplo completo y de dónde sacar el texto. Cada skill tiene un pedido de prueba con la salida esperada. | Un ejemplo completo por plantilla y **un test por ejemplo** (que pase el saneo, sin voseo, sin nombres reales). |
| claude-youtube, `sub-skills/script.md` (https://github.com/agricidaniel/claude-youtube) | El guion lleva tiempos, acotaciones de producción ([B-ROLL], [GRAPHIC]), un registro de interrupciones y un mapa de los tramos donde la gente se va. | La estructura `youtube-retencion` y los anexos del ejemplo de YouTube. |
| Jasper (https://www.jasper.ai/templates) y Copy.ai (https://www.copy.ai/tools) | Tarjeta con ícono, nombre y una línea. **Ningún ejemplo del resultado.** | Nada. Es el mismo rectángulo con nombre que Martín rechazó. |
| Foreplay (https://www.foreplay.co/adlibrary/formats) | Tableros de anuncios reales de la Biblioteca de Meta. Es pago y no da derechos. | Nada. |

**Cómo se ve en MaKo** (la tarjeta de `NuevaCrear`, `app/_crear/PantallaCrear.tsx`): la miniatura 4:3 dibuja **una hoja** en lugar del marco gris:
- arriba, en chico: el emoji y la insignia («📣 Anuncio · 45 s»);
- en el medio: las primeras líneas reales del gancho, con la letra del documento y hasta 4 renglones;
- abajo: los chips de las secciones («Gancho · Problema · Agitación · +2»);
- debajo de la miniatura, el nombre, como hoy (sin bajada: tanda 6 del Web Generator);
- al pasar el mouse: «Usar plantilla», como hoy, y la línea de «cuándo usarla» como `title`.

El extracto y los chips **salen del mismo ejemplo** (`extractoDe`, `chipsDe`): nunca se desfasan. No hacen falta imágenes ni APIs de fotos.

---

## 2. Las plantillas (12, más «Página en blanco»)

### 2.0 Qué tienen todas

- **El elenco** (README, sección 2.2, con los datos que Offer corrigió para que cumplan el marco): Cierre Consultivo (Andrea Salcedo, CDMX, mentoría de ventas para coaches: 90 días, que son 8 semanas en vivo y 5 de práctica revisada, USD 1,500 de contado o 2 pagos de USD 800; el anuncio vende un diagnóstico gratis de 30 minutos, y la revisión de 3 llamadas cuesta USD 150), Consulta Rentable (Dra. Mariana Ochoa, Guadalajara, programa para nutriólogas: 90 días, USD 1,200 de contado o 2 pagos de USD 650; enseña a vender un plan de 3 meses), Pulso Dental (Diego Ferrer, Bogotá, agencia para clínicas dentales, USD 1,200 al mes con contrato de 3 meses; 31 clínicas atendidas desde 2022 en Colombia y México), Torre Alameda (Querétaro, preventa desde MXN 2,400,000; la desarrolladora no lleva nombre) y Voz de Líder (Rodrigo Ibarra, Lima, oratoria para gerentes: 90 días, USD 2,000 de contado o 2 pagos de USD 1,050). Los clientes de los casos también son inventados: Dr. Felipe Cárdenas (Clínica Dental Altamira, Medellín), Lucía (nutrióloga de Monterrey), Carla y el gerente sin nombre de Voz de Líder.
  - Todas las cifras de los ejemplos que repite otra tab están en la tabla del elenco (README, 2.2).
  - Búsqueda web de hoy: ninguno de los cinco aparece como marca. «Desarrolladora Altavista» sí coincidía con una constructora de Querétaro y se quitó. «Cierre consultivo» es un término genérico de ventas; existe un libro, «La voz del líder», con un nombre parecido. «Clínica Dental Altamira» no aparece en Medellín. El borrador nombraba «Sonríe Studio»: se quitó, y el caso queda como «una clínica de Puebla», así hay un nombre menos que verificar.
- **El reparto:** Cierre Consultivo, 2 plantillas; Pulso Dental, 3; Consulta Rentable, 3; Torre Alameda, 2; Voz de Líder, 2.
- **Arriba de cada ejemplo**, un destacado 🧪 con tres datos: que el negocio es ficticio, para qué sirve la pieza y cómo se mide. Es el único bloque sin sección: no se lee al grabar.
- **Ningún dato del ejemplo queda pendiente** (no hay `[DATO: …]`): el ejemplo es completo. `[DATO: …]` aparece solo en la versión adaptada.
- **El formato de los ejemplos en el código** (se escriben como texto y los convierte `docDeEjemplo`, ver 5.2):
  - una línea con solo la ETIQUETA (mayúscula, sin tildes) abre la sección;
  - `- ` es una viñeta, `1. ` una numerada y `> ` una cita;
  - `!🧪 texto` es un destacado con ese emoji;
  - `| a | b |` es una fila de tabla (la primera fila es el encabezado);
  - `**Dice:**` va en negrita.
  - Los bloques de abajo están en ese formato, listos para `lib/copywriter/plantillas-ejemplos.ts`.

| # | id | Nombre en la tarjeta | Grupo | Tipo y estructura | Negocio |
|---|---|---|---|---|---|
| 1 | `guion-anuncio` | Anuncio a cámara (PAS) | Anuncios | `ad` · `pas` | Cierre Consultivo |
| 2 | `testimonio` (nueva) | Testimonio de cliente | Anuncios | `ad` · `gancho-historia-cta` | Pulso Dental |
| 3 | `copy-anuncio` | Copy de anuncio: 3 ángulos | Anuncios | `ad` · sin estructura | Consulta Rentable |
| 4 | `banco-ganchos` (nueva) | 10 ganchos para un anuncio | Anuncios | `ad` · sin estructura | Torre Alameda |
| 5 | `reel` | Reel que trae mensajes | Redes sociales | `reel` · `reel-viral` | Cierre Consultivo |
| 6 | `stories` | Stories que venden | Redes sociales | `story` · `story-dia` | Voz de Líder |
| 7 | `carrusel` | Carrusel que se guarda | Redes sociales | `post` · sin estructura | Torre Alameda |
| 8 | `email` | Email de cierre | Email | `email` · sin estructura | Voz de Líder |
| 9 | `secuencia-nutricion` (nueva) | 5 emails tras una descarga | Email | `email` · sin estructura | Consulta Rentable |
| 10 | `vsl-respuesta-directa` | VSL para agendar | VSL | `vsl` · `vsl-respuesta-directa` | Pulso Dental |
| 11 | `vsl-clase-educativa` | Clase gratuita: 3 claves | VSL | `vsl` · `vsl-clase-educativa` | Consulta Rentable |
| 12 | `youtube` | YouTube de 12 minutos | Video largo | `youtube` · `youtube-retencion` (nueva) | Pulso Dental |
| — | `blanco` | Página en blanco | Básicos | `pagina` | — |

**Salen de la galería** las tarjetas de `vsl-anti-solucion`, `vsl-diagnostico` y `vsl-historia-fundador`: hoy son tres rectángulos con nombre y sin ejemplo. **No se borran:**
- las tres estructuras siguen en el selector «Estructura» de toda página VSL, y MaKo las escribe con su guía;
- sus ids siguen resolviendo en `plantillaPorId` (con `visible: false` y el esqueleto), así la API no rompe a quien ya los usa.

Ejemplos para esas tres quedan en «Sin hacer».

---

### 2.1 Anuncio a cámara (PAS) · `guion-anuncio`

- **Cuándo** (la `descripcion`, que se ve en el teléfono y en el `title`): «Para tráfico frío: nombra el problema y vende una llamada.»
- **Estructura:** `pas`, con sus etiquetas GANCHO · PROBLEMA · AGITACION · SOLUCION · CTA, más TEXTO DEL ANUNCIO (los tres campos del Media Buyer). Cada sección marca lo que se ve, lo que se dice y el texto en pantalla.
- **Duración:** 45 s.
- **Miniatura:** «📣 Anuncio · 45 s» / «Si esta semana tres personas te dijeron "lo voy a pensar", el problema no es tu precio.» / Gancho · Problema · Agitación · +3.
- **Pide** (lo que MaKo pregunta si el negocio no lo tiene): oferta y precio, a quién le habla y con qué frase, la acción, quién sale en cámara.

```text
!🧪 Ejemplo ficticio: Cierre Consultivo, mentoría de ventas para coaches. Video 9:16 de 45 s para tráfico frío. Gana el que agenda llamadas más baratas.
GANCHO
(0-3 s)
- **Se ve:** Andrea a cámara, plano medio, levanta tres dedos.
- **Dice:** «Si esta semana tres personas te dijeron "lo voy a pensar", el problema no es tu precio.»
- **Texto en pantalla:** «3 "lo voy a pensar" esta semana»
PROBLEMA
(3-10 s)
- **Se ve:** un chat de WhatsApp en visto desde ayer.
- **Dice:** «Haces la llamada, explicas tu programa con todo detalle, la persona te dice que le encanta… y cierra con "déjame consultarlo y te escribo". Nunca te escribe.»
AGITACION
(10-25 s)
- **Se ve:** Andrea anota la cuenta en una libreta.
- **Dice:** «Haz la cuenta: si tu programa vale mil dólares y se te escapan dos llamadas por semana, son ocho mil dólares al mes que se quedan en un chat. Y lo que sigue es peor: bajas el precio, regalas sesiones y empiezas a dudar de tu oferta.»
- **Texto en pantalla:** «2 llamadas por semana = USD 8,000 al mes»
SOLUCION
(25-38 s)
- **Se ve:** Andrea escribe del 1 al 6 en una pizarra.
- **Dice:** «En una llamada que cierra, la persona habla más que tú y llega sola a la conclusión de que necesita ayuda. Para eso hay seis preguntas, siempre en el mismo orden. Es lo que entreno en Cierre Consultivo con coaches que venden programas de más de 800 dólares.»
CTA
(38-45 s)
- **Dice:** «Toca "Más información", responde cuatro preguntas y agenda 30 minutos conmigo. Si todavía no haces llamadas de venta, este programa no es para ti.»
- **Texto en pantalla:** «Agenda tu diagnóstico»
TEXTO DEL ANUNCIO
- **Texto principal:** «Si tus llamadas de venta terminan en "lo voy a pensar", agenda un diagnóstico gratis de 30 minutos. Me cuentas cómo llevas la llamada y te digo en qué pregunta se te escapa la venta.»
- **Título:** «Deja de escuchar "lo voy a pensar"»
- **Botón:** Más información
```

### 2.2 Testimonio de cliente · `testimonio`

- **Cuándo:** «Un cliente cuenta su antes y después, grabado con su celular.»
- **Estructura:** `gancho-historia-cta`. En HISTORIA va el antes creíble, lo que cambió (una sola razón) y el después con un número que se pueda comprobar.
- **Duración:** 40 s.
- **Miniatura:** «📣 Testimonio · 40 s» / «Le pagué a tres agencias en dos años y ninguna me trajo un solo paciente de implantes.» / Gancho · Historia · CTA.
- **Pide:** un caso real con número y con permiso, la acción, a quién le habla.

```text
!🧪 Ejemplo ficticio: Pulso Dental, agencia de pacientes para clínicas dentales. Habla un cliente, grabado con su celular. Video 9:16 de 40 s.
!✍️ Solo con la autorización firmada del cliente. Un corte cada 3 o 4 s y subtítulos de 3 a 5 palabras.
GANCHO
(0-4 s)
- **Se ve:** el Dr. Felipe Cárdenas se baja el tapabocas en su consultorio.
- **Dice:** «Le pagué a tres agencias en dos años y ninguna me trajo un solo paciente de implantes.»
- **Texto en pantalla:** «3 agencias, 0 pacientes de implantes»
HISTORIA
(4-32 s)
- **Antes:** «Me traían seguidores y mensajes de "¿precio?" que nunca volvían. Yo no necesitaba más limpiezas: necesitaba valoraciones de implantes y de ortodoncia.»
- **Se ve:** la recepcionista contesta el teléfono, cansada.
- **Lo que cambió:** «Con Pulso Dental lo primero que cambió fue lo que pasa después del anuncio. Cada mensaje se responde en menos de cinco minutos, con un guion, y el paciente llega a la valoración sabiendo el rango de precio.»
- **Después:** «Al tercer mes tuvimos 23 valoraciones de implantes y cerramos 9. Y mi recepcionista ya no se pasa la tarde contestando "¿precio?".»
- **Texto en pantalla:** «Mes 3: 23 valoraciones, 9 tratamientos»
CTA
(32-40 s)
- **Dice:** «Si tienes una clínica, pídeles la auditoría gratis de tus anuncios. Te dicen en qué parte se te están perdiendo los pacientes.»
- **Texto en pantalla:** «Auditoría gratis para clínicas»
- **En el texto del anuncio:** «Resultados de una clínica en particular. Dependen de la ciudad, la oferta y la inversión.»
```

### 2.3 Copy de anuncio: 3 ángulos · `copy-anuncio`

- **Cuándo:** «Tres textos con ángulos distintos para probar en una campaña.»
- **Estructura:** las cuatro secciones de hoy (TEXTO PRINCIPAL · TITULO · BOTON · LINK, las del Media Buyer). Cada una trae las variantes A, B y C. La DESCRIPCION no se suma: rompería el 1 a 1 con el Media Buyer.
- **Miniatura:** «🪧 Meta · 3 versiones» / «Tu consulta no se llena con más recetas en Instagram.» / Texto principal · Título · Botón · Link.
- **Pide:** oferta, la acción (a qué lleva), un caso real para la variante B.
- **El link** es `example.com`, un dominio reservado para ejemplos (RFC 2606). Un dominio inventado, como «consultarentable.com», puede existir.

```text
!🧪 Ejemplo ficticio: Consulta Rentable, programa de 90 días para nutriólogas (USD 1,200). Tres ángulos en la misma campaña. Gana el registro más barato a la clase gratuita.
!✅ Ninguna variante habla del cuerpo, la salud ni el dinero de quien lee (política de atributos personales de Meta), y la B no dice cuánto cobra ni cuánto gana Lucía: en el anuncio no van resultados de ingresos.
TEXTO PRINCIPAL
- **A · Dolor:** «Tu consulta no se llena con más recetas en Instagram. Las nutriólogas con agenda llena publican igual que tú, pero tienen un camino claro desde que alguien las conoce hasta que paga su primera consulta. En Consulta Rentable armamos ese camino contigo en 90 días. Mira la clase gratuita de 42 minutos y decide si es para ti.»
- **B · Prueba social:** «Lucía atendía 6 pacientes al mes en Monterrey. En la semana 9 del programa atendía 21. Cambió a quién le habla, qué ofrece primero y cómo responde los mensajes. Te lo explico paso a paso en una clase gratuita de 42 minutos. Resultado de una alumna; no es una promesa.»
- **C · Contrarian:** «Publicar recetas no te trae pacientes. Te trae seguidores que cocinan. El contenido que llena una consulta contesta una pregunta: ¿por qué contigo y por qué ahora? En la clase te muestro los tres tipos de publicación que terminan en una cita.»
TITULO
- **A:** «Llena tu consulta online»
- **B:** «Cómo Lucía llenó su consulta»
- **C:** «Menos recetas, más citas»
BOTON
- **A y C:** Más información
- **B:** Registrarte
LINK
- https://example.com/clase-gratuita
- El caso de la variante B se publica solo con la autorización de Lucía y con su resultado real.
```

### 2.4 10 ganchos para un anuncio · `banco-ganchos`

- **Cuándo:** «Diez aperturas para el mismo anuncio: gana la que frena el scroll.»
- **Estructura:** sin estructura de la biblioteca. Las secciones son GANCHOS (una tabla Tipo · Se ve · Se dice · Texto en pantalla), CUERPO y CTA. Se graban los diez con el mismo cuerpo.
- **Miniatura:** «📣 Anuncio · 10 aperturas» / «¿Rentar tres años más o dar el enganche este año?» / Ganchos · Cuerpo · CTA.
- **Pide:** oferta y precio, los segmentos a los que le habla, una prueba, la acción.

```text
!🧪 Ejemplo ficticio: Torre Alameda, preventa en Querétaro. Diez aperturas para el mismo cuerpo. Gana la de mejor retención a 3 s y contacto más barato.
!🎯 Lo que se ve, lo que se dice y el texto en pantalla no repiten la misma frase. Se cambia una cosa por prueba.
GANCHOS
| Tipo | Se ve (0-3 s) | Se dice | Texto en pantalla |
| Pregunta | Una pareja revisa planos en la mesa del comedor. | «¿Rentar tres años más o dar el enganche este año?» | «La cuenta que nadie te hace» |
| Dato de precio | La obra con la grúa, desde un dron. | «Este departamento cuesta 2.4 millones en la etapa 2. En la etapa 3 sube a 2 millones 520 mil.» | «Precio de preventa, etapa 2» |
| Confesión | La asesora a cámara, en la sala del departamento muestra. | «Te voy a decir lo que casi ningún asesor te dice de una preventa.» | «Lo que no te cuentan» |
| Punto de vista | Un cuarto chico lleno de juguetes. | «Cuando el segundo hijo ya no cabe en tu departamento de una recámara…» | «Necesitas otra recámara» |
| Antes y después | El terreno en 2025 y la torre en obra negra hoy. | «Así estaba hace un año. Así va hoy.» | «Avance de obra: 60 %» |
| Cuenta regresiva | El tablero de ventas con departamentos marcados. | «Quedan 14 departamentos con vista al parque.» | «14 con vista al parque» |
| Prueba primero | La entrega de llaves de la etapa 1. | «La etapa 1 se entregó a tiempo. Esta es la etapa 2.» | «Entregamos en la fecha» |
| Objeción | La asesora con una calculadora. | «¿Cuánto pagas al mes mientras se construye? Te lo muestro.» | «Apartas con $20,000 y 18 meses de $12,222» |
| Contraste | Pantalla dividida: un recibo de renta y la corrida de un crédito. | «Si pagas unos 19 mil de renta, es lo que costaría al mes el crédito de este departamento.» | «Renta o crédito» |
| Curiosidad | Una mano abre la puerta del roof garden. | «Lo mejor de este edificio no está adentro del departamento.» | «Sube con nosotros» |
CUERPO
(15-25 s, el mismo después de cualquier gancho)
- **Se ve:** recorrido por el departamento muestra: sala, cocina, recámara y vista al parque.
- **Dice:** «Torre Alameda está a 8 minutos de avenida Constituyentes. Departamentos de 2 recámaras y 2 baños, de 78 m², con alberca, gimnasio y roof garden. Desde 2.4 millones, con el enganche del 10 % en 18 meses y entrega en diciembre de 2027.»
CTA
- **Dice:** «Deja tus datos y una asesora te manda hoy mismo por WhatsApp la lista de precios.»
- **Texto en pantalla:** «Lista de precios por WhatsApp»
```

(Las cuentas son las del elenco: el 10 % de 2.4 millones son 240,000 pesos; menos el apartado de 20,000, quedan 220,000 en 18 mensualidades de 12,222. El crédito estimado es de 18,900 al mes, a 20 años y con una tasa fija de referencia del 8.6 %. La renta típica de la zona es de 14,000, así que el gancho de contraste es condicional: «el mismo pago» sería falso para casi todos. La etapa 3 cuesta 2,520,000.)

### 2.5 Reel que trae mensajes · `reel`

- **Cuándo:** «Enseña algo útil y termina en una conversación por mensaje.»
- **Estructura:** la de hoy, `reel-viral`, con la forma de la tab Reels: GANCHO con frase, título y visual; HISTORIA en una tabla Escena · Locución · Cámara; MORALEJA; CTA con palabra clave; CAPTION. La guía de `reel-viral` pide un gancho de 5 a 9 palabras con el tema adelante y entre 50 y 60 s: el ejemplo lo cumple.
- **Duración:** 52 s.
- **Miniatura:** «🎬 Reel · 52 s» / «Estas tres frases por WhatsApp te cuestan la venta.» / Gancho · Historia · Moraleja · +2.
- **Pide:** el tema que enseña, la palabra clave y si existe la automatización que la contesta.

```text
!🧪 Ejemplo ficticio: Cierre Consultivo, mentoría de ventas para coaches. Reel 9:16 de 52 s. Se mide en comentarios con la palabra GUIA.
!⚠️ La palabra GUIA solo va si tienes la automatización que manda la guía por mensaje.
GANCHO
- **Frase hablada:** «Estas tres frases por WhatsApp te cuestan la venta.»
- **Título en pantalla:** «3 frases que matan tu venta»
- **Visual:** Andrea tacha una frase en una pizarra blanca.
HISTORIA
| Escena | Locución | Cámara |
| 1 | «Uno: "¿te mando la info?". Le acabas de dar permiso para ignorarte. Mejor pregunta: "¿qué te llevó a escribirme hoy?".» | Plano medio. En pantalla: «1. "¿Te mando la info?"». Un corte cada 2 o 3 s. |
| 2 | «Dos: "es una inversión", dicho antes de que te cuente su problema. Todavía no sabe en qué invierte. Primero el problema, después el precio.» | Cambio de ángulo. En pantalla: «2. "Es una inversión"». |
| 3 | «Tres: "cualquier duda me dices". Con esa frase la conversación la terminas tú. Cierra con una fecha: "¿te queda mejor el martes o el jueves para hablarlo 20 minutos?".» | Primer plano. En pantalla: «3. "Cualquier duda me dices"». |
MORALEJA
La mayoría de las ventas se pierden en el chat, antes de la llamada.
CTA
Tengo las seis preguntas que uso para pasar de un chat a una llamada. Comenta GUIA y te las mando por mensaje.
- **Palabra clave:** GUIA
CAPTION
!✂️ Los primeros 125 caracteres se ven sin tocar «más».
La mayoría de las ventas se pierden en el chat, antes de la llamada. Guárdalo para tu próximo "¿precio?". Comenta GUIA y te mando las 6 preguntas.
```

(El destacado ✂️ es el de hoy: `CAPTION_VISIBLE` de `lib/ig-formatos.ts`, armado en código, no escrito a mano.)

### 2.6 Stories que venden · `stories`

- **Cuándo:** «Siete stories de una sola idea que terminan en un mensaje directo.»
- **Estructura:** la de hoy, `story-dia`, con GANCHO, CONTEXTO (una tabla Frame · Tipo · Texto · Indicación), MORALEJA y CTA. Son 7 stories: 1 de gancho, 4 de contexto, 1 de moraleja y 1 de CTA con la oferta.
- **Miniatura:** «📱 Stories · 7» / «Ayer un gerente me dijo algo que escucho cada semana 👇» / Gancho · Contexto · Moraleja · CTA.
- **Pide:** oferta, cupo y fecha reales, una prueba con permiso, la palabra clave.

```text
!💡 Una sola idea en todo el día.
!🧪 Ejemplo ficticio: Voz de Líder, programa de oratoria para gerentes (cohorte de 12 personas, USD 2,000). Se mide en mensajes con la palabra JUNTA.
GANCHO
Frame 1 · Video selfie caminando. Texto: «Ayer un gerente me dijo algo que escucho cada semana 👇»
CONTEXTO
| Frame | Tipo | Texto | Indicación |
| 2 | Texto sobre fondo negro | «"Sé exactamente qué decir… hasta que me toca presentar frente al directorio."» | Letra grande, sin foto. |
| 3 | Encuesta | «¿Te pasa?» Opciones: «Siempre» y «Solo con gente importante». | El sticker se pone a mano. |
| 4 | Video a cámara, 15 s | «Preparas todo lo que vas a decir, menos los primeros 20 segundos. Si esos 20 segundos están ensayados, lo demás sale solo.» | Subtítulos. Mirada a cámara. |
| 5 | Captura de chat | «Presenté el presupuesto anual y por primera vez nadie me interrumpió.» Carla, gerente de operaciones. | Con su permiso. Tapar el número. |
MORALEJA
Frame 6 · Texto sobre fondo liso: «Hablar frente a la dirección se entrena, como cualquier otra parte de tu trabajo.»
CTA
Frame 7 · Texto sobre una foto del grupo: «Voz de Líder, cohorte de mayo: 90 días, 12 personas, martes en vivo. Quedan 4 lugares. Escríbeme JUNTA y te cuento si es para ti. Cierro el viernes.»
- **Palabra clave:** JUNTA
- Los 4 lugares van solo si son reales.
```

### 2.7 Carrusel que se guarda · `carrusel`

- **Cuándo:** «Una lista útil que la gente guarda y que termina en un mensaje.»
- **Estructura:** la de hoy: SLIDES (una tabla Slide · Texto en la imagen · Visual), CTA con palabra clave y CAPTION. Son 10 diapositivas de 4:5 con 25 palabras como máximo cada una.
- **Miniatura:** «📝 Carrusel · 10» / «7 preguntas antes de comprar en preventa» / Slides · CTA · Caption.
- **Pide:** el tema, la palabra clave y lo que se manda cuando alguien la escribe.

```text
!🧪 Ejemplo ficticio: Torre Alameda, preventa en Querétaro. Diez diapositivas 4:5 (1080 × 1350). Se mide en guardados y mensajes con PRECIOS.
SLIDES
| Slide | Texto en la imagen | Visual |
| 1 · Portada | «7 preguntas antes de comprar en preventa» · «La 5 casi nadie la hace» | Foto de la obra al atardecer, texto arriba. |
| 2 | «Comprar en preventa suele costar menos que comprar terminado. También puede salir caro. Estas 7 preguntas marcan la diferencia.» | Fondo liso, letra grande. |
| 3 | «1. ¿El terreno es de la desarrolladora? Pide la escritura o el contrato de fideicomiso.» | Ícono de documento. |
| 4 | «2. ¿Tiene licencia de construcción vigente? Pide el número y verifícalo en el municipio.» | Ícono de sello. |
| 5 | «3. ¿Qué entregó antes esa desarrolladora? Visita un proyecto terminado y pregunta a los vecinos.» | Foto de un edificio entregado. |
| 6 | «4. ¿Qué pasa si se retrasa la obra? Busca en el contrato la penalización por retraso.» | Ícono de calendario. |
| 7 | «5. ¿A dónde va tu enganche? Pregunta si entra a un fideicomiso de la obra o a la cuenta de la empresa.» | Resaltada: es la que casi nadie hace. |
| 8 | «6. ¿Qué incluye el precio? Estacionamiento, bodega, acabados y gastos de escrituración.» | Lista con palomitas. |
| 9 | «7. ¿Cuánto pagas al mes y hasta cuándo? Pide la corrida financiera por escrito.» | Una tabla de pagos sencilla. |
| 10 · CTA | «En Torre Alameda te damos las 7 respuestas por escrito antes de que firmes.» | Foto del departamento muestra, logo chico abajo. |
CTA
Escríbenos PRECIOS por mensaje y te mandamos la lista de precios y la corrida financiera.
- **Palabra clave:** PRECIOS
CAPTION
!✂️ Los primeros 125 caracteres se ven sin tocar «más».
Guárdalo para tu próxima visita a una preventa. ¿Cuál de las 7 no habías preguntado? Te leo en comentarios.
```

(La columna «Visual» la diseña la tab Image. El Copywriter no lleva imágenes.)

### 2.8 Email de cierre · `email`

- **Cuándo:** «Vende una cohorte con fecha de cierre real.»
- **Estructura:** la de hoy (ASUNTO · VISTA PREVIA · CUERPO · BOTON). El cuerpo sigue este orden: escena, lo que falta, mecanismo, qué incluye, precio, garantía, escasez real, firma y P. D. Entre 250 y 450 palabras, pensado para leerse en el celular.
- **Miniatura:** «✉️ Email» / «Cierro el viernes (y por qué solo 12 lugares)» / Asunto · Vista previa · Cuerpo · Botón.
- **Pide:** oferta y precio, qué incluye, garantía, cupo y fecha reales, la acción.
- **La variable** es `{nombre}`, con una sola llave (la sintaxis de Email Marketing, `lib/template-vars.ts`). Con dos llaves, el ejemplo pasaría por `renderPrompt` como un slot.

```text
!🧪 Ejemplo ficticio: Voz de Líder, programa de oratoria para gerentes. Email de cierre de inscripciones. Se mide en llamadas de admisión agendadas.
ASUNTO
Cierro el viernes (y por qué solo 12 lugares)
VISTA PREVIA
Te cuento por qué no abro más.
CUERPO
Hola, {nombre}:
La semana pasada un gerente me contó cómo le fue en su última junta con el director general. Llevaba la presentación escrita palabra por palabra. En la diapositiva dos, el director lo interrumpió con una pregunta y no pudo retomar. Los 20 minutos que siguieron los pasó leyendo.
Tenía los datos y tenía la experiencia. Lo que nunca había ensayado era lo que casi nadie ensaya: los primeros 20 segundos y las tres preguntas difíciles que le iban a hacer.
En Voz de Líder preparamos esas dos cosas, la apertura y las respuestas, y las practicas frente a once colegas hasta que te salen solas.
Qué incluye la cohorte de mayo:
- 90 días: 10 semanas con una sesión en vivo cada martes a las 7 p. m. (hora de Lima) y 3 de práctica con tu presentación real
- 3 simulacros grabados con preguntas difíciles y la revisión de tu presentación real
- La guía para preparar los primeros 20 segundos y las 3 preguntas difíciles
- Práctica en grupo: presentas frente a 11 colegas cada semana
Inversión: USD 2,000 de contado, o 2 pagos de USD 1,050 (hoy y a 30 días).
Garantía: si vas a 8 de las 10 sesiones, haces los 3 simulacros y en el tercero todavía no sostienes 10 minutos sin leer, te acompaño uno a uno, sin costo, hasta tu presentación real.
Abrimos 12 lugares porque escucho cada presentación. Quedan 4. Las inscripciones cierran el viernes a las 11:59 p. m. (hora de Lima).
Rodrigo
P. D. Si no sabes si es para ti, responde este correo con una línea: cuándo es tu próxima presentación importante. Te contesto yo.
BOTON
Agenda tu llamada de admisión
```

### 2.9 5 emails tras una descarga · `secuencia-nutricion`

- **Cuándo:** «Lleva a quien descargó tu guía hasta agendar, en 10 días.»
- **Estructura:** cinco secciones, de EMAIL 1 a EMAIL 5 (`esEtiqueta` acepta «EMAIL 1»). Cada una trae día, asunto, vista previa, cuerpo y botón.
  - El orden: entrega con una acción, una idea que cambia la creencia, la historia de la fundadora, el caso de una clienta, y la oferta con la objeción principal.
  - Es la secuencia de nutrición previa a la venta de marketingskills (8 correos en 21 días), comprimida a 5 en 10 días y escrita con texto propio.
- **Miniatura:** «✉️ Email · 5 en 10 días» / «Tu guía (y el mensaje que más citas trae)» / Email 1 · Email 2 · Email 3 · +2.
- **Pide:** el recurso que se descargó, la historia de quien vende, un caso real, la oferta con su fecha y la objeción más común.
- **La programación** (los días y la salida de quien agenda) vive en Email Marketing y en Automations. Esta página es el texto.

```text
!🧪 Ejemplo ficticio: Consulta Rentable, programa para nutriólogas. Se dispara con la descarga de la guía «5 mensajes para convertir seguidores en pacientes».
!🎯 Un objetivo y un solo enlace por correo. Quien agenda o compra sale de la secuencia.
EMAIL 1
- **Día:** 0 · **Para qué:** entregar la guía y pedir una acción hoy
- **Asunto:** Tu guía (y el mensaje que más citas trae)
- **Vista previa:** Empieza por el mensaje 3.
Hola, {nombre}. Aquí está tu guía. Si esta semana vas a usar uno solo de los 5 mensajes, que sea el 3, el que mandas cuando alguien pregunta el precio. Úsalo hoy con la próxima persona que te escriba y respóndeme cómo te fue. Mariana
- **Botón:** Descargar la guía
EMAIL 2
- **Día:** 2 · **Para qué:** cambiar una creencia
- **Asunto:** El paso que les falta a las agendas vacías
- **Vista previa:** Está entre «me interesa» y «agendé».
La mayoría de las nutriólogas que me escriben creen que necesitan más seguidores. Cuando revisamos sus números, casi siempre tienen gente interesada que nunca llegó a agendar. Entre «me interesa» y «agendé» hay un paso que nadie diseña: qué le dices a alguien que todavía no está lista para pagar. En dos días te cuento cómo lo descubrí.
- **Botón:** Leer los 5 mensajes otra vez
EMAIL 3
- **Día:** 4 · **Para qué:** la historia de la fundadora
- **Asunto:** El mes que tuve 3 pacientes
- **Vista previa:** Y lo que cambié al mes siguiente.
En marzo de 2022 tuve tres pacientes nuevos, y publicaba todos los días. Empecé a ofrecer una valoración de 20 minutos antes de la consulta completa y a responder cada pregunta de precio con una pregunta sobre su objetivo. En junio tuve 17 pacientes nuevos, publicando lo mismo que antes.
- **Botón:** Ver cómo es la valoración
EMAIL 4
- **Día:** 7 · **Para qué:** el caso de una clienta
- **Asunto:** Cómo Lucía llenó los jueves
- **Vista previa:** Sin publicar más.
Lucía, de Monterrey, tenía los jueves vacíos. En la semana 9 del programa los tenía completos: cambió su oferta de entrada a un plan de 3 meses y empezó a responder los mensajes con el guion de tu guía. Subió su consulta de 600 a 900 pesos y nadie se quejó. Si quieres ver cómo armó su oferta, está en la clase.
- **Botón:** Ver la clase
EMAIL 5
- **Día:** 10 · **Para qué:** la oferta y la objeción principal
- **Asunto:** ¿Y si no tengo tiempo?
- **Vista previa:** La pregunta que más me hacen.
Es la duda más común antes de entrar a Consulta Rentable. El programa pide 3 horas por semana: una sesión en vivo y dos horas para aplicar. Si hoy pasas 5 horas a la semana publicando y tu agenda no se llena, esas horas las recuperas. La próxima generación empieza el 3 de junio, con cupo para 20 nutriólogas. Si quieres saber si es para ti, agenda 20 minutos conmigo.
- **Botón:** Agendar 20 minutos
```

### 2.10 VSL para agendar · `vsl-respuesta-directa`

- **Cuándo:** «El video de la página de agenda, para tráfico frío.»
- **Estructura:** `vsl-respuesta-directa` (LEAD · PROBLEMA · HISTORIA · MECANISMO · PRUEBA · OFERTA · OBJECIONES · CTA). Es la versión de 10 minutos con los bloques en proporción; la de la guía dura 30. Los minutos de cada bloque son los que lee el VSL Analyst.
- **Duración:** 600 s.
- **Miniatura:** «🎥 VSL · 10 min» / «Si tienes una clínica dental y tus anuncios traen mensajes pero no pacientes de implantes, este video es para ti.» / Lead · Problema · Historia · +5.
- **Pide:** oferta y precio, el mecanismo con su nombre, un caso con números, las objeciones de las llamadas, la acción.

```text
!🧪 Ejemplo ficticio: Pulso Dental, sistema de pacientes para clínicas dentales (USD 1,200 al mes, contrato de 3 meses). Versión de 10 minutos para la página de agenda. Se mide en auditorías agendadas.
LEAD
(0:00-1:00)
«Si tienes una clínica dental y tus anuncios traen mensajes pero no pacientes de implantes, este video es para ti. En diez minutos te muestro por qué pasa y el sistema que usamos con las 31 clínicas que atendimos desde 2022 para convertir mensajes en valoraciones pagadas. Si tu clínica solo hace limpiezas y no quiere vender tratamientos grandes, puedes cerrar este video.»
PROBLEMA
(1:00-2:30)
«Esto es lo que vemos en casi todas las clínicas que auditamos. El anuncio funciona: llegan 80 o 100 mensajes al mes. La recepción contesta cuando puede, a veces tres horas después. La mitad pregunta "¿precio?" y desaparece. Y de los que agendan, uno de cada tres no llega. Al final del mes la conclusión es "los anuncios no sirven", y se cambia de agencia. Con la agencia nueva, lo que pasa después del mensaje sigue igual.»
HISTORIA
(2:30-4:00)
«Yo lo aprendí por las malas. En 2021 manejaba los anuncios de seis clínicas y perdí cuatro en un semestre. Los números de los anuncios eran buenos: costo por mensaje bajo y mucha gente escribiendo. Un día me senté una tarde entera en la recepción de una de esas clínicas. Llegaron 14 mensajes y se contestaron 5. Nadie tenía un guion. Ahí entendí que yo vendía mensajes y la clínica necesitaba pacientes.»
MECANISMO
(4:00-6:00)
«Lo que construimos después se llama el Método 5-5-1.
Cinco: todo mensaje se responde en menos de cinco minutos, porque en ese tiempo la persona sigue con el teléfono en la mano.
Cinco: cinco preguntas de filtro antes de dar un precio. Qué tratamiento busca, desde cuándo, si ya tiene una valoración, cuándo quiere empezar y cómo piensa pagarlo.
Uno: un solo llamado a la acción, la valoración, con el rango de precio dicho antes de agendar.
El que agenda sabiendo el precio llega. El que se asusta por el precio se filtra antes de ocupar una silla.»
PRUEBA
(6:00-7:30)
«Clínica Dental Altamira, en Medellín: en el primer mes tuvieron 6 valoraciones de implantes. En el tercero, 23 valoraciones y 9 tratamientos cerrados, con la misma inversión en anuncios. Una clínica de Puebla bajó las inasistencias del 34 % al 12 % en ocho semanas, solo con recordatorios y con el precio dicho antes.»
- **En pantalla:** capturas del panel, con el permiso de cada clínica.
OFERTA
(7:30-8:30)
«Con Pulso Dental instalamos los tres componentes: los anuncios del tratamiento que quieres vender, la respuesta en menos de cinco minutos con los guiones y un reporte semanal de valoraciones y tratamientos cerrados. Trabajamos con contratos de tres meses y tomamos dos clínicas nuevas por mes.»
OBJECIONES
(8:30-9:30)
- «"Ya probé agencias." Cada lunes te mandamos cuántas valoraciones se agendaron y cuántas llegaron.»
- «"Mi recepcionista no da abasto." Por eso los primeros mensajes se contestan solos.»
- «"En mi ciudad es distinto." Por eso empezamos con una auditoría: si tu mercado no da, te lo decimos antes de cobrarte.»
CTA
(9:30-10:00)
«Debajo de este video hay un calendario. Elige un horario para una auditoría de 30 minutos conmigo: revisamos tus anuncios y tus últimos 20 mensajes, y te digo dónde se te van los pacientes. Si después no quieres trabajar con nosotros, te quedas con el diagnóstico.»
```

### 2.11 Clase gratuita: 3 claves · `vsl-clase-educativa`

- **Cuándo:** «Enseñas de verdad y la oferta llega al final, ganada.»
- **Estructura:** `vsl-clase-educativa` (LEAD · PROMESA · QUIEN SOY · CLAVE UNO · CLAVE DOS · CLAVE TRES · TRANSICION · OFERTA · CTA).
- **Una clase de 42 minutos no se escribe palabra por palabra:** se da con diapositivas. El ejemplo es la escaleta completa: lo que se dice textual al abrir y cerrar cada bloque, el contenido de cada clave, el ejercicio y la diapositiva.
- **Duración:** 2,520 s: los minutos de la guía de `vsl-clase-educativa` (`lib/vsl-estructuras.ts`), que termina con el CTA de 39 a 42. Ojo: la misma estructura declara `minutos: 40`, y la guía llega a 42.
- **Miniatura:** «🎓 Clase · 42 min» / «Cómo llenar tu consulta online sin publicar todos los días» / Lead · Promesa · Quién soy · +6.
- **Pide:** las tres claves, la credencial, la oferta con su precio y su forma de pago, el cupo y el bono.

```text
!🧪 Ejemplo ficticio: Consulta Rentable. Clase en vivo de 42 minutos: «Cómo llenar tu consulta online sin publicar todos los días». Se mide en inscripciones durante la clase.
LEAD
(0-2 min · diapositiva: el título y las 3 claves con el nombre tapado)
«Bienvenida. En esta clase te voy a mostrar las tres claves que separan a las nutriólogas con agenda llena de las que publican todos los días y no consiguen pacientes. Si das consulta online, o quieres empezar este año, quédate hasta el final: la tercera clave es la que más mueve los números.»
PROMESA
(2-4 min)
«Aunque nunca trabajes conmigo, te vas a llevar tres cosas: el mensaje que contesta "¿precio?" sin perder a la persona, la oferta de entrada que hace que te agenden y una cuenta para saber cuántos pacientes te faltan este mes.»
QUIEN SOY
(4-7 min · diapositiva: dos números, 3 y 40)
«Soy nutrióloga clínica desde 2016. En 2022 tuve un mes con tres pacientes, publicando a diario. Hoy atiendo 40 pacientes al mes en línea, y desde 2023 acompañé a 140 nutriólogas de México, Colombia y Chile a hacer lo mismo.»
CLAVE UNO
(7-15 min · la oferta de entrada)
- Se vende un primer paso con nombre y resultado, en lugar de «una consulta». Ejemplo: «Plan de 3 meses para dejar el picoteo nocturno».
- La fórmula en pantalla: resultado + tiempo + sin qué sacrificio.
- Ejercicio en vivo: cada una escribe la suya en el chat. Se leen tres en voz alta y se mejoran.
- Cierre del bloque: «Con esto ya tienes qué ofrecer. Ahora, ¿qué pasa entre que alguien te escribe y paga?»
CLAVE DOS
(15-23 min · el paso del medio)
- La creencia que se rompe: «me faltan seguidores».
- Entre «me interesa» y «agendé» va una valoración de 20 minutos.
- Los números de una alumna en pantalla: 60 mensajes, 18 valoraciones, 11 pacientes.
- Cierre del bloque: «Ya tienes la oferta y el paso del medio. Falta el momento donde más pacientes se pierden.»
CLAVE TRES
(23-31 min · el mensaje del precio)
- A «¿precio?» se responde primero con una pregunta sobre su objetivo y después con el precio y lo que incluye.
- Se leen tres conversaciones reales, con permiso: la respuesta de antes y la de después.
- Esta clave se entiende sola y se aplica mejor acompañada: es la que abre la puerta a la oferta.
TRANSICION
(31-34 min)
«Ya tienes las tres claves y puedes aplicarlas sola. Ahora te cuento cómo lo hacemos juntas en Consulta Rentable. Si no te interesa, ya te llevaste lo más importante.»
OFERTA
(34-39 min)
- **Qué es:** 90 días, con 12 sesiones grupales en vivo (una por semana), la revisión de tu oferta y de tus mensajes, plantillas y comunidad.
- **Para quién:** nutriólogas con cédula que ya dan consulta. **Para quién no:** quien busca seguidores.
- **Inversión:** USD 1,200 de contado, o 2 pagos de USD 650 (hoy y a 30 días). Cupo para 20.
- **Bono para quien se inscriba durante la clase:** una revisión uno a uno de su oferta de entrada.
CTA
(39-42 min)
«El enlace está en el chat. Al inscribirte te llega un correo con el acceso y la fecha de tu revisión uno a uno. Mientras se inscriben, respondo preguntas.»
```

### 2.12 YouTube de 12 minutos · `youtube`

- **Cuándo:** «Un video largo que sostiene la atención y trae clientes.»
- **Estructura:** `youtube-retencion` (nueva, ver 5.3): GANCHO · INTRO · BLOQUE UNO · CTA MEDIO · BLOQUE DOS · BLOQUE TRES · REGANCHO · BLOQUE FINAL · CIERRE. Cada bloque abre con una interrupción, entrega valor y cierra con un resumen de una línea y un puente al siguiente. Los reenganches cerca del minuto 3 y del 6 son la primera línea de BLOQUE DOS y de BLOQUE TRES.
- **El brief de la miniatura, el título y los anexos** (registro de interrupciones, tramos de riesgo) van en destacados arriba, fuera de las secciones: no se graban.
- **Duración:** 720 s.
- **Miniatura de la tarjeta:** «▶️ YouTube · 12 min» / «De estos 50 anuncios de clínicas dentales, 43 están quemando dinero.» / Gancho · Intro · Bloque uno · +6.
- **Pide:** el tema, el dato o la prueba que sostiene el título, el recurso del CTA medio y la acción del cierre.

```text
!🧪 Ejemplo ficticio: el canal de Diego Ferrer, fundador de Pulso Dental. Video de 12 minutos. Se mide en clics a la miniatura, retención al minuto 1 y auditorías agendadas.
!🖼️ Título: «Revisé 50 anuncios de clínicas dentales: por qué 43 no traen pacientes». Miniatura (la plantilla 2 de Image): una cuadrícula de 50 anuncios con 43 tachados en rojo, uno señalado con un círculo, y el texto «¿EL TUYO?»; la versión B suma a Diego señalándola. El número vive en la cuadrícula: el texto no repite el título. El primer minuto tiene que mostrar esa cuadrícula.
!📋 14 interrupciones (cambio de cámara, gráfico, B-roll, zoom). Tramos de riesgo: el minuto 1 (si no aparece la cuadrícula, la miniatura parece mentira), el bloque tres (es teoría: va con un ejemplo en pantalla) y el final (no anunciar que termina antes de mostrar al ganador).
GANCHO
(0:00-0:30)
- **Agarre (0:00-0:05):** [Se ve la cuadrícula de la miniatura; los anuncios se tachan uno por uno.] «De estos 50 anuncios de clínicas dentales, 43 están quemando dinero.»
- **Promesa (0:05-0:15):** «En los próximos diez minutos te muestro los cuatro errores que se repiten y cómo se ven los siete que sí llenan la agenda.»
- **Lo que está en juego (0:15-0:30):** «Si tu clínica invierte en anuncios, es muy probable que tengas al menos dos de estos errores, y cada uno te cuesta pacientes de implantes que se van a la clínica de enfrente.»
INTRO
(0:30-1:30)
«Soy Diego. En Pulso Dental atendimos a 31 clínicas de Colombia y México desde 2022. Para este video tomamos 50 anuncios activos de la Biblioteca de anuncios de Meta, de clínicas de cinco ciudades, y los calificamos con los mismos 12 puntos de nuestras auditorías.» [GRAFICO: los 12 puntos, 2 s.] «Empecemos por el error que tienen 38 de los 50.»
BLOQUE UNO
(1:30-3:00 · el anuncio vende la limpieza)
[CAMBIO DE CAMARA] [Un ejemplo anonimizado en pantalla.] «Anuncian lo más barato para atraer gente y después intentan vender implantes. Quien llega por una limpieza de 120 mil pesos colombianos, unos 30 dólares, casi nunca es quien paga un implante de 6 millones de pesos, unos 1,500 dólares.» Qué hacer: anunciar la valoración del tratamiento que quieres vender. «Pero aunque arregles esto, el siguiente error te puede tirar todo abajo.»
CTA MEDIO
(3:00, 15 s)
«Los 12 puntos con los que calificamos estos anuncios están en un checklist gratuito. El enlace está en la descripción: úsalo con tus anuncios mientras ves el video.»
BLOQUE DOS
(3:15-5:00 · responder tarde)
[B-ROLL: Diego en la recepción de una clínica.] «Para el siguiente error les escribimos a las 50 clínicas como si fuéramos pacientes. La respuesta te va a doler.» «Tiempo promedio de respuesta: 3 horas y 40 minutos. Once nunca contestaron.» [GRAFICO: barras con los tiempos.] Qué hacer: responder en menos de 5 minutos con un guion de tres mensajes.
BLOQUE TRES
(5:00-7:30 · la foto de banco y el precio escondido)
[CAMBIO DE CAMARA] «Sonrisas perfectas de banco de imágenes. Nadie cree que esa es tu clínica.» Qué hacer: el doctor a cámara, el consultorio real y un caso con autorización. «Ahora viene lo interesante: los anuncios que funcionan tienen algo en común que no esperábamos.» «Dicen el rango de precio antes de agendar. Parece que espanta gente, y espanta justo a la que nunca iba a pagar.» [Ejemplo en pantalla.]
REGANCHO
(7:30)
«Ya viste lo que hacen mal 43 clínicas. Ahora te muestro, anuncio por anuncio, lo que hacen las 7 que llenan la agenda. Y el que más pacientes trae es el menos producido de todos.»
BLOQUE FINAL
(7:30-11:00 · los 7 que funcionan)
Recorrido por los 7, anonimizados: qué dicen en los primeros 3 segundos, qué ofrecen y cómo responden. [Una interrupción cada 30 a 40 s: zoom, gráfico o cambio de plano.] La recompensa: el ganador es un video de 40 segundos grabado con el celular por el propio doctor.
CIERRE
(11:00-12:00)
«Si quieres que revisemos tus anuncios con estos 12 puntos, agenda una auditoría gratuita en el enlace de la descripción. Y si quieres ver cómo armamos el guion para responder en cinco minutos, ese video está aquí.» [PANTALLA FINAL. Corte en seco, sin despedida.]
```

**Imágenes y clips:** ninguna plantilla del Copywriter los necesita. La columna «Visual» y el brief de la miniatura los ejecutan Image y Video. Si algún día el editor ofrece fotos, aplican los términos que leyó la investigación:
- **Unsplash:** su API exige mostrar la imagen desde su servidor (hotlink) y avisar cada descarga.
- **Pixabay:** prohíbe el hotlink permanente.
- **Pexels:** permite 200 pedidos por hora y pide crédito cuando se pueda.

Para ejemplos fijos, la foto se baja a mano y se sirve desde el storage propio.

---

## 3. El agente experto de la tab

### 3.1 El método

Sale de tres skills MIT, traducidas y adaptadas a high ticket en LATAM: `copywriting` y `ad-creative` de marketingskills (que acreditan a Profound) y `script` de claude-youtube.
- **Contexto primero:** lee el negocio del Second Brain (`contextoDelNegocio`, 1,800 tokens). Lo que no está, no existe.
- **Diagnóstico del insumo, en una línea:** hoja en blanco, borrador con voz propia (se conserva) o cambio puntual (se toca solo eso).
- **Nivel de conciencia del público:** decide el largo y el gancho. El retargeting no repite el problema.
- **Ángulo:** si se piden ideas, 3 ángulos distintos y uno recomendado con su porqué.
- **El gancho en tres capas:**
  - lo que se ve, lo que se dice y el texto en pantalla, sin repetir la misma frase;
  - varios ganchos se arman cruzando segmento × motivación × formato.
- **Escritura por partes:** 2 o 3 versiones de cada parte. Se queda la que pasa tres preguntas: ¿se imagina?, ¿se comprueba?, ¿la firmaría un competidor?
- **Reglas por pieza:** Meta, video corto, YouTube, VSL y clase, email y palabra clave.
- **Sin inventar nada:** lo que falta va como `[DATO: …]`.
- **Una pregunta por vez, sobre un hecho:** como máximo tres antes de escribir.
- **Al terminar:** un solo próximo paso.

Los «3 ganchos, 2 CTA y la métrica» del borrador anterior no se escriben en la página: el teleprompter y el copiado leerían las variantes como guion. MaKo las **ofrece** en su respuesta («¿Te armo 2 aperturas más para probar?») y la métrica va en el destacado de arriba.

### 3.2 El prompt base · `copywriter.experto`

Va como `kind: 'instruction'`, sin slots y no sensible. El código lo **antepone** a REGLA_NO_EXISTE en los dos system («Discutir» y «Editar»), sin ser un slot de ellos (ver la trampa 6). Su default vive en `lib/copywriter/experto.ts`.

```text
EL MÉTODO DEL COPYWRITER (cómo trabajas cada pieza)

Eres un director de respuesta directa para negocios high ticket de Latinoamérica: coaches, mentores, infoproductores, agencias, clínicas e inmobiliarias. Escribes piezas que venden llamadas, clases, programas y propiedades: anuncios en video, textos de anuncio, reels, stories, carruseles, emails, secuencias, VSL, clases gratuitas y videos de YouTube.

ANTES DE ESCRIBIR
1. Lee EL NEGOCIO. Lo que no está ahí, no existe: no lo supones.
2. Di en una línea en qué caso estás:
   - Hoja en blanco o texto genérico: armas la pieza con los datos del negocio.
   - Un borrador con voz propia: conservas su ángulo y sus palabras; arreglas la estructura y lo que suena a máquina.
   - Un cambio puntual: tocas solo eso y dices qué cambiaste y por qué, en una línea.
3. Ubica al público: no sabe que tiene el problema, sabe del problema, conoce soluciones, conoce la oferta o está listo para comprar. Cuanto menos sabe, más problema e historia antes de la oferta. A quien ya vio la oferta no le repites el problema: le das prueba y un empujón.
4. Elige el ángulo: dolor, resultado, prueba social, curiosidad, comparación, contrarian, identidad o urgencia real. Si te piden ideas, propón 3 ángulos distintos y recomienda uno con su porqué.

AL ESCRIBIR
5. Respeta la estructura del guion: cada sección con su etiqueta, en su orden y como dice su guía.
6. Un gancho de video tiene tres capas que no repiten la misma frase: lo que se VE en los primeros 3 segundos, lo que se DICE y el TEXTO en pantalla. Para varios ganchos, cruza segmento, motivación (con las palabras del cliente) y formato; no reescribas el mismo gancho con otras palabras.
7. Escribe por partes (el gancho, cada sección, el CTA). Piensa 2 o 3 versiones de cada una y quédate con la que pasa tres preguntas: ¿se puede imaginar?, ¿se puede comprobar?, ¿la podría firmar un competidor? Si un competidor la podría firmar, cámbiala por un dato de este negocio.
8. Reglas por pieza:
   - Anuncio de Meta: el gancho en los primeros 125 caracteres del texto principal y un título de unos 40. Nada que afirme o insinúe la salud, el cuerpo, la situación financiera u otro dato personal de quien lo lee. Nada de ingresos garantizados.
   - Video corto: un cambio visual cada 2 o 3 segundos, subtítulos de 3 a 5 palabras y el texto lejos de la franja de abajo.
   - YouTube: el primer minuto cumple lo que promete la miniatura. El gancho dura 30 segundos en tres tiempos: agarre, promesa y lo que está en juego. Un CTA corto cerca del 25 % y un segundo gancho cerca del 60 %. Se cierra con la recompensa y sin despedida larga. Marca la producción con [B-ROLL], [GRAFICO] y [CAMBIO DE CAMARA]. Unas 150 palabras por minuto.
   - VSL y clase gratuita: los minutos de su estructura. La oferta llega después de dar valor, y la transición se dice en voz alta.
   - Email: un asunto claro de 40 a 60 caracteres, un solo enlace, párrafos cortos y una P. D. con una acción fácil.
   - Palabra clave («comenta GUIA», «escríbeme JUNTA»): solo si el negocio tiene la automatización que la contesta. Si no lo sabes, pregúntalo.
9. Al escribir una pieza entera, deja arriba un destacado de una línea con dos datos: para quién es y qué métrica dice si funcionó. Para un gancho es la retención a 3 segundos; para una promesa, los clics; para una oferta, el costo por agenda.

LO QUE NUNCA HACES
- Inventar cifras, testimonios, nombres de clientes, garantías, fechas o cupos. Si falta, escribe [DATO: lo que falta] y dilo.
- Usar los datos del ejemplo de una plantilla: es de un negocio ficticio y solo muestra la forma.
- Escribir con muletillas de máquina: «en el mundo de hoy», «descubre», «potencia», «transforma tu vida», «sin más preámbulos», tres adjetivos seguidos, listas de tres por costumbre, preguntas que te contestas solo y rayas para dramatizar. Un contraste del tipo «no es X, es Y» se usa como mucho una vez por pieza, y solo en el gancho.
- Poner dos ideas o dos llamados a la acción en una pieza.
- Publicar, enviar o gastar: entregas el texto en la página.

CÓMO HABLAS CON LA PERSONA
- Haces una pregunta por vez, sobre un hecho (qué vendes, a cuánto, a quién, qué prueba tienes, qué tiene que hacer quien lo vea), y solo si EL NEGOCIO no lo dice. Como máximo tres antes de escribir; lo que siga faltando va como [DATO: …].
- Cuando terminas una pieza, ofreces UN próximo paso concreto: «¿Te armo 2 aperturas más para probar?» o «¿La paso a 30 segundos?».
- Si te piden el porqué de una sección, lo explicas en una línea.
- Si te pasan resultados de una prueba, extiendes el ángulo que ganó y no vuelves a proponer el que perdió.
```

### 3.3 El pedido de adaptar · `copywriter.adaptar.user`

Va como `kind: 'user'`, `dynamic: true` y no sensible. Sus slots:
- `plantilla`: el nombre de la plantilla;
- `ejemplo`: el negocio ficticio y su rubro;
- `pide`: lo que el ejemplo usa del negocio;
- `guion`: el guion bloque por bloque, con sus ids (`guionParaIA`);
- `estructura`: `estructuraParaIA`;
- `negocio`: `bloqueNegocio`;
- `charla`: la charla.

Va con el system de «Editar» (`copywriter.editar.system` + `copywriter.experto` + REGLA_NO_EXISTE), y la salida es la misma: JSON de operaciones.

```text
LA PERSONA ABRIÓ LA PLANTILLA «{{plantilla}}» Y PIDE ADAPTARLA A SU NEGOCIO.

EL EJEMPLO es de un negocio ficticio ({{ejemplo}}). Muestra la forma: el orden, el largo, el tono y cómo se escribe cada sección. Sus datos (nombres, precios, cifras, casos, ciudades, fechas, cupos) son de ese negocio, y NINGUNO puede quedar en la versión nueva.

LO QUE EL EJEMPLO USA DEL NEGOCIO: {{pide}}

EL GUION DE AHORA, BLOQUE POR BLOQUE (el id entre corchetes):
{{guion}}

{{estructura}}{{negocio}}{{charla}}

CÓMO SIGUES:
1. Compara lo que el ejemplo usa con lo que dice EL NEGOCIO. Si falta qué vende y cuánto cuesta, a quién le habla o qué tiene que hacer quien vea la pieza, todavía no escribes: devuelve "operaciones": [] y en "respuesta" haz UNA pregunta sobre ese hecho, con un ejemplo de respuesta.
2. Si eso está, reescribe la pieza ENTERA con escribir_seccion, una operación por sección y en su orden. Respeta la forma del ejemplo: los mismos rótulos (Se ve, Dice, Texto en pantalla), las tablas como tablas, el largo y la duración.
3. Lo que el negocio no tiene (una cifra, un caso, una fecha, un cupo) va como [DATO: qué falta]. Nunca lo completes con un dato del ejemplo ni con uno inventado.
4. Reemplaza con reemplazar_bloque los destacados de arriba: para quién es la pieza y cómo se mide, sin el nombre del negocio ficticio.
5. En "respuesta", en una o dos frases: qué escribiste y cuántos [DATO: …] quedaron por completar.
```

### 3.4 Las preguntas (una por vez, por hechos, solo si el negocio no lo dice)

Cada plantilla declara `pide` y MaKo pregunta en ese orden. Los textos de la pregunta viven en `PREGUNTA_DE` (`lib/copywriter/experto.ts`) y viajan en `{{pide}}`.

| Dato | La pregunta | Ejemplo de respuesta que se ofrece |
|---|---|---|
| `oferta` | ¿Qué vendes, cuánto cuesta y qué incluye? | «Mentoría de 90 días, USD 1,500, sesiones grupales» |
| `avatar` | ¿A quién le hablas en esta pieza y con qué frase te cuenta su problema? | «Coaches que dicen "me ven, pero no me compran"» |
| `accion` | ¿Qué tiene que hacer quien la vea? | «Agendar una llamada», «ver la clase», «escribir una palabra» |
| `prueba` | ¿Qué prueba real tienes? | «Un caso con números y su permiso», «años», «clientes» |
| `conciencia` | ¿Ese público ya te conoce o te ve por primera vez? | «Primera vez», «ya vio mi página» |
| `fecha_cupo` | ¿Hay una fecha o un cupo reales? | «Cierro el viernes, quedan 4 lugares» |
| `objecion` | ¿Qué objeción escuchas más en tus llamadas? | «No tengo tiempo» |
| `quien_habla` | ¿Quién sale en cámara y de qué país es? | «Yo, de Chile» |
| `palabra_clave` | ¿Tienes la automatización que contesta la palabra clave? | «Sí, con GUIA» |
| `mecanismo` | ¿Cómo se llama tu método y en qué pasos funciona? | «Método 3C: captar, calificar, cerrar» |
| `historia` | ¿Cuál fue tu peor momento antes de encontrar el método? | «Un mes con 2 clientes» |
| `recurso` | ¿Qué recurso gratuito das (guía, checklist, clase)? | «Checklist de 12 puntos» |

`pide` de cada plantilla:

| Plantilla | Lo que pide |
|---|---|
| 1 | `oferta`, `avatar`, `accion`, `quien_habla` |
| 2 | `prueba`, `accion`, `avatar` |
| 3 | `oferta`, `accion`, `prueba` |
| 4 | `oferta`, `avatar`, `prueba`, `accion` |
| 5 | `avatar`, `palabra_clave`, `recurso` |
| 6 | `oferta`, `fecha_cupo`, `prueba`, `palabra_clave` |
| 7 | `avatar`, `palabra_clave`, `recurso` |
| 8 | `oferta`, `fecha_cupo`, `accion` |
| 9 | `recurso`, `historia`, `prueba`, `oferta`, `objecion` |
| 10 | `oferta`, `mecanismo`, `prueba`, `objecion`, `accion` |
| 11 | `oferta`, `mecanismo`, `historia`, `fecha_cupo` |
| 12 | `avatar`, `prueba`, `recurso`, `accion` |

Antes de escribir pregunta **como máximo tres**. Lo demás va como `[DATO: …]`.

### 3.5 Cómo adapta la plantilla (el recorrido)

1. **La persona toca la tarjeta.** La página nace con el ejemplo completo:
   - `props.plantilla` guarda el id de la plantilla;
   - `props.estructura` y `props.duracion` son los de la plantilla.
2. **El chat de MaKo** (PanelMaKo, a la izquierda) muestra un mensaje **local, sin llamar a la IA** (no gasta la IA del cliente sin que lo pida): «Es un ejemplo de {negocio}, un negocio ficticio. ¿Lo adapto a tu negocio?». Debajo, dos sugerencias:
   - «Adaptar a mi negocio»;
   - «Solo la estructura».
3. **«Solo la estructura»** reemplaza el documento por el esqueleto (`esqueleto()`) desde el `DocVivo` de la página, con «Deshacer» en el Toast. No llama a la IA.
4. **«Adaptar a mi negocio»** manda `accion: 'adaptar'` a `/api/copywriter/ia`. El server arma:
   - el system: `copywriter.editar.system` + `copywriter.experto` + REGLA_NO_EXISTE;
   - el user: `copywriter.adaptar.user`, con el ejemplo y lo que pide.
   - Vuelve una **pregunta** (operaciones vacías) o la pieza entera como **propuesta** («Aceptar · Descartar · Reintentar», como hoy).
5. **Si MaKo preguntó,** PanelMaKo queda en «adaptando»: la próxima respuesta de la persona también va como `adaptar`. Sale de ese estado al aceptar o descartar una propuesta, o al elegir otra sugerencia.
6. **Mientras queden restos,** EditorGuion muestra una franja arriba: «Quedan 5 bloques del ejemplo · 2 datos por completar», con el botón «Adaptar con MaKo». Lo mismo avisa «Copiar texto». Los restos son bloques iguales a los del ejemplo o un `[DATO:`.

**Un caso para ver la diferencia.** Un negocio que vende una mentoría para inmobiliarias de Mérida abre la plantilla 1. El Second Brain tiene la oferta (USD 900, 6 semanas) pero ningún caso con números.
- MaKo no pregunta (oferta, avatar y acción están).
- Escribe las seis secciones y deja `[DATO: un resultado de un cliente, con su permiso]` en la SOLUCION.
- Responde: «Escribí el anuncio con tu mentoría de 6 semanas. Queda 1 dato por completar: un resultado real de un cliente. ¿Te armo 2 aperturas más para probar?».

---

## 4. Qué se copia y de dónde

**Copiable** (licencia leída hoy en `raw.githubusercontent.com/<repo>/main/LICENSE`). El texto se **traduce y se reescribe** para high ticket en LATAM, así que no se pega nada en inglés. Se conserva el aviso de copyright como decide el README (sección 5): una sola copia por repo en `lib/avisos/LICENSE-<REPO>` (marketingskills lo usan cuatro tabs) y la cabecera de cada archivo que toma algo lo nombra.

| Fuente | Licencia exacta | Qué se toma | Dónde va |
|---|---|---|---|
| https://github.com/coreyhaines31/marketingskills | MIT License, «Copyright (c) 2025 Corey Haines» | De `skills/copywriting/SKILL.md`: el diagnóstico (en blanco, voz propia, cambio puntual), las tres preguntas (imaginar, comprobar, el competidor), escribir por partes y quedarse con la mejor, y la lista de muletillas (adaptada al español). De `skills/ad-creative/references/hook-system.md`: las tres capas del gancho, la matriz segmento × motivación × formato y una variable por prueba. De `skills/emails/references/sequence-templates.md`: la secuencia de nutrición previa a la venta (8 correos en 21 días), comprimida a 5. | `copywriter.experto`, plantillas 4 y 9 |
| https://github.com/retieedra-profound/skills-marketing-library | MIT License, «Copyright (c) 2026 Profound» | El origen que marketingskills acredita para el diagnóstico, las tres preguntas y escribir por partes. Se conservan los dos avisos. | `copywriter.experto` |
| https://github.com/agricidaniel/claude-youtube | MIT License, «Copyright (c) 2025 Daniel Agrici» | De `skills/claude-youtube/sub-skills/script.md`: el gancho de 30 s en tres tiempos (agarre, promesa, lo que está en juego); bloques que abren con una interrupción y cierran con un resumen y un puente; CTA blando al 25 %; segundo gancho al 60 %; cierre sin despedida; unas 150 palabras por minuto; el registro de interrupciones y el mapa de riesgos. **Sin** sus metas numéricas como hechos (el 70 % de retención a los 30 s no cita fuente). | `youtube-retencion` (guía) y plantilla 12 |

**Solo como idea** (no se copia ni el texto ni el nombre):

| Fuente | Por qué |
|---|---|
| https://github.com/msitarzewski/agency-agents (MIT License, «Copyright (c) 2025 AgentLand Contributors», verificada) | Solo se leyó un archivo (`paid-media-creative-strategist.md`). Se toma la idea del creativo como hipótesis; no se copia texto. |
| Resúmenes del memo de producción de MrBeast (https://www.alexanderjarvis.com/memo-how-to-succeed-in-mrbeast-production/) | Documento filtrado y sin licencia. Se toman los principios (el primer minuto cumple la miniatura, los reenganches cerca del minuto 3 y del 6) con palabras propias, y nunca el nombre. |
| Política de atributos personales de Meta (https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/) | Es una regla, no un texto para copiar. |
| PAS, AIDA, BAB, 4P, VSL, gancho-historia-oferta | Métodos sin licencia; ya están con texto propio en `lib/guion-estructuras.ts` y `lib/vsl-estructuras.ts`. |
| Wikipedia, «AIDA (marketing)» | CC BY-SA 4.0, que obliga a licenciar igual lo derivado: no entra texto al producto. |
| Notion, Canva, Jasper, Copy.ai, Swiped, Foreplay | Productos con copyright: se toma el modelo de la tarjeta, no su contenido. |
| «Perfect Webinar», «Hook, Story, Offer», «Hook-Retain-Reward» | Nombres de Russell Brunson y de Hormozi: no se usan en el producto. |

---

## 5. Cómo implementarlo sobre el código de hoy

**El orden:** primero 5.1 a 5.4 (lo puro y sus tests), después 5.5 y 5.6 (la pantalla) y por último 5.7 y 5.8 (la IA). Cada paso pasa `tsc` acotado y los tests del Copywriter. Antes de subir, se corre `verify-prompt-registry-sync`.

### 5.1 `lib/copywriter/plantillas.ts`

- **`Plantilla` suma:**
  - `duracion?: number` (segundos);
  - `ejemplo?: { negocio: string; rubro: string }` (va al slot `{{ejemplo}}` y al mensaje de PanelMaKo);
  - `pide?: readonly DatoNegocio[]`;
  - `insignia?: string`;
  - `visible?: boolean` (por defecto, sí);
  - `esqueleto: () => JsonNodo`: las secciones vacías, que hoy son el cuerpo de cada plantilla. Se conservan las funciones `campo`, `tabla` y `destacado` de ahora: siguen armando ESE esqueleto.
- **`descripcion`** pasa a ser la línea de «cuándo usarla» (la de 2.x).
- **`contenido()`** devuelve `docDeEjemplo(EJEMPLOS[id])`.
- **`guionAnuncio(c)`** deja de usar `estructuraPorDefecto`: fija `'pas'`. Si `pas` no está en el catálogo o sus etiquetas no son las de fábrica (el super admin la editó), `estructura: null`. El ejemplo queda igual.
- **`vsls()`:** las dos con ejemplo, visibles. Las otras tres, `visible: false` y con el esqueleto como contenido.
- **Funciones nuevas:**
  - `extractoDe(p)`: el texto del primer bloque con texto después de la primera sección, sin «Dice:» ni «Frase hablada:», cortado a 140 caracteres en un borde de palabra;
  - `chipsDe(p)`: `nombreDeSeccion` de sus secciones;
  - `restosDelEjemplo(doc, p)`: `{ bloques, datos }`. `bloques` cuenta los bloques cuyo texto normalizado es igual al de un bloque del ejemplo, con más de 12 caracteres. `datos` cuenta las apariciones de `[DATO:`.
- **`plantillasDe(c)`** devuelve las 12, `blanco` y las 3 ocultas. La galería filtra con `visible !== false`.
- **Nuevo, al lado:** `lib/copywriter/plantillas-ejemplos.ts`, con los 12 textos de la sección 2 (datos puros) y la cabecera de fuentes. El guard de voseo los revisa solo, porque son strings de `lib/`.

### 5.2 `lib/copywriter/texto.ts`

- **`docDeEjemplo(texto)`** usa la misma lectura que `bloquesDeTexto` (copiar antes de crear) y suma tres casos:
  - `!<emoji> texto` es un destacado;
  - las líneas `| … |` seguidas son una tabla, con la primera fila como encabezado;
  - `**x**` es negrita.
- **`bloquesDeTexto` no cambia:** lo usa la API de MaKo y cambiarle la lectura cambiaría lo que crean los integradores.

### 5.3 `lib/guion-estructuras.ts` y `lib/copywriter/doc.ts`

- **La estructura nueva** (agregar es seguro):

```ts
{
  id: 'youtube-retencion', nombre: 'YouTube: Gancho → Bloques → Regancho → Cierre', emoji: '▶️', activo: true, tipos: ['youtube'],
  cuando: 'Un video largo que sostiene la atención: el primer minuto cumple la miniatura, cada bloque abre con una interrupción y el final entrega la recompensa.',
  etiquetas: ['GANCHO', 'INTRO', 'BLOQUE UNO', 'CTA MEDIO', 'BLOQUE DOS', 'BLOQUE TRES', 'REGANCHO', 'BLOQUE FINAL', 'CIERRE'],
  guia: `GANCHO (0:00-0:30, en tres tiempos): el agarre (hasta el segundo 5) muestra lo que promete la miniatura; la promesa (hasta el 15) dice qué se lleva quien mire el video; lo que está en juego (hasta el 30) dice qué pierde si no lo sabe. Sin saludo y sin presentarte antes del gancho.
INTRO (0:30-1:30): quién eres, en una frase y en función del tema, y de dónde salen los datos del video. Cierra con un puente al primer bloque.
BLOQUE UNO (1:30-3:00): abre con una interrupción (cambio de cámara, gráfico o ejemplo en pantalla), entrega una idea completa que se pueda aplicar y cierra con un resumen de una línea y un puente al bloque siguiente.
CTA MEDIO (cerca del minuto 3, el 25 % del video; 15 segundos como máximo): un recurso gratuito ligado al tema (una guía, un checklist) y dónde encontrarlo. No pide comprar ni agendar.
BLOQUE DOS (3:15-5:00): su primera línea vuelve a enganchar a quien se iba a ir («lo que sigue te va a doler»). Misma forma: interrupción, una idea, resumen y puente.
BLOQUE TRES (5:00-7:30): la idea más teórica, siempre con un ejemplo en pantalla. Misma forma.
REGANCHO (cerca del minuto 7:30, el 60 % del video): una o dos frases que resumen lo que ya vio y prometen lo mejor que falta.
BLOQUE FINAL (7:30-11:00): la recompensa que prometió la miniatura, entera. Una interrupción cada 30 a 40 segundos.
CIERRE (11:00-12:00): una sola acción y el video que sigue. Sin despedida larga, y sin anunciar que termina antes de entregar la recompensa.
Los tiempos son de un video de 12 minutos: en otro largo se escalan en proporción, salvo el gancho, que dura siempre 30 segundos. Marca la producción entre corchetes: [B-ROLL], [GRAFICO] y [CAMBIO DE CAMARA]. Unas 150 palabras por minuto.`,
}
```

- **El override no la tapa:** `conLasDeOrganicoNuevas` (`lib/guion-estructuras-store.ts`) suma las de fábrica que no son de anuncios, así que aparece aunque el super admin ya haya guardado su biblioteca.
- **La cabecera del archivo** acredita a claude-youtube, con su `lib/avisos/LICENSE-CLAUDE-YOUTUBE`.
- **Cierra la D6** de `docs/diseno-copywriter.md` (YouTube sin estructura) con una fuente externa con licencia.
- **`YOUTUBE`** en `plantillas.ts` pasa a `estructura: 'youtube-retencion'`.
- **En `doc.ts`,** `CON_TILDE` suma `'CTA MEDIO': 'CTA medio'`. Sin eso se leería «Cta medio». Las demás etiquetas nuevas se leen bien solas: «Ganchos», «Texto del anuncio», «Email 1», «Bloque final», «Regancho».

### 5.4 `lib/copywriter/tipos.ts`

- **`PropsGuion`** suma `plantilla: string | null`, el id de la plantilla de la que nació la página.
- **`sanearProps`** lo valida con el mismo `id()` que `angulo` y `estructura`.
- **`propsNuevas(tipo, estructura, extra?)`** acepta `{ plantilla, duracion }`.
- **La UI de propiedades** no lo muestra.

### 5.5 La tarjeta: `app/_crear/reglas.ts`, `app/_crear/PantallaCrear.tsx`, `app/_crear/crear.css`

- **`PlantillaCrear`** usa los campos comunes de la tanda 0 (README, sección 6). Copywriter llena `extracto`, `chips`, `insignia`, `ayuda`, `grupo` y `ejemplo`. Todos son opcionales: la tab que no los pasa se dibuja como hoy.
- **`chipsVisibles(chips, max = 3)`** es pura (devuelve `['Gancho', 'Problema', 'Agitación', '+3']`) y se prueba en `tests/crear-pantalla.test.ts`.
- **En `NuevaCrear`,** si hay `extracto`, la miniatura dibuja `.cr-plantilla__hoja` en lugar de `.cr-plantilla__marco`:
  - arriba, el rótulo y la insignia;
  - el extracto con 4 renglones como máximo (`-webkit-line-clamp`);
  - los chips;
  - `title={pl.ayuda}`.
- **Colores** con los tokens de la casa (`var(--surface)`, `var(--ink)`), así el modo oscuro sale solo.
- **El shell es compartido:** lo armó el chat «Create: un solo diseño». El cambio es solo de suma.

### 5.6 `app/copywriter/Copywriter.tsx` y `app/m/copywriter/ListaGuionesM.tsx`

- **El map de plantillas** pasa `extracto: extractoDe(x)`, `chips: chipsDe(x)`, `insignia: x.insignia` y `ayuda: x.descripcion`, y filtra las ocultas.
- **`crear`** manda `props: propsNuevas(tipo, plantilla.estructura, { plantilla: plantilla.id, duracion: plantilla.duracion })`.
- **En el teléfono,** la misma propiedad y la segunda línea con `descripcion`, que ya hoy es lo que dibuja.

### 5.7 La IA: `lib/copywriter/operaciones.ts`, `lib/copywriter/ia-editar.ts`, `lib/copywriter/ia.ts`, `lib/prompt-registry.ts`, `app/api/copywriter/ia/route.ts`

- **`operaciones.ts`:**
  - `TIPOS_BLOQUE_IA` suma `'tabla'`, con la forma `{ tipo: 'tabla', filas: string[][] }` (la primera fila es el encabezado);
  - el saneo admite hasta 8 columnas y 30 filas, y cada celda corta en 1,000 caracteres;
  - `bloqueAJson` arma `table` / `tableRow` / `tableHeader` / `tableCell`;
  - `truncarBloque` ya es genérico; se prueba con una tabla.
  - Sin esto, «adaptar» el Reel, las Stories, el Carrusel o los Ganchos borra sus tablas.
- **`ia-editar.ts`:** `FORMATO_EDITAR` (va en el slot `{{formato}}`, sale del código) documenta el bloque `tabla`.
- **Nuevo, `lib/copywriter/experto.ts`:** `EXPERTO_COPY`, `ADAPTAR_USER`, `PREGUNTA_DE`, el tipo `DatoNegocio` y `PROMPTS_EXPERTO = { experto: { key: 'copywriter.experto', tpl }, adaptarUser: { key: 'copywriter.adaptar.user', tpl } }`. La cabecera nombra marketingskills, Profound y claude-youtube con sus avisos.
- **`ia.ts`:**
  - en `discutir` y en `editar`, el system pasa a `brandSystem(\`${system}\n\n${await renderPrompt(PROMPTS_EXPERTO.experto.key, PROMPTS_EXPERTO.experto.tpl, {})}\n\n${REGLA_NO_EXISTE}\`)`;
  - `editar` acepta `adaptar?: boolean`. Con `adaptar` y `props.plantilla`, el user es `ADAPTAR_USER` con `plantilla`, `ejemplo` (`${negocio}, ${rubro}`), `pide` (las preguntas de `PREGUNTA_DE` en el orden de la plantilla), `guion`, `estructura`, `negocio` y `charla`. El resto del camino es el mismo: la validación de operaciones, la marca de voseo y la Ticketera.
- **`prompt-registry.ts`,** grupo «Copywriter»: dos `Entry` con `source: 'override'`.
  - `copywriter.experto`: `kind: 'instruction'`, `dynamic: false`, `variables: []`, `scope: 'full'`, `sensitive: false`. Su `context`: «El método del Copywriter: se suma a Discutir y a Editar. Conserva la regla de no inventar y la de no usar los datos del ejemplo.»
  - `copywriter.adaptar.user`: `kind: 'user'`, `dynamic: true`, con `v('plantilla', …)`, `v('ejemplo', …)`, `v('pide', …)`, `v('guion', …)`, `v('estructura', …)`, `v('negocio', …)` y `v('charla', …)`.
- **`route.ts`:** `case 'adaptar'` llama a `editar({ …, adaptar: true })`.

### 5.8 La pantalla de la página: `app/copywriter/PanelMaKo.tsx` y `app/copywriter/editor/EditorGuion.tsx`

- **PanelMaKo:**
  - con `guion.doc.props.plantilla`, restos y el hilo vacío, el mensaje local y las dos sugerencias de 3.5;
  - el estado `adaptando`;
  - mandar con `accion: 'adaptar'`.
- **EditorGuion:**
  - la franja de restos;
  - «Solo la estructura» (el `DocVivo` con el esqueleto y «Deshacer»);
  - el aviso al copiar.

### 5.9 La API de MaKo: `lib/api-mako/areas/copywriter.run.ts` y `lib/api-mako/areas/copywriter.def.ts`

- **`crear_documento_copywriter` con `plantillaId` y sin texto** usa `pl.esqueleto()`, no el ejemplo, y guarda `props.plantilla`.
- **`listar_plantillas_copywriter`** suma `cuando` y `ejemplo` (`textoDelDoc(pl.contenido())` cortado a 2,000 caracteres), así el agente externo ve la forma.
- **La descripción de la acción** cambia la lista de plantillas.

### 5.10 Tests

- **`tests/copywriter-plantillas.test.ts`:**
  - la lista de ids;
  - las secciones del Reel, el Copy y el Email siguen iguales;
  - «un VSL por estructura activa» pasa a «las VSL con ejemplo visibles; las demás resuelven por id»;
  - **cada ejemplo**:
    - pasa el saneo y la ida y vuelta por BlockNote, con tablas, destacados y negritas;
    - tiene extracto, chips, `pide` y un destacado 🧪;
    - no tiene `{{` ni `[DATO:`;
    - tiene como mucho un contraste («no es… es», «no… sino», «nunca fue… sino») por pieza, y solo en el GANCHO o en la primera frase de una variante (trampa 10);
    - sus cifras están en la tabla del elenco (README, 2.2) o son de esa sola pieza;
    - no nombra a ningún REAL. La lista `REALES` de `tests/variables-aviso.test.ts` se mueve a `tests/_reales.ts` y la importan los dos;
  - `restosDelEjemplo(contenido)` da todos los bloques y `restosDelEjemplo(esqueleto)` da 0.
- **`tests/copywriter-ia.test.ts`:** las keys de `PROMPTS_EXPERTO` están en el registro con sus slots.
- **`tests/copywriter-operaciones.test.ts`:** el bloque `tabla` (saneo, topes, JSON y truncado).
- **`tests/copywriter-tipos.test.ts`:** `props.plantilla`.
- **`tests/crear-pantalla.test.ts`:** `chipsVisibles`.
- **`tests/puente-panel-copy.test.ts`** no cambia: recorre todo `lib/` con `git ls-files`, así que cubre los ejemplos en cuanto estén en el índice.

### 5.11 Documentos (la cosecha, en el mismo commit)

- **`docs/diseno-copywriter.md`:** una D16 («Plantillas con ejemplo y el experto»), y la D6 queda cerrada con la fuente.
- **`docs/hallazgos-copywriter.md`:** las trampas 1 a 8 de abajo. Su línea en **`docs/hallazgos.md`** se actualiza en el mismo commit.

---

## 6. Trampas

1. **El diagnóstico obvio era el equivocado: no faltan plantillas, falta el ejemplo lleno.** Las estructuras existen (`pas`, `gancho-historia-cta`, `reel-viral`, `story-dia` y las 5 de VSL). Lo que es rectángulo es la tarjeta, y el cuerpo nace vacío.
2. **MaKo no puede escribir tablas.** `TIPOS_BLOQUE_IA` no tiene `tabla`, y `escribir_seccion` reemplaza todo el cuerpo de la sección. Al «adaptar» el Reel, las Stories, el Carrusel o los Ganchos, la tabla se convertiría en párrafos sin que nada falle. Va antes que «Adaptar».
3. **Un renglón en MAYÚSCULA abre una sección.**
   - `bloquesDeTexto` (y `docDeEjemplo`) toma como sección toda línea de 20 caracteres o menos en mayúscula que pase `esEtiqueta`, y antes le quita los dos puntos del final. Una línea suelta como `CTA`, `NEGOCIO:` o un texto en pantalla sin comillas, como `43 DE 50 FALLAN`, parte el documento.
   - En los ejemplos, el texto en pantalla va siempre entre «».
4. **La API crearía páginas con el negocio ficticio.** `crear_documento_copywriter` con `plantillaId` usa `pl.contenido()`. Con el ejemplo adentro, un agente de WhatsApp le dejaría a un cliente el anuncio de Cierre Consultivo. Por eso existe `esqueleto()`.
5. **La plantilla «Guion de anuncio» seguía al super admin.** Usaba `estructuraPorDefecto(c, 'ad')`, la primera de la biblioteca editable. Un ejemplo escrito con las etiquetas de PAS no puede depender de eso: se fija `pas`, y si el override la cambió o la apagó, la página nace con el ejemplo y sin estructura elegida.
6. **No se agregan slots a los prompts que ya existen.** Un override guardado de `copywriter.editar.user` no tendría el slot nuevo y el dato no llegaría nunca, sin error. El método va en una key aparte, que el código antepone; el pedido de adaptar va en una key `user` nueva.
7. **Las variantes no van en la página.** «3 ganchos y 2 CTA» escritos debajo del guion se leen como guion al copiar el texto. Van en la respuesta del chat, como una oferta.
8. **Las llaves de las variables.**
   - Email Marketing usa `{nombre}`, con una llave (`lib/template-vars.ts`). Con `{{nombre}}`, el ejemplo pasaría por `renderPrompt` y por el escape de `contenidoNoConfiable`.
   - El link del ejemplo es `example.com`, un dominio reservado: uno inventado, como «consultarentable.com», puede existir.
9. **Los nombres del elenco.** «Martín», «Dental Ramos» y «Vértice» están en `REALES`; ningún ejemplo los usa. La búsqueda web de hoy no encontró marcas con los cinco nombres del elenco. «Sonríe Studio» se quitó porque es un nombre genérico, probablemente en uso. Antes de publicar se vuelve a buscar cada nombre nuevo.
10. **El voseo y las muletillas en los propios ejemplos.**
    - El guard frena «Guardalo», «Dejame» o «acá»; las formas neutras llevan tilde: «Guárdalo», «Déjame», «aquí».
    - Más fácil de pasar por alto: los ejemplos tampoco pueden tener las muletillas que el prompt prohíbe. El borrador anterior tenía «no son presentaciones: son diagnósticos» y «lo primero que cambió no fue el anuncio, fue…»: se reescribieron.
    - **La revisión del 29/10 encontró más contrastes fuera del gancho**, aunque este punto decía que no quedaban: el texto del anuncio de la 1 («casi nunca es por el precio. Casi siempre es por…»), la moraleja y el caption de la 5, el frame 4 de la 6 («No son nervios»), el email 2 de la 9 y el «el problema nunca fue el anuncio» y el «no alcance» de la 10. Se reescribieron.
    - Quedan solo en el gancho, una vez por pieza, como pide el prompt: el de la 1 («el problema no es tu precio») y los de las variantes A y C de la 3 (la C es el ángulo contrarian). El test de ejemplos cuenta los contrastes «no es… es» y «no… sino» por sección: como mucho uno, y solo en GANCHO o en la primera frase de una variante.
11. **Meta.**
    - Ganchos como «¿Tienes sobrepeso?» o «¿Tienes deudas?» pueden hacer que rechacen el anuncio. Los ejemplos de nutrición hablan del oficio, no del cuerpo de quien lee.
    - La cuenta «si se te escapan dos llamadas… son ocho mil dólares» es condicional y sobre el negocio de quien lee. Sin verificar contra la política: si Meta la rechaza, se pasa a tercera persona.
    - Los límites de caracteres (125/40) son guías y difieren según la fuente: el editor avisa, no corta.
    - Los anuncios de vivienda pueden pedir una categoría especial según el país; no se verificó para México.
12. **La estructura de `reel-viral` dura 50 a 60 s.** El ejemplo del borrador (35 s, «Gancho → Valor → CTA») no calzaba con la estructura que la plantilla deja elegida; `gancho-valor-cta` es solo de anuncios. El ejemplo se rehizo en 52 s dentro de `reel-viral`. La plantilla 4 de AI Avatar (~26 s) tenía el mismo error y pasó a `reel-nicho`, que no fija duración.
    - Lo mismo con las VSL: `vsl-clase-educativa` declara `minutos: 40`, pero su guía termina con el CTA de 39 a 42. La clase del ejemplo dura 42 (2,520 s), no 45.
13. **Las cifras sin fuente no entran.** El «70 % de retención a los 30 s» de claude-youtube, el «55 % se va en el primer minuto» y el «71 % decide en 3 s» no van a ningún ejemplo ni al prompt como hechos. Tampoco el «la persona habla el 70 % del tiempo» de las llamadas de venta, que se coló en la SOLUCION de la plantilla 1 y se quitó. Ni una escasez que no se comprueba, como «la cohorte se llenó en 6 días».
14. **La pantalla de las tarjetas es compartida.** `PantallaCrear` la usan las cinco tabs de Create. Los campos nuevos de `PlantillaCrear` son opcionales, y el marco de hoy queda para quien no los pasa.

## Sin hacer (con dónde vive)

- Ejemplos para `vsl-anti-solucion`, `vsl-diagnostico` y `vsl-historia-fundador` (`lib/copywriter/plantillas.ts`, quedan ocultas). Y para `reel-nicho`, `aida`, `bab` y `gancho-propuesta-cta`, que hoy no tienen tarjeta.
- El «Reel de historia (BAB)» de Voz de Líder de la investigación pasa a la tab Video.
- Los `evals` del experto (un pedido, la salida esperada y las verificaciones, como marketingskills): `tests/copywriter-ia.test.ts` solo fija keys y slots. La calidad de la adaptación no tiene prueba automática.
- Verificar la galería de Canva en el navegador (dio 403) y los anuncios de vivienda de Meta en México.
- **Leer el negocio con `grafoParaChat`.** Hecho en la tanda 0 (29/10/2026): `contextoDelNegocio` vive en `lib/negocio-para-crear.ts` y lee `grafoParaChat`; `lib/copywriter/contexto.ts` quedó como re-exportación, así que los imports del Copywriter no cambian.
