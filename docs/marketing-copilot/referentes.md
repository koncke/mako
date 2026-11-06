# Qué enseña cada referente del Marketing CoPilot (medido el 6/11/2026)

> **La fuente es el código:** `lib/media-buyer/copiloto-referentes.ts` (`QUE_ENSENA`, un `Record` total sobre los 32 referentes de
> `lib/asesores/catalogo.ts`). Esta página es la foto del día en que se midió, con el método. Si no coinciden, gana el código, y esta
> tabla se vuelve a generar.

Martín, 6/11/2026: «en los gurus, no creo que hayas puesto a todos, pusiste a pocos... Y fijate bien, porque por ejemplo Doglio, no
creo que te enseñe a hacer webinar, o si?... El enseña organico en Instagram, estrategia de stories, etc...».

## Cómo se midió

1. **Las clases de cada curso** (`lib/asesores/cursos.ts` → `CURSO_DE_REFERENTE`, y los títulos en `lib/asesores/clases-de-referentes.json`).
2. **Lo que se dice en ellas:** las transcripciones de `public/cono-tx/<video>.json`, contando menciones por familia de tema
   (historias, reels, Instagram, webinar, anuncios, YouTube, TikTok, la llamada de venta, SEO) por cada 100.000 caracteres. La columna
   «Menciones» sólo muestra las familias con 8 o más.
3. **La ficha que lee el agente** (`lib/asesores/ficha-*.ts`): un funnel entra en la lista de un referente **sólo si su curso lo
   enseña (evidencia: un título de clase) Y su ficha trae ese marco**. Si el curso lo enseña y la ficha no, va en la nota y no se ofrece:
   el agente no puede guiar con un método que no tiene escrito.
4. `tests/marketing-copilot-referentes.test.ts` vuelve a mirar cada evidencia contra los títulos reales y cada funnel contra los marcos
   de la ficha. Un funnel nuevo sin evidencia, o sin marco, da rojo.

## Doglio: Martín tenía razón a medias

Lo fuerte de **ARCADIA** son las **historias de Instagram** (la clase «2. Estrategias de Promoción de Ventas» es un ciclo de promoción
de siete días por historias: 26 menciones en esa sola clase) y los **setters** que llevan la conversación a la llamada. Pero el curso
**también** trae siete clases de webinar («1. Playbook de webinar urgencia y ventas», «2. Estructuras de Webinar B2B y B2C», …). Así que
con Doglio se ofrecen **Orgánico en Instagram** y **Webinar**, en ese orden, y la pregunta dice qué enseña: «Francisco Doglio enseña
historias de Instagram que venden, setters y webinars. ¿Cuál de sus estrategias armamos?».

Su ficha no tenía las historias (sólo setters y webinar): se le sumó el marco «El ciclo de promoción por historias»
(`lib/asesores/ficha-francisco-doglio.ts`).

## Qué pasa en la charla y en el agente

- **Elegido un referente, sólo se ofrecen sus estrategias** (`funnelsOfrecidos`). Uno con una sola va directo a ella; uno que enseña
  otra parte de la venta (la oferta, la llamada, el SEO) lo dice y pregunta con qué funnel se consiguen los clientes.
- **Si se pide algo que no enseña** («quiero vender con compra directa» con Doglio), MaKo lo dice sin IA y propone quién sí lo enseña
  (`textoDeFuera`): «Francisco Doglio no enseña compra directa en «ARCADIA». Lo enseñan Juan Osorio (Juan ADS), Felipe Vergara y Álvaro
  Luque.», con «Seguir a…», «Compra directa sin referente» y «Seguir con Francisco Doglio».
- **El agente lee la tabla, no la ficha entera de cualquiera** (`lib/media-buyer/copiloto-contexto.ts`): el bloque «QUIÉN ENSEÑA QUÉ» va
  siempre; la ficha del referente viaja sólo si enseña el funnel elegido (o si todavía no hay funnel, o si enseña otra parte de la
  venta); y la ficha de base de cada funnel (`FICHA_POR_FUNNEL`) sólo si el referente no lo cubre.
- **«Inspirado en X»** aparece sólo cuando X enseña el funnel que se armó (`ensenaElFunnel`), en la charla, la propuesta y Ajustes.

## La ficha de base de cada funnel (sin referente, o con uno que no lo enseña)

| Funnel | Ficha | Por qué ésa |
|---|---|---|
| VSL con llamada | Marcos Razzetti | su ficha trae el VSL y la sesión estratégica; Juan ADS enseña la campaña, no el VSL |
| Anuncios a mensajes | Felipe Vergara | el presupuesto desde la meta y el cierre por WhatsApp |
| Anuncios a formulario | Marcos Razzetti | la carnada y el filtro antes de la sesión |
| Compra directa | Juan Osorio (Juan ADS) | campañas de ventas y escala |
| Webinar | Francisco Doglio | sus clases de webinar (playbook y estructuras) |
| Lead magnets | Sofía Contreras | farming de leads y el embudo siempre activo |
| YouTube | Sergio Begueria | YouTube de marca personal (no canales que viven del CPM, que es lo de Derek) |
| Instagram orgánico | Julián Otálora | ganchos, guiones y pilares |

## La tabla (32 referentes)

Primero los que arman un funnel para conseguir clientes; después los que enseñan otra parte de la venta. «(N)» = clases del curso.

| Referente | Curso | Funnels que se ofrecen | Qué enseña | Canal | Para quién | Evidencia (títulos de clase) | Menciones por 100k | Nota |
|---|---|---|---|---|---|---|---|---|
| Juan Osorio | Metodología JADS (109) | Anuncios a mensajes, Compra directa | campañas en Meta: fases, públicos, microexperimentación y escala | Meta Ads | Servicios y productos que venden con anuncios | «Objetivos 3 - Interacción-Mensajes»; «Objetivos 6 - Ventas»; «Microexperimentación Horizontal» | anuncios 133, instagram 24 | Enseña a armar y escalar las campañas, no la página ni la llamada. Su curso trae el objetivo de clientes potenciales (formularios), pero su ficha no: el formulario no se ofrece con él. |
| Julián Otálora | Método Contenido Irresistible (38) | Instagram orgánico | contenido orgánico: ganchos, guiones de reel y pilares | Instagram (reels) | Productos, servicios y marca personal | «1. Creación de contenido Orgánico»; «13. Tipos de ganchos»; «14. Pilares de contenido» | reels 35, instagram 13, anuncios 9 | |
| Sofía Contreras | MasteryHaus (224) | Lead magnets | marketing perpetuo: nicho, oferta y un embudo siempre activo | Contenido, correo y anuncios | Coaches y consultores de alto valor | «Estrategia Farming de Leads»; «Email Marketing: Captación de leads»; «Funnel Cálido Individual a Llamada» | youtube 16, anuncios 14, instagram 8, llamada 8 | Su curso trae «Formulario de Aplicación a Llamada», pero su ficha en MaKo no tiene ese marco: el formulario no se ofrece con ella. |
| Marcos Razzetti | Agencia 6 Cifras (98) | Anuncios a formulario, VSL con llamada, Lead magnets | captar clientes para una agencia: carnada, filtro y sesión estratégica | Meta Ads e Instagram | Agencias de marketing | «05 Cómo crear funnels que conviertan desconocido»; «06 Cómo crear y lanzar campañas de anuncios»; «10. COMO PERSUADIR POR HISTORIAS» | anuncios 46, instagram 40, historias 12 | |
| Víctor Heras | Master Marca Personal 5.0 (92) | Instagram orgánico | marca personal: contenido viral, historias y la llamada | Instagram | Expertos con marca personal | «9. Tres Claves para hacer contenido viral»; «9. Estructura ViralCopy»; «10. Ganchos virales» | instagram 21, historias 14, llamada 10, tiktok 9 | |
| Derek Chamizo | Universidad de YouTube (67) | YouTube | canales de YouTube automatizados | YouTube | Canales de contenido que viven de la publicidad | «1. Presentación Universidad de YouTube»; «1. Claves Algoritmo de YouTube»; «2. ¿Cómo Funciona Google Adsense_» | youtube 79, anuncios 22, tiktok 10 | Su método es para canales que viven de la publicidad de YouTube (nichos por CPM, canales sin cara): a un servicio le sirve lo de títulos, miniaturas y constancia. |
| David Turu | Academia de Lanzamiento (104) | Instagram orgánico, Webinar | lanzamientos por Instagram: historias de calentamiento, reto gratuito y webinar | Instagram (historias) y WhatsApp | Cursos y programas que se lanzan | «2-Análisis stories»; «4-PREINSCRIPCIÓN FORMULARIO»; «8-10 Pasos para duplicar tus lanzamientos» | historias 74, instagram 37, webinar 17, llamada 11 | |
| Ximena Fukuda | Método Fukuda (75) | Instagram orgánico | ventas orgánicas: carnadas, lives y el cierre por mensaje | Instagram, TikTok y grupos de Facebook | Low ticket y high ticket | «3.CARNADAS PARA FACEBOOK E INSTAGRAM»; «7.Cómo hacer tu estrategia de LIVES por instagram»; «Estructura de un cierre de venta» | tiktok 24, instagram 16, youtube 16, anuncios 15, historias 11, llamada 9 | |
| Guille Collado | Hackeando el Algoritmo (35) | Instagram orgánico | contenido viral: el algoritmo, las 4 P y la estructura de un video | Instagram y TikTok | Marca personal y creadores | «Actualización Algoritmo Instagram»; «Mi proceso de guionizar un vídeo viral» | instagram 36, tiktok 32, historias 15, seo 14, reels 12, anuncios 12 | |
| Ramiro Cubria | Sell Your Knowledge (105) | Instagram orgánico | vender conocimiento: contenido de nicho, DM en frío y la llamada | Instagram y mensajes en frío | Coaches, consultores y agencias | «2 Contenido de Nicho vs Contenido Viral»; «3 Creación de Carruseles»; «2 Sistema de DM en frío» | anuncios 30, instagram 15, llamada 14, historias 10 | Su curso también enseña el embudo a un VSL («3 Embudo a VSL»), pero su ficha en MaKo es de contenido, DM en frío y la llamada: el VSL no se ofrece con él. |
| Felipe Vergara | Vender por FB e IG Ads (242) | Anuncios a mensajes, Compra directa | anuncios que venden: el presupuesto desde la meta, el semáforo y escalar | Meta Ads y WhatsApp | Negocios que venden por WhatsApp o tienda | «10. Campañas de Mensajes en la Unión Europea»; «2. Cómo optimizar tus ventas en WhatsApp»; «10. Mejores tiendas de Shopify» | anuncios 236, instagram 34 | |
| Emilio Puigrredón | Social Funnel (11) | Anuncios a mensajes, Instagram orgánico | el perfil como embudo: anuncios de tráfico al perfil y cierre por mensaje | Instagram y Meta Ads | Servicios que se venden conversando | «7 Anuncios de Tráfico Con Meta Ads»; «8 Anzuelos»; «9 Social Landing Pages» | anuncios 98, instagram 25, historias 15, reels 10 | |
| Julián Alborna | Inteligencia Viral 2026 (41) | Instagram orgánico | contenido que se comparte: la idea, la atención y la edición | Video corto | Creadores y marcas | «Leccion 2 Contar Tu Historia»; «Leccion 4 Storyboard Planea Tu Video» | — | |
| Vilma Núñez | Certificación en Marketing Digital potenciada por IA (153) | Lead magnets | marketing digital: regalar contenido a cambio del contacto y anuncios por fases | Contenido, correo y anuncios | Empresas y negocios que venden entre empresas | «5. Content Lead Generation»; «12. Generación de leads gratis» | anuncios 47, instagram 13, webinar 9 | |
| Álvaro Luque | The perfect launch (237) | Lead magnets, Webinar, Compra directa | lanzamientos por etapas: lead magnet, clases y carrito abierto | Meta Ads, WhatsApp y correo | Cursos y programas que se lanzan | «Copia de 07 - Selecciona tu Lead Magnet»; «Copia de 14 - Anuncios para Lead Magnet»; «06 - CONFIGURA TU CHECKOUT»; «08 - SECUENCIA DE APERTURA DE CARRITO» | anuncios 77, instagram 10 | |
| Sergio Begueria | Instituto De Marca Personal (92) | YouTube, Instagram orgánico | marca personal con video: YouTube sobre todo, e Instagram | YouTube e Instagram | Expertos que quieren que los conozcan | «1 Cómo entender Youtube Analytics.»; «3 Ingredientes de un video viral en Youtube.»; «8 Cómo llevarte tráfico de Youtube»; «7 Cómo utilizar Instagram Stories» | youtube 50, historias 17, instagram 14, reels 10 | |
| Mateo Maffia | BYF (33) | Instagram orgánico | vender con video corto: ganchos, nicho y publicar seguido | TikTok y Reels | Marca personal y negocios físicos | «1 Anatomía de un gancho VIRAL»; «7 CONTENIDO VIRAL VS CONTENIDO DE NICHO»; «8 CÓMO CREAR REELS VIRALES» | tiktok 52, instagram 12, historias 10 | |
| Francisco Doglio | ARCADIA (24) | Instagram orgánico, Webinar | historias de Instagram que venden, setters y webinars | Instagram (historias y mensajes) y webinars | Ticket alto con un equipo que agenda llamadas | «2. Estrategias de Promoción de Ventas»; «Rutina diaria - Setter»; «1. Playbook de webinar urgencia y ventas»; «2. Estructuras de Webinar B2B y B2C» | anuncios 34, llamada 34, webinar 30, historias 23, instagram 15 | Lo fuerte de su curso son las historias de Instagram (un ciclo de promoción de siete días) y los setters que llevan la conversación a la llamada; los webinars son una parte. |
| Andy Landa | ManyChat Master - Instagram (25) | Instagram orgánico, Lead magnets | automatizaciones de Instagram: comentar una palabra y recibir algo por mensaje | Instagram con ManyChat | Quien ya publica y quiere convertir esa audiencia | «3. Mis reels de Conversión»; «4. FLOW 3 - Story de Conversión»; «6. FLOW 5 - Crece tu Base de Datos» | instagram 30, historias 23, reels 17 | |
| Gonzalo Seré | Growing Content Specialist (92) | Instagram orgánico | estrategia de contenido: pilares, guiones, grabación y edición | Instagram y YouTube | Marcas y equipos de contenido | «5. Como escribir guiones virales»; «7. 3 tipos de contenido de valor»; «32. Lanzamiento en historias» | instagram 16, youtube 16, anuncios 8 | |
| Alex Hormozi | 100M Money Models (33) | — (otra parte) | la oferta: atracción, upsell, downsell y continuidad | La oferta | Negocios que ya venden y quieren que cada cliente deje más | «1. Continuity Offers»; «1. Upsell Offers»; «1. Downsell Offers» | anuncios 18, historias 8 | |
| Agustín Nievas | Growing Closer (66) | — (otra parte) | el cierre en la llamada: descubrimiento, oferta y objeciones | Llamadas de venta | Ventas de ticket alto por llamada | «3. La transición perfecta para presentar una Ofe»; «1. Descubriendo como si fuese tu llamada» | llamada 31 | |
| Marc Verdú | Organic Ecom 3.0 (452) | — (otra parte) | tiendas online con video orgánico | TikTok, Reels y Shorts | Ecommerce de producto físico | «1. Cómo creamos las cuentas de tiktok»; «Dónde pongo el enlace a mi tienda» | tiktok 30, instagram 17 | Su método es para vender productos físicos en una tienda, no un servicio. |
| Iman Gadzhi | Agency Navigator (26) | — (otra parte) | agencias: prospección en frío, vender la reunión y cobrar | Llamadas y correos en frío | Agencias | «(2) Finding Leads & Qualifying»; «(4) Cold Calling» | anuncios 27, instagram 10 | |
| Jaime Higuera | Growth Partner (106) | — (otra parte) | socio de crecimiento: una oferta con nombre, el setting y una llamada corta antes de vender | Mensajes y llamadas | Agencias y servicios entre empresas | «Setting & Generar Reuniones»; «Dominando la Llamada de Demo» | anuncios 50, instagram 11 | Su curso trae clases de mini-VSL y de anuncios, pero su ficha en MaKo es de oferta, setting y la llamada: no se ofrece como funnel. |
| Adrià Sola Pastor | Instituto de Comunicación (158) | — (otra parte) | comunicación: la voz, las historias y hablar con autoridad | Cámara y llamadas | Quien da la cara por su negocio | «5. Voz con Autoridad»; «3. La Estructura Perfecta Cómo Crear Historias» | — | |
| Augusto Bianchi | Academia Five Stars (51) | — (otra parte) | la llamada de ticket alto: sus etapas, el dolor y las objeciones | Llamadas de venta | Ventas de ticket alto por llamada | «Procesos y Bases Fundamentales de la Llamada»; «Clase 6 - Guion de Ventas High Ticket» | llamada 46 | |
| Tino Mossu | La universidad del Closer (53) | — (otra parte) | objeciones y seguimiento del closer | Llamadas y WhatsApp | Quien toma las llamadas | «4 Principios de las Objeciones»; «Embudo de Objeciones»; «Venta VS Cierre» | llamada 85 | |
| Jordi Segués | TikTok 100k (85) | — (otra parte) | TikTok: el algoritmo, la retención y los formatos | TikTok | Marca personal en TikTok | «3.1 – Entender el algoritmo de TikTok»; «1.3 - ¿Qué contenido reina en TikTok» | tiktok 88, instagram 12, youtube 10 | Su curso es de TikTok; el orgánico del CoPilot es Instagram. |
| Juan Carrizo | Aumenta tu valor y ATV ADVANTAGE (247) | — (otra parte) | la oferta y el valor: método único, precio y escalera | La oferta | Expertos que venden conocimiento | «9. Como crear tu oferta»; «12. Validacion de oferta» | llamada 30, historias 16, youtube 14, reels 12 | Su curso también trae clases de VSL y de lanzamientos, pero su ficha en MaKo es de oferta y precio: por eso no se ofrece como funnel. |
| Samuel Albaa | Growing Closer (66) | — (otra parte) | la práctica del closer: la primera impresión y adaptarse a la persona | Llamadas de venta | Quien toma las llamadas | «7. Cómo tomar notas en llamada»; «3. Analisis de llamada B2C» | llamada 31 | |
| Romuald Fons | Bigseo Academy (137) | — (otra parte) | SEO: aparecer en Google por lo que la gente busca | Google | Negocios con una web | «01Introducción al SEO»; «Funnel de Ventas» | seo 55, anuncios 14 | |
