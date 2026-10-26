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
  antes. Se descarta lo que cae a menos de un día del borde real (`desdeReal` en lib/recomendaciones.ts).
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

## Montar algo en una pantalla que es de otro chat: dos trampas (26/10/2026)

- **Un `import '….css'` en un componente que se monta en varias pantallas rompe los tests de node que arrastran esas
  pantallas** («SyntaxError: Unexpected token '.'», el `.co {` de centro.css): `tests/editor-landing-agente.test.ts` importa
  `PanelAgente.tsx`, que ahora importaba `RecomendacionesDeMako.tsx`. El componente no importa hojas: las carga cada pantalla
  que lo monta (las cuatro ya cargaban centro.css). Lo vio la lista de `scripts/tests-afectados.mjs --explicar` filtrada por
  los archivos de la pantalla, no los tests del área.
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
