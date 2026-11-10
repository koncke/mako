# Marketing CoPilot — la batería de funnels, los arreglos y el diseño nuevo (9/11/2026)

Pedido de Martín (9/11/2026, noche), en lo central: «que funcione muy bien Marketing CoPilot, que tenga toda la información, que sea un
agente realmente bueno. Hacé la prueba con diferentes funnels… Si le estás recomendando bien, si le falta información, si le falta hacer
preguntas… Y mejorá el diseño de la tab, porque me gustaría que se vea más pro».

Rama: `punta/marketing-copilot-agente`. Las conversaciones enteras: [bateria-antes.md](../marketing-copilot/bateria-antes.md) y
[bateria-despues.md](../marketing-copilot/bateria-despues.md). Lo aprendido: `docs/hallazgos-marketing-copilot.md`.

## Cómo se probó

- **El turno de verdad, no una copia.** `scripts/probar-chats/copiloto.mts` llama a `turnoApp` (lib/mako-turno-app.ts) con el mismo
  contexto que arma la ruta del chat para la tab (`desde.tab = 'Marketing CoPilot'`): reglas, perfil, conocimiento, fichas y las
  herramientas propias. Corre en el **ws 9** (el de MaKo: el ws 3 no tiene IA) con una clave de chat de prueba
  (`mako-movil:prueba-copiloto`), así las conversaciones no aparecen en la lista de nadie.
- **Siete negocios.** Seis inventados (los que pidió el Cerebro) y MaKo con sus datos reales del ws 9 (`--negocio=real`). Para los seis,
  el perfil del negocio, su Second Brain y las lecturas de la cuenta salen del caso (`scripts/probar-chats/copiloto-casos.mts`), no de
  MaKo. El perfil del CoPilot vive en memoria: nada se escribió en `app_settings`.
- **La persona la hace otro modelo** (Haiku) con una ficha que tiene MÁS de lo que dice sola: lo que MaKo no pregunta, no aparece.
  Cada caso pide pasar de un funnel a otro en los turnos 5 y 7 y algo concreto en el 8.
- **El modelo del CoPilot es el que le toca al ws 9: la red de la plataforma.** Ver «Lo que encontré del entorno».

**La vara** (0, 1 o 2 por punto, 12 en total):
1. **Pregunta** lo que le falta antes de recomendar.
2. **Recomienda** bien y concreto: un funnel que le sirve a ESE negocio, con sus números.
3. **Usa la información del negocio** (perfil, oferta, Second Brain, métricas).
4. **Al cambiar de funnel**, compara con sus números, no se contradice y ofrece guardarlo.
5. **Plan concreto** con las pantallas de MaKo.
6. **Las reglas**: cifras con contexto, ningún referente que nadie eligió, voz neutra, sin descalificar.

## Antes (sha `11d0ec656`, lo que está en producción)

| Caso | Pregunta | Recomienda | Usa el negocio | Cambio de funnel | Plan | Reglas | Total |
|---|---|---|---|---|---|---|---|
| Infoproductor, quiere anuncios | 1 | 0 | 1 | 1 | 1 | 0 | **4** |
| Coach, quiere orgánico | 1 | 1 | 1 | 2 | 1 | 1 | **7** |
| Nutricionista, quiere YouTube | 0 | 1 | 1 | 1 | 1 | 0 | **4** |
| Finanzas, quiere email | 0 | 1 | 0 | 1 | 2 | 0 | **4** |
| Inmobiliaria, formularios malos | 1 | 2 | 1 | 0 | 1 | 1 | **6** |
| Tienda de cosmética | 1 | 1 | 1 | 2 | 1 | 0 | **6** |
| MaKo (datos reales del ws 9) | 0 | 1 | 2 | 1 | 1 | 0 | **5** |
| **Promedio** | | | | | | | **5,1 / 12** |

Lo que se repitió (el detalle de cada turno está en bateria-antes.md):

1. **Hace de redactor, no de estratega** (6 de 7). Al segundo o tercer mensaje escribe el anuncio, el post de LinkedIn, el guion del
   video o el correo, y el funnel nunca se decide. A la infoproductora le acepta «US$60 para validar» sin decirle que con eso no se
   valida nada.
2. **No pregunta lo que decide el funnel.** La meta (clientes por mes) no la preguntó en ningún caso. El presupuesto, ni a la tienda
   (podía poner US$1.500 y le recomendó US$10-15 por día con «tres conjuntos»), ni al de email (tenía US$400 y 15.000 seguidores que
   nunca salieron). El margen de la tienda tampoco: sin margen no se sabe cuánto puede costar una venta. Ni los casos reales.
3. **Nunca guardó nada y nunca usó sus herramientas.** En 56 turnos: cero `copiloto_media_buyer` y cero `calcular_presupuesto_anuncios`.
   Lo hablado no llegaba a la pantalla.
4. **Firma con un referente que nadie eligió.** «Inspirado en la metodología de Juan Osorio» en casi cada mensaje de cuatro casos (también
   en YouTube), «la máquina de selección natural de Marcos Razzetti» a la inmobiliaria, y etiquetas inventadas como «(Inspirado en la
   metodología de secuencias y valor)».
5. **Se contradice.** A MaKo le recomienda VSL con llamada sin saber el precio ni el presupuesto y un turno después dice que con US$1.000
   no alcanza. A la inmobiliaria le descarta Google con «palabras clave caras» (inventado) aunque la regla 9 dice que la búsqueda con
   intención local es justo el caso.
6. **Cifras sin contexto.** «Entre 5% y 10% se registra al webinar», «US$15 a 30 por lead en LATAM», «el volumen cae 30% a 50%».
7. **Fuera de los anuncios de ticket alto, improvisa.** No había funnel de email, a la tienda le hablaba con criterio de servicios caros,
   el orgánico de la inmobiliaria lo despachó con «atrae curiosos».
8. **La voz:** «garpa», «Seamos honestos», «Te voy a ser 100% honesto», un «## El orden de prioridades» y un «quieres correr antes de
   aprender a caminar» a una clienta.

Lo que sí hacía bien: el diagnóstico del formulario de la inmobiliaria (fricción y tres preguntas con buenas opciones), el
«promocionar publicación no es una campaña de conversión» de la tienda, el email de recompra, y con los datos reales de MaKo leyó el
CRM (8 leads activos) antes de opinar sobre el email.

### Lo que encontré del entorno (no es del CoPilot, pero lo cambia todo)

- **En el ws 9 el CoPilot contesta con `gemini-flash-lite`.** La cascada de la plataforma prueba las cuatro claves de Gemini del ws 9:
  `GEMINI_API_KEY` y `GEMINI_API_KEY_4` dan **401 «API key not valid»**, la `_2` da **429 por cuota diaria gratis agotada** y la `_3`
  se pasa de tiempo con flash y rota a flash-lite. Cada turno tarda 15 a 65 s. Es la misma base para local y producción
  (`credenciales` del ws 9), así que pasa en producción. Un cliente con su propio Claude o GPT tiene otro modelo.
- **Una marca del sistema se coló al texto:** flash-lite escribió `[no-pude: …]` con un corchete, y el doer sólo saca `[[no-pude: …]]`
  (lib/doer-salida.ts). Quedó a la vista de la persona.

## Los arreglos

| Qué | Dónde |
|---|---|
| **El rol y el orden:** estratega, no redactor. Primero entiende (lo que falta, de a una, con respuestas rápidas), recomienda UNO con sus números, lo baja a esta semana con la pantalla de MaKo, y ofrece guardarlo. Una pieza, corta y después de decidir. | `REGLAS_DEL_COPILOTO` (lib/media-buyer/copiloto-contexto.ts) |
| **Lo que sabe y lo que falta:** qué vende, cuánto deja una venta (y el margen en una tienda), cuánto vende hoy, la meta, el presupuesto, quién atiende; según el funnel, casos, lista, horas y país. La MISMA lista que dibuja el panel. | `fichaDelNegocio`, `PREGUNTAS_DE_DATO`, `leerDato` (lib/media-buyer/copiloto.ts) |
| **Datos nuevos del perfil** (vende, meta, ventasMes, casos, pais, margen, lista, horas), guardables por MaKo con el «sí» o desde el panel. | `PerfilCopiloto`, `sanearPerfil`; `copiloto_media_buyer` en lib/api-mako/areas/ads.def.ts y ads.run.ts |
| **El funnel de email**, la **tienda** (compra directa contra el margen) y el **curso de unos cientos de dólares** con alguien que contesta (mensajes, la página después). | `FUNNELS`, `recomendarFunnel`, `evaluarFunnel`, `propuestaDe`, `tareasDeLaSemana`, `medirDe` |
| **Al cambiar de funnel:** cómo se compara cada uno para ESE negocio (le sirve o no y por qué, cuánto tarda), con las mismas reglas que el aviso. | `compararFunnels`; «LOS FUNNELS PARA ESTE NEGOCIO» en el system |
| **Nada se supone:** sin funnel, un presupuesto que no dijo no es «nada». | `datosDeDecision` |
| **Lo que sabe de los otros caminos:** tienda, local e inmobiliaria (contactar en minutos, Google con intención), orgánico, YouTube, email, lead magnet, LinkedIn y referidos, y qué hacer cuando pide pasar de uno a otro. | `CONOCIMIENTO_CANALES` (lib/media-buyer/copiloto-conocimiento.ts) |
| **Ningún referente que nadie eligió:** sin funnel no viaja ficha; la del funnel viaja como MATERIAL DE APOYO, sin nombre ni «inspirado en». | `fichasDelCopiloto`, `fichaDeApoyo` |
| **El método de los cursos:** `leer_modulo_knowledge` entre sus herramientas. Hoy Knowledge de anuncios y orgánico está vacío; cuando llegue el curso de gestión de campañas que carga otro chat, el CoPilot lo usa sin tocar nada. | `HERRAMIENTAS_DEL_COPILOTO` |
| **Prompts editables:** las reglas, los otros caminos y los anuncios, en /configuraciones → «Marketing CoPilot». | `PROMPTS_COPILOTO`, lib/media-buyer/copiloto-contexto-vigente.ts, lib/prompt-registry.ts |

## Después (sha `884440737`, la misma batería, los mismos siete casos)

| Caso | Pregunta | Recomienda | Usa el negocio | Cambio de funnel | Plan | Reglas | Total | Antes |
|---|---|---|---|---|---|---|---|---|
| Infoproductor, quiere anuncios | 1 | 2 | 2 | 1 | 1 | 1 | **8** | 4 |
| Coach, quiere orgánico | 1 | 2 | 2 | 2 | 2 | 1 | **10** | 7 |
| Nutricionista, quiere YouTube | 0 | 2 | 1 | 2 | 2 | 2 | **9** | 4 |
| Finanzas, quiere email | 1 | 2 | 1 | 2 | 2 | 1 | **9** | 4 |
| Inmobiliaria, formularios malos | 1 | 2 | 2 | 1 | 1 | 0 | **7** | 6 |
| Tienda de cosmética | 0 | 2 | 1 | 2 | 1 | 1 | **7** | 6 |
| MaKo (datos reales del ws 9) | 2 | 1 | 2 | 2 | 2 | 0 | **9** | 5 |
| **Promedio** | | | | | | | **8,4 / 12** | 5,1 |

Lo que cambió (bateria-despues.md):
- **Es un estratega.** Abre con lo que sabe del negocio («Veo que vendes Foto que Vende, un programa de US$497, con unas 4 ventas por
  mes»; «Veo en tu perfil que el MaKo Acelerador se vende a US$1.500»), recomienda UN funnel y pregunta de a una.
- **Guarda.** 5 de 7 casos terminaron con su funnel guardado por la tarjeta (antes, 0): la infoproductora en anuncios a mensajes con
  US$600 y US$497, la nutricionista en YouTube con 6 horas, el coach en orgánico, la tienda en compra directa con US$1.500, MaKo en VSL.
- **Usa sus herramientas:** `calcular_presupuesto_anuncios` con los 300 € del coach, `leer_modulo_knowledge` para su primer guion,
  `contar_segmento_email` (los 8 leads reales de MaKo).
- **Los cambios de funnel se comparan:** YouTube «no te va a dar pacientes esta semana», los cortos como anzuelo del largo; el email
  antes que el webinar «porque la lista ya existe»; lead magnet con anuncios en dos tiempos; influencers que alimentan los anuncios.
- **Ningún «inspirado en» de alguien que nadie eligió.**

Lo que esta corrida cazó y se arregló después (`66c110f10`):
1. «¿Y si en vez de anuncios me enfoco en orgánico?» CAMBIÓ el funnel sin comparar (el clasificador lo leyó como una orden).
2. «He guardado» y «Actualicé» con la tarjeta sin confirmar; ofrecer guardar en cada mensaje; guardar «US$0 de anuncios» que nadie dijo.
3. Porcentajes inventados: «un filtro recorta entre 40% y 60%», «la asistencia a un webinar ronda el 20% o 30%» (sobre 3.000
   contactos fríos, 600 a 900 personas en vivo: imposible), «el costo por llamada calificada suele moverse entre US$100 y 200».
4. El plan del lunes sin pantallas de MaKo en dos casos.
5. A MaKo le recomendó VSL con llamada con US$1.500 de ticket y US$1.000 al mes: sin el ticket guardado, las reglas puras no corrían.
6. Guardó la meta de MaKo («2 o 3 clientes por mes») como ventas de hoy.
7. Sigue sin preguntar lo imprescindible cuando la persona trae otra pregunta (la meta en 5 de 7, el margen de la tienda).

## Tercera corrida (sha `66c110f10`, los tres casos con esas fallas)

[bateria-tercera.md](../marketing-copilot/bateria-tercera.md).

| Caso | Pregunta | Recomienda | Usa el negocio | Cambio de funnel | Plan | Reglas | Total | 2.ª | Antes |
|---|---|---|---|---|---|---|---|---|---|
| Infoproductor | 2 | 2 | 2 | 1 | 2 | 1 | **10** | 8 | 4 |
| Tienda de cosmética | 1 | 2 | 2 | 2 | 1 | 1 | **9** | 7 | 6 |
| MaKo (datos reales) | 2 | 2 | 2 | 2 | 2 | 1 | **11** | 9 | 5 |

- **MaKo real:** pregunta el precio ANTES de recomendar, lo encuentra en el Second Brain («MaKo Acelerador, USD 1.500»), aplica los
  umbrales («con US$1.000 al mes el VSL se queda corto: mensajes o formulario con filtro»), y cuando Martín insiste con el VSL lo respeta
  avisando lo que cuesta. El plan sale numerado con la pantalla de cada paso, y usa el CRM real (5 sin agendar, 3 clientes).
- **Infoproductor:** pregunta presupuesto, ventas de hoy y meta, hace la cuenta (15 × US$497 = US$7.450) y arma la semana con Video y
  Copywriting. **Pero ante «¿y si en vez de anuncios hago orgánico?» volvió a proponer el cambio**, con US$0 que nadie dijo: la regla del
  prompt no alcanzó. Se pasó al CÓDIGO: `copiloto_media_buyer` no propone cambiar de funnel si el mensaje es una pregunta así
  (`esPreguntaHipotetica`, lib/media-buyer/copiloto.ts; la guarda en lib/api-mako/areas/ads.run.ts; test en
  tests/marketing-copilot-descubrir.test.ts).
  **Verificado con el turno real** (`ccfb159c4`, la infoproductora hasta el turno 6): ante la misma pregunta ahora compara («ir 100%
  orgánico por miedo a perder plata te exige publicar todos los días durante meses; con US$600 al mes comprás datos»), recomienda
  combinar los dos y pregunta por dónde seguir. No propone ningún cambio.
- **Tienda:** usa el margen («cada venta te deja US$27»), no inventa presupuesto, enfoca los US$1.500 en anuncios hasta que haya tracción.
- **Lo que sigue apareciendo:** dice «te dejo la tarjeta» en un turno donde la herramienta no viajó (regla D ajustada: sólo si la
  llamó en ESE turno), alguna cifra suelta («la prueba social reduce el riesgo a la mitad»), y la meta sólo la pregunta si la charla
  llega ahí. Son de modelo chico: en el ws 9 contesta gemini-flash-lite.

## Para el Cerebro

- **Rama:** `punta/marketing-copilot-agente`. **Sin migración**: lo nuevo del perfil vive en el mismo `app_settings`
  (`marketing-copilot.perfil`) y `sanearPerfil` lo valida.
- **Antes de tocar el agente otra vez:** `node --env-file=<.env.local> --conditions=react-server --import tsx scripts/probar-chats/copiloto.mts`
  (dos tandas en paralelo con `--casos=`, unos 40 a 90 min por la red del ws 9; `--negocio=real --casos=mako` para el negocio real).
- **En producción, en el ws 9 (o el 3 con IA):** `/ads-manager?estrategia=1` abre la charla en dos columnas; tocar una ficha «Falta»
  pregunta en el chat; «Comparar funnels» y «Elegir»; terminar con un funnel sin anuncios abre la pantalla nueva (MaKo + panel «En
  marcha»); con uno de anuncios, la sección Plan muestra el panel.
- **El banco** (`scripts/banco-copilot/`): `node scripts/banco-copilot/build.mjs && node scripts/banco-copilot/servir.cjs`, y
  `?pantalla=estrategia` para la pantalla nueva.

## Lo que quedó sin hacer

- **El curso de gestión de campañas ya está en /conocimientos** («Programa de Meta Ads 2026», THE NET LAB, 94 lecciones, `54ded47e5`),
  **pero no en Knowledge**: `mako_knowledge` del área `ads` sigue vacío, y es lo que lee `leer_modulo_knowledge`. Falta destilarlo ahí.
- **Las claves de Gemini del ws 9** (dos vencidas, una sin cuota): el CoPilot de Martín contesta con flash-lite.
- **El doer no saca `[no-pude: …]` con un corchete** (lib/doer-salida.ts), y el guardia de promesas no cazó «te dejo la tarjeta» sin
  tarjeta.
- **Un dato dicho en el chat no aparece solo en el panel**: en una pregunta las herramientas que escriben no viajan (decisión del
  8/10, «la ofrece»). El panel guarda directo con sus pastillas.
- **El Funnel Coach y el CoPilot guardan el funnel en dos lugares** (`guardar_plan_funnel` y `marketing-copilot.perfil`).
- **La pantalla Hoy · Campañas · Biblioteca** de un funnel con anuncios sigue con su diseño; sólo su Plan usa el panel.

## Diseño

### Las referencias (productos reales, 2025-2026)

| Referencia | Qué se toma | Qué no |
|---|---|---|
| **HubSpot Marketing Studio + Campaign agent** (knowledge.hubspot.com/campaigns/use-campaign-agent-in-marketing-studio) | El chat del agente a la izquierda y el lienzo de la campaña como área principal; la IA arma el plan en el lienzo **cuando lo aprobás**; si le falta contexto, pregunta en el chat. | Juntar plan, automatizaciones, métricas y kanban en un lienzo (en 2026 lo rehicieron «menos lienzo, más insights»). |
| **Relume** (relume.ai, sitemap con IA) | La estructura se arma de a poco y cada nodo es una tarjeta densa: el recorrido del funnel en cuatro etapas. | La navegación de diseñador (barra espaciadora, ⌘+rueda). |
| **Lovable** (Plan mode) | Las **preguntas con opciones para tocar** cuando algo falta y el «Approve» antes de construir. | La cantidad de modos y el ruido técnico. |
| **ChatGPT Canvas** | El «Show changes»: lo que cambió se marca. | Los menús de largo y nivel de lectura. |
| **Zapier Canvas + Copilot** | Los arranques sugeridos («What should we build?») y el borrador que se ajusta charlando. | La barra de pizarra completa. |

Los tres patrones que se repiten entre las mejores: **borrador → aprobación → recién ahí se construye**; **preguntas con opciones dentro del
chat**; **edición por bloque y cambios visibles**.

### Las dos direcciones

- **A · Lienzo del funnel** ([40-direccion-a-lienzo.png](../marketing-copilot/40-direccion-a-lienzo.png)): el chat a la izquierda y, a la
  derecha, el funnel dibujado: lo que MaKo sabe del negocio (fichas, con lo que falta punteado), el recorrido del cliente en cuatro
  etapas con la pantalla de MaKo de cada una, la cuenta y esta semana. Abajo, «Usar este funnel».
- **B · Plan vivo** ([41-direccion-b-plan-vivo.png](../marketing-copilot/41-direccion-b-plan-vivo.png)): el chat a la izquierda y, a la
  derecha, un documento (diagnóstico, por qué este funnel, comparación, esta semana, qué medir) con versiones y lo que cambió marcado.

**Elegida: A**, con dos cosas de B (lo que cambió se marca y la comparación de funnels). Por qué:
1. Martín ya rechazó pantallas «con una cantidad de texto y de botones» (el Media Buyer del 25/10). B es un documento: más texto.
2. Martín pidió «un panel que arme el funnel»: A lo dibuja; B lo describe.
3. A se arma ENTERO con lo que el código calcula (`fichaDelNegocio`, `recorridoDe`, `cuentaDe`, `compararFunnels`, `tareasDeLaSemana`):
   lo que dice es cierto aunque el modelo se equivoque, y el panel y el agente no se contradicen. B necesitaría que una IA escriba y
   guarde el documento en cada turno (costo, y lo que invente queda escrito).

### Lo implementado

- **La primera entrada** (`app/ads-manager/PrimeraEntrada.tsx`): la charla de siempre (pastillas, «Volver», referentes, su motor) pasa
  a la columna izquierda, y a la derecha el panel (`app/ads-manager/PanelDelFunnel.tsx`), que lee el perfil en cada cambio. Tocar un dato
  que falta hace que MaKo lo pregunte en el chat con respuestas rápidas (una pastilla guarda; lo escrito se confirma: «Entendí: Uruguay.
  ¿Lo anoto?»). «Comparar funnels» muestra los nueve con si le sirve, qué pide y cuánto tarda, y «Elegir» cambia el funnel como si lo
  hubiera elegido en la charla. Lo que cambia se marca 4 segundos.
- **Después de la charla, con un funnel sin anuncios** (`EstrategiaCopiloto`, app/ads-manager/PlanDelCopiloto.tsx): MaKo a la izquierda
  (el Cerebro con el contexto del CoPilot, como la tarjeta de Create) con tres arranques sugeridos, y el panel «En marcha» con Tu funnel ·
  Esta semana · Qué medir. El teléfono sigue con su pantalla.
- **Reglas de la casa:** el chat de MaKo a la izquierda (AGENTS.md, «Una tab de CREATE es UNA pantalla»), un solo fondo (`var(--bg)`, todo
  lo demás son tarjetas), los tokens de MaKo (claro y oscuro salen solos), y cuando no entran las dos columnas (la caja mide menos de
  900 px) se ve una por vez con «MaKo | Tu funnel».

**Verificado en el navegador** con el banco (`scripts/banco-copilot/`, la PrimeraEntrada real compilada con datos de prueba, Chrome sin
ventana y sin sonido): 1440 (vacía, charla, propuesta, comparación, oscuro), 1280 y 1024 con la barra abierta, 390 (las dos caras del
interruptor), la pantalla de después en claro y oscuro, y las interacciones (un dato tocado, contestado con pastilla y escrito; otro
funnel elegido). Capturas 27 a 44 en `docs/marketing-copilot/`. Dos defectos que se vieron en las capturas y se corrigieron: las fichas
salían sin caja (un `display: contents`) y los botones de la semana decían «Ir».
