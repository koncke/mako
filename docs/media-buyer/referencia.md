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
- ~~Los colores y la tipografía: los de la casa~~ — **cambiado el 25/10/2026**: Martín vio la primera versión en producción y
  la rechazó («Realmente no creo que la interfaz de madgicx se vea así de fea, con tantos botones, no se entiende...
  Copiala tal cual a la interfaz de madgicx»). Desde entonces se copian TAMBIÉN los colores (medidos con PIL sobre las
  capturas: el encabezado de `app/ads-manager/mb.css` los lista), las medidas y la letra (Inter; los títulos en Geist 500
  porque Aeonik Pro es de pago), limitados a `.mb` como `.gh` en /api-mako. La criatura de MaKo sigue dorada: es la marca.
- **Lo que en Madgicx no se ve y no se inventó**: su estado vacío (se usa su tarjeta de saludo con globos), lo que abre
  «Ask AI Marketer to Do More» (en MaKo: mirar la cuenta ahora, subir creativos y el pedido libre al chat) y su tuerca
  completa (sólo se conoce el popup «Primary KPI»; en MaKo suma el modo, los topes, la cuenta y el interruptor).
- **Lo que MaKo agrega y Madgicx no tiene**: decide por lo que pasa DESPUÉS del clic (leads del CRM, agendas,
  ventas y caja por anuncio), no sólo por lo que reporta Meta; y el interruptor que apaga todo.
