# El feedback de diseño de Martín que NO está cerrado (medido el 24/10/2026, 16:45)

Martín, por el Cerebro (24/10): **«aún falta mucho feedback de diseño que te di»**. Esto es la cuenta, medida, sin
arreglar nada.

**La cuenta: 10 pedidos abiertos.** 9 están a medias (uno de ellos, el Video Editor, en pausa por Martín) y 1 sin
empezar. El más viejo es del **15/10**: «faltan los nuevos diseños con animaciones» del Web Generator.

Además, **unos 50 puntos (en 15 tandas) que se daban por pendientes ya están en main** y nadie se los confirmó (abajo,
en «Hechos sin confirmar»). Y el trabajo de Chats del 24/10 **no llegó a main**, aunque el merge diga «Chats».

## Cómo se midió

- **Las fuentes:** los 91 pedidos del Ops Center (`operaciones_pedidos`, leídos el 24/10), los 163 pedidos textuales de
  las bitácoras desde el 12/10 (`app/admin/dev/*/bitacora.ts`, los hitos `tipo: 'prompt'`), y los renglones «Sin hacer»
  y «Falta» de esas bitácoras. También las memorias de feedback (12/10, 18/10, 21/10 y 22/10), docs/feedback-18-10.md y
  los relevos de cada área.
- **La verificación:** cada pedido se buscó en el código de `origin/main` (4a41f096c), no en lo que dice un relevo.
- **«Hecho» quiere decir que está en el código de main.** No quiere decir que se vio andar en el teléfono de Martín: casi
  nada de esto se miró en su Android.
- **Sólo diseño:** cómo se ve, dónde está y cómo se usa. Lo de plata, infraestructura, la API y el Pixel no entra.

## Los 10 abiertos, del más viejo al más nuevo

| Fecha | Qué pidió (textual) | Pantalla | Estado | Qué falta |
|---|---|---|---|---|
| 15/10 01:02 | «Por otro lado, faltan los nuevos diseños con animaciones...» | Web Generator (diseños de landing) | a medias | Las animaciones (etapa 4) se relevaron en papel el 23/10 y se construyen después del 25/10 (docs/relevo/landing-generator.md §2). No hay ningún diseño nuevo con animaciones en main. |
| 15/10 | «Creo que Video Editor no terminó de copiar todo lo que debía copiar de CapCut, tal vez que termine eso primero.» | Video Editor | a medias, **en pausa por Martín** desde el 16/10 («Por ahora posponemos lo de Video Editor») | Medido el 15/10, y no se volvió a medir: de 158 funciones de CapCut, 74 hechas, 26 a medias y 42 por copiar (docs/editor-video/inventario-copia-capcut.md). Los subtítulos, que pidió primero, se hicieron el 15/10. |
| 17/10 21:06 | «Y lo peor es que en mobile se bugea y no se puede scrollear hasta abajo de esa sección.» | Ops Center en el teléfono (las hojas) | a medias | Se arregló la hoja de «Uso y Runners». Las otras hojas que abren a media altura siguen sin dejar ver el final de un texto largo: `SheetM` en «medio» (app/m/_ui/SheetM.tsx, de MaKo Mobile). Lo dejó escrito el cierre del pedido del 17/10 20:54. |
| 17/10 22:31 (+18/10 pts 5 y 7, +22/10 12:39) | «Todo estos chats, el diseño y la funcionalidad deberían estar en TODA la app donde haya instancias de MaKo, siempre este modelo de chats...» | Todo chat con MaKo | a medias | La CAJA única ya está en todos menos dos: la del Web Generator (`CajaPedido.tsx`, que también usan Automations, CRM y Dashboard) y la del Plan (`MakoProyecto.tsx`). El PANEL único falta en cuatro: Offer, Video Editor, Image Editor y el «Pregúntale a MaKo» de Chats (`WhatsAppAdvisor.tsx`). La lista la lleva tests/chat-unico.test.ts. Del 22/10, «¿Todos esos chats regresan y se quedan registrados en Ops Center? Incluido los chats de MaKo en WhatsApp?»: las charlas de las tabs ya van al grafo (256f46e07); las de MaKo en WhatsApp, sin medir. |
| 18/10 ~10:45 (pt 11) | Chats: «réplica del chat del Ops Center», los comentarios al desplegable de contacto y al detail del lead, fuera «Actividad», «Abrir panel» en vez de «Contacto», fuera «Cerrar» y «Posponer», el Equipo con la X y «Nuevo miembro», MaKo con la automatización actual, la etapa sin tapar el nombre, ver los otros CRM, fuera «La bandeja». (Resumen del Cerebro en docs/feedback-18-10.md: el texto original llegó por su chat.) | Chats | a medias | Hecho, pero **fuera de main** (rama `ops-integraciones-2410`, etiqueta `respaldo/chats-2410`, c9753eb13): la caja del Ops Center y «La bandeja» pasada a filtros. Falta: los comentarios en la ficha del lead; sacar «Actividad» (sigue como pestaña, PanelContacto.tsx); «Abrir panel» (sigue «Contacto»); sacar «Cerrar» (sigue en la cabecera) y «Posponer» (sigue en el «⋯»); el Equipo con la X y «Nuevo miembro»; MaKo con la automatización actual; los otros CRM del lead. «La etapa no tapa el nombre»: sin medir en pantalla. |
| 18/10 ~10:45 (pt 12) | Dashboard: «Analizar con MaKo» abre el chat unificado; el botón sale del lado del filtro (ya está en los 3 puntos); «Editar» con el patrón de Web Generator. (Resumen del Cerebro.) | Dashboard | a medias | «Editar con MaKo» ya es el panel único con la estrella (a7d9f7566). «Analizar con MaKo» abre el AI Analyst, que es un panel de análisis propio (PanelAnalista.tsx), no el chat único. **24/10:** el botón salió de la barra (Dashboard, General y Métricas); el AI Analyst queda en el ⋮. Martín pidió sacarlo «completamente»; se le preguntó por el Cerebro qué hacer con lo que se pierde (docs/hallazgos-graficos.md, «"Analizar con MaKo" sale de la barra»). |
| 18/10 | «Todo lo de "Armemos tu CRM" debería ser como el onboarding dentro de cada tab... al entrar por primera vez» | Onboarding del CRM (y de cada tab) | **sin empezar** | La configuración del CRM sigue dentro del onboarding general. No hay onboarding propio de la tab que se abra la primera vez. |
| 18/10 20:28 (pt 13) | «Cuando uno entra, debería estar posicionado en el chat de "Onboarding" que es el chat que recién se estuvo completando... Con toda la conversación tal cual... Y luego debería iniciar el tutorial de la app» | Onboarding, en el teléfono | a medias | En la computadora está hecho (b222b34fc). En el teléfono no hay tutorial: /m/second-brain no lee `?recorrido=` (docs/relevo/onboarding.md, 20/10). |
| 21/10 23:10 | «como concepción, el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda» | Todas las tabs | a medias | La pieza (`MakoEnLaTab`) la montan cinco tabs: CRM, Plan, Clients, Dashboard y Ads Manager. No la montan Automations, Web Generator, Offer, los editores de video e imagen, Chats, Calendar ni General. Si alguna abre su chat a la izquierda por otro camino, no se midió. |
| 23/10 17:40 | «Tal vez sería bueno crear un bloque dentro del detail de cada lead que esté relacionado a las automatizaciones, no? Para tener más claridad de lo que pasa... Y que claro, sea editable como el resto de bloques...» | CRM, ficha del lead | a medias | El bloque «Automatizaciones» y lo obligatorio dato por dato ya están. Falta lo que arma Automations: lo enviado, las terminadas y «Empezar de nuevo» (bitácora del CRM, 23/10 18:40). |

## Hechos sin confirmar: estaban como pendientes y ya están en main

Ninguno se vio andar en el Android de Martín. Están en el código, y se los puede dar por cerrados cuando él los mire.

- **12/10, CRM:** las notas como los chats de MaKo (emojis, micrófono y adjuntos), y «A revisar» en el lugar. Están en
  NotasCard.tsx y en docs/relevo/crm.md. La memoria del 12/10 todavía los daba por pendientes.
- **17/10, Ops Center:** «elimina "Content Machine"», «"Calendario" debería ser "Calendar"», Dashboard dentro de lo
  diario, y las tabs de Admin al menú de la foto («Platform»). Están en nav.ts.
- **17/10, Clients:** Clientes, Curso y Comunidad en una tab tipo Skool, con «Classroom», y «Llevar a MaKo Partners» en el
  CRM (CrmBoard.tsx).
- **17/10 20:54, Ops Center:** «Si le doy pegar y tenía una imagen, debería pegarse eso». La foto mandada se ve también
  en otro dispositivo (23/10, `operaciones-enviados/`).
- **17/10 16:35 y 18/10 15:15:** «si saqué una screen... debería aparecer así arriba para pegarlo». Hecho el 24/10
  (9b5cc7e76): al tocar el campo, la caja ofrece «Pegar la captura».
- **18/10, Ops Center:** el ✓ del «Completado», guardado en el servidor, que vale en las dos pantallas
  (`marcarYaVistoAction`).
- **18/10 17:43:** «en Mobile si le doy para atrás debería sacarme del chat para ir a ver todos los chats». Está en
  93433368b. **El relevo del Ops Center todavía dice «SIN EMPEZAR».**
- **18/10, puntos 1, 4, 8, 9, 10 y 14:**
  - el Second Brain sin el nombre «Mapa»;
  - la barra se pliega al entrar al Ops Center;
  - el CRM con el bloque de fondo y «Próximo» plegado;
  - el Plan sin prioridad ni origen, con el check al lado del tacho y las columnas editables;
  - la sidebar del punto 10 (todo desplegado, el Ops Center dentro de lo diario, MaKo Partners en el perfil, claro y
    oscuro, el logo plegado);
  - Clients con su fondo y sin título.
- **18/10, Onboarding:** «Revisando tu respuesta» pasó a los puntitos, y las preguntas de fase ya no son sólo de Meta
  (lib/fase-diagnostico.ts).
- **21/10:**
  - la estrella de cada tab va al «Cerebro»;
  - las criaturas se mueven y parpadean siempre, y reaccionan al tocarlas (Criatura.tsx);
  - «Kanban · Lista» van juntos;
  - «Personalizar tarjetas» con plantillas en el CRM, en Clients y en el Plan.
- **22/10 noche, CRM:**
  - el «⋯» de la columna por secciones, con «Eliminar» sola y en rojo;
  - «Tipo de etapa ›» se cambia ahí mismo, y el ícono de columnas se fue;
  - la tarjeta de la reunión sirve para prepararla, sin «Llamar» ni «WhatsApp».
- **22/10 noche:**
  - abrir a MaKo pliega la sidebar (8eee6338b);
  - las sugerencias van plegadas;
  - Automations tiene el ícono de un flujo;
  - «✓ Listo» en verde;
  - «Anti-ban» con filas cortas.
- **22/10 23:45:**
  - «Reportar a Soporte» en todo error (app/_ui/ReportarASoporte.tsx);
  - la Ticketera del cliente es un chat;
  - el modelo se elige en el «+» de cada chat;
  - «Tus cuentas de IA» por bloques, con «Nuevo dispositivo»;
  - «Vincular evento» y «Vincular cobro», con su aviso;
  - el bloque de decisiones sólo con flechas;
  - Configuraciones de Automations en una pantalla;
  - el loader con la criatura.
- **22/10, Ticketera:** el mazo y la vista tabla, la tarjeta al centro con cuatro botones redondos, quién lo levantó, y
  el deshacer arriba y sutil. La flecha para plegar las tarjetas de la Ticketera que se ven arriba de la caja vino con el
  bloque único de lo que espera a Martín (3d6362fd6).
- **23/10:**
  - la tarjeta de WhatsApp sin «Sale sola» ni «Una sola vez / otra vez»;
  - las condiciones se llaman «Contestó» y «No contestó»;
  - «Misma persona» se fue;
  - las métricas de cada automatización (MetricasAutomatizacion.tsx);
  - la lista del Ops Center dice lo último desde el primer cuadro (a1f876546).

## La trampa: «el relevo dice que falta» no es una medición

**El síntoma:** el pedido de esta lista llegó porque «falta mucho». Leyendo sólo los relevos y las memorias, salían como
abiertos el «atrás» de Android, las notas del CRM, el «Pegar» del teléfono, el ✓ del «Completado» y casi toda la lista
«para después del 20/10» del Cerebro (docs/relevo/cerebro-historia.md). Están hechos.

**La causa:** el que arregla algo no vuelve al relevo de OTRA área a tachar la línea. El «atrás» de Android se hizo en
MaKo Mobile (93433368b), y el relevo del Ops Center sigue diciendo «SIN EMPEZAR». Las notas del CRM se hicieron, y la
memoria del 12/10 las seguía dando por pendientes. Con el «Pegar» del teléfono pasa lo mismo.

**Y al revés:** un merge puede decir que trae algo que no trae. «Merge Ops Center (Chats, audio, captura, diseño del
cartero)» (485e8f05e) tiene como padre c1c46d916, la rama del audio y el cartero. El trabajo de Chats (c9753eb13) vive en
otra rama y no está en main: FiltrosChats.tsx, ConectarCanal.tsx y AdministrarWhatsApp.tsx no existen en main.

**La regla:** para decir si algo está, se busca en el código de main, nunca en el relevo. Y antes de dar algo por subido,
se pregunta con `git merge-base --is-ancestor <sha> origin/main`, no con el título del merge.

## Lo que NO se volvió a medir

- **docs/pendientes.md** (17/10): 296 pendientes de todas las implementaciones. No es feedback de diseño de Martín, y no
  se cruzó uno por uno.
- **El rediseño de agosto** (las 9 partes, tareas #516 a #538 del tablero): la mayor parte quedó atrás con la sidebar del
  17/10 y el chat único. No se midió parte por parte.
- **Las reglas generales** (los pop-ups con loader y el pie pegado, los ajustes en filas cortas, sin textos que repiten un
  control): están hechas donde Martín las pidió (CRM y Automations). Que se cumplan en TODAS las pantallas no se puede
  medir con un grep.
