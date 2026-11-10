# Hallazgos — Marketing CoPilot (la tab que antes era Ads Manager)

Área: `app/ads-manager/` y `lib/media-buyer/`. Pedido de Martín, 6/11/2026. Relevo: `docs/relevo/nube-marketing-copilot.md`.

## Renombrar una tab: el rótulo se cambia, la key no

- **Síntoma:** al llamarla «Marketing CoPilot» el primer intento rompía `guia-catalogo` («Entra a Ads Manager» en `lib/mako-capacidades.ts`), `sidebar-nueva` y las listas de More.
- **Causa:** `ads-manager` es una key que viven la base (capas, permisos, onboarding), la API y el móvil. La ruta `/ads-manager` la abren links guardados.
- **Regla:** se cambian `label` e `icon` en `app/_components/nav.ts` y `lib/movil-rutas.ts`; la key y la ruta NO. Los textos que le dicen a la persona dónde ir (`mako-capacidades.ts`, `lib/api-mako/tipos.ts`) llevan el nombre nuevo, y la API se regenera (`scripts/generar-api-doc.mjs`).
- **Trampa:** mover una tab de familia (Web Generator, de Marketing a Create) toca seis listas escritas a mano en tests (`sidebar-nueva`, `movil-mas-secciones`, `movil-rutas`) y el orden de More en `lib/movil-rutas.ts`, que debe seguir el de la barra.

## El agente se arma con reglas puras adelante, no con confianza en el modelo

- **Dónde:** `lib/media-buyer/copiloto.ts` (qué funnel conviene, `recomendarFunnel` / `evaluarFunnel`) y `lib/media-buyer/copiloto-contexto.ts` (lo que viaja al system).
- **Regla:** lo que se puede decidir con números (ticket, presupuesto, quién llama) lo decide el módulo puro y llega al system YA decidido («EL FUNNEL ELEGIDO NO LE SIRVE: …»). El modelo lo discute, no lo calcula. Un umbral se cambia en `UMBRALES` y los tests lo frenan en el borde exacto.
- **Las fuentes no se nombran:** `docs/conocimiento/anuncios-high-ticket.md` es de uso interno (casi todas las fuentes venden algo, ninguna cifra está auditada). El destilado (`copiloto-conocimiento.ts`) dice «un practicante de EE. UU., 2026», nunca el nombre; un test cruza la lista de nombres contra el documento para que no quede vieja.
- **Trampa del peso:** cada ficha de `lib/asesores` son ~5.000 caracteres en CADA mensaje. El CoPilot lleva a lo sumo dos (el referente elegido y una por tipo de funnel). Un test fija el tope.
- **Trampa de la tab:** el chat de una tab sólo toma su contexto propio si `MakoEnLaTab` declara `tab="Marketing CoPilot"` y la ruta lo mira (`desde.tab`). Cambiar el nombre en un lado y no en el otro lo deja hablando como el Ops Center, sin error. Un test lee los dos.
- **Una pantalla nueva con `<CajaChat>` entra en la lista de `tests/app-de-escritorio-todos-los-chats.test.ts`:** se pasó por alto en la primera entrega y lo cazó el test, no la revisión.

## Campañas: «un producto por columna» no escala; la columna es lo que hay que hacer

- **Síntoma:** con un solo producto en el CRM (el caso de Mauricio) todas las campañas caían en una columna; con seis, las de más bajaban de fila y perdían su rama.
- **Causa:** la columna era una dimensión del CRM y no de la decisión. El producto sirve para filtrar; lo que le importa a quien mira es qué hacer con cada campaña.
- **Dónde vive:** `lib/media-buyer/campanas-grupos.ts` (puro). Funcionan / En prueba / Para revisar, con la vara del negocio (su objetivo; si no lo puso, el que MaKo calculó; si tampoco, el promedio de la cuenta). **Poco dato no decide:** menos de 3 resultados espera; sin resultados se revisa sólo si ya gastó lo que cuesta uno.
- **Trampa:** la vara se mide con TODAS las visibles; sacar las pausadas antes la movería y con ella la columna de cada campaña.
- **Trampa de CSS:** una columna vacía en el teléfono ocupa una pantalla entera; `data-vacia` la esconde ahí y se deja en la computadora (ver que no hay nada para revisar es información).
- **Regla:** el color del costo en la tarjeta (`tono`, del backend) y la columna (acá) usan la misma tolerancia (20%); si una cambia, cambia la otra (`TOLERANCIA_CARO`).

## El filtro del push no corre lo que no se tocó

- **Síntoma:** dos tests cayeron DESPUÉS de subir (`movil-shell` decía «Ads Manager»; el inventario de cajas de MaKo no tenía la pantalla nueva).
- **Regla:** tras renombrar una tab o sumar una pantalla con `<CajaChat>`, correr a mano `tests/movil-*`, `sidebar-nueva`, `app-de-escritorio-todos-los-chats` y `media-buyer-*` antes de subir.

## La ficha del referente manda sobre el negocio si nadie la corrige (revisión del agente, 6/11)

- **Síntoma:** simulando 14 conversaciones con SÓLO el contexto del turno (unos 20.700 caracteres), el agente fallaba en 8: con US$20 por día aplicaba la ficha de anuncios (cinco campañas de venta, tres públicos por cuatro creativos, fases 10/70/10/10); a un coach con poco tiempo en YouTube le llegaba la ficha de canales automatizados que viven del CPM (40 videos, nichos, canales en inglés); y en Google/LinkedIn y en «garantía» no había nada, así que improvisaba.
- **Causa real (no la obvia):** el conocimiento de anuncios estaba bien; lo que desbarataba era la ficha de `lib/asesores`, que se pega sin saber del presupuesto ni del tipo de negocio. Y `planOrganico` (el reparto de piezas) existía pero NO llegaba al agente: contestaba «cuánto publico» de memoria.
- **Dónde vive:** `lib/media-buyer/copiloto-contexto.ts` → `REGLAS_DEL_COPILOTO` (3, 6, 8, 9, 10) y `negocioDelCopiloto` (TAMAÑO DE LA CUENTA, TODAVÍA NO SABES, reparto orgánico, YOUTUBE PARA ESTE NEGOCIO). Cada una la fija `tests/marketing-copilot-agente.test.ts` (conversaciones 7 a 14).
- **Regla:** todo lo que el código ya calculó (reparto, veredicto, cuántos conjuntos caben) viaja al agente; lo que no se calcula, no se le deja a la memoria del modelo. Una ficha nueva que pida estructura debe poder achicarse por presupuesto.
- **Sin hacer:** Google Ads y LinkedIn Ads no tienen cifras (el documento de anuncios los marca como pendientes, línea 176): el agente sólo da criterio. El perfil no guarda país ni «tiene casos»: se pregunta cada vez. Los montos del bloque del negocio salen como «$3,000» y el conocimiento escribe «US$3.000»: mezcla de separadores en español.

## Dos chats hicieron la misma tarea a la vez (6/11, segunda sesión de la nube)

- **Síntoma:** una sesión de la nube armó el Marketing CoPilot entero (agente, primera entrada, Campañas en tres columnas, Ajustes, el teléfono) y, al ir a subir, `main` ya lo tenía: otro chat (cuenta 3) recibió el MISMO pedido, lo empezó después y lo subió primero (`6dba2d56..7db26c61`, de 05:54 a 07:50).
- **Causa:** el pedido se repartió dos veces. Mi base (`4d095e31`, 00:30) era la buena al arrancar, así que «medir el árbol contra la rama del brief» no lo cazaba: llegó durante el trabajo.
- **Regla:** si el brief nombra su punta (`punta/<nombre>`), `git ls-remote origin 'refs/heads/punta/<nombre>'` al empezar y antes de cada tanda grande. Si ya existe y no es tuya, otro chat está en lo mismo: se para y se pregunta, o se suma a lo suyo.
- **Qué se hizo con lo duplicado:** se descartó entero y se sumó sólo lo que a `main` le faltaba (la sección de abajo). Lo de la otra sesión que podría servir, sin portarlo todavía: una operación de la API que propone la estrategia por canal sin pasar por la charla (`recomendar_estrategia_marketing`) y reglas de criterio de dos repos abiertos (`coreyhaines31/marketingskills`, MIT; `AgriciDaniel/claude-ads`, MIT), parafraseadas: fatiga con frecuencia de 7 días mayor a 3 (grave a 4) y CTR un 20 % abajo; escalar de a 20 % cada 3 a 5 días; landing con 5 % o más de conversión, si no, formulario; un webinar se paga en frío recién cuando anduvo en orgánico. Si alguna se suma, va a `REGLAS_DEL_COPILOTO`, con su licencia en el commit.

## El teléfono no hablaba con el CoPilot (6/11, segunda sesión)

- **Síntoma:** en el teléfono, «Pídele algo a MaKo» y «Pregúntale» de una tarjeta abrían `/m/mako`. Eso redirige al Second Brain, que no manda `desde`, así que el turno caía en el contexto general y MaKo no hablaba como CoPilot. La computadora sí manda `desde.tab = 'Marketing CoPilot'` (la estrella, `MakoEnLaTab`).
- **Dónde vive:** `app/m/ads/HojaDelCopiloto.tsx`: el Cerebro (`entrarAlCerebro`, la misma conversación que la estrella) con `desdeDelCopiloto` (`lib/media-buyer/copiloto.ts`), en la hoja de MaKo Mobile como la del Funnel Coach.
- **Segundo hueco, del mismo lado:** «Cambiar mi estrategia» es `/ads-manager?estrategia=1`, y el desvío al teléfono (`rutaMovil`) devolvía `/m/ads` pelado: la query se perdía y la página del teléfono tampoco la leía. Ahora viaja (`QUERY_DE_SECCION.ads`) y `app/m/ads/page.tsx` reabre la charla.
- **Tercero:** con un funnel de anuncios, el Plan sólo estaba en la computadora. El teléfono suma «Hoy | Plan» (`seccionesDelTelefono`, puro): Campañas y Biblioteca siguen en la computadora.
- **Regla:** un chat de una tab en el teléfono manda el MISMO `desde` que su estrella en la computadora; mandar a `/m/mako` pierde el contexto sin un error. Y un link que lleva query a una pantalla que existe en los dos lados se mira con `rutaMovil`: si la query decide algo, va en `QUERY_DE_SECCION`.
- **Trampa del banco:** la caja del chat del teléfono sale sin estilo si el contenedor no tiene `data-m` (`operaciones.css` lo pide; lo pone `app/m/layout.tsx`). `scripts/banco-copilot/telefono.tsx` lo pone.


## Dos chats en la misma pantalla: la charla del medio mandaba lo escrito al panel del costado (feedback de Martín, 6/11, tercera sesión)

- **Síntoma:** Martín, en producción: «Si hay un chat en el medio, por qué se abre el chat al costado». En la primera entrada, lo que se escribía que no era una respuesta salía por `discutir`, que abría `MakoEnLaTab` al costado: la misma pregunta, contestada en otra caja.
- **Dónde vive:** `app/ads-manager/PrimeraEntrada.tsx`. La charla del medio monta su propio motor (`MotorDelCopiloto`: `useChatCliente` con `entrarAlCerebro` y `desdeDelCopiloto(pantalla)`, sin ventana propia) y dibuja la respuesta EN el medio, debajo de la pregunta en la que se escribió. La pantalla ya no monta `MakoEnLaTab`. Sin IA del negocio, el turno contesta «Conecta tu IA» con su botón, ahí mismo (`ConectarDelAviso`), y las pastillas siguen andando.
- **Trampa:** el motor sólo se monta al primer mensaje libre: montado siempre, cada visita abría la sesión del Cerebro sin que nadie escribiera. Y después de cada turno se relee lo guardado (`copiloto_leer`, estricto): MaKo puede guardar el funnel que acordaron, y la charla lo tiene que mostrar. Una lectura tolerante que cae a `{}` reiniciaría la charla.
- **Regla:** si la pantalla ya tiene un chat, ése contesta. La estrella de la tab es para las pantallas que no tienen uno (Hoy, Campañas, Plan): ahí la caja del medio no tiene hilo y abrir la conversación es lo que corresponde.

## «Volvamos a empezar» se ignoraba: lo que se escribe para corregir se lee SIN IA (6/11, tercera sesión)

- **Síntoma:** Martín eligió un referente por error, escribió «Volvamos a empezar» y no pasó nada: el texto se leía como respuesta del paso, y si no lo era, iba a la IA.
- **Dónde vive:** `lib/media-buyer/copiloto.ts` → `comandoDeCopiloto` (fuerte antes de leer la respuesta, débil después), `volverUnPaso`, `interpretarEscrito` y `acuseDeVolver`; en pantalla, «‹ Volver» y «Empezar de nuevo» debajo de la charla, y «Empezamos de nuevo.» con su «Deshacer». Lo fija `tests/marketing-copilot-volver.test.ts` (11 casos, seis roturas al pie).
- **Trampas:** «no era eso» empieza con «no», que en la pregunta de la competencia es una respuesta: por eso hay un «volver» FUERTE que se mira antes. «Cambiar» suelto vuelve, pero en el aviso y en la propuesta es la respuesta. Una PREGUNTA no contesta un paso («¿qué es un webinar?» no elige el webinar) salvo que sea una pastilla tal cual. «La otra opción» en un paso de dos elige la otra. Y volver del «Sí, cambiemos» devuelve lo que la persona había elegido (`antesDelAjuste`), no lo que propuso MaKo.
- **Trampa de pantalla:** al volver al paso de los referentes por lo escrito, la grilla quedaba debajo de la pregunta de antes y lo escrito, debajo de 32 tarjetas, fuera de la vista. La grilla va debajo del ÚLTIMO mensaje de MaKo de ese paso, y MaKo acusa en una línea.

## Los referentes: estaban 8 de 32, y lo que enseñaba cada uno no estaba medido (6/11, tercera sesión)

- **Síntoma:** Martín: «no creo que hayas puesto a todos, pusiste a pocos... Doglio, no creo que te enseñe a hacer webinar». La lista era una mano de ocho, y a cada uno se le había asignado funnels de memoria.
- **Lo medido (`docs/marketing-copilot/referentes.md`):** a Doglio le sobraba y le faltaba algo. Su curso es sobre todo historias de Instagram (un ciclo de siete días) y setters, pero también trae siete clases de webinar: se le ofrecen las dos, en ese orden, y su ficha sumó el marco de las historias que no tenía.
- **Dónde vive:** `lib/media-buyer/copiloto-referentes.ts` (`QUE_ENSENA`, un `Record` total: un referente nuevo en `lib/asesores` no compila sin su fila). Un funnel entra sólo con un título de clase de evidencia Y un marco en su ficha; lo que el curso enseña y la ficha no, va en la nota y no se ofrece.
- **El diagnóstico obvio era el equivocado:** «falta sumar referentes a la lista» era la mitad. La otra mitad era el peso: con todos adentro, pegar la ficha del referente siempre (5.000 caracteres) dejaba al agente con dos fichas sobre lo mismo. Ahora viaja la tabla («QUIÉN ENSEÑA QUÉ») y la ficha sólo si viene al caso.
- **Trampa:** cuatro funnels que el curso sí enseñaba (Sofía y el formulario, Ramiro y el VSL, Jaime y el mini VSL, Juan ADS y los formularios) no tenían marco en la ficha: ofrecerlos hacía que el agente improvisara el método «del referente». La ficha de base del VSL y del formulario pasó a Marcos Razzetti, la única que los trae escritos.

## Un solo fondo: la tab pintaba un «apenas cálido» y alrededor quedaba el de la app (6/11, tercera sesión)

- **Síntoma:** Martín: «el background no es igual en toda la tab de copilot, es blanco y crema en algunos lados, eso esta mal, ya varias veces cometes el mismo error».
- **Causa:** `.aa` pintaba `--aa-calido` (el fondo con 5 % del dorado de MaKo, copiado de AdAmigo). Esa caja termina donde termina su contenido: alrededor y debajo queda el fondo del layout. `A_SANGRE` la lleva de borde a borde, no de arriba abajo, y por eso el corte se ve recién con poco contenido o con la barra plegada.
- **Regla (AGENTS.md, «Una pantalla no pinta su propio fondo»):** el fondo de la página es `var(--bg)`; lo que va encima son tarjetas. La fija `tests/un-solo-fondo.test.ts` (ningún «casi fondo» en el repo, y los contenedores de la tab sin otro fondo) y la mide `scripts/banco-copilot/medir-fondo.mjs`: 160 pantallas (10 × claro/oscuro × barra abierta/plegada × 390/768/1024/1440), un solo color de página, nada que se salga a lo ancho, la caja entera y las tarjetas sin pisarse. Con el crema devuelto, las 160 dan rojo.
- **Trampa de la medición:** en el banco, la barra falsa de la app usaba `var(--sidebar)`, que ahí no existe, y salía blanca: se confundía con el fondo. Va un color fijo.

## La revisión de la tanda: leer texto libre con reglas falla en lo obvio (6/11, tercera sesión)

- **Lo que encontró un revisor que no escribió el código, y se corrió:** «Estoy empezando de cero en esto» y «3000 y arranco de cero» BORRABAN la charla (un `de cero` suelto era «empezar»); «¿Hay otra opción para el ticket?» volvía atrás; «No sé si me sirve» ACEPTABA la propuesta y terminaba la charla (`/sirve|…/` sin anclar); nombrar Instagram charlando con Derek sacaba el «no lo enseña» enlatado; un `{}` guardado reiniciaba la charla al terminar un turno de MaKo; «Empezar de nuevo» desmontaba el motor y dejaba un `enviar` colgado de un hook muerto; «Deshacer» devolvía el perfil pero no lo hablado; y un mensaje que no podía salir quedaba «enviando» para siempre.
- **Dónde vive:** `lib/media-buyer/copiloto.ts` (`comandoDeCopiloto`: «empezar» sólo con la forma de un pedido, nunca un gerundio; una pregunta no vuelve atrás; aceptar pide un sí claro; `fueraDe` sólo cuando se pide) y `app/ads-manager/PrimeraEntrada.tsx` (lo guardado se adopta sólo si lo cambió MaKo y nadie tocó nada en el medio; el motor no se desmonta; «Deshacer» guarda la foto entera; el envío que no sale lo dice).
- **Regla (la de AGENTS.md, «Leer texto libre con reglas falla en lo obvio»):** lo que termina algo sin vuelta (aceptar la propuesta) pide una lectura estrecha; lo dudoso va a MaKo, que tiene el contexto. Y lo que se puede deshacer (empezar de nuevo) se puede leer más ancho porque el «Deshacer» devuelve todo.
- **Trampa repetida:** `\b` después de «sí» no corta (es ASCII): «Sí, investígala» dejó de entenderse con un `^s[ií]\b`. Va `(?![a-záéíóúñ])`.
- **Y el veredicto cazó lo que el filtro chico no:** «acá» y «cambialo» en archivos nuevos. El guard de voseo barre con `git ls-files`: un archivo sin `git add` es invisible para él.

## La batería con el turno de verdad: los tests miraban el system, no lo que contesta (9/11/2026)

- **Síntoma:** con 21 tests del agente en verde, siete conversaciones reales (`scripts/probar-chats/copiloto.mts`, el `turnoApp` de producción en el ws 9) dieron 5,1 de 12. Hacía de redactor (el anuncio, el post, el guion al segundo mensaje), no preguntaba la meta en ningún caso, a una tienda no le preguntó el presupuesto ni el margen, se contradijo con MaKo (VSL sin saber el precio, y al turno siguiente «con US$1.000 no alcanza»), y en 56 turnos no guardó nada ni usó `calcular_presupuesto_anuncios`. El detalle: `docs/relevo/marketing-copilot-pruebas.md`.
- **Causa:** los tests probaban que el system TRAE lo correcto (la regla AGENTS.md «El test que fija la regla tal como la escribiste no es una prueba de uso»). El system traía reglas de anuncios de ticket alto y casi nada de cómo descubrir un negocio: ningún orden de trabajo, ninguna lista de lo que falta, y para una tienda, un local o el email, nada.
- **Regla:** un cambio en el agente del CoPilot corre la batería ANTES de la punta (dos tandas en paralelo, unos 40 min por la red del ws 9). El arnés pone el negocio de cada caso en memoria (perfil del negocio, Second Brain, lecturas de la cuenta), el perfil del CoPilot en memoria, y la persona la hace Haiku con una ficha que tiene MÁS de lo que dice sola: lo que MaKo no pregunta, no aparece.
- **Trampa del arnés:** `contextoDelCopiloto(perfil)` a secas deja el turno mudo a la edición de /configuraciones: el arnés y la ruta pasan por `contextoDelCopilotoVigente`.

## «Inspirado en Juan Osorio» en cada mensaje: no era el modelo, era la ficha por defecto (9/11/2026)

- **Síntoma:** en cuatro de siete casos el agente firmaba casi cada mensaje «inspirado en la metodología de Juan Osorio», también a una nutricionista que quería YouTube, y a una inmobiliaria «la máquina de selección natural de Marcos Razzetti». Nadie los había elegido.
- **El diagnóstico obvio era el equivocado:** parecía un modelo chico que no sigue la regla 4. La causa estaba en el código: sin funnel ni referente, `fichasDelCopiloto` mandaba la ficha de Juan ADS, y toda ficha viaja con `reglasDe` (lib/asesores/contexto.ts), que dice «ATRIBUYE SIEMPRE». La regla 4 y la ficha se contradecían, y ganaba la ficha.
- **Dónde vive:** `lib/media-buyer/copiloto-contexto.ts` → `fichasDelCopiloto` (sin funnel, ninguna) y `fichaDeApoyo` (la del funnel, sin nombre ni «inspirado en»). Sólo el referente ELEGIDO viaja con `contextoDeReferente`. Lo fija `tests/marketing-copilot-agente.test.ts` («qué fichas viajan»).
- **Regla:** una ficha de lib/asesores que la persona no eligió no viaja con sus reglas de atribución: va como material de apoyo.

## En el ws 9 el CoPilot contesta con gemini-flash-lite, y tarda hasta 4 minutos (9/11/2026)

- **Síntoma:** turnos de 15 a 270 s, y respuestas con errores de modelo chico («ispirado», «expiar» por exprimir, una marca `[no-pude: …]` a la vista).
- **Causa:** la cascada de la plataforma prueba las cuatro claves de Gemini del ws 9 (`credenciales`, la misma base en local y producción): `GEMINI_API_KEY` y `_4` dan 401 «API key not valid», `_2` da 429 (cuota diaria gratis agotada) y `_3` se pasa de tiempo con flash y rota a flash-lite. Un negocio con su propio Claude o GPT no pasa por acá.
- **Sin hacer:** renovar o sacar las dos claves vencidas del ws 9 (es de Martín). Y el doer saca `[[no-pude: …]]` pero no `[no-pude: …]` con un corchete (lib/doer-salida.ts): un modelo chico lo escribe mal y queda a la vista.

## El panel y el agente leen la MISMA pieza (9/11/2026)

- **Dónde vive:** `fichaDelNegocio`, `recorridoDe`, `cuentaDe`, `compararFunnels` y `datosDeDecision` (lib/media-buyer/copiloto.ts, puro). El system del agente («LO QUE YA SABES», «LO QUE TE FALTA», «LOS FUNNELS PARA ESTE NEGOCIO», «LA CUENTA») y el panel de la tab (`app/ads-manager/PanelDelFunnel.tsx`) salen de ahí. Lo fija `tests/marketing-copilot-descubrir.test.ts`.
- **Trampa que se cazó escribiéndolo:** `completar` pone el presupuesto en 0 cuando el funnel no lleva anuncios; sin funnel, eso convertía «no lo dijo» en «no tiene plata», y toda la comparación salía «no le sirve» para los anuncios. `datosDeDecision` decide sólo con lo que la persona dijo.
- **Trampa de la pantalla:** guardar un DATO (la meta, el país) por `ir` (el camino de la charla) escondía la pregunta y lo hablado en ese paso: `ir` lo toma como «volver al mismo paso». Un dato va por `fijarDato`, y el acuse de un cambio de funnel va DESPUÉS de `ir`, en el paso nuevo. Lo fija `tests/marketing-copilot-pantallas.test.ts`.
- **Trampa de CSS:** `display: contents` en el `<li>` de una ficha le borraba la caja (borde y relleno) y las fichas salían como texto suelto. Se vio en la captura, no en un test.
- **Lo escrito se confirma:** una respuesta escrita a un dato («Uruguay») se muestra como «Entendí: Uruguay. ¿Lo anoto?» antes de guardarse (AGENTS.md, «la red es que la persona CONFIRME»); una pastilla ya es el toque.

## Sin hacer (9/11/2026)

- **El CoPilot no guarda solo lo que descubre charlando.** En una pregunta, las herramientas que escriben no viajan (lib/doer-herramientas.ts, decisión de Martín del 8/10: «la ofrece»): MaKo ofrece guardarlo y, con el «sí», propone la tarjeta. El panel guarda directo con sus pastillas. Si Martín quiere que un dato dicho en el chat aparezca solo en el panel, hay que decidir una excepción para `copiloto_media_buyer` (no mueve plata ni toca a nadie).
- **El Funnel Coach del Ops Center y el CoPilot guardan el funnel en dos lugares** (`guardar_plan_funnel` en lib/funnel-plan-db.ts y `marketing-copilot.perfil`). Hablan de lo mismo con dos memorias.
- **La pantalla de un funnel CON anuncios** (Hoy · Campañas · Plan · Biblioteca, `MediaBuyer.tsx`) sigue con su diseño: la de dos columnas se hizo para la charla y para los funnels sin anuncios.
- **Knowledge de anuncios y de orgánico está vacío** (`mako_knowledge`, áreas `ads` y `organico`). El CoPilot ya lleva `leer_modulo_knowledge`: cuando llegue el curso de gestión de campañas, lo usa sin tocar nada acá.
