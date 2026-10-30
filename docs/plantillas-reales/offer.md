# Offer: plantillas reales y el experto en ofertas

> Parte de [Plantillas reales en Create](README.md). La regla común, el elenco, el patrón del agente experto, la tabla única de licencias y el orden de implementación viven en el README; este archivo es la parte de Offer, entera, con sus ejemplos completos.

**Qué es:** la parte de Offer del plan de plantillas de Create. «Nueva oferta» deja de listar solo «Crear una oferta nueva» y «Analizar «X»» por funnel, y pasa a mostrar **9 ofertas de ejemplo completas**, de los negocios ficticios del elenco común. Al abrir una, MaKo arma la oferta del dueño con esa **forma**, conversando como ya conversa.
**Estado:** es un plan. No hay nada implementado. Se midió contra `origin/main` `1cf06eba9` (29/10/2026 13:55), leído con `git show` en `C:/dev/wt-push-q`.
**De dónde sale:** la investigación web del 29/10/2026 (sección 1), el código de la tab y `docs/offer-marco.md`, que es la única definición de oferta que vale en MaKo. Ningún texto de producto de este documento se copió de afuera.

---

## 1. Cómo lo hacen los mejores y qué copiamos de la forma de mostrar

### 1.1 El método

| Fuente | Qué hace | Qué tomamos |
|---|---|---|
| Hormozi, Acquisition.com, curso gratis de ofertas: https://www.acquisition.com/offers-oo | Seis lecciones: la ecuación de valor, el apilado de la oferta, el marco de la oferta, quitar objeciones antes de que aparezcan, la psicología del precio y la reversión del riesgo. **No trae ningún ejemplo resuelto.** El pie dice «All Rights Reserved». | Solo la idea, que además ya está en el marco (§2, §4 D5 y §5, sección 16). Ni el texto ni los nombres («Grand Slam Offer», «$100M»). |
| Skill `offers` de marketingskills (MIT): https://github.com/coreyhaines31/marketingskills/tree/main/skills/offers | Seis piezas (entregable central, bonos, garantía, escasez o urgencia, nombre, precio y pago) y un **bucle de diagnóstico**: tipo de negocio → la oferta en lenguaje llano → puntaje de 1 a 10 por palanca → la más baja manda → se cambia una pieza por vuelta → proyección honesta (10-40 % por cambio, y los cambios se multiplican). Trae referencias de garantías (8 tipos y cómo elegir), de bonos (cada uno contesta una objeción), de escasez honesta (7 formatos y 5 preguntas de control) y de formatos por tipo de negocio. **Sus ejemplos son antes → diagnóstico → después, con la palanca que se movió.** | El bucle, la elección de garantía, los tipos de bono, la escasez honesta y el formato de ejemplo con la palanca (detalle en la sección 4). Se traducen y se adaptan; el marco de MaKo manda donde hay diferencias (trampa 7). |
| Política de Meta, «Unrealistic outcomes»: https://transparency.meta.com/policies/ad-standards/deceptive-content/unrealistic-outcomes | Cubre la salud y las oportunidades económicas: hacerse rico rápido, ganar sin trabajo y resultados concretos sin aclaración. | Lo que va al anuncio («mensaje corto» y «promesa de entrada») no promete ingresos ni resultados de salud. Ya lo dice el marco (§5, «en el anuncio va solo la promesa»). |
| FTC, «Bringing Dark Patterns to Light» (2022): https://www.ftc.gov/system/files/ftc_gov/pdf/P214800+Dark+Patterns+Report+9.14.2022+-+FINAL.pdf | Pone los contadores que se reinician y el «quedan pocos» falso entre los patrones engañosos. | Cada urgencia de los ejemplos se puede comprobar y se cumple (marco §7.3). |

### 1.2 Cómo lo muestran otras apps

| App | Cómo muestra la plantilla | Qué tomamos |
|---|---|---|
| Canva (visto en el navegador por la investigación del 29/10; a WebFetch le da 403) | La tarjeta **es** el diseño terminado, con contenido real, y cada plantilla es de un nicho. | La miniatura de Offer muestra la oferta del ejemplo (nombre, frase, precio, garantía y escasez), no un marco vacío. |
| Notion | «View template» abre la página completa y llena antes de duplicarla. | Al abrir la plantilla, el centro muestra el ejemplo entero (sección 3.5). |
| PandaDoc, «Business Coaching Template»: https://www.pandadoc.com/business-coaching-template/ · Proposify: https://www.proposify.com/proposal-templates | La propuesta viene completa, con una tabla de honorarios llena; la galería se ordena por rubro. | La plantilla trae todas las secciones con datos, también la inversión. En el código, las plantillas se agrupan por lo que vende el negocio. |
| Paquetes de prompts y GPTs pagos de «ofertas irresistibles» (por ejemplo https://payhip.com/b/oaYu3) | Un formulario o una lista de prompts, sin un ejemplo a la vista antes de pagar. | Lo que **no** hay que hacer: es otra vez el rectángulo con un nombre. |

### 1.3 Qué copiamos de la forma de mostrar

1. **La tarjeta es la oferta del ejemplo:** una hoja dibujada con texto real. Lleva el negocio, el nombre de la oferta, la frase y tres datos (precio, garantía y escasez). Arriba, la cinta «Ejemplo». No hace falta ninguna imagen (2.0).
2. **Al abrirla, el ejemplo completo queda en el centro** con el rótulo «Ejemplo: <negocio> (negocio ficticio)». La oferta del dueño se arma encima a medida que contesta (3.5).
3. **Cada ejemplo dice qué palanca mueve.** Es una línea («Lo que mueve: la probabilidad») que sale del formato antes → después de marketingskills.
4. **Una plantilla para revisar la oferta que ya tienes** (la 8). Muestra el antes, el diagnóstico con la rúbrica del marco y el después.

---

## 2. Las plantillas

### 2.0 Lo común a las 9

**Qué es una plantilla de Offer:** una **forma** de oferta (qué tipo de garantía, de urgencia y de pago le quedan, y qué piezas pesan) más **un ejemplo completo** de un negocio del elenco. El ejemplo tiene la misma forma que `PropuestaOferta` (`lib/offer-marco.ts`): son las 20 secciones del marco (§5) y es lo que dibujan el PDF y la pantalla.

**Cómo se ve la miniatura** (no usa imágenes y nunca se desfasa del ejemplo):
- Una caja de 4:3 (la de `NuevaCrear`). Adentro va una hoja vertical de 3:4 con fondo `--surface` y borde fino.
- Arriba a la izquierda, la insignia (`Programa · alto ticket`). Arriba a la derecha, la cinta «Ejemplo».
- **Línea 1:** el negocio y el nicho, en versalitas de 9.5 px (`CIERRE CONSULTIVO · COACH DE VENTAS`).
- **Título:** el nombre de la oferta en 13 px negrita, 2 líneas como máximo.
- **Texto:** la frase de la oferta en 10.5 px, cortada a 3 líneas.
- **Abajo, 3 chips:** precio · garantía · escasez.
- Por debajo de la tarjeta, como hoy, el nombre de la plantilla.
- **En el teléfono (140 px):** se ve solo el título y los chips.

**Imágenes y clips:** ninguno. La miniatura es texto que dibuja la tarjeta, así que no hay licencias de stock ni personas reales junto a una promesa.

**Grupos de la grilla** (en este orden):
1. «Tus funnels»: las de hoy, crear y analizar por funnel.
2. «Programas y mentorías»: 1, 2, 5 y 7.
3. «Servicios»: 3.
4. «Entrada y continuidad»: 4 y 9.
5. «Inmobiliaria»: 6.
6. «Revisar tu oferta»: 8.

**El elenco** es el del [README](README.md) (sección 2.2). Esta tab encontró **cuatro datos** que rompían el marco (trampa 4); el README ya los trae corregidos, y estos son los cambios:

| Negocio | Antes | Ahora |
|---|---|---|
| Cierre Consultivo | Programa de 8 semanas | 90 días: 8 semanas en vivo y 5 de práctica revisada |
| Cierre Consultivo | 3 pagos de USD 550 | USD 1,500 de contado, o 2 pagos de USD 800 (hoy y a 30 días) |
| Consulta Rentable | 12 semanas, USD 997 (o 4 pagos de USD 275) | 90 días, USD 1,200 de contado, o 2 pagos de USD 650 |
| Voz de Líder | 10 semanas | 90 días: 10 semanas en vivo y 3 de práctica |

En los tres programas, las semanas suman 13 (91 días). «8 semanas en vivo y 4 de práctica» daba 84 días y pasaba la regla solo porque el texto empieza con «90 días» (trampa 5).

Pulso Dental (USD 1,200 al mes, 3 meses) y Torre Alameda quedan igual.

**Precios:** se escriben como en México (`USD 1,500`, `MXN 2,400,000`). En las piezas del ejemplo van **completos y con moneda**, porque `precioDe` y `nivelDeOferta` leen de ahí el nivel (trampa 6).

---

### Plantilla 1 · «Programa con garantía de aplicación»

- **Negocio:** Cierre Consultivo, de Andrea Salcedo (CDMX). Coach de ventas para coaches.
- **Cuándo usarla:** vendes un programa en grupo en el que tu cliente aprende y aplica una habilidad con tu revisión, y ya tienes casos.
- **La forma:**
  - **Quién hace el trabajo:** juntos (el cliente aplica, el negocio revisa).
  - **Garantía:** condicional a aplicar el método.
  - **Urgencia:** una cohorte con fecha y cupos según cuántos puede revisar el negocio.
  - **Pago:** de contado, o 2 pagos.
  - **Lo que mueve:** la probabilidad.
- **Miniatura:**
  - Insignia: `Programa · alto ticket`.
  - `CIERRE CONSULTIVO · COACH DE VENTAS` / **Cierre Consultivo: 90 días** / «Ayudo a coaches que venden programas por llamada a cerrar 4 de cada 10 llamadas calificadas en 90 días…»
  - Chips: `USD 1,500` · `Garantía de aplicación` · `15 lugares`.
- **Preguntas, en orden** (de a una; se saltan las que ya están):
  1. resultado: «¿Con qué número se nota que tu cliente ya aplica lo que le enseñas, y en cuánto tiempo?»
  2. prueba: «¿Cuántos de tus clientes llegaron a ese número, y cuánto tenían antes?»
  3. mecanismo: «¿Qué pasos sigue tu cliente, en orden, desde la primera semana?»
  4. costo: «¿Cuánto tiempo te lleva revisar a cada cliente, y cuántos puedes revisar a la vez?»
  5. garantia: «¿Qué tiene que hacer tu cliente sí o sí para lograrlo?»
  6. urgencia: «¿Tienes una fecha de inicio o un número de lugares por grupo?»

**El ejemplo completo**

1. **Nombre:** Cierre Consultivo: 90 días.
2. **Frase:** Ayudo a coaches que venden programas por llamada a cerrar 4 de cada 10 llamadas calificadas en 90 días con una llamada de diagnóstico de 6 preguntas, sin presionar ni bajar su precio.
3. **Mensajes:**
   - Corto: «Llamadas que cierran sin presionar».
   - Largo: «Si haces llamadas de venta y escuchas "lo voy a pensar", el problema casi nunca es tu precio: es el orden de la llamada. En 90 días aprendes a llevar una llamada de diagnóstico de 6 preguntas, la practicas con tus llamadas reales y Andrea revisa cada una.»
   - De entrada: «Te digo en qué minuto se cae tu venta.»
4. **Para quién:**
   - Perfil: coaches y consultores que venden un programa de USD 500 a 3,000 por llamada y hacen al menos 4 llamadas de venta por semana.
   - Mínimo: ya tienen clientes que les pagaron y graban sus llamadas con permiso de la persona.
   - No es para: quien todavía no vende por llamada o busca frases para presionar.
5. **Problema y destino:**
   - Hoy: explican su programa 20 minutos, escuchan «me encanta» y terminan con «déjame consultarlo». Cierran 1 o 2 de cada 10 y bajan el precio para no perder la venta.
   - Después: llevan la llamada con preguntas, la persona dice cuánto le cuesta seguir igual antes de oír el precio, y cierran 4 de cada 10 sin descuento.
   - Obstáculos: presentan antes de diagnosticar · no saben qué contestar a «lo voy a pensar» · no escuchan sus llamadas · dan el precio sin atarlo al problema.
   - Ya probó: cursos grabados de cierre y guiones de objeciones que suenan a vendedor.
6. **Método:**
   - Nombres: «Llamada de diagnóstico en 6 preguntas (propuesta)» · «Cierre por diagnóstico (propuesta)».
   - Pasos:
     1. Preparar la llamada con un formulario de 4 preguntas.
     2. Abrir con el motivo: «¿por qué ahora?».
     3. Medir el costo de seguir igual.
     4. Mostrar el camino en 3 pasos, sin módulos.
     5. Dar el precio atado al problema y callar.
     6. Cerrar con una fecha de inicio.
   - Por qué es distinto: los cursos de cierre enseñan a contestar objeciones al final; aquí la objeción no aparece porque la persona dijo su problema y su costo antes del precio.
7. **Ruta:**

   | Fase | Objetivo | Hito |
   |---|---|---|
   | Semanas 1-2 · Ordenar la llamada | Usar el guion de 6 preguntas | Primera llamada grabada con el guion, en la semana 1 |
   | Semanas 3-5 · Precio y objeciones | Dar el precio atado al problema | 3 llamadas revisadas, con nota |
   | Semanas 6-8 · Seguimiento | Recuperar a los que dijeron «lo voy a pensar» | Seguimiento de 3 mensajes en marcha |
   | Semanas 9-13 · Práctica revisada | 6 llamadas revisadas | 4 de cada 10 en las llamadas calificadas |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | 8 sesiones en vivo, los martes a las 7 p. m. (CDMX) | Practicas el guion en grupo con llamadas reales. |
   | Revisión de 6 llamadas grabadas, con nota por minuto | Sabes en qué minuto se cae cada venta. |
   | El guion de 6 preguntas y las respuestas a 9 objeciones | No improvisas en la llamada. |
   | Práctica en parejas | Ensayas antes de la llamada real. |

9. **Formato:** 90 días: 8 semanas en vivo y 5 de práctica revisada. En grupo, 15 personas por cohorte. Lo hacen juntos: tú haces las llamadas y Andrea las revisa y corrige. Soporte en el grupo de la cohorte, de lunes a viernes, con respuesta en 24 horas hábiles.
10. **Prueba:** 52 personas en 4 cohortes desde 2025. 35 llegaron a 3 de cada 10 o más en 90 días, y la mediana pasó de 2 a 4 de cada 10. Son resultados de esas cohortes, no una promesa.
11. **Garantía · «Garantía de aplicación»:**
    - Condiciones: asistes a 7 de las 8 sesiones, aplicas el guion en al menos 6 llamadas y las mandas a revisar.
    - Plazo: 90 días desde el inicio.
    - Si no se cumple: si tu cierre no mejoró, te devolvemos el 100 % o pasas a la cohorte siguiente sin costo, lo que prefieras.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Revisión de 3 llamadas antes de empezar | «No sé si el problema es la llamada o los prospectos» | USD 150, el precio al que se vende suelta |
    | Plantilla de seguimiento en 3 mensajes | «Se me van los que dicen "lo voy a pensar"» | USD 97, el precio al que se vendió suelta |

13. **Inversión:**
    - Lo que vale suelto: USD 2,444 (8 sesiones a USD 200, 6 revisiones a USD 50, el guion como curso grabado de USD 297, y los dos bonos).
    - Lo que vale el resultado: con un programa de USD 1,000, dos ventas más al mes son USD 24,000 al año, 16 veces el precio.
    - Precio de lista: USD 1,600 en 2 pagos de USD 800, hoy y a 30 días. De contado, USD 1,500.
    - Cómo decirlo: «La inversión son 1,600 dólares en dos pagos de 800, hoy y en 30 días. Si lo pagas completo hoy, queda en 1,500.» Y después, silencio.
14. **Urgencia:** la cohorte arranca un lunes con 15 lugares, que es lo que Andrea puede revisar llamada por llamada. Las inscripciones cierran el jueves anterior o al llenarse. La fecha se calcula al mostrar el ejemplo (trampa 9).
15. **Escenarios:**
    - El mejor: cierras 4 de cada 10 y dejas de bajar tu precio.
    - El peor: aplicas el guion en 6 llamadas, no mejora, y recuperas tu dinero o repites la cohorte.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | «Vender mejor» | 4 de cada 10 llamadas calificadas en 90 días |
    | Probabilidad | Testimonios sin números | 35 de 52 con su antes y después, y la garantía de aplicación |
    | Tiempo | El primer cambio, en el mes 2 | La primera llamada con el guion, en la semana 1 |
    | Esfuerzo | 30 videos para estudiar | Un guion de 6 preguntas y la revisión de tus llamadas |

17. **Números:**
    - Margen bruto: 78 %. Cuesta USD 330 entregar el programa a cada persona.
    - Meta por cohorte: 15 ventas, unos USD 22,500. Es la cohorte llena: más no caben en la revisión de Andrea, y cada cohorte dura 90 días.
    - Llamadas calificadas necesarias: 38 por cohorte, con un cierre de 4 de cada 10.
    - % cobrado al firmar esperado: 75 %, si la mitad paga de contado.
    - Costo por cliente: USD 380, con lo que el LTV:CAC queda en 4 a 1.
18. **Cómo validarla:**
    - Meta: llenar la próxima cohorte (15 ventas).
    - Qué medir: el % cobrado al firmar y el cierre sobre llamadas calificadas.
    - Cuándo subir el precio: si 5 ventas seguidas pagan de contado sin pedir cuotas, a USD 1,800 en la cohorte siguiente.
19. **Siguiente escalón:** al terminar, el problema es tener más llamadas calificadas. Va un acompañamiento de 6 meses para sumar un setter (fase 2, solo anotado).
20. **Lo que propuso MaKo:**
    - Método: los dos nombres.
    - Inversión: el precio de lista en 2 pagos, con el contado como ahorro.

---

### Plantilla 2 · «Cohorte con resultado rápido»

- **Negocio:** Consulta Rentable, de la Dra. Mariana Ochoa (Guadalajara). Programa para nutriólogas.
- **Cuándo usarla:** un grupo con fecha de inicio y de fin en el que tu cliente hace el trabajo con tu guía, y quieres que vea un resultado en la primera semana.
- **La forma:**
  - **Quién hace el trabajo:** el cliente, con guía y revisión en grupo (la promesa nunca dice «lo hacemos por ti»).
  - **Garantía:** por escalón (un resultado temprano y verificable).
  - **Urgencia:** una cohorte con fecha.
  - **Pago:** de contado, o 2 pagos.
  - **Lo que mueve:** el tiempo.
- **Miniatura:**
  - Insignia: `Cohorte · alto ticket`.
  - `CONSULTA RENTABLE · NUTRIÓLOGAS` / **Consultorio Lleno en 90 días** / «Ayudo a nutriólogas que atienden en línea a llegar a 15 pacientes al mes…»
  - Chips: `USD 1,200` · `Garantía de la semana 4` · `20 lugares`.
- **Preguntas, en orden:**
  1. semana: «¿Qué puede lograr tu cliente en su primera semana?»
  2. resultado: «¿Con qué número se nota el resultado al final, y en cuánto tiempo?»
  3. prueba: «¿Cuánto tenían tus clientes al empezar y cuánto al terminar?»
  4. formato: «¿Cuántas sesiones hay, y qué hace tu cliente entre una y otra?»
  5. garantia: «¿Qué resultado temprano podrías asegurar si tu cliente hace lo que le pides?»
  6. urgencia: «¿Cuándo empieza el próximo grupo y cuántos lugares tiene?»

**El ejemplo completo**

1. **Nombre:** Consultorio Lleno en 90 días.
2. **Frase:** Ayudo a nutriólogas que atienden en línea a llegar a 15 pacientes al mes en 90 días con una valoración de 20 minutos que agenda, sin publicar todos los días.
3. **Mensajes:**
   - Corto: «Tu consulta, sin publicar a diario».
   - Largo: «Las nutriólogas con agenda llena no publican más: tienen un paso entre "me interesa" y "agendé". En 90 días armas tu plan de 3 meses, tu valoración de 20 minutos y tu mensaje de precio, con revisión semanal de tus mensajes reales.»
   - De entrada: «Clase gratuita: cómo pasar de un "¿precio?" a una cita con un mensaje de 5 líneas.»
4. **Para quién:**
   - Perfil: nutriólogas con cédula que atienden en línea y tienen menos de 10 pacientes al mes.
   - Mínimo: ya cobran consulta y tienen una lista de contactos o al menos 1,000 seguidores.
   - No es para: quien busca un plan de alimentación para sí misma o todavía no se titula.
5. **Problema y destino:**
   - Hoy: publican recetas, contestan «¿precio?» y no agendan. Cobran consultas sueltas de MXN 600 y no les alcanza.
   - Después: venden un plan de 3 meses, agendan desde una valoración de 20 minutos y llenan sus jueves.
   - Obstáculos: venden consultas sueltas · no hay un paso entre el interés y la cita · dicen el precio sin contexto · publicar les quita tiempo de atender.
   - Ya probó: publicar más, bajar la consulta a MXN 400 y pagar promociones sin un paso para agendar.
6. **Método:**
   - Nombres: «Valoración que agenda (propuesta)» · «Ruta de 3 claves (propuesta)».
   - Pasos:
     1. Armar el plan de 3 meses: resultado, tiempo y lo que no tiene que sacrificar.
     2. Abrir la valoración de 20 minutos.
     3. Mandar el mensaje del precio después de la valoración.
     4. Dar seguimiento en 48 horas a quien no agendó.
   - Por qué es distinto: lo que ya probaron suma seguidoras; esto arma el paso que convierte a quien ya escribió.
7. **Ruta:**

   | Fase | Objetivo | Hito |
   |---|---|---|
   | Semanas 1-3 · El plan de 3 meses | Tener la oferta publicada | La primera valoración hecha en la semana 1 |
   | Semanas 4-7 · La valoración | Hacer valoraciones con el guion | 10 valoraciones hechas |
   | Semanas 8-12 · Precio y seguimiento | Convertir valoraciones en pacientes | 15 pacientes en el mes, o el plan para llegar |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | 12 sesiones en grupo en vivo, los jueves a las 7 p. m. (CDMX) | Avanzas con un grupo que está en lo mismo. |
   | Revisión semanal de tus mensajes | Corriges el mensaje que no agenda. |
   | Plantillas del plan, de la valoración y del mensaje de precio | No escribes desde cero. |

9. **Formato:** 90 días, 12 sesiones semanales y una semana de cierre. En grupo, 20 nutriólogas por cohorte. Lo haces tú con nuestra guía: tú atiendes y escribes, nosotras revisamos. Dudas en el grupo, de lunes a viernes.
10. **Prueba:** 140 alumnas desde 2023. En las cohortes de 2026, la mediana pasó de 7 a 15 pacientes al mes. Lucía Garza, nutrióloga en Monterrey, pasó de 6 a 21 pacientes en la semana 9 y subió su consulta de MXN 600 a 900. Es el resultado de una alumna, no una promesa.
11. **Garantía · «Garantía de la semana 4»:**
    - Condiciones: asistes a las 4 primeras sesiones y haces 5 valoraciones con el guion.
    - Plazo: hasta el final de la semana 4.
    - Si no se cumple: si no agendaste ningún paciente nuevo, te devolvemos todo.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Revisión 1 a 1 de tu plan de 3 meses (30 min) | «No sé si mi plan sirve para mi ciudad» | USD 120, lo que cuesta su sesión 1 a 1 |

13. **Inversión:**
    - Lo que vale suelto: USD 1,560 (el programa en USD 1,200, las plantillas sueltas en USD 240 y el bono en USD 120).
    - Lo que vale el resultado: 8 pacientes más con un plan de MXN 2,400 al mes son MXN 230,400 al año.
    - Precio de lista: USD 1,300 en 2 pagos de USD 650, hoy y a 30 días. De contado, USD 1,200.
    - Cómo decirlo: «Son 1,300 dólares en dos pagos de 650. Si lo pagas hoy completo, queda en 1,200.»
14. **Urgencia:** la cohorte empieza un jueves con 20 lugares, porque más no caben en la revisión semanal de mensajes. La fecha se calcula al mostrar el ejemplo.
15. **Escenarios:**
    - El mejor: llenas tus jueves con pacientes de un plan de 3 meses.
    - El peor: haces 5 valoraciones en un mes, no agendas a nadie y recuperas tu dinero.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | «Más pacientes» | 15 pacientes al mes en 90 días |
    | Probabilidad | Sin casos | 140 alumnas, la mediana de 7 a 15, y el caso de Lucía |
    | Tiempo | Meses de publicar | La primera valoración en la semana 1 |
    | Esfuerzo | Publicar a diario | Una valoración y un mensaje de precio |

17. **Números:**
    - Margen bruto: 84 %. Cuesta USD 190 atender a cada alumna.
    - Meta por cohorte: 20 ventas, unos USD 25,000.
    - Embudo: 400 registros, 160 asisten a la clase y 20 compran, 1 de cada 8 asistentes.
    - % cobrado al firmar esperado: 80 %, si 6 de cada 10 pagan de contado.
18. **Cómo validarla:**
    - Meta: llenar los 20 lugares.
    - Qué medir: registro → asistencia a la clase → compra.
    - Cuándo subir el precio: si se llena antes de la fecha, la cohorte siguiente sube a USD 1,400.
19. **Siguiente escalón:** quien termina quiere sostener su agenda. Va un círculo mensual para egresadas (la plantilla 9).
20. **Lo que propuso MaKo:**
    - Garantía: la de la semana 4 en vez de una de 90 días.

---

### Plantilla 3 · «Servicio hecho por ti»

- **Negocio:** Pulso Dental, de Diego Ferrer (Bogotá). Agencia para clínicas dentales.
- **Cuándo usarla:** el negocio hace el trabajo por el cliente (agencia, implementación) y cobra por mes con un mínimo.
- **La forma:**
  - **Quién hace el trabajo:** el negocio.
  - **Garantía:** por entregable («si en el mes 2 no hay X, el mes 3 no se cobra»).
  - **Urgencia:** por capacidad (clientes nuevos por mes) y uno por especialidad en cada zona.
  - **Pago:** mensual con mínimo, o el trimestre adelantado con un ahorro.
  - **Bono típico:** el costo de alta sin cargo.
  - **Lo que mueve:** el esfuerzo y la probabilidad.
- **Miniatura:**
  - Insignia: `Servicio · mensual`.
  - `PULSO DENTAL · CLÍNICAS DENTALES` / **Agenda de Implantes en 90 días** / «Ayudo a clínicas dentales a llenar su agenda de valoraciones de implantes…»
  - Chips: `USD 1,200 al mes` · `Garantía: 15 valoraciones` · `2 clínicas por mes`.
- **Preguntas, en orden:**
  1. entregables: «¿Qué haces tú exactamente cada mes y qué tiene que hacer tu cliente?»
  2. resultado: «¿Qué número le importa a tu cliente (citas, ventas, pacientes) y cuánto tarda en moverse?»
  3. prueba: «¿Qué cliente tuyo movió ese número, y de cuánto a cuánto?»
  4. costo: «¿Cuánto te cuesta atender a un cliente al mes, y cuántos puedes tomar?»
  5. garantia: «¿Qué mínimo podrías asegurar en el segundo mes si tu cliente cumple su parte?»
  6. cobro: «¿Cómo te pagan hoy: por mes, por adelantado, con contrato?»

**El ejemplo completo**

1. **Nombre:** Agenda de Implantes en 90 días.
2. **Frase:** Ayudo a clínicas dentales a llenar su agenda de valoraciones de implantes en 90 días con anuncios del tratamiento y respuesta en menos de 5 minutos, sin que su recepción deje de atender.
3. **Mensajes:**
   - Corto: «Valoraciones de implantes, no likes».
   - Largo: «Si tus anuncios traen mensajes pero no pacientes de implantes, el problema está después del anuncio. Hacemos los anuncios del tratamiento, contestamos cada mensaje en menos de 5 minutos con tu rango de precios y te entregamos valoraciones agendadas.»
   - De entrada: «Auditoría gratis de 30 minutos: revisamos tus anuncios y tus últimos 20 mensajes.»
4. **Para quién:**
   - Perfil: clínicas dentales con 2 sillones o más, que hacen implantes o tratamientos de más de USD 1,000 y ya invierten en anuncios.
   - Mínimo: pueden invertir USD 1,500 al mes en anuncios, aparte del servicio, y tienen agenda para valoraciones.
   - No es para: clínicas que solo hacen limpiezas o buscan seguidores.
5. **Problema y destino:**
   - Hoy: entran de 80 a 100 mensajes al mes y se contestan 3 horas después. La mitad pregunta «¿precio?» y desaparece, y 1 de cada 3 agendados no llega.
   - Después: cada mensaje se contesta en menos de 5 minutos, el paciente llega sabiendo el rango de precio y la agenda de valoraciones se llena.
   - Obstáculos: anuncios de limpiezas que no traen implantes · respuesta lenta · el precio se dice sin contexto o nunca · inasistencias.
   - Ya probó: dos o tres agencias que entregaban seguidores y reportes de alcance.
6. **Método:**
   - Nombres: «Método 5-5-1: 5 minutos, 5 preguntas, 1 cita (propuesta)» · «Del anuncio a la valoración (propuesta)».
   - Pasos:
     1. Anunciar el tratamiento, no la clínica.
     2. Contestar en menos de 5 minutos, con guion.
     3. Hacer 5 preguntas de filtro antes de agendar.
     4. Decir el rango de precio antes de la cita.
     5. Mandar recordatorios 24 horas y 2 horas antes.
   - Por qué es distinto: las agencias anteriores medían alcance. Aquí se miden valoraciones agendadas y asistidas, porque la venta se pierde después del anuncio.
7. **Ruta:**

   | Fase | Objetivo | Hito |
   |---|---|---|
   | Mes 1 · Arranque | Anuncios y guion de respuesta funcionando, y los mensajes sin contestar recuperados | Las primeras valoraciones agendadas en la semana 1 |
   | Mes 2 · Volumen | Llegar al volumen | 15 valoraciones agendadas en el mes |
   | Mes 3 · Asistencia y cierre | Que lleguen y compren | Inasistencias por debajo del 20 % y reporte de tratamientos cerrados |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | Anuncios del tratamiento en Meta, hechos y manejados por nosotros | No pagas por seguidores. |
   | Respuesta en menos de 5 minutos, de lunes a sábado de 8 a. m. a 8 p. m. | Ningún mensaje se enfría. |
   | Guion de 5 preguntas y rango de precio | Llegan pacientes que pueden pagar. |
   | Reporte cada lunes: mensajes, valoraciones agendadas y asistidas | Sabes qué compra tu inversión. |

9. **Formato:** contrato de 3 meses. Lo hacemos por ti: anuncios, respuestas y agenda; tu equipo solo atiende la valoración. Reporte cada lunes y llamada de 30 minutos cada dos semanas.
10. **Prueba:** 31 clínicas atendidas desde 2022, en Colombia y México. Clínica Dental Altamira (Medellín, Dr. Felipe Cárdenas) pasó de 6 a 23 valoraciones al mes en el mes 3, con la misma inversión, y cerró 9 tratamientos. Es el resultado de una clínica en particular.
11. **Garantía · «Garantía de 15 valoraciones»:**
    - Condiciones: inviertes al menos USD 1,500 al mes en anuncios, tu equipo atiende las valoraciones agendadas y nos das acceso a la agenda.
    - Plazo: el cierre del mes 2.
    - Si no se cumple: si en el mes 2 no hay 15 valoraciones agendadas, el mes 3 no se cobra.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Alta sin costo: anuncios, guiones y conexión con tu agenda | «Arrancar con otra agencia es un mes perdido» | USD 800, lo que se cobra el alta por separado |
    | Recuperación de los mensajes de los últimos 90 días | «Ya perdí a muchos que escribieron» | USD 300, el precio de la recuperación suelta |

13. **Inversión:**
    - Lo que vale suelto: USD 4,700 (3 meses de servicio, el alta y la recuperación).
    - Precio de lista: USD 1,200 al mes más tu inversión en anuncios, con un mínimo de 3 meses.
    - De contado: USD 3,300 por los 3 meses, pagados al firmar.
    - Plan: USD 1,200 al firmar y el mismo día de cada mes.
    - Cómo decirlo: «Son 1,200 dólares al mes por 3 meses, más lo que inviertes en anuncios. Si pagas los 3 meses hoy, quedan en 3,300.»
14. **Urgencia:** tomamos 2 clínicas nuevas por mes y una sola por especialidad en cada zona, para no competir con nuestros propios clientes. El número de lugares del mes sale de la capacidad real.
15. **Escenarios:**
    - El mejor: tu agenda de implantes se llena con la misma inversión en anuncios.
    - El peor: si en el mes 2 no hay 15 valoraciones, el mes 3 no lo pagas.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | «Más pacientes» | Valoraciones de implantes agendadas cada semana |
    | Probabilidad | Agencias que no funcionaron | El caso Altamira y la garantía de 15 valoraciones |
    | Tiempo | Resultados «en 6 meses» | Las primeras valoraciones en la semana 1 |
    | Esfuerzo | La recepción contesta todo | Lo contestamos por ti |

17. **Números:**
    - Margen bruto: 70 %. Cuesta USD 360 al mes atender a cada clínica, entre quien contesta y quien maneja los anuncios.
    - Meta: 12 clínicas activas, USD 14,400 al mes.
    - Llamadas: 6 auditorías para cerrar 2 clínicas, 1 de cada 3.
    - % cobrado al firmar: 33 % en el plan mensual y 92 % si pagan el trimestre.
18. **Cómo validarla:**
    - Meta: 2 clínicas por mes durante 3 meses.
    - Qué medir: valoraciones agendadas y asistidas por clínica.
    - Cuándo subir el precio: si 3 clínicas seguidas pagan el trimestre, el mensual pasa a USD 1,400.
19. **Siguiente escalón:** en el mes 3, la clínica quiere cerrar más tratamientos de sus valoraciones. Va un entrenamiento de cierre para su recepción (fase 2).
20. **Lo que propuso MaKo:**
    - Garantía: el umbral de 15 valoraciones.
    - Urgencia: una clínica por especialidad en cada zona.

---

### Plantilla 4 · «Entrada que se acredita»

- **Negocio:** Cierre Consultivo.
- **Cuándo usarla:** tu oferta principal ya vende y quieres una entrada barata para que el prospecto pruebe tu método. Lo que paga se descuenta si sube. Es la fase 2 del marco (§9.6): **no antes** de que la principal esté validada.
- **La forma:**
  - **Nivel:** ticket bajo (lo calcula `nivelDeOferta`).
  - **Quién hace el trabajo:** el negocio (un diagnóstico).
  - **Garantía:** sin preguntas, que en ticket bajo sí vale (marco §7.1).
  - **Urgencia:** el crédito vence.
  - **Pago:** un solo pago.
  - **Lo que mueve:** la probabilidad y el tiempo.
- **Miniatura:**
  - Insignia: `Entrada · ticket bajo`.
  - `CIERRE CONSULTIVO · COACH DE VENTAS` / **Revisión de 3 llamadas** / «Reviso 3 de tus llamadas de venta grabadas y en 5 días hábiles te digo…»
  - Chips: `USD 150` · `Se acredita al programa` · `Entrega en 5 días`.
- **Preguntas, en orden:**
  1. escalera: «¿Qué vendes después de esta entrada, y a qué precio?»
  2. entregables: «¿Qué recibe tu cliente en la entrada, y en cuántos días?»
  3. ventas: «De cada 10 que compran la entrada, ¿cuántos pasan a la oferta principal?»
  4. precio: «¿Cuánto cobras por la entrada, y se descuenta si sube?»
  5. urgencia: «¿Hasta cuándo vale el descuento para subir?»

**El ejemplo completo**

1. **Nombre:** Revisión de 3 llamadas.
2. **Frase:** Reviso 3 de tus llamadas de venta grabadas y en 5 días hábiles te digo en qué minuto se cae cada venta y qué decir ahí, sin que cambies tu programa ni tu precio.
3. **Mensajes:**
   - Corto: «¿En qué minuto se cae tu venta?».
   - Largo: «Mándame 3 llamadas grabadas. En 5 días hábiles recibes un video por llamada con el minuto exacto donde se perdió la venta y la frase que lo arregla. Si después entras al programa, los USD 150 se descuentan.»
   - De entrada: «Te digo en qué minuto se cae tu venta.»
4. **Para quién:**
   - Perfil: coaches que hacen llamadas de venta y las graban con permiso de la persona.
   - Mínimo: tienen 3 llamadas grabadas de este mes.
   - No es para: quien todavía no hace llamadas.
5. **Problema y destino:**
   - Hoy: no saben si pierden ventas por la llamada o por los prospectos.
   - Después: saben en qué minuto se cae y qué frase usar.
   - Obstáculos: no escuchan sus llamadas · no saben qué buscar.
   - Ya probó: pedirle opinión a colegas que no revisan con método.
6. **Método:**
   - Nombre: «Revisión por minuto (propuesta)».
   - Pasos:
     1. Subes 3 llamadas.
     2. Andrea marca el minuto donde se cae cada una.
     3. Recibes un video de 10 minutos por llamada, con la frase que lo arregla.
   - Por qué es distinto: no es una opinión general; cada corrección tiene su minuto y su frase.
7. **Ruta:**

   | Fase | Hito |
   |---|---|
   | Día 1 · Subes tus llamadas | 3 llamadas recibidas |
   | Días 2 a 5 · Revisión | 3 videos entregados |
   | Día 6 · Llamada opcional de 20 minutos | Decides si entras al programa |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | 3 videos de revisión, uno por llamada | Ves el error con tu propia voz. |
   | Lista de 5 frases para tu próxima llamada | La usas mañana. |

9. **Formato:** lo hace Andrea; tú solo subes las llamadas. Entrega en 5 días hábiles.
10. **Prueba:** más de 80 revisiones desde mediados de 2025, cuando el programa ya llevaba dos cohortes. 1 de cada 5 personas entró después al programa (16 de las 52 alumnas).
11. **Garantía · «Garantía sin preguntas»:**
    - Condiciones: ninguna.
    - Plazo: 7 días desde la entrega.
    - Si no se cumple: si la revisión no te sirvió, te devolvemos los USD 150.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Crédito de USD 150 al programa | «No quiero pagar dos veces» | USD 150 |

13. **Inversión:**
    - Precio: USD 150 en un solo pago, sin cuotas.
    - Cómo decirlo: «Son 150 dólares. Si en los 14 días siguientes entras al programa, se descuentan completos.»
14. **Urgencia:** el crédito al programa vale 14 días desde la entrega.
15. **Escenarios:**
    - El mejor: sabes qué cambiar en tu próxima llamada y, si entras, la revisión te salió gratis.
    - El peor: no te sirvió y recuperas los USD 150.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | «Saber qué falla» | El minuto exacto y la frase |
    | Probabilidad | Opiniones sueltas | Revisión con método y devolución |
    | Tiempo | Semanas | 5 días hábiles |
    | Esfuerzo | Escuchar tus propias llamadas | Solo subirlas |

17. **Números:**
    - Margen bruto: 67 %. Cuesta USD 50 hacer cada revisión, una hora.
    - Con 1 de cada 5 que entra al programa, cada revisión trae USD 300 de venta del programa.
18. **Cómo validarla:**
    - Meta: 20 revisiones al mes.
    - Qué medir: cuántos entran al programa en 14 días.
    - Si entra menos de 1 de cada 5: revisar la llamada de 20 minutos, no el precio.
19. **Siguiente escalón:** el programa «Cierre Consultivo: 90 días» (plantilla 1).
20. **Lo que propuso MaKo:**
    - Urgencia: los 14 días del crédito.

---

### Plantilla 5 · «Precio por tramos»

- **Negocio:** Voz de Líder, de Rodrigo Ibarra (Lima). Oratoria para gerentes.
- **Cuándo usarla:** el mismo programa lo compran personas y empresas, o hay clientes que piden más cercanía. Son **tramos del mismo programa**, no tres programas distintos (marco §6.3, «ancla premium», y D9, foco). Si nadie te pide factura ni más cercanía, va un solo precio.
- **La forma:**
  - **Quién hace el trabajo:** juntos, en grupo.
  - **Garantía:** condicional, con extensión 1 a 1.
  - **Urgencia:** una cohorte de 12.
  - **Pago:** el individual en 2 pagos o de contado; el de equipo, con factura.
  - **Precio:** un tramo premium que existe de verdad.
  - **Lo que mueve:** la probabilidad; además, el tramo de equipo baja el esfuerzo de la decisión cuando la empresa paga.
- **Miniatura:**
  - Insignia: `Tramos · alto ticket`.
  - `VOZ DE LÍDER · GERENTES` / **Voz de Líder: 90 días** / «Ayudo a gerentes que presentan ante su directorio a hablar 10 minutos sin leer…»
  - Chips: `USD 2,000` · `Equipo de 5: USD 8,500` · `12 lugares`.
- **Preguntas, en orden:**
  1. cliente: «¿Quién paga hoy: la persona o su empresa?»
  2. precio: «¿Cuánto cobras por persona, y alguien te pidió factura o un precio por grupo?»
  3. formato: «¿Qué cambia si lo das a un equipo o dentro de una empresa?»
  4. costo: «¿Cuánto te cuesta atender a una persona y a un equipo?»
  5. garantia: «¿Qué tiene que hacer tu cliente sí o sí para lograrlo?»
  6. urgencia: «¿Cuántos lugares tiene cada grupo, y por qué ese número?»

**El ejemplo completo**

1. **Nombre:** Voz de Líder: 90 días.
2. **Frase:** Ayudo a gerentes que presentan ante su directorio a hablar 10 minutos sin leer y sin que los interrumpan en 90 días, con práctica semanal en vivo y simulacros grabados, sin clases de teoría.
3. **Mensajes:**
   - Corto: «Presenta sin leer y sin que te corten».
   - Largo: «Sabes qué decir hasta que te toca el directorio. En 90 días preparas tu apertura, ensayas cada semana en vivo y haces 3 simulacros grabados con preguntas difíciles, en un grupo de 12 gerentes.»
   - De entrada: «Taller gratuito: los primeros 20 segundos de tu presentación.»
4. **Para quién:**
   - Perfil: gerentes y jefes de área que presentan resultados ante un directorio o un comité al menos una vez al mes.
   - Mínimo: tienen una presentación real en los próximos 90 días.
   - No es para: quien busca dar conferencias o hablar en eventos.
5. **Problema y destino:**
   - Hoy: leen las diapositivas, los interrumpen en el minuto 2 y salen sin la aprobación que fueron a pedir.
   - Después: abren con la decisión que piden, sostienen 10 minutos y contestan preguntas difíciles sin perder el hilo.
   - Obstáculos: no preparan los primeros 20 segundos · ensayan solos y en silencio · no saben contestar una objeción en público.
   - Ya probó: cursos de oratoria con teoría y talleres de un día sin práctica.
6. **Método:**
   - Nombres: «Apertura de 20 segundos (propuesta)» · «Ensayo con directorio simulado (propuesta)».
   - Pasos:
     1. Escribir la apertura: la decisión que pides, en una frase.
     2. Ensayar en vivo cada martes, con correcciones.
     3. Hacer un simulacro grabado con 3 preguntas difíciles.
     4. Dar la presentación real y revisarla.
   - Por qué es distinto: los cursos de oratoria enseñan técnica; aquí se ensaya la presentación real que tienes este trimestre.
7. **Ruta:**

   | Fase | Hito |
   |---|---|
   | Semanas 1-3 · La apertura | Apertura de 20 segundos grabada en la semana 1 |
   | Semanas 4-7 · Los 10 minutos | La presentación completa, cronometrada |
   | Semanas 8-10 · Las preguntas difíciles | 3 simulacros grabados |
   | Semanas 11-13 · La presentación real | Presentas ante tu directorio y la revisamos |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | 10 sesiones en vivo, los martes a las 7 p. m. (Lima) | Ensayas frente a otros gerentes. |
   | 3 simulacros grabados con preguntas difíciles | Te preparas para que te interrumpan. |
   | Revisión de tu presentación real | Sabes qué ajustar para la siguiente. |

9. **Formato:** 90 días: 10 semanas en vivo y 3 de práctica con tu presentación real. En grupo, 12 personas por cohorte. Lo hacemos juntos.
10. **Prueba:** 8 cohortes desde 2024, con 86 gerentes. Carla presentó el presupuesto anual sin que la interrumpieran, y Gabriel consiguió que le aprobaran su proyecto en el primer comité. Son casos de alumnos, no una promesa.
11. **Garantía · «Garantía del simulacro»:**
    - Condiciones: asistes a 8 de las 10 sesiones y haces los 3 simulacros.
    - Plazo: hasta la semana 10.
    - Si no se cumple: si en el tercer simulacro no sostienes 10 minutos sin leer, Rodrigo te acompaña 1 a 1 sin costo hasta tu presentación real.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Revisión de tus diapositivas | «Mi problema también son las diapositivas» | USD 200, el precio de la revisión suelta |

13. **Inversión, en tramos:**

    | Tramo | Precio | Para quién |
    |---|---|---|
    | Individual | USD 2,100 en 2 pagos de USD 1,050, hoy y a 30 días. De contado, USD 2,000. | Paga la persona. |
    | Equipo de 5 | USD 8,500, con factura: 50 % al firmar y 50 % a 30 días. | Paga la empresa; es el mismo programa, con 5 lugares. |
    | En tu empresa | USD 18,000, hasta 12 personas, con las sesiones en sus oficinas. | El tramo premium. Existe de verdad y se vende a quien lo pide. |

    - Lo que vale suelto: USD 2,600 por persona (el programa, 2 simulacros extra a USD 200 y la revisión de diapositivas).
    - Cómo decirlo: «Primero el individual. Si te dicen que paga la empresa, ofreces el de equipo. El de "en tu empresa" se nombra solo si te piden algo para todo el directorio.»
14. **Urgencia:** la cohorte arranca un martes con 12 lugares, el máximo para que cada gerente ensaye en todas las sesiones. La fecha se calcula al mostrar el ejemplo.
15. **Escenarios:**
    - El mejor: presentas ante tu directorio sin leer y consigues la aprobación que fuiste a pedir.
    - El peor: si no lo logras en el simulacro, Rodrigo te acompaña 1 a 1 hasta tu presentación.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | «Hablar mejor» | 10 minutos sin leer ante tu directorio |
    | Probabilidad | Teoría | 86 gerentes, simulacros y la garantía |
    | Tiempo | Años de práctica | La apertura grabada en la semana 1 |
    | Esfuerzo | Ensayar solo | Ensayo guiado cada martes |

17. **Números:**
    - Margen bruto: 75 % en el individual y 70 % en el de equipo. Cuesta USD 500 atender a cada persona: USD 2,500 por un equipo que paga USD 8,500.
    - Meta por cohorte: llenar los 12 lugares. Son USD 24,000 con 12 individuales, o USD 22,500 con un equipo y 7 individuales: el equipo cobra menos por lugar, y lo compensa que paga la empresa, con factura, en una sola venta.
    - % cobrado al firmar esperado: 70 % en el individual; 50 % en el de equipo.
18. **Cómo validarla:**
    - Meta: llenar la próxima cohorte.
    - Qué medir: cuántas ventas pagó una empresa.
    - Cuándo publicar el tramo de equipo: si 2 cohortes seguidas llegan con 2 equipos o más, va en la página.
19. **Siguiente escalón:** para quien ya presenta bien, una mentoría 1 a 1 para su primera presentación ante inversionistas o ante el consejo (fase 2).
20. **Lo que propuso MaKo:**
    - Inversión: el tramo de equipo y la versión en tu empresa.

---

### Plantilla 6 · «Preventa por etapas»

- **Negocio:** Torre Alameda (Querétaro), una preventa inmobiliaria. La desarrolladora no lleva nombre (trampa 19).
- **Cuándo usarla:** vendes un inmueble, o algo que se entrega en el futuro, con un precio que sube por etapa y pagos durante la obra.
- **La forma:**
  - **Tipo:** producto. Las reglas de programa del marco (de 90 a 180 días, garantía por acciones) **no aplican**; ver la trampa 8.
  - **Garantía:** por entregable (una penalización por retraso, escrita en el contrato).
  - **Urgencia:** el inventario real y el precio por etapa publicado.
  - **Pago:** apartado, enganche diferido y crédito o contado contra entrega.
  - **Lo que mueve:** la probabilidad y el esfuerzo.
- **Miniatura:**
  - Insignia: `Preventa · inmobiliaria`.
  - `TORRE ALAMEDA · QUERÉTARO` / **Torre Alameda, etapa 2** / «Ayudo a familias que rentan en Querétaro a comprar un departamento de 2 recámaras…»
  - Chips: `Desde MXN 2.4 M` · `Enganche en 18 meses` · `14 con vista al parque`.
- **Preguntas, en orden:**
  1. entregables: «¿Qué incluye cada unidad (metros, recámaras, cajones) y cuándo se entrega?»
  2. precio: «¿Cuánto cuesta en esta etapa y cuándo sube?»
  3. cobro: «¿Cómo se paga: apartado, enganche, crédito?»
  4. prueba: «¿Qué entregaste antes, y en la fecha del contrato?»
  5. garantia: «¿Qué dice el contrato si la obra se retrasa?»
  6. urgencia: «¿Cuántas unidades quedan de cada tipo?»

**El ejemplo completo**

1. **Nombre:** Torre Alameda, etapa 2.
2. **Frase:** Ayudo a familias que rentan en Querétaro a comprar un departamento de 2 recámaras desde MXN 2.4 millones, con entrega en diciembre de 2027 y el enganche en 18 mensualidades, sin pagar el precio de obra terminada.
3. **Mensajes:**
   - Corto: «Tu departamento, con el enganche en 18 meses».
   - Largo: «2 recámaras, 2 baños y 78 m² a 8 minutos de Constituyentes, desde MXN 2.4 millones. Pagas el 10 % de enganche en 18 meses mientras se construye, y la fecha de entrega está en el contrato.»
   - De entrada: «Recibe hoy por WhatsApp la lista de precios de la etapa 2.»
4. **Para quién:**
   - Perfil: familias que rentan en Querétaro, con ingresos para un crédito hipotecario, que quieren su primera vivienda.
   - Mínimo: pueden pagar MXN 12,222 al mes de enganche durante la obra.
   - No es para: quien busca rentar por noches (el reglamento del edificio no lo permite).
5. **Problema y destino:**
   - Hoy: pagan MXN 14,000 de renta, ven que los precios suben cada año y no logran juntar el enganche de una vez.
   - Después: pagan el enganche en mensualidades parecidas a su renta y en diciembre de 2027 reciben su departamento.
   - Obstáculos: juntar el enganche de golpe · el miedo a que la obra se retrase · no saber cuánto pagarían por mes.
   - Ya probó: buscar casas terminadas, que suben de precio más rápido de lo que alcanzan a ahorrar.
6. **Método:**
   - Nombre: «Enganche en mensualidades durante la obra (propuesta)».
   - Pasos:
     1. Apartado de MXN 20,000, que se devuelve si no se firma en 15 días.
     2. Firma del contrato, con fecha de entrega y penalización.
     3. Enganche en 18 mensualidades.
     4. Crédito o contado contra entrega.
   - Por qué es distinto: en una casa terminada pagas completo el precio de hoy; en preventa pagas el precio de la etapa y el enganche mientras se construye.
7. **Ruta:**

   | Fase | Objetivo | Hito |
   |---|---|---|
   | Apartado | Separar el departamento | Apartado hecho y precio de la etapa congelado |
   | Contrato | Firmar con fecha de entrega | Contrato firmado en 15 días |
   | Obra | Pagar el enganche | Visita de avance cada trimestre |
   | Entrega | Escriturar | Llaves en diciembre de 2027 |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | Departamento de 2 recámaras, 2 baños, 78 m² y un cajón | Hay espacio para una familia de 4. |
   | Alberca, gimnasio y roof garden | Tienes lo que no tienes rentando. |
   | Corrida financiera impresa con tu crédito | Sabes cuánto pagas por mes antes de firmar. |

9. **Formato:** la desarrolladora construye y entrega; tú pagas el enganche durante la obra. Hay visitas de avance cada trimestre y un reporte de obra al mes por WhatsApp.
10. **Prueba:** la etapa 1 (96 departamentos) se entregó en noviembre de 2025, en la fecha del contrato, y ahí viven 92 familias. La etapa 2 va en el 60 % de obra.
11. **Garantía · «Entrega con fecha en el contrato»:**
    - Condiciones: estás al corriente con tus mensualidades de enganche.
    - Plazo: diciembre de 2027.
    - Si no se cumple: por cada mes de retraso, la desarrolladora te paga el 0.5 % de lo que llevas pagado, como dice el contrato.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Un cajón de estacionamiento más, sin costo, para los primeros 10 contratos de la etapa 2 | «Somos dos autos» | MXN 180,000, el precio del cajón suelto |

13. **Inversión:**
    - Lo que incluye: el departamento en MXN 2,400,000 y el cajón extra de MXN 180,000 para los primeros 10 contratos.
    - Precio: desde MXN 2,400,000, el precio de la etapa 2.
    - De contado: MXN 2,280,000 (un 5 % menos) si pagas el 100 % antes de la entrega.
    - Plan: apartado de MXN 20,000, el resto del 10 % de enganche en 18 mensualidades de MXN 12,222, y crédito o contado contra entrega.
    - Crédito estimado al recibir: MXN 18,900 al mes por MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %. Depende del banco y se dice así, como estimado. Con una renta típica de MXN 14,000, la mensualidad del crédito es más alta: nunca se dice «el mismo pago».
    - Cómo decirlo: «El precio de la etapa 2 es de 2.4 millones. Apartas con 20 mil, el resto del enganche son 18 mensualidades de 12,222 mientras se construye, y el saldo lo cubre tu crédito al recibir.»
14. **Urgencia:** quedan 46 de los 96 departamentos, y 14 de ellos tienen vista al parque. Al vender 80 de 96, el precio pasa al de la etapa 3, MXN 2,520,000, como dice la lista de precios publicada.
15. **Escenarios:**
    - El mejor: recibes tu departamento en diciembre de 2027 con el precio de la etapa 2.
    - El peor: si la obra se retrasa, la desarrolladora te paga la penalización del contrato.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | Seguir rentando | Departamento propio en diciembre de 2027 |
    | Probabilidad | Miedo a una obra que no se termina | La etapa 1 entregada a tiempo y la penalización en el contrato |
    | Tiempo | Años juntando el enganche | Apartas esta semana |
    | Esfuerzo | Juntar MXN 240,000 de golpe | 18 mensualidades de MXN 12,222 |

17. **Números:**
    - Inventario: quedan 46 de 96, 14 de ellos con vista al parque.
    - Visitas necesarias: 4 por venta, porque cierra 1 de cada 4 visitas al departamento muestra.
    - Meta: 6 contratos al mes para vender la etapa antes de la entrega.
18. **Cómo validarla:**
    - Meta: 6 contratos al mes.
    - Qué medir: visitas al departamento muestra → apartados → contratos.
    - Si se pasa de 8 contratos 3 meses seguidos, adelantar la etapa 3.
19. **Siguiente escalón:** para quien ya compró, un segundo departamento en la etapa 3 con precio de cliente (fase 2, solo anotado).
20. **Lo que propuso MaKo:**
    - Bonos: el cajón extra para los primeros 10 contratos.

---

### Plantilla 7 · «Primera camada, sin casos»

- **Negocio:** Voz de Líder, en la versión con la que arrancó, **antes** de Gabriel y Carla. El rótulo lo dice: «Ejemplo: Voz de Líder en su lanzamiento (negocio ficticio)».
- **Cuándo usarla:** tu oferta es nueva y todavía no tienes casos con números.
- **La forma** (marco §7.1 sin casos, §9.3 primera camada):
  - **Quién hace el trabajo:** juntos, en un grupo chico.
  - **Garantía:** por acciones, con extensión.
  - **Prueba:** trayectoria y proceso, con el lugar del caso marcado `[completar]`.
  - **Precio:** una valuación y el precio de la camada, con una razón real.
  - **Urgencia:** una camada con cupo y una subida anunciada.
  - **Lo que mueve:** la probabilidad.
- **Miniatura:**
  - Insignia: `Lanzamiento · sin casos`.
  - `VOZ DE LÍDER · GERENTES` / **Voz de Líder: primera camada** / «Ayudo a gerentes que presentan ante su directorio a sostener 10 minutos sin leer…»
  - Chips: `USD 1,400 la camada` · `Garantía por asistencia` · `8 lugares`.
- **Preguntas, en orden:**
  1. ventas: «¿Alguien ya te pagó esta oferta? ¿Cuántos?»
  2. prueba: «¿Qué hiciste antes que muestre que sabes lograrlo: tu trabajo, tus resultados propios, gente a la que ayudaste?»
  3. resultado: «¿Qué resultado pequeño y seguro podría lograr alguien en tus primeras semanas?»
  4. costo: «¿A cuántos puedes acompañar de cerca en esta primera camada?»
  5. precio: «¿Cuánto cobrarías cuando tengas casos, y cuánto ahora?»
  6. garantia: «¿Qué tiene que hacer tu cliente sí o sí para lograrlo?»

**El ejemplo completo**

1. **Nombre:** Voz de Líder: primera camada.
2. **Frase:** Ayudo a gerentes que presentan ante su directorio a sostener 10 minutos sin leer en 90 días, con ensayo semanal en vivo y simulacros grabados, sin clases de teoría.
3. **Mensajes:**
   - Corto: «Presenta sin leer ante tu directorio».
   - Largo: «Abro la primera camada de Voz de Líder: 8 gerentes, 90 días, ensayo cada martes y 3 simulacros con preguntas difíciles. Entras con el precio de primera camada a cambio de grabar tu antes y tu después.»
   - De entrada: «Taller gratuito: los primeros 20 segundos de tu presentación.»
4. **Para quién:**
   - Perfil: gerentes que presentan resultados ante un directorio o un comité al menos una vez al mes.
   - Mínimo: tienen una presentación real en los próximos 90 días y aceptan grabar su antes y su después.
   - No es para: quien busca dar conferencias.
5. **Problema y destino:** como en la plantilla 5.
6. **Método:** como en la plantilla 5.
7. **Ruta:** como en la plantilla 5.
8. **Qué incluye:** como en la plantilla 5, más una sesión 1 a 1 de apertura para cada gerente.
9. **Formato:** 90 días: 10 semanas en vivo y 3 de práctica. En grupo, 8 personas en la primera camada.
10. **Prueba:** todavía no hay casos de este programa, porque es la primera camada. Rodrigo fue gerente comercial durante 12 años y preparó las presentaciones de su equipo ante el directorio. `[completar]` los resultados de esta camada, al terminar.
11. **Garantía · «Garantía de primera camada»:**
    - Condiciones: asistes a 8 de las 10 sesiones y haces los 3 simulacros.
    - Plazo: hasta tu presentación real, dentro de los 90 días.
    - Si no se cumple: si no sostienes 10 minutos sin leer, Rodrigo te acompaña 1 a 1 sin costo hasta lograrlo; y si aun así no lo logras, te devuelve el 100 %.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Sesión 1 a 1 para tu presentación real | «Mi caso es distinto» | USD 250, la tarifa de Rodrigo por sesión 1 a 1 |

13. **Inversión:**
    - Valuación del programa: USD 2,000.
    - Precio de la primera camada: USD 1,400 en 2 pagos de USD 700, hoy y a 30 días. De contado, USD 1,300.
    - Cómo decirlo: «El programa está valuado en 2,000 dólares. La primera camada entra con 1,400 porque todavía no tengo casos, y a cambio te pido grabar tu antes y tu después. Son 2 pagos de 700; de contado, 1,300.»
14. **Urgencia:** la primera camada tiene 8 lugares y arranca un martes. La segunda sale a USD 2,000, como ya está anunciado.
15. **Escenarios:**
    - El mejor: presentas sin leer y eres uno de los primeros casos del programa.
    - El peor: si no lo logras, sigues 1 a 1 sin costo o recuperas tu dinero.
16. **Ecuación de valor:** la palanca es la probabilidad. Antes no hay casos; después hay una garantía por acciones, 12 años de trayectoria y un grupo de 8. Las otras tres, como en la plantilla 5.
17. **Números:**
    - Margen bruto: 70 %. Cuesta USD 420 atender a cada persona, porque en la primera camada hay más tiempo 1 a 1.
    - Meta: 8 ventas, USD 11,200.
    - % cobrado al firmar esperado: 55 %.
18. **Cómo validarla:**
    - Meta: vender los 8 lugares.
    - Qué medir: cuántos sostienen 10 minutos en el tercer simulacro.
    - Cuándo subir el precio: con 5 casos con su antes y su después, la segunda camada sale a USD 2,000 (marco §6.2, de 3 a 5 ventas).
19. **Siguiente escalón:** la cohorte regular (plantilla 5).
20. **Lo que propuso MaKo:**
    - Inversión: el precio de la camada y la valuación.
    - Garantía: la extensión 1 a 1.
    - **Datos a completar:** los resultados de la primera camada.

> Es la única plantilla con `[completar]` **a propósito**: enseña cómo queda una oferta honesta sin casos. El PDF para el cliente (`seccionesExternas`) quita ese renglón solo; los chips de la miniatura no lo llevan.

---

### Plantilla 8 · «Revisar tu oferta: antes y después»

- **Negocio:** Pulso Dental, con la oferta que tenía antes de la plantilla 3.
- **Cuándo usarla:** ya vendes algo y no cierra como quieres. MaKo lo puntúa con la rúbrica del marco (§4) y te dice qué cambiar primero.
- **La forma:** el diagnóstico de 9 notas, el cuello de botella, 3 cambios como hipótesis y la versión pulida. **Lo que mueve:** la palanca que salga más baja.
- **Miniatura:**
  - Insignia: `Revisar · antes y después`.
  - En la hoja, un `49/100` grande, «Lo que más frena: la promesa» y las flechas `USD 600 al mes → USD 1,200 al mes`.
  - Chips: `9 notas` · `3 cambios` · `Antes y después`.
- **Al usarla:** se abre «Analizar» sobre la oferta principal del primer funnel. Si no hay ninguna, MaKo pide la oferta de hoy.
- **Preguntas, en orden** (las mínimas del marco §3, con dos que pesan aquí):
  1. «¿Qué vendes hoy, qué recibe el cliente y cuánto cuesta?»
  2. «De cada 10 llamadas, ¿cuántas cierras?»
  3. «¿Qué te dicen los que no compran?»
  4. «¿Cuántos clientes lograron el resultado, y con qué números?»

**El ejemplo completo**

**ANTES.** «Manejo de redes para clínicas: 12 publicaciones y 4 reels al mes, USD 600 al mes, sin contrato mínimo y sin garantía.» Cierra 1 de cada 8 llamadas, y 3 de cada 10 clientes se van en el mes 2.

**DIAGNÓSTICO** (lo calcula el código como en `CalculoDiagnostico`):

| Dimensión | Nota | Por qué |
|---|---|---|
| D1 Cliente ideal | 5 | Dice «clínicas dentales», sin especialidad ni tamaño, e incluye a las que solo hacen limpiezas. |
| D2 Problema y promesa | 3 | Vende el vehículo (las publicaciones), sin número ni plazo. |
| D3 Diferenciación | 4 | Suena a cualquier agencia de redes. |
| D4 Certeza | 4 | Hay 31 clínicas atendidas, pero sin números de pacientes y sin garantía. |
| D5 Esfuerzo y tiempo | 6 | Lo hace la agencia, pero el resultado no tiene plazo. |
| D6 Entrega sostenible | 7 | El paquete es fijo. |
| D7 Precio y cobro | 4 | Cobra por cantidad de publicaciones, por mes y sin mínimo. |
| D8 Razón para decidir hoy | 3 | No hay ninguna. |
| D9 Foco | 8 | Una oferta y un nicho. |

- **Puntaje:** 49/100, el promedio de las 9 notas.
- **El cuello de botella es D2.** Hay un empate en 3 con D8, y gana la que está más arriba.
- Como D2 saca 3 o menos, en la versión 1 **el precio y los bonos salen provisionales** (marco §4).
- **No está lista para salir a vender:** D2 y D4 están por debajo de 7.
- **La tesis:** «La oferta vende publicaciones; la clínica compra pacientes de implantes».
- **Lo más fuerte:** «31 clínicas atendidas y un paquete fijo que se entrega igual a todas».

**LOS 3 CAMBIOS** (son hipótesis para probar en el Dashboard):
1. Prometer valoraciones de implantes agendadas, con número y plazo (D2). Se espera que el cierre pase de 1 de cada 8 a 1 de cada 4 llamadas.
2. Una garantía por entregable: 15 valoraciones en el mes 2, o el mes 3 no se cobra (D4). Se espera que baje «ya probé agencias» como motivo de no compra.
3. Un contrato de 3 meses y 2 clínicas nuevas por mes, según la capacidad (D7 y D8). Se espera que las bajas en el mes 2 caigan por debajo de 1 de cada 10.

**DESPUÉS.**
- **Versión 1:** «Agenda de Implantes en 90 días», con el precio y los bonos provisionales.
- **Versión 2 (pulida):** ya con el umbral de la garantía, el precio y los bonos confirmados por el dueño. Es la plantilla 3 completa.

**Lo que se movió:** la promesa (de publicaciones a valoraciones) y, con ella, la probabilidad.

---

### Plantilla 9 · «Continuidad para egresados»

- **Negocio:** Consulta Rentable.
- **Cuándo usarla:** tu programa principal ya vende y tus egresados te piden seguir. Les vendes una membresía mensual con algo nuevo cada mes. Es fase 2: **solo si la oferta principal ya está validada**.
- **La forma:**
  - **Nivel:** ticket bajo y recurrente (lo calcula `nivelDeOferta`: USD 97 al mes queda por debajo del corte de USD 150).
  - **Quién hace el trabajo:** el cliente, con revisión en grupo.
  - **Garantía:** el primer mes sin riesgo.
  - **Urgencia:** precio de fundadoras para la primera generación.
  - **Pago:** mensual o anual.
  - **Lo que mueve:** el tiempo y el esfuerzo de sostener el resultado.
- **Miniatura:**
  - Insignia: `Continuidad · egresadas`.
  - `CONSULTA RENTABLE · NUTRIÓLOGAS` / **Círculo Consultorio Lleno** / «Ayudo a nutriólogas que terminaron el programa a sostener su agenda…»
  - Chips: `USD 97 al mes` · `Primer mes sin riesgo` · `Precio de fundadoras`.
- **Preguntas, en orden:**
  1. escalera: «¿Qué te piden tus clientes cuando terminan?»
  2. entregables: «¿Qué recibirían cada mes que no tengan ya?»
  3. precio: «¿Cuánto cobrarías por mes, y hay un precio anual?»
  4. urgencia: «¿El primer grupo tendría un precio que después sube?»

**El ejemplo completo**

1. **Nombre:** Círculo Consultorio Lleno.
2. **Frase:** Ayudo a nutriólogas que terminaron el programa a sostener 15 pacientes al mes con una revisión mensual de sus números y mensajes nuevos cada mes, sin volver a empezar.
3. **Mensajes:**
   - Corto: «Sostén tu agenda llena».
   - Largo: «Terminaste el programa y tu agenda se llenó. El Círculo te ayuda a sostenerla: cada mes revisamos tus números, recibes los mensajes del mes y hay una sesión de casos en vivo.»
   - De entrada: «Solo para egresadas: la primera sesión del Círculo es abierta.»
4. **Para quién:**
   - Perfil: egresadas del programa que ya tienen al menos 12 pacientes al mes.
   - Mínimo: terminaron el programa.
   - No es para: quien no hizo el programa, que va primero.
5. **Problema y destino:**
   - Hoy: al terminar, la agenda baja en 2 o 3 meses porque dejan de revisar sus mensajes y su seguimiento.
   - Después: la agenda se mantiene con una revisión al mes.
   - Obstáculos: sin revisión vuelven a publicar sin un paso para agendar · los mensajes se gastan.
   - Ya probó: repetir el programa completo.
6. **Método:**
   - Nombre: «Revisión mensual de números (propuesta)».
   - Pasos:
     1. Cargas tus números del mes.
     2. Sesión de casos en vivo.
     3. Recibes 4 mensajes nuevos para el mes.
7. **Ruta:**

   | Fase | Hito |
   |---|---|
   | Mes 1 · El tablero de tus números | Los números del mes cargados |
   | Cada mes · Revisión y mensajes | La agenda igual o mayor que el mes anterior |

8. **Qué incluye:**

   | Entregable | Para qué le sirve |
   |---|---|
   | Una sesión de casos en vivo al mes | Resuelves lo que te frena este mes. |
   | 4 mensajes nuevos al mes | No escribes desde cero. |
   | El tablero de tus números | Ves si la agenda baja antes de que pase. |

9. **Formato:** mensual y en grupo; cancelas cuando quieras. Lo haces tú, con revisión en grupo.
10. **Prueba:** es nueva: se abre para las 140 egresadas desde 2023. Lucía Garza fue la primera en pedirla.
11. **Garantía · «Garantía del primer mes»:**
    - Condiciones: ninguna.
    - Plazo: 30 días.
    - Si no se cumple: si el primer mes no te sirvió, te devolvemos los USD 97.
12. **Bonos:**

    | Bono | Objeción que contesta | Valor |
    |---|---|---|
    | Plantilla de seguimiento de pacientes | «Se me van los pacientes en el mes 2» | USD 47, el precio al que se vende suelta |

13. **Inversión:**
    - Precio: USD 97 al mes; cancelas cuando quieras.
    - Anual: USD 970, con dos meses sin costo.
    - Cómo decirlo: «Son 97 dólares al mes y cancelas cuando quieras. Si pagas el año, son 970: dos meses sin costo.»
14. **Urgencia:** el precio de fundadoras (USD 97) es para la primera generación; después sube a USD 127 al mes. Quien entra ahora lo conserva mientras siga.
15. **Escenarios:**
    - El mejor: tu agenda sigue llena 6 meses después de terminar.
    - El peor: pruebas un mes y recuperas los USD 97.
16. **Ecuación de valor:**

    | Palanca | Antes | Después |
    |---|---|---|
    | Resultado | Una agenda que se cae | Una agenda que se sostiene |
    | Tiempo | Repetir el programa de 90 días | Una sesión al mes |
    | Esfuerzo | Volver a empezar | Cargar tus números y usar los mensajes |

17. **Números:**
    - Margen bruto: 85 %.
    - Meta: 60 egresadas activas, USD 5,820 al mes.
    - Bajas esperadas: `[completar]`, porque todavía no hay datos.
18. **Cómo validarla:**
    - Meta: 30 egresadas en el primer mes.
    - Qué medir: las bajas al mes 3.
    - Si pasan del 10 % al mes: revisar qué se entrega antes que el precio.
19. **Siguiente escalón:** para quien ya tiene 25 pacientes al mes, una mentoría para sumar a otra nutrióloga a su consulta (fase 2).
20. **Lo que propuso MaKo:**
    - Urgencia: el precio de fundadoras.

---

## 3. El experto en ofertas

### 3.1 Lo que ya existe y lo que falta

**El agente ya existe.** Es el chat de Offer, con estos prompts:
- `offer.turno.system/user`: pregunta de a una y por hechos, y pide primero el documento.
- `offer.diagnostico.*`: la rúbrica de 9 dimensiones.
- `offer.propuesta.*`: las 20 secciones del marco.
- `lib/offer-reglas.ts`: una segunda capa que el texto editado no puede apagar.

**Lo que falta es la forma:**
- que la plantilla elegida cambie el orden de las preguntas;
- que diga qué garantía, urgencia y pago le quedan a ese tipo de oferta;
- que el ejemplo esté a la vista sin que sus datos se cuelen.

**Lo que se agrega:**
- una clave nueva, `offer.experto`, que **el código suma** al final del system del turno y del de la propuesta, solo cuando la conversación nació de una plantilla;
- el primer mensaje sin IA, con la forma;
- el ejemplo en el centro.

Es «un agente experto editable desde /configuraciones» sin abrir un segundo chat ni tocar los prompts que alguien ya editó (trampa 3).

### 3.2 El método (siete pasos)

0. **Contexto antes que nada.** Lo que ya sabe del negocio (perfil, funnel, producto, Archivero, documentos) se usa antes de preguntar. Ya existe: el slot `{{contexto}}` del turno.
1. **La forma.** La plantilla dice el tipo de oferta, quién hace el trabajo y qué garantía, urgencia y pago le quedan. **El nivel (bajo, medio o alto) lo calcula el código con el precio**, nunca el modelo (`nivelDeOferta`).
2. **Preguntas por hechos, de a una, en el orden de la forma.** Primero pide el documento o el link de la web (como hoy). Después recorre las preguntas de la plantilla (sección 2, «Preguntas, en orden»), salta lo sabido y sigue con la guía general del marco (§3).
3. **Lo que falta se construye** con hasta 4 opciones cerradas que salen de la forma y de lo que el dueño puede cumplir:
   - **garantía:** la que responde a su miedo más grande y que el negocio pueda pagar aunque la reclame 1 de cada 10;
   - **urgencia:** solo razones reales;
   - **bonos:** de 1 a 3, uno por objeción.
4. **El armado.** Primero el diagnóstico con la rúbrica, después la propuesta sección por sección, con la forma como guía y `[completar]` donde falte un dato.
5. **Pulir de a una palanca.** Con la ecuación de valor (subir resultado y probabilidad, bajar tiempo y esfuerzo), mueve la palanca más baja y dice cuál. Lo que espera de cada cambio es una hipótesis: entre 10 % y 40 %, y los cambios se multiplican.
6. **Nada inventado y nada del ejemplo.** El ejemplo enseña la forma; sus datos no existen. La segunda capa del código (`aplicarReglasPropuesta`, `cifrasConFuente`) sigue mandando.

### 3.3 El prompt base: `offer.experto`

Para registrar como prompt editable, siguiendo la skill `add-editable-prompt`. Va en `lib/offer-ia.ts` como `export const OFFER_EXPERTO_TEMPLATE`:

```text
LA FORMA QUE ELIGIÓ EL DUEÑO
El dueño abrió una plantilla de MaKo: te dice qué TIPO de oferta quiere armar; no te dice nada de su negocio.
{{forma}}

EL EJEMPLO DE ESA FORMA (de un negocio FICTICIO; el dueño lo ve en pantalla como ejemplo):
{{ejemplo}}

LO QUE ESTA FORMA NECESITA SABER, en este orden (la pieza y una pregunta por hechos):
{{preguntas}}

CÓMO TRABAJAS CON LA PLANTILLA. Suma a tus reglas de arriba: no cambia el formato JSON que ya te pidieron ni te deja inventar nada.
1. El ejemplo enseña la FORMA: qué piezas lleva este tipo de oferta y qué garantía, urgencia y forma de pago le quedan. Sus datos no existen: nunca copies del ejemplo un nombre, una cifra, un caso, un precio, una fecha, un cupo, un bono ni una frase. Si el dueño dice algo parecido, se escribe con sus palabras y sus números.
2. Antes de preguntar, busca cada pieza en lo que ya sabes del negocio. Después pregunta lo que falta en el orden de arriba, de a UNA pregunta, por hechos y con las palabras de su negocio: «¿Cuántas clínicas puedes atender a la vez?», nunca «define tu escasez».
3. Si lo que vende no encaja con esta forma (eligió un servicio hecho por ti y vende un curso grabado), díselo en una frase, sin juzgar, y sigue con la guía general. No fuerces la forma.
4. Si le falta una pieza, constrúyela con él con hasta 4 opciones cerradas que salen de ESTA forma y de lo que él puede cumplir:
   - garantía: la que responde a su miedo más grande (que no funcione, que tarde, pagar y no ver nada) y que el negocio pueda pagar aunque la reclame 1 de cada 10;
   - urgencia: sólo razones reales que salen de cómo trabaja (cupos según su capacidad, una fecha de inicio, una subida de precio anunciada, el inventario). Si no hay ninguna, no la inventes;
   - bonos: de 1 a 3, cada uno contesta una objeción que él escucha (no tengo tiempo, no sé si me va a funcionar, me voy a trabar, no sé qué elegir). Primero algo que el negocio hace o una herramienta; más clases, al final.
5. Precio: un precio de lista (el del plan) y el contado como ahorro. Tramos sólo si esta forma los lleva y el dueño los tiene: el mismo programa con más cercanía arriba, o el mismo para un equipo con factura. Nunca le bajes el precio a lo mismo: si no puede pagar, cambia qué recibe.
6. Al pulir, usa la ecuación de valor: el resultado y la probabilidad suben; el tiempo y el esfuerzo bajan. Mueve UNA palanca por vuelta, la más baja, y di cuál. Lo que esperas de cada cambio es una hipótesis (entre 10 % y 40 %, y los cambios se multiplican): nunca prometas que va a vender el doble.
7. El ejemplo es ficticio y el dueño lo sabe. No lo nombres como si fuera real ni le digas que su oferta «debería» parecerse; si lo citas, di «en el ejemplo».
```

**La entrada del registro** (en el grupo «Offer», después de `offer.propuesta.user`):

```ts
{
  key: 'offer.experto', source: 'override',
  label: 'El experto en ofertas: la plantilla elegida (instrucción)', kind: 'instruction', dynamic: true,
  variables: [
    v('forma', 'la forma de la plantilla: el tipo de oferta, quién hace el trabajo y la garantía, la urgencia y el pago que le quedan (lib/offer-plantillas.ts)'),
    v('ejemplo', 'el ejemplo de la plantilla, de un negocio ficticio, resumido'),
    v('preguntas', 'las piezas que pesan en esta forma, en orden, cada una con su pregunta por hechos'),
  ],
  scope: 'static-only', sensitive: false,
  default: OFFER_EXPERTO_TEMPLATE,
  context: 'Se suma al final de «La conversación: cómo pregunta MaKo» y de «La oferta nueva» SÓLO cuando el dueño abrió una plantilla de «Nueva oferta». Enseña la FORMA (qué garantía, urgencia y pago le quedan a ese tipo de oferta) sin copiar los datos del ejemplo, que es ficticio. Lo que no se toca: nunca copiar datos del ejemplo, una pregunta por vez y urgencia sólo real. El código igual revisa cada cifra de la oferta contra lo que dio el dueño. Conserva {{forma}}, {{ejemplo}} y {{preguntas}}. Y no lo pases a voseo: lo lee el cliente.',
},
```

### 3.4 Cómo se ven los slots (plantilla 1)

`{{forma}}`, que sale de `formaParaPrompt(p)`:

```text
Programa con garantía de aplicación. Para: un programa en grupo donde el cliente aplica una habilidad con revisión del experto, y ya hay casos.
Quién hace el trabajo: juntos (el cliente aplica; el negocio revisa y corrige).
Garantía que le queda: condicional a aplicar el método (asistir, aplicar, mandar a revisar), con devolución o repetir la cohorte.
Urgencia que le queda: una cohorte con fecha de inicio y cupos según cuántos clientes puede revisar el negocio.
Pago: de contado, o 2 pagos (hoy y a 30 días).
Lo que mueve: la probabilidad.
```

`{{ejemplo}}`, de `ejemploParaPrompt(p)`. Tiene un tope de 1,500 caracteres y **nunca** pasa por `contenidoNoConfiable`, porque es nuestro (trampa 14):

```text
(FICTICIO) Cierre Consultivo, coach de ventas para coaches.
Nombre: Cierre Consultivo: 90 días.
Frase: Ayudo a coaches que venden programas por llamada a cerrar 4 de cada 10 llamadas calificadas en 90 días con una llamada de diagnóstico de 6 preguntas, sin presionar ni bajar su precio.
Garantía: si asistes a 7 de 8 sesiones, aplicas el guion en 6 llamadas y no mejora tu cierre, devolución o repites la cohorte.
Bonos: revisión de 3 llamadas antes de empezar (contra «no sé si el problema es la llamada»); seguimiento en 3 mensajes (contra «se me van los que dicen lo voy a pensar»).
Inversión: USD 1,600 en 2 pagos de USD 800; de contado, USD 1,500.
Urgencia: cohorte de 15 lugares, lo que la coach puede revisar.
```

`{{preguntas}}`, de `preguntasParaPrompt(p)`: las 6 líneas de «Preguntas, en orden» de la plantilla, con el formato `- resultado: ¿Con qué número…?`.

### 3.5 Cómo adapta la plantilla, paso a paso

1. **La tarjeta.** «Usar plantilla» sobre «Programa con garantía de aplicación»:
   - abre una conversación nueva en el funnel de la abierta, o en el primero (`funnelParaPedido`);
   - si no hay ningún funnel, la tarjeta dice «Para usarla, crea un funnel en el CRM.». El ejemplo igual se ve en la grilla (trampa 2).
2. **El primer mensaje, sin IA** (`primerMensajeFunnel` con `plantilla`): «Es un ejemplo de Cierre Consultivo, un negocio ficticio. Para adaptarlo a tu oferta, ¿tienes un documento, tu guion de ventas o el link de tu web? Súbelo o pégalo aquí.» Con la opción «No tengo, pregúntame». Si MaKo ya sabe piezas del funnel, antes va «Ya tengo precio y entregables.», como hoy.
   - La primera frase es la común de las cinco tabs (README, 2.3). El botón «Adaptar a mi negocio» no va: en Offer, adaptar empieza por el documento, y la conversación ya es la adaptación. Es la excepción que declara el README.
3. **El centro, antes de la primera respuesta:** el ejemplo completo, en gris suave, con el rótulo «Ejemplo: Cierre Consultivo (negocio ficticio)» y las secciones del PDF para el cliente.
4. **Cada respuesta:**
   - el turno lleva el bloque `offer.experto` y las preguntas en el orden de la forma;
   - la pieza que llega se dibuja arriba en «Tu oferta» (`DocumentoVivo`, como hoy, y se resalta);
   - el ejemplo se pliega a una línea «Ver el ejemplo» apenas hay una pieza propia.
5. **«Armar mi oferta»:**
   - el diagnóstico corre como hoy, sin la forma, porque juzga la oferta de HOY;
   - la propuesta lleva `offer.experto`, así que la garantía, la urgencia y el pago siguen la forma;
   - `aplicarReglasPropuesta` revisa todo igual, con la excepción de «producto» (trampa 8).
6. **Pulir.** Una palanca por vuelta, la más baja, como pide el paso 6 del prompt.

### 3.6 Las preguntas que hace

- **Generales** (sin plantilla, o después de las de la forma): las de `PREGUNTAS_GUIA` (`lib/offer-marco.ts`), en su orden. Las mínimas van primero, y la de «otras ofertas» siempre y temprano.
- **Por forma:** las de cada plantilla (sección 2). Las reglas:
  - todas preguntan un hecho, nunca piden una tarea;
  - cada una lleva su clave de pieza (`PiezaKey`);
  - el código las antepone a la guía general (`guiaParaPrompt(orden)`) y `siguientePregunta` las usa en el mensaje sin IA.

---

## 4. Qué se copia y de dónde

### 4.1 Copiable, con la licencia leída

**marketingskills**
- **Licencia:** MIT, «Copyright (c) 2025 Corey Haines». Leída el 29/10/2026 en https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/LICENSE.
- **Aviso:** se conserva en `lib/avisos/LICENSE-MARKETINGSKILLS` (copia literal, la misma de las otras tabs; README, sección 5) y en la cabecera de `lib/offer-plantillas.ts` y del bloque de `lib/offer-ia.ts`. Es el molde de `LICENSE-DOORY` y `LICENSE-OPENCUT`.
- **Todo se traduce y se adapta.** No se pega texto en inglés.

| Archivo | Qué se toma | Dónde va |
|---|---|---|
| `skills/offers/SKILL.md`, «The Diagnostic Loop» | Una pieza por vuelta, la palanca más baja y la proyección honesta (10-40 %, los cambios se multiplican) | Paso 5 del método y regla 6 del prompt |
| `references/guarantee-design.md`, «Choosing the Right Type» | Elegir la garantía por el miedo más grande y por lo que el negocio puede pagar si la reclama 1 de cada 10 | Regla 4 del prompt y la `forma.garantia` de cada plantilla |
| `references/bonus-stacking.md` | Un bono por objeción: tiempo, «¿me va a funcionar?», trabarse, elegir | Regla 4 del prompt |
| `references/scarcity-urgency.md` | Los formatos honestos (capacidad, cohorte, fundadores, inventario, bono que vence, subida anunciada) y que se pueda comprobar y se cumpla | Regla 4 del prompt y la urgencia de los 9 ejemplos |
| `references/examples.md` | El formato antes → diagnóstico → después + la palanca que se movió | Plantilla 8 y la línea «Lo que mueve» |
| `evals/evals.json` | El formato de las pruebas (`prompt`, `expected_output`, `assertions`) | Las evals del experto (sección 5, tanda D) |

| Fuente | Licencia | Qué se copia |
|---|---|---|
| `docs/offer-marco.md` (`origin/main`) | Propio de MaKo | Las 20 secciones, la rúbrica, las reglas de precio, garantía y urgencia. Es la fuente de verdad. |

### 4.2 Solo como idea (no se copia ni el texto ni el nombre)

| Fuente | Por qué |
|---|---|
| Acquisition.com, curso de ofertas (https://www.acquisition.com/offers-oo) | «Copyright © 2026 Acquisition.com, LLC. All Rights Reserved.» «Grand Slam Offer» y «$100M» son de Hormozi: no van en el producto. |
| wondelai/skills, `hundred-million-offers` (https://skills.sh/wondelai/skills/hundred-million-offers) | El repo es MIT («Copyright (c) 2025 Wondel.ai sp. z o.o.», LICENSE leído), pero el contenido sale del libro de Hormozi: la MIT de un tercero no da derechos sobre el libro. |
| startup-ideation-kit, `offer-template.md` (https://cdn.jsdelivr.net/npm/startup-ideation-kit@3.2.0/templates/offer-template.md) | El `package.json` dice MIT («Mohamed Ameen»), pero el LICENSE no se abrió. No trae ningún ejemplo lleno y deriva de Hormozi. |
| fabric, `create_hormozi_offer` | Según la investigación del patrón (no la releí), es MIT pero trae unos 25 KB de citas del libro. No se usa. |
| PandaDoc, Proposify, Canva, Notion | Productos comerciales: se toma el modelo de mostrar (el documento completo y la tarjeta terminada). |
| Paquetes de prompts pagos y GPTs (Gumroad, Payhip) | Pagos y sin licencia; además, no muestran ejemplos. |
| La política de Meta y el informe de la FTC | Se citan los hechos (qué no se puede prometer, qué es urgencia falsa), no el texto. |
| Los marcos con nombre de los cursos del marco (§10: Oferta HIDE, Vehículo Azul, Nicho Dorado, Motor Cardinal…) | Son nombres de sus autores. El marco los cita como fuente, pero no aparecen en la pantalla ni en los ejemplos. |

---

## 5. Cómo implementarlo sobre el código actual

**Tanda A: las plantillas se ven llenas (sin IA, sin base de datos)**

1. **Nuevo:** `lib/offer-plantillas.ts`. Puro, sin `server-only`: lo leen la pantalla y el servidor.
   - `type PlantillaOferta = { id; nombre; cuando; grupo; negocio: { nombre; nicho }; forma: { tipo: 'programa' | 'servicio' | 'entrada' | 'continuidad' | 'producto' | 'revisar'; quienHace; garantia; urgencia; pago; mueve }; preguntas: Array<{ pieza: PiezaKey; pregunta }>; piezas: Partial<Record<PiezaKey, string>>; propuesta: PropuestaOferta; diagnostico?: { notas; tesis; fuerte; cambios }; ficha: { insignia; chips: [string, string, string] } }`.
   - `PLANTILLAS_OFERTA`: las 9 de la sección 2.
   - Funciones: `plantillaOferta(id)`, `formaParaPrompt`, `ejemploParaPrompt` (con tope de caracteres), `preguntasParaPrompt`.
   - Las fechas de las cohortes se guardan como `inicioEnDias` y se calculan al mostrar (trampa 9).
   - Lleva la cabecera MIT de marketingskills.
2. `app/_crear/reglas.ts`: `PlantillaCrear` usa los campos comunes de la tanda 0 (README, sección 6): Offer llena `extracto`, `chips`, `insignia`, `grupo`, `ayuda` y `ejemplo`. Se suma la función pura `seccionesDeCrear(plantillas)`, que agrupa en el orden en que aparecen. No se llama `gruposDePlantillas`: ese nombre ya existe en `lib/copywriter/plantillas.ts:162`, con otro tipo (README, 2.4).
3. `app/_crear/PantallaCrear.tsx` (`NuevaCrear`):
   - un `<section>` por grupo, con su título;
   - sin `imagen` y con `extracto`, dibuja la hoja de 2.0 dentro de `cr-plantilla__marco` (primera línea en negrita, el resto cortado a 3 líneas, los chips y la cinta si hay insignia).
4. `app/_crear/crear.css`: `.cr-plantilla__hoja`, `__chips`, `__cinta`, y en menos de 760 px, sin la frase.
5. `app/offer/arbol.ts`:
   - `valorEjemplo(id) = 'ejemplo:<id>'`;
   - `leerValor` suma `{ tipo: 'ejemplo', id }`;
   - nueva `plantillasEjemploDeOffer()` (desde `PLANTILLAS_OFERTA`, con su grupo, extracto, chips e insignia);
   - **`plantillasDeOffer` no se toca**, por la paridad con el teléfono (trampa 1); solo suma `grupo: 'Tus funnels'` en OfferApp.
6. `app/offer/OfferApp.tsx`:
   - `plantillas = [...funnels, ...ejemplos]`;
   - `crearDesdePlantilla` reconoce `ejemplo`: busca el funnel con `funnelParaPedido`; sin funnel devuelve «Para usarla, crea un funnel en el CRM.»;
   - `nuevaSesion(funnelId, ofertaBaseId, plantilla?)` manda `plantilla` en el cuerpo de `'nueva'`;
   - la 8 («Revisar») pide `ofertaBaseId` = la principal del funnel si existe.

**Tanda B: la conversación con forma**

7. `lib/offer-marco.ts`:
   - `OfferMensaje.plantilla?: { id: string }`, solo en el primer mensaje de MaKo. Va en el jsonb de `mensajes`, así que **no hace falta migración**;
   - `OfferSesionVista.plantilla: string | null`.
8. `app/api/offer/route.ts`:
   - `'nueva'` acepta `plantilla`. Se valida con `plantillaOferta(id)`; una desconocida da 400.
   - `sesionVaciaDe` reusa la vacía solo si tiene la misma plantilla; si no, crea otra (trampa 15).
   - `'turno'` y `'generar'` pasan `plantillaDeSesion(fila.mensajes)` a `turnoOffer` y `propuestaOffer`.
9. `lib/offer-reglas.ts`:
   - `primerMensajeFunnel(piezas, { modo, plantilla })` con la línea de 3.5;
   - `plantillaDeSesion(mensajes)`;
   - `guiaParaPrompt(orden?)` y `siguientePregunta(piezas, orden?)` anteponen las preguntas de la forma;
   - `aplicarReglasPropuesta(p, piezas, { ...ctx, forma })` saltea la regla de 90 a 180 días y la de la garantía condicional cuando `forma.tipo === 'producto'`.
10. `lib/offer-sesiones.ts`: `vistaSesion` expone `plantilla`; `sesionVaciaDe(funnelId, ofertaBaseId, plantilla)`.
11. `lib/offer-ia.ts`:
    - `OFFER_EXPERTO_TEMPLATE` (3.3) y `bloqueExperto(id)` = `renderPrompt('offer.experto', OFFER_EXPERTO_TEMPLATE, { forma, ejemplo, preguntas })`;
    - se suma en `turnoOffer` (no en el arranque) **antes** de `reglaNoExisteEn` y en `propuestaOffer`; no en `diagnosticoOffer`.
12. `lib/prompt-registry.ts`: la entrada de 3.3.
13. Después de editar, correr la skill `verify-prompt-registry-sync`.

**Tanda C: el ejemplo en el centro**

14. `app/offer/documento-vivo.ts`: `ejemploDelDocumento(plantilla)`. Arma las secciones del ejemplo **leyendo `PropuestaOferta` directo**, sin importar `lib/offer-pdf.ts`, porque eso metería `pdf-escritor` y las métricas de Helvetica en el bundle del navegador. Un test fija que los títulos sean los de `seccionesExternas`.
15. `app/offer/DocumentoVivo.tsx`: con `sesion.plantilla`, sin piezas propias muestra el ejemplo completo con su rótulo; con piezas, «Tu oferta» arriba y «Ver el ejemplo» plegado.
16. Después: `app/m/offer/HojasOfferM.tsx` (el teléfono) y la API de MaKo (`offer` en la API) con la plantilla.

**Tanda D: pruebas y documentos**

17. **Nuevo:** `tests/offer-plantillas.test.ts`, probado rompiéndolo. Para cada plantilla:
    - `marcasDeVoseo` da vacío en todo el texto (el guard de `tests/puente-panel-copy.test.ts` igual barre `lib/`);
    - no nombra a nadie de la lista `REALES` de `tests/variables-aviso.test.ts`;
    - `nivelDeOferta(piezas)` da el nivel esperado (alto, salvo la 4 y la 9, que dan bajo);
    - en alto ticket, `duracionEnDias(formato)` queda entre 90 y 180, salvo `producto`;
    - **las partes del formato suman el total:** las semanas que nombra (en vivo, de práctica, de cierre) dan lo mismo que el primer número, con una semana de margen. `duracionEnDias` solo lee el primer «N unidad», así que «90 días: 8 semanas en vivo y 4 de práctica» (84 días) pasaba;
    - las cuotas cobran al menos el 50 % al inicio;
    - hay de 1 a 3 bonos;
    - ningún chip lleva `[completar]`;
    - `aplicarReglasPropuesta(propuesta, piezas, { forma })` no agrega ningún aviso;
    - `ejemploParaPrompt` queda debajo del tope.
18. **Evals del experto**, con el formato de marketingskills, en el arnés de «prueba de los chats» del 22/10:
    - Abrir la plantilla 3 con un negocio que vende un curso grabado. Se espera que lo diga en una frase y no fuerce la forma.
    - Pedir «ponle escasez» sin capacidad real. Se espera que no invente un cupo.
    - Que el dueño diga «como el ejemplo». Se espera que no se cuele ninguna cifra de Pulso Dental.
19. `tests/crear-pantalla.test.ts` (grupos y hoja), `tests/offer-en-create.test.ts` (los ejemplos se ven sin funnels) y `tests/offer-ia-cableado.test.ts` (la clave nueva tiene el mismo default y los mismos slots en el template, el registro y el render, y se suma solo con plantilla).
20. **La cosecha, en el mismo commit:**
    - `docs/offer-marco.md`: un §11 «Formas de oferta» que apunta a `lib/offer-plantillas.ts`, y la nota sobre el valor del apilado (trampa 7);
    - `docs/hallazgos-offer.md`: las trampas de abajo.

---

## 6. Trampas

1. **El diagnóstico obvio era el equivocado, dos veces.**
   - El borrador decía que Offer no lleva un agente nuevo, y la tarea pedía uno. Las dos cosas son ciertas a medias: **el agente existe**; lo que falta es la forma, y va como una clave que el código suma (`offer.experto`), no como otro chat.
   - Lo obvio en el código era agregar los ejemplos a `plantillasDeOffer`. Eso rompe `tests/m-offer.test.ts:170`, que exige que el teléfono ofrezca las mismas salidas de crear que esa función. Los ejemplos van en una función aparte.
2. **Sin funnel no hay conversación.** `'nueva'` exige `funnelId` (`app/api/offer/route.ts:373`, «Elige el funnel de la oferta.») y hoy, sin funnels, la grilla queda vacía. Los ejemplos se dibujan siempre; usarlos pide un funnel.
3. **Un slot nuevo en un prompt que alguien ya editó nunca llega**, porque su versión guardada no lo tiene. Por eso no se le agrega `{{plantilla}}` a `offer.turno.system` ni a `offer.propuesta.system`: va una clave nueva que el código suma.
4. **El elenco común rompe el marco y el código lo marca** (`lib/offer-reglas.ts` 2953-2963):
   - 8 y 10 semanas dan menos de 90 días: aviso «el marco pide de 90 a 180 días».
   - USD 997 da nivel `medio`, y **el código trata `medio` igual que alto**: aviso «por debajo de 1.000 USD».
   - «3 pagos de USD 550» y «4 pagos de USD 275» cobran menos del 50 % al inicio (marco §6.6).

   Se corrigió en el elenco del README (sección 2.2) y en los guiones de Copywriter, Video, Image y AI Avatar que repetían esos datos (29/10).
5. **`duracionEnDias` toma el PRIMER «N unidad» del formato** (`lib/offer-reglas.ts:2780`). «En grupo, 8 semanas en vivo y 4 de práctica» se lee como 56 días. El total va primero («90 días: 8 semanas…»), **y tiene que ser verdad:** como el código no suma las partes, «90 días: 8 semanas en vivo y 4 de práctica» pasa la regla y son 84 días. Le pasó a la primera corrección de este plan. Ahora suman 13 semanas, y el test suma las partes (sección 5, punto 17).
6. **`precioDe` toma el monto mayor del texto**, y «2.4 M» puede no leerse. En las piezas del ejemplo los precios van completos y con moneda (`MXN 2,400,000`), y un test pasa cada uno por `nivelDeOferta`.
7. **Dos reglas del valor apilado se contradicen.**
   - El marco (§6.3) pide que el total sume «4 o 5 veces el precio o más».
   - marketingskills (`bonus-stacking.md`) pide menos de 2 veces, porque si no, no se cree.
   - Con valores reales (lo que cada cosa se vende suelta), los ejemplos dan de 1.3 a 1.6 veces.
   - **Decisión:** los ejemplos usan solo precios reales, y las 5 a 10 veces se muestran en **el valor del resultado** (D7), no inflando el apilado. Hay que sumar la nota al marco.
8. **Una preventa inmobiliaria no es un programa.** La regla de 90 a 180 días y la garantía por acciones no le aplican. Sin la excepción `forma.tipo === 'producto'`, la propuesta real de Torre Alameda sale con avisos falsos. Y si su formato dijera «18 meses», `duracionEnDias` lo leería como 540 días.
9. **Las fechas escritas en un ejemplo se vencen:** una cohorte «de enero» se lee en marzo. Se guardan como días desde hoy y se calculan al mostrar, como pide la regla común de fechas (README, sección 2.2).
10. **La MIT de una skill no licencia el libro del que sale.** wondelai, fabric y startup-ideation-kit cuentan a Hormozi. Quedan como idea, y en la pantalla no van «Grand Slam Offer», «$100M» ni los nombres de los marcos de los cursos (Oferta HIDE, Vehículo Azul, Nicho Dorado).
11. **El mensaje corto y la promesa de entrada van al anuncio.**
    - Ahí no entran ingresos ni resultados de salud (política de Meta, «Unrealistic outcomes»).
    - «15 pacientes al mes» y «4 de cada 10» van en la frase, el VSL y la llamada, no en el corto.
    - Un resultado con número siempre lleva «es un caso, no una promesa».
12. **Escasez real o ninguna** (FTC, contadores falsos y «quedan pocos» falso). Cada urgencia de los ejemplos sale de algo que el negocio puede comprobar:
    - cupos por capacidad;
    - una cohorte con fecha;
    - una zona por especialidad;
    - el inventario y el precio por etapa publicado;
    - el precio de fundadoras;
    - un crédito que vence.
13. **El guard de voseo barre `lib/` entero** y genera las formas desde los verbos (`tests/puente-panel-copy.test.ts`). Un ejemplo escrito con «acá», «tenés» o «contame» rompe CI apenas se commitea.
14. **Las cifras del ejemplo no pueden pasar por cifras del dueño.**
    - `aplicarReglasPropuesta` y `cifrasConFuente` validan cada número contra las fuentes del negocio (`ContextoReglas.fuentes`). Si el texto del ejemplo entrara ahí, sus «52 personas» quedarían como un dato del dueño.
    - El ejemplo va solo en el system (`{{ejemplo}}`), marcado FICTICIO, y **nunca** en `fuentes`, `documentos` ni `piezas`.
    - Tampoco va con `contenidoNoConfiable`: la cláusula de seguridad le diría al modelo que lo ignore como dato del dueño, y eso está bien. Pero la marca FICTICIO tiene que ir adentro del texto.
15. **`sesionVaciaDe` reusa la conversación vacía del funnel.** Elegir una plantilla, volver y elegir otra abriría la primera, con la forma vieja. La reutilización tiene que comparar la plantilla.
16. **El turno corre con un modelo chico** (`gemini-flash-lite-latest` en la red, `maxTokens: 2_000`), y «un modelo chico pesa más lo último que lee» (comentario del registro). Por eso el bloque del experto va sumado al system, **antes** de la regla de lo que no existe, y el user del turno sigue cerrando con la orden del JSON. El ejemplo resumido tiene tope.
17. **`seccionesExternas` borra cualquier renglón con `[completar]`.** Sirve en la plantilla 7 (el PDF para el cliente sale limpio), pero la miniatura y el extracto no pueden salir de una sección que lo tenga.
18. **Las herramientas fallan en silencio:**
    - Gamma (https://gamma.app/templates) da 403 con WebFetch.
    - `notion.com/templates/offer-builder` y `pandadoc.com/coaching-proposal-template/` dan 404.
    - El listado de Proposify no dice qué muestra cada miniatura.
    - El patrón de Canva y Notion sale de la investigación del 29/10, visto en el navegador.
19. **Los nombres del elenco**, buscados el 29/10/2026: no se encontró un negocio real con «Pulso Dental», «Torre Alameda» en Querétaro, «Consulta Rentable» ni «Voz de Líder». «Cierre consultivo» es un término genérico de ventas, así que es un nombre poco distintivo. **«Desarrolladora Altavista» no estaba en la lista y sí coincide:** en Querétaro hay una constructora «Grupo Altavista» (perfil de BNamericas) y un desarrollo «Altavista Juriquilla». Se quitó: Torre Alameda queda sin desarrolladora con nombre, que es un nombre menos que verificar. La búsqueda tiene que cubrir **todos** los nombres del elenco, también los de segunda línea, y se repite antes de publicar.

---

## 7. Lo que queda sin hacer

- **El teléfono** (`app/m/offer/HojasOfferM.tsx`) y **la API de MaKo** con plantillas: van después de la tanda C.
- **Ver la hoja de la miniatura en el navegador**, a 190 px y a 140 px, en claro y en oscuro: no se dibujó.
- **El PDF del ejemplo para «Ver el ejemplo en PDF»:** haría falta `paginasExternasDeOferta` en `lib/offer-pdf.ts`. Es opcional.
- **La nota del valor apilado en `docs/offer-marco.md` §6.3** (trampa 7).
- **No verifiqué** el LICENSE del paquete startup-ideation-kit ni volví a leer el de fabric; los dos quedan como idea.
