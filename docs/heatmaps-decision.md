# ¿Conviene meter un heatmap en MaKo?

> ⚠️ **Superado el 06/10/2026.** Clarity salió del producto y Martín pidió el mapa de calor
> dentro de Landing Analyst. Está hecho: los toques se dibujan sobre la foto de la página que
> guarda cada grabación (no hace falta enmarcar la página en vivo, que era la objeción de
> abajo), y desde el Pixel v22 cada toque viaja anclado a su elemento. Lo de abajo queda como
> contexto. Ver `docs/hallazgos-landing.md` → «El mapa de calor se dibuja sobre la FOTO de una
> grabación».

**Para:** Mauricio · **Fecha:** 15 de agosto de 2026
**Pregunta:** ¿integramos una herramienta de mapas de calor? ¿Cuál? ¿Y qué agrega de verdad sobre lo que el Pixel ya mide?

---

## 1. La respuesta en tres líneas

**No integramos ninguna herramienta de heatmap dentro del producto. Construimos las tres señales que faltan —profundidad de scroll, rage clicks y dead clicks— dentro del Pixel de MaKo.** Son 4 a 6 días de trabajo, costo marginal prácticamente cero, y quedan atadas al lead del CRM, que es exactamente donde está nuestro diferencial y donde ninguna herramienta de afuera nos puede seguir.

**Microsoft Clarity sí, pero como herramienta interna nuestra, no como parte del producto.** Es gratis de verdad y sirve para que vos y yo miremos grabaciones de la landing de MaKo. No sirve para poner un heatmap adentro del dashboard del cliente: su API no devuelve heatmaps ni grabaciones, y —el detalle que mata— **no ve nada adentro del reproductor de Panda**, que es justo el corazón de estas landings.

**Lo único que Clarity nos da y nosotros no podemos hacer barato es la grabación de sesión.** Esa es la razón para tenerlo, y es una razón de uso interno, no de plan de US$47.

---

## 2. Qué agrega un heatmap sobre lo que el Pixel YA mide

Voy a ser honesto con el solapamiento, porque es más grande de lo que parece.

### Lo que ya tenemos, con otro nombre

| Lo que vende la herramienta | Lo que ya mide el Pixel | Veredicto |
|---|---|---|
| **Click map** (dónde hacen clic) | Clics en botones y enlaces, **con el destino de cada uno** | Solapamiento alto. Ellos agregan la posición en la pantalla; nosotros ya tenemos el *qué* clickeó y *a dónde iba*. |
| **Conversion map** (qué clics llevan a conversión) | Formulario de opt-in atado al visitor_id, unido al lead | **Nosotros somos mejores.** Ellos te dicen "el 12% convirtió"; nosotros te decimos *quién* y qué hizo antes. |
| **Attention / area maps** | — | Es el mismo dato de clics presentado distinto. Es cosmético. |
| **Analítica de video** | Reproducción, hitos de 5%, escalera de segundos y punto de abandono, **por video** | **Nosotros somos mucho mejores.** Clarity directamente no puede: no captura nada adentro de un iframe de otro dominio ([FAQ oficial](https://learn.microsoft.com/en-us/clarity/faq): *"Clarity captures clicks on first-party iFrames… but not on third-party iFrames"*). El VSL de Panda es un agujero negro para ellos. |

### Lo que es realmente nuevo

1. **Mapa de scroll — hasta dónde bajan.** Hoy tenemos **cero**. Es el dato más valioso de los tres: te dice si la gente llega a la oferta o abandona antes. Para una landing larga con VSL, esto contesta una pregunta de negocio real.
2. **Rage clicks** (clickea 3 veces seguidas el mismo lugar porque no pasa nada) y **dead clicks** (clickea algo que *parece* botón y no lo es). Hoy no los registramos porque solo escuchamos botones y enlaces reales. Un dead click sobre una imagen que el cliente creyó que era un botón es plata que se va, y hoy es invisible.
3. **Grabación de sesión.** Ver el video de lo que hizo la persona. Es lo único de esta lista que no podemos reconstruir barato, y es lo que engancha emocionalmente cuando se lo mostrás al dueño de un negocio.

**Resumen honesto:** el mapa de calor bonito agrega poco. La curva de scroll, la frustración y la grabación agregan bastante. De esos tres, dos los podemos hacer nosotros mejor y atados al lead; el tercero, no.

---

## 3. Microsoft Clarity: qué es y dónde está el truco

### El precio: gratis, y es verdad

> *"Clarity is a free service forever. You never encounter traffic limits or are compelled to upgrade to a paid version."*
> *"There are absolutely no limits on the number of sites per account."*
> *"You can add an unlimited number of projects for each domain or website."*
> — [learn.microsoft.com/en-us/clarity/faq](https://learn.microsoft.com/en-us/clarity/faq) (página con fecha 2026-05-21, actualizada 2026-06-30)

Sin límite de tráfico, sin límite de sitios, sin límite de miembros por proyecto (máximo 10 invitaciones pendientes a la vez). En plata pura, el multi-inquilino con Clarity cuesta **US$0**. Ese dato es real y está verificado.

### Los cuatro límites que rompen el plan de meterlo en MaKo

**1. La API no devuelve nada útil.** Un solo endpoint, y estas son las cuotas textuales: *"Maximum of 10 API requests are allowed per project per day"*, *"Data retrieval is confined to the previous 1 to 3 days"*, *"The response is limited to 1,000 rows and can't be paginated"* ([Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)). Devuelve solo promedios agregados. **No hay forma de bajar un heatmap ni una grabación.** Se descargan a mano, en CSV o PNG, desde el panel de Microsoft.

Traducción: **nunca va a haber un widget de heatmap adentro de MaKo.** Lo máximo que podemos poner es un botón que abre otra pestaña con el login de Microsoft.

**2. No ve el VSL.** *"Clarity can't render inside third-party 'iFrame' or 'canvas' elements"* ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). El reproductor de Panda queda en negro en la grabación y sus clics no se cuentan. En landings donde el video *es* la oferta, esto es media película perdida.

**3. Las grabaciones duran 30 días.** *"Playback data is retained for 30 days"* ([retención](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention)). Los heatmaps duran 9 meses. Un lead que entró hace tres semanas y recién ahora se está por cerrar: la grabación ya no existe.

**4. El puente al lead existe, pero es manual.** Se le puede pasar nuestro visitor_id con `clarity("identify", ...)` y después filtrar grabaciones y heatmaps por ese id ([Identify API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api)). Pero ese filtro vive **solo en la interfaz de Clarity**: es un humano entrando a clarity.microsoft.com y pegando el id a mano. La API no tiene siquiera una dimensión de "custom id". O sea: el enganche con el CRM es *"andá a buscarlo a otro lado"*, no un dato en nuestra base.

### Qué se lleva Microsoft a cambio

El texto de política de privacidad que **Microsoft mismo te manda pegar en la landing del cliente** dice:

> *"We partner with Microsoft Clarity and Microsoft Advertising to capture how you use and interact with our website through behavioral metrics, heatmaps, and session replay… Additionally, we use this information for site optimization, fraud/security purposes, and **advertising**."*
> — [privacy-disclosure](https://learn.microsoft.com/en-us/clarity/setup-and-installation/privacy-disclosure)

Y Clarity es **GDPR-compliant como controlador de datos**, no como procesador ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Eso significa que Microsoft no es nuestro proveedor bajo nuestras reglas: es un tercero que recibe los datos de los visitantes de tus clientes bajo *sus* reglas.

Ese es el precio real. No es plata: son los datos de comportamiento de los visitantes de tus clientes, alimentando la publicidad de Microsoft.

**Sobre los Términos de Uso:** hay cláusulas que apuntan a que Clarity es para *"internal business purposes"*, que prohibirían *"create user profiles"* y ofrecerlo *"as a stand-alone hosted solution for others"*. **No las pude verificar**: la página clarity.microsoft.com/terms se arma en el navegador y no devuelve texto. Lo único confirmado de ese documento es la sección 10: *"Microsoft may charge fees for use of or access to some or all of the Offering"* — o sea, se reservan el derecho de empezar a cobrar. **Mi recomendación no depende de esas cláusulas dudosas**; se sostiene sola con los cuatro límites técnicos de arriba.

---

## 4. La tabla de alternativas

Todos los precios son de la página del fabricante, con URL. Lo que no se pudo verificar está marcado en el mismo renglón.

| Herramienta | Precio verificado | Multi-inquilino | ¿Sirve para MaKo? |
|---|---|---|---|
| **Microsoft Clarity** | **US$0, para siempre** — [learn.microsoft.com/clarity/faq](https://learn.microsoft.com/en-us/clarity/faq) (2026-06-30) | Sitios y proyectos **ilimitados** | Sí como herramienta interna. No como parte del producto (API inútil, no ve iframes, 30 días). |
| **PostHog** | 5.000 grabaciones/mes gratis, después **US$0,0050 por grabación** (baja a US$0,0015 en volumen) — [posthog.com/pricing](https://posthog.com/pricing) | Plan free = **1 solo proyecto**; pagos = 6. Se resuelve con un proyecto y separación por propiedad. | Es el **único** que documenta poner la grabación adentro de nuestra ficha del lead (link público embebible). Pero se paga por grabación y hay que dar de alta el dominio de cada cliente. |
| **Lucky Orange** | Build **US$32/mes** anual (3.500 sesiones), Grow **US$72** (10.000), Expand **US$199** (50.000), Scale **US$839** (300.000). Sitios extra: **US$5/sitio** — [luckyorange.com/pricing](https://www.luckyorange.com/pricing) | El único con add-on por sitio barato y explícito | Viable en plata, pero las sesiones se reparten entre todos los clientes. Ver la cuenta en la sección 5. |
| **Plerdy** | Startup **US$21/mes** anual (US$32 mensual), Scale US$42, Thrive US$70 — [plerdy.com/pricing](https://plerdy.com/pricing/) | **Cobra por sitio**, textual: *"One package equates to one site"* | No. 10 clientes = 10 suscripciones. |
| **Mouseflow** | Free US$0 (500 sesiones, 1 sitio), Essential **US$25** (1 sitio), Advanced **US$109** (2 sitios), Premium **US$319** (5 sitios) — [mouseflow.com/pricing](https://www.mouseflow.com/pricing/) | Topea en **5 proyectos** incluso en el plan de US$319 | No llega ni a 10 clientes sin cotización Enterprise. Tiene programa de partners, pero **las comisiones no están publicadas — sin verificar**. |
| **Contentsquare** (ex-Hotjar) | Free US$0 (1 proyecto, 5% de sesiones grabadas), Growth **desde US$49/mes** (3 proyectos). Plan Pro: **precio no publicado — sin verificar**. Precios leídos en [contentsquare.com/pricing](https://contentsquare.com/pricing/); la página arma los importes en el navegador y no se pudieron reconfirmar por lectura directa hoy | Cobra por cuenta, pero topea proyectos | No. Además sus términos del plan gratis prohíben *"use the CS Solution to provide services to third parties"* — que es literalmente nuestro modelo. |
| **Hotjar** (suelto) | **Ya no existe**: hotjar.com/pricing redirige a contentsquare.com | — | No. |
| **Smartlook** | **Muerto.** *"31 May 2026 – End of Sale: No new Smartlook subscriptions will be sold"*; plataforma desmantelada el 30/09/2027 — [smartlook.com/pricing](https://www.smartlook.com/pricing/) | — | No se puede ni comprar. |
| **Howuku** | **Muerto.** El sitio dice *"Howuku is no longer operating"* — [howuku.com/pricing](https://howuku.com/pricing) | — | No. |
| **Matomo** (auto-alojado) | Plugin de heatmaps **US$269/año** (1-4 usuarios), US$789/año usuarios ilimitados — [plugins.matomo.org](https://plugins.matomo.org/HeatmapSessionRecording) (v5.7.0, 2026-08-10) | Sitios ilimitados con licencia fija | Costo fijo amortizable, pero es un servidor PHP+MySQL más para mantener y **no está verificado si los heatmaps se pueden leer por API** para renderizarlos en nuestra UI. |
| **OpenReplay** (auto-alojado) | Gratis, pero pide **2 vCPU / 8 GB RAM / 50 GB** mínimo — [docs.openreplay.com](https://docs.openreplay.com/en/deployment/deploy-ubuntu/). Nube: **US$199/mes** — [openreplay.com/pricing](https://openreplay.com/pricing/) | Sí | Un servidor entero más que mantener. Hoy no lo justifica el problema. |
| **Heatmap.com** | Launch **US$199/mes** (facturación del cliente hasta US$10M) — [heatmap.com/pricing](https://heatmap.com/pricing/) | Descuento de portfolio para agencias, **monto no publicado — sin verificar** | No. Arranca en 4 veces el plan entero. |
| **VWO Insights** | **Sin verificar.** La página no muestra ningún importe en el código; se arma con un deslizador en el navegador — [vwo.com/pricing](https://vwo.com/pricing/) | — | Descartado por falta de dato. |
| **FullStory** | Free 30.000 sesiones/mes verificado. Planes pagos: **precio no publicado — sin verificar** — [fullstory.com/pricing](https://www.fullstory.com/pricing/) | — | Descartado por falta de dato. |
| **Attention Insight** | Basic €29/mes, Pro €119, Hero €299 — [attentioninsight.com/pricing](https://www.attentioninsight.com/pricing) | — | No aplica: es predicción por inteligencia artificial *antes* de lanzar, no usuarios reales. |

---

## 5. Cuánto cuesta a 10 y a 100 clientes

**Supuesto de la cuenta:** 2.000 visitas por mes por cliente (una landing típica de negocio chico). Si un cliente tuviera 10.000 visitas, los números de las herramientas por sesión se multiplican por cinco; el nuestro no cambia prácticamente nada.

| Opción | 10 clientes | Por cliente | % del plan de US$47 | 100 clientes | Por cliente |
|---|---|---|---|---|---|
| **Clarity** | US$0 | US$0 | **0%** | US$0 | US$0 |
| **Lo hacemos nosotros** | ~US$0 (entra en el Supabase Pro que ya pagamos) | ~US$0 | **~0%** | ~US$1,25/mes de disco extra | ~US$0,01 |
| **PostHog** *(cuenta mía, no del fabricante)* | ~US$68/mes | US$6,75 | **14%** | ~US$458/mes | US$4,58 |
| **Lucky Orange** | US$72 + 9×US$5 = **US$117** | US$11,70 | **25%** — y solo 1.000 sesiones por cliente | US$199 + 99×US$5 = **US$694** | US$6,94 — con 500 sesiones por cliente |
| **Plerdy** | 10 × US$21 = **US$210** | US$21 | **45%** | 100 × US$21 = **US$2.100** | US$21 |
| **Mouseflow** | **No llega**: su plan de US$319 topea en 5 sitios | — | — | Cotización Enterprise | — |
| **Heatmap.com** | Desde US$199 **por sitio** | US$199 | **423%** | — | — |

**Las dos conclusiones de plata:**

- Cualquier herramienta que cobre por sitio está muerta antes de empezar. Plerdy se come el 45% del plan de US$47. Heatmap.com se come cuatro planes enteros.
- Lucky Orange es el único de pago que cierra numéricamente… hasta que mirás qué comprás: a 100 clientes son **500 sesiones por cliente por mes**. Un cliente con tráfico real quema eso en una semana y después no ve nada. Es barato porque es poco.

Clarity y hacerlo nosotros son las dos únicas opciones que escalan sin tocar el margen.

---

## 6. La opción de hacerlo nosotros

Esta es la parte concreta. El Pixel ya manda un evento por cada clic. Para dibujar el mapa de clics y la curva de scroll le faltan **cuatro campos y dos detectores**.

### Qué falta exactamente

**Para el mapa de clics (4 campos en el evento que ya mandamos):**
1. La posición del clic **relativa al elemento** (una fracción de 0 a 1 dentro de su caja, no la coordenada absoluta de la pantalla — si no, se rompe en celular).
2. El selector del elemento clickeado, para poder agrupar.
3. El ancho y alto de la ventana del visitante.
4. La posición de scroll en el momento del clic y el alto total de la página.

**Para el mapa de scroll:** la profundidad máxima alcanzada por visita, más el alto del documento y el de la ventana. Se manda **una sola vez por página**, cuando la persona se va.

**Los dos detectores nuevos:**
- **Rage click:** 3 o más clics en menos de 700 milisegundos dentro de unos 30 píxeles del mismo elemento. Se detecta en el navegador.
- **Dead click:** clic sobre algo que no es interactivo y que no produce ningún cambio en la página ni navegación en el segundo siguiente. Es la parte más delicada de las dos, pero está resuelta desde hace años.

### Cuánto trabajo

| Tarea | Días |
|---|---|
| Agregar los 4 campos al Pixel | 1 |
| Detección de rage clicks y dead clicks | 1 |
| Ingesta agrupada + tablas + resumen nocturno | 1–2 |
| Pantalla: ranking por elemento + curva de scroll + lista de frustraciones | 1–2 |
| **Total** | **4–6 días** |

### Cuánto cuesta guardarlo

Estimación mía (no es dato de proveedor): un cliente con 10.000 visitas mensuales genera unos **25 MB por mes**. Con 60 días en crudo y resumen después, **50 clientes entran holgados en los 8 GB que ya vienen incluidos en el Supabase Pro de US$25 que ya pagamos**. A 200 clientes el excedente son centavos.

### La trampa que hay que saber antes de decidir

El mapa de calor bonito —la mancha roja sobre la página— **necesita una foto de la landing para pintar encima**. Y esa foto es la parte cara: hay que sacarle una captura automática a la landing de cada cliente, y los hosts tipo Framer, Webflow y WordPress suelen bloquear que la metamos en un marco. Ese es el verdadero cuello de botella, y **no está incluido en los 4-6 días**.

Por eso propongo entregar **el ranking por elemento** ("el botón *Agendar llamada* del medio se clickeó 340 veces; la imagen del testimonio se clickeó 89 veces y no es un botón") **más la curva de scroll** ("el 62% llega al video, el 19% llega a la oferta"). Contesta exactamente la misma pregunta de negocio, sin necesitar la foto. Y viene con algo que la mancha roja no tiene: **se puede filtrar por lead**.

---

## 7. Privacidad: lo que hay que resolver SÍ o SÍ antes de encenderlo en la página de un cliente

Esto aplica a Clarity. Para lo que construyamos nosotros, casi todo ya está resuelto porque el Pixel ya recolecta y ya somos los responsables.

**Si encendemos Clarity en la landing de un cliente:**

1. **La política de privacidad de esa landing tiene que declararlo.** Microsoft publica el texto exacto que hay que pegar, y ese texto dice que los datos se usan **para publicidad**. Es trabajo por cliente, y es una conversación que el cliente tiene que aceptar explícitamente. No se puede encender "por default".
2. **Microsoft no es nuestro proveedor, es un responsable independiente.** No hay contrato de tratamiento de datos donde nosotros mandemos. Si un cliente pregunta "¿quién tiene los datos de mis visitantes?", la respuesta honesta es "Microsoft, bajo sus términos".
3. **El borrado es todo o nada.** *"You need to delete the entire project to delete user's data"* ([FAQ](https://learn.microsoft.com/en-us/clarity/faq)). Si un visitante ejerce su derecho al olvido, hay que borrar el proyecto entero de ese cliente y perder todo el historial.
4. **Tráfico europeo:** en Unión Europea, Reino Unido y Suiza hay que pasarle señal de consentimiento explícito, **por proyecto y por dominio, cada uno por separado**. Sin eso se rompen las grabaciones y los embudos. Trabajo extra por cliente.
5. **Menores de 18:** *"Clarity shouldn't be used on any websites/apps targeting users under the age of 18."* Si algún cliente apunta a ese público, queda afuera.

**Si lo hacemos nosotros:** los datos se quedan en nuestro Supabase, borramos por lead con una sola sentencia, no hay tercero que los use para publicidad, y ya estamos declarados en la política de privacidad de MaKo porque el Pixel ya recolecta. **Es menos trabajo legal, no más.**

---

## 8. La recomendación y su plan

**Elijo: construirlo nosotros en el Pixel, y usar Clarity solo puertas adentro.**

La razón de fondo, en una frase: *el heatmap bonito lo regala Microsoft, pero la unión con el lead no la da nadie — y esa unión es lo único que un competidor no nos puede copiar en una tarde.*

### Los pasos

**Paso 1 — Encender Clarity en la landing de MaKo. Esta semana, 20 minutos.**
Solo en *nuestra* landing, con nuestra cuenta. Cero costo, cero riesgo, y ganamos una herramienta de aprendizaje sobre nuestro propio embudo.
*Qué se decide acá:* nada. Es gratis y reversible.

**Paso 2 — Dos pruebas de 30 minutos, antes de descartar Clarity del todo.**
(a) Ver si desde la ficha de un lead se puede armar un link directo a sus grabaciones filtradas por nuestro id. (b) Pegarle al endpoint de grabaciones que usa Microsoft internamente, a ver si devuelve un enlace por sesión.
*Qué se decide acá:* si **alguna** de las dos funciona, el botón "ver la grabación de este lead" pasa a ser viable con costo cero y cambia el orden de prioridad. Si ninguna funciona, Clarity queda definitivamente como herramienta interna.

**Paso 3 — Construir las tres señales en el Pixel. 4 a 6 días.**
Los 4 campos, los 2 detectores, la ingesta y la pantalla de ranking + curva de scroll. **Sin** la mancha de colores sobre una foto de la página.
*Qué se decide acá:* nada, es ejecución. Es la inversión principal y es la que queda como propiedad nuestra.

**Paso 4 — Enchufarlo a la ficha del lead.**
Que en la ficha de cada persona se vea: hasta dónde bajó, qué clickeó, si se frustró. Esto es lo que ninguna herramienta de la tabla puede hacer, y es lo que convierte una métrica en una razón para llamar a alguien.
*Qué se decide acá:* si vale la pena que MaKo (la inteligencia artificial) lea esas señales y sugiera acciones. Yo diría que sí, pero es una decisión aparte.

**Paso 5 — Recién acá, decidir sobre la grabación de sesión.**
Con lo de arriba andando, medimos si los clientes efectivamente piden ver videos de sesiones. Si lo piden, la opción es PostHog: es el único que documenta punta a punta el flujo de embeber la grabación adentro de nuestra ficha, y a 2.000 visitas por cliente sale entre US$4,50 y US$7 por cliente por mes.
*Qué se decide acá:* si la grabación es una feature del plan Growth de US$97 (que la banca) o si no la hacemos. **No la metas en el plan de US$47.**

### Lo que NO hay que hacer

- **No le administres proyectos de Clarity a tus clientes.** Es trabajo manual (no hay forma de dar de alta proyectos automáticamente), te deja expuesto a cláusulas de sus términos que no pudimos leer, y te compromete a explicar por qué Microsoft usa los datos de sus visitantes para publicidad. Todo eso para conseguir un botón que abre otra pestaña.
- **No pagues ninguna herramienta por sitio.** Ni una.

---

## 9. Lo que quedó sin verificar

Lo pongo entero, sin esconder nada:

1. **Los Términos de Uso de Clarity.** La página se arma en el navegador y no devuelve texto. Solo se pudo confirmar la sección 10 (*Microsoft puede empezar a cobrar*). Las cláusulas sobre "uso interno", "no crear perfiles de usuario", "no ofrecerlo como solución alojada a terceros" y la exclusión de rubros de salud y finanzas fueron leídas por uno de los investigadores pero **no se pudieron reconfirmar**. Si en algún momento la decisión pasa por ahí, hay que leerlos con un navegador de verdad o consultar a clarityMS@microsoft.com.
2. **La página de precios de Clarity** (clarity.microsoft.com/pricing) tampoco se pudo leer. El "gratis para siempre" está verificado en la documentación oficial de Microsoft, dos veces, con esas palabras — pero no en la página de precios en sí.
3. **Si Clarity permite crear proyectos por programa.** Ninguna de sus tres APIs lo hace. Si es que no, dar de alta cada cliente sería un paso manual en el panel de Microsoft.
4. **Si se puede hacer un link directo a las grabaciones de un lead** desde nuestra ficha del CRM (paso 2a del plan). Son 30 minutos de prueba y cambiaría el cálculo.
5. **Qué devuelve exactamente el endpoint interno de grabaciones de Clarity** (paso 2b). El único indicio es que su documentación interna menciona "session links".
6. **El precio de VWO Insights, los planes pagos de FullStory y el plan Pro de Contentsquare.** Ninguno publica importes. Los descarté por eso, no por criterio.
7. **Las comisiones del programa de partners de Mouseflow** y el descuento de portfolio de heatmap.com. No están publicados. En ninguno de los dos casos cambia la conclusión.
8. **Cuánto pesa realmente una grabación de sesión.** Ningún fabricante lo publica: ni Microsoft, ni PostHog, ni OpenReplay. Los números que circulan por internet vienen de blogs. Si algún día dimensionamos grabación propia en serio, hay que medirlo con datos nuestros.
9. **Si los heatmaps de Matomo se pueden leer por su API** para renderizarlos en nuestra pantalla. Esto es lo que decidiría si Matomo es una alternativa real o si queda encerrado en su propio panel igual que Clarity.
10. **El impacto real de sumar un segundo script en las landings de los clientes.** Clarity pesa 25 KB comprimidos y carga de forma asíncrona; Microsoft afirma que no afecta el rendimiento, pero es su afirmación, no una medición nuestra.
11. **Mi cuenta de costos de PostHog y las estimaciones de días de trabajo, almacenamiento y campos faltantes de la sección 6** son estimaciones mías, no datos de fabricante. Los precios unitarios de PostHog sí están verificados; la aritmética y el supuesto de 2.000 visitas por cliente son míos.

---

## Anexo · Lo que la API de Clarity devuelve DE VERDAD

*2026-08-15 · llamado con un token real contra `project-live-insights`*

La pregunta era: si el cliente nos da su token, ¿podemos sacar el ID del proyecto y evitar
pedírselo? Se probó, no se dedujo.

**No. La API no devuelve el ID del proyecto en ninguna forma.** Su única respuesta es una lista
de métricas agregadas:

```
DeadClickCount · ExcessiveScroll · RageClickCount · QuickbackClick · ScriptErrorCount
ErrorClickCount · ScrollDepth · Traffic · EngagementTime
```

Cada una con `sessionsCount`, `sessionsWithMetricPercentage`, `pagesViews` y `subTotal`. Nada
más. No hay endpoint de proyectos, ni el id aparece como campo.

**Tampoco sale del token.** El `sub` del JWT es `3460892749304374`; el proyecto es `y2vjnv3kr3`,
que en base36 da `3461152837449423`. Mismo espacio de numeración, identificadores distintos: el
`sub` es de la cuenta.

**Y hay una razón de fondo por la que nunca va a salir de ahí:** el ID del proyecto no es un
dato de la API. Es lo que va en el `<script src="clarity.ms/tag/…">` de la página del cliente y
en la URL de su panel — dos cosas que existen fuera de Clarity.

### Lo que SÍ se puede hacer con la API, y sirve para el caso multi-landing

`?dimension1=URL` agrupa las métricas **por página**. Con tráfico, eso permite contestar dos
preguntas que hoy no se pueden:

- **¿Este token corresponde a un proyecto que mide ESTA landing?** Si las URLs que devuelve no
  incluyen el dominio que el cliente cargó, el token es de otro proyecto — un error real cuando
  alguien tiene varios.
- **¿Cuál de mis landings tiene tráfico y cuál no?**

Dos límites que hay que respetar al usarlo: sin tráfico devuelve **arrays vacíos** (probado: el
proyecto recién creado devolvió `information: []` en todas las métricas), y **cada llamada gasta
una de las 10 diarias** — así que va en el cron, nunca en una pantalla.

**Vive en:** `lib/clarity.ts` (`resumenClarity`, `normalizarProjectId`)
