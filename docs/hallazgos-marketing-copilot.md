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

## «¿Y si hago orgánico?» cambiaba el funnel: tres corridas con la regla en el prompt, y la cumplió el código (9/11/2026)

- **Síntoma:** ante «¿Y si en vez de anuncios me enfoco en orgánico?», el agente proponía guardar el funnel orgánico (con US$0 de
  anuncios que nadie dijo). Pasó en la segunda corrida y otra vez en la tercera, ya con la regla B del prompt («una pregunta "¿y si…?" NO
  es una decisión»).
- **El diagnóstico obvio era el equivocado:** «falta decirlo más fuerte en el prompt». El clasificador lee el verbo («me enfoco») como
  un pedido de actuar, la herramienta viaja, y un modelo chico la usa. Más texto no lo cambia.
- **Dónde vive:** `esPreguntaHipotetica` (lib/media-buyer/copiloto.ts) y la guarda en el `preparar` de `copiloto_media_buyer`
  (lib/api-mako/areas/ads.run.ts, mira `ctx.mensajeUsuario`, como ya hacía chats.run.ts): con una pregunta así no se propone cambiar el
  funnel, y el error le dice al modelo que compare. Un pedido claro («cambiemos», «dale, guardalo», «prefiero») pasa.
- **Regla:** lo que el agente NO debe hacer en una situación que se puede reconocer en el texto de la persona se pone en el código de la
  acción, no sólo en el prompt (la misma de AGENTS.md, «Y una regla de un canal de MaKo puesta SÓLO en el prompt no es regla»).

## El curso de campañas: el portal no es Knowledge, y Knowledge es por negocio (9/11/2026)

- **Síntoma:** el curso «Programa de Meta Ads 2026» entró a /conocimientos (`54ded47e5`) «para el Marketing CoPilot», y el CoPilot no lo
  veía: `leer_modulo_knowledge('anuncios')` contestaba que el módulo no tenía fichas.
- **Causa:** los agentes no leen el portal (sólo el curso del referente que tiene un chat al frente, `lib/cerebro-para-chat.ts`), y
  `mako_knowledge` es por NEGOCIO: las fichas están copiadas fila por fila en el ws1 y el ws4, con embeddings de la IA de cada uno.
  Cargarlo ahí obligaba a escribir en cada negocio de producción, y uno nuevo no lo tendría.
- **Dónde vive:** destilado por tema en `lib/media-buyer/copiloto-metodo-anuncios.ts` (fuente interna con las lecciones citadas:
  `docs/conocimiento/meta-ads-gestion.md`), servido por la operación de lectura `metodo_campanas_copiloto` (lib/api-mako/areas/ads.*),
  que el CoPilot lleva entre sus herramientas. En una herramienta y no en el system: son ~16.000 caracteres y viaja sólo el tema que se
  pide (el system ya está en 33.000 y las herramientas tienen que dejar 4.000 libres del presupuesto de 12.000; los dos los fijan tests).
- **Trampa:** 7 de 94 lecciones tienen transcripción (el video está cifrado); casi todas las cifras salen de los PDF y planillas del
  material. El destilado las cita como «material L44».

## La punta en rojo: cuatro guardas que el filtro local no corrió (9/11/2026)

- **Síntoma:** «punta → main» falló en guardas, tipos y tests; el filtro del pre-push había dicho «a medias» (sin RAM).
- **Las cuatro, y su regla:** (1) un `Record<IdFunnel, …>` en un test (`MARCO_DE`) quedó sin `email`: al sumar un funnel, `git grep "Record<IdFunnel"` incluyendo `tests/`. (2) `getPromptText(x.key, …)` dentro de un ayudante: la guarda del registro de prompts sigue las keys por nombre; cada call site va con `PROMPTS_X.campo.key` literal. (3) Un script que llama a `turnoApp` tiene que estar en `ENTRADAS_DE_PERSONA` (tests/ia-pc-nunca-a-leads.test.ts) con la prueba de que no manda el turno a la PC de nadie. (4) Un detector del voseo de lo que ESCRIBE la persona («guardalo», «hacelo») va en un archivo propio declarado en `FUERA_DE_ALCANCE` (tests/puente-panel-copy.test.ts), no en el módulo grande, que así sigue barrido.

## El recorrido en producción (10/11/2026): lo que los tests y el banco no veían

Martín: «muchísimas cosas que se están rompiendo… es fácil ver e identificar eso». Se recorrió la tab en hola-mako.com (ws 9),
escritorio, tablet y teléfono, claro y oscuro. Lo que vale para lo que venga:

- **«Comparar funnels» inventaba un «$0 al mes».** Con Julián Otálora (enseña sólo orgánico) y el ticket contestado, cada funnel con
  anuncios decía «Con $0 al mes los anuncios no juntan datos», Lead magnets salía «MaKo lo recomienda» y Email «Te sirve».
  ⚠️ **El diagnóstico obvio, «no se preguntó el presupuesto», era el equivocado:** el perfil no tenía presupuesto y
  `datosDeDecision` lo COMPLETABA con 0 porque el funnel elegido no lleva plata. Eso vale para juzgar ESE funnel y es falso para los
  otros ocho. **La regla:** el veredicto del funnel elegido sale de `datosDeDecision`; recomendar uno y comparar los nueve, de
  `datosDichos` (sólo lo que dijo), en el panel, en el contexto del agente y en `ver_copiloto_media_buyer`. Ajustes tenía la misma
  suposición escrita a mano (`presupuestoMes ?? 0`, `llamadas ?? 'yo'`). Un email sin saber la lista no «sirve».
- **El alto de la pantalla mira la ventana, y arriba puede estar la barra de inspección.** Con «Estás viendo el dashboard de…»
  (Martín siempre la ve), `.cp` medía `100dvh - 28px` y el pie quedaba 50 px debajo: la página scrolleaba sola al elegir y se
  cortaba la cabecera. Los altos de la tab descuentan `--barra-agencia` (regla en AGENTS.md, «La barra de inspección»).
- **Un panel montado en otra pantalla no hereda el contenedor de sus reglas de ancho.** Las `@container copiloto` de PanelDelFunnel
  miraban `.aa-dos`; en la vista Plan no había ninguno y a 390 el recorrido iba en cuatro columnas de una palabra.
- **Sin números, una columna que dice lo mismo nueve veces es ruido.** Lo que falta va una vez arriba de la lista.
- Menores: «Lanzar el primer anuncio» era el único paso sin pantalla; «0 campañas en 3 productos» contaba los del CRM sin campañas;
  «← Media Buyer» y el cargando tenían el nombre viejo; los pedidos de la tab llevaban «Marketing CoPilot:» además del chip «desde».
- **(Segunda pasada, por persona, ws 3) La charla se vuelve a dibujar desde el perfil de AHORA.** Un paso cuyo texto depende de algo
  que la respuesta cambia (el aviso del «ajuste»: «el VSL pide $3.000… propongo mensajes») se borraba al aceptarlo: pasaba a «¿Seguimos?»
  porque el funnel nuevo sí sirve. **La regla:** la pregunta y la respuesta de un paso se arman con el perfil como estaba al llegar a
  ese paso (`perfilDelAjuste`), y la respuesta dice lo que tocó la persona.
- **El panel no mide la página:** las reglas de ancho del panel miraban el contenedor de la PÁGINA, y a 1024 el panel medía 480 px con
  cuatro etapas de 96. Lo de adentro del panel va por `@container panel-funnel` (el panel mismo).
- **Una pantalla que reemplaza la tab entera tiene que saber lo que la persona ya tiene acá.** «¿En qué te ayudo hoy?» (la bienvenida
  de una cuenta nueva) tapaba el Plan y Ajustes de un negocio que ya había elegido su estrategia en el CoPilot, sin Meta conectado.
- **Sin la app de escritorio no se puede escribir en la charla**, ni lo que se lee sin IA: las opciones tienen que cubrir a todas las
  personas (una tienda de US$45 no tenía su ticket), y un paso nunca puede quedar sin un botón para seguir («Empezar de nuevo»
  dejaba sólo «Deshacer»).
- El informe caso por caso, con capturas: `docs/pruebas/marketing-copilot-10-11.md`.
- Del chat de la tab (la estrella encima de la caja, el hilo de Image en el CoPilot y al revés): [hallazgos-chat.md](hallazgos-chat.md).
  Del navegador en que se miró: [hallazgos-pruebas.md](hallazgos-pruebas.md).

**Vive en:** lib/media-buyer/copiloto.ts (`datosDichos`, `faltaParaComparar`, `compararFunnels`) · app/ads-manager/PanelDelFunnel.tsx ·
app/ads-manager/aa.css · tests/marketing-copilot-produccion.test.ts.

## El relevo de los funnels: la transcripción de un curso puede estar en tres lugares, y el primer pase leyó el vacío (10/11/2026)

Martín pidió rehacer los funnels con las transcripciones de TODOS los cursos de Knowledge, y nombró THE NET LAB. Seis agentes
leyeron unas 470 clases, y los seis informaron lo mismo: de THE NET LAB «sólo hay apuntes, la 04 y la 05 tienen transcripción».
**El diagnóstico obvio («ese curso todavía no está transcripto») era el equivocado.** Las 97 transcripciones completas existían;
estaban en otro lado.

Dónde vive el texto de una clase, según cómo entró el curso:
- **`public/cono-tx/<videoId>.json`**: los cursos con video en Drive (el índice por `videoId` de `app/conocimientos/curso-<slug>.ts`).
  THE NET LAB tiene 0 ahí: no tiene `videoId` de Drive.
- **`public/cono-doc/<slug>__<tema>.json`**: los cursos `soloTexto` (THE NET LAB), con la pestaña «Transcripción» sólo si hubo
  `.vtt` ([hallazgos-conocimiento.md](hallazgos-conocimiento.md), «THE NET LAB»).
- **`C:/cursos/<slug>/transcripciones/*.json`**: lo que salió de grabar las clases (10/11, ElevenLabs), antes de llegar al portal.
  `C:/cursos/<slug>/texto/*.md` tiene la sección «Transcripción», pero vacía en 87 de 94 clases: el generador la limpia porque
  el texto viaja aparte. Al 10/11, 23 h, en `transcripciones/` faltaban la 06, la 44, la 70 y la 75, y la 13, 14, 33, 68, 78 y
  82 venían en partes (97 archivos para 90 clases).

Un segundo pase con dos agentes leyó 81 clases de THE NET LAB desde `transcripciones/` y cambió el resultado: el curso trae los
números que deciden cualquier funnel con anuncios (lo que queda de cada venta, el costo máximo por venta, cuándo crecer) y, en
cambio, no enseña VSL con llamada en ninguna clase.

**La regla:** antes de relevar un curso, contar sus clases con texto en los tres lugares y leer el que lo tenga completo. Un
agente que encuentra «sin transcripción» tiene que decir dónde miró. Para el índice de los 127 cursos (n, módulo, título,
`videoId`, bytes de texto), alcanza con partir cada `curso-<slug>.ts` por clase. Ojo: el repo está en CRLF, y un `split('\n{\n')`
devuelve una sola clase por curso sin dar error.

**Vive en:** docs/marketing-copilot/funnels-simples.md (el resultado) · docs/marketing-copilot/funnels/ (un relevo por funnel,
cada uno con su censo).

## La maqueta del rediseño: el CSS compilado de producción, no un dibujo «parecido» (10/11/2026)

Martín no quería el diseño del CoPilot («tiene que ser SIMPLE… aprender a replicar, no crear cosas desde cero») y pidió verlo
antes de que se programe. La maqueta (`docs/marketing-copilot/rediseno/maqueta-dos-columnas.html`) no copia a ojo: lleva **pegado el CSS que
sirve hola-mako.com** y el marcado de las piezas que ya existen, con sus clases reales:
- **El CSS:** la página lista sus hojas en `document.styleSheets` (`/_next/static/chunks/<hash>.css`). Son públicas: se bajan con
  curl sin sesión. Los nombres cambian en cada despliegue, así que se leen de la página del día.
- **El marcado:** el `outerHTML` de cada pieza en producción (la tarjeta de Create con su «←», la lista, la caja), sin SVG ni
  estilos en línea para que entre en el contexto, más el JSX del bloque de preguntas (`PreguntasDelChat.tsx`).
- **Lo que tiene estilos en línea** (el wizard de `WizardShell.tsx`, el cuerpo BlockNote de Copywriter) se mide con
  `getComputedStyle` y se copia el valor.

Las piezas: la conversación de MaKo (`ConversacionCerebro`), el bloque de preguntas del Ops Center arriba de la caja, la lista de
la «←» de Create para los funnels, y «Tu funnel» es la página de Copywriter. Lo que no se sabe se muestra como su «Vacío», y al
tocarlo MaKo lo pregunta.

**Para cambiarla:** el primer `<style>` es el CSS de producción del 10/11; lo de la maqueta está en el segundo `<style>` y en el
`<script>` del final, que la dibuja con los datos de `funnels-simples.md`. La publicada para Martín es un Artifact
(claude.ai/artifact/PyGboJ5AsKL2wUiPe2Kssk), privado hasta que se comparta.

## La segunda maqueta, el descubrimiento: el chat a toda la pestaña ya es así en la casa, y la película del Spy no puede trabar el flujo (11/11/2026)

Martín vio la primera y pidió otra cosa ([esquema-descubrimiento.md](marketing-copilot/rediseno/esquema-descubrimiento.md)):
el chat solo en toda la pestaña hasta que haya algo más que mostrar, la pregunta en el chat y las opciones en el bloque, y antes
de la estrategia un descubrimiento con tu Instagram y tu web leídos por Competitor Spy. La maqueta es
`docs/marketing-copilot/rediseno/maqueta-descubrimiento.html` (Artifact claude.ai/artifact/XboRwCiqtwybpf4iPXQpqw). La
anterior quedó como `maqueta-dos-columnas.html`, para comparar.

- **«El chat no se centra» no es un error.** Con el chat a toda la pestaña, la conversación y el bloque van de lado a lado. Parece
  que falta el `max-width: 760px` de `.co-hilo__col`, pero lo anula a propósito `app/admin/operaciones/centro.css` (línea ~1638:
  «EL CHAT A TODO EL ANCHO, COMO WHATSAPP WEB», Martín, 17/10). Un chat de MaKo a pantalla completa hereda eso; no se «arregla»
  volviendo a la columna de 760.
- **La lectura de tu negocio ya existe entera, para competidores.** `mirarCompetidor` lee Instagram → YouTube → web, la película
  (`PeliculaDeOrden`, OrdenSpy.tsx) ordena las piezas, y «Su oferta» pasa la web por el analizador de Offer. Para el negocio
  propio cambian el texto («tu», no «su») y quién paga la lectura, que es Apify más la IA: se pregunta antes de programarla.
- **En la maqueta, el flujo no espera a `animation.finished`.** En el panel oculto del navegador de la app y en el Chrome sin
  ventana, las animaciones de la Web Animations API no avanzan, y la película quedaba para siempre en «Ordenando por formato».
  La maqueta avanza con su reloj (el tiempo que dura el reparto) y deja las animaciones sólo para los números. En la app,
  `OrdenSpy.tsx` sí espera las animaciones: en una pestaña de fondo la película queda quieta hasta que se la mira, y eso está
  bien.
- **La tercera vuelta (11/11, la vigente): botones primero, sin chat.** `maqueta-arranque.html`, en el Artifact
  claude.ai/artifact/LUyer4k7kV1sokRuBYeX44.
  - Primero «¿Por dónde vendés?» (Anuncios, Instagram, YouTube).
  - Después botones grandes para cargar lo que haga falta, ninguno obligatorio: la zona para soltar del Archivero y
    `ConectarViaZernio`.
  - Después la lectura de lo cargado.

  La pregunta que Martín dejó abierta, «¿cómo vendés o cómo querés vender?», se resolvió con una sola: «¿Por dónde vendés?»,
  con «Lo que ya hacés o lo que querés empezar» debajo.

  Prospección quedó afuera porque no se puede leer. La lectura de anuncios sale de la conexión con Meta.
- **La cuarta vuelta (11/11): «Tu negocio» por canal**, en `maqueta-por-canal.html` (claude.ai/artifact/97pKNFeiPV4U8asB9ejLwn). Lo que
  costó y vale para lo que venga:
  - **El texto de MaKo salió con voseo** («¿Por dónde vendés?») aunque la regla existe desde julio (memoria
    reglas-de-voz-y-nombres: español neutro con tú, la audiencia es México). Se cuela porque la charla con Martín es
    rioplatense. Antes de publicar una maqueta o una pantalla, se busca el voseo con una expresión (vendés, tenés, podés, querés,
    acá, vos): lo único que puede quedar son las citas de lo que publicó otro.
  - **Los logos de las redes ya existen**: `SvcIcon` / `LogoRed` (app/_components/ServicioVisual.tsx, el glifo de Instagram en
    lib/canal-social.ts). Un ícono genérico al lado de «YouTube» o «Meta» se nota enseguida, y Martín lo marcó.
  - **Las pastillas del gráfico del Spy** (`.spyg-red`) viven en el CSS de GraficoSpy.tsx, no en el de SpyApp: sin ese CSS,
    un selector sale como texto suelto.
- **Los datos del competidor se leyeron sin escribir nada.** La ficha (`/competitor-spy?ws=9&competidor=20`) se recorrió en el
  navegador de la app: el texto de las pestañas Contenido y Funnel, el marcado de cada sección, y 62 textos de sus piezas,
  paginando la grilla. Las piezas no vienen en ningún JSON de la página: llegan por acciones del servidor.

## La quinta maqueta, el análisis: lo que la conexión NO trae, y qué es real y qué es de ejemplo (11/11/2026)

Martín pidió que «Tu negocio» sea un análisis y no una réplica de cada app. Después agregó un paso 5, la operación, porque en una pestaña era demasiado. La maqueta es `docs/marketing-copilot/rediseno/maqueta-analisis.html` (claude.ai/artifact/6oFhRx6JnoHMVgFyoUxcNN). Los puntos que revisa, con curso y clase, están en `docs/marketing-copilot/analisis/`.

- **«Conectar con Zernio» no reemplaza todo lo que leía el link pegado** (`analisis/zernio.md`).
  - No se pudo confirmar que traiga la bio ni su link: la bio se sigue leyendo del perfil público con el @ de la conexión.
  - Las historias se leen sólo desde que se conecta. Las de antes no vuelven.
  - El porcentaje de clics de la miniatura de YouTube no lo da nadie.
  - Prometer «traigo tus historias» en el paso 2 sería mentir: dice «desde hoy».
- **Para anuncios a mensajes, MaKo hoy no ve su número principal** (`analisis/anuncios.md` §0):
  - el sincronizador de Meta no guarda conversaciones iniciadas ni compras;
  - el Chat Analyst del Dashboard nunca lee el texto de los chats.

  La maqueta lo muestra como «Sin dato», no con un número.
- **El paso 5 es todo de ejemplo**, y la maqueta lo marca «ejemplo». Lo real de Federico:
  - sus 232 piezas, fechas, vistas y destinos;
  - el porqué de cada nota de su oferta;
  - su página foundersbc.cascaraco.com.

  Para no inventar lo de su oferta se leyó el desplegable de cada nota en producción, sin escribir nada. Los números de la conexión y de sus anuncios no existen: son de ejemplo, con su marca.
- **Martín miró la maqueta ANTERIOR y creyó que se habían saltado sus pedidos** («te saltaste un montón de cosas»). La nueva todavía no estaba publicada porque la guardia de RAM frenó la captura. Cuando una vuelta tarda, se dice en el momento que lo que está mirando es la anterior, con su link.

## La sexta maqueta: el análisis se MUESTRA sobre la cara de cada cosa, no en una lista (11/11/2026)

Martín vio la quinta, que tenía los puntos de los cursos en filas desplegables. Pidió volver a ver las publicaciones, las miniaturas, el chat, el VSL y el formulario, con el feedback encima: «así es fácil de ver». La maqueta es `docs/marketing-copilot/rediseno/maqueta-visual.html`.

- **La regla que queda:** el análisis no reemplaza a la cara de la plataforma, va sobre ella. Para cada cosa:
  - la sección con su forma (el perfil, la grilla de reels, el chat, el reproductor, el formulario);
  - marcas o un popup con lo que le diría MaKo;
  - abajo, los puntos de los cursos.
- **Todo eso ya existe en la casa y se copió, no se inventó:**
  - el recorrido del Web Analyst para «Tu web» (`app/web-generator/diagnostico/RecorridoDiagnostico.tsx`, su `CSS_RECORRIDO`);
  - el árbol de Ads Manager para «Lo que está corriendo» (`app/ads-manager/Arbol.tsx` y `aa.css`);
  - la calculadora de presupuesto para cuántos anuncios probar (`lib/calculadora-presupuesto-ads.ts`, con su elección por «sale de aprendizaje»: con US$3.000 elige 6 anuncios en dos rondas y no 9).
- **Las miniaturas de verdad están en el almacenamiento público del Spy** (`spy-miniaturas/spy/<red>/<id>.jpg`): se pueden bajar, achicar y meter como data URI. Las publicaciones no tienen miniatura: ver `hallazgos-competitors-spy.md`.

## La séptima maqueta: el molde de Fernly, y la acción como lugar de trabajo, no como tablero (11/11/2026)

`docs/marketing-copilot/rediseno/maqueta-accion.html`. Lo que vale para lo que venga:

- **El diseño sale de un dashboard de la casa, entero y sin mezclar.** Martín no quería el diseño de la sexta: «muchos textos y cosas muy pequeñas».
  - Se eligió el dashboard Productividad, la copia de Fernly (`app/dashboard/disenos/productividad-css.ts`, todo dentro de `.frn`): números de 48 px, botones de 48 y una sola tarjeta invertida por fila.
  - Las razones están en `docs/marketing-copilot/rediseno/diseno-referencias.md`.
  - Trampas al pegarlo:
    - `.frn button` hereda el color del texto, así que los botones de la casa (`mk-btn`) y las miniaturas quedan oscuros sobre oscuro si no se les da su color;
    - `.frn-pill` sólo tiene estilo dentro de `.frn-tlist`;
    - el teléfono va por `@container frn`.
- **El diagnóstico obvio era el equivocado: «análisis → acción» no se entendía, y no era por la idea sino por el tamaño.** Las piezas de etapas de la app son chicas (pastillas de 12 px, puntos, barritas). Se resolvió con dos tarjetas de fase de 124 px arriba de las dos pantallas («Paso 1 de 2 · El análisis», «Paso 2 de 2 · La acción»), la actual invertida.
- **La acción NO es un dashboard.** Martín: «no me gusta que todo parezca gráficos… se tiene que ver como accionables, las cosas que hizo MaKo». La regla sale de las apps de `docs/media-buyer/referencias/otras-apps/`:
  - el mensaje de MaKo arriba;
  - «Necesito tu OK»: una decisión por tarjeta, con el antes → después grande, el porqué, «dentro de tus topes» y un solo botón;
  - «Te toca»;
  - «Lo que hice», con «hice X porque Y» y «Deshacer».

  Los números quedan en la máquina de contenido.
- **El número de una tarjeta y lo que muestra su pestaña salen de la MISMA lista.** En la primera armada, YouTube decía «1 para mejorar» y su recorrido tenía 4 pasos, porque contaban cosas distintas.
- **El ciclo de historias de Fran Doglio dura 10 días, no 7** (arcadia · 2). `lib/asesores/ficha-francisco-doglio.ts` y `referentes.md` dicen siete y omiten los días 8 a 10. No se corrigió: es del agente del CoPilot y se toca con su batería.

## La octava maqueta: tres pasos, todo en mono, y lo que el usuario hace separado de lo que hace MaKo (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-tres-pasos.html`. Lo que vale para lo que venga:

- **Mono no tenía modo oscuro.** La paleta mono (`.frn.frn--mono`) pisaba también la oscura de Fernly (`.frn:where([data-tema="oscuro"] *)` tiene especificidad 0,1,0). En oscuro, el tablero quedaba claro con pastillas y botones oscuros. Hace falta su propio bloque `:root[data-tema="oscuro"] .frn.frn--mono`, y los botones primarios van claros con letra oscura. La flecha de la tarjeta elegida estaba fija en menta (`#e3f2e9` en frn.css): en mono hay que pisarla.
- **Zernio trae las historias, pero no las destacadas ni la bio.** Las historias llegan sólo desde que se conecta. Las destacadas y la bio no aparecen en su documentación, y el objeto de la cuenta (`ListedAccount`) no publica sus campos. Salen de la lectura pública del perfil, la de Competitor Spy. En la maqueta son de ejemplo. El detalle está en `docs/marketing-copilot/analisis/zernio.md`.
- **Lo que ya existe y se reusa:**
  - elegir los chats y separar los de venta: el paso «Tu forma de escribir» del Chat Agent (`app/automations/OnboardingChatAgent.tsx`, `lib/chat-agent-clasificador.ts`). Hoy sólo lista WhatsApp;
  - dónde está el VSL: `lib/integraciones-catalogo.ts`. Sólo Panda da la retención por API, y la curva de verdad sale del Pixel de MaKo;
  - WhatsApp se conecta con el QR de la línea, no por Zernio (`app/chats/ConectarCanal.tsx`).
- **«La acción» y «lo que hace MaKo» eran una sola pantalla y no se entendía de quién era cada cosa.** Ahora son dos pasos con las mismas tarjetas que el análisis: la acción (paso 2) tiene sólo lo que hace el usuario, con Offer y Web Generator adentro; el piloto automático (paso 3) tiene lo que hace MaKo, con su OK y «Deshacer». Una tarjeta que falta no deja hueco: las que quedan se estiran (`--n`).
- **La lista del costado del recorrido se perdía:** eran muchas tarjetitas con todo el texto a la vista. Ahora es una sola tarjeta, con una fila por comentario que se abre al tocarla. «Cada cuánto publicas» pasa abajo de la cara.
- **Tres fases en un teléfono de 390 px no entran con el título a 22 px.** «La acción» quedaba cortada. En el teléfono va sin la flecha ni el subtítulo, con el título a 15 px.

## La novena maqueta: la acción es una lista, el piloto pone a la par lo que espera y lo que hizo (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-accionables.html`. Lo que vale para lo que venga:

- **«El modo oscuro no anda» era el visor del Artifact, no el CSS.** En Chrome sin pantalla, el botón cambiaba bien. El visor vuelve a poner su `data-theme`, y la maqueta lo seguía con un MutationObserver, así que pisaba el clic de la persona. Una vez que la persona elige, se deja de seguir al visor.
- **Una lista de tareas con columnas fijas se rompe en una columna angosta.** En la vista de la oferta, el título se partía palabra por palabra. La lista se mide contra su propia tarjeta (`container: tareas`), no contra la pantalla. Y `.frn .frn-btn` trae un ancho mínimo que hay que sacar en una columna chica.
- **Dos lados del mismo alto:** se fija el alto de la fila y cada lado se desplaza adentro. Estirar el más corto deja un hueco abajo.
- **Entrar directo a un paso borraba los canales elegidos:** `cargarTodo()` los pisaba con los tres. Ahora sólo los pone si no hay ninguno.
- **Un `const` con el mismo nombre que el código común** (`MAS`, que trae `//@@COMUNES@@`) rompe el script entero sin aviso: la pantalla queda en blanco. Antes de las fotos se chequea la sintaxis del HTML armado (`revisar-script.mjs` en la carpeta de la maqueta).

## La décima maqueta: la acción es una checklist dentro de MaKo; el piloto muestra en qué se basa (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-checklist.html`. Lo que vale para lo que venga:

- **Una tarea vale si se hace DENTRO de MaKo y en orden.** «Responde los chats de la noche» no servía: MaKo tiene Automations, así que la tarea es «Automatiza la respuesta». Cada tarea dice dónde se hace y, si hay, con qué plantilla. Grabar anuncios va después de mirar la competencia, elegir ganadores, armar las razones y adaptar los guiones.
- **La máquina de contenido no va en la acción.** Pasa a las plantillas de cada tab (Copywriting, Automations). La acción es sólo la checklist y su calendario.
- **El piloto tiene que mostrar el dato detrás de cada decisión.** Por tarjeta, «Métricas» (qué miró) y «Acciones» (qué propone o hizo).
- **Dos trampas al sumar código a la maqueta:**
  - una función con el mismo nombre que otra (`acciones`) la pisa sin error;
  - una clase que el molde ya usa (`frn-check`) le cambia el diseño a lo nuevo.

  Antes de armar, buscar si el nombre ya existe en el cuerpo y en el código común.
- **`margin-left: auto` en todos los `span` de una fila** centra el ícono (el logo también es un `span`). Hay que acotarlo al último.

## La duodécima maqueta: cada canal se ve como su app; una vista, un solo filtro (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-doce.html`. Lo que vale para lo que venga:

- **Lo que ya filtra arriba no se repite abajo.** Martín sacó del calendario los botones de cada área: las tarjetas de arriba ya eligen el área. También sacó «Mes / Agenda», porque no se entendía la diferencia. La barra quedó con «Hoy», las flechas y el mes a la izquierda, y «Checklist / Calendario» a la derecha. El número de tareas ya está en el aviso del paso, así que «Te tocan N» sobraba.
- **Instagram y YouTube se copian de su app, no se resumen.** Las historias se abren desde el aro de la foto, no como tarjetas. Lo que dice MaKo de una pieza va ADENTRO de ella: una tarjeta flotante sobre cada lámina del carrusel o cada historia, que cambia al deslizar.
- **Lo que se ve en todos los pasos va en la cabecera.** «Clases» está al lado del botón de cada paso.
- **Tres trampas del CSS de la maqueta:**
  - **Una clase que el cuerpo viejo ya usa pisa el diseño nuevo sin error.** `.mq-hist span` (de una maqueta anterior) le puso a cada `span` del visor de historias un círculo gris de 64 px. Antes de nombrar una clase, buscarla en el cuerpo entero, no sólo en la vuelta.
  - **`.frn button { font: inherit; color: inherit }`** le cambia la letra y el color a todo botón copiado de otra pantalla, por ejemplo los del calendario (`gc`). Esos botones llevan su `font` y su `color` con `.frn` delante.
  - **Una imagen con `height: 100%` no toma el alto de su padre `display: grid`**, aunque el padre tenga alto fijo: la fila automática se mide por la imagen. Las destacadas salían ovaladas. El círculo va `display: block`.
- **Los popups viven fuera de `.frn`:** las pastillas (`frn-pill`) salían sin color. Llevan su estilo también bajo `.mq-igm`, `.mq-ytm`, `.mq-hv`, `.mq-tarjeta` y `.mq-clases`.

## La decimotercera maqueta: lo que se puede leer, se lee; lo que no, se dice (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-trece.html`.

- **La portada de YouTube.**
  - **Síntoma:** la maqueta 12 dibujaba una portada «de ejemplo» y le ponía un comentario. Martín preguntó si estaba extraída o inventada.
  - **Lo que pasaba:** estaba inventada, y el canal de Federico NO tiene portada.
  - **Cómo se sabe:** en el `ytInitialData` de la página pública, `header.pageHeaderRenderer.content.pageHeaderViewModel` no trae la clave `banner`, y en la página no hay nada arriba.
  - **Por qué importa:** inventarla escondía justo el punto más fuerte («no tiene portada»).
- **La regla:** la cara de una red (portada, bio, descripción, links, video destacado) se lee siempre del canal. Si no se pudo leer, se dice que falta; nunca se dibuja una parecida.
- **Lo que la app no hace todavía:** pedir `brandingSettings` en la lectura de YouTube. Hoy ningún archivo de `lib/` lo pide (buscado el 12/11).
- **Copiar la cara real de cada cosa vale también para lo que no es nuestro.** Los anuncios se entienden en la tarjeta de la Biblioteca de Anuncios de Meta («Activo», el identificador, desde cuándo circula, las plataformas, «Ver detalles del anuncio»), con los números de MaKo abajo. Un bloque con su diseño viejo («Tu página de compra») se nota al lado de los nuevos.
- **Una tarjeta suelta debajo de otra pierde el sentido.** La nota de la oferta pasó a la misma tarjeta que sus piezas.
- **Las reglas del piloto de la maqueta no usan los umbrales de MaKo.** Lo encontró el relevo `docs/marketing-copilot/rediseno/relevo-dashboards.md`, §0.4. Al programarlo, salen de la casa:
  - «Cambiar el hook si se va más del 60 % en 3 s» es un hook rate menor a 40 %. El buen gancho de MaKo es 28 % (`lib/ads-analyst-patrones.ts:26`): la regla prendería en casi todos los anuncios.
  - «+25 % por vez» choca con el tope del Media Buyer, de 20 % por día (`lib/media-buyer/tipos.ts:33`).
  - «Desde frecuencia 4»: MaKo guarda un promedio de las frecuencias diarias, no la frecuencia del período. Hay que decir de qué ventana es.
- **«Métricas» muestra cómo le fue, no si cruzó el umbral.** Casi ninguna tarjeta de las hojas dibuja el umbral del que decide el piloto. Instagram y YouTube casi no tienen su dato: sus hojas miden la pauta y el VSL.

## La decimocuarta maqueta: la réplica sirve hasta donde ayuda a leer; los pasos se tocan entre sí (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-catorce.html`.

- **Copiar la app de cada red tiene un límite.** Copiar el perfil, la grilla o la tarjeta de la biblioteca sirve: así se reconoce la pieza. En el popup, la réplica de lo que rodea a la pieza sobraba: el canal con «Suscribirse», «Me gusta», «Compartir» y los íconos de Instagram. Va la pieza y, al lado o abajo, lo que dice MaKo.
- **Un texto chico debajo de un título se lee como relleno.** Martín pidió sacarlos todos. Lo que hay que decir va en el título o en el comentario.
- **Una grilla se muestra en filas completas.** Si caben 4 por fila, se muestran 8, no 6, y el botón dice «Ver más», no «Ver los 9».
- **Dos columnas de alto muy distinto dejan un hueco.** «Espera tu OK», con una decisión, al lado de «Lo que hice», con diez. Va en una columna, lo que espera arriba.
- **Los pasos tienen que tocarse.** Lo que se pide en el análisis aparece en la acción, y lo que se aprueba en el piloto aparece en «Lo que hice». Para probarlo, cada `data-accion` tiene que tener su toque (lo cuenta `aplicar-catorce.mjs`) y se tocan todos los botones de cada estado buscando errores.
- **«Métricas» no trae la hoja: lleva a ella.** Meter las hojas sumaba 460 KB a la maqueta y una segunda manera de ver lo mismo que el Dashboard.

## La decimoquinta maqueta: los pasos son navegación, no tarjetas; el chat, en toda la tab (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-quince.html`.

- **Los pasos se navegan, no se leen.** Como tres tarjetas grandes competían con las tarjetas de las áreas. Van en la cabeza, del alto de un botón. Lo que no es un paso («Clases», «Configurar piloto») va en los tres puntitos.
- **El chat con MaKo está en toda la tab** y sabe en qué paso y qué tarjeta estás. Lo que se le pide hacer («Escríbeme la bio nueva») entra a la acción, igual que «Mejorar».
- **Dos trampas al sumar la cabeza y el chat:**
  - **Clase repetida:** `.frn-pasos` ya existía, con `flex-direction: column`, y dejó los pasos apilados. Se renombró a `.frn-tresp`. Es la tercera vez que pasa en esta maqueta: antes de nombrar, buscar en todo el cuerpo.
  - **Lo fijo adentro de un contenedor de consultas:** `.frn` es `container-type: inline-size`, y eso hace que un `position: fixed` adentro no se pegue a la pantalla, sino al tablero. Por eso el chat se dibuja afuera, con los popups.

## La decimoséptima maqueta: Oferta y comunicación; dolor y ángulo no son lo mismo (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-diecisiete.html`. Lo de los cursos: `docs/marketing-copilot/analisis/comunicacion.md`, con el detalle de cada curso al lado.

- **Las «temáticas hot» de Doglio no están en Knowledge.**
  - Síntoma: la frase no aparece en ninguna de las 9.719 transcripciones de `public/cono-tx/`.
  - Causa: ARCADIA vino de un revendedor que colgó otros videos bajo los módulos reales (bajo «Ángulos de marketing» está «EOD Setter»). La masterclass «Encontrando temáticas ganadoras» es un recurso enlazado que nunca se bajó: `C:/cursos/arcadia/recursos.json` la nombra, sin URL ni archivo.
  - Regla: en ARCADIA, el título de un módulo no dice qué hay adentro; se busca en la transcripción.
- **El «ángulo ganador» no lo enseña Ramiro Cubría.** Lo da su socio, Mati Molina, en SYK (· 32, · 33), y quien lo define con precisión es Carrizo (· 48). Trampa de las fuentes: los `.md` de `C:/cursos/<curso>/texto/` cortan tramos; el JSON de `public/cono-tx/` de la misma clase está más completo.
- **Dolor y ángulo no son lo mismo (el diagnóstico obvio era el equivocado).**
  - La primera lista de ángulos mezclaba un problema («Publicas y no vendes») con puntos de vista.
  - Para Carrizo, el dolor es el problema y el ángulo, desde dónde se cuenta. El ganador es el que más vende con el dolor fijo.
  - La pantalla pone el dolor arriba y los ángulos debajo.
- **El estado de un ángulo sale del dato de su pieza, no de cómo suena.** Marqué «Trabaja con los founders» como quemado, y era el anuncio que más agendas trae (31, a US$ 20). El quemado era el del workshop: frecuencia 4,7 y el costo, 60 % más alto.
- **La tesis de Martín (nada viral al empezar) la respaldan Cubría y Carrizo; Doglio la matiza.** Doglio pide un orgánico sin llamar al cliente por su nombre, y ese llamado sólo en anuncios. Para MaKo, «de nicho» es el problema que más tiene el cliente ideal, con un hook y un formato probados.
- **Un medidor arriba y una barra de rayitas abajo se leen como dos cosas distintas** (Martín: «se confunde»). La nota queda como número grande, y lo que falta, en palabras, por grupo.
- **«Oferta y comunicación» es el nombre más largo de las tarjetas.** A 1440 no entraba al lado de la flecha de 38 px: la flecha bajó a 32 y el título a 15 px. La tarjeta pasó de `height` a `min-height`, para que en el teléfono crezca en vez de cortar el número.
- **Sumar tareas al principio de la checklist corre los números.** `CHECK`, `POR_QUE_CHK` y `RESP_WEB` (las respuestas del chat de la web) van por número de tarea. Al insertar arriba se insertan las dos listas y se corren las claves de `RESP_WEB`.

## La decimoctava maqueta: un solo molde para las partes hermanas, y el alto se fija en la grilla (12/11/2026)

`docs/marketing-copilot/rediseno/maqueta-dieciocho.html`.

- **Una parte nueva repite el molde de su hermana aprobada.** En la diecisiete, Ángulos, Formatos y Tu voz salieron cada una con su diseño; Martín: «rompiste completamente el diseño, no seguiste el patrón». Si la oferta usa «Nota por nota» en el análisis y desplegables en la acción, las demás partes también.
- **Una nota al lado de una lista de cosas por completar se lee como un conteo.** «46 de 100» arriba de las piezas parecía «46 cosas de 100». La nota va sólo en el análisis; en la acción, lo que falta se dice en palabras y con color.
- **El alto fijo se pone en la grilla, no en un hijo (el diagnóstico obvio era el equivocado).**
  - Para que el bloque no le diera alto a la fila se le puso `height: 0; min-height: 100%`. Igual, la fila medía 576, 557 o 536 px según la parte.
  - Causa: el chat (`.mq-offer`, `height: 680px` con `overflow: hidden`) está adentro de un flex en columna, y ahí su `min-height: auto` vale 0, así que se achicaba.
  - Lo que anda: `height: 740px` en `.frn-trabajo--oferta`, el chat con `flex: 1` y el bloque con su lista desplazable. Medido: 740 px en las tres partes, con cualquier desplegable abierto.
- **El popup va fuera del tablero:** ahí no llegan los colores de `.frn` (`--panel`, `--muted`). Usa los de la app (`--surface`, `--surface-2`, `--dim`, `--good`, `--bad`, `--warn` y sus `-bg`), que cambian solos con el modo oscuro.
- **«Falta sus palabras» no se lee bien.** El estado del grupo va con dos puntos («Falta: sus palabras», «Por confirmar: ángulos para probar»), y así no hay que concordar con el nombre de cada pieza.
- **Un estado que ninguna vuelta fotografía se rompe sin que nadie lo vea.** «8 · Teléfono» estaba en blanco desde la octava vuelta: `telefonos()` llamaba a `operacion()`, que dejó de existir cuando la operación pasó a ser la acción, y el error cortaba el dibujo sin aviso (`window.__errores` sólo junta los de los toques). Las fotos de cada vuelta llevan TODOS los estados del índice, también «Sin nada todavía» y «Teléfono».

## Pasar la maqueta a la app: el CSS se MIDE, y el chat del CoPilot tiene tope (12-13/11/2026)

- **El CSS de una pantalla de la maqueta se saca midiendo, no se reescribe.** `sacar-css.mjs` abre la maqueta sin ventana, pinta cada estado (cada paso, cada parte, el popup, los menús abiertos, el teléfono, el oscuro) y se queda con las reglas de las hojas de la maqueta que tocan algo del DOM (`document.querySelector` sobre el selector sin `:hover` ni `::before`). Salieron 65 KB de 470 reglas, contra los ~250 KB de la maqueta entera. Tres trampas: la hoja 0 era el `<link>` de Google Fonts (los índices de `document.styleSheets` se corren uno); una regla con `:where(a, b)` se partía en la coma de adentro si se separaban los selectores con `split(',')`; y lo que no se pinta en ninguna toma no sale (el desplegable de ofertas, una nota abierta): hay que pintarlo.
- **Al sacarlo, el marco de la maqueta queda afuera** (`html`, `body`, `:root`, `.mq-app`, `.mq-barra`, el riel, el chat de mentira): eso lo pone la app. Y lo que en la maqueta vive fuera de `.frn` (el popup) usa los colores de la app, no los del molde.
- **El chat del CoPilot tiene dos topes medidos por tests, y una regla más en el prompt los rompió los dos** (`tests/marketing-copilot-agente.test.ts`: el contexto más grande por debajo de 33.000; `tests/marketing-copilot-descubrir.test.ts`: las herramientas dejan 4.000 libres de 12.000). Lo obvio era achicar el texto; lo que anduvo: la instrucción de la pantalla va en `pantalla` (lo que el chat sabe de dónde está la persona: qué falta, con su clave, y cómo se guarda), que no pesa en cada turno del CoPilot; la herramienta de leer (`ver_comunicacion_copiloto`) queda en el registro pero NO en las del CoPilot; y la oferta elegida se guarda (`marketing-copilot.oc.oferta`) en vez de pasarse como parámetro.
- **Offer no distingue «por confirmar» de lo leído de un documento**: una pieza con fuente `doc` ya cuenta como confirmada. El CoPilot lo respeta (`negocio` = Confirmar; `chat` y `doc` = Listo) y no lo cambia: es de Offer.
- **El piloto del Media Buyer es sólo de Meta**: su tabla (`media_buyer_decisiones`) no acepta otras entidades ni tácticas (CHECK), y «aprobar» lanza en el acto (no hay «aprobada, sin correr»). Oferta, Web, Instagram y YouTube necesitan su propia cola.
- **Ningún lector lee la cuenta PROPIA**: Zernio conecta Instagram y YouTube pero el código no trae de ahí la bio, las destacadas ni la portada; Competitor Spy lee a cualquiera por Apify (con la clave del negocio, cuesta). «Quién paga leer tu propio negocio» sigue sin decidir.

## La vigésima maqueta: análisis y acción en una pantalla, el piloto se configura en la suya (13/11/2026)

- **Juntar dos pasos no es poner uno debajo del otro**: el análisis de la oferta medía casi dos pantallas (las nueve notas estiradas al alto de «Lo que leí», que en la oferta trae seis datos). Con la acción abajo, las notas van sin estirarse y «Lo que leí» muestra tres.
- **Un popup que muestra piezas del tablero tiene que estar adentro de `.frn`**: los desplegables salieron sin estilo en el popup de «Mejorar», porque todo su CSS es `.frn .oc-g…`. Se envuelven en `<div class="frn frn--mono">` con el fondo transparente.
- **Un piloto sin configurar no tiene nada esperando**: las tarjetas decían «1 espera tu OK» arriba de «Antes de prenderlo, configúralo». Dicen «Sin configurar».
- **«Con qué número se publica»** (Martín: nunca «graduar el reel de prueba») es un NÚMERO que MaKo propone desde el promedio de los competidores seguidos y la persona sube o baja: va en la configuración del piloto de Instagram, con la lista de seguidos y lo de cada uno a la vista.

## Audience Network ya no se saca por campaña, y por eso es una tarea y no un interruptor (13/11/2026)

Martín pidió sacarlo del piloto «si Meta todavía deja». Lo medido el 13/11 (fuentes de terceros, ninguna oficial de Meta): desde fines de agosto de 2026 Meta empezó a quitar el control de ubicaciones por conjunto de anuncios (de a poco, no en todas las cuentas a la vez); el bloqueo para TODA la cuenta sigue, en Configuración publicitaria → Controles de ubicación, y es el único que también vale para Advantage+. MaKo no lo cambia por la API (el Media Buyer escribe presupuesto y estado, nada de ubicaciones): por eso en el CoPilot es la tarea «Bloquea Audience Network en tu cuenta», no un «Lo hago solo» que no podría cumplir.

## Sin hacer (9/11/2026)

- **El CoPilot no guarda solo lo que descubre charlando.** En una pregunta, las herramientas que escriben no viajan (lib/doer-herramientas.ts, decisión de Martín del 8/10: «la ofrece»): MaKo ofrece guardarlo y, con el «sí», propone la tarjeta. El panel guarda directo con sus pastillas. Si Martín quiere que un dato dicho en el chat aparezca solo en el panel, hay que decidir una excepción para `copiloto_media_buyer` (no mueve plata ni toca a nadie).
- **El Funnel Coach del Ops Center y el CoPilot guardan el funnel en dos lugares** (`guardar_plan_funnel` en lib/funnel-plan-db.ts y `marketing-copilot.perfil`). Hablan de lo mismo con dos memorias.
- **La pantalla de un funnel CON anuncios** (Hoy · Campañas · Plan · Biblioteca, `MediaBuyer.tsx`) sigue con su diseño: la de dos columnas se hizo para la charla y para los funnels sin anuncios.
- **(10/11) Un funnel elegido que no sirve propone otro con lo completado:** `evaluarFunnel(f, datosDeDecision(p))` arma su «mejor» con el `llamadas: 'yo'` que se completa para un funnel sin llamadas (una compra directa con ticket alto propone un VSL «con alguien que llama» sin saberlo). Hoy sólo pasa en el paso «ajuste»; el arreglo es armar `mejor` con `datosDichos` y, sin eso, no proponer.
- **El curso de campañas lo usa sólo el CoPilot** (por `metodo_campanas_copiloto`). El Ads Writer y los demás leen Knowledge (`mako_knowledge`, área `ads`, vacía); si se quiere que lo usen, hay que resolver antes que Knowledge es por negocio. Y 90 de 97 videos del curso no tienen transcripción.
