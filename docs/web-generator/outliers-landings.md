# Outliers de landings: el relevo (11/11/2026)

Pedido de Martín (11/11, por el Cerebro): «generar lo mismo que venimos haciendo con el resto de tabs, de outliers, para sacar
outliers de páginas que estén buenas… empezar por la competencia… por las páginas de todos los gurús. Puedes googlear y
encontrarlas… hacer un relevo de páginas que nos podrían llegar a interesar, y ponerlas ahí como outlier».

**Dónde se ven:** la portada de Web Generator (`/web-generator`, «Encuentra tu siguiente OUTLIER», `app/web-generator/OutliersLandings.tsx`),
adentro del armazón de Create (el chat de MaKo a la izquierda: `app/web-generator/PortadaWeb.tsx`), con las plantillas arriba.
Cada tarjeta muestra la CAPTURA LARGA de la página (la página entera) y la baja sola al pasar el cursor.

**De dónde salen** (`lib/landing-outliers-servidor.ts` y `lib/landing-outliers-datos.ts`):

1. **Tu competencia**: las landings de los competidores que el negocio sigue en Competitors Spy, primero, si tienen su captura
   larga. Las que no, esperan (la portada dice cuántas) y se sacan con el script de abajo.
2. **El relevo**: las del manifiesto `lib/landing-outliers-capturas.json`, cada una con su captura en
   `public/web-generator/outliers/largas/<id>.webp`, mirada antes de entrar: gurús y referentes del nicho, la competencia de
   cada función de MaKo (`docs/competencia/landings-por-funcion.md`) y las de los competidores que siguen los negocios en Spy.
   Las que quedaron afuera, con su motivo: `docs/web-generator/outliers-capturas-afuera.md`.

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

Ninguna pieza de landing de Spy tiene miniatura guardada. Hasta la noche del 11/11 la tarjeta usaba la `og:image` de la página (la de viralidad.com es un recuadro negro con su logo): desde entonces cada una entra con su captura larga, sacada por el script.

## Las 52 que entran (11/11/2026)

En español primero. El titular va TAL CUAL está en la página.

| De quién | Tipo | Idioma | De dónde | Titular (link) | Captura |
|---|---|---|---|---|---|
| Clara Pérez (High Ticket Clarity) | Webinar | es | Relevo | [Imagina agregar 10K AL MES a tu facturación](https://clase.highticketclarity.com/) | 3848 px |
| Clara Pérez (High Ticket Clarity) | VSL | es | Relevo | [Sin publicidad y sin reels virales: las claves para escalar tu negocio en redes](https://vender-en-redes.highticketclarity.com/) | 1105 px |
| Josué Peña (Digital Closer Academy) | Webinar | es | Relevo | [Las Empresas Están Contratando Personas Para Atender Sus Llamadas de Ventas](https://masterclassdeventas.com/) | 1680 px |
| Programa Momentum | VSL | es | Relevo | [Genera una nueva línea de ingresos](https://programa.formacionmomentum.com/video) | 1265 px |
| Vilma Núñez | Página de venta | es | Relevo | [Ya no basta con chatear con la IA. Tienes que saber construir con ella.](https://ai.vilmanunez.com/ai-training) | 4500 px |
| Franck Scipion (La Transformateca) | Página de venta | es | Relevo | [¿TE FALTA CLARIDAD SOBRE LOS PASOS QUE TIENES QUE DAR PARA LLEGAR A TU METAS?](https://latransformateca.com/sesion-estrategica/) | 4500 px |
| Oscar Feito | Lead magnet | es | Relevo | [MILLONES DE PROFESIONALES YA ESTÁN CREANDO UN PLAN «B» PARA COMPLEMENTAR SU SUELDO Y VIVIR](https://www.oscarfeito.com/) | 4500 px |
| HeyGen | Página de venta | es | Competencia de MaKo | [Anuncios de video estilo UGC que generan conversiones sin contratar creadores](https://www.heygen.com/es-mx/business/marketing/ugc-video-ads) | 4500 px |
| Arcads | Sitio | es | Competencia de MaKo | [Genera winning ads con Arcads 3.0](https://www.arcads.ai/es) | 4500 px |
| Creatify | Sitio | es | Competencia de MaKo | [Anuncios de IA que ganan.](https://creatify.ai/es) | 4500 px |
| Novoads | Sitio | es | Competencia de MaKo | [Tu próximo anuncio está a 4 minutos](https://novoads.ai/es) | 4476 px |
| Leadsales | Sitio | es | Competencia de MaKo | [CRM para WhatsApp, Facebook e Instagram](https://leadsales.io/) | 4500 px |
| respond.io | Sitio | es | Competencia de MaKo | [Los clientes preguntan por chat. Llama para más detalles. Confirma por correo electrónico.](https://respond.io/es) | 3914 px |
| Kommo | Sitio | es | Competencia de MaKo | [Potencia tus chats, evita todo el caos](https://www.kommo.com/es/) | 3869 px |
| Darwin AI | Sitio | es | Competencia de MaKo | [Delega las conversaciones con clientes a los empleados-IA](https://www.getdarwin.ai/) | 4500 px |
| Clint | Sitio | es | Competencia de MaKo | [El CRM de ventas y atención al cliente que simplifica y acelera tus resultados](https://clint.digital/es) | 4500 px |
| SetSmart | Sitio | es | Competencia de MaKo | [Tu AI setter convierte tus DM de Instagram en llamadas de venta calificadas](https://setsmart.io/es) | 4500 px |
| Voicit | Sitio | es | Competencia de MaKo | [De reuniones y entrevistas a grandes resultados con IA. Sin bots.](https://voicit.com/) | 3748 px |
| Master Ads | Sitio | es | Competencia de MaKo | [“Master, que las campañas de la empresa mejoren”.](https://masterads.ai/) | 2415 px |
| SaleADS | Sitio | es | Competencia de MaKo | [A 52 segundos de... más ventas](https://saleads.ai/es) | 4500 px |
| Reportei | Sitio | es | Competencia de MaKo | [Crea Informes y Dashboards de Marketing Digital en 3 segundos](https://reportei.com/es/) | 4500 px |
| Cherry Studio | Sitio | es | Competencia de MaKo | [Cherry Studio tu contenido, de la idea a los resultados](https://cherrysweet.app/) | 4328 px |
| PostNitro | Sitio | es | Competencia de MaKo | [El creador de carruseles con IA que diseña y programa tus publicaciones.](https://postnitro.ai/es) | 4500 px |
| Motion Ads (Impultienda) | Página de venta | es | Competencia de MaKo | [Tu primer anuncio en motion graphics en menos de 1 hora. Sin saber editar.](https://motionads.impultienda.ar/) | 4500 px |
| Vilma Núñez (Journi) | Evento | es | Spy | [Tu experiencia ya tiene valor. Haz que tu marca personal lo demuestre.](https://ai.digitaljourni.com/tallermarcapersonal) | 4500 px |
| Julio Iero | Sitio | es | Spy | [Si quieres que el 2026 sea el año en que vendas todos los días desde tus redes sociales…](https://julioiero.com/) | 4416 px |
| Víctor Heras (Viralidad) | VSL | es | Spy | [El método viral que utilizan gurús e influencers de redes sociales para ganar 100.000 Segu](https://www.viralidad.com/) | 2791 px |
| Titto Gálvez | Lead magnet | es | Spy | [¿Cuántos días aguanta tu negocio sin ti?](https://tittogalvez.online/) | 1156 px |
| Alex Hormozi (Acquisition.com) | Libro | en | Relevo | [THE $100M BOOK SERIES](https://www.acquisition.com/books) | 1476 px |
| Iman Gadzhi (Monetise) | Página de venta | en | Relevo | [Let My AI System Build You A Profitable Digital Product](https://www.monetise.com/) | 4500 px |
| Russell Brunson | Libro | en | Relevo | [How To Launch And Scale Your Company Online With Simple Sales Funnels...!](https://www.dotcomsecrets.com/) | 794 px |
| Russell Brunson | Libro | en | Relevo | [Find Your Message... Build A Tribe, And Change The World!](https://www.expertsecrets.com/) | 4500 px |
| Sabri Suby | Libro | en | Relevo | [Breaking News: Shark Tank Investor Releases 10,000 Copies of His $10.2 Billion 'Selling Sy](https://selllikecrazybook.com/free/) | 4500 px |
| Dan Henry | Agendar llamada | en | Relevo | [READY TO SCALE YOUR BUSINESS?](https://www.getclients.com/) | 1004 px |
| Alex Becker (Hyros) | Agendar llamada | en | Relevo | [Tracking that grows ads Custom Made For You.](https://hyros.com/) | 3258 px |
| Grant Cardone | Webinar | en | Relevo | [How to Find, Fund, and Close Your First Real Estate Deal in 2026](https://cardonefreetraining.com/) | 2039 px |
| Grant Cardone | Evento | en | Relevo | [10X Your Business](https://10xbusinesslive.com/business-summit-main-2027) | 2923 px |
| Tony Robbins | Evento | en | Relevo | [Unleash the Power Within](https://www.tonyrobbins.com/events/unleash-the-power-within/) | 4500 px |
| HeyGen | Sitio | en | Competencia de MaKo | [AI videos starring you, made in minutes](https://www.heygen.com/) | 4500 px |
| HighLevel | Sitio | en | Competencia de MaKo | [The AI-powered business operating system](https://www.gohighlevel.com/) | 4500 px |
| HighLevel AI Studio | Página de venta | en | Competencia de MaKo | [Websites powered by AI Studio](https://www.gohighlevel.com/ai-studio) | 4500 px |
| iClosed | Sitio | en | Competencia de MaKo | [Triple your leads using high-converting Scheduler](https://www.iclosed.io/) | 4500 px |
| Fastlane | Sitio | en | Competencia de MaKo | [Your next winning ad on autopilot](https://www.usefastlane.ai/) | 4500 px |
| Holo | Sitio | en | Competencia de MaKo | [Your Marketing Department. One Hire.](https://tryholo.ai/) | 4500 px |
| Gethookd | Sitio | en | Competencia de MaKo | [Give Your AI 22 Million Live Meta Ads](https://www.gethookd.ai/) | 4500 px |
| Foreplay | Sitio | en | Competencia de MaKo | [The Complete Winning Ad Workflow](https://www.foreplay.co/) | 4500 px |
| The Copy Machine (The Operator Stack) | Página de venta | en | Competencia de MaKo | [100 years of copywriting, installed into your AI.](https://theoperatorstack.io/copy-machine) | 4500 px |
| Motion | Sitio | en | Competencia de MaKo | [Get an unfair advantage by using AI to double productivity](https://www.usemotion.com/) | 4500 px |
| Atlas AI (Done For You) | VSL | en | Competencia de MaKo | [How I Build Profitable OFFERS in Hours — Not Months](https://go.doneforyou.com/offer-formula) | 2890 px |
| beehiiv | Sitio | en | Competencia de MaKo | [NEWSLETTERS. PODCASTS. COMMUNITY. ONE PLATFORM.](https://www.beehiiv.com/) | 4500 px |
| Acquisition.com (Alex y Leila Hormozi) | Sitio | en | Spy | [DO YOU WANT TO SCALE YOUR BUSINESS?](https://www.acquisition.com/) | 1729 px |
| Leila Hormozi (Acquisition.com) | Lead magnet | en | Spy | [THE 5 FRAMEWORKS I USE TO SCALE OUR TEAMS. YOURS FREE.](https://lp.acquisition.com/leila-frameworks) | 1374 px |

## Las del relevo de la mañana que quedaron afuera (capturas chicas, 11/11)

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

1. `node --env-file=<.env con DATABASE_URL> --import tsx scripts/capturas-outliers-landings.mjs` saca las que faltan (las de
   Spy de todos los negocios y las del documento; `--url <url>` para una suelta). Una entrada nueva llega con `"revisar": true`
   y la portada no la muestra.
2. Mirar su hoja (`--vistas <carpeta>`): si no se ve la landing de verdad (en blanco, negra, un logo, sólo texto, bloqueada),
   se borra y va a la lista de afuera con su motivo. Si sirve, escribir `nicho` y `porque` (una frase en neutro) y sacarle `revisar`.
3. `tests/web-generator-outliers.test.ts` exige la captura, el titular, el por qué y el tipo de cada una.
