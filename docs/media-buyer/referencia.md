# Media Buyer de MaKo — la referencia que se copia

Pedido de Martín (25/10/2026): reemplazar `/ads-manager` por «una app de IA, como un media buyer de MaKo»,
copiando el diseño y la funcionalidad de una app que ya exista. AGENTS.md: «NINGUNA pantalla se diseña de cero».

## La referencia principal: Madgicx · AI Marketer

Se eligió por ser LA app de media buyer con IA para Meta con más uso, y porque su pantalla resuelve justo el
pedido: el agente audita la cuenta, propone o ejecuta cambios de presupuesto y de estado, y cada cambio queda
con su porqué y se lanza con un botón. Capturas reales en `referencias/madgicx/`:

| Archivo | Qué es | Fuente |
|---|---|---|
| `web-ai-marketer.png` | la pantalla ACTUAL (2025-2026): saludo, «Save work for N people», «Monthly goals», filas con 🗑 + «Launch» | madgicx.com/ai-marketer |
| `academy-01.png`, `academy-02.png`, `academy-10.png` | la versión anterior: tarjeta «N recommendations are waiting», el puntaje «Machine optimized», pestañas Open · Completed · Dismissed | academy.madgicx.com/lessons/how-to-use-ai-marketer |
| `academy-05.png` | el popup «Primary KPI» y su valor objetivo | idem |
| `academy-07.png` | el detalle de una recomendación en TRES columnas: el porqué · los datos y lo que se lanza · el resumen de ajustes, con «Edit Settings» y el botón principal | idem |
| `academy-08.png` | una táctica de automatización: «Condition · Value · Why this value?» y «puede dispararse como máximo una vez por día por conjunto» | idem |
| `academy-09.png` | «Ad Set Settings» (editar antes de lanzar) | idem |
| `academy-11.png`, `academy-12.png` | el teléfono: la tarjeta del saludo y las recomendaciones en tarjetas; las que sólo andan en la compu, grises | idem |
| `web-detalle.png` | el detalle ABIERTO de la versión oscura: cabecera con «Hide Details», el cuerpo en la banda y el pie con «Launch» | cuadro de animation-ui-02 de madgicx.com/ai-marketer |
| `web-filas-completed.png` | las filas oscuras: la lanzada queda con «Completed» en verde | cuadro de animation-ui-01, idem |
| `web-saludo.png` | la tarjeta de saludo con la mascota y los globos (en MaKo: el estado vacío y el arranque) | cuadro de animation-ui-03, idem |
| `changelog-detalle-presupuesto.jpg` | el detalle de un cambio de presupuesto: el porqué a la izquierda, el banner, la tabla y «Apply Changes» | roadmap.madgicx.com/changelog/19142 |

La documentación consultada para la FUNCIÓN (no hay capturas de esto, es texto oficial):
- academy.madgicx.com/lessons/madgicx-automation-tactics — las cuatro tácticas: **Stop Loss** (pausa lo que gastó sin
  resultado), **Revive** (prende lo que se apagó y después resultó bueno, por la atribución que llega tarde),
  **Surf** (sube el presupuesto de lo que rinde, con un tope) y **Sunsetting** (baja de a poco y apaga lo que no se
  recupera, comparando 3 y 7 días contra el promedio).
- bir.ch / Revealbot: reglas «si el costo por resultado está por debajo del objetivo, subir 20% con un techo».

## La app por dentro (25/10/2026, con la cuenta de Martín): `vivo-*.jpg`

Recorrida con Claude in Chrome, sólo mirando (la cuenta de Madgicx de Martín conectada a la cuenta publicitaria de MaKo,
sin campañas). **La app NO es la imagen de la landing**: es clara, y el AI Marketer tiene el saludo en un globo, la franja
con la mascota, las dos tarjetas, las pestañas Open · Completed · Dismissed y «See details» en cada fila. Lo que se copió:

| Pantalla de Madgicx | Captura | En MaKo |
|---|---|---|
| AI Marketer | `vivo-ai-marketer.jpg`, `vivo-ai-marketer-filas.jpg` | `/ads-manager` |
| El detalle de una recomendación (Hide details, el porqué, la tarjeta de color, los pasos, el botón al pie) | `vivo-ai-marketer-detalle.jpg` | el detalle de cada fila |
| AI Marketer settings (página, «Back», «Optimization KPIs»: Primary KPI y Target value) | `vivo-ai-marketer-ajustes.jpg` | `/ads-manager/ajustes` |
| Ask AI Marketer to Do More («Still have tedious manual tasks?») | `vivo-pedir-mas.jpg` | «Pedirle más a MaKo» |
| Automation Overview (Start · Pause · Increase · Decrease, total, el gráfico, la tabla de tácticas) | `vivo-automatizaciones-resumen.jpg`, `vivo-automatizaciones-tabla.jpg` | `/ads-manager/automatizaciones` |
| Choose Automation Tactic y las Automation Strategies | `vivo-automatizaciones-elegir.jpg`, `vivo-automatizaciones-estrategias.jpg` | las seis tácticas fijas de MaKo (no se crean tácticas nuevas) |
| Ads Manager 2.0, 360° Meta Audit, One-Click Report | `vivo-ads-manager.jpg`, `vivo-meta-360.jpg`, `vivo-one-click.jpg` | fuera del Media Buyer (Ads Analyst, Dashboard) |

## Inventario de funciones (25/10/2026): Madgicx por dentro, contra MaKo

Pedido de Martín (25/10): «si quiero que tenga todas las funcionalidades... podrias ver otras imagenes que encuentres
internas». Claude in Chrome no conectó desde el chat Media Buyer, así que el recorrido salió de la **academy oficial**
(academy.madgicx.com, 56 lecciones; capturas de la app por dentro) y de la landing; queda pendiente mirarlo en vivo con la
cuenta de Martín. Captura de cada pantalla en `referencias/madgicx/` (las de la academy, pasadas a PNG).

**El AI Marketer** (lección how-to-use-ai-marketer):

| Función de Madgicx | Captura | MaKo hoy | Qué falta / cómo |
|---|---|---|---|
| Saludo + «N recommendations» + actualizado | `web-ai-marketer.png` | ✅ | — |
| «Save work for N people» con la actividad y el % automatizado | idem | ✅ «Lo que hizo MaKo» | — |
| «Monthly goals» (ingresos, gasto, ROAS) | idem | ✅ «Metas del mes» (ventas del CRM, gasto, costo por resultado) | — |
| Puntaje contra el promedio de Madgicx | academy-01 | ❌ a propósito | MaKo no tiene un universo de cuentas comparable |
| Ajustes: KPI principal por cuenta + valor objetivo («Madgicx recommended» o propio) | `ai-marketer-ajustes-kpi.png`, `ai-marketer-objetivo.png`, academy-05 | ✅ la tuerca | — |
| Fila: ícono, título, cuenta + etiquetas, 🗑 y «Launch»/«See details» | `web-filas-completed.png` | ✅ | — |
| Detalle en tres columnas, «Hide Details», pie con el botón | `web-detalle.png`, academy-07, `changelog-detalle-presupuesto.jpg` | ✅ | — |
| Elegir a qué conjuntos / anuncios se aplica, con casillas | `web-detalle.png` | ⚠️ sólo en las variaciones | cada propuesta es de UNA entidad; agrupar varias es otra tanda |
| «Edit Settings» del conjunto antes de lanzar (lugares, edad, presupuesto, conversión) | `ai-marketer-editar-conjunto.png` | ⚠️ sólo el presupuesto («Editar») | MaKo no crea conjuntos nuevos desde el Media Buyer |
| Recomendación «crea esta automatización» con «cuánto habrías ahorrado en 7 días» | `ai-marketer-automatizacion-sugerida.png` | ❌ | **tanda de automatizaciones** (abajo) |
| Descartar con el porqué (modal, opcional) | `ai-marketer-descartar.png` | ❌ (se descartaba sin preguntar) | **hecho en esta tanda**: el modal guarda `motivo_descarte` |
| Descartadas con «Reopen» | `ai-marketer-descartadas.png` | ✅ («Volver a abrir», en el chip) | — |
| Completed agrupadas por día, con «Your Feedback» en estrellas | `ai-marketer-hechas.png`, `ai-marketer-calificar.png` | ⚠️ estrellas sí, sin agrupar | **hecho en esta tanda**: agrupadas por día |
| «Ask AI Marketer to Do More»: pedirle una tarea a sus ingenieros | `ai-marketer-pedir-mas.png` | ✅ «Pedirle más a MaKo» (el chat de MaKo + mirar la cuenta + subir creativos) | — |
| Teléfono: saludo, tarjetas, «Only available on desktop» | academy-11, academy-12 | ✅ | — |
| Teléfono: detalle con «Stats» / «Storyline», «Dismiss Task», «Swipe to launch» | `telefono-detalle-numeros.png`, `telefono-detalle-historia.png` | ⚠️ todo en una hoja | **hecho en esta tanda**: Números / Por qué en dos pestañas |

**Las automatizaciones** (lecciones madgicx-automation-tactics, how-to-monitor-automation-performance,
how-madgicx-custom-automation-works, how-to-use-madgicx-automation-strategies):

| Función de Madgicx | Captura | MaKo hoy | Qué falta / cómo |
|---|---|---|---|
| Elegir táctica: Surf, Stop Loss, Revive, Sunsetting (por conjunto, anuncio o campaña) | `automatizaciones-elegir-tactica.png` | ✅ `/ads-manager/automatizaciones`: cada una apagada / propone / automática | — |
| Elegir el evento que optimiza (Purchase, Lead, Add to cart…) | `automatizaciones-evento.png` | ⚠️ uno por negocio (lead / agenda / venta, y los dos últimos salen del CRM) | sigue por negocio: el CRM es lo que MaKo agrega |
| Condiciones con el valor recomendado, fijo o dinámico (contra el promedio de la cuenta) | `automatizaciones-condiciones.png`, `automatizaciones-valor-dinamico.png` | ✅ fijo, editable, con el recomendado al lado | el valor dinámico, no |
| A qué aplica (todos los de adquisición, o elegidos; los nuevos entran solos) | `automatizaciones-aplica-a.png` | ✅ toda la cuenta o las campañas elegidas | por conjunto, no |
| «Automation Overview»: Start / Pause / Increase / Decrease, total, en el tiempo | `automatizaciones-resumen.png` | ✅ Prendió · Pausó · Subió · Bajó · Total, 7 o 30 días, por día | — |
| Lista de tácticas: interruptor, autor, activos, frecuencia, última vez | `automatizaciones-lista.png` | ✅ interruptor, qué cubre, frecuencia de 14 días, última vez, modo y «⋯» | el autor, no (las tácticas son de MaKo) |
| Historial de una táctica | `automatizaciones-historial.png` | ✅ «⋯ → Historial» | — |
| Reglas propias con Y/O, métricas, ventanas y horarios | `automatizaciones-regla-propia.png` | ❌ | después de lo de arriba: un motor de reglas es otra pieza |

**Lo de alrededor** (otras pantallas de Madgicx, y dónde vive eso en MaKo):

| Madgicx | En MaKo |
|---|---|
| Ads Manager 2.0 (prender, apagar, presupuestos, pujas, historial del conjunto) | el Media Buyer por decisión; la vista de tabla se borró a pedido de Martín (25/10) |
| Ad Launcher, AI Ad Generator | Subir creativos (Pedirle más), las variaciones del ganador, Video Generator e Image Editor |
| Creative Insights, Ad Copy Insights | Ads Analyst |
| Audience Studio / Launcher, Targeting Insights, Geo & Demo, Auction Insights | no están en MaKo; fuera de este pedido |
| One-Click Report, Business Dashboard | Dashboard (copiado de Looker) |
| Ajustes del workspace, cuentas, plan | Configuración e Integraciones |

## Cómo se llama cada cosa en MaKo

| Madgicx | MaKo | Dónde |
|---|---|---|
| «Good morning, 4 recommendations for you. Updated 2h ago» + la mascota | «Buen día: N decisiones para ti» + la criatura de MaKo, «Actualizado hace …» | cabecera |
| ⚙ + «Ask AI Marketer to Do More» | ⚙ Ajustes (modo, topes, objetivo, Zernio) + «Pedirle más a MaKo» (abre el chat) | cabecera, derecha |
| «Save work for N people» con la actividad + «Percent of account automation» | «Lo que hizo MaKo» con la actividad (quién, qué, cuándo) + «En piloto automático: N%» | tarjeta izquierda |
| «Monthly goals · 4 days left · Edit» (Revenue, Amount spent, Blended ROAS) | «Metas del mes · quedan N días · Editar»: Ventas (caja del CRM), Gasto, Costo por resultado | tarjeta derecha |
| el chip «All recommendations 4 ×» (la versión actual; las pestañas Open · Completed · Dismissed son de la anterior) | el chip «Todas las recomendaciones N», que abre Hechas y Descartadas | arriba de la lista |
| fila: ícono · título · «Madgicx» + etiquetas · 🗑 · «Launch» | fila: ícono · título · «MaKo» + etiquetas · 🗑 · «Lanzar» | lista |
| detalle en 3 columnas + «Edit Settings» + botón principal | el porqué · los números (Condición · Valor · Por qué este valor) · lo que cambia (antes → después) + «Editar» + «Lanzar» | detalle |
| Completed con 1-5 estrellas | Hechas con «Deshacer» y 1-5 estrellas | Hechas |
| Dismissed con «Reopen» | Descartadas con «Volver a abrir» | Descartadas |
| teléfono: tarjetas + «Dismiss Task» + «Swipe to Launch» | tarjetas + «Descartar» + «Desliza para lanzar» | /m/ads |

## Lo que NO se copia, y por qué

- **El puntaje contra «el promedio de Madgicx»**: MaKo no tiene un universo de cuentas comparable. Se muestra el
  porcentaje de la cuenta en piloto automático, sin comparación.
- **Los colores y la letra: los de MaKo.** Hubo una vuelta en el medio (25/10/2026): Martín rechazó la primera versión
  («se vea así de fea, con tantos botones, no se entiende... Copiala tal cual»), se copiaron también los colores de
  Madgicx, y lo corrigió el mismo día: «no quiero copiar tal cual los colores, adaptarlos un poco a MaKo... Pero si quiero
  que tenga todas las funcionalidades». Queda de Madgicx la estructura, la limpieza, las medidas y las funciones.
  La paleta de Madgicx, medida con PIL sobre web-ai-marketer.png (por si se vuelve a necesitar): fondo #08061d, banda de la
  lista #13102a, borde #2f2d44, baldosa #18162b, «Launch» #7462f9, texto de acento #9586e8, chip #171625 con texto #a495fa,
  barra #121025 / #9282ee, verde #2ef8ae, «Completed» #35bf19, grises #9291a7 y #68667d. La letra: Aeonik Pro en los
  títulos (500) e Inter en el resto.
- **Lo que en Madgicx no se ve y no se inventó**: su estado vacío (se usa su tarjeta de saludo con globos), lo que abre
  «Ask AI Marketer to Do More» (en MaKo: mirar la cuenta ahora, subir creativos y el pedido libre al chat) y su tuerca
  completa (sólo se conoce el popup «Primary KPI»; en MaKo suma el modo, los topes, la cuenta y el interruptor).
- **Lo que MaKo agrega y Madgicx no tiene**: decide por lo que pasa DESPUÉS del clic (leads del CRM, agendas,
  ventas y caja por anuncio), no sólo por lo que reporta Meta; y el interruptor que apaga todo.
