# Reto de 7 días: un tutorial por pestaña (17/11/2026)

Lo pidió Martín el 17/11: «ya conoces todo el código, ya conoces cómo funciona cada pestaña, entonces que se haga un tutorial por pestaña». Cada uno: el guion del video corto (Dice/Muestra) y los pasos del recorrido en el formato que pidió el chat del Onboarding (pestaña, sel, titulo, texto, sub, clic/haz, lado).


Revisé cada `sel` contra las páginas dibujadas en `publicar/` del 17/11 a las 18:07. Otro chat estaba rearmando la carpeta mientras leía, así que trabajé sobre una copia. En ese rearmado, Marketing CoPilot pasó a dibujar su entrada: «¿Por dónde vendes?».

**Reglas comunes**
- El video corto de Martín va en el chat, como en V2. La app marca cada paso en vivo.
- `sel`: uso primero un `data-recorrido` que ya existe. Si no hay, uso un atributo que escribe el componente: `aria-label`, otro `data-*`, `href` o `id`. Si el elemento sólo tiene clase o texto, propongo `tour-<pestaña>-<cosa>`.
- Si varios elementos coinciden, vale el primero, como `querySelector`. Lo aclaro en el paso.
- `clic: true` va sólo en el último paso. En la maqueta ese botón no abre nada todavía, así que el clic cierra el recorrido.
- Duración = palabras ÷ 3,2 + 0,38 s. Los guiones quedan entre 67 y 85 palabras (21 a 27 s). No hay frases de cuatro palabras repetidas entre tutoriales.

---

## 1. Ops Center · `app-ops-center.html`

**Objetivo:** que le pida a MaKo el trabajo del día, por tema y hasta por audio.
**Largo:** 73 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Aquí no se busca nada: se pide. | Martín en su video chico. El Ops Center, sin marca. |
| 2 | Un tema, un chat. Así Máko no mezcla una conversación con otra. | Pausa: marcado «＋ Nuevo chat». |
| 3 | Tu plan de esta semana tiene su propio chat. Los cambios se piden ahí mismo. | Pausa: marcado el chat «Tu plan de la semana». |
| 4 | ¿Estás en la calle? Grábale una nota de voz. | Pausa: marcado el micrófono de la caja. |
| 5 | En Uso ves qué cuenta de IA trabaja para ti y cuánto lleva gastado. | Pausa: marcado «Uso». |
| 6 | Y para arrancar, toca «¿Qué hago hoy?». Máko mira tu negocio y te ordena el día. | Pausa con clic: marcado «¿Qué hago hoy?», con «Haz clic en «¿Qué hago hoy?»». |

```yaml
- pestaña: ops-center
  sel: '[data-recorrido="sb-nuevo"]'
  titulo: 'Un chat por tema'
  texto: 'Abre uno para cada asunto: ventas, contenido, cobros. Cada uno guarda lo suyo.'
  sub: 'Un tema, un chat. Así Máko no mezcla una conversación con otra.'
  lado: derecha
- pestaña: ops-center
  sel: 'button[title="Tu plan de la semana"]'
  titulo: 'Tu plan de la semana'
  texto: 'Lo dejó listo el onboarding. Si algo cambió, díselo en este chat.'
  sub: 'Tu plan de esta semana tiene su propio chat. Los cambios se piden ahí mismo.'
  lado: derecha
- pestaña: ops-center
  sel: 'button[aria-label="Grabar una nota de voz"]'
  titulo: 'Por audio'
  texto: 'Graba lo que necesitas: vale igual que un mensaje escrito.'
  sub: '¿Estás en la calle? Grábale una nota de voz.'
  lado: arriba
- pestaña: ops-center
  sel: '[data-recorrido="sb-uso"]'
  titulo: 'Uso'
  texto: 'Tus cuentas de IA conectadas y lo que gastó cada una.'
  sub: 'En Uso ves qué cuenta de IA trabaja para ti y cuánto lleva gastado.'
  lado: derecha
- pestaña: ops-center
  sel: '[data-recorrido="tour-ops-center-que-hago-hoy"]'
  titulo: '¿Qué hago hoy?'
  texto: 'MaKo mira lo que tienes pendiente y te dice por dónde empezar.'
  sub: 'Y para arrancar, toca «¿Qué hago hoy?». Máko mira tu negocio y te ordena el día.'
  clic: true
  haz: 'Haz clic en «¿Qué hago hoy?»'
  lado: abajo
```

## 2. Ticketera · `app-ticketera.html`

**Objetivo:** que mande un reporte con lo que el equipo necesita y siga su estado. No repite las frases de V2.
**Largo:** 68 palabras, ~22 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Un buen reporte se arregla mucho más rápido. | Martín en su video chico. El chat de Soporte, sin marca. |
| 2 | Cuéntale qué pasó, en qué pantalla y qué esperabas que pasara. | Pausa: marcada la caja «Cuéntale a MaKo qué pasó». |
| 3 | Si tienes una captura, súmala desde el más: ahorra preguntas. | Pausa: marcado el «+» de la caja. |
| 4 | Máko te pregunta lo que falte y lo arma como un ticket para el equipo. | Pausa: marcada la conversación. |
| 5 | En Tus tickets sigues cada uno, con su estado y la respuesta. | Pausa: marcado «Tus tickets». |
| 6 | Las ideas de mejora entran por el mismo lugar que los errores. | Sigue marcado «Tus tickets». |

```yaml
- pestaña: ticketera
  sel: 'textarea[aria-label="Cuéntale a MaKo qué pasó"]'
  titulo: 'Qué pasó'
  texto: 'Una o dos frases alcanzan: qué hiciste, qué viste y dónde.'
  sub: 'Cuéntale qué pasó, en qué pantalla y qué esperabas que pasara.'
  lado: arriba
- pestaña: ticketera
  sel: 'button[aria-label="Más opciones"]'
  titulo: 'Una captura'
  texto: 'Adjunta la imagen de la pantalla: el equipo la ve tal cual.'
  sub: 'Si tienes una captura, súmala desde el más: ahorra preguntas.'
  lado: arriba
- pestaña: ticketera
  sel: '[data-recorrido="sb-hilo"]'
  titulo: 'El ticket se arma solo'
  texto: 'MaKo completa lo que falta con preguntas cortas y lo manda al equipo.'
  sub: 'Máko te pregunta lo que falte y lo arma como un ticket para el equipo.'
- pestaña: ticketera
  sel: 'button[aria-label="Tus tickets"]'
  titulo: 'Tus tickets'
  texto: 'Todo lo que reportaste, con su estado y lo que te contestaron.'
  sub: 'En Tus tickets sigues cada uno, con su estado y la respuesta. Las ideas de mejora entran por el mismo lugar que los errores.'
  lado: abajo
```

## 3. CRM · `app-crm.html`

**Objetivo:** que cargue sus leads y los lleve hasta «Ganado», viendo cuánto dinero hay en juego en cada etapa.
**Largo:** 78 palabras, ~25 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Cada columna es un paso de tu venta. Tu trabajo es que cada lead llegue a Ganado. | Martín en su video chico. El tablero, sin marca. |
| 2 | Arriba de cada etapa ves cuánto podría entrar. En Ganado, lo que ya vendiste. | Pausa: marcada la columna Ganado. |
| 3 | Para cambiar a alguien de etapa sin arrastrar, toca Ver info y Mover a. | Pausa: marcado «Ver info» de la primera tarjeta. |
| 4 | Las reuniones de los próximos días esperan en este número. | Pausa: marcado el número de reuniones. |
| 5 | ¿Buscas a alguien? Escribe su nombre, o su número con numeral adelante. | Pausa: marcado el buscador. |
| 6 | Y si ya tienes una lista, impórtala entera desde Más acciones. | Pausa con clic: marcado «Más acciones», con «Haz clic en Más acciones». |

```yaml
- pestaña: crm
  sel: '[data-colkey="ganado"]'
  titulo: 'Lo que hay en juego'
  texto: 'Cada etapa suma lo que podría entrar: todavía no es una venta. Ganado suma lo vendido.'
  sub: 'Arriba de cada etapa ves cuánto podría entrar. En Ganado, lo que ya vendiste.'
  lado: izquierda
- pestaña: crm
  sel: '[data-lead-id="101"] button[title="La ficha rápida, con «Mover a…»"]'
  titulo: 'Ver info'
  texto: 'La ficha rápida del lead. Con «Mover a…» lo pasas de etapa.'
  sub: 'Para cambiar a alguien de etapa sin arrastrar, toca Ver info y Mover a.'
  lado: derecha
- pestaña: crm
  sel: 'button[aria-label^="Ver las"]'
  titulo: 'Tus reuniones'
  texto: 'Tócalo y ves las que vienen, en orden.'
  sub: 'Las reuniones de los próximos días esperan en este número.'
  lado: abajo
- pestaña: crm
  sel: '[data-recorrido="crm-buscar"]'
  titulo: 'Buscar'
  texto: 'Por nombre, email o teléfono. Para uno puntual, #412.'
  sub: '¿Buscas a alguien? Escribe su nombre, o su número con numeral adelante.'
  lado: abajo
- pestaña: crm
  sel: '[data-recorrido="crm-mas"]'
  titulo: 'Importa tu lista'
  texto: 'Aquí eliges «Importar leads». También editas las etapas.'
  sub: 'Y si ya tienes una lista, impórtala entera desde Más acciones.'
  clic: true
  haz: 'Haz clic en Más acciones'
  lado: abajo
```

## 4. Calendar · `app-calendar.html`

**Objetivo:** que vea llamadas, publicaciones, entregas y vencimientos juntos, y anote una llamada de venta.
**Largo:** 67 palabras, ~21 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Tu semana entera en un solo lugar: llamadas de venta, publicaciones, entregas y lo que vence en el Plan. | Martín en su video chico. La semana, sin marca. |
| 2 | Toca un nombre para esconderlo y quedarte con lo que importa hoy. | Pausa: marcado «Qué ver». |
| 3 | Las reuniones que se agendan en el CRM aparecen aquí solas, con el nombre del lead. | Pausa: marcada una reunión. |
| 4 | En Llamadas ves todas juntas, sin nada alrededor. | Pausa: marcada la vista «Llamadas». |
| 5 | ¿Una llamada que no pasó por la agenda? Anótala con este más. | Pausa con clic: marcado el «+» de Ventas, con «Haz clic en el + de Ventas». |

```yaml
- pestaña: calendar
  sel: '[data-recorrido="calendario-usos"]'
  titulo: 'Qué ver'
  texto: 'Cada nombre prende o apaga ese tipo. El + de al lado crea uno nuevo.'
  sub: 'Toca un nombre para esconderlo y quedarte con lo que importa hoy.'
  lado: abajo
- pestaña: calendar
  sel: '[aria-label^="R1 con Gabriela Ortiz"]'
  titulo: 'Desde el CRM'
  texto: 'Llegó sola desde el CRM, con el lead y su reunión.'
  sub: 'Las reuniones que se agendan en el CRM aparecen aquí solas, con el nombre del lead.'
  lado: derecha
- pestaña: calendar
  sel: 'a[href="/calendario?vista=llamadas"]'
  titulo: 'Llamadas'
  texto: 'Todas tus llamadas de venta en una lista, una debajo de otra.'
  sub: 'En Llamadas ves todas juntas, sin nada alrededor.'
  lado: abajo
- pestaña: calendar
  sel: '[data-recorrido="calendario-llamada"]'
  titulo: 'Nueva llamada de venta'
  texto: 'Anota la que no entró por tu agenda, así no se pierde.'
  sub: '¿Una llamada que no pasó por la agenda? Anótala con este más.'
  clic: true
  haz: 'Haz clic en el + de Ventas'
  lado: abajo
```

## 5. Automations · `app-automations.html`

**Objetivo:** que cree su primera automatización para que los leads reciban seguimiento sin hacerlo a mano.
**Largo:** 83 palabras, ~26 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Cada lead que no contestas a tiempo es una venta que se enfría. | Martín en su video chico. Automations vacía, sin marca. |
| 2 | Aquí viven los mensajes que salen solos: cuando alguien agenda, cuando no se presenta o cuando vence una cuota. | Pausa: marcada la lista. |
| 3 | Cada una se arma en este lienzo, tarjeta por tarjeta. Nada se envía hasta que la publicas y la activas. Antes, la pruebas como si fueras el lead. | Pausa: marcado el lienzo. |
| 4 | El tutorial de cada botón del lienzo está en este signo. | Pausa: marcado el «?». |
| 5 | Toca Nueva automatización: dile a Máko qué necesitas, o elige una plantilla. | Pausa con clic: marcado «＋ Nueva automatización», con «Haz clic en «＋ Nueva automatización»». |

```yaml
- pestaña: automations
  sel: 'aside[aria-label="Tus automatizaciones"]'
  titulo: 'Tus automatizaciones'
  texto: 'Cada una nace de un momento del lead: entró, agendó, no vino, pagó.'
  sub: 'Aquí viven los mensajes que salen solos: cuando alguien agenda, cuando no se presenta o cuando vence una cuota.'
  lado: derecha
- pestaña: automations
  sel: '[data-lienzo-vacio="true"]'
  titulo: 'El lienzo'
  texto: 'Aquí ves el flujo entero. Usa «Probar» antes de publicarlo.'
  sub: 'Cada una se arma en este lienzo, tarjeta por tarjeta. Nada se envía hasta que la publicas y la activas. Antes, la pruebas como si fueras el lead.'
- pestaña: automations
  sel: '[data-recorrido="au-ayuda"]'
  titulo: 'El tutorial del lienzo'
  texto: 'Abre el recorrido botón por botón, con una automatización abierta.'
  sub: 'El tutorial de cada botón del lienzo está en este signo.'
  lado: derecha
- pestaña: automations
  sel: '[data-recorrido="tour-automations-nueva"]'
  titulo: 'Nueva automatización'
  texto: 'Pídela por escrito o en audio, o elige una de la galería.'
  sub: 'Toca Nueva automatización: dile a Máko qué necesitas, o elige una plantilla.'
  clic: true
  haz: 'Haz clic en «＋ Nueva automatización»'
  lado: derecha
```

## 6. Settings › Perfil · `app-settings.html`

**Objetivo:** que deje su perfil y su negocio en orden, y conecte sus cuentas en Integraciones.
**Largo:** 76 palabras, ~24 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Aquí no hay botón de guardar: escribes, sales del campo y queda. | Pausa: marcado el campo «Nombre». |
| 2 | El nombre del negocio que pongas cambia en toda la app. | Pausa: marcado «Nombre del negocio». |
| 3 | Tu zona horaria decide en qué horario Máko no te molesta. | Pausa: marcada «Zona horaria». |
| 4 | En Equipo sumas a quien vende contigo, con el rol que le toca. | Pausa: marcado «Equipo» en el índice. |
| 5 | Máko en el teléfono, la computadora y el navegador se instala desde aquí. | Pausa: marcado «Instalar la app». |
| 6 | Y lo más importante: en Integraciones conectas tus cuentas. Sin ellas, Máko no ve tu negocio. | Pausa con clic: marcado «Integraciones», con «Haz clic en Integraciones». |

```yaml
- pestaña: settings
  sel: 'input[aria-label="Nombre"]'
  titulo: 'Se guarda solo'
  texto: 'Escribe y sal del campo. Con Escape vuelves a lo que estaba.'
  sub: 'Aquí no hay botón de guardar: escribes, sales del campo y queda.'
  lado: abajo
- pestaña: settings
  sel: 'input[aria-label="Nombre del negocio"]'
  titulo: 'Nombre del negocio'
  texto: 'Aparece en toda la app, también en tus plantillas de Image.'
  sub: 'El nombre del negocio que pongas cambia en toda la app.'
  lado: abajo
- pestaña: settings
  sel: 'button[aria-label="Zona horaria"]'
  titulo: 'Zona horaria'
  texto: 'Con ella se mide el «No molestar» de tus notificaciones.'
  sub: 'Tu zona horaria decide en qué horario Máko no te molesta.'
  lado: arriba
- pestaña: settings
  sel: 'a[href="/equipo"]'
  titulo: 'Equipo'
  texto: 'Invita a tus closers y setters: cada rol ve sólo lo suyo.'
  sub: 'En Equipo sumas a quien vende contigo, con el rol que le toca.'
  lado: derecha
- pestaña: settings
  sel: 'a[href="/perfil/instalar"]'
  titulo: 'Instalar la app'
  texto: 'La app del teléfono, la de la computadora y la extensión de Chrome.'
  sub: 'Máko en el teléfono, la computadora y el navegador se instala desde aquí.'
  lado: derecha
- pestaña: settings
  sel: 'a[href="/integraciones"]'
  titulo: 'Integraciones'
  texto: 'Tu agenda, tus anuncios y tu IA. Es lo primero de tu Plan.'
  sub: 'Y lo más importante: en Integraciones conectas tus cuentas. Sin ellas, Máko no ve tu negocio.'
  clic: true
  haz: 'Haz clic en Integraciones'
  lado: derecha
```

## 7. Offer · `app-offer.html`

**Objetivo:** que analice su oferta con MaKo y salga con la versión mejorada en PDF. No repite frases de V3.
**Largo:** 74 palabras, ~24 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Lo que le contaste a Máko en el onboarding sigue aquí, en la misma conversación. | Pausa: marcado el chat de MaKo. |
| 2 | A la derecha, tu oferta se arma sola con cada respuesta. De ahí salen tu landing y tus guiones. | Pausa: marcada «Tu oferta». |
| 3 | Con la flecha ves tus funnels, sus ofertas y cada análisis. | Pausa: marcada la flecha del chat. |
| 4 | Cuando quieras ir a fondo, toca Analicemos mi oferta. | Pausa con clic: marcado «Analicemos mi oferta», con «Haz clic en «Analicemos mi oferta»». |
| 5 | Te marca qué la hace fuerte, qué le falta para vender más y te arma la versión mejorada, en PDF. | Sigue marcado. |

```yaml
- pestaña: offer
  sel: 'section[aria-label="MaKo en Offer"]'
  titulo: 'La misma charla'
  texto: 'MaKo sigue desde lo que contaste en el onboarding: no hace falta repetirlo.'
  sub: 'Lo que le contaste a Máko en el onboarding sigue aquí, en la misma conversación.'
  lado: derecha
- pestaña: offer
  sel: '[aria-label="Tu oferta"]'
  titulo: 'Tu oferta'
  texto: 'Para quién es, qué logra, qué entregas y el precio. Se completa mientras respondes.'
  sub: 'A la derecha, tu oferta se arma sola con cada respuesta. De ahí salen tu landing y tus guiones.'
  lado: izquierda
- pestaña: offer
  sel: 'button[aria-label="Ver tus proyectos de Offer"]'
  titulo: 'Tus proyectos'
  texto: 'Cada funnel con sus ofertas y sus análisis anteriores.'
  sub: 'Con la flecha ves tus funnels, sus ofertas y cada análisis.'
  lado: derecha
- pestaña: offer
  sel: '[aria-label="Respuestas rápidas"] button'   # el primero: «Analicemos mi oferta»
  titulo: 'Analizar tu oferta'
  texto: 'Te pide dos datos: cuántas personas te compraron y cuántas lograron el resultado.'
  sub: 'Cuando quieras ir a fondo, toca Analicemos mi oferta. Te marca qué la hace fuerte, qué le falta para vender más y te arma la versión mejorada, en PDF.'
  clic: true
  haz: 'Haz clic en «Analicemos mi oferta»'
  lado: arriba
```

## 8. Marketing CoPilot · `app-copilot.html`

**Objetivo:** que conteste la entrada para que MaKo le arme el análisis y las tareas de marketing. Hoy se dibuja sólo la entrada.
**Largo:** 85 palabras, ~27 s

| # | Dice | Muestra |
|---|---|---|
| 1 | El CoPilot hace de tu equipo de marketing: mira lo que publicas y lo que inviertes, y te dice qué hacer. | Martín en su video chico. «¿Por dónde vendes?», sin marca. |
| 2 | Antes, tres preguntas cortas, una por pantalla. | Pausa: marcados los tres puntos de avance. |
| 3 | Marca por dónde vendes. Puede ser más de uno. | Pausa: marcadas Anuncios, Instagram y YouTube. |
| 4 | Con el tiempo que tengas para crear, Máko calcula cuánto publicar en cada red. | Pausa: marcado «Seguir». |
| 5 | Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan, y el piloto no lanza un anuncio sin tu OK. | Sigue marcado «Seguir». |
| 6 | Toca Seguir y arranca. | Sigue marcado «Seguir». |

```yaml
- pestaña: copilot
  sel: '[data-recorrido="tour-copilot-pasos"]'
  titulo: 'Tres preguntas'
  texto: 'Por dónde vendes, tus anuncios y tu tiempo para crear.'
  sub: 'Antes, tres preguntas cortas, una por pantalla.'
  lado: abajo
- pestaña: copilot
  sel: '[data-recorrido="tour-copilot-canales"]'
  titulo: '¿Por dónde vendes?'
  texto: 'Marca todos los que uses. Con Anuncios, te pregunta también cuánto inviertes.'
  sub: 'Marca por dónde vendes. Puede ser más de uno.'
  lado: abajo
- pestaña: copilot
  sel: '[data-recorrido="tour-copilot-seguir"]'
  titulo: 'Seguir'
  texto: 'Al final conectas las redes que elegiste, en la misma entrada.'
  sub: 'Con el tiempo que tengas para crear, Máko calcula cuánto publicar en cada red. Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan, y el piloto no lanza un anuncio sin tu OK. Toca Seguir y arranca.'
  lado: arriba
```

(«Seguir» está deshabilitado hasta elegir un canal. Por eso este paso va con «Siguiente».)

## 9. Competitor Spy · `app-spy.html`

**Objetivo:** que encuentre los outliers de su competencia y haga uno propio a partir de ellos.
**Largo:** 72 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | No adivines qué publicar: mira qué ya le funciona a tu competencia. | Martín en su video chico. La ficha de Alex Hormozi, sin marca. |
| 2 | Desde Competidores sumas a quien quieras mirar. | Pausa: marcado «Competidores». |
| 3 | Cada punto es una pieza. Las que quedan muy por arriba son outliers: rindieron varias veces más que su mediana. | Pausa: marcado el gráfico. |
| 4 | Sus anuncios y su funnel tienen pestaña propia. | Pausa: marcada «Anuncios». |
| 5 | Abajo está todo lo que publica. Ordénalo por más vistas. | Pausa: marcado «Más vistas». |
| 6 | Abre una pieza y toca Hacer uno así: Máko escribe el tuyo con tu oferta. | Pausa con clic: marcada la primera pieza, con «Haz clic en la primera pieza». |

```yaml
- pestaña: spy
  sel: '[data-recorrido="spy-volver"]'
  titulo: 'Competidores'
  texto: 'Vuelve a la lista para sumar otra cuenta o cambiar de competidor.'
  sub: 'Desde Competidores sumas a quien quieras mirar.'
  lado: abajo
- pestaña: spy
  sel: 'section[aria-label="Vistas por día de publicación"]'
  titulo: 'Sus outliers'
  texto: 'Pasa el cursor por un punto para ver qué pieza es y cuántas vistas hizo.'
  sub: 'Cada punto es una pieza. Las que quedan muy por arriba son outliers: rindieron varias veces más que su mediana.'
- pestaña: spy
  sel: '[data-recorrido="spy-tab-anuncios"]'
  titulo: 'Anuncios y funnel'
  texto: 'En Anuncios, lo que paga para mostrar. En Funnel, su oferta y sus páginas.'
  sub: 'Sus anuncios y su funnel tienen pestaña propia.'
  lado: abajo
- pestaña: spy
  sel: '[data-recorrido="spy-grilla"] button[aria-label="Ordenar"]'
  titulo: 'Ordenar'
  texto: 'Por más vistas, lo mejor queda primero. También filtras por rendimiento mínimo.'
  sub: 'Abajo está todo lo que publica. Ordénalo por más vistas.'
  lado: abajo
- pestaña: spy
  sel: '[data-recorrido="spy-grilla"] div[role="button"]'   # la primera pieza
  titulo: 'Hacer uno así'
  texto: 'Adentro ves sus números y su guion. Al pie está «Hacer uno así».'
  sub: 'Abre una pieza y toca Hacer uno así: Máko escribe el tuyo con tu oferta.'
  clic: true
  haz: 'Haz clic en la primera pieza'
  lado: arriba
```

## 10. Copywriting · `app-copywriting.html`

**Objetivo:** que replique un copy outlier con su oferta, o parta de una plantilla con estructura.
**Largo:** 73 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | El copy que vende casi nunca nace de una hoja en blanco. | Martín en su video chico. «Encuentra tu siguiente OUTLIER», sin marca. |
| 2 | Aquí tienes los outliers de las cuentas que sigues: anuncios, reels y videos de YouTube. | Pausa: marcado el filtro de formatos. |
| 3 | Arriba quedan los que más superaron a su autor. | Pausa: marcado «Mayor outlier». |
| 4 | ¿Prefieres partir de una base? Las plantillas ya traen la estructura: gancho, cuerpo y cierre. | Pausa: marcado «Plantillas con estructura». |
| 5 | Si viste uno afuera, pega su link o su texto. | Pausa: marcado «Pegar link o texto». |
| 6 | Elige uno, toca Replicar, y Máko lo reescribe para lo que vendes. | Pausa con clic: marcado el primer «Replicar», con «Haz clic en Replicar». |

```yaml
- pestaña: copywriting
  sel: '[aria-label="Qué ver"]'
  titulo: 'Por formato'
  texto: 'Anuncios, reels o YouTube: el número dice cuántos hay de cada uno.'
  sub: 'Aquí tienes los outliers de las cuentas que sigues: anuncios, reels y videos de YouTube.'
  lado: abajo
- pestaña: copywriting
  sel: 'button[aria-label="Orden"]'
  titulo: 'Mayor outlier'
  texto: 'Primero los que más rindieron contra lo normal de su cuenta.'
  sub: 'Arriba quedan los que más superaron a su autor.'
  lado: abajo
- pestaña: copywriting
  sel: '#copy-plantillas'
  titulo: 'Plantillas con estructura'
  texto: 'Anuncios, reels, stories, carruseles y emails, cada uno con su ejemplo.'
  sub: '¿Prefieres partir de una base? Las plantillas ya traen la estructura: gancho, cuerpo y cierre.'
  lado: abajo
- pestaña: copywriting
  sel: '[data-recorrido="tour-copywriting-pegar"]'
  titulo: 'Pegar link o texto'
  texto: 'Trae uno de afuera para replicarlo igual que los de la grilla.'
  sub: 'Si viste uno afuera, pega su link o su texto.'
  lado: abajo
- pestaña: copywriting
  sel: '[aria-label="Outliers de copy"] button'   # el primero: «Replicar» del primer anuncio
  titulo: 'Replicar'
  texto: 'Conserva la estructura que funcionó y la llena con lo tuyo.'
  sub: 'Elige uno, toca Replicar, y Máko lo reescribe para lo que vendes.'
  clic: true
  haz: 'Haz clic en Replicar'
  lado: derecha
```

## 11. Web Generator · `app-web.html`

**Objetivo:** que replique una página que ya convierte, adaptada a su negocio, o arranque de una plantilla.
**Largo:** 77 palabras, ~24 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Antes de diseñar tu página, mira las que ya convierten. | Martín en su video chico. La portada, sin marca. |
| 2 | Filtra por tipo: VSL, webinar, página de venta o agendar llamada. | Pausa: marcado «Tipo de página». |
| 3 | Pasa el cursor por una y la página baja entera, de punta a punta. | Pausa: marcada la página de Hormozi. |
| 4 | ¿Te gustó la de alguien más? Su link va en el buscador. | Pausa: marcado el buscador. |
| 5 | Si prefieres un diseño limpio, parte de una plantilla. | Pausa: marcado «Plantillas». |
| 6 | Tus páginas quedan en Mis landings. | Pausa: marcado «Mis landings». |
| 7 | Y con Replicar, la página se vuelve a armar para tu negocio, con tus textos. | Pausa con clic: marcado el primer «Replicar», con «Haz clic en Replicar». |

```yaml
- pestaña: web
  sel: '[aria-label="Tipo de página"]'
  titulo: 'Tipo de página'
  texto: 'Si vendes con una clase gratis, mira los Webinar. Si es con video, los VSL.'
  sub: 'Filtra por tipo: VSL, webinar, página de venta o agendar llamada.'
  lado: abajo
- pestaña: web
  sel: 'a[aria-label="Ver la página de @AlexHormozi"]'
  titulo: 'La página entera'
  texto: 'Arriba dice de quién es. Si es tu competencia, abre su ficha de Spy.'
  sub: 'Pasa el cursor por una y la página baja entera, de punta a punta.'
  lado: derecha
- pestaña: web
  sel: 'input[aria-label^="Buscar páginas"]'
  titulo: 'Pega un link'
  texto: 'Cualquier página pública: MaKo la trae para replicarla.'
  sub: '¿Te gustó la de alguien más? Su link va en el buscador.'
  lado: abajo
- pestaña: web
  sel: '#wg-plantillas'
  titulo: 'Plantillas'
  texto: 'Nueve diseños listos, con y sin video.'
  sub: 'Si prefieres un diseño limpio, parte de una plantilla.'
  lado: abajo
- pestaña: web
  sel: '[data-recorrido="tour-web-mis-landings"]'
  titulo: 'Mis landings'
  texto: 'Tus páginas, empezando por la última que tocaste. Cada una abre su editor.'
  sub: 'Tus páginas quedan en Mis landings.'
  lado: abajo
- pestaña: web
  sel: 'a[href^="/web-generator?replicar="]'   # el primero: la de acquisition.com
  titulo: 'Replicar'
  texto: 'Toma el orden de esa página y lo escribe para tu negocio.'
  sub: 'Y con Replicar, la página se vuelve a armar para tu negocio, con tus textos.'
  clic: true
  haz: 'Haz clic en Replicar'
  lado: arriba
```

## 12. Plan · `app-plan.html`

**Objetivo:** que trabaje cada día las cinco tareas prioritarias del Objetivo Principal y las complete.
**Largo:** 69 palabras, ~22 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Cuando todo parece urgente, el Plan te dice qué va primero. | Martín en su video chico. Prioridades, sin marca. |
| 2 | A la izquierda, tu Objetivo Principal: el proyecto que más mueve tu negocio ahora. | Pausa: marcada la tarjeta «Setup inicial de MaKo». |
| 3 | El perro te explica por qué lo eligió, en una línea. | Pausa: marcada la línea del perro. |
| 4 | A la derecha, las cinco tareas que tocan ahora, en orden. | Pausa: marcada la primera tarea. |
| 5 | Tus proyectos, las tareas sueltas y lo que se repite están en estas vistas. | Pausa: marcadas las cuatro vistas. |
| 6 | ¿Terminaste una? Toca Completar y sube la siguiente. | Pausa con clic: marcado «Completar» de la primera, con «Haz clic en Completar». |

```yaml
- pestaña: plan
  sel: '[data-recorrido="tour-plan-objetivo"]'
  titulo: 'Objetivo Principal'
  texto: 'El proyecto que manda ahora. Tócalo para ver sus tareas.'
  sub: 'A la izquierda, tu Objetivo Principal: el proyecto que más mueve tu negocio ahora.'
  lado: derecha
- pestaña: plan
  sel: '[data-razon-objetivo]'
  titulo: 'Por qué va primero'
  texto: 'El perro lo deja escrito para que no dudes.'
  sub: 'El perro te explica por qué lo eligió, en una línea.'
  lado: derecha
- pestaña: plan
  sel: '[data-prioridad="101"]'
  titulo: 'Las cinco de ahora'
  texto: 'Ordenadas por lo que más acerca el objetivo, sin las bloqueadas.'
  sub: 'A la derecha, las cinco tareas que tocan ahora, en orden.'
  lado: izquierda
- pestaña: plan
  sel: '[data-recorrido="tour-plan-vistas"]'
  titulo: 'Las vistas'
  texto: 'El mismo Plan, mirado de cuatro formas.'
  sub: 'Tus proyectos, las tareas sueltas y lo que se repite están en estas vistas.'
  lado: abajo
- pestaña: plan
  sel: 'button[aria-label^="Marcar «Conectar la agenda"]'
  titulo: 'Completar'
  texto: 'Al marcarla, la siguiente sube a su lugar.'
  sub: '¿Terminaste una? Toca Completar y sube la siguiente.'
  clic: true
  haz: 'Haz clic en Completar'
  lado: izquierda
```

## 13. Dashboard · `app-dashboard.html`

**Objetivo:** que arme su primera hoja, pidiéndola o desde una plantilla, para ver cada mañana lo que entró y lo que falta.
**Largo:** 71 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Tu Dashboard arranca vacío a propósito: tú eliges qué mirar cada mañana. | Martín en su video chico. La hoja en blanco, sin marca. |
| 2 | Pídele una hoja a Máko con tus palabras. Por ejemplo: lo que tengo que hacer hoy y a quién cobrarle. | Pausa: marcada la caja del pedido. |
| 3 | Hay plantillas para agencias, cursos, Instagram y más. Búscalas por nombre. | Pausa: marcado «Buscar plantilla». |
| 4 | Cada hoja que armes suma una pestaña arriba, para pasar de una a otra. | Pausa: marcadas las hojas. |
| 5 | Para empezar, usa General: lo que entró, lo que invertiste y quién te necesita. | Pausa con clic: marcada la plantilla General, con «Haz clic en la plantilla General». |

```yaml
- pestaña: dashboard
  sel: '[data-caja-pedido]'
  titulo: 'Pídela con tus palabras'
  texto: 'MaKo arma la hoja con los datos de tu negocio. Por escrito o dictado.'
  sub: 'Pídele una hoja a Máko con tus palabras. Por ejemplo: lo que tengo que hacer hoy y a quién cobrarle.'
  lado: abajo
- pestaña: dashboard
  sel: 'input[aria-label="Buscar plantilla"]'
  titulo: 'Más plantillas'
  texto: 'Agencia, curso, Instagram, cobranza y más: escribe el tema.'
  sub: 'Hay plantillas para agencias, cursos, Instagram y más. Búscalas por nombre.'
  lado: abajo
- pestaña: dashboard
  sel: 'nav[aria-label="Hojas del Dashboard"]'
  titulo: 'Tus hojas'
  texto: 'Focus es la primera. Cada hoja nueva queda al lado.'
  sub: 'Cada hoja que armes suma una pestaña arriba, para pasar de una a otra.'
  lado: abajo
- pestaña: dashboard
  sel: '[data-plantilla="general"]'
  titulo: 'General'
  texto: 'Lo cobrado contra lo invertido, quién te necesita y tus próximas llamadas.'
  sub: 'Para empezar, usa General: lo que entró, lo que invertiste y quién te necesita.'
  clic: true
  haz: 'Haz clic en la plantilla General'
  lado: arriba
```

## 14. Classroom · `app-classroom.html`

**Objetivo:** que arme el curso por etapas de entrega e invite a sus clientes para que lleguen al resultado.
**Largo:** 68 palabras, ~22 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Quien llega al resultado renueva y te recomienda. El curso es el camino. | Martín en su video chico. El curso, sin marca. |
| 2 | Cada módulo es una etapa de tu entrega: del onboarding hasta el final. | Pausa: marcado el primer módulo. |
| 3 | Suma uno y su etapa aparece sola en el tablero de Clients. | Pausa: marcado «+ Nuevo módulo». |
| 4 | Antes de mandarlo, míralo como lo ve tu cliente. | Pausa: marcado «Vista del alumno». |
| 5 | En Clients sigues en qué etapa está cada persona. | Pausa: marcado «Clients». |
| 6 | Y cuando el curso esté listo, invita a tus clientes desde aquí. | Pausa con clic: marcado «Invitar alumnos», con «Haz clic en «Invitar alumnos»». |

```yaml
- pestaña: classroom
  sel: '[data-recorrido="modulo"]'
  titulo: 'Módulos = etapas'
  texto: 'Onboarding, Arranque, Hitos y Entregado. Arrástralos para cambiar el orden.'
  sub: 'Cada módulo es una etapa de tu entrega: del onboarding hasta el final.'
  lado: derecha
- pestaña: classroom
  sel: '[data-recorrido="nuevo-modulo"]'
  titulo: 'Nuevo módulo'
  texto: 'Escribe el nombre y queda creado, con su etapa en Clients.'
  sub: 'Suma uno y su etapa aparece sola en el tablero de Clients.'
  lado: abajo
- pestaña: classroom
  sel: '[data-recorrido="vista-alumno"]'
  titulo: 'Vista del alumno'
  texto: 'El curso tal como lo ve quien te compró.'
  sub: 'Antes de mandarlo, míralo como lo ve tu cliente.'
  lado: abajo
- pestaña: classroom
  sel: 'a[href="/classroom/clients"]'
  titulo: 'Clients'
  texto: 'El tablero de tu entrega: cada cliente en su etapa.'
  sub: 'En Clients sigues en qué etapa está cada persona.'
  lado: abajo
- pestaña: classroom
  sel: '[data-recorrido="invitar"]'
  titulo: 'Invitar alumnos'
  texto: 'Elige entre tus clientes o suma a alguien nuevo.'
  sub: 'Y cuando el curso esté listo, invita a tus clientes desde aquí.'
  clic: true
  haz: 'Haz clic en «Invitar alumnos»'
  lado: abajo
```

## 15. AI Avatar · `app-avatar.html`

**Objetivo:** que complete «Antes de generar» y genere su primer avatar con su cara y un preset.
**Largo:** 75 palabras, ~24 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Tu cara, en escenas que nunca grabaste: en el auto, en un podcast, en la cocina. | Martín en su video chico. Los presets, sin marca. |
| 2 | Primero, lo que falta para generar. Son cuatro pasos, y la pantalla te marca cuál sigue. | Pausa: marcado «Antes de generar». |
| 3 | Elige un preset: cada uno trae la escena armada. | Pausa: marcado «Charla en el auto». |
| 4 | En Personaje va tu foto, de frente y con buena luz. | Pausa: marcado «Personaje». |
| 5 | Cuenta lo que pasa en la escena. | Pausa: marcada la caja de la escena. |
| 6 | Cada look que generes queda guardado detrás de esta flecha. | Pausa: marcada la flecha del chat. |
| 7 | Y cuando esté todo, toca Generar. | Pausa: marcado «Generar». |

```yaml
- pestaña: avatar
  sel: 'section[aria-label="Antes de generar"]'
  titulo: 'Antes de generar'
  texto: 'La extensión, la conexión, Google Flow y tu foto. Se marca cada uno cuando lo haces.'
  sub: 'Primero, lo que falta para generar. Son cuatro pasos, y la pantalla te marca cuál sigue.'
  lado: arriba
- pestaña: avatar
  sel: 'button[aria-label="Usar el preset Charla en el auto"]'
  titulo: 'Presets'
  texto: 'Cada uno trae el lugar, la luz y la cámara. Filtra por categoría arriba.'
  sub: 'Elige un preset: cada uno trae la escena armada.'
  lado: derecha
- pestaña: avatar
  sel: 'button[aria-label="Personaje: tu foto"]'
  titulo: 'Personaje'
  texto: 'Sube una foto tuya. MaKo usa tu cara en la escena.'
  sub: 'En Personaje va tu foto, de frente y con buena luz.'
  lado: arriba
- pestaña: avatar
  sel: 'textarea[aria-label="Describe la escena"]'
  titulo: 'La escena'
  texto: 'Qué haces y qué hay alrededor, en una o dos frases.'
  sub: 'Cuenta lo que pasa en la escena.'
  lado: arriba
- pestaña: avatar
  sel: 'button[aria-label="Ver tus proyectos de AI Avatar"]'
  titulo: 'Tus looks'
  texto: 'Cada generación queda aquí: recrear, descargar o borrar.'
  sub: 'Cada look que generes queda guardado detrás de esta flecha.'
  lado: derecha
- pestaña: avatar
  sel: '[data-recorrido="tour-avatar-generar"]'
  titulo: 'Generar'
  texto: 'Se prende cuando no falta nada. Si falta algo, el botón te dice qué.'
  sub: 'Y cuando esté todo, toca Generar.'
  lado: arriba
```

(«Generar» está deshabilitado en el dibujo. Por eso va con «Siguiente».)

## 16. Video · `app-video.html`

**Objetivo:** que arranque su primer video replicando un outlier con «Mensaje para…», guiado por MaKo.
**Largo:** 85 palabras, ~27 s

| # | Dice | Muestra |
|---|---|---|
| 1 | Para tu próximo video, parte de uno que ya funcionó. | Martín en su video chico. La pantalla de crear, sin marca. |
| 2 | ¿Ya sabes lo que quieres? Escríbelo en una línea y Máko lo arma. | Pausa: marcada la caja del pedido. |
| 3 | Cada plantilla de anuncio tiene su ejemplo: míralo antes de usarla. | Pausa: marcado «Ver ejemplo» de «Anuncio con gancho». |
| 4 | ¿Sin ganas de ponerte frente a la cámara? Tu personaje con IA lo hace por ti. | Pausa: marcado «Tu personaje con IA». |
| 5 | Y Mensaje para te lleva de la mano: Máko te pide la referencia, tu guion, tu foto y tu voz. | Pausa con clic: marcado «Mensaje para…», con «Haz clic en «Mensaje para…»». |
| 6 | El guion va en seis bloques, y cada uno te dice cuánto dura su clip. | Sigue marcado. |

```yaml
- pestaña: video
  sel: '[data-caja-pedido]'
  titulo: 'Pídelo en una línea'
  texto: 'Un reel de 30 segundos sobre tu programa, y MaKo lo arma.'
  sub: '¿Ya sabes lo que quieres? Escríbelo en una línea y Máko lo arma.'
  lado: abajo
- pestaña: video
  sel: 'button[aria-label="Ver un ejemplo de Anuncio con gancho"]'
  titulo: 'Ver ejemplo'
  texto: 'Así queda terminado, antes de que armes el tuyo.'
  sub: 'Cada plantilla de anuncio tiene su ejemplo: míralo antes de usarla.'
  lado: arriba
- pestaña: video
  sel: 'button[aria-label="Usar la plantilla Tu personaje con IA"]'
  titulo: 'Tu personaje con IA'
  texto: 'Desde tu foto, sin grabarte.'
  sub: '¿Sin ganas de ponerte frente a la cámara? Tu personaje con IA lo hace por ti.'
  lado: arriba
- pestaña: video
  sel: 'button[aria-label="Usar la plantilla Mensaje para…"]'
  titulo: 'Mensaje para…'
  texto: 'Replica un video que funcionó, paso a paso, con MaKo en el chat del editor.'
  sub: 'Y Mensaje para te lleva de la mano: Máko te pide la referencia, tu guion, tu foto y tu voz. El guion va en seis bloques, y cada uno te dice cuánto dura su clip.'
  clic: true
  haz: 'Haz clic en «Mensaje para…»'
  lado: derecha
```

## 17. Image · `app-image.html`

**Objetivo:** que cree su primer carrusel o miniatura con una plantilla que ya trae su marca. Hoy se dibuja la pantalla de crear, no los outliers.
**Largo:** 71 palabras, ~23 s

| # | Dice | Muestra |
|---|---|---|
| 1 | De aquí salen los carruseles que la gente guarda y las miniaturas que invitan a entrar. | Martín en su video chico. La pantalla de crear, sin marca. |
| 2 | Con una frase en la caja de arriba, Máko te arma la pieza. | Pausa: marcada la caja del pedido. |
| 3 | Cada plantilla ya trae el nombre de tu negocio. Sólo cambias el contenido. | Pausa: marcada la portada de «Lista o tips». |
| 4 | Con el ejemplo ves cómo queda terminada. | Pausa: marcado «Ver ejemplo». |
| 5 | Las miniaturas de YouTube vienen en dos versiones, para que pruebes cuál se toca más. | Pausa: marcada la primera miniatura. |
| 6 | Empieza por un carrusel: toca Usar plantilla. | Pausa con clic: marcada «Lista o tips», con «Haz clic en «Usar plantilla»». |

```yaml
- pestaña: image
  sel: '[data-caja-pedido]'
  titulo: 'Pide la pieza'
  texto: 'Algo como: un post para anunciar tu promo de esta semana.'
  sub: 'Con una frase en la caja de arriba, Máko te arma la pieza.'
  lado: abajo
- pestaña: image
  sel: 'span[aria-label="Lista o tips: portada"]'
  titulo: 'Con tu marca'
  texto: 'El nombre de tu negocio ya está puesto en cada lámina.'
  sub: 'Cada plantilla ya trae el nombre de tu negocio. Sólo cambias el contenido.'
  lado: derecha
- pestaña: image
  sel: 'button[aria-label="Ver un ejemplo de Lista o tips"]'
  titulo: 'Ver ejemplo'
  texto: 'El carrusel completo, lámina por lámina, como queda publicado.'
  sub: 'Con el ejemplo ves cómo queda terminada.'
  lado: arriba
- pestaña: image
  sel: 'button[aria-label="Usar la plantilla Miniatura · Resultado con cara · Coach"]'
  titulo: 'Miniaturas de YouTube'
  texto: 'Cada plantilla te da dos versiones para comparar.'
  sub: 'Las miniaturas de YouTube vienen en dos versiones, para que pruebes cuál se toca más.'
  lado: arriba
- pestaña: image
  sel: 'button[aria-label="Usar la plantilla Lista o tips"]'
  titulo: 'Tu primer carrusel'
  texto: 'Una idea por lámina: el más simple para empezar.'
  sub: 'Empieza por un carrusel: toca Usar plantilla.'
  clic: true
  haz: 'Haz clic en «Usar plantilla»'
  lado: derecha
```

---

## data-recorrido nuevos a agregar (los ids que faltan)

Son sólo los elementos que hoy no tienen ni `data-recorrido`, ni `aria-label`, ni otro atributo propio.

**app-ops-center.html**
- `tour-ops-center-que-hago-hoy`: el botón «¿Qué hago hoy?», el primero de `div.ch-arranques`, adentro de `sb-hilo`. Hoy se alcanza con `.ch-arranques button`.

**app-automations.html**
- `tour-automations-nueva`: el botón «＋ Nueva automatización» del `aside[aria-label="Tus automatizaciones"]`. En la app, `marcar` le pone `au-nueva`, pero sólo con el recorrido abierto (app/automations/recorrido-automations.ts). Hoy no tiene selector propio: el aside tiene tres botones.

**app-copilot.html**
- `tour-copilot-pasos`: `div.cop-ent__barra`, los tres puntos de avance arriba de «¿Por dónde vendes?».
- `tour-copilot-canales`: `div.cop-ent__ops`, con Anuncios · Instagram · YouTube. Hoy también responde a `[data-tres]`.
- `tour-copilot-seguir`: el botón «Seguir» (`.cop-ent__seguir`).

**app-copywriting.html**
- `tour-copywriting-pegar`: el botón «Pegar link o texto» del encabezado. Su clase sale de un CSS Module (`m18fa5ow_pastilla`) y cambia.

**app-web.html**
- `tour-web-mis-landings`: el botón «Mis landings» del encabezado.

**app-plan.html**
- `tour-plan-objetivo`: `div.mako-prio-obj`, la tarjeta del Objetivo Principal «🚀 Setup inicial de MaKo».
- `tour-plan-vistas`: el `div` con «prioridades · tareas · Proyectos · recurrentes» del encabezado. `[data-grupo-vista]` está vacío: las vistas son el `div` dos lugares antes.

**app-avatar.html**
- `tour-avatar-generar`: el botón «Generar» de `[aria-label="Crear avatar"]`. Su `title` cambia con lo que falta; hoy dice «Elige un preset.».

Las otras nueve páginas no necesitan ids nuevos.

## Lo que no está dibujado (para quien arma la maqueta)
- **Image y Video:** falta la vista de outliers. Por eso no hay `image-editor-outliers` ni `image-editor-replicar`, y los tutoriales usan la pantalla de crear.
- **Spy:** no están «Lo que mejor le fue» (`spy-mejores` aparece sólo en el CSS) ni el detalle de una pieza con «Hacer uno así».
- **CRM:** no aparece `crm-funnels`.
- **Offer:** no aparecen «Armar mi oferta» ni «Ver mi oferta».
- **AI Avatar y Offer** no están en la barra dibujada. Se llega por Video («Tu personaje con IA») y por el Ops Center.

## Para cosechar
Este encargo era de sólo lectura y no escribí en el repo. Va a `docs/hallazgos-ui.md`, en la entrada de las pestañas en HTML:
- Otro chat corre `armar.mjs` y rehace `publicar/` mientras uno lee: `app-video.html` desapareció unos segundos (ENOENT). Conviene copiar la carpeta antes de leerla.
- Los ids de `useId` (`#_mkc-R_18p_-0`, `#_mkc-R_51_-0`) y los `#co-msg-…` cambian en cada render. No sirven para marcar.
- Contar un `data-recorrido` con grep engaña: `spy-mejores` da 18 coincidencias y ninguna es un elemento. Hay que contar con un parser.
- Los `au-*` de Automations no están en el HTML estático.

El comprobador de selectores y la copia que usé están en `C:\Users\marti\AppData\Local\Temp\claude\fb1d94a1aca5ced3\f67d6482-c146-477b-980a-dbe449a0bb56\scratchpad\` (`chequear.cjs`, `pub\`). Sirven para volver a correrlo cuando cambien las páginas.