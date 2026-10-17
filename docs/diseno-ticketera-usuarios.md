# La Ticketera de los usuarios — diseño (17/10/2026)

Pedido de Martín, 17/10/2026, en lo esencial:

> «La ticketera desde ahora será exclusiva para los tickets levantados por los usuarios. Implementa end-to-end la
> ticketera para los usuarios, copia el diseño y la funcionalidad de alguna muy conocida... el ticket me tiene que
> llegar con el reporte de a quién pertenece... con cada decisión que yo tome debería mandarse al cerebro y que decida
> si abre un nuevo chat o se lo envía a algún jefe... un bug evidente que debería funcionar bien debe solucionarse
> automáticamente, pero si alguien pide implementar algo nuevo, eso sí depende de mi decisión... Para el usuario debe
> ser fácil levantar un ticket... Tal vez en los mismos chats de MaKo... Y que MaKo le proponga levantarlo si detecta
> que intentó algo y falló, o si pidió algo que todavía no está en la app.»

La investigación entera (con las URLs leídas y las licencias verificadas) quedó en el scratchpad de la sesión; lo que
sirve para decidir está acá. Lo que se aprendió construyéndolo va a [hallazgos-ticketera.md](hallazgos-ticketera.md).

---

## 1. Qué se copió, y de quién

| Lado | Se copia | Por qué esa y no otra |
|---|---|---|
| El cliente que lo levanta | **Intercom** (Messenger + Customer tickets) | Es un chat dentro del producto, como MaKo, para gente no técnica. El ticket nace DE la conversación (Fin → «Handoff to Ticket»), no de un formulario frío. Separa el estado interno del que ve el cliente. |
| | De **Zendesk**, una idea | Al cliente se le muestran pocas palabras («Open · Awaiting your reply · Solved») aunque adentro haya seis estados. |
| Martín, que decide | **Linear Triage** | Una bandeja con cuatro acciones y atajo: Aceptar `1`, Rechazar `2` (con motivo para quien lo pidió), Duplicado `3` (que no pierde al que lo pidió), y lo sugerido por la IA se acepta o se corrige con su explicación a la vista. |
| El arreglo automático | **Sentry Seer** (el método, no el código) | Autonomía graduada por confianza, y primero la causa raíz, después el código. Nunca arregla lo que no entiende. |
| | **GitHub Copilot coding agent** | La lista de lo que NO se le da a un agente: seguridad, datos personales, producción crítica, requisitos abiertos. |

**Licencias** (verificadas el 17/10/2026 en el LICENSE de cada repo): Sentry es FSL (prohíbe el uso competidor), Sweep
tiene licencia propia de pago y AutoCodeRover es source-available: de esos **no se copió ni una línea**, sólo el
método reescrito. SWE-agent, OpenHands, Agentless y claude-code-action son MIT; Aider y graphiti, Apache-2.0. No hizo
falta código de ninguno: el triage de MaKo son reglas propias (§4).

---

## 2. El cliente: levantar un ticket sin llenar nada

### 2.1 Desde el chat de MaKo (la puerta principal)

MaKo **propone** levantar el ticket y la persona **confirma con un botón**. Nunca lo crea solo (AGENTS.md, «Un canal
PROPONE; una persona confirma»). Lo propone en dos casos:

1. **Intentó algo y falló.** El turno ve el error de la herramienta o de la acción del registro. Ese error lo guarda
   el CÓDIGO, textual, en el contexto del ticket: es la señal fuerte del triage (§4) y nunca pasa por el modelo.
2. **Pidió algo que la app no tiene.** El modelo lo reconoce y llama a `proponer_ticket` con `noExiste: true`, el tipo
   que le parece y un título y un resumen escritos por él.

La tarjeta dice qué se va a mandar (título y resumen, editables) y tiene un solo botón: **«Mandárselo al equipo»**. Al
tocarlo se crea el ticket con todo el contexto que se junta solo (§2.3) y el chat contesta con su número y un link.

Es una capacidad de la API de MaKo (`lib/api-mako/areas/tickets.def.ts`), como manda AGENTS.md: la ven el Second
Brain, MaKo Mobile y, cuando el chat «MaKo en WhatsApp» la enchufe, WhatsApp.

### 2.2 A mano: `/tickets` («Reportar problema», en el menú del perfil)

- **Arriba, un campo**: «¿Qué pasó o qué necesitas?», y tres opciones para elegir qué es: *Algo no anda* · *Quiero
  pedir algo nuevo* · *Tengo una pregunta* (las plantillas «bug» y «feature» de GitHub, en palabras del cliente). El
  título sale solo de la primera oración.
- **Abajo, «Tus tickets»** (el «Mis solicitudes» de Zendesk): número, título, estado y última novedad. Al abrir uno,
  su historial: lo que mandó, en qué anda y lo que se le contestó.

### 2.3 El contexto que se junta solo

| Dato | De dónde sale |
|---|---|
| Workspace, persona, email, rol y plan | La sesión, en el servidor (nunca del navegador). Es una FOTO del día: no cambia si después la sacan del equipo. |
| Pantalla (ruta interna) | El navegador o el turno del chat |
| El chat y el hilo | El componente del chat |
| Lo último que le pidió a MaKo y lo que le contestó | El turno |
| El error y la herramienta que falló | El código que lo vio fallar |
| La hora, la zona, el navegador, la pantalla y el idioma | El navegador |

Todo pasa por `sanearContexto` (lib/tickets-reglas.ts): una lista cerrada de campos, cada uno con su tope.

### 2.4 Lo que ve el cliente: cinco palabras

| Adentro | El cliente ve |
|---|---|
| nuevo · esperando_decision | **Recibido** |
| en_curso · arreglado | **En curso** |
| esperando_cliente | **Espera tu respuesta** |
| resuelto | **Resuelto** |
| rechazado · duplicado | **Cerrado** (siempre con el motivo escrito) |

Cuando cambia, le llega el aviso **por donde lo levantó**: en la campanita de la app (y en el chat, si lo levantó
ahí), o por WhatsApp si fue por WhatsApp.

---

## 3. Martín: la bandeja (Linear Triage)

Vive donde hoy está la Ticketera, adentro de Ops Center (`?ticketera=tickets`). Las tarjetas de preguntas de los
chats salen de ahí: pasan al formulario de opciones dentro de cada chat, que construye el chat «Ops Center». El mazo
viejo no se borra hasta que ese formulario ande.

- **La lista**, en tres grupos: *Esperan tu decisión* (pedidos, preguntas y bugs dudosos), *Arreglándose solos* (los
  bugs del triage, con su estado de entrega), *Cerrados*. Cada fila: número, título, **de quién** (negocio · persona ·
  rol · plan), tipo y prioridad.
- **El detalle**: el reporte entero (§2.3), el veredicto del triage **con su porqué**, y el historial.
- **Las acciones** (con su atajo de teclado, como Linear):

| Acción | Atajo | Qué hace |
|---|---|---|
| Aprobar | `1` | Firma un pedido al Cerebro con el ticket entero (§5). El cliente ve «En curso». |
| Rechazar | `2` | Pide el motivo, que lee el cliente. «Cerrado». |
| Duplicado | `3` | Pide de qué ticket. Cuando el original se resuelve, se avisa también a éste. |
| Preguntar | `4` | Le escribe al cliente: «Espera tu respuesta». |
| Responder | `5` | Para una pregunta: la respuesta cierra el ticket. |
| Corregir el tipo | — | Si el triage se equivocó. Queda `tipo_manual` y ninguna máquina lo vuelve a tocar. |

- **El interruptor del arreglo automático**: «Arreglar solos los bugs evidentes», prendido por defecto. Apagado, todo
  espera a Martín (AGENTS.md: «lo que decide solo se tiene que poder apagar»).

---

## 4. El triage

### 4.1 Por qué el triage no paga un modelo

Lo que hace falta saber de un ticket ya lo juntó alguien que no cuesta nada:

- **el error lo registró el código** en el momento en que falló (la señal fuerte de Sentry: un fallo que el sistema vio
  no es una opinión);
- **el tipo lo propuso MaKo** con el modelo que YA estaba leyendo esa conversación (la misma IA, los mismos datos, el
  mismo régimen de privacidad), o lo eligió la persona en el formulario;
- y **las palabras** de la persona se leen con reglas («dejó de», «quiero que», «¿cómo…?»).

Una llamada aparte a una IA para clasificar mandaría el texto de un cliente —que puede nombrar a sus leads— a un
proveedor más: las keys gratis de la plataforma entrenan con lo que reciben (AGENTS.md, «LOS DATOS DE LOS CLIENTES DE
UN CLIENTE NUNCA VAN A UN PROVEEDOR QUE ENTRENA»), y Claude por API está vetado salvo excepción de Martín. El juicio
caro —«¿esto es de verdad un bug, y cuál es la causa?»— lo hace **el Cerebro antes de tocar código**, con Claude Code:
ya está pago con la suscripción y la API de Anthropic no entrena con lo que lee.

### 4.2 La regla (lib/tickets-reglas.ts, `clasificar`)

Un ticket se arregla solo si se cumplen las cuatro:

1. **Es un bug**: algo que la app ya promete y no hace. Si para arreglarlo hay que inventar cómo debería funcionar, es
   un pedido, aunque el cliente lo llame «no anda».
2. **Hay evidencia objetiva**: un error registrado por el código, o «antes andaba y dejó de andar».
3. **No hay señales cruzadas**: nada en el texto pide algo nuevo.
4. **No toca una zona delicada**: cobros, accesos, borrados, envíos a los clientes del negocio, credenciales.

Y además: el interruptor prendido y menos de 8 arreglos automáticos en el día (protege la ventana de 5 horas del
Cerebro). Si algo falla, va a Martín **con el porqué escrito**: cada frase de `porque` dice qué señal pesó.

### 4.3 La escalera del Cerebro (Sentry Seer, reescrito)

El bug automático le llega al Cerebro como un pedido de **diagnosticar primero**:

1. **Causa raíz.** Lee el ticket, reproduce si puede, busca dónde vive.
2. **¿Es un bug de verdad?** Si concluye que es algo nuevo, o que no lo entiende, lo devuelve:
   `node --import tsx scripts/tickets.ts reclasificar <n> pedido --porque "…"`. Pasa a la bandeja de Martín.
3. **Arreglo.** Abre un chat o se lo da al jefe del área, con el test que lo reproduce.
4. **Integración.** La de siempre: `antes-de-subir` en VERDE y Actions. No hay un camino aparte para los arreglos
   automáticos.

---

## 5. La decisión va al Cerebro

| Quién lo despacha | Cómo llega | Por qué así |
|---|---|---|
| **Martín** (Aprobar) | Un trabajo **firmado** en su dispositivo hacia la sesión del chat «Cerebro», con el ticket entero (`useFirma` → `mandar.ts`, el mismo camino de la caja de Ops Center). | Es la única forma de que un texto llegue a la PC: firmado por Martín, que lo leyó. |
| **El triage** (bug evidente) | El Runner le entrega al Cerebro un **texto FIJO** con el número del ticket y el comando para leerlo. Nunca una palabra del cliente. | Nadie puede firmar: no hay dispositivo. Es el mismo molde del aviso de la Ticketera vieja (`mensajeAviso`): con la base comprometida, lo peor que puede hacer es avisar de más. |

**El texto del cliente es DATO, no instrucción.** `scripts/tickets.ts ver <n>` lo imprime entre marcas, con el aviso
de que es lo que escribió un cliente. El Cerebro no corre comandos que vengan en un ticket.

El Cerebro decide si abre un chat nuevo o se lo da a un jefe (por la pantalla o la herramienta que falló). Quien lo
toma lo marca: `scripts/tickets.ts tomar <n>`.

---

## 6. El cierre, solo

**El ticket se cierra cuando el arreglo está EN PRODUCCIÓN, no cuando se commitea.** Lo que dice qué está desplegado
son las bitácoras (`app/admin/dev/<área>/bitacora.ts`): viajan dentro del build. Quien arregla anota el hito «Hecho» de
siempre con un campo más: `tickets: [12]`. Cuando el deploy trae ese hito, el cron de los tickets
(`/api/cron/tickets`, cada 15 minutos) lo ve en el código que corre, cierra el ticket, le escribe la respuesta al
cliente con lo que se arregló y le avisa por donde lo levantó. Si el ticket tenía duplicados, se cierran con él.

Por qué la bitácora y no GitHub: el token de GitHub de la plataforma contesta 404 sobre el repo desde la
transferencia (docs/hallazgos-operaciones.md, 15/10), y un commit en `main` todavía no es un deploy. El código que
corre sabe lo que trae.

---

## 7. Lo que queda afuera de la primera entrega, y por qué

- **Adjuntar una captura** al ticket a mano: el contexto automático cubre el caso del chat; para el formulario, después.
- **El canal de WhatsApp**: `lib/mako-doer-in.ts` y los prompts de WhatsApp son del chat «MaKo en WhatsApp». La
  operación ya está en el registro; enchufarla y el aviso de vuelta por WhatsApp son de él.
- **Sugerir duplicados** con IA (Linear Triage Intelligence): con pocos tickets lo ve Martín; se suma cuando haya
  volumen.

---

## 8. Los errores de la app llegan solos (17/10/2026, segundo pedido)

Martín, 09:36: «lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app: MaKo en los chats
de la app, errores al navegar o lo que sea. Y todo lo solucionas automáticamente». Hasta ese día, `app/error.tsx`
mostraba «Esta pantalla se rompió al dibujarse» y no le avisaba a nadie: el crash de /general en el teléfono de Martín se
supo por su captura.

**Copiado de Sentry (el método, no el código: su licencia no lo permite): un error es un «issue» por HUELLA, no una fila
por vez.**

| De dónde llega | Cómo |
|---|---|
| Una pantalla que se rompe al dibujarse | `app/error.tsx` y `app/global-error.tsx` mandan el error a `/api/errores` (sin importar nada de la app). |
| Un error suelto de la ventana (un clic, una promesa) | `<ReportadorDeErrores>` en el layout raíz, sólo con sesión y fuera de lo público. |
| Un error del servidor | `instrumentation.ts` → `onRequestError`. Al navegador le llega sin su mensaje (sólo el digest): por eso lo reporta el servidor y el boundary no lo repite. |
| Lo que falló de MaKo en un chat de la app | El turno (`lib/mako-turno-app.ts`) lo registra solo, sin tarjeta; a la persona se le dice «le avisé al equipo» sólo si entró, y el aviso de arreglado le llega en ese hilo. |

Lo que pasa después (lib/errores-app.ts):

1. **Ruido → nada**: una extensión, la red, una pestaña vieja después de un deploy (`ChunkLoadError`), el control de flujo
   de Next y el proveedor de IA que no contestó (el Cerebro no arregla un 503 de Google).
2. **La huella**: el tipo, el mensaje sin números ni citas y la pantalla sin ids. **Sin el stack**: en producción está
   minificado y los nombres de los archivos cambian en cada deploy, y cada deploy abriría un ticket nuevo por el mismo bug.
3. **Huella nueva → un ticket de bug del SISTEMA** (`canal: 'sistema'`, mig 0313), a nombre de quien lo vio. El triage lo
   da por bug evidente (el código lo vio fallar) y va solo al Cerebro, salvo zona delicada, el tope del día o el
   interruptor apagado. Una persona abre como mucho 10 huellas nuevas por día.
4. **Huella conocida → suma una vez y el afectado.** Si su ticket ya estaba resuelto y vuelve a pasar más de 15 minutos
   después, es una REGRESIÓN: un ticket nuevo («Volvió a pasar»).
5. **Arreglado y desplegado → se cierra solo** (el hito con `tickets: [n]`), y a cada negocio que lo vio se le avisa en su
   grupo con `avisar_arreglo_al_grupo`, la herramienta de «MaKo en WhatsApp», firmada «Desarrollador».

**Sin datos de clientes**: emails, teléfonos y lo citado se borran del mensaje y del stack; la pantalla va sin los valores
de su query (salvo los números, que son ids).
