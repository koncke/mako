# Subir creativos a campaña existente

`2026-07-31 02:57` → `2026-08-01 00:54` · 8 mensajes de Martín · 117 respuestas de Claude · sesión `2da0bd61`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-31 02:57`

En plan de super admin, hay una tarea urgente que es que Mauricio y en general, todos puedan subir sus creativos en una campaña existente, hoy en día solo se puede subir como nueva campaña. Implementa esa funcionalidad.

### Claude

Voy a implementar la subida de creativos a campañas existentes en el Ads Manager. Primero exploro el código actual del flujo "Nueva campaña" y las escrituras a Meta para entender qué infraestructura ya existe.

### Claude

Ahora el grueso: el wizard `NuevaCampanaModal` en modo "campaña existente". Son varias ediciones puntuales.

### Claude

Ahora la publicación en lote para el modo existente:

### Claude

Sigo con el render: chips, pasos nuevos de campaña/conjunto, destino adaptado, textos y el componente de lista.

### Claude

Ahora agrego el componente de lista de campañas/conjuntos, los helpers de nomenclatura y adapto `Revision` para el modo fijo:

### Claude

Falta el punto de entrada en `CampanasBrowser`: el botón nuevo y pasar `health`/`modo` al modal.

### Claude

Typecheck:

### Claude

Otro server ya debe estar en el 3000; agrego una configuración en otro puerto para esta sesión y levanto el preview:

### Claude

El server levantó en el puerto 56998. Busco la ruta de dev-login para auto-loguearme:

### Claude

Llegó y logueó como ws1 (Mauricio). Verifico la toolbar del Ads Manager:

### Claude

La cookie `mako_ws` (impersonación a Leandro) está pisando mi `ws=1`. Salgo de esa vista — es un click reversible:

### Claude

La impersonación a Leandro sigue activa. Intento de nuevo salir de la vista:

### Claude

El click no limpia la cookie. Busco el endpoint que la borra y lo pego directo:

### Claude

/ads-manager carga como Mauricio y el botón nuevo está en la toolbar. Espero a que cargue Meta y abro el wizard:

### Claude

El botón se clickea pero el modal no aparece. Reviso la consola por errores del chunk dinámico:

### Claude

Paso de creativos OK con los chips de campaña y conjunto. Elijo un ganador:

### Claude

Typecheck tras el fix:

### Claude

Mientras espera la revisión, dejo la memoria del feature escrita:

### Claude

10 verificadores siguen corriendo. Miro los hallazgos crudos de los 4 finders para ir evaluando:

### Claude

Sigo con el resto de los fixes:

### Claude

Ahora el server (validaciones + objective). Antes verifico que `health` traiga `objective` en campañas:

### Claude

`objective` viene en el health. Aplico las validaciones del server:

### Claude

Mientras terminan los verificadores, re-verifico en el browser que los fixes no rompieron nada (HMR ya los levantó):

### Claude

Modo "Nueva campaña" intacto. Cierro y reviso el estado final de la revisión:


---

## Martín

`2026-07-31 03:34`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\plan-tareas

# Plan de tareas de MaKo (board /plan)

El board del super-admin vive en **Supabase** (`plan_tareas` / `plan_proyectos`, mig 0093),
en **su propio workspace** (el que tiene `capa='superadmin'`; Mauricio/ws1 usa otro board,
`experimento_tareas`, y NO es este). El viejo puente localStorage + `mako.plan.inbox/ops/
snapshot` **está muerto**: no lo uses.

## LA REGLA (no negociable)

**Todo origen que carga tareas pasa por el MISMO proceso**: se resuelve lo deducible →
se preguntan los HECHOS que faltan → **el Perro Guardián puntúa**. Da igual si viene de
WhatsApp, de Fathom, de un archivo o de Claude Code.

⛔ **NUNCA hagas `insert into plan_tareas`.** Saltea las preguntas, el Perro, la checklist
y la descripción del proyecto — y deja una tarea con prioridad inventada por vos.
✅ **Creá una PROPUESTA** (`plan_propuestas`) y pasale el link. La app corre el wizard y el
Perro con las credenciales del dueño (que vos no tenés: se descifran con
`CREDENCIALES_SECRET`, que solo vive en Vercel).

## 1. Revisá el plan ANTES de trabajar

Leé directo de la base (read-only). Resolvé el workspace por capa, no lo hardcodees:

```js
// node --experimental-strip-types, con dotenv sobre .env.local (apunta a PROD)
const [{ id: ws }] = await sql`select id from workspaces where capa = 'superadmin' limit 1`;
const tareas = await sql`select num, title, score, priority, progress, deadline
                         from plan_tareas where workspace_id = ${ws} and progress < 100
                         order by score desc limit 60`;
const proys  = await sql`select pid, name, score from plan_proyectos
                         where workspace_id = ${ws} order by score desc`;
```

- Si lo que vas a hacer **ya está** en la lista → NO dupliques: continuá esa tarea.
- Si hay **ALTA** (score ≥ 75) o **vencidas** relacionadas con tu trabajo, mencionáselas.

## 2. Proponé tareas nuevas (borrador + link)

Insertá UNA fila en `plan_propuestas` y entregá el link `/plan/revisar/<id>`:

```js
await sql`insert into plan_propuestas (id, workspace_id, estado, origen, resumen, tareas, notas, eliminar)
          values (${id}, ${ws}, 'pendiente', 'claude-code', ${resumen},
                  ${sql.json(tareas)}, ${sql.json(preguntas)}, ${sql.json([])})`;
```

- `tareas`: `[{ titulo, proyecto, detalle, deadline? }]`. **No mandes `prioridad`**: la decide
  el Perro. `proyecto` = el NOMBRE exacto de un proyecto existente (mirá `plan_proyectos`)
  para no duplicarlo; si no existe, se crea con ese nombre.
- `notas` = las **preguntas** `[{ pregunta, tipo, opciones }]`. **Mandá al menos una**:
  sin preguntas el wizard aplica con `contexto=''` y el Perro puntúa a ciegas.
- `eliminar`: `[{ id, motivo }]` si esta carga deja tareas viejas obsoletas o duplicadas.

### Las preguntas (mismas reglas que MaKo)

Son para **sacarle CONTEXTO al dueño y que EL PERRO decida**, nunca para que él elija la
prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en plata y
  en cuánto, qué sería "listo", si es 1 tarea o varias.
- Si la respuesta es obvia o se contradice con lo que ya sabés, **no la preguntes**.
- **Variá el formato** eligiendo el mejor para cada una:
  `multi` (varias válidas a la vez — sin opción "Ambas/Todas", que tilde varias) ·
  `opcion` (excluyente) · `escala` (1-5) · `comparacion` (A vs B).
  **Nada de preguntas abiertas**: siempre con opciones para tocar.

## 3. Entregá el link ENTERO (o abrilo) y pará

⚠️ **Nunca pases un path suelto** (`/plan/revisar/<id>`): no es clickeable y obliga a
armarlo a mano. Pasá **la URL COMPLETA**, y si podés, abrila directamente.

```js
const APP_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');
const link = `${APP_URL}/plan/revisar/${id}`;   // ← esto es lo que se entrega
```

(Es el mismo `APP_URL` que usa `lib/mako-doer-acciones.ts` para los links de WhatsApp:
mantené UNA sola forma de armarlo.)

Él contesta de a una, aplica, y recién ahí el Perro puntúa, describe los proyectos nuevos
y arma las checklists. **No insertes nada más.**

## Cuidados

- **Escribe en PROD** (`.env.local` apunta a prod). No lo uses para pruebas; si probás,
  borrá la propuesta después (`delete from plan_propuestas where id = ...`).
- El **historial** es obligatorio para lo que toca la IA/el agente: la propuesta ya entra con
  `origen: 'claude-code'` y `aplicarPropuesta` estampa la fuente en cada tarjeta.
- Para el board de un **cliente** (no el super-admin) el camino es `lib/todo`
  (`experimento_tareas`). Se aplica solo: `aplicarPropuesta` detecta el workspace y manda
  al board que corresponde, y desde jul-2026 el cliente TAMBIÉN recibe al Perro
  (`priorizarNuevasCliente`, lib/todo-guardian.ts).
- Esta skill es la versión "de adentro" (habla con la base porque corre en la máquina del
  dev). La que instala un **cliente** en SU Claude Code sale de /integraciones → "Tu agente"
  y habla por `/api/agente/plan` con un token; el texto vive en `lib/agente-skill.ts`.
  Si cambiás las reglas de acá, cambialas también allá.

### Claude

Falta un solo agente. Espero la notificación del cierre del workflow.

### Claude

Extraigo los veredictos ya emitidos correlacionando por label del agente:

### Claude

El workflow terminó (54 agentes, 0 errores). Leo la lista completa de confirmados para ver qué queda sin arreglar:

### Claude

Último smoke en el browser tras los fixes finales:

### Claude

Listo. La funcionalidad está implementada, revisada, verificada en el navegador y pusheada a producción.

## Qué se puede hacer ahora

En **/ads-manager** hay un botón nuevo junto a "Nueva campaña": **"⬆ Subir creativos a una campaña"**. Abre el mismo wizard de MaKo pero para una campaña que ya corre: Mauricio elige la campaña de una lista (con su semáforo de estado; las archivadas no aparecen), elige el conjunto, sube varios creativos (o reusa un ganador), MaKo escribe el copy de cada anuncio, lo revisa y los anuncios se agregan **en pausa**. La campaña no se toca: mismo ID, público, presupuesto y configuración — exactamente el criterio de "listo" de la tarea #218 del board, que salió de la llamada con Mauricio del 30/7.

Un dato que descubrí en el camino: el bloqueo nunca fue de permisos (Mauricio es admin del workspace dueño y pasa todos los guards). El "+ anuncio" por fila existía desde el 30/6, pero escondido en la tab Conjuntos y de a un creativo, sin MaKo. Lo que faltaba era este flujo.

## Cómo quedó por dentro

- [NuevaCampanaModal.tsx](dashboard-marketing/app/ads-manager/NuevaCampanaModal.tsx) ganó el modo `existente` (pasos campaña → conjunto → creativos → destino → revisión); si todos los creativos son ganadores reusados, el paso de destino y el gasto en MaKo se saltean solos.
- [ad-add/route.ts](dashboard-marketing/app/api/ads-manager/ad-add/route.ts) ahora acepta un lote `{ads: [...]}` (tope 20, secuencial por el rate-limit de Meta) y persiste el registro en `meta_campaign_drafts` vinculado por `meta_campaign_id` — el punto "guardar en la base" del checklist. El modo simple del "+ anuncio" quedó intacto.
- Los nombres siguen la nomenclatura del conjunto (001.01.c → .d…) continuando desde el máximo existente.

## Verificación

- Corrí un workflow de revisión adversarial (54 agentes: 4 revisores + verificación cruzada de 25 hallazgos). Los 10 confirmados quedaron arreglados: race al re-elegir conjunto rápido, subidas a medias que se perdían en silencio, copy de ganadores que se editaba y se descartaba, reintento tras fallo parcial que duplicaba anuncios (ahora el spec descarta los ya creados), error de Meta visible en vez de "Cargando…" eterno, y validación del `source_ad_id` (que también tapaba un hueco preexistente del modo simple).
- Probé el flujo en vivo logueado como Mauricio, justo sobre la campaña **029**: selector → conjunto "029.01 Adquisición" → ganador → revisión con "Agregar en pausa". El modo "Nueva campaña" sigue funcionando igual.
- Typecheck OK, push a main (`f2088d4`) con el hook de tipos en verde.

## Lo que falta (a propósito)

- **No publiqué ningún anuncio real**: no quise crear anuncios en la cuenta de Mauricio sin aviso, aunque salgan en pausa. El último ítem del checklist ("Probar la publicación") quedó abierto — es apretar "Agregar en pausa" una vez con un creativo de prueba y borrarlo. La tarea #218 quedó actualizada en el board (5/6 ítems, progreso 85%, con el historial estampado).
- Limitación conocida (compartida con el "+ anuncio" de siempre): conjuntos de mensajería (click-to-WhatsApp) piden URL igual y Meta rechaza con su error al publicar; no se corrompe nada, pero si esas campañas se vuelven frecuentes conviene detectar el `destination_type` del conjunto.


---

## Martín

`2026-07-31 13:53`

Continue from where you left off.

### Claude

No response requested.


---

## Martín

`2026-07-31 13:56`

Hay una tarea en plan, que me gustaría resolver...
Siempre que publico algo desde MaKo, meta no me lo permite publicar, tengo que entrar a Meta, al anuncio y salta un mensaje de seguridad, y ahí tengo que aceptar eso y publicarlo manualmente en Meta...

Eso es muy malo para la experiencia de usuario, investiga si se puede solucionar e implementemos

### Claude

Voy a investigar esto a fondo. Ese mensaje de seguridad de Meta tiene causa técnica identificable — arranco leyendo el contexto propio del repo y la tarea en el plan.

### Claude

La tarea es la **#217** del board (score 75): *"Averiguar cómo omitir la aprobación manual de seguridad de Meta al publicar con Mako"*. Antes de investigar a ciegas, voy a leer el mensaje **exacto** que Meta devuelve en tus anuncios — la solución depende de cuál de sus varios checks de seguridad es.

### Claude

Ahí está la causa exacta. Meta devuelve **error_code 2446984**:

> *"We want to make sure it's really you publishing this ad... **Trusted users and owning Business Admins on this account needs to approve these ads first.** We already emailed them..."*

Es el check "Trusted Users" de Meta, no una revisión de contenido. Lanzo investigación multi-agente sobre ese código específico mientras sondeo la cuenta en vivo.

### Claude

Mientras el equipo investiga, sondeo la cuenta real para separar hipótesis: ¿le pasa solo a lo creado por la API, o a todo?

### Claude

Dato decisivo: de **146 anuncios, solo 2 tienen el issue** — y hay anuncios de MaKo del mismo día ya activos. Eso confirma que el check salta en **cada anuncio nuevo** y los viejos están activos porque los aprobaste a mano. Sondeo el business y el System User:

### Claude

**Pista fuerte**: el System User que usa MaKo (`Dashboard`) tiene rol **EMPLOYEE**, no ADMIN — y el mensaje de Meta dice literalmente que hacen falta *"Trusted users and owning Business **Admins**"*. Confirmo eso y descarto que exista API:

### Claude

Confirmado el patrón: los tres anuncios del 30/07 se crearon con 5 segundos de diferencia y solo el primero quedó ACTIVE — los otros dos siguen esperando tu aprobación. Y el business **ya está verificado**, así que esa hipótesis queda descartada.

Encontré además un bug de copy concreto mientras reviso el código:

### Claude

Ese copy es el problema de raíz del lado de MaKo: le dice **"No tenés que hacer nada más, solo esperar"** — copiando el *"you don't need to do anything else"* de Meta. Pero el admin que debe aprobar **sos vos**. MaKo le está diciendo "esperá" justo a quien tiene que actuar.

Veo dónde se muestra para diseñar el fix:

### Claude

Ya tengo el mapa del lado del producto. Reviso el motor de avisos para enganchar la solución donde corresponde:

### Claude

Reviso avance de la investigación:

### Claude

Sigue corriendo. Aprovecho para agotar empíricamente la vía API sobre un anuncio trabado real:

### Claude

Confirmo un dato clave de primera mano: el anuncio trabado está en **`configured_status: PAUSED`** y aun así ya arrastra el issue — el check de Meta se dispara **al crear**, no al activar. Y agoté las vías de API: `/confirm`, `/approve`, `/review`, `/appeal`, `/ad_review` **no existen**, así que aprobar por API está descartado empíricamente.

Espero la síntesis de la investigación web.

### Claude

Mientras corre, te adelanto lo que ya está **verificado de primera mano** contra tu cuenta real (esto no depende de la investigación web):

**El error es el 2446984 de Meta** — un check de identidad, no de contenido. El texto dice que hacen falta *"Trusted users and owning Business Admins"* para aprobar.

Tres hallazgos que acotan mucho el problema:

1. **No es falta de verificación**: tu Business Manager "Elévate" figura `verification_status: verified`. Esa hipótesis queda descartada.
2. **El System User que usa MaKo (`Dashboard`) tiene rol `EMPLOYEE`, no `ADMIN`** en el business — aunque sobre la cuenta publicitaria sí tenga `MANAGE`. Meta pide aprobación de un *Business Admin*, y el que publica no lo es. Es la hipótesis más fuerte de causa raíz.
3. **Aprobar por API está descartado**: probé `/confirm`, `/approve`, `/review`, `/appeal` y `/ad_review` sobre un anuncio trabado real y ninguno existe. Tampoco existen `trusted_users` ni `security_settings` como edges. Meta no expone esto.

Y encontré un **bug de producto** que explica por qué la experiencia se siente tan mala: cuando pasa esto, MaKo te muestra *"No tenés que hacer nada más, solo esperar la aprobación"* ([meta-health-ui.ts:129](dashboard-marketing/lib/meta-health-ui.ts:129)). Copia literal del *"you don't need to do anything else"* de Meta — que asume que quien publica y quien aprueba son personas distintas. En tu caso **sos vos**, así que MaKo te dice "esperá" justo cuando tenés que ir a aprobar. El anuncio se queda ahí hasta que lo descubrís por tu cuenta.

Un detalle que cambia el diseño: de tus 3 anuncios del 30/07 creados con 5 segundos de diferencia, `029.01.g` quedó ACTIVE y `.h`/`.i` siguen trabados — están **en pausa y ya marcados**, o sea que el check salta al *crear*, no al activar.

Espero la síntesis para decirte si el check se puede apagar de raíz en Meta y con qué certeza, y ahí implementamos.

### Claude

La investigación encontró la fuente oficial. Leo el detalle completo:

### Claude

Investigación sólida: encontraron la fuente oficial. El mecanismo se llama **"Peer approval"** (Meta Business Help Center, artículo 529947753306370), leído en vivo con navegador. Mientras se completa la verificación, leo el código que voy a tocar:

### Claude

Ya tengo lo necesario para implementar. Verifico si la síntesis final está lista:

### Claude

Implemento mientras terminan de verificar. Primero necesito exponer el `error_code` (hoy `parseIssues` lo descarta) y el id de cuenta para el deep link:

### Claude

Ahora implemento. Primero el tipo `Issue` con el código de error y los helpers de detección y deep link:

### Claude

Ahora expongo el id de cuenta para el deep link y propago el código en el otro parser:

### Claude

Ahora el botón "Aprobar en Meta" en el modal de problemas, que hoy solo ofrece "Editar textos" (inútil para este caso):

### Claude

El typecheck pasa. Ahora la pieza de mayor impacto: **que MaKo te avise al publicar**, en vez de decir "listo" y que te enteres días después. Agrego la consulta de estado:

### Claude

Ahora conecto el aviso en la pantalla final del wizard:

### Claude

Ahora la pantalla de éxito, para que no cante "listo" cuando Meta retuvo los anuncios:

### Claude

Typecheck limpio. Verifico el endpoint nuevo contra los anuncios trabados reales:

### Claude

La detección funciona contra los anuncios reales. Verifico la UI en el navegador:

### Claude

Los agentes de investigación tienen tomadas las pestañas. Espero a que terminen antes de verificar la UI para no interferir con ellos:

### Claude

Mientras tanto, dejo registrado el hallazgo en memoria, que es información difícil de reconstruir:

### Claude

Te adelanto la conclusión de fondo, que ya está firme:

**Sí se puede mejorar mucho, pero no eliminar del todo por API.** El check se llama **"Peer approval"** y es un control de identidad de Meta. La documentación oficial dice textualmente que el nivel base *"está incluido en todos los niveles de protección"* — no existe un "off" total. Y confirmé de primera mano que **no hay ningún endpoint para aprobar**: probé `/confirm`, `/approve`, `/review`, `/appeal` y `/ad_review` sobre tus anuncios trabados y ninguno existe.

Pero hay tres cosas accionables, y una puede resolverte el 100% del problema:

1. **"Block CTX ads"** (Security Center → Peer approval): si ese toggle está prendido, **todos** los anuncios click-to-WhatsApp/Messenger/Instagram de tu negocio requieren aprobación, siempre. Siendo MaKo un producto de leads por WhatsApp, es el sospechoso número uno. Se apaga con un clic.
2. **Domain security**: si tenés dominios de confianza cargados y tus landings no están en la lista, cae todo lo que publiques.
3. **El System User de MaKo es `EMPLOYEE`**, y la doc dice que *"los anuncios publicados por personas con control total del portfolio no requieren segunda revisión"*. Subirlo a admin es la palanca más prometedora — **pero ojo**: un token de admin controla todo el business, así que como patrón para tus clientes multi-inquilino empeora el riesgo si se filtra. Probalo en tu business, no lo hagas default.

Mientras tanto ya implementé y verifiqué contra tus anuncios reales:

- **Corregí un copy que te mentía**: MaKo decía *"No tenés que hacer nada más, solo esperar"* — copiado del mensaje de Meta, que asume que quien publica y quien aprueba son personas distintas. Ahora dice que tenés que aprobarlo vos y te da el botón.
- **Aviso al publicar**: el wizard consulta el estado y, si Meta los retuvo, muestra "⚠ Meta pide que los apruebes" con link directo — en vez de cantar "listo" y que te enteres días después.
- **Botón "Aprobar en Meta ↗"** en el modal de problemas (antes solo ofrecía "Editar textos", inútil acá).
- Detección por `error_code` en vez de por texto en inglés, y se guarda el `mid` que Meta pide para abrir un caso con soporte.

Espero la síntesis final para pasarte el checklist exacto de Meta y verificar la UI en el navegador.

### Claude

La síntesis llegó y **corrige algo que te dije**: la hipótesis del System User admin tiene evidencia en contra. Leo el resto y ejecuto yo mismo el "Paso 0" del diagnóstico:

### Claude

Ahora tengo el cuadro completo, y **dos cosas que te dije quedan corregidas**. Ejecuté el diagnóstico yo mismo: tus anuncios van a `multiplicatusresultados.com` con CTA "Más información" — **no son click-to-WhatsApp**, así que "Block CTX ads" no es la causa. Corrijo la memoria:

### Claude

Ahora verifico la UI en el navegador:

### Claude

El server murió. Lo levanto:

### Claude

Cargó con los datos reales. Ahora abro el modal de problemas de la campaña 029 para ver el fix:

### Claude

Funciona end-to-end sobre tus datos reales: detecta el anuncio, muestra el copy corregido y el botón lleva al anuncio exacto en Ads Manager. Verifico el endpoint nuevo y hago commit:

### Claude

Actualizo la tarea #217 con el resultado de la investigación:

### Claude

Investigado, implementado, verificado contra tu cuenta real y pusheado (`bab6f06`).

## La respuesta corta

**No se puede eliminar del todo, y no es culpa de la configuración.** El mecanismo se llama **"Peer approval"** y la documentación oficial de Meta dice textualmente que el nivel base — *"solo los anuncios sospechosos requieren aprobación"* — **está incluido en todos los niveles de protección**. No existe un "off". Por debajo hay un detector automático de Meta que nadie apaga.

Y verifiqué de primera mano que **no hay salida por API**: probé `/confirm`, `/approve`, `/review`, `/appeal` y `/ad_review` sobre tus anuncios trabados; ninguno existe. La configuración del Security Center tampoco es legible por API. MaKo puede detectar y guiar, nunca resolver solo.

## Dos cosas que te dije antes y quedaron corregidas

- **"Block CTX ads es el sospechoso número uno"** → **falso**. Revisé tus creativos: van a `multiplicatusresultados.com` con CTA "Más información", no son click-to-WhatsApp. Ese toggle no aplica.
- **"Subir el System User a admin es la palanca más prometedora"** → la evidencia apunta **en contra**: Meta desaconseja explícitamente usar el admin system user para acceder a activos, hay un tope de **1 admin por Business Manager** (inviable para tus clientes: cada uno quemaría su único admin en el token de MaKo), y la doc modela al aprobador como humano. No lo hagas.

También se refutó un mito caro: **no muevas la app al Business Manager**. Ya tiene que estar reclamada para poder emitir el token, y transferirla puede romper el token que hoy funciona.

## Lo que sí conviene revisar (una vez, 5 minutos)

En **Business Suite → Configuración → Centro de seguridad → Peer approval**. Lo más probable es que esté todo en default y no haya nada que bajar, pero descarta lo barato:

1. **Domain security** — el candidato real en tu caso, porque tus anuncios llevan URL. Si hay dominios de confianza cargados y `multiplicatusresultados.com` no está, cae **todo** lo que publiques. Se arregla agregándolo o vaciando la lista.
2. **"Ad account security"** — si figura *Extra protection*, bajalo a *Default*.
3. Aprovechá para designar **más de un aprobador** (ojo: quien lleva 90+ días sin actividad en la cuenta no es elegible).

## Lo implementado

- **El copy que te mentía**: decía *"No tenés que hacer nada más, solo esperar"* — copiado del mensaje de Meta, que asume que quien publica y quien aprueba son personas distintas. Ahora te dice que el admin sos vos y te da el botón.
- **Aviso al publicar**: el wizard consulta el estado y, si Meta retuvo los anuncios, muestra "⚠ Meta pide que los apruebes" en vez de cantar "listo".
- **Botón "Aprobar en Meta ↗"** que abre el anuncio exacto (verificado: abre `029.01.i` directo).
- Detección por `error_code` con fallback por texto (2446984 no está documentado, puede cambiar) y se guarda el `mid` para abrir caso con soporte.

Probado en vivo: detecta tus 2 anuncios trabados (`029.01.h` y `.i`) y el link resuelve al anuncio correcto.

**Lo que dejé sin hacer** y es el siguiente paso natural: guardar en el onboarding quién es el aprobador (email/teléfono) para que MaKo le avise por WhatsApp cuando esto pase — no se puede sacar por API, `assigned_users` no devuelve ni nombre ni contacto. Y un pre-flight que compare el dominio de destino contra los dominios declarados antes de publicar. Decime si querés que siga por ahí.


---

## Martín

`2026-07-31 14:56`

1. Si, quisiera que avise por WhatsApp cuando pase eso, con el link exacto
2. Y también si hay forma de configurar para bajar la protección de Meta, dejarlo como tutorial en el mensaje de "Aprobar en Meta ↗"

### Claude

Las dos cosas tienen sentido. Empiezo leyendo el motor de avisos y su catálogo de voz:

### Claude

Ahora agrego el aviso al catálogo y lo emito. Primero la entrada de voz:

### Claude

Ahora emito el aviso al detectar. Lo hago en el endpoint, que es donde ya se detecta, con dedup para no repetir en los reintentos:

### Claude

Ahora paso el nombre de la campaña desde el wizard para que el aviso diga dónde:

### Claude

Ahora el tutorial. Lo hago como componente compartido para usarlo en los dos lugares:

### Claude

Lo conecto en los dos lugares donde aparece el botón:

### Claude

Typecheck limpio. Verifico el tutorial en la UI — **sin** llamar al endpoint, para no dispararte un WhatsApp real todavía:

### Claude

Todo renderiza bien. Commit y push:

### Claude

Las dos cosas están hechas y pusheadas (`d9b6ffd`).

## 1. Aviso por WhatsApp

Cuando MaKo publica y Meta retiene los anuncios, ahora te llega al grupo un mensaje así, con el link exacto:

> 🟡 Publiqué **2 anuncios** en "029. Capta Dueños B2B" pero **Meta los retuvo**: por seguridad pide que un admin de la cuenta los apruebe a mano antes de que empiecen a correr.
>
> No lo puedo hacer yo — Meta no lo permite por API. Son 30 segundos:
>
> 👉 `https://adsmanager.facebook.com/adsmanager/manage/ads?act=...&selected_ad_ids=...`
>
> Entrás, tocás *Revisar y publicar* y confirmás. Si no, quedan sin entregar. — MaKo

Va por el choke point de siempre (`emitirAviso`), así que también queda en la campanita in-app. El link abre el anuncio exacto, no la lista. Tiene dedup de 10 minutos para que los reintentos del wizard no te manden tres mensajes iguales, y el wizard pasa el nombre de la campaña para que el aviso diga dónde fue.

## 2. Tutorial junto al botón

Debajo de "Aprobar en Meta ↗" hay un desplegable **"Cómo hacer que Meta lo pida menos"**, tanto en el modal de problemas como en la pantalla de publicación. Verificado que renderiza y abre.

Arranca con la verdad incómoda — **el nivel base no se puede apagar** — y después lista los cuatro filtros que sí podés revisar una sola vez: nivel de protección de la cuenta, dominios de confianza, "Bloquear anuncios CTX" y países, más cómo sumar aprobadores (con el detalle de que quien lleva 90 días sin actividad no es elegible). Cierra aclarando que MaKo no puede confirmarte si quedó bien, porque Meta no expone esa configuración por API.

Preferí eso a prometer un interruptor mágico: te ahorra la tarde buscando algo que no existe.

## Una cosa que no hice sin preguntarte

**No disparé un WhatsApp de prueba.** El endpoint ya lo emite si se lo llama con tus anuncios trabados (`029.01.h` y `.i`), así que puedo mandarte uno real ahora mismo para que confirmes que llega y que el link te abre el anuncio correcto — pero es un mensaje de verdad a tu grupo, y preferí que lo decidas vos. ¿Lo disparo?

Si preferís probarlo natural, sale solo la próxima vez que publiques algo desde MaKo.


---

## Martín

`2026-07-31 15:03`

También revisa bien la nomenclatura de los anuncios, las campañas, los adset... Hoy solo se pone nomenclatura dificil de entender, sería bueno que corra un analisis de que trata el anuncio o la transcripción ya que tenemos la transcripción de todo, y que setee el titulo de esa manera también.

Y que sea automatico siempre, tambien cuando se agrega un nuevo ad a una campaña existente, que veo que los que se agregaron los nombres no coincidieron con la nomenclatura anterior.

Revisa todas las nomenclaturas de todas las campañas, adset y anuncios y cambialos a todos. Sigue buenas practicas para nomenclar.

### Claude

Antes de tocar 222 entidades en tu cuenta real, necesito entender bien el terreno — sobre todo un riesgo que veo venir con los UTMs. Investigo lo que ya existe:

### Claude

Confirmo el riesgo: **los UTMs se arman con los nombres** (`utm_campaign={{campaign.name}}`). Necesito saber si el CRM cruza por nombre antes de renombrar nada:

### Claude

Encontré algo importante. Verifico el esquema antes de seguir:

### Claude

Tengo los datos clave. Relevo el estado real de los nombres y la cobertura de transcripciones:

### Claude

Ya tengo el diagnóstico. El problema real está en los **anuncios**: `029.01.g Anuncio` no dice nada, mientras las campañas y conjuntos sí están bien nombrados. Y confirmo tu observación del bug: el wizard de campaña nueva pone `029.01.a Anuncio 1` y el de campaña existente `029.01.g Anuncio` — sufijos distintos.

Antes de renombrar 222 entidades, lanzo investigación sobre buenas prácticas y riesgos:

### Claude

Mientras corre, verifico yo mismo el riesgo decisivo: si el cron de ingesta actualiza los nombres históricos o no.

### Claude

**Riesgo confirmado con dato duro**: el cron `meta-daily` procesa **solo el día de ayer** (`ayerEnTijuana()`) — borra e inserta ese día y nunca vuelve atrás. Mido el impacto exacto:

### Claude

Backfill viable: las 2.570 filas históricas tienen los tres IDs. Mido cuántos anuncios podrán tener nombre descriptivo real:

### Claude

Tengo los datos duros. Espero el diseño para no rehacer trabajo:

### Claude

Te adelanto lo verificado, porque **cambia lo que conviene hacer**:

**Renombrar campañas y conjuntos rompería tu tabla de Ads Manager.** El cruce de gasto/resultados se hace por **nombre** (`byCamp`/`byAdset` en CampanasBrowser), no por ID, y el cron `meta-daily` solo procesa el día de ayer — nunca actualiza los 10 meses de histórico. Si renombro las 29 campañas, la tabla pasa a mostrar **$0 de gasto y 0 resultados** en todas, porque el nombre vivo en Meta dejaría de coincidir con el guardado en las 2.570 filas históricas. Los anuncios no tienen ese problema: cruzan por `ad_id`.

Tiene arreglo: las 2.570 filas guardan `campaign_id`, `adset_id` y `ad_id`, así que se puede hacer un backfill de los nombres por ID. Lo voy a incluir, pero es la razón por la que **no voy a renombrar nada sin mostrarte antes la lista** — 222 escrituras a Meta no se deshacen con Ctrl+Z, y además los nombres viajan dentro de los UTMs de cada clic.

Sobre la materia prima para nombrar, la cobertura real es:

- **86 anuncios** tienen análisis completo (ángulo, gancho, formato, tags) — nombre descriptivo de calidad
- **59 anuncios no tienen nada** — pero en general son los viejos, que ya tienen nombre hecho a mano y bastante bueno (`EL TECHO INVISIBLE DE TU NEGOCIO`)
- Los que crea MaKo (`029.01.x`) caen justo en el grupo sin análisis: por eso quedan como "Anuncio"

Y hay una solución mejor de la que esperaba para el futuro: **el wizard ya analiza cada creativo al publicar** (`analyze-creatives` devuelve descripción y ángulo) — solo que hoy ese resultado se usa para escribir el copy y se tira para el nombre. Enganchando eso, un anuncio nuevo nace con nombre descriptivo sin depender de que después corra la transcripción.

Espero el diseño de la convención y sigo con la implementación.


---

## Martín

`2026-07-31 15:11`

Si entonces al cargar un anuncio en MaKo ya tenemos la transcripción, también deberíamos guardarla, justamente para evitarnos luego doble transcripción

### Claude

Muy buena observación, y encaja justo con lo del nombre descriptivo. Verifico qué pasa hoy exactamente:

### Claude

Tu observación es correcta y vale más de lo que parece. Hoy son **dos caminos distintos**: al subir, MaKo solo mira la *miniatura* con visión; la transcripción real la hace un cron al día siguiente, **volviendo a bajar el mp4 desde Meta** (de a 8 por corrida). Verifico si el archivo queda disponible al subir:

### Claude

El archivo **se borra del storage** apenas Meta lo procesa (líneas 50 y 60), así que hay que transcribir antes de ese punto. Verifico el esquema para saber dónde guardarlo:

### Claude

`ad_id` es PRIMARY KEY, así que no puedo guardar la transcripción antes de que el anuncio exista. Veo cómo transcribe hoy para reusar la lógica:

### Claude

Hay una función reutilizable (`transcribeMediaBuffer`). Diseño la solución: transcribir **en paralelo** mientras Meta procesa el video, así no suma espera. Veo el número de migración y el molde:

### Claude

Ahora implemento. Primero la migración:

### Claude

Migración aplicada. Ahora la lógica: transcribir al subir, **en paralelo** con el procesado de Meta:

### Claude

La firma toma `ArrayBuffer` y `mime`. Corrijo mi llamada:

### Claude

Ahora la otra mitad: al crear el anuncio, copiar la transcripción a `ad_transcripts` con su `ad_id`, para que el cron ya no la repita:

### Claude

Ahora lo engancho en los dos puntos donde nacen anuncios:

### Claude

Falta el tercer punto: `campaign-create` crea anuncios con su propio bucle. Lo engancho ahí también:

### Claude

Typecheck limpio. Confirmo que el cron efectivamente se saltea lo ya transcripto:

### Claude

Confirmado: el cron descarta los que ya tienen fila (`"Ya transcritos (cualquier status) → no reprocesar"`). Verifico la tabla nueva end-to-end antes de commitear:

### Claude

Bug cazado por la prueba: `onConflict: 'ad_id'` falla. La PK debe haber cambiado al agregar multi-tenant. Verifico:

### Claude

Confirmado: la migración `0057` cambió la PK a `(workspace_id, ad_id)`. Corrijo:

### Claude

El ciclo funciona. Verifico que el scoping multi-tenant se aplique solo (no paso `workspace_id` explícito):

### Claude

`TENANT_TABLES` decide qué se scopea. Si mi tabla nueva no está ahí, en multi-cliente todo caería en el workspace 1:

### Claude

`ad_transcripts` está en la lista pero mi tabla nueva no. La agrego para que se scopee sola:

### Claude

Commiteo esta pieza, que ya está verificada y es independiente:

### Claude

Hecho y pusheado (`05b1594`). Tenías razón, y el ahorro es mayor de lo que parecía.

**Lo que pasaba**: el video subía a Meta *pasando por nuestro storage*, y ahí se borraba. Al día siguiente, el cron volvía a **bajar el mismo mp4 desde Meta** para transcribirlo con whisper, de a 8 por corrida. Se pagaba dos veces el trabajo y el anuncio quedaba ~1 día sin texto — que es justamente por qué los anuncios que crea MaKo nacían como "Anuncio" a secas: al momento de nombrarlos no había nada que leer.

**Ahora**: se transcribe en la única ventana en que el archivo ya está en nuestras manos, justo antes de borrarlo, y **en paralelo con el procesado de Meta**. Como Meta tarda igual en procesar el video, la transcripción sale gratis en tiempo — el usuario no espera ni un segundo más.

La transcripción se guarda por `video_id` (lo único que existe antes de que el anuncio tenga `ad_id`) y al crear el anuncio se copia a `ad_transcripts` con su id. Ahí el cron la ve y la saltea sola. De paso quedó como **caché por video**: si reusás el mismo video en varios anuncios para testear ángulos, se transcribe una sola vez.

Enganché los tres puntos donde nacen anuncios (campaña nueva, +conjunto y +anuncio a campaña existente), y es best-effort de punta a punta: si whisper falla, subir el creativo no se rompe y el cron lo levanta mañana como siempre.

**Dos bugs que cacé probando contra tu base real**, y que habrían fallado en silencio:

1. `ad_transcripts` cambió su clave primaria a `(workspace_id, ad_id)` en la migración 0057 — mi upsert con `onConflict: 'ad_id'` era rechazado por Postgres. Lo detecté porque probé el ciclo completo en vez de confiar en el esquema original.
2. La tabla nueva faltaba en `TENANT_TABLES`: sin eso el proxy no la scopea y, con un segundo cliente, todas las transcripciones caerían en el workspace 1.

Sigo con la nomenclatura: el diseño de la convención está terminando de verificarse. Cuando llegue, implemento el naming descriptivo automático (que ahora sí va a tener transcripción disponible al instante) y te muestro la propuesta de renombrado para los 222 nombres antes de tocar nada en Meta.

### Claude

El diseño llegó, con decisiones bien fundadas. Leo el plan de implementación y renombrado:

### Claude

El diseño encontró algo grave que debo verificar antes que nada: dice que **la propagación de nombres a la base nunca funcionó**. Lo compruebo:

### Claude

**Confirmado, y ya causó daño real.** La propagación de renombres existe en el código pero solo hubo UPDATEs un único día (2026-06-20). Resultado: **4 campañas tienen dos nombres históricos distintos**, y eso esconde **MX$32.579 de gasto** del rollup por campaña — porque la tabla agrupa por nombre:

- `120237959905760570` → "CAMPAÑA 1: DOS Landing Calendar 2026-1" **y** "004. Leads / Agenda - Febrero / 2026"
- `120235166246910570` → "002. Leads / Optin..." **y** "Leads Landing DOS Optin"

Renombrar 222 entidades encima de esto multiplicaría el problema. Arreglo primero la causa:

### Claude

Ahora reparo el daño ya existente: las 4 campañas partidas. Primero en modo consulta, para ver qué se arreglaría:

### Claude

Meta tiene el nombre correcto; la base quedó con la mezcla. Alineo el histórico con la verdad de Meta (solo toca el campo nombre, la identidad es el id):

### Claude

2.030 filas reparadas. Verifico que el gasto oculto volvió al rollup:

### Claude

La muestra estaba truncada — PostgREST limita a 1000 filas. Rehago paginando de verdad:

### Claude

Histórico consistente. Commiteo el fix de propagación antes de seguir:

### Claude

Corté acá para reportarte, porque encontré algo que cambia el orden de las cosas y ya reparé daño real.

## Lo que encontré antes de tocar nombres

**La propagación de renombres nunca funcionó.** Cuando renombrás algo en Meta, la app debe actualizar ese nombre en tus datos históricos. Ese código existía pero fallaba **en silencio**: usaba el workspace de la sesión en vez del workspace dueño de la cuenta de Meta, el UPDATE no encontraba filas, y Postgres devuelve "ok" cuando actualiza 0 filas. Nadie se enteraba nunca.

**El daño ya estaba hecho**: 8 campañas y 11 conjuntos tenían **dos nombres históricos cada uno**. Como tu tabla de Ads Manager agrupa el gasto **por nombre**, ese gasto quedaba partido y no aparecía en el rollup.

Lo arreglé y reparé **2.054 filas**, alineando la base con el nombre vivo de Meta. Verificado: cero entidades con nombre partido en los tres niveles (`8116d1a`).

Un detalle de método: mi primera medición dio "4 campañas" y la segunda "7". Fue un error mío de muestreo — PostgREST corta a 1.000 filas y yo leía sin paginar, así que cada consulta veía un subconjunto distinto. Repetí paginando las 2.570 filas y ahí salió el número real (8 campañas, 11 conjuntos). Lo mismo aplicaba al arreglo, por eso lo corrí dos veces hasta verificar que quedó limpio.

## La convención que voy a implementar

```
Campaña   NNN | OBJETIVO | Tema                  | AAAA-MM
Conjunto  NNN.SS | PUBLICO | Detalle
Anuncio   NNN.SS.x | ANGULO | Qué dice el anuncio
```

Ejemplo real con la transcripción de uno de tus anuncios:

- `5. VENTAS v1 con sistema` → **`013.02.e | DOLOR | Subes la comisión y las ventas no cambian`**
- `029.01.g Anuncio` → **`029.01.g | DOLOR | Tu equipo ejecuta órdenes, nadie resuelve`**

Dos decisiones que vale la pena que sepas: el separador es ` | ` porque es el único carácter que nunca aparece dentro de tus textos (con `/` y `-` no se puede partir el nombre sin ambigüedad), y `OBJETIVO`/`PUBLICO` salen **directo de la API de Meta**, no de que la IA los adivine.

## Lo que falta y en qué orden

Quedan dos bloqueantes antes del renombrado masivo, ambos ya identificados con archivo y línea: **cruzar por ID en vez de por nombre** en la tabla (si no, apenas termine el lote las campañas se ven en $0 hasta recargar) y **los correlativos por máximo en vez de por conteo** (hoy reusan números al archivar una campaña).

Después viene el módulo unificado de nombres, el naming descriptivo automático en los cuatro puntos de creación, y recién ahí el renombrado masivo — que **te voy a mostrar como lista para aprobar** antes de escribir nada en Meta.

Sigo con eso salvo que quieras cambiar el orden.


---

## Martín

`2026-08-01 00:53`

Dime cuantos anuncios publique por mes desde marzo a julio, en bullet points
Tienes el token de Meta

### Claude

Esto es una consulta directa a la API — la hago sin desplegar agentes:

### Claude

El conteo salió; el segundo intento falló por formato del filtro. Lo reintento bien para incluir archivados:

### Claude

Anuncios creados por mes en tu cuenta (`act_564003520636790`), marzo–julio 2026:

- **Marzo 2026:** 10
- **Abril 2026:** 6
- **Mayo 2026:** 48
- **Junio 2026:** 50
- **Julio 2026:** 9

**Total del período: 123 anuncios.**

Dos precisiones sobre el número:

**Incluye archivados y borrados.** Si contás solo lo que hoy sigue vivo en la cuenta, mayo baja a 26 y junio a 37 (87 en total). La diferencia son 34 archivados y 5 borrados, casi todos de esos dos meses — o sea que en mayo y junio hubo bastante rotación de creativos, no solo alta.

**Es fecha de creación, no de entrega.** Un anuncio creado en junio puede haber empezado a gastar en julio, o no haber gastado nunca. Si lo que te interesa es cuántos *entregaron* cada mes, eso sale de las métricas y te lo saco con otro corte.

El pico está clarísimo en mayo–junio (98 de los 123), y julio va bien abajo con 9.

