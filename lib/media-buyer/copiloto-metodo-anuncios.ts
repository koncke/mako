// =============================================================================
// Marketing CoPilot — el método de campañas de Meta Ads, por tema (9/11/2026)
// =============================================================================
// Qué es: cómo se arma, se mide y se escala una cuenta de Meta Ads, en nueve temas que el agente pide con una herramienta
// (lib/api-mako/areas/ads.def.ts y ads.run.ts). No viaja en cada turno: sólo el tema que la pregunta necesita.
// De dónde sale: docs/conocimiento/meta-ads-gestion.md, el destilado de un curso de gestión de Meta Ads de 2026 (uso interno).
// Este archivo NO nombra la fuente: ni el curso, ni la agencia, ni sus docentes, ni marcas de terceros. Sólo van nombres de Meta
// (Andrómeda, Lattice, GEM, Advantage+, CBO, ABO). Cada cifra dice que es criterio de un curso de 2026 y no un promedio medido; si
// choca con lib/media-buyer/copiloto-conocimiento.ts, lo dice en una línea y gana lo más parecido al negocio.
// Escrito en tuteo y sin voseo. Los textos son template literals: sin acentos graves ni la secuencia de interpolación adentro.
// Si se actualiza el documento, se actualiza esto.
// =============================================================================

export const TEMAS_METODO = ['algoritmo', 'estructura', 'presupuesto', 'tracking', 'publicos', 'creativos', 'metricas', 'numeros', 'por-nicho'] as const;
export type TemaMetodo = (typeof TEMAS_METODO)[number];

/** Una línea por tema: qué trae (la usa la descripción de la herramienta). */
export const INDICE_METODO: Readonly<Record<TemaMetodo, string>> = {
  algoritmo: 'cómo elige Meta en 2026 (Andrómeda, Lattice, GEM), qué datos necesita y por qué la variedad creativa es una señal',
  estructura: 'campañas tipo, CBO o ABO, cuántos conjuntos y anuncios, ubicaciones, puja y objetivo',
  presupuesto: 'cuánto poner, fase de aprendizaje y qué la reinicia, cuándo tocar, reparto y cómo escalar',
  tracking: 'administrador comercial, propiedad de la cuenta, pagos, píxel, API de conversiones y eventos',
  publicos: 'público amplio, segmentos, intereses por capas, similares, empresas, superposición y retargeting',
  creativos: 'conceptos e iteraciones, cuántos probar y cómo, niveles de conciencia, ángulos, texto y formatos',
  metricas: 'métricas y KPI, qué mirar por etapa, diagnóstico por síntoma y auditoría de la cuenta',
  numeros: 'margen de contribución, punto de equilibrio, ROAS mínimo, costo máximo por resultado y proyección',
  'por-nicho': 'tienda online, cursos y ticket alto, ventas por mensajes y WhatsApp, formularios, afiliados y empresas',
};

/** El método de cada tema, en palabras propias. */
export const METODO_ANUNCIOS: Readonly<Record<TemaMetodo, string>> = {
  algoritmo: `CÓMO ELIGE META EN 2026. Antes de mostrar un anuncio, Meta pasa por una cadena. Un modelo recuerda la secuencia de lo que hizo cada persona. Andrómeda arma en milisegundos una lista corta entre millones de anuncios (como criterio de un curso de 2026, no un promedio medido, entre 500 y 1.000 candidatos por persona). Lattice ordena esa lista por probabilidad de resultado, valor y calidad. GEM entiende qué muestra cada creativo, para quién y en qué contexto, y mejora a los demás modelos.
Lo que eso cambia para el negocio:
- El creativo segmenta. Con público amplio, el mensaje decide a quién le llega. Diez anuncios casi iguales cuentan como una sola señal: la variedad real de conceptos es un requisito.
- Meta aprende de eventos. Necesita el píxel y la API de conversiones juntos, las coincidencias avanzadas activas y el recorrido completo: ver contenido, agregar al carrito, iniciar pago y compra o contacto. Con el mismo criterio del curso, la calidad de coincidencia de eventos debería estar en 8 o más. Con datos así, un ganador se lee en 3 o 4 días en lugar de 7 a 10.
- Lo nuevo pesa. Los anuncios se agotan antes que hace unos años, aunque funcionen, y hay que reponer creativos de forma constante.
- En la subasta gana el mayor valor total: la puja, la probabilidad de que la persona haga la acción y la calidad del anuncio. Un anuncio relevante puede ganarle a una puja más alta. Pedir interacción artificial, exagerar o esconder información le resta.
- El objetivo de la campaña también segmenta: Meta busca a quien suele hacer esa acción.
- Configura los segmentos de público, para separar a quien ya te conoce y a quien ya compró. Así Meta sabe a quién buscar como nuevo y tú ves adónde va el gasto.
Si la cuenta no tiene buenos datos, eso se arregla antes que la estructura o el presupuesto.`,

  estructura: `ESTRUCTURA DE CUENTA. Menos piezas rinden más, porque cada conjunto necesita sus propios eventos para aprender.
- Campañas tipo: una de prueba de creativos por tandas, una de escala con lo que ganó, una de retargeting y, cuando hay una fecha, una promocional aparte.
- ABO para probar, CBO para escalar. En la prueba, el presupuesto por conjunto da a cada uno un alcance parecido y la comparación es justa. El presupuesto de campaña sirve para escalar ganadores, para el retargeting y para los anuncios de catálogo: reparte solo y evita que tus públicos compitan entre sí. Si pruebas en CBO, pon un mínimo por conjunto. Ejemplo de un curso de 2026 (no es un promedio medido): 4 conjuntos a US$10 por día en ABO, o US$40 de campaña con US$5 mínimo por conjunto.
- Consolida. Cuatro conjuntos de públicos parecidos piden unos 200 eventos para salir de aprendizaje; juntos en uno, unos 50.
- Cuántos anuncios: de 3 a 6 por conjunto en prueba, agrupados por concepto, y de 5 a 10 variaciones vivas por producto (mismo criterio).
- La prospección va con público amplio o similares y excluye el retargeting. El retargeting reúne los públicos personalizados en un conjunto si la cuenta es pequeña.
- Deja las ubicaciones Advantage+ por defecto y adapta el creativo: 1:1 o 4:5 en el feed, 9:16 en historias y reels.
- Puja de mayor volumen o valor, salvo una razón concreta. Un tope manual corta la entrega.
- Objetivo: ventas si se compra en una web con píxel o por mensajes, contactos para datos, interacción para mensajes, tráfico sólo hacia destinos sin píxel.
- Nombra claro cada campaña y cada conjunto, o la historia de la cuenta no se puede leer.
Otra fuente deja abierto si el presupuesto va por conjunto o de campaña; gana lo más parecido a este negocio.`,

  presupuesto: `PRESUPUESTO. No hay un número genérico: sale del margen, del ticket, del país y de la época.
- Para salir de la fase de aprendizaje, cada conjunto necesita unos 50 eventos de optimización en 7 días. Presupuesto semanal mínimo por conjunto: 50 × lo que cuesta ese evento. Si no alcanza para optimizar a la compra, optimiza a un evento anterior (carrito, contacto, conversación) o junta conjuntos.
- Piso orientativo que un curso de 2026 atribuye a agentes de Meta (no es un promedio medido): US$5 a 10 por día en campañas nacionales sin conversión y unos US$15 con conversión. En LATAM suele costar menos que en EE. UU. o Europa; las grandes fechas de descuento y el fin de año encarecen.
- Con poco presupuesto, concéntralo: repartirlo en gotas no deja aprender a ningún conjunto.
- La fase dura de 1 a 7 días, más con presupuesto bajo. La reinician cambiar la segmentación, editar o sumar anuncios, cambiar el evento o la puja, pausar 7 días o más y los cambios grandes de presupuesto. Mientras aprende, no hagas cambios drásticos.
- Reparto orientativo del mismo curso: cerca de 70% a prospección y el resto a retargeting, más al tibio que al caliente; confírmalo con el desglose de segmentos.
- Diario para lo que se vende siempre y para escalar; total para una fecha con fin. En un buen día Meta puede gastar algo más que el diario: revisa el margen vigente en su ayuda.
- Para escalar, mira el costo marginal: cuánto costaron las ventas que sumó el último aumento, no el promedio. Si se acerca al costo máximo por venta, frena.
- Cuando un concepto toca techo, crece de costado con conceptos, avatares y públicos nuevos. Las señales: sube el CPC, sube la frecuencia y no aparecen compradores nuevos. En prospección, una frecuencia por encima de 3 pide creativos nuevos o menos presupuesto.
Ese curso no da un porcentaje de aumento diario. Otra fuente propone 10 a 30% por día si el costo aguanta y pide 50 eventos semanales o 25 a 30; gana lo más parecido a este negocio.`,

  tracking: `TRACKING Y CUENTA. Sin datos limpios, ninguna estructura funciona.
- Tres niveles: el administrador comercial es dueño de los activos y los permisos; la cuenta publicitaria guarda el píxel, los públicos y los pagos; en el Administrador de anuncios viven las campañas. Una cuenta publicitaria pertenece a un solo administrador comercial.
- El negocio es dueño de todo lo suyo: administrador comercial, cuenta publicitaria con pago automático, página, Instagram, píxel y API de conversiones. Una agencia entra como socio y nunca crea esos activos con su perfil personal.
- Usa el píxel (mide desde el navegador) junto con la API de conversiones (desde el servidor): se pierden menos eventos. Lo más simple es la integración nativa de la plataforma de la tienda en su modo más completo; si no existe, una herramienta confiable o un desarrollador.
- Activa las coincidencias avanzadas automáticas y todos los eventos estándar del recorrido. Como criterio de un curso de 2026 (no un promedio medido), la calidad de coincidencia del evento de compra debería quedar en 8 o más.
- Verifica el dominio y sincroniza el catálogo a diario, para que no salgan productos agotados.
- Las listas de clientes llevan nombre, teléfono, email y monto comprado, sin mezclar a quien no compró. Renuévalas cada 2 o 3 meses (mismo criterio).
- Hay dos CPA distintos. El de Meta usa su atribución estándar, 7 días tras el clic y 1 día tras ver el anuncio, y sirve para optimizar. Para saber si el negocio gana, usa la inversión del mes ÷ las ventas reales cobradas.
- Pagos: con tarjeta, desde un país que grava las compras al exterior, cada anuncio cuesta bastante más. Los medios de pago locales que ofrece Meta cambian sin aviso y pueden tardar días en acreditarse. Carga saldo con tiempo antes de una fecha importante y confirma los impuestos vigentes con un contador.
Otra fuente cita una cuenta argentina con 74% de impuestos en 2023 y ese curso, recargos parecidos en 2025: verifica hoy.`,

  publicos: `PÚBLICOS. En 2026 la base es el público amplio: un contenedor de muchos microsegmentos donde el creativo elige a cuál le habla. Rinde mejor cuantas más conversiones tiene la cuenta; con poca historia, algunos parámetros básicos ayudan.
- Tres segmentos para leer el gasto: público nuevo (prospección), activo (te conoce y no compró: retargeting) y clientes actuales (recompra). En prospección, excluye a los clientes recientes. Mira el desglose: muchas campañas «de retargeting» gastan casi todo en público nuevo.
- Cuenta nueva o producto de nicho: intereses por capas (uno amplio, luego una categoría o competidores, y un interés específico que define el ángulo). Junta los de una misma categoría en un conjunto; prueba competidores directos, aspiracionales e indirectos.
- Similares: el mejor origen son los compradores, con al menos 100 personas (criterio de un curso de 2026, no un promedio medido). Juntos en un conjunto, y para crecer de costado, porcentajes pequeños primero (1% y 2%).
- Venta a empresas: similares de contactos, tamaño de empresa (el curso usa 10 a 200, 200 a 500 y más de 500 empleados), negocios nuevos, cargos e intereses de gestión. Meta viene quitando segmentación detallada: confirma qué existe hoy.
- Superposición: dos conjuntos que compiten por la misma gente suben la frecuencia y bajan el CTR. El presupuesto de campaña lo amortigua.
- Retargeting por temperatura. Tibio: interacción con Instagram y Facebook, vistas de video. Caliente: visitas a la web, carrito, inicio de pago y listas. Excluye en cascada: quien compró sale del público de carrito. No repitas el mismo anuncio durante semanas: arma una secuencia que conteste objeciones. Si el público no entrega por pequeño, alarga la ventana de días.
- No se discrimina por atributos personales. Salud, bienestar (incluidos suplementos) y servicios financieros van sólo a mayores de 18.
Otra fuente prefiere ciudad y barrio en negocios locales; gana lo más parecido a este negocio.`,

  creativos: `CREATIVOS. Con público amplio, el creativo es la segmentación y la palanca principal.
- Concepto e iteración no son lo mismo. Un concepto nace de algo real que le pasa a la persona y ordena varios anuncios. Diversifica cambiando el ángulo, el deseo, el nivel de conciencia, el avatar (su problema y su contexto, no sólo la cara) o el formato. Iterar es cambiar una variable de un ganador, como el gancho del primer segundo, el texto en pantalla o el ritmo. La misma imagen con otro titular no es diversidad.
- Volumen, como criterio de un curso de 2026 (no es un promedio medido): de 5 a 10 variaciones vivas por producto, y en cada tanda cerca de 60% iteraciones y 40% conceptos nuevos. Que la mayoría falle es parte del método: en un caso, de 20 creativos escalaron 3.
- Según el momento: sin ganador, muchos conceptos distintos sin iterar; con un ganador, casi todo el esfuerzo a exprimirlo con formatos y ganchos, y una parte a uno o dos conceptos nuevos; en el techo, avatares y microsegmentos nuevos.
- Cada prueba nace de una hipótesis: qué falla, qué variable cambias y qué esperas que mejore.
- Niveles de conciencia:
  · Quien no sabe que tiene el problema: lo más escalable y lo más difícil (gancho por perfil, listas, humor, historias).
  · Quien conoce el problema: testimonios reales, antes y después del problema.
  · Quien busca solución: comparativas, mitos y realidad.
  · Quien conoce el producto: tres razones, demostración, preguntas.
  · Quien está listo: oferta, garantía, envío.
  Si los anuncios mueren rápido, suele ser que todos hablan del producto: sube el mensaje un nivel.
- Enseñar algo útil primero trae clientes que valen más en el tiempo. En frío, el texto educa; en retargeting, contesta objeciones.
- Lo que no: escasez o plazos inventados, testimonios falsos o hechos con IA, antes y después en salud, promesas de resultados.
Otra fuente dice que gana menos de 10% de los creativos y 1 a 3% aguanta escala; gana lo más parecido a este negocio.`,

  metricas: `MÉTRICAS Y DIAGNÓSTICO. Una métrica describe algo; un KPI es la que decide en este negocio, según el objetivo de la campaña.
- Qué mirar:
  · En el anuncio: CPM, CTR de enlace, frecuencia y costo por resultado.
  · En la web: vistas de página contra clics, carrito, inicio de pago y compra o registro.
  · En el negocio: el CPA real y el retorno contra el mínimo. El ROAS no descuenta costos.
- Referencias de un curso de 2026 (no son promedios medidos): frecuencia en prospección por debajo de 3; una tienda debería convertir más de 2% de sus visitas, y una página de registro gratuito, cerca de 30%.
- Las clasificaciones de calidad, interacción y conversión diagnostican anuncios malos. No sirven para tocar los que funcionan.
- Diagnóstico por síntoma, empezando por la primera etapa que falla (lo de abajo suele venir arrastrado):
  · CTR bajo y CPC alto: el creativo no conecta o la frecuencia está alta.
  · Muchos clics y pocas vistas de página: la página tarda o se ve mal en el teléfono.
  · Visitas sin registros ni compras: página confusa, promesa distinta o falta de confianza (sin conexión segura, reseñas ni garantía).
  · Carritos sin compra: pasarela larga, pocos medios de pago, objeciones sin respuesta o costos al final.
  · CPM alto: fecha de alta demanda (compara con el año anterior), anuncio de baja calidad o frecuencia alta.
  · Sin entrega: público muy pequeño o tope de puja.
- Lee el retargeting con el desglose de segmentos, no con el nombre de la campaña.
- Auditoría antes de escalar, en tres bloques. Lo técnico: píxel, API, dominio, catálogo y públicos. La estrategia: reparto, históricos de CPM, CPA, ticket, ROAS y CTR, atribución, estructura y exclusiones. Los creativos: qué rinde en frío y en retargeting.
Otra fuente pone el CPM de ticket alto en EE. UU. entre US$30 y 80; ese curso no da CPM, gana lo más parecido a este negocio.`,

  numeros: `NÚMEROS DEL NEGOCIO. Sin saber cuánto puedes pagar por una venta, no inviertes: apuestas. La cuenta se hace con los números de ESTE negocio.
- Margen de contribución por venta: el precio menos impuestos, comisiones de cobro, intereses de cuotas y devoluciones (en %), y menos los costos por unidad (producto, envío, empaque, cargos por venta). Pregunta por envíos, comisiones, impuestos y devoluciones: casi nadie los suma.
- Costo máximo por resultado (punto de equilibrio) = ticket × margen de contribución. ROAS mínimo = 1 ÷ margen, que es lo mismo que ticket ÷ costo máximo.
- Ejemplo de un curso de 2026 (no es un promedio medido): con un ticket de 100.000 y margen de 52,6%, el costo máximo es 52.600 y el ROAS mínimo 1,9. Con un margen de 16,5%, el ROAS mínimo pasa de 6.
- Proyección: facturación necesaria = (inversión + ganancia buscada) ÷ margen; ventas = facturación ÷ ticket; costo máximo del plan = inversión ÷ ventas. Supone un costo constante, y en la práctica cada aumento cuesta más que el promedio.
- El CPA para decidir es la inversión del mes ÷ las ventas cobradas. El que muestra Meta usa su atribución y sirve para optimizar.
- Si el cliente vuelve a comprar, se puede pagar más por la primera venta. En el ejemplo del mismo curso, una prenda de 2.000 con 650 de costos deja 1.000 si cada venta cuesta 350. Contando la recompra, aceptaba hasta 850 y una ganancia de 500.
- Un ROAS alto no es la meta, y a veces frena el crecimiento. Importa el volumen que deja más ganancia total sin poner en riesgo la caja.
- Antes de pautar, la oferta tiene que resolver un problema real: los anuncios no arreglan una oferta que nadie pide.
Otra fuente dice que el costo por cliente debería quedar por debajo de 30% del ingreso, y otra, hasta medio ticket; gana la cuenta con el margen de este negocio.`,

  'por-nicho': `POR TIPO DE NEGOCIO.
- Tienda online: la tienda pesa tanto como los anuncios.
  · Fotos buenas y en uso, información completa, reseñas reales, video y un llamado claro.
  · Compra sin registro obligatorio, varios medios de pago, cuotas o plazos en montos altos y el envío visible desde el principio.
  · Todos los eventos estándar, catálogo con anuncios dinámicos y ofertas reales en las fechas de alta demanda.
  Como criterio de un curso de 2026 (no un promedio medido), una tienda sana convierte más de 2%.
- Cursos y servicios caros: ese curso llama alto ticket a más de US$100 y usa clases en vivo o grabadas para vender. Funcionan el valor primero y un retargeting que conteste objeciones. Otra fuente pone el funnel de llamada desde unos US$3.000; en servicios con llamada gana ese criterio.
- Ventas por mensajes (WhatsApp, Instagram Direct, Messenger): prueba tres caminos y mide conversaciones calificadas, no clics.
  · Interacción con aplicación de mensajería.
  · Ventas con aplicación de mensajería, que sirve sin web.
  · Tráfico al enlace de WhatsApp.
  Usa un enlace con mensaje precargado que diga qué pidió la persona y responde rápido. Otra fuente desaconseja el tráfico hacia WhatsApp porque trae clics sin mensajes; gana lo medido en este negocio.
- Formularios: el de la web trae contactos más calificados; el instantáneo, más volumen.
- Afiliados: hay tres caminos: por mensajes sin web, con una clase o página previa propia, o con formulario y email. Revisa antes las normas de Meta para ese producto y mide con píxel y API.
- Venta a empresas: similares de contactos, y segmentación por tamaño de empresa y cargo si la cuenta la ofrece.
- Varios países: campañas separadas por idioma y cultura, sin traducir literal.`,
};
