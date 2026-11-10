# Gestión de campañas de Meta Ads: método por temas

Para el agente Marketing CoPilot: cómo se arma, se mide y se escala una cuenta de Meta Ads de un negocio de LATAM o España. Armado el 9/11/2026 destilando el **«Programa de Meta Ads 2026» de The Net Lab** (94 lecciones, `C:/cursos/programa-meta-ads-the-net-lab/`). Lo que viaja al agente está en `lib/media-buyer/copiloto-metodo-anuncios.ts`: una herramienta que se pide por tema.

**Sólo para el agente.** Usa estos criterios en sus palabras: no nombra el curso, la agencia, sus docentes ni las herramientas de terceros que aparecen.

**Cuánto creerle.** Es el curso de una agencia que vende gestión y formación; ninguna cifra está auditada y casi todas salen de sus clientes. **De 94 lecciones, sólo 7 tienen transcripción** (01, 02, 04, 05, 12, 20, 29). Del resto hay título y descripción, y en 14 casos material descargable (PDF y planillas en `recursos/`). Se leyó porque ahí está casi todo lo numérico, y se cita como «material L44». Parte del curso es anterior a 2026: L62 y L63 hablan de 2022, y la guía de fase de aprendizaje es de noviembre de 2023. Donde Meta cambió algo, se avisa. *Lectura nuestra* marca lo que no dice el curso.

## 1. Algoritmo

- **La cadena (L01).** *Sequence Learning* es la memoria de lo que hizo cada persona; el curso habla de 30 días. *Andromeda* recupera: de millones de anuncios arma en milisegundos una lista corta de 500 a 1.000 candidatos. *Lattice* ordena por probabilidad de compra, valor y calidad. *GEM* es el modelo base que entiende el creativo (categoría, estilo, contexto) y mejora a los otros; no entra en la subasta.
- **Consecuencia (L01, L02).** El creativo segmenta. La diversidad creativa es requisito: anuncios casi iguales cuentan como una sola señal. Se arma una biblioteca de anuncios para cada etapa del recorrido, no un único ganador.
- **Datos (L01, L04).** Píxel y API de conversiones juntos, coincidencias avanzadas automáticas y la secuencia completa de eventos (ver contenido, carrito, inicio de pago, compra). La calidad de coincidencia tiene que ser **8 o más**; para la compra, L01 dice «por encima de 8 o 9». Con datos así, un ganador se lee en **3 a 4 días en vez de 7 a 10** (L04). Por eso los anuncios se agotan antes: el sistema premia lo nuevo.
- **Subasta (material L44, material L92, L22).** Gana el mayor valor total: puja, probabilidad estimada de acción y calidad. Un anuncio relevante le gana a una puja mayor. El cebo de interacción, lo sensacionalista y la información oculta restan (L70).
- **El objetivo también segmenta (L42):** Meta busca a quien suele hacer esa acción.
- **Segmentos de público (L04, L05).** Configurar «público activo» y «clientes actuales» le dice a Meta quién es nuevo. En campañas de ventas Advantage+ se aplica solo.

## 2. Estructura

- **Temario 2026 (L03, 45 min, sin transcripción).** Campaña de testeo creativo por lotes, de escala, promocional y de retargeting. Límites de gasto por conjunto dentro de CBO y anuncio flexible. Cuándo un anuncio gana y cuándo se apagan anuncios o conjuntos: **esos criterios no están en el texto.**
- **ABO para probar, CBO para escalar (L45 y su material).** ABO prueba públicos o creativos con alcance parejo por conjunto. CBO sirve para escalar ganadores, para retargeting (evita superposición) y para anuncios dinámicos. Ejemplo: ABO con 4 conjuntos a US$10, o CBO de US$40 con US$5 mínimo por conjunto. El orden: probar en ABO, identificar ganadores, escalar en CBO.
- **Pruebas limpias (L69).** Sin contenido dinámico y en ABO.
- **Consolidar (L39, material L49).** Cuatro conjuntos de similares a US$20 necesitan 200 eventos para salir de aprendizaje; uno de US$80 con todos, 50. Lo mismo con el retargeting tibio.
- **Cuenta tipo (material L91).** La prueba va en ABO, a carrito o compra, con amplio o similares excluyendo retargeting, ubicaciones automáticas y 3 anuncios por conjunto. Prospección en CBO a compra. Retargeting en CBO con todos los personalizados. Nombres claros.
- **Cuántos (L02).** Lotes de 6 anuncios por concepto, de 5 a 10 variaciones por producto.
- **Ubicaciones (material L50).** Advantage+ por defecto. En un caso propio rindieron más que separarlas a mano, pero las cifras del material vienen incompletas. Formatos: 1:1 o 4:5 en feed, 9:16 en historias y reels, y reels con sonido.
- **Objetivos (L42).** Reconocimiento, sólo para públicos chicos que estuvieron por comprar. Tráfico, para destinos sin píxel. Interacción, para mensajes y para calentar. Clientes potenciales, para datos. Ventas, con web pixelada o por mensajes sin web.
- **Puja y atribución (L47, L48, material L92).** «Mayor volumen o valor» por defecto; un tope manual corta la entrega. Atribución de 7 días tras el clic y 1 día tras ver el anuncio.

## 3. Presupuesto

- **No hay número genérico (L44):** sale del margen, el ticket, el país y la época.
- **Mínimos «de manual» que el curso atribuye a agentes de Meta (material L44).** US$5 a 10 por día en campañas nacionales sin conversión y US$15 con conversión. LATAM sale más barato que EE. UU. y Europa; las fechas de descuento y fin de año encarecen.
- **Aprendizaje (material L44, L49).** Unos 50 eventos en 7 días por conjunto: presupuesto semanal ≥ 50 × costo del evento (lead a US$1 → 50 leads por semana). Dos conjuntos, el doble. Dura de 1 a 7 días, más con presupuesto bajo.
- **Qué lo reinicia (material L49).** Cambiar la segmentación, editar o sumar anuncios, cambiar el evento o la puja, pausar 7 días o más, y los cambios de presupuesto o límite de gasto según su tamaño. Nada drástico mientras aprende.
- **Poco presupuesto:** concentrar; un molino con gotas no se mueve (material L44).
- **Reparto (material L44, L91).** Educar, convertir y retargeting. La auditoría grafica **70% prospección**, 15% y 10% de retargeting tibio y caliente, y un 5% sin rótulo.
- **Diario o total (material L46).** Total, para fechas con fin; diario, para escalar. El material dice que Meta puede gastar hasta 25% más en un día bueno. *Lectura nuestra:* Meta cambió ese margen; verificar el vigente.
- **Escalar (L14, material L92, L02).** Mirar el **CPA marginal**, lo que costaron las ventas del último aumento, contra el CPA máximo. Escalar horizontal con públicos nuevos (similares de 1% y 2%, intereses, comportamientos). Si la frecuencia en prospección pasa de 3, sumar creativos nuevos o bajar el presupuesto. Si el concepto toca techo, conceptos y avatares nuevos. L84, L93 y L94 no tienen transcripción: **el curso no da un porcentaje de aumento diario.**

## 4. Tracking, cuenta y pagos

- **Niveles (L26, L27).** Administrador comercial, cuenta publicitaria y Administrador de anuncios. Una cuenta publicitaria es de un solo administrador comercial. El límite arranca en 5 cuentas y crece con la inversión.
- **Propiedad (L31).** El negocio tiene su administrador, cuenta con pago automático, página, Instagram, píxel y API; la agencia entra como socio. Nunca crearle el administrador con el perfil propio.
- **Píxel + API (L04, L36, L37).** La integración nativa de la tienda en modo máximo; si no hay, una herramienta confiable o un desarrollador. En e-commerce, todos los eventos estándar.
- **Auditoría técnica (material L91).** Dominio verificado y catálogo sincronizado a diario, para que no salgan agotados. Listas de clientes renovadas cada 2 o 3 meses y similares con origen de al menos 100 personas. La auditoría todavía pide priorizar eventos para iOS (L38). *Lectura nuestra:* Meta automatizó eso; revisar el Administrador de eventos.
- **Listas (L05).** Nombre, teléfono, email y ticket, sin mezclar no compradores entre los clientes.
- **CPA para decidir (L14):** inversión del mes ÷ órdenes cobradas. El de Meta, con su atribución, sirve para optimizar, no para el equilibrio.
- **Argentina (L29, 2025).** Con tarjeta se paga como compra al exterior: la lección suma IVA digital 21%, impuesto PAÍS 8–30% y percepciones 35–45%. Los medios locales se habilitaron y se desactivaron sin aviso; según la lección, hoy quedan tarjetas locales y PayPal. Con medios locales, acreditar tardaba 1 a 5 días hábiles. Verificar hoy.

## 5. Públicos

- **Amplio + creativo (L02, L73, material L72).** El amplio es un contenedor de microsegmentos: rinde más con más conversiones en la cuenta.
- **Segmentos (L05).** Nuevo, activo y clientes: prospección, retargeting y recompra. En prospección se excluye a los clientes recientes. Muchas campañas «de retargeting» gastan casi todo en público nuevo. Un caso de 30 días: 10 millones (moneda local) en nuevos, 6 en activos y 1 en clientes, con retorno 14 en retargeting, mucho más que en prospección.
- **Por capas (material L72, L91).** Para cuenta nueva o nicho: interés amplio, luego categoría, competidores o autores, y un interés específico que define el ángulo. Se apilan intereses de una misma categoría y se prueban competidores directos, aspiracionales e indirectos.
- **B2B (L75).** Similares de leads, tamaño de empresa (10–200, 200–500, 500 o más), negocios nuevos (6, 12 o 24 meses), administradores de páginas y cargos. *Lectura nuestra:* Meta viene quitando segmentación detallada; confirmar en la cuenta.
- **Similares y superposición (L77, L78, L45, material L49).** Origen en compradores, apilados en un conjunto. Superponer sube la frecuencia y baja el CTR; CBO lo amortigua. L79 (porcentajes) no tiene transcripción.
- **Retargeting (L80–L83, material L91, L92).** Tibio: interacción y video. Caliente: web, carrito, pago y listas. Exclusiones en cascada. Una secuencia que conteste objeciones, no el mismo anuncio durante semanas. Si no entrega, alargar la ventana.
- **Políticas (L70).** Nada de discriminar por atributos personales; en salud, suplementos y finanzas, sólo mayores de 18.

## 6. Creativos

- **Concepto vs iteración (L02).** El concepto va del insight a una idea que ordena varios anuncios. Se diversifica por ángulo, deseo, nivel de conciencia, avatar (problema y contexto, no la cara), estrategia o formato. Iterar es cambiar una variable de un ganador (gancho, texto en pantalla, ritmo) y vale si cambia la reacción. Otro titular u otro color no es diversidad.
- **Volumen (L02).** **5 a 10 variaciones por producto** y regla **60/40**: de cada 10, 6 iteraciones y 4 conceptos nuevos. Con más volumen la proporción se corre, pero la transcripción automática dice «180» y «120»: no se puede leer bien. De 20 creativos escalaron 3, y para eso estaban los otros.
- **Etapa del negocio (L02).** Sin ganador, conceptos distintos sin iterar. Con ganador, 80% a exprimirlo y 20% a uno o dos conceptos nuevos. En el techo, avatares y microsegmentos nuevos. Cada prueba nace de una hipótesis.
- **Niveles de conciencia (L20).** Inconsciente: el más escalable y el más difícil (gancho demográfico, listas, humor, historias de 3–5 min, L02). Problema: donde aparecen más ganadores (testimonios, antes/después del problema). Solución: comparativas, mitos. Producto: 3 razones, demo, preguntas frecuentes. Más consciente: oferta y garantía. Si los anuncios mueren rápido, subir el mensaje un nivel.
- **Valor primero (L67):** quien compra educado vale más en el tiempo.
- **Ángulos y copy (L19, L65, material L91).** Ante un ganador que cae, un ángulo nuevo. En frío el copy educa; en retargeting contesta objeciones.
- **Investigación (L58, L64).** Biblioteca de anuncios, reseñas, de 6 a 10 insights con IA. La estrategia sigue siendo humana.
- **Políticas (L70).** Sin antes/después en salud, botones falsos, impacto ni contenido sexual.

## 7. Métricas, diagnóstico y auditoría

- **Métrica vs KPI (L85 y material).** El KPI es la métrica que decide. Las clasificaciones diagnostican anuncios malos; no se usan para optimizar los buenos. El ROAS no descuenta costos.
- **Referencias (L51, material L92, material L11).** Tienda: CTR, carrito, pago y compra, con conversión mayor a 2%. Página de registro: cerca de 30% (300 de 1.000). Frecuencia de prospección por debajo de 3. CPM = gasto ÷ impresiones × 1.000.
- **21 causas (material L92).**
  - Pocos registros: tráfico equivocado, página lenta o recargada, incoherencia con el anuncio, desconfianza (sin HTTPS, sin reseñas, garantía ni devoluciones, testimonios no verificables).
  - Costo alto: página rota, promesa distinta, creativo que no calza (probar ángulos con poco).
  - Sin entrega: público chico o tope de puja.
  - CPM alto: fecha pico, baja calidad, frecuencia.
  - CTR bajo: frecuencia o contenido irrelevante.
  - Vistas de página bajas contra clics: sitio lento.
  - Carritos sin compra: pasarela, objeciones, oferta floja, costos sorpresa, envío.
  - Regla: el problema puede venir arrastrado de una etapa anterior.
- **Auditoría (material L91).** Optimizar antes de escalar, en tres bloques. Set up. Estrategia: reparto e históricos de CPM, CPA, ticket, ROAS, CPL y CTR, hasta 7 meses en cuentas grandes, más estructura, exclusiones y página. Creativos: qué rinde en frío y en retargeting.
- **Sin transcripción:** L86 (KPI), L87–L90 (diagnóstico, informes, Analytics).

## 8. Números

- **Margen de contribución (planilla L13).** Precio × (1 − impuestos − comisiones − intereses − devoluciones) − cargos fijos − envío − materia prima − packaging. El ejemplo pondera 16,5%: un producto con 23% y otro con 6%.
- **Equilibrio (planilla L14).** **CPA máximo = ticket × margen**; **ROAS mínimo = 1 ÷ margen**. Ejemplo: ticket 100.000 y margen 52,6% dan 52.600 y 1,9. *Lectura nuestra:* con 16,5%, el ROAS mínimo es cerca de 6.
- **Proyección (planilla L14).** Facturación = (inversión + ganancia buscada) ÷ margen; ventas = facturación ÷ ticket; CPA máximo del plan = inversión ÷ ventas. Supone un CPA constante; el tramo nuevo sale más caro.
- **ROAS alto no es la meta (L14).** Manda el volumen que deja más ganancia total.
- **Valor de vida (material L44).** Una prenda de 2.000 con costos de 650 y CPA de 350 deja 1.000. Con recompra, se acepta un CPA de hasta 850 y una ganancia de 500.
- **Caja y oferta (L11, L12, L15).** Rentable no es escalable. Antes de pautar, validar la oferta.

## 9. Por nicho

- **E-commerce (L51, L33, L34).** La tienda pesa: fotos, reseñas, video, compra sin registro, medios de pago, venta adicional. Catálogo, colección, productos etiquetados y ofertas reales en fechas.
- **Cursos (L53).** Bajo ticket es menos de US$100; alto, más. Webinar para vender. Sin transcripción.
- **Mensajes (L42, L55, L56).** Probar interacción, ventas con app de mensajería (sin web) y tráfico al enlace, con mensaje precargado. El formulario web califica más que el instantáneo.
- **Afiliados (L54).** Por mensajes, con clase o preventa, o con formulario y email. Normas de Meta primero.
- **Internacional (L57).** Adaptar idioma y cultura.

## 10. Dónde chocan con lo que ya sabe el CoPilot

Comparado con `CONOCIMIENTO_ANUNCIOS` y `CONOCIMIENTO_CANALES` (`lib/media-buyer/copiloto-conocimiento.ts`):

| Tema | El CoPilot | El curso | Cómo queda |
|---|---|---|---|
| Eventos para aprender | 50/semana o 25–30 | 50 en 7 días (L49) | Refuerza el 50 |
| Presupuesto | Conjunto o campaña, en discusión | ABO prueba, CBO escala (L45) | Se ordena por fase |
| Ganador | Dejarlo, escala o duplicar | A una CBO de escala | Coincide con una |
| **Tráfico a WhatsApp** | Error: clics sin mensajes | Uno de tres a probar (L42, L55) | **Choque:** medir conversaciones |
| **Alto ticket** | Desde US$3.000, con llamada | Cursos de más de US$100 (L53) | **Cortes distintos** |
| **Costo por cliente** | Menos de 30% o medio ticket | Ticket × margen (L14) | **Gana la fórmula** |
| Ganadores | Menos de 10%; 1–3% escalan | 3 de 20 (L02) | Un caso contra una regla |
| Apagar | 3 días a 2 semanas | Se lee en 3–4 días (L04) | Dentro del rango |
| Escalar | 10–30% diario | Sin porcentaje; CPA marginal | No atribuirle un % |
| Retargeting | Discusión en ticket muy alto | ~30% fijo (L91) | La discusión sigue en ticket alto |
| Promocionar | Error | Sólo seguidores (L42) | Compatible |
| Antes/después | No lo dice | Prohibido en salud (L70) | Sumar |
| Argentina | 74% en 2023 | Recargos de 2025 (L29) | Verificar hoy |

- **Test:** `tests/marketing-copilot-agente.test.ts` lista «Andromeda» entre las fuentes que no se nombran (venía de un video). El método la nombra con tilde y no choca hoy; si se suma a ese chequeo, hay que sacarla de la lista.

## 11. Lo que se dejó afuera

- **Escasez inventada:** «stock limitado» (L20), «últimas unidades, solo hoy» (material L21), un contador de bono (material L92). Sólo si es verdad.
- **Testimonios y antes/después hechos con IA** (L59, L60): personas sintéticas que hablan como clientes y fotos generadas. Escenas con IA sí; clientes inventados no.
- **Promesas:** «resultados en 7 días» (material L21). «Resultados o no cobramos» (L60), sólo si es una garantía real.
- **Datos de segunda parte (L40):** vender bases entre marcas.
- **Intereses ocultos por la API (L76):** atajo de poco valor.
- **Fuera del agente:** dólares digitales (L30), cobrar como media buyer (L08–L10) y marcas de las lecciones de IA (L58–L61).

## 12. Lo que falta

Transcribir los videos de `video/`: L03 (estructura 2026), L86, L84, L93–L94, L79, L55–L56, L53 y L13–L15.
