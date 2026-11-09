# Feedback de la llamada Martín–Mauricio del 8/11/2026, textual y por área

> **La llamada:** «Impromptu Google Meet Meeting», 8/11/2026, de 22:06 a 23:58 hora de Argentina (17:06 a 18:58 en Tijuana),
> 1 h 52 min (1 h 47 min de transcript). Fue la última grabada al 9/11. Estaban **Martín** y **Mauricio Bustos**, que es **cliente** de MaKo (ws1) y no
> el dueño. La grabaron los dos: el recording `200907865` es la cuenta de Fathom de Martín y el `200907550` la de Mauricio
> (esa arranca 20 s antes). **Los minutos de abajo son los del `200907865`.** Transcript bajado de la API de Fathom.
>
> **De qué fue:** casi toda la llamada es el negocio de Mauricio: su campaña de Meta del Sprint (USD 257 gastados sin una
> venta) y los asuntos de sus 15 correos. El feedback para MaKo salió en el medio, sobre todo en los minutos 8 a 30
> (la API, el Pixel y los tickets) y 1:32 a 1:46 (cómo armar los correos en MaKo).
>
> **Cómo leerlo:** lo que va entre comillas es textual. ⚠️ Fathom rotula mal a los hablantes en varios tramos (pone a
> Martín como Mauricio y al revés), así que **quién lo dijo se atribuye por el contenido**, cruzando las dos grabaciones.
> Cuando Mauricio lee en voz alta lo que le contestó su IA, va como «Codex (leído por Mauricio)». En el transcript,
> «Cloud», «Clau» y «Klaus» son **Claude**; «chat DTP» es ChatGPT. Lo único que se corrige de la letra son esos nombres
> que Fathom transcribe mal (Codex por «códices», Claude por «clavo», MaKo por «Macbook», skill por «skin»).
>
> **Estado, comparado contra `origin/main` = `6ad8c0202` y producción leída el 9/11 (sólo lectura):**
> **NUEVO** = no existe ni está en curso · **ABIERTO** = ya hay ticket o trabajo que no cerró · **EXISTE** = ya está en
> main · **SEÑAL** = no es un pedido, pero conviene que lo sepa el área.

## El resumen, un renglón por área

| Área | Nuevos | Lo más urgente |
|---|---|---|
| Conexión con Claude (la skill) | 0 (el #60, CERRADO) | **Ticket #60: arreglado y en producción el 9/11**, con el ticket cerrado y Mauricio avisado (§ 1) |
| API de MaKo y tokens | 3, **sin hacer** | Que el agente que recibe el token encuentre la documentación solo |
| Pixel de MaKo (Landing) | 0 (1 EXISTE, 2 a medir, **sin hacer**) | Avisarle a Mauricio que vuelva a bajar el JSON: el suyo no trae los clics (va con el aviso del § 1) |
| Ticketera (Soporte) | 1, **sin hacer** | La repregunta «¿siempre o fue una vez?» en lo que no es una falla |
| Automations y CRM (los correos del Sprint) | 0 | Ya está armado por la API; falta que Mauricio prenda el envío |
| IA que escribe correos (Copywriter) | 0 | Las reglas de asunto de Martín chocan con `docs/conocimiento/patrones-email.md` |
| Anuncios (Media Buyer) | 0 | Mauricio analiza su campaña con Codex y no con MaKo |

---

## 1. Conexión con Claude (la skill): ticket #60, reproducido, arreglado y en producción el 9/11

| Min | Quién | Textual |
|---|---|---|
| 8:20 | Mauricio | «nunca pude conectar Cloud con Mako. Me dice que no está conectado y que me pide un API key y el API key no lo reconoce o algo así, levanté un ticket» |
| 8:44 | Mauricio | «lo que hice pues tratar de bajar todo lo que estaba en los Fathom … decirle a través de Cloud que los ponga en plan y no, me dice que no está conectado, y me metí al API a Maco, y ahí generé un API, y se lo di a Cloud pero tampoco» |
| 16:14 | Mauricio | «Esto ya lo hice yo para Cloud y no me funcionó. Y le puse así a todo, lectura y escritura.» |
| 1:33:32 | Mauricio | «no pude entrar en Cloud, ¿eh? No sé si es lo mismo. ¿Ibas a arreglar algo?» |
| 1:39:47 | Mauricio / Martín | «¿Y es el mismo para Cloud?» — «Sí, el mismo.» |

**El estado al escribir esto:** el ticket **#60** (7/11, de Mauricio desde el teléfono) estaba en `esperando_decision`.
El arreglo del 6/11 (`fa029686e`) cambió **sólo el mensaje** del 401 de `/api/v1` (`lib/api-mako/http.ts`): antes decía
«token inválido o revocado» también cuando no llegaba ninguna cabecera. Con eso el ticket quedó como si estuviera atendido,
y no lo estaba.

**REPRODUCIDO el 9/11 en el ws3 (Cliente de Prueba) contra producción**, con un `mako_pat_` real acuñado para la prueba y
revocado al terminar (ningún token del ws1):

| Pedido | Cabecera | Respuesta |
|---|---|---|
| `/api/v1?compacto=1` | `Bearer mako_pat_…` | **200** |
| `/api/agente/contexto`, `/plan` y `/skill` | `Bearer mako_pat_…` | **401** «token inválido o revocado» |
| `/api/agente/contexto` | sin cabecera | **401** «token inválido o revocado» (el caso del 6/11, sin arreglar acá) |
| `/api/agente/contexto` | el token sin «Bearer» | **401** «token inválido o revocado» |
| `/api/v1?compacto=1` | el mismo token, ya revocado | 401 |

**La causa, medida en el código:**
- MaKo tiene **dos tokens** (la tabla de `app/api-mako/Articulos.tsx:174-180`): el **detallado** (`mako_pat_`, se crea en
  API → Tokens, para n8n, Zapier o un script) y el **clásico** (`mkoag_`, se crea en **Integraciones → Claude**, «la skill
  de Claude»).
- Las rutas de la skill (`/api/agente/*`, entre ellas `/api/agente/plan`, la que carga tareas al Plan) resuelven el bearer
  con `wsDelBearer` → `wsPorAgenteToken` (`lib/agente-token.ts`), que **sólo conoce el clásico**. Lo dice
  `app/api/agente/skill/route.ts:40`. A un token detallado le contestan **401 «token inválido o revocado»**, y esa ruta no la
  tocó el arreglo del 6/11.
- Mauricio generó sus tokens en API → Tokens (en la llamada se ve: 14:22 a 16:30) y se los dio a su Claude. En la llamada
  se le confirmó que el de Codex «es el mismo para Cloud» (1:39:47). Codex anduvo porque usa `/api/v1`, que sí acepta el
  detallado. **Con el token equivocado, regenerarlo no arregla nada**, que es justo lo que hizo dos veces.
- Lo que contestó su Claude en el ticket encaja: «es MaKo quien rechaza los dos tokens como "inválido o revocado"», y en la
  llamada (19:00) lee que «el token de aquí sigue rebotando» pero que «el token que usa tu skill» sí conecta.

**Por qué era lo más urgente:** bloquea lo que Mauricio quería hacer con Claude (pasar las reuniones de Fathom a su Plan), y
la guía de la campaña de email («Una campaña de email con Claude», en API → Documentación → Guías) está escrita para Claude.

**El camino elegido (9/11): la skill SIGUE sin aceptar el detallado, y cada lugar donde se confunden dice cuál va.**
Había dos caminos. El otro era que `/api/agente/*` aceptara los `mako_pat_` con sus alcances, y se descartó por esto:
- **La frontera es a propósito y está fijada por un test** (`lib/api-mako/tokens-lista.ts`, tests/api-mako-tokens.test.ts).
  `/api/agente/skill` mete en el archivo el bearer que se le presentó, y el reporte del plugin (`/hook`, `/telemetria`) tiene
  su consentimiento atado al clásico.
- **Las rutas de la skill no tienen permiso por área.** Aceptar un detallado obligaba a inventar uno por ruta. `consultar`
  lee varias áreas a la vez, entre ellas conversaciones de WhatsApp, y equivocarse en eso es darle al token más de lo que
  dice.
- **Las dos cosas se portan distinto:** el detallado escribe directo y la skill siempre deja propuestas.
- **Al detallado no le falta nada:** lo que la skill hace por `/api/agente`, un `mako_pat_` lo hace por `/api/v1`.
  Codex lo probó en la llamada.

**Lo que cambió** (en `punta/feedback-llamada-0911`):
- `lib/api-mako/autorizacion-reglas.ts` → `mensajeDeAutorizacionAgente` (puro). El 401 de la skill separa los casos de la
  cabecera como `/api/v1`. Ante un `mako_pat_` o un `mako_agt_`, dice que PARECE de API → Tokens (sale sólo por el prefijo,
  sin mirar la base, así que no le afirma que «sirve»), que la skill usa el de
  Integraciones → Claude (`mkoag_`) y que regenerar en API → Tokens no lo arregla. Ante uno que no existe, manda a
  Integraciones → Claude. Y el 401 de `/api/v1` con un `mkoag_` revocado también manda a Integraciones → Claude, no a
  API → Tokens.
- `lib/agente-token.ts` → `rechazoAgente(req)`, el 401 de las siete rutas (`consultar`, `contexto`, `lead`, `metricas`,
  `plan`, `skill`, `telemetria`). `bearerDe` queda **como en main**: sólo «Bearer». La primera versión lo había ampliado
  al esquema «token» de paso, y con eso `Authorization: token <mkoag_ vigente>` pasaba de 401 a autorizar. Lo vio la
  revisión del Cerebro y se volvió atrás: para la skill, «token …» es un esquema equivocado y el 401 dice que va «Bearer».
- **Las pantallas:** el formulario de un token nuevo en API → Tokens dice «No sirve para la skill de Claude», con el link.
  La tarjeta de Integraciones → Claude dice «A Claude dale este token… Los de API → Tokens… la skill no los acepta».
- tests/agente-token-equivocado.test.ts: 12 pruebas. El grueso pasa por tests/_agente-token-equivocado-hijo.ts, que le
  pega a las siete rutas REALES con pedidos de verdad, contra un PostgREST de mentira: un `mkoag_` vigente, un `mako_pat_`
  vigente y cuatro cabeceras malas. Probado rompiéndolo con 13 mutaciones, las 13 en rojo. Entre ellas están las seis que
  la primera versión del test dejaba pasar.

**Cerrado el 9/11/2026.** Entró en dos commits: `b5f621c6f` y la corrección de la revisión del Cerebro, `22c544886`, que
volvió `bearerDe` a la regla de main y hace que el test pase por las rutas de verdad. Fechas, en UTC:
- **14:26:41:** en producción (lo desplegó el Cerebro con `desplegar-ya`). Medido con un `mako_pat_` de mentira contra
  `/api/agente/contexto`, que contestó «parece un token de MaKo → API → Tokens…».
- **14:30:48:** el cron de tickets cerró el #60 solo, por el hito de la bitácora de api-mako.
- **14:30:59:** le avisó a Mauricio por donde lo había levantado.
- **Después:** salió el aviso al grupo de MaKo del ws1, con el token que va en Claude (el `mkoag_` que ya tiene su Mac en
  `~/.mako-token`) y el JSON que tiene que volver a bajar para Codex (§ 3.1).

## 2. API de MaKo y tokens: 3 NUEVOS

**2.1 NUEVO: dar «Lectura y escritura» a todas las áreas de un toque.**

**Sin hacer** · área dueña: **API de MaKo** (`lib/api-mako/**`, `app/api-mako/**`). Lo reparte el Cerebro.

| Min | Quién | Textual |
|---|---|---|
| 15:16 | Martín | «Y ahí le tienes que dar acceso a todo. En lugar de sin acceso, lectura y escritura.» — Mauricio: «¿A cada cosa?» — «Sí.» |
| 15:29 | Martín | «yo como feedback me voy a llevar una implementación dentro de Maco para que eso se pueda seleccionar todo directamente y se pueda dar lectura y escritura a todos al mismo tiempo.» |

Hoy `app/api-mako/Tokens.tsx` tiene un selector por área y nada para todas juntas. El lector de reuniones ya lo sacó como
tarea de Martín en el borrador de su Plan (ver § 7).

**2.2 NUEVO: el agente que recibe el token tiene que encontrar la documentación solo.**

**Sin hacer** · área dueña: **API de MaKo** (`lib/api-mako/**`, `app/api-mako/**`). Lo reparte el Cerebro.

| Min | Quién | Textual |
|---|---|---|
| 18:08 | Martín | «Ah, qué raro. Dice que necesita la documentación, pero si debería tener acceso a la documentación.» |
| 18:41 | Martín | «yo me llevo el feedback de que eso siempre debería, cuando pegas una API…» |
| 20:00 | Martín | «yo me llevo como feedback, eso ya debería haberlo tenido solo, pero bueno, es básicamente le estás pasando aquí la documentación de la API, que es lo que te pidió.» |

Lo que **existe**: el índice vivo `GET /api/v1?compacto=1` (devuelve lo que el token puede pedir) y
`GET /api/v1/openapi.json`. Lo que **faltó**: con el token solo, Codex no supo la dirección ni que el índice existe, y hubo
que bajar el JSON a mano (API → Documentación). ⚠️ Y una copia bajada **envejece**: la de Mauricio ya no trae los clics del
Pixel (§ 3.1). Un agente que lee el índice vivo no tiene ese problema.

**2.3 NUEVO (es una decisión): levantar un ticket por la API.**

**Sin hacer** · área dueña: **API de MaKo** con la **Ticketera** (`lib/api-mako/areas/tickets.def.ts`). Es decisión de Martín; lo reparte el Cerebro.

| Min | Quién | Textual |
|---|---|---|
| 28:28 | Codex (leído por Mauricio) | «No encontré una función para crear tickets en API en Maco. ¿A qué correo o canal de soporte lo envío?» |
| 28:36 | Martín | «Qué raro que no tenga así. Yo también estuve levantando tickets con Codex, con Claude en mi caso.» |

`levantar_ticket` existe para la app y WhatsApp, y **por HTTP no está a propósito**: `lib/api-mako/areas/tickets.def.ts`
dice «Sin HTTP por ahora: un integrador que levanta tickets es otra decisión». Martín esperaba que estuviera. Mauricio
terminó copiando el texto de Codex en Reportar problema, y así salió el #66.

## 3. Pixel de MaKo (Landing): 1 EXISTE y 2 A MEDIR

**3.1 EXISTE (se resolvió durante la llamada): los clics por botón, por la API.**

| Min | Quién | Textual |
|---|---|---|
| 25:42 | Codex (leído por Mauricio) | «El archivo del API que compartiste permite consultar visitas y comportamiento del video, pero no incluye una consulta de clics por botón ni con un historial con sus fechas.» |
| 26:19 | Martín | «la API de Maco no está actualizada y no te está compartiendo la cantidad de clics en botones … levanta un ticket porque eso es un error de Maco.» |
| 27:00 | Martín | «automáticamente a mi cloud eso, y se va a solucionar solo, dentro solamente de una hora ya va a estar.» |

Es el ticket **#66** (9/11, 01:36 UTC). La operación `listar_clics_landing` entró a main el **8/11 a las 23:21** (`18a7bf5bd`),
todavía en la llamada, y el ticket quedó `resuelto` el 9/11 a las 11:15 UTC con «Ya está arreglado». La promesa de «una
hora» se cumplió. **Avisado el 9/11:** en el aviso del § 1 se le pidió a Mauricio que **vuelva a bajar el JSON** (API →
Documentación → «OpenAPI (JSON)»). Falta ver si lo hace, o si Codex pasa a leer el índice vivo. El que le pasó a Codex es de las 22:25, de antes de la operación nueva, así que su Codex sigue sin verla. Lo que él
quería contar son los clics en «RESERVA TU CUPO» de sprint.mauriciobustos.com.

**3.2 A MEDIR: el tope de 1.000 visitas.** **Sin hacer** · área dueña: **Pixel de MaKo** (`lib/api-mako/areas/landing.*`). A los 22:46, Codex (leído por Mauricio): «visitas en 30 días, al menos 1.000,
esa consulta tiene un límite de lectura». Mauricio: «O sea, como que nomás lee 1.000 o qué». La respuesta avisa que es «al
menos», así que no miente, pero el total de 30 días sale cortado. Huele al techo de 1.000 filas de PostgREST (AGENTS.md, «El
techo de 1000 filas no da error»). Falta ver cuál operación fue.

**3.3 A MEDIR: el video cuenta también las reproducciones automáticas.** **Sin hacer** · área dueña: **Pixel de MaKo**. A los 23:52 (grabación de Mauricio), Codex: «Los
eventos de video incluyen reproducciones automáticas, además MaKo advierte que algunos visitantes entraron a otras páginas
tuyas por lo que las cifras de avance pueden incluir videos de esas páginas». Le dio 1.618 «visitantes con evento de video»
sobre 1.790. La marca existe (`auto`, docs/hallazgos-crm.md: «el autoplay no es mirar el VSL»). Falta ver si la operación de
comportamiento la descuenta.

## 4. Ticketera (Soporte): 1 NUEVO

**Sin hacer** · área dueña: **Ticketera** (`lib/soporte-chat.ts`, `lib/tickets-reglas.ts`). Lo reparte el Cerebro.

| Min | Quién | Textual |
|---|---|---|
| 29:40 | Mauricio | «Esto se me hizo bien raro, estas preguntas, porque dice, siempre que lo intento, a veces, o fue una vez, me acuerdo que no aplicaba cuando le estaba viendo lo del plan.» |

`lib/soporte-chat.ts` pregunta «¿Te pasa siempre o fue una vez?» **cada vez que el triage lee una falla**. El #66 era un
pedido (algo que la API no tenía), el triage lo leyó como falla y le preguntó igual. El #60 también lleva «Cuándo pasa: Fue
una vez».
**SEÑAL al lado:** el título del #66 quedó «\*\*Asunto: La API no expone…\*\*», con los asteriscos del markdown que pegó
de Codex. `tituloDe` toma la primera oración tal cual.

## 5. Automations y CRM, los correos del Sprint: 0 nuevos (EXISTE, y ya se armó)

| Min | Quién | Textual |
|---|---|---|
| 1:32:10 | Mauricio | «el tema es que lo que yo no sé es cómo hacer esto en Maco» — Martín: «ahora tienen la API … Codex le tienes que pedir que te lo configure» |
| 1:42:37 | Mauricio | «Me va a tener que hacer otro funnel, ¿verdad? … Otro que sea diferente al de WhatsApp.» |
| 1:42:54 | Mauricio | «¿Y cómo saber a cuáles ya? Porque en ese le estoy cambiando de funnel.» |
| 1:45:26 | Mauricio (a Codex) | «quiero que de igual forma crees un CRM con los mismos columnas para ir organizando los envíos de 15 correos a los mismos contactos.» |

**Ya existía todo desde el 4/11** (`docs/relevo/nube-email.md`). `agregar_en_bloque_a_crm` **suma a otro CRM sin sacar del
suyo**, y eso contesta el «¿cómo saber a cuáles ya?». También están `funnelId` en `crear_secuencia_email`, las
`columnasEmail` por automatización y la guía «Una campaña de email con Claude».
**Medido en producción después de la llamada (ws1, sólo lectura):** se creó el CRM «Sprint correos» (id 56, a las 03:16
UTC), la secuencia «15 correos diarios» (apagada) y dos pilotos de 3 correos cada 48 h, «Piloto A» y «Piloto B», prendidos.
Por la hora y los nombres lo armó su Codex por la API (no se miró la bitácora de la API). Mauricio pegó **su propia** clave de Resend (07:55 UTC) y quedó conectado el dominio (07:56). **Envíos: 0** al escribir
esto. Lo que falta es suyo: confirmar `activar_envio_real_email`.

**SEÑALES:**
- **El preheader quedó vacío** en los 21 correos que armó Codex, y MaKo lo manda (`lib/email-html.ts`). Mauricio le había
  pedido a su IA sacarlo, porque creía que Gmail no lo tiene: «el otro me daba un preheater o un complemento de encabezado
  que no tiene Gmail» (1:01:33). Y Martín prefirió la versión que lo traía: «el primero que te hizo, que te puso pre-header,
  hizo los asuntos súper bien … en el nuevo, los asuntos no quedaron bien» (1:30:18).
- **No supo hacerlo sin un agente:** «lo que yo no sé es cómo hacer esto en Maco». La respuesta fue Codex, no una pantalla.
- **No tiene palabra para un funnel:** «un CRM, sí, pero al subconjunto del CRM, ¿cómo le llamas? — Es que son muchos CRM,
  cada hoja es un nuevo CRM» (1:45:11, grabación de Mauricio).

## 6. La IA que escribe correos (Copywriter): 0 pedidos, las reglas de asunto de Martín

No son pedidos para MaKo: es el feedback de Martín a los 15 correos de Mauricio. Se anotan porque son su criterio y le
sirven a la IA que escribe correos. ⚠️ **Chocan con `docs/conocimiento/patrones-email.md`**, que abre sus ejemplos con
«Hola, soy…» (hoy ningún archivo de código lee ese documento: docs/hallazgos.md, Conocimiento).

| Regla | Textual | Min |
|---|---|---|
| El asunto se entiende solo | «para que un asunto sea importante es que se entienda solo. Es decir, que no necesite más contexto para entenderse y que obviamente llame la atención.» | 1:09:33 |
| Sin «Hola» | «yo no pondría hola en casi que ningún lado. Y si pones un saludo … sería más por el medio, no al principio.» | 1:05:09 |
| La primera frase valida el asunto | «al principio es el hook, que es el propio asunto del correo, y después la primera frase tiene que validar lo que se acaban de leer en el asunto.» | 1:05:18 |
| El nombre sí, el «Hola» no | «Mauricio, piensa por un momento … Ese sí me gusta. Pero si dice hola, Mauricio … siento como que corta el storytelling» | 1:08:22 |
| En segunda persona | «Yo siempre intentaría dirigir los correos como si fuera en primera persona. Te estoy hablando a ti. En lugar de un Dashboard, sería tu Dashboard.» | 1:25:30 |
| Que no parezca un bot | «no tengo miedo en poner este error de puntuación, de cerrar con un signo de exclamación y no abrirlo … porque es lenguaje natural y mejor que no parezca bot.» | 1:27:02 |
| «Lee esto» | «Ese recurso de lee esto lo utilizaría también mucho … piensa en las típicas noticias de urgente que tienen los noticieros» | 1:23:40 |
| La palabra concreta | «Gente, o sea, yo pondría tus empleados, porque gente podría hacer muchas cosas.» | 1:29:04 |
| La palabra que el lector conoce | «¿Ellos saben lo que es un dashboard o no?» (quedó «Dashboards (tableros)», una vez) | 1:24:05 |
| Contradecir lo que todos creen | «Una meta no le dice a tu equipo qué hacer mañana … es cortito, ataca el dolor y genera curiosidad» | 1:10:23 |
| No dar la respuesta en el asunto | Mauricio: «déjalo con curiosidad porque ahí ya le estás dando la respuesta» | 1:22:28 |

**IDEA (de Martín, para Mauricio):** «Todo esto sirve para hacer anuncios de cada uno … Aquí tienes 15 anuncios para
grabarte», con variaciones: «antes de despedir a tu empleado, lee esto» (1:36:09–1:36:51). Le sirve al redactor de anuncios.

## 7. Anuncios (Media Buyer) y Plan: SEÑALES

- **Mauricio analiza su campaña de Meta con ChatGPT y Codex, no con MaKo**, y los números no le cerraron. Martín: «te
  están dando mal los datos porque dice que en total gastó 1,800 y aquí tu total es como más de 2,000» (46:05). Mauricio,
  a su IA: «Los números y el gasto que indicas no es igual al que estoy viendo» (47:00). MaKo tiene el Media Buyer
  (`lib/media-buyer`), y nadie lo abrió en la llamada.
- **Lo que pasó en la cuenta:** los anuncios nuevos estaban en borrador («los nuevos ni siquiera, están en borrador todos»,
  41:00) y Meta ponía cerca del 80 % en uno viejo.
- **El criterio de Martín, dicho en la llamada:** «La métrica ganadora en nuestro caso, la única es la de compra» (37:42). El
  costo de conseguir un cliente no pasa el precio del producto, USD 270 (33:00). «Yo personalmente, Mau, no tendría más de
  cinco a la vez» (53:17), o se sube el presupuesto. Y hay que preguntar si sumar creativos nuevos «reinicia el
  aprendizaje» (41:38). El motor ya sabe que un salto grande de presupuesto lo reinicia (`lib/media-buyer/motor.ts:24`).
- **El curso de escalamiento** que compró Martín: le pasó el acceso a Mauricio para que su IA lo transcriba y analice la
  campaña con él (38:28–39:09).
- **El Plan:** el lector de reuniones ya dejó **un** borrador de esta llamada en el Plan de Martín (ws9, propuesta
  `propmw8oge89k6tw3`, `pendiente`, 8 tareas), y en el ws1 no quedó un segundo: no hubo duplicado. De las 8, la única de
  MaKo es la de los tokens (§ 2.1); las otras son tareas del negocio de Mauricio. **Lo de este documento que no está en
  ese borrador:** §§ 1, 2.2, 2.3, 3, 4 y 5.
