# Relevo: el reto de 7 días contra la auditoría del Cerebro (20/11/2026, chat «reto-tutoriales», claude5)

La auditoría está en `C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8/auditoria-onboarding-reto-20-11.md`.
A este chat le tocan los tramos reto-dia-1 (D1-*), reto-dias-2-4 (d24-*, f24-*), reto-dias-5-7 (R57-*) y, de los videos, V1, V2 y V3.

**No son de este chat:**
- `tutorialDelDia` (lib/reto/dias.ts), `MotorTutorial.tsx` y el onboarding: los tiene el chat del onboarding.
- `lib/reto/correos.ts` y todo aviso por WhatsApp o push (D1-04, d24-02, d24-03, d24-04, d24-15, d24-16, R57-04, R57-05, R57-10, R57-11): los tiene el chat de WhatsApp.

## Hecho (tanda 1, punta/reto-tutoriales)

- **Las tareas se cierran por lo que MaKo lee (D1-01, d24-07, d24-12, R57-09).** Vive en `lib/reto/senales.ts`.
  - El GET de /api/reto lo lee y lo guarda en `reto.estado.leidas`.
  - La tarjeta muestra el texto leído («Leí 134 contactos en tu CRM.»).
  - Tocar lo marcado sólo lleva al lugar. La API ya no acepta `accion: 'hecha'`.
  - Las «hechas» de antes, sin lectura, se vuelven a leer.
- **Adelantar corre los días siguientes (d24-01, R57-06).**
  - Se guarda `adelantadoEn`: si el lunes adelanta el 2 y el 3, el martes se abre el 4.
  - El día adelantado no lleva aviso: `avisado` sube hasta él.
- **Sin la marca automática a los 0,9 s (D1-03, d24-09, R57-12).** Lo que falta se marca al terminar o cerrar el video del día. La marca del día 1 va sin «Lo hago después» (F1).

## Hecho (tanda 2, punta/reto-tutoriales)

- **Los días 4 a 6 según el funnel (d24-14, R57-01, 0df3ddf4a).** `diasDelReto(funnel)` usa la tabla POR_FUNNEL de la maqueta;
  /api/reto manda el funnel del plan de Funnel Coach. Prospección en frío va con la columna de WhatsApp. El correo del día (no es
  de este chat) sigue con los textos de siempre.
- **«¿Qué hacemos ahora?» (D1-02, V3, 541106d88).** El mensaje INTERES_YA, el recuadro de opciones del Ops Center con «Empezar mi día 1»
  y un «Muéstrame {pestaña}» por cada cosa elegida (cada uno corre su tutorial con su video). Los días se muestran recién al empezar
  el día 1, y ahí sale la marca de Offer Coach. Se guarda en `reto.estado` (`dia1Desde`, `muestras`).
- **El desplegable (V2, D1-08, R57-14, R57-F6, D1-17, 0ed2525be).** El video de cada día abierto, «El reto de 7 días de MaKo», «al
  terminar el día de hoy», y el ícono con la flecha.
- **⚠️ Trampa de git:** un `pull --rebase origin main` con commits ya subidos a la punta (y todavía no en main) los reescribe, y el
  push siguiente es rechazado. Con una punta se une main con `merge`, como hace subir.mjs.

## Hecho (tanda 3, punta/reto-tutoriales)

- **Los tres puntitos (D1-10, d24-11, 701b8e302).** Cada mensaje nuevo llega después de que MaKo escribe 1,2 s, de a uno.
  - Lo ya visto se guarda en el navegador: `mako.reto.vistos`, `useAparicion`.
  - Las opciones aparecen recién cuando MaKo terminó de escribir.
- **El catálogo «Tutoriales de MaKo» (V1, D1-07, 0572946ca + 638c67305).** El ícono de videos en la cabecera cambia el hilo por el catálogo.
  - Lo arma `gruposDelCatalogo` (app/second-brain/reto/CatalogoTutoriales.tsx). No muestra AI Avatar, y las de Classroom van con su nombre.
  - **⚠️ El nombre de los coaches** se escribe sólo en lib/reto/dias.ts (`VIDEOS_DEL_RETO`). tests/coaches-ops-center.test.ts (14) frena cualquier «Offer Coach» escrito en una pantalla.
- **El fin de cada día (D1-06, d24-13, R57-07, R57-F1, R57-F4, f24-02, 59610a104).** Vive en `diaTerminado` y `finDelDia`, con su frase para «te falta…».
  - «¿Adelantas…?» sale recién con el día terminado, en el recuadro de opciones.
  - «Lo hago después» y «Mañana» quedan guardados en `reto.estado`.
  - La prueba por WhatsApp va al final del día.
  - Sin «te escribo»: el WhatsApp de cada mañana todavía no existe.

## Hecho (tanda 4, en main en a537f946f)

- **Essential, la A (R57-03).** Durante la prueba, el reto abre UNA vez cada cosa de Pro de los días 4 a 6: la réplica de página, el
  carrusel con IA, el guion replicado y el personaje. Vive en lib/reto/pro-del-reto.ts (la regla, pura) y en -server.ts (`abreElReto`).
  - Los cuatro candados le preguntan (replicar-candado, replica-candado, editores-ia-pro, ai-avatar/acceso).
  - Un uso dura 2 h; después, el candado de siempre.
  - Se anota en `reto.estado.pro` (desde y hasta); el gasto en MaKo Tokens está en sus movimientos de esa ventana.
  - La tarjeta dice «Esto es de Pro: en tu prueba lo usas una vez.».
- **El catálogo sin «Cómo funciona…»** (el rojo de tests/tutorial-sin-presentacion.test.ts: Martín, 20/11). Cada pestaña va con su nombre.
- **El clip del día 6:** lo hace la sesión de AI Avatar (local_a2f3a36c…).
  - Su contrato: app/ai-avatar/regalo/actions.ts → `clipDeRegaloAction()` y `pedirClipDeRegaloAction({ frase })`, con SalidaClip y
    ClipRegalo en lib/reto/clip-regalo-reglas.ts.
  - El lugar es `ClipDelReto` en ChatDelReto.tsx (hoy no dibuja nada). Se conecta cuando su hash esté en main.
  - La tarjeta consulta el estado al abrirse y cada 10 s mientras diga 'generando'.
  - La frase viene prellenada con el gancho del guion del día 5.
- **⚠️ Cada push a la punta CANCELA la corrida del anterior.** Hoy por eso no llegaba nada a main. Se juntan los commits y se sube UNA
  vez; después se espera la corrida, en verde o en rojo.

## Hecho (tanda 5, en main en 2fb32553f)

- **La caja del chat del reto (D1-09, R57-13).** Es la caja de siempre (CajaDelCliente: adjuntos, emojis y nota de voz), en la
  conversación propia del reto (`TAB_RETO = 'reto-7-dias'`, lib/chat-mako-reglas.ts, con su fila fija).
  - En app/api/mako/chat/route.ts hay UNA rama en `contextoDelChat` para `desde.tab === ORIGEN_RETO`, con el contexto de
    lib/reto/contexto.ts: el día, lo hecho según lo que MaKo leyó, lo que falta, lo que dejó para después, lo que eligió y su funnel.
    No toca cómo se eligen los coaches.
  - Las opciones del reto van arriba de la caja.
  - **Tests que fijan listas:** tests/second-brain-chat-mako.test.ts fija las tabs con conversación propia. Se sumó `reto-7-dias`.
- **Las marcas con la tarea y la tarjeta con el título del día (f24-04, R57-F2, f24-03, R57-15)**, en 7a1e521ce.

## Hecho (tanda 6)

- **`reto.estado` sin pisar la hora del WhatsApp** (lo encontró el chat de WhatsApp). `conLoLeido`, cada acción de /api/reto y el uso de
  Pro escriben con compare-and-set (lib/reto/cambiar.ts, `cambiarReto`): si otro escribió en el medio, se relee y se aplica otra vez.
  El test reproduce la carrera.
- **El día 2 en su orden (d24-19, D1-18):** las tres primeras tareas, la hora de WhatsApp y, último, «Tu perfil y tu foto».
  ⚠️ **El video reto-dia-2 todavía nombra el perfil antes de la hora:** hay que regrabar ese tramo, guion → voz → render.
- **V5 y V14:** cada día de HOY abre la primera vez con el velo y MaKo escribiendo (`useEntrada` y `EntradaEscribiendo`, las piezas
  del chat del onboarding). El video del día lleva «dale play»: el día 1 con `VideoDelMomento`, y los días con marcas con
  `useDalePlay` en su botón. Los tres puntitos de acá no esperan en los días, para que no haya dos entradas seguidas.

## Lo que decidió el Cerebro (20/11)

- **R57-02, el clip de 10 s del día 6: SÍ, por ApiMart.** Martín decidió el 17/11 que el video de los CLIENTES va por ApiMart (Flow es
  para su contenido).
  - Va UN clip por prueba.
  - Lo que cuesta queda registrado, en MaKo Tokens o en la tabla de costos.
  - Si ApiMart falla o no hay saldo, se dice claro y no se cobra nada.
- **d24-23, «integrar tu CRM»: AFUERA** mientras no exista una integración con otro CRM. El día 3 ofrece sólo el CSV. Es una
  **función pendiente**, no un olvido: hace falta una integración con GoHighLevel, HubSpot o Pipedrive en lib/integraciones-catalogo.ts.

## Lo que se le avisó al Cerebro (las dos ya las decidió, arriba)

- **R57-02, el clip de 10 s de regalo:** Martín lo decidió el 15/11 (memoria `reto-7-dias-prueba`), y el 19/11 lo saqué de las tareas y del video del día 6 porque la app no lo regala.
  - Medido el 20/11: en la prueba va UN video con el personaje (`prueba.avatares: 1`).
  - Ese video se filma con los créditos de Google Flow de la persona (lib/video-action.ts, `encolar('generar_clip')`), no con MaKo Tokens.
  - No hay límite de 10 s: el largo sale del guion.
  - Para regalarlo de verdad hace falta que MaKo lo filme (ApiMart, todavía sin cablear: lib/apimart.ts no lo importa nadie).
- **d24-23, «o integrar tu CRM»:** no existe ninguna integración con otro CRM en lib/integraciones-catalogo.ts. Lo que hay es el CSV y `migrar_contactos`, que sólo funciona por la API. Volver a «integrar tu CRM» sería prometer algo que no hay.
- **D1-15:** el día 1 lleva el video `reto-dia-1` o el del recorrido.
- **D1-18 / d24-19:** el perfil va antes o después de la hora de WhatsApp en el día 2.

## Lo que falta, en el orden del Cerebro

1. ~~**d24-14 y R57-01**~~ (hecho). Lo que queda de esto: **d24-05**, las integraciones del día 2 según el funnel (usar `INTEGRA_POR`).
   Antes decía: Hay que armar el título y el detalle de spy, web, carrusel, guion y clip con la tabla POR_FUNNEL de la maqueta (`C:/dev/artefactos-onboarding/cuerpo.html`).
   - El funnel sale de `leerPlanFunnel()` (setting `funnel_coach.plan`: `funnel` y `otros`).
   - Las tareas son un `const` puro (DIAS_RETO). Lo más limpio es una función `diasDelReto(funnel)` que use /api/reto y que el chat reciba los días ya armados.
   - El mapa de integraciones por funnel ya está en `INTEGRA_POR` (lib/reto/senales.ts). Úsalo también para d24-05.
2. **R57-03, el candado de Pro en una prueba de Essential.** ⏳ Se le preguntó al Cerebro (A: la prueba abre una vez cada cosa para el reto; B: Essential pide lo que tiene). También el día 4: replicar una página es de Pro. Los días 5 y 6 terminan en «Pasar a Pro». Hay dos caminos:
   - que la prueba abra la réplica de carrusel, el guion y el personaje para el reto;
   - o que en Essential esos días pidan lo que Essential sí tiene. El plan sale de `esEsencialDe` (lib/plan-esencial.ts).
3. ~~**D1-02 y V3**~~ (hecho). El recuadro lleva «Empezar mi día 1 (Recomendada)» y un «Muéstrame {pestaña}» por cada cosa elegida en el onboarding, hasta 3.
   - Lo elegido se pide en lib/onboarding-arranque.ts:1785-1799.
   - Cada opción corre `mostrarTutorial(tutorialDe(<pestaña>), { video })`.
   - La marca del día 1 sale recién al elegir «Empezar mi día 1».
4. **El chat del reto:** (los tres puntitos ya están; falta la caja, que espera al Cerebro: ¿a quién le escribe?)
   - **La caja con audio (D1-09, R57-13):** para que la caja exista hay que decidir a quién le escribe. Mi propuesta: al MaKo del Ops Center, con el contexto del reto.
   - **Los tres puntitos antes de cada mensaje nuevo (D1-10, d24-11):** marcarlo por día en sessionStorage.
   - **Las opciones en el recuadro de arriba de la caja**, no en la burbuja.
5. ~~**El fin de cada día**~~ (hecho). Antes decía: «¿Adelantas…?» sale recién al terminar el día, con el texto FIN_DIA.
   - En el día 1 se recomienda «Adelantar»; desde el día 3, «Mañana» va primero y sin recomendar.
   - «Mañana» se guarda en /api/reto.
   - Se saca «¡Hiciste todo lo del día N!» de los días 3 a 7.
6. **Los videos:**
   - **d24-10 / R57-21 / V4:** el video que se reproduce en el mensaje y pasa a la esquina sólo al salir de la vista.
   - **V14:** el reproductor de VideoDelMomento.
7. **Lo bajo:**
   - **Textos de la maqueta:** D1-14, d24-24, R57-16, f24-08.
   - **Tarjeta del día con su título y «Del día N»:** f24-03, R57-15, d24-21.
   - **«Lo hago después» guardado:** R57-F1.
   - **Marcas con el título de la tarea:** f24-04, R57-F2.
   - **El orden de la lista de chats:** D1-13.
   - **El ícono y la flecha del botón del reto:** D1-17, R57-F6.
   - **D1-05:** «Vuelve a tu reto» al terminar Funnel Coach.
   - **D1-16:** el mensaje antes de marcar el reto.
   - **d24-06:** el QR en el chat desde el principio.
   - **d24-20:** la marca de la foto.
   - **d24-22:** el Plan en el día 3.
   - **f24-05:** el «⋮» del CRM.
   - **R57-08:** el cierre del reto con el mensaje del piloto.
   - **R57-18:** las marcas de adentro de Video.
   - **R57-19:** el inicio del reto con la prueba.
   - **R57-20:** la zona horaria.
   - **F3, f24-01, R57-F5:** el teléfono, con «Sigamos en tu computadora».

## Cómo se prueba

- **Tests:** `node --import tsx --test tests/reto-dias.test.ts`. Si se toca la ruta, también tests/d6b-rutas.test.ts: el GET del reto está en `SIN_IA`, porque sólo lee.
- **Capturas:** el componente se dibuja con renderToStaticMarkup, usando el registrador de `C:/dev/artefactos-pestanas/herramientas/registrar.mjs` y su app.css.
  - Para eso `Dia` y `CSS_RETO` están exportados.
  - La foto se saca con Playwright de C:/dev/playwright-medidor, por la cola `C:/dev/artefactos-animaciones/tools/turno.mjs`.
- **Tipos:** `tsc-acotado` no corre con la PC ocupada (lo cortó el vigía de RAM el 20/11). Los corre GitHub en la punta.
- **El ensayo «desde cero»:** guarda el reto en el navegador y no lee lo hecho. Ahí las tareas no se cierran solas. Está pendiente decidir si leen las señales de verdad.

## Esperando (20/11)


- **El clip del día 6:** se conecta `ClipDelReto` cuando la sesión de AI Avatar avise que su app/ai-avatar/regalo/actions.ts está en main.

