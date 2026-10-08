# API de MaKo — diseño

Una sola superficie con TODO lo que un agente puede LEER y HACER en MaKo, tab por tab,
con acciones. La consumen MaKo por WhatsApp, MaKo adentro de la app, la skill de Claude
del cliente y cualquier integración que hable HTTP con un bearer (n8n, Zapier, un MCP).

Este documento es el POR QUÉ. La referencia de cada operación está en
[api-mako.md](api-mako.md) (generada, no se edita) y lo aprendido construyéndolo en
[hallazgos-api-mako.md](hallazgos-api-mako.md). El código vive en `lib/api-mako/`,
`app/api/v1/` y las pantallas `app/mako/pendientes` y `app/mako/revisar`.

El borrador v0 pasó por tres jueces adversariales (seguridad y reglas de la casa;
operabilidad para los consumidores; riesgo de implementación). Lo que sigue ya tiene
sus veredictos aplicados; las decisiones que cambiaron están marcadas **[veredicto]**.

---

## 1. Principios

Todos ya están en [AGENTS.md](../AGENTS.md); acá se dice cómo se aplican.

- **Una cosa, un lugar.** UN registro de operaciones (`lib/api-mako/registro.ts`). Los
  ToolDefs de Claude, el catálogo HTTP, la referencia y lo que enseña la skill SE
  DERIVAN de ahí. Nada se copia.
- **Un canal PROPONE; una persona confirma.** Ninguna acción escribe directo. Cada
  acción declara CÓMO se confirma (§3), y **por HTTP nadie confirma por su cuenta**
  salvo con un alcance acuñado a propósito (§5) **[veredicto]**.
- **El guard está en POSITIVO.** Cada operación declara obligatoriamente su `tipo`, su
  `confirmacion` y **por qué canales sale** (`canales`). Un test snapshot fija el
  conjunto que sale por HTTP: sumar una es DECIDIRLO **[veredicto]**.
- **Lo que lee el modelo es TODO lo que sabe:** unidad en el nombre del campo, ventana
  declarada, `null` distinto de `0`, advertencias adentro del payload.
- **Rutas con auth propia van en `lib/rutas-publicas.ts`** y no leen cookie.
- **Claude vetado salvo excepción escrita:** el registro no llama a ningún modelo por
  su cuenta; una operación que invoque IA usa las libs que ya pasan por el veto.
- **Lo que gasta plata ajena no entra por un botón:** se confirma en pantalla, nunca
  por chat, y solo el admin.
- **Tenant-safe:** toda operación corre dentro de `runWithWorkspace(ctx.ws)` y el
  choke point lo comprueba antes de correr el runner. El `ws` sale del bearer o del
  grupo; nunca del input.

## 2. El registro

```
lib/api-mako/
  tipos.ts        el contrato (sin server-only)
  validar.ts      esquema JSON + saneo del input, con topes (sin server-only)
  registro.ts     junta las defs, deriva ToolDefs y catálogo (sin server-only)
  docs.ts         la referencia en markdown (sin server-only)
  canal.ts        clave de scope de las pendientes, quién puede confirmar (puro)
  alcance.ts      el alcance leído del token (puro)
  runners.ts      junta los cuerpos (server-only)
  ejecutar.ts     el choke point (server-only)
  acciones.ts     proponer → pendiente/propuesta → confirmar/cancelar (server-only)
  http.ts         auth por bearer, respuesta, tope de cuerpo (server-only)
  bitacora.ts     una fila por llamada HTTP (server-only)
  areas/
    <area>.def.ts   definiciones (sin server-only)
    <area>.run.ts   cuerpos (server-only)
```

**Por qué `.def.ts` / `.run.ts` separados.** Los tests no pueden importar módulos con
`server-only` (por eso los tests viejos leen el fuente por regex). Con la definición
aparte, los tests, el generador de docs y el catálogo importan las definiciones; los
runners quedan server-only y se cruzan por id. Un test verifica la paridad en las dos
direcciones y que ninguna def importe, ni transitivamente, un módulo con `server-only`
(el generador corre bajo `node --import tsx` sin `--conditions react-server` y un
import así revienta el pre-push de las dos cuentas) **[veredicto]**.

**Sin server-only no significa apto para el navegador.** Ningún `'use client'` puede
importar un valor del registro, de las defs ni de `lib/agente-skill.ts`. El test lo
cuida con el molde de `catalogo-fuera-del-bundle` **[veredicto]**: ya había un import
de valor en `TutorialAgente.tsx`, y se movió la constante a `lib/agente-constantes.ts`.

**Tres clases de operación:**

| tipo | verbo HTTP | qué hace | ejemplo |
|---|---|---|---|
| `lectura` | GET | devuelve datos (`json`, `markdown`, `texto`; `?formato=` si lo declara) | `buscar_leads` |
| `accion` | POST | deja una pendiente (`chat`) o una propuesta (`pantalla`) | `proponer_cambio_etapa` |
| `control` | POST | cierra una pendiente ya existente: solo `confirmar_accion` y `cancelar_accion`, solo en el área `mako` | — |

**Ids y áreas.** Ids en snake_case español, verbo + objeto. Los 26 nombres que ya
existían (12 lecturas de `MAKO_TOOLS` + 14 de `MAKO_ACCION_TOOLS`, de las cuales 4 son
lecturas) se conservan como id o alias: los usa el doer, la skill instalada en la
máquina de cada cliente y las pendientes en la base. El `area` es la TAB donde vive el
código, no el tema.

## 3. El ciclo de una acción

| `confirmacion` | Qué pasa al llamarla | Qué devuelve | Quién la cierra |
|---|---|---|---|
| `chat` | `preparar()` valida contra la base y arma `{payload, resumen}`; se guarda en `mako_acciones_pendientes` con `vence_at` +2 h y `grupo_jid` = la clave del canal | `{ pendiente: {id, resumen, venceEnMin, url} }` con `url` a la bandeja | una PERSONA: un «sí» aparte en WhatsApp, o la bandeja `/mako/pendientes`. Por HTTP, solo un token `ejecutar`, con `id` obligatorio |
| `pantalla` | `proponer()` propio (leads, tareas, borradores) o la genérica: `preparar()` y una fila en `propuestas` con `tipo:'accion'` | `{ propuesta: {id, url, nueva} }`, URL absoluta | la persona entra al link, corrige y confirma |

Reglas:

- **`chat` para** cambios de estado de UNA entidad ya identificada por id, reversibles
  o de bajo impacto (etapa, pausar/activar, renombrar, agendar en un hueco real).
  **`pantalla` para** datos exactos que un modelo puede transcribir mal (teléfonos,
  emails, montos), creaciones con varios campos, todo lo que gaste plata o créditos
  (Meta, Flow, ElevenLabs), y envíos masivos. **Lo que cuesta `dinero` es `pantalla`
  y `rolMinimo:'admin'`, sin excepción**; el test lo fija **[veredicto]**: el
  presupuesto de una campaña dejó de confirmarse por chat.
- **Confirmar RECLAMA antes de ejecutar.** `reclamarPendiente` pasa la fila a
  `confirmada` solo si sigue `pendiente` y vigente; una sola confirmación gana y la
  otra recibe «ya estaba». Si la ejecución explota, la pendiente queda en `error` con
  el motivo y nunca vuelve a `pendiente` **[veredicto]**: antes se ejecutaba y recién
  después se resolvía, y por la app o por HTTP nada impedía dos ejecuciones.
- **Anti auto-confirm:** en WhatsApp y en la app, una pendiente creada en el mismo
  turno no se confirma en él (`createdAt >= turnStart − 1,5 s`, como siempre). El
  guard de «N segundos» para HTTP del borrador era teatro y se sacó **[veredicto]**:
  el mismo proceso que espera es el que confirma.
- **La clave de scope** (`lib/api-mako/canal.ts`): el jid del grupo en WhatsApp,
  `app:<sesión>` en la app, `api:<ws>` por HTTP. Va en `grupo_jid`, sin migración (la
  columna es texto y el índice ya es por clave). Un jid nunca empieza con `api:` ni
  `app:`; el test lo fija. El grupo de WhatsApp ve además las pendientes que vinieron
  por la API del mismo workspace, marcadas «vino por la API» **[veredicto]**.
- **`tipoPendiente`:** las 7 acciones heredadas persisten el slug que ya está en la
  base (`lead_etapa`, `meta_estado`, …) para que las pendientes vigentes al momento
  del deploy sigan resolviendo **[veredicto]**.
- **Toda `pantalla` tiene pantalla Y bandeja.** `pantalla` es un campo cerrado
  (`/crm/revisar`, `/plan/revisar`, `/mako/revisar`, `/whatsapp`) y el test cruza cada
  uno contra `app/`. La genérica `/mako/revisar/<id>` pinta un formulario editable
  desde `parametros` y al confirmar llama `ejecutar()`; `/mako/revisar` es su bandeja.
  `/crm/revisar` filtra `tipo='lead'` (listaba toda propuesta con un link que solo
  renderiza leads) **[veredicto]**. Y las pendientes `chat` tienen la suya:
  `/mako/pendientes`, que ve todo el workspace.

## 4. Transportes

### 4.1 HTTP — `app/api/v1/`

```
GET  /api/v1                       → catálogo: lo que ESTE token puede pedir
GET  /api/v1/docs                  → la referencia en markdown
GET  /api/v1/{area}/{operacion}    → lectura (query string; ?formato= si lo admite)
POST /api/v1/{area}/{operacion}    → acción o control (body JSON)
```

- **Una sola ruta dinámica** (`[area]/[operacion]`), el catálogo y la referencia. Las
  pendientes se listan, confirman y cancelan por las operaciones del área `mako`
  (`/api/v1/mako/listar_pendientes`, `confirmar_accion`, `cancelar_accion`), no por
  una carpeta aparte: dos puertas a lo mismo son dos formatos que divergen
  **[veredicto]**.
- **`/api/v1` está en `PUBLICOS` como PREFIJO**, y es la única carpeta que puede. La
  regla «rutas exactas, nunca prefijo» existe porque en `/api/agente` conviven bearer
  y navegador; acá no hay mezcla POR CONSTRUCCIÓN y dos guardas lo sostienen: el test
  enumera en positivo los `route.ts` permitidos bajo `app/api/v1` y falla si aparece
  otro, y `wsDeHeaders` (la única puerta) mira SOLO `authorization`. No se tocó
  `PUBLICOS_ESCRITURA`: es match exacto y solo gobierna `/compartido` **[veredicto]**.
- **404, no 403.** Lo que un token no puede pedir —por canal, alcance, capa del
  workspace, rol o `soloWs1`— NO EXISTE para él: no aparece en el catálogo y contesta
  el mismo 404 que una operación inventada, con `disponibles` = lo que sí puede pedir
  en esa área **[veredicto]**.
- Errores: `{ ok:false, error, faltan?, disponibles? }`. 400 es del que llama
  (parámetro, id inexistente en ESTE ws), 401 token, 404 no existe, 429 ritmo, 500
  nuestro. Las lecturas salen con `Content-Type` según la salida; con `?formato=csv`
  se conservan `Content-Disposition` y las cabeceras de advertencia.
- Topes: cuerpo 256 KB; strings 4000 caracteres y listas 200 ítems salvo `max`
  declarado; solo pasan las claves declaradas; rate limit best-effort por IP antes de
  tocar la base y por workspace después (nunca por el token). `maxDuration = 60`, el
  techo de la casa para lo que no es cron; una operación `lenta` lo declara.
- **Bitácora:** una fila por llamada en `api_llamadas` (mig 0158), con la IP recortada.
  Es lo que contesta «¿me filtraron el token?» **[veredicto]**.
- Las rutas viejas `/api/agente/*` SE QUEDAN (hay skills instaladas) y no se
  documentan más. `/api/agente/consultar` sigue corriendo `runMakoTool`, que es el
  mismo cuerpo que corre el registro para esas lecturas.

### 4.2 In-process (WhatsApp y la app)

```ts
toolsDelRegistro({ vista, areas?, incluirAcciones?, ids?, maxChars? }): ToolDef[]
runnerDelRegistro(ctx): ToolRunner
```

- **Los 26 cuerpos existentes se ENVUELVEN, no se mudan** **[veredicto]**: siete
  tests leen `lib/mako-tools.ts` y `lib/mako-doer-acciones.ts` por regex, y esos dos
  archivos están exceptuados del escaneo de voseo porque le hablan al dueño. Los
  runners de esas 26 delegan en `runMakoTool` y `crearRunnerAcciones`. Mudarlos es
  trabajo de después, un área por commit, moviendo en el mismo commit los tests.
- **Las claves de salida se conservan**: el doer de WhatsApp parsea el string que
  devuelve la tool buscando `link` (`/plan/revisar/`) y `url` (`/crm/revisar/`) para
  escribir él mismo el mensaje del borrador, y lleva una `instruccion` al modelo por
  canal **[veredicto]**. `runnerDelRegistro` devuelve exactamente eso.
- **Cuántas tools ve el doer por turno.** Medido: las 26 pesan 22,9 k caracteres
  (~6 k tokens) y el techo de entrada de Groq es 7 k. El enchufe se hace extendiendo
  `CONTRATO` de `lib/mako-intencion.ts` con `areas` por intención —no con un mapa
  nuevo—, y **sin fallback a «todas las acciones»**: si el mensaje no nombra un área,
  el turno lleva el mismo conjunto de hoy **[veredicto]**. `toolsDelRegistro` acepta
  un presupuesto `maxChars` y avisa qué quedó afuera.
- **El doer de la app entra solo con lecturas** hasta que exista el turno compartido
  (pendientes en el system, `turnStart`, captura de links) **[veredicto]**.

### 4.3 La skill de Claude

Enseña TRES URLs —el catálogo, la referencia y `GET|POST /api/v1/{area}/{op}`— y la
lista de áreas. El catálogo se SIRVE, no se embebe: la skill pesa 24 k caracteres y no
puede crecer con cada operación **[veredicto]**. `plugin/` se regenera con
`scripts/generar-plugin.mjs`, coordinado: una sola sesión toca `agente-skill.ts`.

## 5. Auth y alcance del token

- El bearer es el de siempre (`lib/agente-token.ts`, un token por workspace, acuñado
  solo por el admin del workspace).
- **Tres alcances, en positivo y por lo que AGREGAN** **[veredicto]**:
  `lectura` (solo lecturas) · `proponer` (+ acciones: dejan una pendiente o una
  propuesta que confirma una persona; es lo que hoy ya hacen `/api/agente/plan` y
  `/lead`, y el DEFAULT de todo token acuñado antes) · `ejecutar` (+ confirmar y
  cancelar pendientes por API).
- **El alcance viaja en el PREFIJO del token** (`mkoag_l_`, `mkoag_p_`, `mkoag_e_`;
  los viejos sin letra son `proponer`): rotar el token resetea el alcance junto con él
  y no hay dos escrituras que puedan quedar desfasadas **[veredicto]**. Fail-closed:
  un prefijo desconocido es `lectura`.
- **Rol:** `Ctx.rol` es `admin` por HTTP y WhatsApp (solo un admin acuña; el grupo es
  del dueño) y sale de la sesión en la app. `gating.rolMinimo:'admin'` es obligatorio
  en lo que mueve plata.
- **`soloWs1`** reemplaza al viejo «soloDueno»: OWNER_WS = 1 es Mauricio, un CLIENTE,
  no la plataforma. Es la Fase 1 de Meta (las escrituras salen por la cuenta del ws 1)
  dicha por lo que es **[veredicto]**.

## 6. Documentación generada, nunca escrita

- `lib/api-mako/docs.ts` arma la referencia desde el registro (solo lo que sale por
  HTTP). `GET /api/v1/docs` la sirve; `scripts/generar-api-doc.mjs` la escribe en
  `docs/api-mako.md` junto con `tests/api-mako-http.snapshot.txt`, y su `--check`
  corre en el pre-push leyendo de HEAD y normalizando `\r` (las cinco trampas de las
  otras guardas, ya pagadas).
- Este documento es el diseño. La cosecha va a `docs/hallazgos-api-mako.md`, con una
  línea que remite a `hallazgos-agente.md` para lo que sigue viviendo en
  `/api/agente`.

## 7. Tests (`tests/api-mako-registro.test.ts`)

1. Ids únicos, snake_case, alias que no pisan; el registro cargó sin problemas.
2. Toda def tiene runner en su `.run.ts` y todo runner tiene def.
3. Ninguna def/tipos/registro/docs importa un valor de un módulo con `server-only`
   (se lee el archivo destino de cada import).
4. `canales` declarado en positivo; **snapshot de lo que sale por HTTP**.
5. Toda acción: confirmación, reversible, escribe, pantalla existente; `dinero` →
   pantalla + admin; controles solo `confirmar_accion` y `cancelar_accion` en `mako`.
6. Parámetros bien formados; ToolDef derivado con `required` correcto.
7. La vista decide qué existe (canal, alcance, ws 1, rol, capa).
8. Alcance por prefijo, fail-closed; `permite()`.
9. Clave de scope sin colisiones; `puedeConfirmar` por canal.
10. Validación: solo lo declarado, coerción, `faltan`, topes.
11. Ningún `'use client'` importa un valor del registro ni de la skill.
12. Bajo `app/api/v1` hay exactamente las rutas previstas, todas por `autenticar()`,
    ninguna lee la sesión; `/api/v1` está en `PUBLICOS`; `ejecutarOperacion` hace el
    wrap del workspace y lo comprueba.
13. `docs/api-mako.md` al día.

Y los que se mueven con los cuerpos cuando se muden (no en esta pasada):
`agente-consultas`, `mover-etapa-validacion`, `avisos-reunion-link`, `vcard`,
`tutorial-video`, `puente-panel-copy` (excepciones por ruta).

## 8. Qué queda afuera de v1, y por qué

- `/api/admin/*` (plataforma): el bearer es de UN workspace.
- Credenciales: se expone el ESTADO de una integración, nunca el valor.
- Generación que gasta créditos de terceros (video en Flow, voz, imágenes) **no
  entra ni como `pantalla`** hasta verificar que lo que deja una propuesta no lo
  levanta sola la cola de la extensión **[veredicto]**.
- Confirmar por HTTP sin alcance `ejecutar`.
- El doer de la app con acciones (§4.2).
- Tokens por usuario (hoy uno por workspace; la clave HTTP es `api:<ws>` y el `id`
  es obligatorio al confirmar por eso).

## 9. Fases (cada una pusheable)

- **F0+F1 — el núcleo** (esta pasada): contrato, registro, choke point, rutas
  `/api/v1`, alcance, bitácora, tests, migración 0158. Sin consumidor enchufado.
- **F2 — las áreas**: un `.def.ts` + `.run.ts` por área desde el inventario; las 26
  heredadas envueltas; pantallas `/mako/pendientes` y `/mako/revisar`; el alcance en
  `/integraciones`.
- **F3 — los consumidores**: el doer de WhatsApp deriva sus tools del registro
  (`CONTRATO.areas`), el doer de la app con lecturas, la skill enseña `/api/v1`,
  `plugin/` regenerado, la guarda del pre-push, AGENTS.md.
- **F4 — después**: mudar los 26 cuerpos, un área por commit, con sus tests.

## 10. La segunda etapa (08/10/2026): una sola copia, menos tokens, acciones en los flujos

El pedido de Martín, literal: «tener muy bien modularizado todas las acciones de MaKo... me
imagino que cada acción sea algo como /crm-lead-X... que MaKo tenga una API propia, con todas
las acciones bien documentadas y moduladas, como un CRUD... y así nos podemos ahorrar muchos
tokens en la búsqueda. Y también muy importante, podemos configurar acciones en el chatbot y en
otros lugares que se pueda integrar la API de MaKo».

**La API ya existe y es esto**: 498 operaciones en 18 áreas (316 lecturas, 180 acciones, 2
controles), 379 por HTTP. Lo que falta no es otra API: es que la usen de verdad los que todavía
no la usan. Lo medido, con las correcciones de los refutadores, en `docs/hallazgos-api-mako.md`
(«La API existe, pero los que más la usan todavía no pasan por ella») y en `docs/hallazgos-ia.md`
(«Dónde se van los 14.500 tokens de una pregunta al doer»).

### El orden, y por qué ése

| # | Qué | Para qué | Tamaño | Bloqueado por |
|---|---|---|---|---|
| 0 | **Medir** qué tope se pasa en un 429 y cuánto cachea Gemini | Decide si conviene bajar TOKENS o PASOS | chico | — (hecho, `949bd68b`) |
| 1 | **Las recetas del system viajan con su tool**, y en consultar/pensar no viajan las 7 `proponer_*` viejas | −26% a −31% por pedido (−3.769 a −4.437 tokens de 14.491) | chico | decisión B, y tocar el clasificador |
| 2 | **Una sola copia de las 25**: el doer y el chat toman el ToolDef del registro | Saca las descripciones dobles y 3 bugs ya medidos | mediano | arreglar ANTES la def de `proponer_tareas_plan` |
| 3 | **Índice por área + esquemas a pedido** | −42% por pedido, y el modelo ve las 114 operaciones de crm+ads en vez de 18 | mediano | 0 (si el tope es de pedidos, agregar un paso empeora) y 2 |
| 4 | **Rotar sin volver a pagar el turno** | Hasta −14% del input de 30 días | mediano | — |
| 5 | **Catálogo HTTP filtrable** (`?area=`, `?compacto=1`) y `recurso` como etiqueta | La vista «crm › lead › mover» sin renombrar; el catálogo entero son ~90k tokens | chico | — |
| 6 | **Canal `flujo`**: una operación del registro como paso de un flujo | «Configurar acciones en el chatbot»; 0 tokens por paso | grande | decisión A |
| 7 | **Las operaciones que un flujo necesita**: `lead_funnel` (agregar, quitar y mover dentro de un producto) e inscribir a UN lead en una secuencia | Hoy el lienzo no tiene a qué apuntar | mediano | 6 |

Lo que la primera versión del plan afirmaba y **no se sostuvo** (refutado el 08/10):

- «El "sí" que sigue a una pregunta se resuelve como `actuar`». **Falso en HEAD**: sin pendiente,
  `clasificarIntencion` manda un «sí» a `charlar` (sin tools). La fase 1 necesita tocar el
  clasificador, no sólo sacar las tools.
- «El caché de Gemini no abarata el prefijo». **Falso para el COSTO**: el 2º pedido con el mismo
  system y las mismas tools vino 86% cacheado. Para el CUPO no se sabe. Y cambiar la lista de
  tools a mitad del turno lo invalida (medido: de 12.253 cacheados a 0), así que la fase 3 paga
  el prefijo entero en cada carga.
- «El 429 de Brigitte fue por tokens». **No está demostrado**: el único 429 completo de ese
  modelo que leímos (16/08) era de PEDIDOS, y bajar tokens no toca ese tope.
- «`cargar_operaciones` entra sin tocar nada». **Del lado del proveedor sí** (Groq y Gemini
  aceptan que la lista crezca), **del nuestro no**: `permitidas` se fija antes del loop (la tool
  cargada sería una fantasma), la cascada marca `ejecutó` ante CUALQUIER tool (una lectura apaga
  la rotación) y el system dice «las que tienes y NINGUNA otra».
- «La def del registro de `proponer_tareas_plan` sostiene capturar». **No**: no declara
  `recurrente`, pierde los moldes del detalle y del proyecto, y manda a usar una tool que capturar
  no ve. Hay que arreglar la def antes de la fase 2.

### Decisiones de Martín (no se toman en el código)

- **A. ¿Qué puede correr SOLO desde un flujo que armó el admin?** Recomendación: una clase
  cerrada —interna, reversible, gratis y sobre el lead del evento (mover de etapa, etiquetar,
  nota, inscribir en secuencia)—, opt-in por paso y con default «propone». Plata, mensajes a
  personas, borrados y configuración, nunca. El porqué de «el canal propone» es que un dato que
  pasa por un modelo deja de ser exacto, y en un paso configurado no escribe ningún modelo. No
  «aplica y deja deshacer»: el CRM automático, que funciona así, tuvo 37 de 73 revertidas.
- **B. Cuando MaKo contesta una pregunta, ¿deja la propuesta armada o la ofrece?** Recomendación:
  la ofrece, y el «sí» siguiente va a `actuar` (hoy va a `charlar`). Medido: en 30 días hubo 0
  turnos `actuar` y en toda la base 3 pendientes de chat: casi nunca propone desde una pregunta.
- **C. Los nombres**: no renombrar. Etiqueta `recurso` y agrupar por área › recurso › verbo; un
  alias (el mecanismo existe, con 0 en uso) sólo si una integración pide URLs más lindas.
- **D. `/api/agente/*`** (duplica 6 operaciones y es lo que enseña la skill instalada): mantener,
  y que la skill regenerada enseñe `/api/v1`; deprecar cuando haya rastro de uso (hoy 0 filas en
  `api_llamadas`).
- **E. El paso «⚡ Acción» del lienzo de avisos** promete «se hace con tu sí» y no hace nada (1
  guardado, 0 corridas): esconderlo hasta la fase 6, o dejarlo.
