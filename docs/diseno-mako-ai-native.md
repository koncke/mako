# Diseño: MaKo AI native, un solo chat en toda la app

**Fecha:** 16/10/2026. **Para:** Martín, que elige el alcance en la sección (f).

## En un minuto

- **Qué se decide (sección f):** cuánto entra antes del tope del 4/11. **Recomendación: la opción A**, chica y visible: «Editar con MaKo» en Dashboard y General (una frase y el gráfico aparece), con el arreglo del bug de «Pídeselo» en General. La pieza única, Second Brain en lugar de `/mako` y el Centro como su adaptador quedan para la etapa 2, que puede arrancar por el Centro porque no toca a ningún cliente.
- **La pieza única sale del Centro** (sección a): barra jefe › sub, conversación, la pregunta tipo Claude Code y el riel. Lo que es sólo del super admin (la firma, el Runner, el Uso, la Ticketera) entra por slots.
- **El grafo va como la Ticketera** (sección c, copiado de Obsidian): un acceso «Mapa» arriba de la lista. Se alimenta LEYENDO lo que ya existe, nunca copiando a markdown.
- **El chat de MaKo por WhatsApp es un chat más del Second Brain** (sección c, pedido de Martín del 16/10): se LEE de
  donde ya vive (`mako_doer_conv`), sólo lo ve el admin, y como trae datos de clientes sólo contesta con su Claude o
  con un Gemini pago. Hoy MaKo contesta SÓLO en grupos: el 1 a 1 con su número no existe.
- **«Entender el pedido» es una pieza de TODOS los chats** (sección a): interpretar «la otra automatización», ordenar dos
  pedidos en uno, y dejar el link si es de otra tab. La construye Web Generator; acá se usa, no se duplica.
- **Los chats no cuentan con el crédito de Claude de la plataforma**: desde el 16/10 es SÓLO para el onboarding.
- **Las criaturas** (sección d): forma, color y cara por jefe, guardadas por workspace y por la clave del chat (renombrar no cambia el muñeco).
- **⛔ Antes que todo, una fuga que no es de este diseño:** `/api/chart-insights` le pasa a closer y setter los montos del trimestre. Se arregla aparte.

**Base de lo medido** (lo volví a medir el 16/10 a las 03:50):
- **Main:** el clon está en `a0fc9d9f6` (16/10 01:13).
  - Las rutas sin prefijo son relativas a `dashboard-marketing/`, y las de `lib/api-mako/areas/*.def.ts` se citan como `<área>.def.ts`.
  - Los números de línea de `AGENTS.md` son los del clon.
- **origin/main:** está en `7c94db5f5` (03:31). Tiene 22 commits que el clon no tiene, y el clon tiene 6 merges que origin no tiene, así que están divergidos. La revisión lo había medido en `603816b11` (03:13) con 14 commits, y desde entonces siguió moviéndose. Lo que trae y toca este diseño:
  - La regla de datos personales en `AGENTS.md`. Desde `b9aaa9d0f` (03:24), además, el crédito de Claude de la plataforma se usa **sólo en el onboarding**: lo definen `CREDITO_HABILITADO_PARA` en `lib/veto-claude.ts` y el control en `lib/anthropic.ts`. Ver (f).
  - Cambios en `lib/graficos-ia-red.ts`, `lib/graficos-ia-elemento*.ts`, `lib/graficos-analisis-server.ts` y `lib/model-catalogo.ts`.
- **Centro:** el worktree `C:/dev/wt-centro-chat` (rama `centro-chat`) está en `70519ffa4` (03:40). Se cita como `wt:`, con las líneas de ese commit.
  - Tiene 10 commits que main no tiene y nada por commitear.
  - Otro chat sigue commiteando: `f83efea40` y `70519ffa4` entraron durante la revisión.
  - Le faltan 97 commits de main y 113 de origin/main. La base común es `b11d0ba86`, y desde ahí sólo `AGENTS.md` y `docs/hallazgos.md` cambiaron en las dos ramas.
- **Lo que main no tiene del Centro:**
  - En `app/admin/operaciones/`: `Pregunta.tsx`, `TicketeraCentro.tsx`, `NuevoChat.tsx`, `Uso.tsx` y `tabs.ts`.
  - `lib/centro-preguntas.ts` y `lib/centro-uso.ts`.
  - `app/m/operaciones/TicketeraMovil.tsx`.
- **Las secciones del chat de WhatsApp (c) y de «entender el pedido» (a)** se sumaron el 16/10 a la mañana, medidas en
  `origin/main` `3a8d16050`.
- **Cómo se midió:** sólo lectura. Los conteos del registro salen de scripts `node --import tsx` sobre `lib/api-mako/registro.ts`, que quedaron fuera del repo, en el scratchpad de la sesión (`medir-*.ts`). Si algo no se midió, se dice.
- **Ojo con la herramienta Grep:** devolvió «No files found» con tildes y con un glob de llaves sobre texto que existe (`app/mako/MakoTab.tsx:68`). Los conteos en cero se repitieron con `grep` desde Bash.

> **El pedido:** que todos los chats con MaKo tengan la cara del Centro. Cada tab tiene un chat jefe con sus sub-chats. Second Brain reemplaza a «Pregúntale a MaKo», y todo lo que se crea cae ahí. Las criaturas se pueden personalizar. El Centro del super admin pasa a ser su Second Brain. Y Dashboard y General se editan con IA.

**Lo que hay hoy:**
- **Hay 9 motores de chat:**
  1. `/api/chart-insights`
  2. `/api/mako-doer`
  3. `turnoApp` (`/api/m/mako`, `/api/crm/mako` y `/api/crm/analyst`)
  4. `/api/offer` (`lib/offer-ia.ts`)
  5. La IA de Automations
  6. `/api/whatsapp/advisor`
  7. El agente de Web Generator
  8. `/api/video-editor/ia`
  9. El doer de WhatsApp
- **Almacenes.** Los que nombra este documento son cuatro:
  - `chart_sessions` + `chart_chats`
  - `offer_sesiones` (migración 0254)
  - `app_settings` de Automations
  - `mako_doer_conv` (migración 0086)

  Además hay dos hilos que viven sólo en la memoria de la pestaña: Web Generator y Video Editor. Los diseños no se contaron.
- **El Second Brain no lee ninguno.** El grep de `chart_chats`, `offer_sesiones`, `automatizacion.chat` y `mako_doer_conv` en `lib/cerebro-*.ts` y `app/second-brain` da 0.
- **El chat de la barra (`/mako`)** va contra `/api/chart-insights` sin herramientas: no busca datos ni actúa.
  - Aun así no va a ciegas: `buildSystemPrompt` le mete perfil, fase, objetivos, experimentos y funnel (`lib/mako-context.ts:89-125`).
  - No es el más pobre: empata con el chat por gráfico del Dashboard (`app/dashboard/PanelAnalista.tsx:584`) y con el de Ads Manager (`app/_components/ChartIA.tsx`), que usan el mismo endpoint.
  - El nombre `chatClaude` engaña: las features `mako-chat` y `mako-doer` van a Gemini por defecto (`lib/model-catalogo.ts:113-114`).
- **`/mako-doer` también está viva.** `app/mako-doer/page.tsx` tiene su propia capa, con `MakoChat` contra `/api/mako-doer` (`nav.ts:414-416`). Se retira junto con `/mako` (etapa 2).
- **El motor que más hace es `turnoApp`** (`lib/mako-turno-app.ts`). Lee, propone acciones con una tarjeta que se confirma y acepta fotos y PDF. Lo usan `/m/mako`, el CRM y la ficha del lead.
- **Dashboard y General: Martín tiene razón.** En la app ningún chat edita la hoja abierta, aunque la API ya tiene las operaciones (`dashboard.def.ts`, `general.def.ts`). Por WhatsApp, las 17 acciones de `graphics` tienen canal `whatsapp`. No medí si el clasificador las enruta.

---

## ⛔ Una fuga activa hoy, fuera del alcance de este diseño

`/api/chart-insights` llama a `buildSystemPrompt` sin `sinNumerosDelNegocio` (`app/api/chart-insights/route.ts:61`, `:116` y `:144`) y no mira el rol.

- `/mako` está abierta a closer y setter (`nav.ts:419`).
- Así, un closer recibe los montos del trimestre (USD vendidos y cobrados) por `objetivosContextoTexto` (`lib/mako-context.ts:109-112`). Es lo mismo que la auditoría del 14/10 cerró en `turnoApp`, que pasa `sinNumerosDelNegocio: persona.rol !== 'admin'`.
- Además, cualquier miembro lee por id cualquier chat de escritorio del workspace (`route.ts:76-78`).

Lo vi sólo leyendo el código, no lo probé. **Retirar `/mako` no lo arregla si la ruta queda viva.** Se arregla aparte y antes, sea cual sea la opción de (f).

---

## (a) La pieza de chat única, que sale del Centro

### Las partes

| Parte | Sale de | Se reusa | Qué cambia |
|---|---|---|---|
| Barra de chats (Buscar, accesos, lista jefe › sub, «⋯», «Mostrar N más») | `wt:app/admin/operaciones/CentroApp.tsx` (el aside `co-barra` y el closure `fila`), que el teléfono copia en `wt:app/m/operaciones/ChatsMovil.tsx` | el diseño | Pasa a ser un componente propio. Hoy está escrita dos veces, con `VISIBLES` 14 y 10 (`CentroApp.tsx:79`, `ChatsMovil.tsx:46`). |
| Conversación y caja | `wt:app/admin/operaciones/Conversacion.tsx` | la cabecera, la caja que crece hasta 220 px, Enter / Shift+Enter con guarda de IME y el borrador por chat | Los props dejan de ser tipos del Centro. Los adjuntos y la voz se traen de `app/m/mako/Composer.tsx`. **El teléfono tiene su propia caja:** `wt:ChatsMovil.tsx:160` es un textarea que no crece a 220 px, no manda con Enter y no importa `Conversacion.tsx`. Pasa a usar la misma. **Streaming:** no existe. `lib/anthropic.ts` no tiene nada de stream, y sólo lo hacen `app/api/chat-agent/secuencias/ia/route.ts` y `app/api/retro/route.ts`. Es infraestructura nueva y sin costo estimado, así que la etapa 1 va sin streaming («escribiendo…» y la respuesta entera). En el Centro, hoy la respuesta llega con el refresco de cada 8 s (`REFRESCO_MS`, `wt:CentroApp.tsx:77`). |
| Hilo | `wt:app/admin/operaciones/Hilo.tsx` (sin hooks, ya compartido entre escritorio y teléfono) | sus dos formas, «co-yo» y «co-el», y la píldora del día | El texto plano con pre-wrap pasa a `bloques`. La hora tiene **dos** fijos: la zona `'America/Argentina/Buenos_Aires'`, y `diaAR`, que resta UTC-3 a mano (`wt:Hilo.tsx:28`). Los dos pasan a la prop `zona`, que sale de `zonaDelNegocio(ws)` (`AGENTS.md:1315`). |
| Pregunta tipo Claude Code | `wt:app/admin/operaciones/Pregunta.tsx` y `wt:lib/centro-preguntas.ts` | las teclas 1-9, «(Recomendada)», «Escribe otra cosa» y que sigue la pregunta por id | Su tipo hoy es `Decision`, y responde con `AccionResponder(prev, FormData)` (`wt:app/admin/runway/decisiones.ts:101`), no con `(id, clave, texto)`: el adaptador del Centro traduce. **No cubre la tarjeta pendiente.** `TarjetaPendiente` (`lib/mako-turno-app-reglas.ts:125-145`) trae `consecuencia`, `vence`, `detalle` y `deshacer`, y `Pregunta` no tiene lugar para eso. La tarjeta es una pieza aparte (ver la API). |
| Riel derecho | `wt:app/admin/operaciones/Avance.tsx` (Rombo, ListaAvance, RielAvance, BarraAvanceMovil) | sólo el dibujo: el rombo y el riel | Los datos del Avance (commits y pushes de Vercel) son de Claude Code. En el cliente el riel se llama **«Lo que hizo»**, no «Creaciones», que ya son las estrellas (ver (c)). **No tiene de dónde leer:** lo único que ata un chat con lo que hizo es `mako_acciones_pendientes.grupo_jid = 'app:<sesión>'` (migración 0085). Las propuestas de pantalla viven en otras tablas. En la etapa 2 lee sólo eso. |
| Muñeco | `wt:app/admin/operaciones/Muneco.tsx`, `ElegirMuneco.tsx` y `wt:lib/centro-munecos.ts` | el SVG (puro, sin ids) | **No se reusa tal cual.** `aspectoDe` saca la familia, y si es sub-chat, del título (el prefijo y `/[›>]/`). Eso choca con la decisión 2, porque renombrar le cambia el muñeco. Lo elegido se guarda por nombre, así que dos personas con un sub-chat que se llama igual comparten muñeco. En el cliente, el aspecto y lo guardado van por la **clave** del chat. |
| Lógica pura | `wt:lib/centro-chats.ts`: `partesDelNombre`, `porJefe`, `SEPARADOR_JEFE` y `nombreValido` | `porJefe`, `SEPARADOR_JEFE` y `nombreValido`, con `tests/centro-chats.test.ts` | Se muda a un lib común. `partesDelNombre` (el árbol por nombre) queda en `centro-chats`, sólo para Claude Code. |

### La API de la pieza

```ts
<ChatMako
  chats={ChatItem[]}        // {clave, jefe, titulo:'Bienvenida', estado, actividad, previa, espera}
                            // el árbol sale de `jefe` (de la clave); `titulo` es sólo lo que se muestra
  elegido onElegir
  mensajes={Mensaje[]}      // {k:'yo', texto, tick?, adjuntos?} | {k:'el', rotulo?, bloques: Bloque[]}
                            // Bloque = markdown | imagen{url} | pdf{url,nombre} | html{srcdoc} (iframe sandbox) | creacion{clase,titulo,href}
  escribiendo={string|null} // «escribiendo…»; el texto en streaming es infraestructura nueva
  preguntas={PreguntaChat[]} onResponder={(id, clave, texto) => Promise<{ok}|{ok:false,error}>}
                            // el adaptador del Centro lo traduce a AccionResponder(prev, FormData)
  tarjetas={TarjetaPendiente[]} onConfirmar onDescartar
                            // consecuencia pegada al botón, vence, detalle y deshacer
  caja={{puede:true, aviso?} | {puede:false, texto, accion?}} borrador onBorrador
                            // con puede:false, `texto` dice qué hacer y para qué, no el estado interno
  onMandar={(texto, adjuntos) => Promise<{ok}|{ok:false,error}>}
  hecho?={Nodo[]}           // el riel «Lo que hizo»; si no viene, no se dibuja el botón
  munecos onGuardarMuneco? onRenombrar? onNuevo?
  accesos? pieBarra? vista? // slots: lo que no viene no se dibuja
  zona={IANA} modo={'pagina'|'panel'}
/>
```

### Decisiones tomadas en este diseño

Son técnicas. No se le preguntan a Martín.

1. **Motor único: `turnoApp`, con un filtro NUEVO por clave de tab.**
   - Hoy las áreas las elige `areasDelMensaje` por las palabras del pedido (`lib/mako-intencion.ts:1147`). El turno carga como mucho 12.000 caracteres de catálogo (`PRESUPUESTO_REGISTRO_CHARS`, `lib/doer-herramientas.ts:28`).
   - `toolsDelRegistro` filtra por `area`, no por `gating.tab` (`lib/api-mako/registro.ts:192-199`). No hay un filtro por tab, y las claves no calzan con las áreas:
     - `graphics` es el área `metricas`.
     - `script` es el área `ads`: sus 21 operaciones están mezcladas con las 39 de Ads Manager.
     - `landing-an` es el área `landing`, junto con las 65 operaciones de `landing-writer` y las 19 de `integraciones`.
   - Fijar áreas metería Ads Manager y Web Generator enteros en el Dashboard. Por eso se suma un filtro por lista de claves en `FiltroTools` (y por áreas para lo que no tiene clave, ver (b)).
   - **El presupuesto no alcanza, ni en la etapa 1.** Medido con `aToolDef`, en caracteres:

     | Jefe | Claves | Operaciones | Acciones | Todas | Sólo acciones de la app |
     |---|---|---|---|---|---|
     | Dashboard | `graphics` + `script` + `closing` | 84 | 32 | 83.795 | 39.864 |
     | (la hoja abierta del Dashboard) | `graphics` | 47 | 17 | 54.950 | 26.377 |
     | General | `general` | 23 | 10 | 24.864 | 17.379 |
     | CRM | `crm` | 99 | 56 | 87.551 | 60.800 |
     | Web Generator | `landing-writer` + `landing-an` + `integraciones` | 99 | 53 | 92.722 | 61.967 |

     La acción más grande es `editar_grafico_dashboard`, con 4.119 caracteres. Con `landing-an` también en el Dashboard, como decía el borrador, eran 90 operaciones y 88.645 caracteres.
   - **Qué se hace:**
     - En el panel de la hoja abierta (etapa 1), el turno carga las acciones de esa clave y las lecturas que pida, con un tope propio que sale de esta medición. No usa los 12.000. El costo de esos tokens no está medido.
     - En los jefes grandes (CRM, Web Generator), ningún tope razonable alcanza. Acota el sub-chat (un lead no necesita las acciones de campañas) y `relevanteA` ordena adentro. Cómo se acota cada sub-chat se decide en su etapa.
     - El corte deja de avisarse sólo por `console.warn` (`registro.ts:210`), porque «un `console.warn` no es un control» (`AGENTS.md:2341`). Si algo quedó afuera, el turno lo sabe y lo dice.
2. **La jerarquía jefe › sub sale de la CLAVE, no del título. Hoy esa clave no existe, y es una convención nueva.**
   - El prefijo de `chart_key` no hace de jefe:
     - El lead no cuelga del CRM: son hermanos (`mako-movil:u5:lead:123` y `mako-movil:u5:crm:<id>`).
     - `chartKeyDelLead` y `chartKeyDelCrm` rechazan anidar a propósito (`lib/mako-analyst-lead-reglas.ts:44-50`, `app/crm/mako-crm/chat-reglas.ts:43-49`).
     - `dashboard:${hoja}:${comp}` no lleva persona.
   - **Qué se hace:**
     - Cada `ChatItem` trae `jefe` explícito, que calcula una función pura `jefeDeClave(chart_key)` sobre los prefijos de hoy: `dashboard:` es Dashboard, y `…:crm:` y `…:lead:` son CRM.
     - Es una lectura: no reescribe claves ni toca la regla de anidar. El lead cuelga del CRM en la lista, no en la clave.
     - Los chats nuevos llevan la tab en la clave. Renombrar cambia sólo `titulo`, así que un cliente que renombra no rompe el árbol.
     - `chart_sessions` no tiene columna de padre (migraciones 0031 y 0032) y no hace falta.
   - **El Centro es otro caso.** `ChatCentro` tiene `sesion` (`local_…`/`cli_…`), y `claveDe` la usa (`wt:lib/centro-chats.ts:84-87`). Une por nombre por decisión de Martín, para juntar las tres cuentas (`AGENTS.md:1232-1236`), y así se queda.
   - La convención para clientes va a `AGENTS.md`, junto a la del Centro (líneas 1197-1245).
3. **Los chats nuevos son por persona, como en el teléfono.**
   - `lib/chart-chats.ts` documenta la fuga del 11/10: un closer leía por id lo que el dueño había hablado en el celular.
   - Hoy la lista de `/mako` es por workspace (`listAllSessions`).
   - **Choca con la decisión 5.** Offer (`offer_sesiones`, migración 0254: sólo `workspace_id`), Automations (`app_settings` por workspace) y los chats `dashboard:` son por workspace, no por persona.
   - **Qué se hace:**
     - El índice declara, por origen, `alcance: 'persona' | 'workspace'`. Lo que es por workspace lo ve sólo quien entra a esa tab.
     - Pasar `dashboard:`, `mako-general`, `meta-cuenta` y `ad-detail-` a por persona **sí pide migrar datos**, así que en las etapas 1 a 3 se quedan por workspace.
4. **Un solo formato de mensaje: el `ItemHilo` del teléfono más `bloques`.**
   - El `ItemHilo` (`app/m/mako/chat-ui.ts`) ya trae estados, adjuntos y propuestas.
   - `chart_chats.content` es sólo texto, así que los bloques piden una columna jsonb: **una migración**.
   - Los adjuntos hoy NO se guardan: en su lugar queda «(envió una imagen: nombre)». Pasan a guardarse en el bucket `archivero`, como hace Offer con el audio.
5. **Offer y Automations no se mudan.**
   - Tienen formato propio y compare-and-set (`lib/offer-sesiones.ts`, `lib/automatizacion-chat-db.ts`).
   - Los lee un **índice de chats** nuevo, que junta los orígenes sin copiar filas (con el `alcance` de la decisión 3).
   - Web Generator y Video Editor empiezan a guardar. Hoy su hilo vive en la memoria de la pestaña (`app/web-generator/editor/paneles/PanelAgente.tsx`, `app/video-editor/_opencut/chat/PanelChat.tsx`).
6. **La CSS se parte en dos.**
   - `wt:app/admin/operaciones/centro.css` tiene 841 líneas: 33 reglas son de `.co-runner` y 21 de `.co-uso`.
   - Sus cortes miran la ventana (1100, 1000 y 720 px). Como panel adentro del Dashboard no saltaría ninguno, así que el `modo` o las container queries son obligatorios.

### La pieza «entender el pedido» (la construye Web Generator; acá se usa)

Martín (16/10), por el coordinador: que todo chat entienda pedidos sueltos. Tres casos:

- «Quiero eliminar la otra automatización que tengo porque podría unificarla», sin nombrarla: interpretar cuál es y, de
  última, preguntar.
- «Feedback de lo actual… y también créame otra landing»: llamar esa función, o proponer «¿terminamos esto y luego
  creamos la otra landing?».
- Un pedido de otra tab: dejar el link.

Su frase: «Esto se logra teniendo el Second Brain con todo, y la API de MaKo».

- **Dueño: el chat Web Generator.** Lo escribe en `lib/`, sobre el registro de la API de MaKo, y lo enchufa primero a su
  propio chat. Este diseño NO lo duplica: la pieza única lo llama desde `turnoApp`, antes de elegir herramientas.
  Medido el 16/10 en `origin/main` y en sus ramas: todavía no existe. La rama `web-pedidos` no trae nada que main no
  tenga.
- **Lo que ya hay y es pariente, para no escribirlo dos veces:**
  - `lib/mako-intencion.ts` contesta «qué te están pidiendo» sin costo (`clasificarIntencion`, `areasDelMensaje`,
    `esPedidoDeLanding`, `esPedidoSobreLead`…). Nació de un caso real: MaKo contestó un pedido nuevo con material de
    33 h antes.
  - `linkPantalla` (`lib/api-mako/link.ts`) arma el link a otra pantalla con el workspace puesto.
  - La pieza nueva va ARRIBA de estos dos, no al lado.
- **El contrato mínimo:**
  - **Entra:** el pedido, el chat (su jefe, su sub-chat y lo que se habló) y el Second Brain del negocio, que es de donde
    sale «la otra automatización».
  - **Sale una de tres:**
    1. las acciones de la API a proponer, en orden, con la entidad resuelta por id;
    2. UNA pregunta, sólo si de verdad no se puede deducir (la regla «decidir con criterio»);
    3. un link a la pantalla de otra tab, si el pedido es de ahí.
  - Nunca ejecuta: propone por el mismo camino que todo canal (`ejecutarOperacion` → pendiente o pantalla).
- **Lo que no puede saltearse:** la confirmación. Una acción que resolvió «la otra» por inferencia lleva en la tarjeta
  CUÁL eligió («Borrar "Bienvenida vieja"»), para que el «sí» sea sobre algo nombrado.

### Lo que queda sólo del super admin

Esto no entra en la pieza: se enchufa por slots en el adaptador del Centro.

- **La firma:** `wt:.../mandar.ts` y `clave-dispositivo.ts`, más `onCrearClave` y `onCopiarClave`.
- **El Runner y el uso:** el Runner (`PanelRunner.tsx`) y el uso de las cuentas (`Uso.tsx` con `lib/centro-uso.ts`).
- **Crear chats y la Ticketera:**
  - `NuevoChat.tsx` arma a propósito un comando de PowerShell, como explica `wt:NuevoChat.tsx:10-15`. Se commiteó en `4a004a28a` y `f0eb6a80c` (03:34 y 03:35).
  - `TicketeraCentro.tsx`.
- **Lo que tiene en la caja:**
  - el chip de alcance «Sólo esto / Y de ahora en más» (`Alcance`);
  - `comoSale` y `Envio`;
  - los chips de cuenta.
- **La lista de chats:**
  - las secciones de `seccionesDeChats`: «Cerebro», «Sin asignar» y «Antes del 16/10»;
  - `esperasPorChat` y `enQueTrabaja`;
  - `unirPorNombre`, que junta las tres cuentas, y `textoDeRenombre` (`set_session_title`);
  - `chatsDeBitacoras`.
- **`tabs.ts`:** `nombresDeTabs` mezcla etiquetas de admin con áreas de dev. Para un cliente, los jefes salen de las tabs de su capa.
- **Los datos del Avance:** commits y pushes de Vercel.
- **La guarda:** `puedeOperar(admin, wsSuperAdmin())` de `wt:.../acciones.ts`.

---

## (b) El mapa tab por tab

Las «ops» son operaciones reales del registro, `lib/api-mako/registro.ts`: 682 en total, contadas por `gating.tab`. La clave de la tab va entre paréntesis. «Acciones» cuenta todas las de esas claves. Dónde se confirman sale del campo `confirmacion` de las que tienen canal `app`.

| Tab (claves) | Jefe | Sub-chat | Qué edita la IA por la API (ejemplos reales) | Chat hoy | Falta |
|---|---|---|---|---|---|
| **General** (`general`) ⚠️ | «General» | una hoja, un objetivo o un KPI | 10 acciones de 23 operaciones. 7 confirman en el chat y 3 por pantalla (dejan un link). Ejemplos: `crear_hoja_general`, `agregar_bloque_general`, `configurar_bloque_general`, `guardar_objetivo`, `guardar_kpi`, `registrar_valor_kpi` | **ninguno** (`app/general`: 0) | Montar el chat. Bug, ver «Pídeselo» abajo. `crear_hoja_general` sólo acepta `plantilla`, no `pedido`. |
| **Dashboard** (`graphics`+`script`+`closing`) ⚠️ | «Dashboard» | una hoja o un gráfico (adentro de `graficos.tablero.<sub>`) | 32 acciones de 84 operaciones: 17 de `graphics` (todas confirman en el chat), 11 de `script` y 4 de `closing`. Ejemplos: `editar_hoja_dashboard`, `agregar_grafico_dashboard`, `editar_grafico_dashboard`, `quitar_componente_dashboard`, `agregar_filtro_dashboard`, `generar_conclusiones_dashboard` | por gráfico, sólo análisis (`PanelAnalista.tsx`), y «Pídeselo» sólo para una hoja nueva | un chat que edite la hoja abierta |
| Second Brain (`second-brain`, más el área `negocio`) | «Second Brain» | un área del grafo | 2 lecturas, sólo para admin: `buscar_en_segundo_cerebro` y `leer_segundo_cerebro_como_archivos`. Lo que escribe su contenido está en el área `negocio`, que no tiene `gating.tab` (`guardar_campo_perfil`, `guardar_diagnostico_fase`), y en `editar_avatar_negocio` (área `negocio`, clave `ads-writer`) | no | subir un documento al Archivero (no hay operación) |
| CRM (`crm`) | ya existe: `ChatMakoCrm.tsx` | el lead: ya existe `MakoAnalystLead.tsx` | 56 acciones de 99 operaciones (41 confirman en el chat y 15 por pantalla). `cobros` es un área adentro de `crm`. Ejemplos: `proponer_cambio_etapa`, `agregar_nota_lead`, `poner_etiqueta_lead`, `marcar_pago_cobrado`, `crear_link_pago` | sí, con `turnoApp` | colgar el lead de su jefe (`jefeDeClave`) y cambiarle la cara |
| Automations (`setting`) | «Automations» | una automatización: ya existe, `app/automations/ChatMako.tsx` | 26 acciones de 50 operaciones. Ejemplos: `crear_automatizacion_con_ia`, `editar_pasos_secuencia_mensajes`, `cambiar_crons_secuencia`, `agregar_escenario_secuencia`, `probar_secuencia` | sólo los sub-chats | el jefe (hoy es una caja suelta, `BarraPideselo`) |
| Offer (`offer`) | «Offer» | una conversación por oferta (`offer_sesiones`) | **0 acciones** (2 lecturas) | sí, con motor propio (`lib/offer-ia.ts`) | las operaciones en la API |
| Web Generator (`landing-writer`+`landing-an`+`integraciones`) | «Web Generator» | una landing (`landing_docs`) | 53 acciones de 99 operaciones (46 + 2 + 5). Ejemplos: `editar_landing_con_ia`, `cambiar_texto_landing`, `agregar_seccion_landing`, `publicar_landing` | `PanelAgente`, en memoria | guardar el hilo |
| Ads Manager (`ads-manager`) | «Ads Manager» | una campaña, un conjunto o un anuncio | 12 acciones de 39 operaciones. Ejemplos: `proponer_estado_campana`, `proponer_presupuesto_campana`, `proponer_editar_textos_anuncio` | por entidad, sin herramientas (`app/_components/ChartIA.tsx`) | crear una campaña (no hay operación) |
| Ads Writer (`ads-writer`) | «Ads Writer» | un guion | 18 acciones de 36 operaciones. Ejemplos: `escribir_guion_anuncio`, `editar_texto_guion_anuncio`, `elegir_formato_creativo_anuncio` | no | el chat |
| Chats y WhatsApp (`chats`+`whatsapp`) | «Chats» | una conversación con un contacto | 3 + 21 acciones. Ejemplos: `cerrar_chat`, `posponer_chat`, `crear_borrador_whatsapp_empresa`, `enviar_plantilla_a_meta` | el asesor, con diseño propio (`app/whatsapp/WhatsAppAdvisor.tsx`) | contestar por IG y Messenger (no hay operación) |
| Email (`email`) | «Email» | una secuencia o un broadcast | 12 acciones de 27 operaciones. Ejemplos: `crear_secuencia_email`, `crear_broadcast`, `programar_broadcast`, `enviar_broadcast` | no | el chat |
| Experiments (`experimentos`+`analisis`) | «Experiments» | un experimento o una retro | 9 acciones de 26 operaciones. Ejemplos: `crear_experimento`, `iniciar_experimento`, `cerrar_experimento` | no | el chat |
| Plan (`todo`) | «Plan» | un proyecto o una tarea | 9 acciones de 30 operaciones. Ejemplos: `proponer_tareas_plan`, `proponer_cierre_tareas`, `actualizar_avance_tarea` | modales del Perro, no un chat | Mover fecha o renombrar: `cambiar_fecha_tarea_plan` se nombra en `lib/doer-herramientas.ts:123` y no existe en el registro. |
| Calendario (`calendario`) | «Calendario» | un evento | 2 acciones: `crear_evento_calendario` y `crear_evento_google` | no | editar, mover o borrar un evento |
| Image Editor (`image-editor`) | «Image Editor» | un diseño | 4 acciones. Ejemplos: `crear_diseno_imagen`, `cambiar_textos_diseno_imagen` | no | el chat |
| Video Editor y Video Generator (`video-editor`+`video-generator`) | «Video Editor» | un proyecto | **0 acciones** (1 y 14 lecturas). Su chat tiene 32 operaciones y ninguna está en la API | `PanelChat`, en memoria | operaciones y guardar el hilo |
| Customer Success (`customer-success`) | «Customer Success» | un cliente | 9 acciones, 8 de ellas sólo por HTTP (las del curso). En el chat de la app hay una sola: `marcar_estado_cliente_cs` | no | el chat |

**Las claves de gating no son las tabs.**
- Ads Analyst (`script`), Closing (`closing`) y `landing-an` son tabs retiradas que siguen guardando operaciones. Por eso cada jefe lleva una **lista** de claves: si se filtra sólo por `graphics`, el Dashboard pierde 15 de sus 32 acciones.
- **`landing-an` va sólo a Web Generator**, porque diagnostica una landing. El borrador la ponía en dos jefes.
- `cobros` y `negocio` son áreas, no claves.

**72 operaciones no tienen `gating.tab`**, y 26 de ellas son acciones. Son las áreas:
- equipo (33)
- negocio (17)
- creaciones (8)
- mako (8)
- contenido (3)
- operaciones (2)
- experimentos (1)

El jefe «Second Brain» lleva el área `negocio`, que es su contenido. Las demás, y la clave `reels` (1 lectura), quedan sin jefe hasta su etapa.

**La trampa de Dashboard y General es el autoguardado.**
- El informe es un JSON que el navegador reescribe entero, con compare-and-set (`app/api/graficos/route.ts`). Hay dos 409:
  - Para un cuerpo sin `version`: «Recarga la página para seguir editando» (`:85` y `:99`).
  - Si la versión cambió: «El informe cambió en otra pestaña», con `conflicto: true` (`:88` y `:102`).
- **Ejecutar la operación por la API escribe en el servidor y deja afuera la pila de deshacer** (`AGENTS.md:7939`). Por eso `app/api/graficos/ia/route.ts:9-12` no escribe a propósito: con dos escritores el autoguardado pisa, y el editor da deshacer con `mutar`.
- **Lo que se decide:**
  - Con la hoja abierta, la acción confirmada **no escribe**: devuelve el informe cambiado, y el editor lo aplica con `mutar`. Hay un solo escritor, el Ctrl+Z sigue vivo y no hay 409.
  - Pide un modo nuevo en las operaciones de `dashboard.def.ts` y `general.def.ts`.
  - Por WhatsApp y HTTP la operación sigue escribiendo, y si hay un editor abierto, recibe el «cambió en otra pestaña».

**El informe se elige por persona.** Las operaciones del Dashboard y de General resuelven el informe con el parámetro `persona` (`dashboard.def.ts:8-11`, `elegirPersona` en `dashboard.helpers.ts:98-139`). Si la cuenta tiene más de un informe, contestan «di de quién es». En el canal app, la persona es la del que chatea, fijada por el turno y no por el modelo.

**El bug de «Pídeselo» en General** (leído en el código, no probado en el navegador):
- «Pídeselo a MaKo» manda sólo `{pedido}` (`app/dashboard/NuevaHoja.tsx:344-347`), y `lib/graficos-ia-generar.ts` no conoce General (grep 0).
- `sanearHoja` (`lib/graficos-catalogo.ts:1760`) no mira `TIPOS_GENERAL`, que sólo se usa en `EditorInforme.tsx:108` y `:1401`.
- `guardarTableroSi` tampoco filtra (`lib/graficos-tablero.ts:197-221`).
- **Hoy arma y guarda una hoja de General con tipos del Dashboard.** Eso viola «General ofrece poco del Dashboard».

---

## (c) Second Brain como la casa de todo

En cada tab, la pieza se monta **filtrada a su jefe**, en `modo='panel'`. En `/second-brain` se monta **sin filtro**, en `modo='pagina'`, y ahí se ven todos los jefes con sus sub-chats.

**La pantalla se vuelve oscura.** `/second-brain` fuerza el tema oscuro (`TemaOscuro`; `AGENTS.md:4205` dice «hoy solo /second-brain»), así que si pasa a ser la casa de todos los chats, todos se ven oscuros ahí. Los paneles de cada tab siguen en el tema claro.

### Dónde va el grafo

Lo que condiciona:
- El grafo recibe sólo seis props (`app/second-brain/Grafo.tsx:103`).
- Su alto sale de la ventana, `clamp(420px, 100svh-280px, 760px)` (línea 1135), y sus cortes también.
- El Centro ya tiene el patrón: la Ticketera es un acceso arriba de la lista que reemplaza el panel y queda en la URL. Está en `wt:CentroApp.tsx`, en tres lugares:
  - el `replaceState`, en la línea 104;
  - el botón, en las líneas 371-375;
  - `<TicketeraCentro`, en las líneas 426-432.

  El archivo tiene 504 líneas, y `TicketeraCentro.tsx` tiene 50.
- **`?vista=` ya está ocupado.** `/second-brain?area=X&vista=Y` lo usan `VistaCerebro.tsx:45-48`, `SUBVISTAS` y `rutaSeccion` (`lib/secciones-negocio.ts:72-75`). «Mapa» va en `?panel=mapa`.

| Copiada de | Cómo queda | A favor | En contra |
|---|---|---|---|
| **1. Obsidian** (el grafo es una pestaña; el grafo local va en la barra derecha) | El botón «Mapa» arriba de la lista abre el grafo en el panel (`?panel=mapa`). Tocar un nodo abre «Second Brain › <Área>». En el teléfono, una fila «Mapa» a pantalla completa. | Mantiene intacta la vista del Centro. Reusa el patrón de la Ticketera. Es la única que funciona en el teléfono. A los permisos los resuelve el servidor (ver abajo). | A 1440 px el lienzo pasa de unos 860 a unos 650 px (cuenta hecha con el CSS, no medida en el navegador). `Grafo.tsx` tiene que pasar a container queries. |
| 2. Heptabase (el lienzo es la casa y el chat se abre al costado) | El grafo ocupa el panel y el chat de un nodo se abre en un cajón de unos 420 px. | Es la versión más literal de «lo de abajo del grafo vive como chat». | Deja de ser la vista del Centro. Habría dos diseños de chat. No sirve en el teléfono. Closer y setter no ven el grafo. |
| 3. Slack (pestañas Chat, Mapa y Lo que hizo en cada chat) | Cada jefe muestra su pedazo del grafo. | El mapa queda pegado a su contexto. | Suma una segunda navegación por chat. Hoy casi ningún jefe tendría nada que dibujar, y falta un filtro por área. |

**Recomendación: la 1, en dos etapas.**
1. **Ahora:** «Mapa» como la Ticketera. Al entrar se abre el jefe «Second Brain», no el mapa.
2. **Después:** el grafo local en el riel derecho, cuando los chats sean nodos.
   - Es una idea nueva.
   - `docs/hallazgos-second-brain.md:939` habla del grafo local como un re-encuadre a 2 saltos al fijar un nodo, no de chats como nodos en el riel.

Respeta la lección que ya se pagó: una segunda navegación que le competía al grafo se fue (`docs/hallazgos-second-brain.md:1220`). El grafo es UNA vista de lo mismo.

### Cómo se alimenta de los chats sin duplicar

- **Principio, ya escrito:** el grafo es una PROYECCIÓN que se recalcula al leer. `construirCerebro()` hace 21 lecturas en cada carga (`lib/cerebro-grafo.ts:209`) y no hay ninguna tabla de nodos. Lo nuevo entra como **lectores**, nunca como copias a markdown ni a `mako_knowledge`.
- **Qué entra:**
  - **Un nodo por chat jefe con conversación**, no por mensaje. Se une a la entidad que nombra su clave (oferta, landing, automatización o lead) con su `motivo`.
    - Si no tiene arista lateral, entra agregado en un solo nodo o no entra.
    - Si no, sube el porcentaje de hojas (el tope es 30%) y el grafo vuelve a ser un diente de león.
  - **Lo creado:** `landing_docs`, `ofertas` (migración 0169), `image_disenos` (0278), `meta_campaign_drafts` y `creaciones` (0273).
    - La tabla `creaciones` es de todos los negocios (`AGENTS.md:2548`). Cada lectura lleva `workspace_origen = ws` explícito.
    - **El nombre «Creaciones» ya existe:** son las estrellas, con `lib/creaciones.ts`, la galería `/creaciones` y el área `creaciones` de la API. Por eso el riel de la pieza se llama «Lo que hizo».
- **Cuándo:** al leer, como hoy, pero con el layout persistido.
  - La `huella` y el camino `previo` de `lib/cerebro-layout.ts` están escritos y nadie los llama.
  - El tiempo crece con los nodos: 58 nodos tardan 141 ms y 150 nodos, 451 ms.
  - Si el layout se cachea en memoria, la clave lleva el workspace (`AGENTS.md:2210`).
- **Antes de sumar fuentes**, poner al día cuatro lecturas viejas de `lib/cerebro-grafo.ts`:
  - `sec.etapa` (línea 690) ve un solo CRON;
  - `pasos.length` (línea 695) cuenta nodos que no son mensajes;
  - sólo entra el funnel por defecto;
  - el área Oferta no lee la tabla `ofertas`.
- **Medir con `scripts/medir-grafo.mjs` antes y después.**
- **Que el chat lea el cerebro:**
  - Hoy `buildSystemPrompt` (`lib/mako-context.ts`) nunca llama a `construirCerebro`.
  - La búsqueda por significado vive dentro de `/api/second-brain/buscar`, con el prompt fijo en el código. Hay que mudarla a `lib/` con el prompt editable.
  - La herramienta ya está declarada: `negocio.def.ts:225-242`.
- **Lo de abajo del grafo** (`app/second-brain/AreasHub.tsx`) pasa a ser sub-chats «Second Brain › <Área>» que muestran las MISMAS vistas `app/onboarding/*View.tsx`.
  - Se muda cambiando la fila en `DONDE_SE_EDITA` (`lib/secciones-negocio.ts`), y todos los links la siguen solos.
  - Un solo separador: «›». `lugarSeccion` hoy dice «Second Brain → Persona» y pasa a «›» en el mismo trabajo.
- **Permisos:**
  - Hoy `/second-brain` es sólo del admin. El guard está en `app/second-brain/page.tsx:41` (`requireRolWs([], …)`), y `lib/tab-access.ts:97` es el comentario que explica qué significa `[]`.
  - Closer y setter entran a `/mako` (`nav.ts:419`).
  - **Lo que se decide:** en `/second-brain`, closer y setter ven sus chats, pero no «Mapa» ni las áreas.
    - El corte va **en el servidor**, no escondiendo el botón: `page.tsx:53` calcula `construirCerebro()` sin condición, y eso pasa a depender del rol (`AGENTS.md:4333` y `2574`).
    - Las dos herramientas del Second Brain siguen siendo sólo para admin.
  - `/mako` y `/mako-doer` redirigen con `rutaConWs` (`AGENTS.md:1102`).
  - `/mako/pendientes` y `/mako/revisar` **se quedan**: los nombran 56 archivos fuera de `app/mako` (`RUTA_BANDEJA`, `lib/api-mako/acciones.ts:57`).
  - En el teléfono, `/m/mako` pasa a ser el Second Brain del teléfono. Hoy `app/m` no tiene ninguno (grep 0).

### El chat de MaKo por WhatsApp es un chat más

Martín (16/10): «Incluso el chat de MaKo en WhatsApp debería guardarse como chat en los second brain, y de esa forma, es
mucho más facil que guarde contexto de absolutamente todo y pueda acceder a las acciones de MaKo mediante la API muy
facil».

**Lo que hay hoy** (leído en `origin/main` el 16/10):
- **MaKo contesta SÓLO en grupos.** El webhook manda al doer los mensajes `…@g.us` y, en las líneas de MaKo, ignora el 1
  a 1: «línea de MaKo: solo mensajes de grupo» (`app/api/webhooks/evolution/route.ts`). El 1 a 1 que llega por ahí es el
  espejo del inbox de cada cliente con SUS leads, no una charla con MaKo. **El «1 a 1 con MaKo» que pidió Martín no
  existe todavía.**
- **La conversación del grupo ya se guarda**: `mako_doer_conv` (mig 0086, por workspace) guarda un turno por fila, con
  `grupo_jid`, `role` (`user` | `assistant`), el texto (o la transcripción de la nota de voz) y `wa_message_id`. **No
  guarda quién de las personas del grupo habló**: todo lo humano es `user`.
- **Al contestar, MaKo re-lee sólo 14 horas y 24 turnos** (`HORAS_CONTEXTO`, `lib/mako-doer-conv.ts`). El corte es a
  propósito: con 48 h, un «sí, cargalo» se pegó a una charla de cuatro días antes y duplicó dos tareas del tablero.
- **Las acciones ya son las de la API de MaKo**: el doer usa el mismo registro con el canal `whatsapp`, y la pendiente
  queda con la clave del grupo (`mako_acciones_pendientes.grupo_jid`).

**Cómo entra al Second Brain, sin copiar:**
- **El índice de chats lo LEE de `mako_doer_conv`**, como a los demás orígenes: un chat por grupo, con la clave
  `whatsapp:<grupo_jid>` y el jefe que le toca. El grupo del negocio cuelga del jefe «Second Brain», porque habla de
  todo. No se copia una fila y no hace falta migrar.
- **«Guardar contexto de absolutamente todo» NO es re-leer más historial.** Agrandar la ventana es exactamente lo que
  duplicó tareas.
  - Lo que el chat de WhatsApp necesita saber de antes lo trae el Second Brain como HECHOS: lo creado, lo decidido y lo
    que hay en el negocio. No vuelve como turnos viejos.
  - Y vale al revés: el chat de la app no re-inyecta la charla de WhatsApp; lee lo que de ahí quedó hecho.
- **Las mismas acciones desde cualquier lado, pero cada «sí» en su canal.** Una pendiente propuesta en WhatsApp se
  confirma en WhatsApp o en la bandeja de la app (`/mako/pendientes`), nunca con un «sí» en otro chat (`canal.ts`: «un
  "sí" solo alcanza lo que se propuso en ESTE canal»). La pieza única puede mostrar la tarjeta en los dos
  lados, pero se confirma sólo en su canal o en la bandeja.
- **El 1 a 1, si se construye**, va en la misma tabla, con `…@s.whatsapp.net` como clave. Para eso:
  - el webhook tiene que dejar de ignorarlo en la línea de MaKo, sin mezclarlo con el espejo del inbox de los clientes;
  - la persona sale del teléfono (los teléfonos del workspace).
  - Es trabajo nuevo, y su lugar es la etapa 2.

**Quién lo ve:**
- **El chat del grupo es del NEGOCIO** (`alcance: 'workspace'`). En `/second-brain` lo ve **sólo el admin**: trae montos,
  nombres de leads y decisiones, y la fila no dice quién habló. Closer y setter no lo ven, con el corte en el servidor,
  igual que «Mapa».
- **El 1 a 1, cuando exista, es de esa PERSONA** (`alcance: 'persona'`), como los chats nuevos de la app (decisión 3).

**La PII** (la regla del 16/10, `AGENTS.md` en `origin/main`: «los datos de los clientes de un cliente nunca van a un
proveedor que entrena con lo que recibe»):
- **El doer de WhatsApp ya está marcado `pii: true`** (`mako-doer-in`, `lib/model-catalogo.ts`). **Los de la app NO**
  (`mako-doer`, el de `turnoApp`, y `mako-chat`).
  - En cuanto un chat de la app LEA lo de WhatsApp, o cualquier cosa con leads, pasa a llevar la marca. Es la regla:
    «una feature nueva que lea leads, conversaciones o llamadas se marca `pii: true`».
  - Con la marca, contesta sólo un proveedor que no entrena: el Claude del negocio, conectado con su clave (la «segunda
    puerta» de `lib/veto-claude.ts`), o una key de Gemini con facturación.
  - Si no hay ninguno, el chat se corta y dice que conecte su Claude. No se degrada a una key gratis.
- **El crédito de Claude de la PLATAFORMA no cuenta para los chats.** Desde el 16/10 lo usa sólo lo que lista
  `CREDITO_HABILITADO_PARA`: cuatro funciones del onboarding, y sólo mientras el onboarding está en curso. La única
  que es un chat es el de Offer del primer ingreso; pasado el onboarding, tampoco. «La regla
  nueva: datos de clientes, sólo por el crédito de Claude» se lee así: por el Claude DEL NEGOCIO, o por lo que no
  entrena. Nunca por el de MaKo.
- **Lo que se guarda no cambia de lugar**: `mako_doer_conv` es una tabla del inquilino, con RLS. El índice lee dentro de
  `runWithWorkspace` y nunca la junta con la de otro negocio.

### El Centro del super admin pasa a ser su Second Brain

- **El super admin ya tiene su orquestador.** Desde `f83efea40`, el Centro tiene un chat «Cerebro» que no es jefe y va arriba (`wt:lib/centro-chats.ts:222-230` y `500-516`). Es lo que corresponde a «al entrar se abre el jefe Second Brain».
- `CentroApp.tsx` queda como **adaptador** de la pieza. Cada cosa entra por su lugar:
  - `LineaChat` → `Mensaje`;
  - `Decision` → `PreguntaChat`, con `onResponder` traducido a `AccionResponder(prev, FormData)`;
  - `comoSale` → `caja`;
  - `useFirma().mandar` → `onMandar`;
  - en `accesos`, Ticketera y Mapa;
  - en `pieBarra`, `BotonUso`.
- La ruta sigue guardada con `puedeOperar`. En la barra se llama «Second Brain».
- **Su mapa** es `construirCerebro()` dentro de `runWithWorkspace(wsSuperAdmin())`, no graphify sobre el código. La cabecera de `app/second-brain/page.tsx` avisa esa diferencia.
- **Sus chats son de Claude Code, no de MaKo.** La pieza sirve para los dos porque no sabe de firmas.
- **Antes, la rama `centro-chat` tiene que estar en main.** La lista de lo que falta está en la «Base de lo medido».
- La lista del Avance en `localStorage` (`CLAVE_AVANCE`, `wt:CentroApp.tsx:82`) y cualquier borrador guardado llevan el workspace en la clave (`AGENTS.md:8293`).

---

## (d) Las criaturas personalizables para clientes

- **Qué hay:**
  - 7 formas × 9 colores × 6 caras = 378 muñecos (`wt:lib/centro-munecos.ts`). Los colores son tokens `--grafo-*`, y los 9 están en `app/globals.css` de main.
  - Los **ojos no se eligen**: dicen el estado del chat (`animoDe`: trabajando, despierto, cansado o dormido).
  - `EQUIPO` tiene 22 entradas, porque se sumó `cerebro`. Los sub-chats heredan cuerpo y color de su jefe. Pero:
    - **Varias no son tabs:** estrategia, centro de operaciones, mako mobile, mako pricing, onboarding, integración, pagos y seguridad.
    - **Hay tabs sin muñeco fijo:** General, Second Brain, Chats, WhatsApp, Email, Experiments, Calendario y Video Generator.
    - **Ads Manager y Ads Writer comparten el prefijo `ads`**, así que les toca el mismo cuerpo y color.
  - Para el cliente, `EQUIPO` sale de las tabs de su capa, con un muñeco por jefe y distinto para cada tab.
- **Qué se elige:** forma, color y cara, con el dado de `ElegirMuneco.tsx`.
  - El nombre del jefe no se elige: es el de la tab.
  - Un sub-chat se puede renombrar, y el muñeco no cambia porque va por la clave del chat, no por el título (ver (a)).
- **Dónde se guarda:**
  - Hoy: en `app_settings` del workspace de la plataforma, clave `operaciones.munecos`, con tope 400 (`wt:lib/centro-munecos-db.ts`).
  - Para el cliente:
    - misma lectura estricta con `sanearAspecto`, pero dentro de `runWithWorkspace(<ws del cliente>)`;
    - con una acción propia que pide la sesión y el workspace (skill tenant-safe-query), no `puedeOperar`;
    - con la acción declarada en la API de MaKo (`AGENTS.md:855`).
  - **Con compare-and-set.** Hoy `guardarMuneco` lee el mapa entero, lo cambia y lo vuelve a escribir sin compare-and-set (`wt:lib/centro-munecos-db.ts:30-43`). Con varias personas en un mismo negocio se pierden cambios. El molde es `lib/automatizacion-chat-db.ts:91-92`.
- **Alcance decidido: por workspace.**
  - Es el «empleado» del negocio, y todo el equipo lo ve igual.
  - El admin cambia el de un jefe, y cada persona el de sus sub-chats.
  - Como la clave del sub-chat lleva a la persona (decisión 3), dos personas con un sub-chat del mismo nombre no comparten muñeco.
- **Las animaciones salen a su propia hoja.** Son 6 líneas de `centro.css` (556-561): 3 reglas, 2 `@keyframes` y 1 `@media`. Hay 4 reglas más con `.mun` desde selectores `.co-*` (líneas 141, 343, 764 y 800), y se mudan también.

---

## (e) El orden por etapas

0. **Requisito, que no se ve: subir la rama `centro-chat` a main.**
   - Hoy está commiteada y sin nada pendiente, pero otro chat sigue commiteando.
   - Lo hace el coordinador cuando ese chat termine, y el worktree no se toca.
   - Desde la base común, sólo `AGENTS.md` y `docs/hallazgos.md` cambiaron en las dos ramas.
   - El clon de main también está divergido de origin (6 y 22 commits).
1. **Primero, chico y visible: «Editar con MaKo» en Dashboard y General.**
   - Un panel con la pieza mínima: hilo, caja y la tarjeta que se confirma, sin barra de chats y sin streaming.
   - **Pantalla copiada:** falta nombrar la app de la que se copia el panel (`AGENTS.md:1441`). Candidata: el panel lateral de Gemini en Google Workspace, porque el Dashboard copia Looker Studio.
   - Corre en `turnoApp` con el filtro nuevo por clave (`graphics` o `general`) y el tope propio medido en (a).
   - La persona del informe es la del que chatea.
   - La hoja abierta se cambia con `mutar`: la acción devuelve el cambio y no escribe (ver (b)).
   - Incluye el arreglo de «Pídeselo» en General. Ese arreglo llega también a la API: `crear_hoja_general` acepta `pedido`, y el saneo respeta `TIPOS_GENERAL`.
   - Tocar `EditorInforme` obliga a correr `tests/graficos*` y `tests/dashboard-*` (`AGENTS.md:8341`).
   - **Falta decidir qué pasa en el teléfono y en la tableta.** `app/m/dashboard` existe, y no se midió si edita.
   - Con una frase («agrega el CPL por semana»), el gráfico aparece.
2. **La pieza completa y el Second Brain:**
   - la barra jefe › sub, con `jefeDeClave`, y los muñecos;
   - `/mako` y `/mako-doer` pasan a `/second-brain` con «Mapa»;
   - la columna de `bloques` y los adjuntos guardados;
   - el riel «Lo que hizo», leyendo `mako_acciones_pendientes`;
   - el Centro como adaptador, con «Cerebro» como su jefe Second Brain;
   - la lista de chats, renombrar y el muñeco del cliente, declarados en la API de MaKo;
   - el chat de WhatsApp del grupo, leído en el índice (sólo el admin), y la marca `pii` en los chats de la app que lo
     lean;
   - «entender el pedido» enchufado en `turnoApp`, cuando Web Generator lo tenga andando en su chat.
3. **Los jefes que ya tienen sub-chats:**
   - CRM, con la cara nueva;
   - Automations, con su jefe;
   - Offer, con un lector y sus operaciones en la API (hoy 0 acciones);
   - Web Generator y Video Editor empiezan a guardar. Las 32 operaciones del chat de Video Editor pasan a la API.
4. **Las tabs sin chat:** Email, Experiments, Ads Writer, Image Editor, Plan, Calendario, Ads Manager y Customer Success. Las operaciones que faltan se declaran en la API en el mismo trabajo (regla del 13/10, `AGENTS.md:855`).
5. **El Second Brain lee chats y lo creado** como nodos, con el layout persistido, y suma el grafo local.

---

## (f) Lo que choca con el lanzamiento

**Las fechas:**
- El 21/09 el tope duro era el 15/11, con seis funcionalidades y el criterio de Leila: «¿es indispensable para un negocio que esto esté corriendo?». Si la respuesta es «puede ser», no se hace.
- El 01/10 el tope pasó al **4/11** sin que nadie lo nombrara (`docs/llamada-leila-01oct.md:61` y `:75`).
- La ventana de anuncios va del 1/11 al 15/12.

**Lo que choca:**
- **El Second Brain y el audio del 22/09.** Según la memoria, no el repo (`mako-once-proyectos.md:150`), en ese audio el Second Brain quedó **afuera** («No»). Pero está dentro del plan de tres fases que la misma nota da por superado por las cinco etapas del 01/10, así que hay que volver a verificarlo. Unificar los chats no está en ninguna etapa.
- **Tocar el chat del CRM** toca la pantalla que usa Mauricio, que paga.
- **Cada operación nueva** va también a la API, a la referencia y a `plugin/`.
- **El costo cambió el 16/10.**
  - En origin/main (`b9aaa9d0f`), el crédito de Claude de la plataforma se usa sólo en lo que lista `CREDITO_HABILITADO_PARA` (`lib/veto-claude.ts`). Hoy son tres funciones del wizard, y sólo mientras el onboarding está en curso.
  - La regla de `AGENTS.md` (en origin, líneas 3890-3897) dice que, con datos de clientes, si nada que no entrene contesta, se corta y pide que conecte su Claude.
  - `mako-doer` no está marcado `pii` (`lib/model-catalogo.ts:113`, igual en origin), y el `lib/anthropic.ts` de origin no menciona `pii`.
  - **Consecuencia:** un jefe que lee leads tiene que marcarse `pii`. Entonces, sin el Claude del negocio o una key de Gemini con facturación, no contesta. El costo deja de ser de la plataforma: lo paga el cliente, o el chat no contesta.

| Opción | Qué entra antes del 4/11 | Qué queda para después de la ventana |
|---|---|---|
| **A. Mínimo** | etapa 1 (Dashboard y General editan con IA, más el arreglo del bug) | etapas 2 a 5 |
| **B. Medio** | etapas 1 y 2 (pieza única, Second Brain en lugar de `/mako`, el Centro adaptado) | etapas 3 a 5 |
| **C. Completo** | todo | nada. No entra en el tope: son 17 tabs, 9 motores, cuatro almacenes y dos hilos en memoria. |

**Recomendación: la A.**
- Es lo único que pasa el criterio de Leila, porque es lo que el cliente ve en la tab que más mira.
- La etapa 2 puede arrancar por el Centro del super admin, que no toca a ningún cliente.
- La fuga de `/api/chart-insights` se arregla aparte y antes, en cualquiera de las tres.

**El documento va al índice.** Se suma a `docs/hallazgos.md` (los diseños están en la línea 60) en el mismo commit.

---

## Lo que exige AGENTS.md

**Multi-inquilino:**
- La tabla `creaciones` mezcla negocios: cada lectura lleva `workspace_origen` explícito (`AGENTS.md:2548`).
- `guardarMuneco` necesita compare-and-set (ver (d)).
- La lista en `localStorage` y los borradores llevan el workspace en la clave (`AGENTS.md:8293`).
- El redirect de `/mako` usa `rutaConWs` (`AGENTS.md:1102`).
- Si el layout del grafo se cachea en memoria, la clave lleva el workspace (`AGENTS.md:2210`).

**Permisos por rol:**
- El corte de «Mapa» va en el servidor (`page.tsx:53`; `AGENTS.md:4333` y `2574`).
- Las herramientas del Second Brain son sólo para admin.

**«Toda feature nueva va a la API de MaKo»** (`AGENTS.md:855`, regla del 13/10):
- la edición con IA de General (`crear_hoja_general` con `pedido`);
- la lista de chats, renombrar y el muñeco del cliente;
- Offer en la etapa 3;
- las 32 operaciones del chat de Video Editor.

**Texto en pantalla** (`AGENTS.md:1487`):
- La tarjeta irreversible lleva la consecuencia pegada al botón.
- `caja.puede=false` dice qué hacer y para qué, no el estado interno.
- «Creaciones» ya significa otra cosa, y por eso el riel se llama «Lo que hizo».
- Un solo separador, «›».

**Pantallas copiadas** (`AGENTS.md:1441`): falta nombrar la app de la que se copia el panel «Editar con MaKo».

**El editor del Dashboard:**
- Tocar `EditorInforme` obliga a correr `tests/graficos*` y `tests/dashboard-*` (`AGENTS.md:8341`).
- El bug de General viola «General ofrece poco del Dashboard».

**Control del presupuesto:** el corte deja de ser sólo un `console.warn` (`registro.ts:210`; `AGENTS.md:2341`).

**La convención del jefe:** la jerarquía por clave para clientes (`jefeDeClave`) es una regla nueva para código nuevo. Va a `AGENTS.md`, junto a la del Centro (líneas 1197-1245).

---

## Lo que no se sabe todavía

- **Datos de leads y keys gratis:** si hoy `turnoApp` (feature `mako-doer`, sin la marca `pii`) puede mandar datos de leads a una key gratis de Gemini. `chatClaudeTools` corre con `sinFallbackClaude: true`, y no medí por qué camino elige el proveedor. Si pasa, choca con la regla del 16/10 y va antes que todo lo demás.
- **Sesiones en producción:** cuántas hay por prefijo de `chart_key`, para medir el tamaño del índice y de la lista. No se midió.
- **El tope propio del panel:** cuánto cuestan en tokens los 26.377 caracteres de acciones del Dashboard por turno, y cómo se acota cada sub-chat del CRM (60.800 sólo en acciones).
- **WhatsApp:** si el clasificador enruta las 17 acciones de `graphics` que tienen canal `whatsapp`.
- **El teléfono y la tableta en la etapa 1:** si `app/m/dashboard` edita o sólo muestra.
- **El grafo dentro del panel:** sus anchos, y si los menús con `portalTo` se ven bien. Son cuentas con el CSS, no se midieron en el navegador.
- **Nodos de la plataforma:** cuántos da `construirCerebro()` en el workspace del super admin.
- **Contraste:** en `/second-brain` el fondo es oscuro, y los `--grafo-*` se midieron contra él (`app/globals.css:307`). Falta cómo se ven los muñecos sobre el fondo claro de los paneles de cada tab.
- **Datos de producción:** cuántos workspaces tienen automatizaciones con más de un CRON o más de un funnel, y si la migración 0157 (`workspace_id` en `meta_campaign_drafts`) está aplicada.
- **Costo del streaming:** es infraestructura nueva y no tiene estimación.
- **El audio del 22/09:** volver a verificar el «No» al Second Brain, que hoy sólo está en la memoria.
- **El Centro:** cómo queda la rama `centro-chat` cuando el chat que la está commiteando termine (último commit, `70519ffa4`, 03:40).

---

## Cosecha

- **El presupuesto, `gating.tab` contra área y la persona del informe** → `docs/hallazgos-api-mako.md`.
- **El bug de «Pídeselo» en General y la pérdida del deshacer** al ejecutar por la API → `docs/hallazgos-graficos.md`.
- **La fuga de `/api/chart-insights`** → `docs/hallazgos-ia.md`, o un documento de seguridad.
- **La convención `jefeDeClave`** → `AGENTS.md`, junto a la del Centro.
- **Este documento** → al índice `docs/hallazgos.md`, en el mismo commit.