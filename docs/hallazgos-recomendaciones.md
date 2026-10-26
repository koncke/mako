# Hallazgos — MaKo recomienda (el motor de recomendaciones)

El motor que decide qué le recomienda MaKo a un negocio y cuándo se calla: `lib/recomendaciones-reglas.ts` (lo puro),
`lib/recomendaciones-senales.ts` (lo que se mide), `lib/recomendaciones.ts` (la lectura y la memoria),
`app/api/mako/recomendaciones/route.ts` y `app/_chat/RecomendacionesDeMako.tsx`. El diseño y el porqué de cada regla:
[diseno-mako-recomienda.md](diseno-mako-recomienda.md).

## Lo que más muerde acá

1. **El diagnóstico obvio era el equivocado: «para recomendar hay que meter todo en el Second Brain».** Lo que hace falta ya
   está en las tablas del negocio, medido; copiarlo a `mako_knowledge` lo vuelve texto que se busca por similitud y se pierde el
   número. El motor lee cada fuente donde vive. [→](#el-second-brain-no-es-donde-se-mide)
2. **Una recomendación sin el número escrito por el código es una que la IA puede inventar.** El porqué sale de la señal; a la
   IA sólo se le acepta lo que cita señales que existen y no trae números ajenos. [→](#la-ia-redacta-el-código-decide)
3. **Tres roturas del test de señales dieron VERDE la primera vez**, y las tres por armar mal los datos del test, no por el
   código. [→](#tres-roturas-que-el-test-no-veía)
4. **La memoria de decisiones dejaba de guardarse a unas 35, y el borde de WhatsApp no corría nunca**: los dos por límites de
   PostgREST (la URL y las 1000 filas) que la base de mentira no tiene. [→](#lo-que-vio-la-revisión-del-tren-l-siete-fallas-que-ningún-test-mío-veía-26102026)

---

## El Second Brain no es donde se mide (26/10/2026)

**Síntoma:** el pedido decía «aprovecha el Second Brain» y «revisa si guarda todo el contexto». Leído el código, lo único de lo
que el negocio vive que llega a la memoria del chat (`mako_knowledge`, lo que lee `searchKnowledge`) es WhatsApp, apagado por
default en un cliente y sólo usable con su Gemini.

**Lo obvio:** sumar recolectores (Fathom, Offer, automatizaciones, landings) que vuelquen todo al conocimiento y que el motor
recomiende desde ahí. **Por qué no:** el recolector RESUME en hechos (es su regla: nunca copia el renglón crudo). «14 de 37
esperaron más de una hora» no sobrevive a un resumen ni a una búsqueda por similitud; se lee en `wa_mensajes`. Y la memoria
sigue siendo lo correcto para lo que no es un número: lo que dijo la gente (las objeciones de los hechos de WhatsApp entran a la
señal de objeciones desde ahí).

**La regla:** una señal nueva lee la tabla donde vive el dato, con su `error` mirado; el Second Brain aporta lo que la gente
DIJO, no lo que se puede contar.

## La IA redacta, el código decide (26/10/2026)

- El `porque` de una recomendación es el `dato` de cada señal, escrito por el código. La IA del negocio sólo escribe `hacer` y
  `cambia`, y `leerRedaccion` le descarta: la que cita una señal que no existe o ya usada, la que trae un número que no está en
  lo que se le pasó (`numerosAjenos`; los números del 0 al 3 se toleran porque se usan como palabras), la genérica
  (`esGenerico`) y la larga.
- **Una lista vacía de la IA es una respuesta**, no una falla: no se rellena con las reglas. Una respuesta que no se entiende sí
  es falla: salen las reglas.
- La IA corre en `after()` y se guarda por la huella de las señales (`huellaDe`): abrir la pantalla diez veces con los mismos
  datos no gasta diez veces. Sin la IA del negocio (`claveDeIAPropia`), nunca con la de la plataforma.

## Las señales: lo que no se ve en el código (26/10/2026)

- **«Nueva» se decide contra el BORDE DE LO LEÍDO, no contra la ventana.** WhatsApp se lee con tope (6.000 mensajes): con el
  tope lleno, lo leído empieza más tarde que los 21 días, y una conversación que parece empezar en ese borde puede tener historia
  antes. Se exige la misma SEMANA leída sin nada antes que con la lectura completa (`DIAS_LECTURA_WA - dias`, contra
  `desdeReal` en lib/recomendaciones.ts); si no alcanza, no se afirma nada. ⚠️ En la primera versión esta regla **no corría
  nunca**, y en la segunda el margen era de un día: ver las dos revisiones, abajo.
- **«Esperando respuesta» no cuenta «gracias», «ok» ni un emoji** (`noPideRespuesta`). La primera versión dejaba pasar
  «¡Gracias!»: el `¡` del principio no se limpiaba (sólo los signos del final).
- **El no-show se cuenta sobre las llamadas MARCADAS.** Lo sin marcar no es ni asistió ni faltó; contarlo como asistió esconde
  el no-show.
- **Un error de un proveedor puede traer el teléfono del lead adentro** («El número +54 9 11… no tiene WhatsApp»): `errorLimpio`
  lo tapa antes de que llegue al `dato`, que sale por la API y lo lee la IA.
- **Sin oferta, no hay «tu oferta no lo contesta».** `ofertaPrincipal` cae al brief; si no hay fila ni texto, la señal de
  objeciones calla.
- **Las llamadas de venta se leen como `lib/insights-llamada.ts`**: `status = 'analizada'` y `category = 'venta'`, paginadas por
  `recording_id` (la PK es `(workspace_id, recording_id)`).
- **Una automatización «muda» es sólo la que ESPERA respuesta** (`rasgosDelFlujo(...).respuesta`: un «Contestó» o un AI Step).
  Un recordatorio no espera nada y no puede ser «nadie contesta».

## Tres roturas que el test no veía (26/10/2026)

Al romper a propósito el código de las señales (el arnés `romper.cjs`: cambia una línea, corre el test, restaura de memoria),
tres roturas dieron VERDE:

1. **Sin el filtro de «tiene un lead»:** el ruido sin lead del test usaba el número por default, que salía del contador del lead
   y caía en la conversación anterior. Se mezclaba con una charla que sí tenía lead.
2. **Sin el borde de la lectura:** la conversación «del borde» estaba a 20,5 días, fuera de la ventana de 14: la sacaba la fecha,
   no el borde. Se cambió por una lectura cortada (desde hace 6 días) y una charla de hace 5,5.
3. **Sin el mínimo de los dos grupos al comparar:** el test sólo probaba los dos grupos con muestra. Se sumó uno con 3.

**La regla que queda:** antes de creerle a un verde, rompe la condición; si sigue verde, el que está mal es el test (y el arreglo
va en el test, no en el código).

## Lo que vio la revisión del tren-l: siete fallas que ningún test mío veía (26/10/2026)

Una revisión adversarial del tren encontró siete fallas en la primera versión. Ninguna rompía un test: los tests probaban las
reglas puras y una base de mentira sin los límites de PostgREST.

- **La memoria dejaba de guardarse a unas 35 decisiones, para siempre** (hallazgo 10). El compare-and-set comparaba el JSON
  entero, y PostgREST pone los filtros en la URL. **Lo obvio era «achicar la memoria»; el arreglo es no comparar el valor:**
  `guardarMemoria` compara `updated_at` (el molde de lib/automatizacion-chat-db.ts) y la memoria además tiene un techo de 60 KB
  (`MAX_BYTES_MEMORIA`). El test corre `decidirRecomendacion` REAL contra la base de mentira y mira el PATCH que sale.
- **El borde que nunca se activaba** (hallazgo 11). WhatsApp se leía con `.limit(6000)`; PostgREST corta en 1000 sin avisar,
  así que `msgs.length >= 6000` nunca era cierto y una conversación vieja, cortada a mitad, contaba como primer contacto lento.
  Ahora se lee con `leerPorPaginas` (del más nuevo al más viejo, con `id` al final) y el tope se corta en el `onPagina`.
- **«Lo que mejoró» daba por mejorado lo que no se midió** (hallazgo 12): una señal que no está hoy puede ser porque mejoró, o
  porque esa pantalla no lee esa fuente, porque la lectura falló o porque la muestra no alcanza. `funcionaron` sólo cuenta los
  tipos de `tiposMedidos(FUENTES_DE[superficie], fallas)` y lo que hoy tiene muestra y está debajo del umbral.
- **«Automatización muda» contaba a quien todavía no recibió nada** (hallazgo 13). El denominador son las personas a las que la
  automatización YA les escribió, hace más de 2 días (`margenDias`): a quien le llegó ayer no le dio tiempo de contestar.
- **Una recomendación de varias señales se decidía sólo sobre la primera** (hallazgo 14): la IA arma una con dos señales, el
  botón mandaba `r.clave` y la otra volvía en la carga siguiente. Ahora cada recomendación lleva `claves` y la decisión se anota en
  todas (las que manda la pantalla y las de la redacción guardada, para una pantalla vieja que sólo manda la principal).
- **La misma decisión dos veces sumaba dos filas** (hallazgo 15): otra pestaña, o otra instancia con la lista en caché. Ahora
  `decisionVigente` la vuelve un `ok` sin escribir, en la ruta Y en la API. ⚠️ La API tenía `previa.d === decision` → «Ya estaba»,
  que **trababa**: pasados los 14 días de un «Ahora no» la recomendación vuelve y no se podía volver a callar.
- **«Reabierta» no reabría si el tipo seguía apagado por otras claves** (hallazgo 16): `estadoDe` miraba el tipo antes que la
  última decisión de la clave. Ahora una clave reabierta a propósito se ve; las demás del tipo siguen calladas.

**La regla que queda:** un test con una base de mentira no ve los límites del servidor real (las 1000 filas, el largo de la URL).
Lo que depende de ellos se prueba con la cuenta escrita en el test (el PATCH que sale, la lectura paginada en el fuente), no con
el resultado de la base de mentira.

## La verificación del tren-m: tres arreglos a medias y uno que abrió otra falla (26/10/2026)

El Cerebro pasó un verificador sobre los arreglos de arriba: 5 de 9 cerrados. Lo que seguía abierto en este motor:

- **11, a medias: el tope se lo comían los grupos, y un día de margen no alcanza.** La consulta traía todo `wa_mensajes`: una
  línea con grupos llena 6.000 mensajes en días, y lo leído empezaba ayer. Ahora la consulta pide sólo personas
  (`FILTRO_PERSONAS_WA`, el mismo criterio que `esPersona`). Y con el tope lleno, un «ok, gracias» a una charla de hace cuatro
  días caía a más de un día del borde y contaba como primer contacto sin respuesta: el margen es ahora el mismo que tiene la
  lectura completa (7 días).
- **12, a medias: una señal que NO SE EMITE no es una mejora.** Sin datos, varias señales devuelven `null` (la línea
  desconectada, la asistencia sin marcar, una página sin visitas): la fuente se leyó bien, el tipo contaba como medido, y salía
  «Lo que mejoró» sin ningún número. Ahora mejoró sólo lo que ESTÁ hoy, con muestra y debajo del umbral. Los tipos que callan
  cuando están bien (esperando respuesta, fallas, objeciones) ya no figuran como mejorados: es lo conservador.
- **14, el arreglo abrió otra falla del mismo tipo.** Para que una decisión valiera para todas las señales de una recomendación,
  el servidor sumaba las claves de la redacción GUARDADA. Pero después de cualquier decisión la huella cambia y la pantalla
  muestra las tarjetas de las reglas (una señal cada una), mientras la redacción vieja sigue juntando dos: un «No aplica» en la
  tarjeta de una señal callaba PARA SIEMPRE otra que la persona no vio. **La regla:** se decide sobre lo que la persona VIO.
  La pantalla manda sus claves y se usan ésas; sin claves (la API), la redacción sólo si es la que se muestra hoy
  (`redaccionVigente`, la MISMA función que decide qué se dibuja).

**La regla que queda:** un arreglo que «completa» una decisión con datos guardados tiene que probar que esos datos son los que
la persona tenía delante. Si dibujar y decidir leen el mismo dato por dos caminos, terminan viendo cosas distintas.

## Montar algo en una pantalla que es de otro chat: dos trampas (26/10/2026)

- **Un `import '….css'` en un componente que se monta en varias pantallas rompe los tests de node que arrastran esas
  pantallas** («SyntaxError: Unexpected token '.'», el `.co {` de centro.css): `tests/editor-landing-agente.test.ts` importa
  `PanelAgente.tsx`, que ahora importaba `RecomendacionesDeMako.tsx`. El componente no importa hojas: las carga cada pantalla
  que lo monta (las cuatro ya cargaban centro.css). Lo vio la lista de `scripts/tests-afectados.mjs --explicar` filtrada por
  los archivos de la pantalla, no los tests del área.
- **Dos de los links de «Hacerlo» llevaban a donde no era, y nada fallaba**: `/automations?id=` (la pantalla abre una
  automatización con `?sec=`, como todos los links del repo) y `/landing-generator?url=` (la ruta vieja, que sólo redirige; el
  diagnóstico de una página es `/web-generator/analizar?url=`). Los encontró una relectura propia, no un test: ahora el test 5 de
  tests/mako-recomienda-superficies.test.ts saca cada `href` de las señales y exige su `app/<ruta>/page.tsx`.
- **Hay tests que fijan la estructura EXACTA de una caja** (`tests/onboarding-caja-centro.test.ts`: el envoltorio de la caja de
  Offer tiene adentro sólo la caja única). El bloque va justo ARRIBA del envoltorio, no adentro; el test no se toca.

## Lo que quedó sin hacer

- **Medir en producción** (el clasificador de permisos negó «Production Reads»; lo habilita Martín):
  `scripts/medir-second-brain.mjs` y `scripts/probar-recomendaciones.mts`. Los `UMBRALES` son razonados, no medidos.
- **Las capturas** de las cuatro pantallas con datos reales.
- **Juntar** las sugerencias del CRM (`lib/sugerencias-crm.ts`) y las decisiones del Media Buyer (`lib/media-buyer/`) en el Ops
  Center con una sola memoria.
- **«Lo que mejoró» en pantalla** (hoy sólo por la API) y un tope diario para todo MaKo.
- El chequeo de tipos acotado de `RecomendacionesDeMako.tsx` y `ChatMakoVista.tsx` lo cortó el vigía de RAM dos veces (la PC con
  otros chats compilando): `node scripts/tsc-acotado.mjs <archivo>` cuando haya RAM.
