// =============================================================================
// copywriter/plantillas-ejemplos — el ejemplo COMPLETO de cada plantilla de «Nueva» (DATOS PUROS)
// =============================================================================
// Martín (29/10/2026): «Los templates tienen que ser reales… deben ser ejemplos reales». El plan, con el porqué de cada
// pieza y sus cuentas: docs/plantillas-reales/copywriter.md (sección 2) y la regla común en docs/plantillas-reales/README.md.
//
// LOS NEGOCIOS SON FICTICIOS (el elenco del README, 2.2): Cierre Consultivo, Consulta Rentable, Pulso Dental, Torre Alameda
// y Voz de Líder, con sus clientes inventados. Ninguno nombra a alguien de la lista REALES (tests/variables-aviso.test.ts).
// Cada ejemplo abre con un destacado 🧪 (el único bloque fuera de las secciones): que el negocio es ficticio, para qué
// sirve la pieza y cómo se mide. Ninguno tiene un «[DATO: …]»: eso aparece sólo en la versión adaptada.
//
// EL FORMATO (lo lee `docDeEjemplo`, ./texto.ts): una línea con la ETIQUETA sola en MAYÚSCULA abre la sección; «- » es una
// viñeta, «1. » una numerada, «> » una cita, «!<emoji> texto» un destacado, «| a | b |» una fila de tabla (la primera, el
// encabezado) y «**x**» negrita. ⚠️ El texto en pantalla va siempre entre «»: un renglón corto en MAYÚSCULA partiría la
// sección. ⚠️ Español neutro con «tú» (tests/puente-panel-copy.test.ts barre lib/), sin las muletillas que el experto
// prohíbe (./experto.ts) y con un solo contraste por pieza, en el gancho.
//
// DE DÓNDE SALE LA FORMA (traducida y reescrita, sin texto en inglés):
//   · los «10 ganchos» y las tres capas del gancho: marketingskills, `skills/ad-creative/references/hook-system.md`
//     (https://github.com/coreyhaines31/marketingskills, MIT, «Copyright (c) 2025 Corey Haines»,
//     lib/avisos/LICENSE-MARKETINGSKILLS);
//   · la secuencia de 5 emails: la de nutrición de marketingskills (`skills/emails/references/sequence-templates.md`),
//     comprimida de 8 correos en 21 días a 5 en 10;
//   · el YouTube de 12 minutos: claude-youtube, `sub-skills/script.md` (https://github.com/agricidaniel/claude-youtube, MIT,
//     «Copyright (c) 2025 Daniel Agrici», lib/avisos/LICENSE-CLAUDE-YOUTUBE), sin sus metas numéricas.
// =============================================================================

import { CAPTION_VISIBLE } from '../ig-formatos';

/** El ejemplo de cada plantilla, por su id (plantillas.ts). */
export const EJEMPLOS: Readonly<Record<string, string>> = {
  // ── 1 · Anuncio a cámara (PAS) · Cierre Consultivo ─────────────────────────
  'guion-anuncio': `!🧪 Ejemplo ficticio: Cierre Consultivo, mentoría de ventas para coaches. Video 9:16 de 45 s para tráfico frío. Gana el que agenda llamadas más baratas.
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
- **Botón:** Más información`,

  // ── 2 · Testimonio de cliente · Pulso Dental ───────────────────────────────
  testimonio: `!🧪 Ejemplo ficticio: Pulso Dental, agencia de pacientes para clínicas dentales. Habla un cliente, grabado con su celular. Video 9:16 de 40 s.
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
- **En el texto del anuncio:** «Resultados de una clínica en particular. Dependen de la ciudad, la oferta y la inversión.»`,

  // ── 3 · Copy de anuncio: 3 ángulos · Consulta Rentable ─────────────────────
  'copy-anuncio': `!🧪 Ejemplo ficticio: Consulta Rentable, programa de 90 días para nutriólogas (USD 1,200). Tres ángulos en la misma campaña. Gana el registro más barato a la clase gratuita.
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
- El caso de la variante B se publica solo con la autorización de Lucía y con su resultado real.`,

  // ── 4 · 10 ganchos para un anuncio · Torre Alameda ─────────────────────────
  'banco-ganchos': `!🧪 Ejemplo ficticio: Torre Alameda, preventa en Querétaro. Diez aperturas para el mismo cuerpo. Gana la de mejor retención a 3 s y contacto más barato.
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
- **Texto en pantalla:** «Lista de precios por WhatsApp»`,

  // ── 5 · Reel que trae mensajes · Cierre Consultivo ─────────────────────────
  reel: `!🧪 Ejemplo ficticio: Cierre Consultivo, mentoría de ventas para coaches. Reel 9:16 de 52 s. Se mide en comentarios con la palabra GUIA.
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
!✂️ Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».
La mayoría de las ventas se pierden en el chat, antes de la llamada. Guárdalo para tu próximo "¿precio?". Comenta GUIA y te mando las 6 preguntas.`,

  // ── 6 · Stories que venden · Voz de Líder ──────────────────────────────────
  stories: `!💡 Una sola idea en todo el día.
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
- Los 4 lugares van solo si son reales.`,

  // ── 7 · Carrusel que se guarda · Torre Alameda ─────────────────────────────
  carrusel: `!🧪 Ejemplo ficticio: Torre Alameda, preventa en Querétaro. Diez diapositivas 4:5 (1080 × 1350). Se mide en guardados y mensajes con PRECIOS.
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
!✂️ Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».
Guárdalo para tu próxima visita a una preventa. ¿Cuál de las 7 no habías preguntado? Te leo en comentarios.`,

  // ── 8 · Email de cierre · Voz de Líder ─────────────────────────────────────
  // La variable va con UNA llave ({nombre}, la de Email Marketing: lib/template-vars.ts): con dos, el ejemplo pasaría por
  // renderPrompt como un slot.
  email: `!🧪 Ejemplo ficticio: Voz de Líder, programa de oratoria para gerentes. Email de cierre de inscripciones. Se mide en llamadas de admisión agendadas.
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
Agenda tu llamada de admisión`,

  // ── 9 · 5 emails tras una descarga · Consulta Rentable ─────────────────────
  'secuencia-nutricion': `!🧪 Ejemplo ficticio: Consulta Rentable, programa para nutriólogas. Se dispara con la descarga de la guía «5 mensajes para convertir seguidores en pacientes».
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
- **Botón:** Agendar 20 minutos`,

  // ── 10 · VSL para agendar · Pulso Dental ───────────────────────────────────
  'vsl-respuesta-directa': `!🧪 Ejemplo ficticio: Pulso Dental, sistema de pacientes para clínicas dentales (USD 1,200 al mes, contrato de 3 meses). Versión de 10 minutos para la página de agenda. Se mide en auditorías agendadas.
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
«Debajo de este video hay un calendario. Elige un horario para una auditoría de 30 minutos conmigo: revisamos tus anuncios y tus últimos 20 mensajes, y te digo dónde se te van los pacientes. Si después no quieres trabajar con nosotros, te quedas con el diagnóstico.»`,

  // ── 11 · Clase gratuita: 3 claves · Consulta Rentable ──────────────────────
  'vsl-clase-educativa': `!🧪 Ejemplo ficticio: Consulta Rentable. Clase en vivo de 42 minutos: «Cómo llenar tu consulta online sin publicar todos los días». Se mide en inscripciones durante la clase.
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
«El enlace está en el chat. Al inscribirte te llega un correo con el acceso y la fecha de tu revisión uno a uno. Mientras se inscriben, respondo preguntas.»`,

  // ── 12 · YouTube de 12 minutos · Pulso Dental ──────────────────────────────
  youtube: `!🧪 Ejemplo ficticio: el canal de Diego Ferrer, fundador de Pulso Dental. Video de 12 minutos. Se mide en clics a la miniatura, retención al minuto 1 y auditorías agendadas.
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
«Si quieres que revisemos tus anuncios con estos 12 puntos, agenda una auditoría gratuita en el enlace de la descripción. Y si quieres ver cómo armamos el guion para responder en cinco minutos, ese video está aquí.» [PANTALLA FINAL. Corte en seco, sin despedida.]`,
};
