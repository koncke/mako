# Outliers de landings: el relevo (11/11/2026)

Pedido de Martín (11/11, por el Cerebro): «generar lo mismo que venimos haciendo con el resto de tabs, de outliers, para sacar
outliers de páginas que estén buenas… empezar por la competencia… por las páginas de todos los gurús. Puedes googlear y
encontrarlas… hacer un relevo de páginas que nos podrían llegar a interesar, y ponerlas ahí como outlier».

**Dónde se ven:** la portada de Web Generator (`/web-generator`, «Encuentra tu siguiente OUTLIER»,
`app/web-generator/OutliersLandings.tsx`), copiada de la de Video y la de Image: la misma grilla y la misma tarjeta.
**De dónde salen** (`lib/landing-outliers-servidor.ts`):

1. **Tu competencia**: las landings de los competidores que el negocio sigue en Competitors Spy (`spy_competidores.landing_url`),
   primero. Su imagen es la que la misma página publica para compartirse (`og:image`); sin ella, la tarjeta dibuja el sitio.
2. **El relevo**: las de abajo, de los gurús y referentes del nicho, con su captura en `public/web-generator/outliers/`
   (`node --import tsx scripts/capturas-outliers-landings.mjs`) y su lugar en `RELEVO` (`lib/landing-outliers.ts`).

«Replicar» abre Replicar con esa página arrancando sola (`/web-generator?replicar=<url>`), el mismo camino que «Copiar su sitio»
de Spy.

## La competencia en Spy, medida en producción el 11/11/2026

| Negocio | Competidor | Landing | ¿Entra? |
|---|---|---|---|
| ws 3 (Cliente de Prueba) | Acquisition.com | https://www.acquisition.com/ | Sí |
| ws 3 | Leila Hormozi | https://lp.acquisition.com/leila-frameworks | Sí (sin los `utm_`) |
| ws 9 (MaKo) | Leila Hormozi | https://lp.acquisition.com/leila-frameworks | Sí |
| ws 9 | Víctor Heras | http://www.viralidad.com | Sí (daba 500 el 9/11) |
| ws 9 | Den Borg | https://beacons.page/denborg | No: link en la bio |
| ws 9 | Agencia Generación de Leads | https://www.bastidafarina.com/linktree-bf/ | No: link en la bio |
| ws 9 | Federico Cristofari | https://linktw.in/pywydg | No: acortador de la bio |
| ws 11 (Leila) | Vilma Núñez | https://ai.digitaljourni.com/tallermarcapersonal | Sí |
| ws 11 | Julio Iero | https://julioiero.com/ | Sí |
| ws 11 | Víctor Heras | http://www.viralidad.com | Sí |
| ws 11 | Tito Gálvez | https://tittogalvez.online | Sí |

Ninguna pieza de landing de Spy tiene miniatura guardada: por eso la imagen de la competencia es su `og:image`.

## El relevo de gurús y referentes

Verificadas el 11/11/2026: cada una abre sin login y vende algo (relevo hecho con búsqueda web y la página leída). El titular va
TAL CUAL está en la página, en su idioma. En español primero.

| De quién | Nicho | Tipo | Idioma | Titular (link) | Por qué funciona | Captura |
|---|---|---|---|---|---|---|
| Clara Pérez (High Ticket Clarity) | Coaches high ticket | Webinar | es | [Imaginá agregar 10K AL MES a tu facturación](https://clase.highticketclarity.com/) | Resultado concreto para un público muy definido (coaches, consultoras y dueñas de agencia), una masterclass en vivo que se da una sola vez y cupos limitados. | `clara-perez-clase` |
| Clara Pérez (High Ticket Clarity) | Coaches high ticket | VSL | es | [Sin publicidad y sin reels virales: las claves para escalar tu negocio en redes](https://vender-en-redes.highticketclarity.com/) | La clase gratis de 11 minutos queda detrás de un formulario que califica (facturación, seguidores, problema), y después el equipo te contacta por WhatsApp: precalifica antes de vender. | `clara-perez-vsl` |
| Josué Peña (Digital Closer Academy) | Closers de ventas | Webinar | es | [Las Empresas Están Contratando Personas Para Atender Sus Llamadas de Ventas](https://masterclassdeventas.com/) | Gancho de oportunidad laboral con la comisión por llamada en el subtítulo, masterclass en vivo con fecha y hora, testimonios con país y el botón de reservar repetido en toda la página. | `masterclass-de-ventas` |
| Programa Momentum | Eventos presenciales | VSL | es | [Genera una nueva línea de ingresos](https://programa.formacionmomentum.com/video) | Embudo VSL en dos pasos (ver el video y agendar la llamada) con un filtro de facturación mínima para atraer sólo negocios que ya venden. | `momentum-vsl` |
| Vilma Núñez | IA para negocios | Página de venta | es | [Ya no basta con chatear con la IA. Tienes que saber construir con ella.](https://ai.vilmanunez.com/ai-training) | Titular que rompe una creencia («chatear» contra «construir»), video corto de la autora, método con nombre propio, precio bajo de pago único con descuento y bonos. | `vilma-ai-training` |
| Juan Lombana (Mercatitlán) | Video con IA | Webinar | es | [Haz videos que sí venden, en minutos y sin saber editar](https://ia.mercatitlan.com/registro) | Promesa concreta y sin fricción (videos que venden, con IA y sin saber editar), masterclass gratuita de una hora y muchos testimonios con nombre y oficio. | `mercatitlan-ia` |
| Franck Scipion (La Transformateca) | Negocios digitales | Página de venta | es | [¿TE FALTA CLARIDAD SOBRE LOS PASOS QUE TIENES QUE DAR PARA LLEGAR A TU METAS?](https://latransformateca.com/sesion-estrategica/) | Titular en forma de pregunta sobre el dolor, una sesión de pago con un entregable claro (plan a 12 meses), el cliente ideal bien descrito y escasez real de pocas plazas al mes. | `transformateca` |
| Oscar Feito | Negocio online | Lead magnet | es | [MILLONES DE PROFESIONALES YA ESTÁN CREANDO UN PLAN «B» PARA COMPLEMENTAR SU SUELDO Y VIVIR MEJOR…](https://www.oscarfeito.com/) | Página de captura que abre con prueba social («millones ya lo hacen»), regala una hoja de ruta a cambio del correo y muestra testimonios con nombre y empresa. | `oscar-feito` |
| Isra Bravo | Copywriting | Lead magnet | es | [Desde 2017 mando un email diario.](https://www.israbravo.com/) | Lo mínimo posible: una frase que da autoridad por constancia y un solo campo de correo, sin promesas ni diseño, para vender después con el correo diario. | `isra-bravo` |
| Alex Hormozi (Acquisition.com) | Ofertas y leads | Libro | en | [THE $100M BOOK SERIES](https://www.acquisition.com/books) | Regala los audiolibros a cambio del correo y un curso en video por cada libro, y desde ahí escala hacia los workshops presenciales. | `hormozi-libros` |
| Iman Gadzhi (Monetise) | Productos digitales con IA | Página de venta | en | [Let My AI System Build You A Profitable Digital Product](https://www.monetise.com/) | Promesa grande que responde la objeción en el subtítulo (sin experiencia y sin mostrar la cara), pila de valor con software y bonos, garantía de seguir hasta que ganes y cierre con cuenta regresiva. | `monetise` |
| Russell Brunson | Embudos | Libro | en | [How To Launch And Scale Your Company Online With Simple Sales Funnels...!](https://www.dotcomsecrets.com/) | El clásico «gratis + envío»: video de venta arriba, respaldos de figuras conocidas, bonos con valor declarado, garantía de devolver el envío y escasez por tirada limitada. | `dotcom-secrets` |
| Russell Brunson | Expertos y coaches | Libro | en | [Find Your Message... Build A Tribe, And Change The World!](https://www.expertsecrets.com/) | La misma estructura de libro gratis + envío, con testimonios de alumnos con nombre, cinco bonos con valor declarado, una garantía con nombre propio y ventas adicionales en el pago. | `expert-secrets` |
| Sabri Suby | Marketing y ventas | Libro | en | [Breaking News: Shark Tank Investor Releases 10,000 Copies of His $10.2 Billion 'Selling System' For Free](https://selllikecrazybook.com/free/) | Titular en formato noticia con el libro gratis y sólo el envío a tu cargo, tres bonos apilados, garantía de devolver el envío y escasez de stock limitado. | `sell-like-crazy` |
| Sabri Suby (King Kong) | Agencia de marketing | Agendar llamada | en | [Last Step: Schedule Your Free 30-Min Strategy Session Call Now](https://kingkong.co/30-minute-strategy-session/) | Página de «último paso» que regala la sesión y un mapa de crecimiento, con un formulario por pasos que califica presupuesto, facturación y compromiso antes de dejarte agendar. | `king-kong-sesion` |
| Dan Henry | Escalar negocios | Agendar llamada | en | [READY TO SCALE YOUR BUSINESS?](https://www.getclients.com/) | Una aplicación corta que filtra por facturación y reemplaza la llamada de ventas por un chat de WhatsApp en 24 horas, sin la fricción de agendar. | `get-clients` |
| Alex Becker (Hyros) | Seguimiento de anuncios | Agendar llamada | en | [Tracking that grows ads Custom Made For You.](https://hyros.com/) | Software presentado como servicio a medida con llamada de demo, logos de marcas conocidas como prueba social y la garantía «resultados o no pagas». | `hyros` |
| Grant Cardone | Inversión inmobiliaria | Webinar | en | [How to Find, Fund, and Close Your First Real Estate Deal in 2026](https://cardonefreetraining.com/) | Webinar en vivo con una promesa de tres verbos (encontrar, financiar, cerrar), un libro de regalo por registrarte, cuenta regresiva y cupos limitados. | `cardone-webinar` |
| Grant Cardone | Negocios | Evento | en | [10X Your Business](https://10xbusinesslive.com/business-summit-main-2027) | Evento de 3 días con una promesa concreta (los 7 sistemas que le faltan a tu negocio), entradas por niveles, cuenta regresiva y un nivel agotado como escasez. | `cardone-10x` |
| Tony Robbins | Desarrollo personal | Evento | en | [Unleash the Power Within](https://www.tonyrobbins.com/events/unleash-the-power-within/) | Evento con precios por niveles, agenda día por día, testimonios de asistentes y una oferta 2x1 por tiempo limitado que empuja a comprar. | `robbins-upw` |

### Verificadas pero FUERA de la grilla por ahora (sin una captura limpia)

Abren para una persona; la captura automática salió mal (se miró la hoja de contacto, 11/11/2026). No se esquiva el control de
robots de nadie: se pueden sacar a mano desde Chrome cuando haya turno y sumarse.

| Página | Por qué quedó afuera |
|---|---|
| https://www.acquisition.com/workshop-4b (Hormozi, workshop) | El cartel de cookies (Cookiebot) tapa la mitad de la captura |
| https://thebigschool.com/master-funnel-de-ventas/ (Romuald Fons) | El cartel de privacidad tapa el medio |
| https://thebigschool.com/curso-marketing-ia-eg/ (Romuald Fons) | El cartel de privacidad tapa el medio |
| https://anaivars.com/mentoria-privada/ (Ana Ivars) | Un aviso emergente («Lista prioritaria») tapa la página |
| https://www.bossmovesbook.com/getmycopy2 (Myron Golden) | ClickFunnels bloquea al Chrome automático («Sorry, you have been blocked») |
| https://www.trafficsecrets.com/ (Russell Brunson) | Igual: bloqueada |
| https://www.consulting.com/ (Iman Gadzhi) | No terminó de cargar en 60 s, dos veces |

## El criterio

- **Que venda algo:** una página de venta, un webinar, una aplicación a una llamada, un libro gratis + envío, un evento. No un
  home institucional sin oferta.
- **Que se vea la estructura:** titular, video o imagen, beneficios, prueba, llamado a la acción. Es lo que Replicar copia.
- **Sin link en la bio, sin login, sin captcha.**
- **La competencia de cada negocio va primero**, y una del relevo que el negocio ya sigue en Spy no se repite.

## Cómo sumar una

1. Agregarla a `RELEVO` en `lib/landing-outliers.ts` (id, url, de quién, nicho, tipo, titular tal cual, por qué funciona en una
   frase, en neutro).
2. `node --import tsx scripts/capturas-outliers-landings.mjs <id>` saca su captura (Chrome sin ventana, perfil temporal) a
   `public/web-generator/outliers/<id>.jpg`.
3. Sumarla a la tabla de arriba. `tests/web-generator-outliers.test.ts` exige la captura y esta fila.
