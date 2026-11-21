# Tendencias del mercado: los referentes por sector

21/11/2026. La lista para relevar (OK del Cerebro). **Ronda 2 (misma noche):** cuatro agentes buscaron por sector y sumaron 66; ahora son
**155**, con un cuarto subsector de IA (avatares y video). Los de la ronda 2 dicen «ronda 2» en la nota; salen de
`docs/tendencias/herramientas/referentes-extra.json` (lo arma `sumar-candidatos.mjs` desde los `candidatos-*.json` de los agentes,
con los descartes a mano escritos ahí).

- **89 referentes** en 11 sectores (IA va en tres: edición, carruseles, agentes y setters). 9 son en inglés y están para ver qué
  llega antes desde afuera.
- **Ya hay datos de 18:**
  - 7 ya bajados en `C:/dev/referentes-videos/`: Ramiro, Carrizo, Doglio, Collado, Víctor y Heras Media, Hormozi y Dakota.
  - 11 en el Spy de producción, con vistas y comentarios de los últimos 90 días: Vilma, Titto Gálvez, Julio Iero, Den Borg,
    Federico Cristofari, Sofía Contreras (sólo YouTube), Leila Hormozi y cuatro en inglés.
- **Faltan 71:** 65 cuentas de Instagram y 36 canales de YouTube.
- La lista sale de `C:/dev/tendencias/herramientas/referentes.mjs`, que también escribe `C:/dev/tendencias/referentes.json`
  para el chat Spy.

**De dónde sale cada uno:**
- MaKo: los 32 de `lib/asesores/catalogo.ts`.
- Knowledge: los autores de los cursos (`app/conocimientos/catalogo.ts`).
- Tus links: `C:/dev/inspiracion/relevo.json`.
- Spy: `spy_competidores` de producción.
- Web: dos agentes, el 21/11.

**Cómo se verificó:**
- Los YouTube se chequearon uno por uno: si existe, la fecha del último video y cuántos de los últimos 15 son de los últimos
  90 días.
- Los Instagram salen de la web. Los de tus links existen porque son tus links.

**Usuarios que estaban mal:**

| Referente | El que estaba | El real |
|---|---|---|
| Juan ADS | `juanads` (privado, 0 seguidores) | `juan_adss` |
| Sofía Contreras | `sofiacontreras` (529 seguidores, el que tiene el Spy) | `soysofiacontreras` |
| David Turu | `davidturu` | `davituru` |
| Julián Otálora | `julianotalora` | `marketing.julian` |
| Tino Mossu | `tino.mossu02` (ofrece «trabajo con una empresa de EEUU») | `tino_.mossu` |

**Lo que quedó afuera:**
- Hanah Franklin publica en portugués.
- Eric Rodríguez (Mentoría 4K) es de fitness.
- Marc Verdú es de e-commerce.
- Los cursos de trading, inmobiliaria y e-commerce.
- Los autores que no se pudieron ubicar: Rodrigo Rojo, Samuel Acosta, Fender Arche, CopyNation, Santi Herrera, Manuel Jiménez,
  SoySimon y Diego Dreyfus.
- Los que no publican hace meses: el YouTube de Julián Otálora, Agustín Nievas, Guille Collado, Andy Landa y David Turu (de ellos
  se baja sólo Instagram).

**Los más flojos:**
- Carruseles con IA: casi nadie en español lo enseña con constancia. Es una señal en sí misma.
- Orgánico viral: los nuevos que aparecieron no publican seguido.


### Orgánico de nicho (16)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Ramiro Cubría | @ramiro.cubria | — | ya bajado | MaKo, Knowledge | su @RamiroCubria de YouTube está parado desde 2022 |
| Julián Otálora | @marketing.julian | — | falta | MaKo, Knowledge | YouTube parado desde 06/2025; @julianotalora es un homónimo |
| Gonzalo Seré | @gonzalosere | @gonzalosere | falta | MaKo, Knowledge |  |
| Ximena Fukuda | @ximenafukuda | — | falta | MaKo, Knowledge | YouTube sin @ confirmado |
| Den Borg | @den.borgg | @DenBorgMarketing | Spy de producción | Spy | la web dice que la principal es denborg.marketing (~68 mil) |
| Andy Landa | @instacoachandy | — | falta | MaKo, Knowledge | YouTube parado desde 07/2026 |
| Ana Clavellinas | @unbuenmarketing | — | falta | Knowledge |  |
| Vilma Núñez | @vilmanunez | @vilmanunez | Spy de producción | MaKo, Knowledge, Spy | también vilma.ai |
| Melisa Escobar | @melisaescobart | @melisaescobart | falta | Knowledge |  |
| Emilio Puigrredón | — | @EmilioPuigrredon | falta | MaKo, Knowledge | Instagram sin encontrar |
| Leo Nabel | @leo_nabel | @leo_nabel | falta | web | ronda 2: Hace «coaches y terapeutas virales en Instagram»; cómo vender en IG |
| Bastian Xu | @bastian.xu | @bastianxu | falta | web | ronda 2: Marca personal para vender más; embudo para vender en Instagram |
| Araceli Prudente | @araaprudente | @araaprudentee | falta | web | ronda 2: Vender high ticket en Instagram sin anuncios; cobrar 1.000-3.000 USD como estratega de contenido + IA |
| Andrea Vega (Andrea Estratega) | @andreaestratega | @andreaestratega | falta | web | ronda 2: Marketing de contenidos: vender con Reels, carruseles e historias hechos con IA; estrategia para vender con 0 seguidores |
| Alex Arano | @alexarano_mkt | @alexarano_mkt | falta | web | ronda 2: Ayuda a marcas a conseguir clientes con su contenido; marca personal en Instagram |
| Victoria Poggioli | @victoria.poggioli | @victoria.poggioli | falta | web | ronda 2: Estrategia social y de contenido para organizar y escalar productos y servicios; pilares de contenido |

### Orgánico viral (17)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Guille Collado | @guille.colladomk | — | ya bajado | MaKo, Knowledge | YouTube parado desde 03/2025 |
| Víctor Heras / Heras Media | @victorherasemprendedor | @Victorherasmedia | ya bajado | MaKo, Knowledge, Spy | y herasmedia (también en el Spy de producción) |
| Julián Alborná | @julianealborna | — | falta | MaKo, Knowledge | ~3 M; ojo con revendedores de su curso |
| Jordi Segués | @thejordisegues | @JordiSegues | falta | MaKo, Knowledge | jordi.segues y jordisegues son otros |
| Mateo Maffia | @mateomaffia | @mateomaffia | falta | MaKo, Knowledge |  |
| Sergio Beguería | @sergiobegueria | — | falta | MaKo, Knowledge | YouTube de 2,46 M sin @ confirmado |
| Julio Iero | @julioiero | — | Spy de producción | Spy |  |
| Manuel Zapater | @manuelzapater | — | falta | tus links | animado viral de tus links |
| Francisco Doglio | @franciscodoglio | @FranciscoDoglio | ya bajado | MaKo, Knowledge |  |
| Cami Graciano (Creatio) | @creatio.ok | @Creatio.Digital | falta | web | ronda 2: Negocios high ticket, comunicación y marca personal para coaches y consultores; método «Sistema Circular» |
| Andrea Vega (Andrea Estratega) | @andreaestratega | @andreaestratega | falta | web | ronda 2: Marketing de contenidos: vender con Reels, carruseles e historias hechos con IA; estrategia para vender con 0 seguidores |
| Alex Arano | @alexarano_mkt | @alexarano_mkt | falta | web | ronda 2: Ayuda a marcas a conseguir clientes con su contenido; marca personal en Instagram |
| converzzo | @converzzo | @converzzo | falta | web | ronda 2: Cómo editar videos con Claude paso a paso, CapCut con IA y clones digitales. |
| Mirko Vigna | @mirkovgna | @MirkoVigna | falta | web | ronda 2: Guiones y creación de contenido para crecer en redes |
| TUMADREANNA | @tumadreanna | @TUMADREANNA | falta | web | ronda 2: Cómo hacer un reel viral paso a paso y marketing en redes |
| Pol Corominas | @polcorominas | @polcorominas | falta | web | ronda 2: Estrategia de Instagram 2026 y crecimiento orgánico; 983K en YouTube |
| Susan Gorbina | @susangorbinacom | @SusanGorbina | falta | web | ronda 2: Cursos de marketing digital y redes; cómo crecer en Instagram 2026 |

### Anuncios (17)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Juan ADS (Juan Osorio) | @juan_adss | @JuanADS | falta | MaKo, Knowledge | instagram.com/juanads es otro (privado) |
| Felipe Vergara | @felipeverce | @FelipeVergara | falta | MaKo, Knowledge |  |
| The Net Lab | @thenet.lab | @the.netlab | falta | Knowledge, tus links |  |
| Claudio Conde (100ads) | @condeclaudioad | @condeclaudioad | falta | Knowledge |  |
| Caro Dubi | @carodubi | @carolinadubi | falta | web | el vínculo IG–YouTube sale del nombre |
| Camilo Barbosa (Master Ads) | @camilobarbosatv | @Camilobarbosatv | falta | web |  |
| SaleADS | @saleads.ai | — | falta | tus links | competidor directo de MaKo |
| Agencia Tech | @agenciatech__ | — | falta | tus links |  |
| Dakota Hermes (inglés) | @dakota.hermes | — | ya bajado | tus links |  |
| Ramiro Cubría | @ramiro.cubria | — | ya bajado | MaKo, Knowledge | su @RamiroCubria de YouTube está parado desde 2022 |
| Aprendamos Marketing (Rubén Gallardo) | @aprendamosmarketing | @Aprendamosmarketing | falta | web | ronda 2: Cursos y clases largas de Meta Ads/Facebook Ads 2026 (de cero a campañas); YouTube 32,3 mil subs con 15 de 15 últimos videos en 90  |
| Marketero (Edu Huarte) | @marketeroshq | @marketerosHQ | falta | web | ronda 2: Meta Ads avanzado: sistema post-Andrómeda, anuncios a WhatsApp, estrategia para empresas de servicios y coaches; reel diario en IG  |
| Lucas Martin Coliqueo | @lucasmartincoliqueo | @LucasMartinColiqueo | falta | web | ronda 2: Escala productos digitales con Meta Ads e IA (anuncios ganadores, estrategia post-Andrómeda); sus reels piden comentar una palabra  |
| Jesus Alejandro Ads | @jesusalejandroads | @JesusAlejandroAds | falta | web | ronda 2: Facebook/Meta Ads paso a paso: campañas a WhatsApp con poco presupuesto, escalar; publica casi a diario (ojo: un post reciente con  |
| Daniel Aguillón | TikTok Ads | @dani_aguillon | @Dani_aguillon | falta | web | ronda 2: Especialista en TikTok Ads (cursos y estrategia para conseguir clientes por WhatsApp); YouTube 61,1 mil subs, 15 de 15 en 90 días ( |
| Federico Feres | @fedeferes | @fedeferes | falta | web | ronda 2: Marketing + IA para empresas; clases en vivo de campañas Meta Ads de leads calificados y por qué una campaña no gasta; reels diario |
| Brayan Hernández | @brayanher_ | @brayanherr | falta | web | ronda 2: Cómo hacer creativos UGC ultrarrealistas para anuncios de Facebook e Instagram con IA; su IG mezcla anuncios con marca/ecommerce y  |

### Closing y ventas (16)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Agustín Nievas | @agus.nievas | — | falta | MaKo, Knowledge | y growing.setters; YouTube parado desde 03/2025 |
| Samuel Alba | @samuelalbaa | @SamuelAlbaa | falta | MaKo, Knowledge |  |
| Augusto Bianchi | @soyaugustobianchi | — | falta | MaKo, Knowledge | y academiafivestars |
| Tino Mossu | @tino_.mossu | — | falta | MaKo, Knowledge | tino.mossu02 NO es él |
| Alfonso y Christian | — | @AlfonsoyChristian | falta | Knowledge | Instagram por buscar |
| Francisco Doglio | @franciscodoglio | @FranciscoDoglio | ya bajado | MaKo, Knowledge |  |
| Jürgen Klaric | @jurgenklaric | — | falta | web | neuroventas |
| Adrià Solà Pastor | @adriasolapastor | — | falta | MaKo, Knowledge | comunicación |
| Cole Gordon (inglés) | @colethomasgordon | @colethomasgordon | Spy de producción | Spy | sólo YouTube en el Spy |
| Jeremy Miner (inglés) | @jeremyleeminer | @jeremyminer | Spy de producción | Spy | sólo YouTube en el Spy |
| Allen Hernández | @allenhernandez.oficial | @allenhdzoficial | falta | web | ronda 2: Entrenador de ventas; en su YouTube hay un directo «Prospección levantamuertos» y clases de NEPQ, prospección y cierre; coautor de  |
| Santiago Romero | @santiagoromerosales | @santiagoromerocloser | falta | web | ronda 2: Academia High Performance Closer: formar y colocar closers, ventas por llamada |
| Mauricio y Sofía (Academia Top Closing) | @maushof.sales | @maurozabalar | falta | web | ronda 2: Academia de cierre de ventas high ticket; formación de closers y colocación en empresas |
| Fede Agdamus | @fedeagdamus | @AgdamusFede | falta | web | ronda 2: Forma e inserta closers en empresas; llamadas de venta en vivo de 2.000 USD |
| Nicolás Saenz Core | @nicosaenzcore | @nicosaenzcore | falta | web | ronda 2: Ventas: manejo de objeciones y entrenamiento para vendedores; cofundador de agencia de ventas |
| Pablo Córdoba | @pablocordobaes | @paablocordoba | falta | web | ronda 2: Consultor de ventas; análisis de llamadas de top closers y academia con +400 alumnos |

### IA · Edición con IA (12)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Raúl Ordóñez | @jaspeante | @jasp | falta | web |  |
| Arca Artificial (Lordwind Enrique) | @arcaartificial | @ArcaArtificial | falta | web |  |
| Jan Nafta | @jannafta | @JanNafta | falta | Knowledge | YouTube casi parado (1 en 90 días) |
| Tiago Lemos | @tiagolemosx | — | falta | tus links |  |
| Santi Siciliano | @santi.siciliano | — | falta | tus links |  |
| Fabricantes Chinos (EDIT IA PRO) | @fabricanteschinos | — | falta | tus links |  |
| Diego NXT | @diego.nxt | @diegonxt | falta | Knowledge, tus links |  |
| Viegas Estudio | @viegasestudio | @viegasestudio | falta | web | ronda 2: Edita Reels y hace motion graphics con Claude Code; regala skills. |
| Mauro Arredondo | @mauritenss | @mauritenss | falta | web | ronda 2: Motion graphics con Claude y código para video. |
| converzzo | @converzzo | @converzzo | falta | web | ronda 2: Cómo editar videos con Claude paso a paso, CapCut con IA y clones digitales. |
| Milo Content (Emilio Bazán) | @milo.bazan | @Milo.content | falta | web | ronda 2: Edición que se hace sola con IA (Claude), edits gratis para PC. |
| Humbertomatic | @humbertomaticdj | @humbertomaticdj | falta | web | ronda 2: Edición de video con IA, Higgsfield, clon propio, redes sociales. |

### IA · Carruseles con IA (12)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Sai & Santi | — | @SaiSantiMarketing | falta | web | IA para coaches; Instagram por buscar |
| Mariano Greggi | — | @marianogreggi | falta | web | Instagram por buscar |
| Cherry Studio | @cherrystudio.app | — | falta | tus links |  |
| Samu Auren | @samuauren | — | falta | tus links |  |
| Grow with Alex (inglés) | @growithalex | — | falta | tus links | y doagenticly |
| Andrea Vega (Andrea Estratega) | @andreaestratega | @andreaestratega | falta | web | ronda 2: Marketing de contenidos: vender con Reels, carruseles e historias hechos con IA; estrategia para vender con 0 seguidores |
| Alex Arano | @alexarano_mkt | @alexarano_mkt | falta | web | ronda 2: Ayuda a marcas a conseguir clientes con su contenido; marca personal en Instagram |
| Ruva IA | @ruva.ia | @Ruvaia | falta | web | ronda 2: Skill de Claude que diseña carruseles de Instagram. |
| Alexis Asad | @alexisaasad | @alexisaasad | falta | web | ronda 2: Carruseles virales ilimitados con Claude. |
| Nuria Gutiérrez | @bynuriagutval | @nuriagutval | falta | web | ronda 2: Carruseles de IG con Claude Design, guías completas. |
| The Line Project (Valen y Juany) | @thelineproject.ia | @thelineproject-ia | falta | web | ronda 2: Carruseles virales automáticos con Claude, contenido con IA. |
| GregoBeto | @gregobeto | @GregoBeto | falta | web | ronda 2: Carruseles virales ilimitados en ChatGPT. |

### IA · Agentes y setters con IA (15)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Eric Górriz | @ericgorriz_ | — | falta | tus links | YouTube sin videos recientes |
| Benjamín Cordero | @bencorde | @bencord | falta | tus links, web |  |
| Agustín Medina | @agustinmedinaia | @agustinmedinaIA | falta | Knowledge |  |
| Josema Fernández | — | @josemafernandezia | falta | Knowledge | Instagram por buscar |
| Valentín Ayesa (VA360) | @valentin_ayesa | @va360-valen | falta | web |  |
| Santa IA | @santaia.lab | — | falta | tus links | «los CRM murieron» |
| curiosfer | @curiosfer | — | falta | tus links |  |
| Eduardo Vázquez | @eduardovazquez.ia | @eduardovazquez-ia | falta | Knowledge |  |
| Roco de la Portilla | @rocodelaportilla | — | falta | Knowledge | ~1 M |
| Jon Hernández | @jonhernandezia | — | falta | web | más noticias que agentes |
| Juan Pe Navarro | @juanpe.divisual | @juanpe.divisual | falta | web | ronda 2: IA y automatización: agentes de WhatsApp, n8n, cómo vender automatizaciones. |
| Pau Berenguer | @pauberenguer_ | @PauBerenguerAI | falta | web | ronda 2: Consultora de IA: agentes de WhatsApp con n8n y Claude Code. |
| Michael Carrillo | @michaelcarrillom | @michaelcarrillo.m | falta | web | ronda 2: Agentes de ventas de WhatsApp con n8n y automatizaciones con Claude. |
| Ignacio Rodriguez | @ignaciorodriguezb_ | @Ignaciorodriguezb | falta | web | ronda 2: Escala agencias de IA, Claude Code para automatizar. |
| Melina Blanco | @meliwhite_8 | @MeliWhite-8 | falta | web | ronda 2: AI Agency: agentes IA y automatizaciones, contenido para clientes con Claude. |

### YouTube (16)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Eloisa Wolf | @eloisawolfmarketing | @EloisaWolf | falta | Knowledge |  |
| Diego Cabrera | @diegocabrera22___ | @diegocabrera22 | falta | web |  |
| Veloz Redes | — | @VelozRedes | falta | Knowledge | Instagram por buscar |
| Mari Fuentes | @mari.rfuentes | @MariFuentes | falta | Knowledge |  |
| Carlotta Sabina | @carlotta_sabina | — | falta | Knowledge, web | hay 4 cuentas parecidas: confirmar la oficial |
| Derek Chamizo | @youtubemillonario | @derekchamizo | falta | MaKo, Knowledge | YouTube casi parado (2 en 90 días) |
| Romuald Fons | @romualdfons | @RomualdFonsTV | falta | MaKo, Knowledge |  |
| Marc Basi (MasterTube) | @marcbasi_ | — | falta | web |  |
| Jaime Higuera | @jaimehigueraes | @JaimeHigueraEspanol | falta | MaKo, Knowledge |  |
| Joseph Gooding | @_josephgooding | @JosephGooding | falta | web | ronda 2: Crecer y monetizar un canal en español; colaborador de YouTube; tiene agencia |
| Pol Tenas | @pol.tenas | @PolTenasYT | falta | web | ronda 2: Estrategia para crecer en YouTube 2026 (suscriptores no leídos por el chequeo) |
| Clara Carmona Business | @claracarmonabusiness | @ClaraCarmonaBusiness | falta | web | ronda 2: Cómo empezar de cero en YouTube para negocios y marca personal; 35K en YouTube |
| Ale Ferr | — | @AleFerr_oficial | falta | web | ronda 2: Nichos de YouTube que se viralizan y crecimiento del canal |
| Jessy C. | — | @jessyyyc | falta | web | ronda 2: Cómo hacer crecer un canal de YouTube desde 0 |
| Sebas Nájera | — | @Sebnajera | falta | web | ronda 2: Curso de automatización de YouTube (canales sin cara) |
| Máximo Bruno (SEN6) | — | @maximobrunoesp | falta | web | ronda 2: Canales faceless y cambios de YouTube con IA |

### High ticket (15)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Ramiro Cubría | @ramiro.cubria | — | ya bajado | MaKo, Knowledge | su @RamiroCubria de YouTube está parado desde 2022 |
| Juan Carrizo | @juanxcarrizo | @Juan_carrizo | ya bajado | MaKo, Knowledge |  |
| Francisco Doglio | @franciscodoglio | @FranciscoDoglio | ya bajado | MaKo, Knowledge |  |
| Marcos Razzetti | @marcosrazzetti | @MarcosRazzettii | falta | MaKo, Knowledge | IG restringido; empresa bluehackmediagroup |
| Jaime Higuera | @jaimehigueraes | @JaimeHigueraEspanol | falta | MaKo, Knowledge |  |
| Sofía Contreras | @soysofiacontreras | @SofiaContreras | Spy de producción | MaKo, Knowledge, Spy | el IG del Spy (sofiacontreras, 529) es un homónimo: falta su IG |
| Federico Cristofari | @fedecristofari | @federicocristofari | Spy de producción | Spy |  |
| Alex Hormozi (inglés) | @hormozi | @AlexHormozi | ya bajado | MaKo, Knowledge, Spy |  |
| Leila Hormozi (inglés) | @leilahormozi | @leilahormozi | Spy de producción | Spy |  |
| Iman Gadzhi (inglés) | @imangadzhi | @ImanGadzhi | falta | MaKo, Knowledge |  |
| Cami Graciano (Creatio) | @creatio.ok | @Creatio.Digital | falta | web | ronda 2: Negocios high ticket, comunicación y marca personal para coaches y consultores; método «Sistema Circular» |
| Hernán Vázquez | @hernanvazquezmarketing | @HernanVazquezMarketing | falta | web | ronda 2: Publicidad y escalado de negocios de coaching de alto valor (Rapid Scale Framework) |
| Luis González | @luisgonzalezmindsetbusiness | @luisgonzalezmindsetbusiness | falta | web | ronda 2: Mentor que ayuda a convertir conocimiento en negocio y vender en redes (método ICEBERG) |
| Francisco Virtus | @franciscovirtus_ | @FranciscoVirtus | falta | web | ronda 2: Cómo lanzar y escalar mentorías; sistema orgánico para llenar de clientes premium |
| Agustín Maschio | @agusmaschio_ | @AgustinMaschio | falta | web | ronda 2: Funnels y adquisición; ofertas que ganan 11k/mes; IA y comunidades |

### Low ticket (15)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| David Turu | @davituru | — | falta | MaKo, Knowledge | davidturu es otro; YouTube parado desde 05/2026 |
| Álvaro Luque | @alvaroluque.co | @AlvaroLuque | falta | MaKo, Knowledge |  |
| Sebas Spisso | @sebasspisso | — | falta | web |  |
| Marcos Araujo | @marcosaraujocu | — | falta | web | Hotmart |
| Lenieil Arana | @lenieil | @lenieil | falta | web |  |
| Christopher Ironback | @christopher.ironback | — | falta | tus links | 8 cursos a 1 dólar |
| Proyecto Atom | @proyecto_atom | — | falta | tus links |  |
| Espiad | @espiad.app | — | falta | tus links |  |
| Maria Wendt (inglés) | @maria.wendt | @mariawendt | Spy de producción | Spy, tus links | sólo YouTube en el Spy |
| Daniel Alcaide | @danielalcaidemkt | @DanielAlcaidemkt | falta | web | ronda 2: Reels virales con avatar de IA, ganar sin mostrar la cara. |
| Tomas Hauser | @emprendiendo.tomas | @emprendiendo.tomashauser | falta | web | ronda 2: Productos digitales y embudos en Hotmart; videos sobre su «embudo multiplicador» |
| Jhonier Gómez | @jhoniergomez_ | @JhonierGomez | falta | web | ronda 2: Cómo crear y vender ebooks y productos digitales con IA y Hotmart, paso a paso |
| Jonathan Rengifo | @jonathan.rengi | @JonathanRengifoTV | falta | web | ronda 2: Vender ebooks y publicar infoproductos en Hotmart; IG tomado de su página de Apple Podcasts |
| Adrián Sáenz | @adrians | @AdrianSaenz | falta | web | ronda 2: Marketing y negocios online; videos sobre ganar con productos digitales (más amplio que low ticket) |
| Óscar García Digital | — | @oscargarciadigital | falta | web | ronda 2: Cómo ganar dinero con comunidades pagas en Skool |

### Mentalidad y coaching (14)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Sofía Contreras | @soysofiacontreras | @SofiaContreras | Spy de producción | MaKo, Knowledge, Spy | el IG del Spy (sofiacontreras, 529) es un homónimo: falta su IG |
| Titto Gálvez | @tittogalvez | @tittogalvez | Spy de producción | Spy |  |
| Jorge Serratos | @jorgeserratosf | — | falta | web |  |
| Jürgen Klaric | @jurgenklaric | — | falta | web | neuroventas |
| Javier Iriondo | @jiriondo1 | — | falta | web |  |
| Adrià Solà Pastor | @adriasolapastor | — | falta | MaKo, Knowledge | comunicación |
| Valentina Ortiz | @academiamav | @Valentinaortizf | falta | Knowledge |  |
| Marisa Peer (inglés) | @marisapeertherapy | @marisapeer | Spy de producción | Spy | sólo YouTube en el Spy |
| Brandon Falco | @brandonfalco_ | @brandonfalcomentalidad | falta | web | ronda 2: Entrenamiento mental («tu mente está creando tu vida»), mentalidad del 1 % |
| Rick, El Arquitecto Mental | @elarquitectomental | @elarquitectomental | falta | web | ronda 2: Reprogramación mental y emocional (Método EMC); borde del nicho: toca lo energético |
| Pablo Chalakani | @pablochalakani | @Pablochalakani | falta | web | ronda 2: Entrevistas a emprendedores y expertos en mentalidad (Foro de Crecimiento) |
| Adrián Lemcke | @adrianlemcke | @adrian.lemcke | falta | web | ronda 2: Money coach, inversor y Shark; hábitos y mentalidad para ser millonario |
| Henry Daniel Guzmán | @henrydanielguzman_ | @henrydaniel-escuelademindset | falta | web | ronda 2: Escuela de Mindset: disciplina, hábitos mentales y fe para emprendedores; comunidad en Skool |
| Nico Bolletta | @nicobolletta | @nicobolletta | falta | web | ronda 2: Emprendedores con resultados pero con dudas: patrones que frenan el crecimiento; ganar más trabajando menos |

### IA · Avatares y video con IA (5)

| Referente | Instagram | YouTube | Datos | De dónde | Nota |
|---|---|---|---|---|---|
| Victor Cerezuela | @victor_cerezuela | @VictorCerezuela10 | falta | web | ronda 2: Influencers virtuales con IA y clones de video; el YouTube es el fuerte. |
| Daniel Alcaide | @danielalcaidemkt | @DanielAlcaidemkt | falta | web | ronda 2: Reels virales con avatar de IA, ganar sin mostrar la cara. |
| Alejavi Rivera | @alejavirivera | @alejavirivera | falta | web | ronda 2: Avatares que venden, personajes consistentes, automatización con IA. |
| Jorge León | @soyjorgeleon | @soyjorgeleon | falta | web | ronda 2: IA para networkers; sistema con avatar que presenta el negocio. |
| David Cruz IA | @davidcruzia | @Davidcruzia | falta | web | ronda 2: Reels diarios con tu clon de IA; ElevenLabs. |
