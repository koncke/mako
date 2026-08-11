# Modelo definitivo — Oferta, Producto, Funnel y Participación

> Reemplaza la **sección 2 ("La decisión de modelo")** y la **fase F3** de `docs/productos-y-funnels-plan.md`.
> Escrito el 2026-08-10, después de las tres respuestas del dueño. Última migración aplicada: `0124_agente_telemetria.sql`.
> ~~**Nada de esto está verificado contra la base.**~~ **Las cinco queries de §5 SE CORRIERON contra prod el 2026-08-10.** Resultados:
>
> | Query | Resultado | Qué decide |
> |---|---|---|
> | leads por workspace | **1.000** (ws1 880, ws3 120) | el backfill de la 0128 entra en **un solo statement transaccional**; no hace falta partirlo por lote |
> | filas en `funnel_config` | **4** | la 0126 copia 4 filas y crea el default para los workspaces sin fila. El comentario de `lib/leads.ts:1510` era exacto |
> | `productos` por workspace | **2 en total** (ws1 y ws3, «Negocio que Escala» cada uno), **cero colisiones de nombre normalizado** | el unique `(workspace_id, lower(btrim(nombre)))` se puede aplicar **sin saneo previo**. Y el catálogo está prácticamente vacío: no hay masa de datos que migrar a `oferta_productos` |
> | leads cerrados/perdidos con R1 futura | **0** | ⚠️ **el bug del reagendo NO tiene ninguna víctima viva en prod hoy.** Ver la corrección abajo |
> | `lead_audit` con `Fecha R1` sobrescrita | **4** | la fecha se pisó 4 veces, pero por **cualquier** camino (un reagendo manual también cuenta): NO es prueba del bug de Calendly |
> | leads con `producto_id` | **0** | confirmado: la columna sigue muerta |
>
> ⚠️ **Corrección al §3 de este documento:** la sección «Un bug que está VIVO hoy» está
> sobrevendida. El mecanismo existe en el código y es real, pero **el síntoma no está presente
> en producción**: cero leads perdidos/ganados con una R1 futura. Sigue siendo una razón para
> las participaciones —el día que un lead reagende después de perderse, pasa— pero no es una
> urgencia y no justifica adelantar nada.

---

## 1. Las entidades

Cuatro entidades y dos puentes. El criterio que las distingue es **qué pregunta contesta cada una**, no su tamaño.

| Entidad | Qué es | El criterio que la distingue |
|---|---|---|
| **producto** (`productos`, ya existe, mig 0117) | Lo que se **entrega y se factura**. | Un cambio acá cambia una **factura**. Es lo que `leads.producto_id` referencia al cerrar y de donde el CRM hereda `tipo`/`monto_usd`/`suscripcion_meses`. |
| **oferta** (`ofertas`, NUEVA) | Cómo se **presenta** ese producto para que se compre: promesa, garantía, precio de *esta* versión, bonos, urgencia, prueba, lead magnet. | Un cambio acá cambia un **anuncio**. Es la unidad que un funnel vende y sobre la que un writer escribe. |
| **funnel** (`funnels`, NUEVA) | Por dónde **entra** el lead (TOFU: `data.entradas`) y dónde se **cierra** (BOFU: `canal`). | Un cambio acá cambia un **recorrido**. Dos funnels difieren en el TOFU aunque compartan el BOFU. |
| **participación** (`lead_participaciones`, NUEVA) | Un lead × un funnel × un **intento**, con su etapa, su desenlace, su atribución y su dinero. | Un cambio acá cambia **un caso**. Se llama "participación" y no `lead_funnels` justamente para que nadie la lea como una tabla de ids. |

Y los dos puentes:

- **`oferta_productos`** — qué productos incluye una oferta. **N:M** en las dos direcciones: "probá 5 a 10 versiones de la oferta" (`app/conocimientos/curso.ts:4295`) es N ofertas : 1 producto; el bundle es N productos : 1 oferta.
- **`funnel_ofertas`** — qué ofertas vende un funnel. **N:M**, y es acá donde vive la respuesta 1 del dueño.

**La relación producto ↔ funnel es N:M y se DERIVA, no se guarda** (`v_funnel_productos = funnel_ofertas ⋈ oferta_productos`). El dueño pidió N:M literal y eso se cumple exacto por composición. Guardarlo aparte sería un segundo lugar para el mismo dato — la regla que este repo ya pagó con el contrato del `detalle`.

**Por qué la arista va a la OFERTA y no al producto:** "TOFU distinto, BOFU compartido" son dos funnels vendiendo lo mismo con distinta entrada. Si el funnel colgara del producto, no habría dónde guardar que el funnel orgánico promete otra garantía y otro bono que el de ads. Eso es una **oferta** distinta sobre el **mismo** producto. Por eso `funnels.producto_id` como FK 1:N (plan anterior, `:92-97`) queda invalidado.

### Lo que NO es una entidad, a propósito

**El "BOFU compartido" es una PLANTILLA de tramo, no una fila referenciada.** Tres funciones razonan por el **índice de la etapa dentro del pipeline completo**: `generateFunnel` genera `noshow_r${rn}` con `rn` derivado de `meetings.indexOf(...)` (`lib/pipeline.ts:411-422`), `funnelReqInfo` calcula el nivel por índice (`lib/stage-requirements.ts:139-151`) y `salidasDeEtapa` razona por `col` relativa (`lib/pipeline.ts:232-241`). Un tramo referenciado obliga a introducir un offset en las tres, y hoy no hay ninguno.

Y el repo **ya resolvió esto sin entidad**: la plantilla `presencial` comparte el tramo de cierre **reusando la clave canónica** `agenda`, y el comentario explica que inventar una clave nueva (`sesion`) la deja fuera de `deriveStageKey` (`lib/pipeline.ts:729-756`). Repetir 4 elementos en un array jsonb es la copia más barata del repo.

Lo que el dueño pide cuando dice "el BOFU es el mismo" es una **consecuencia operativa** —que la nutrición y las métricas de cierre no se le tripliquen— y eso se resuelve con `nutricion_secuencias.funnel_id` **NULLABLE = sirve a todos los funnels**, no con una tabla.

### Qué pasa con el grupo `oferta` del brief: se queda, y se convierte en la DECLARACIÓN INICIAL

Los 5 campos `oferta_*` (`lib/onboarding.ts:28-34`) **no se apagan**, y no por conservadurismo: por la asimetría de consumo. `perfilNegocioTexto()` (`lib/onboarding.ts:259-269`) es la única función que emite el grupo y alimenta a ~20 features; el catálogo `productos` alimenta **dos** lugares, ambos en `lib/agente-contexto.ts:64,107-115` — `lib/mako-context.ts`, el system prompt de MaKo, no lee productos en absoluto. Apagarlo deja ~18 features sin promesa, precio ni garantía. Encima `oferta_ticket` ya es un calificador comercial de la propia agencia (`app/admin/dev/pricing/modelo.ts:1570`).

Pero **tampoco quedan como están**, que sería dos lugares para el mismo dato. El mecanismo es `ofertas.desde_brief`:

- La **fila** de la oferta principal existe en `ofertas` (la crea un seed perezoso en TypeScript, no SQL).
- Sus 5 campos quedan en **NULL** con `desde_brief = true`, y el valor sigue viviendo en `app_settings['mako.onboarding.answers']`.
- Un resolver único, `ofertaPrincipal()`, los lee del blob y devuelve `origen: 'declarado' | 'brief' | 'sin-fila'`.

**Cero copia, cero desincronización, cero backfill de datos.** El dato vive en un lugar y una columna dice cuál. Los tres escritores del blob no cambian: `app/api/onboarding/route.ts`, `app/api/mako/onboarding/route.ts` y El Archivero (`lib/archivero.ts`).

`desde_brief = false` + NULL significa "no lo cargaron", que **no** es lo mismo. Sin la bandera, NULL sería ambiguo y el prompt afirmaría vacío.

**El único lector que cambia es `perfilNegocioTexto()`**, que pasa a resolver esos 5 campos vía `ofertaPrincipal()`. Las ~20 features siguen recibiendo lo mismo — y de paso se arregla ahí el bug del label-pregunta: hoy la función emite el `label`, que **es una pregunta**, así que a 20 prompts les llega literal «Oferta — ¿Cómo se llama tu oferta?: X · ¿Tenés garantía? ¿Cuál?: 30 días». El repo ya resolvió ese mismo problema para el grafo (`lib/cerebro-grafo.ts:151-158`) y no para los prompts.

### Correcciones de hecho al plan anterior

Ninguna. El relevamiento reportó dos, y **las dos son un artefacto de haber leído el árbol
después de F0** (commit `97f98ba`, del mismo día): `upsertProducto` escribe `orden` y
`seedProductosDesdeOferta()` tiene call-site en el GET de
`app/api/onboarding/productos/route.ts` **porque F0 los cableó unas horas antes**, no porque
el diagnóstico original estuviera mal.

⚠️ **Y esa es la trampa que importa para la próxima corrida:** un agente que lee el código de
hoy no distingue «esto nunca estuvo roto» de «esto se arregló hace una hora», y lo reporta
como «el plan arranca de una premisa falsa» — que es la conclusión más cara posible, porque
invita a descartar un hallazgo correcto. Antes de marcar un hallazgo como viejo, `git log -1`
del archivo. Los dos hallazgos originales eran ciertos cuando se escribieron; lo que cambió
es el código.

---

## 2. El esquema

Seis migraciones, `0125` a `0130`. **Ninguna dropea una columna, un índice ni una tabla.** Los DROP viven todos en la migración del release-gate (`0131`), que va junto con el deploy que habilita la segunda participación.

### 0125 — `ofertas`, `oferta_productos`, `lead_magnets`

```sql
-- =============================================================================
-- 0125 — La OFERTA se vuelve entidad. NO reemplaza al brief: lo envuelve.
-- =============================================================================
-- Respuesta 3 del dueño: «la oferta no debe desaparecer; una oferta es mucho más
-- que un producto». Hoy, en el código, es MENOS: los 5 campos del grupo 'oferta'
-- (lib/onboarding.ts:28-34) son uno a uno 5 columnas de `productos`, y la propia
-- 0117:10-11 lo dice textual («Los campos espejan el grupo 'oferta' del
-- onboarding»). O sea: hoy la 'oferta' es un PRODUCTO SINGLETON MAL NOMBRADO.
--
-- La frontera, una línea cada una:
--   producto = LO QUE SE ENTREGA Y SE FACTURA  → `productos` (0117), no se toca
--   oferta   = CÓMO SE PRESENTA PARA QUE SE COMPRE → esta tabla
-- Definición del material que el propio dueño cargó: «la oferta no es el
-- producto, la oferta es cómo presentás el producto» (app/conocimientos/curso.ts:4278).
--
-- ⚠️ CERO BACKFILL EN SQL, A PROPÓSITO. app_settings.value es TEXT (0016:14-17)
-- con JSON adentro, y un `value::jsonb` sobre UNA fila corrupta aborta la
-- migración entera. La fila principal la crea seedOfertaDesdeBrief() en
-- TypeScript, copiando el molde ya probado de seedProductosDesdeOferta
-- (lib/productos.ts:112-132: guard por SEED_KEY en settings, corre una vez, no
-- reintenta aunque no haya oferta).

create table if not exists ofertas (
  id             bigint generated by default as identity primary key,
  workspace_id   bigint not null references workspaces(id),
  nombre         text not null,

  -- Los 5 del brief. NULL + desde_brief=true = «el valor está en el blob».
  -- NULL + desde_brief=false = «no lo cargaron». No son lo mismo, y por eso la
  -- bandera existe: sin ella, NULL sería ambiguo y el prompt afirmaría vacío.
  precio_usd     numeric,        -- el precio de ESTA versión (early bird, bundle)
  precio_nota    text,           -- «2 pagos de 2.500» — cómo se PRESENTA el precio
  promesa        text,
  incluye        text,
  garantia       text,

  -- LO QUE HACE QUE ESTO SEA UNA OFERTA Y NO UN PRODUCTO.
  -- Ninguno de los cinco existe hoy en ninguna tabla ni setting (grep sobre lib/
  -- y supabase/migrations/).
  bonos          jsonb not null default '[]'::jsonb,  -- [{nombre, valor_usd?, porque}]
                 -- Única mención hoy en todo lib/: una PROHIBICIÓN dentro de un
                 -- prompt (lib/guion-angulos.ts:533). El writer sabe que existen
                 -- y no tiene de dónde leerlos.
  urgencia_tipo  text,   -- 'fecha' | 'cupos' | 'capacidad' | 'inicio' | null
  urgencia_dato  text,   -- «6 lugares» · «arranca el 3/9»
  urgencia_razon text,   -- por qué es real
  urgencia_hasta date,   -- si es fecha, acá se puede VERIFICAR que no venció
                 -- El ángulo «Oferta directa (urgencia)» EXIGE «una restricción
                 -- REAL documentada en el contexto del negocio» y PROHÍBE
                 -- inventarla (lib/guion-angulos.ts:509-531): hoy es un requisito
                 -- de contrato SIN campo donde cumplirse. Con urgencia_hasta, el
                 -- ángulo se saca del catálogo EN CÓDIGO cuando vence — la segunda
                 -- capa que exige AGENTS.md § «Una regla en un prompt no es una regla».
  para_quien     text,
  objeciones     text,
  prueba         text,   -- casos, números, testimonios

  desde_brief    boolean not null default false,
  es_principal   boolean not null default false,
  activa         boolean not null default true,
  orden          int     not null default 0,   -- escalera de valor entre ofertas
  origen         text    not null default 'manual',  -- 'manual'|'brief'|'mako'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Índices únicos PARCIALES. Molde: uq_svc_inc_open (0089_service_incidents.sql:38).
create unique index if not exists ofertas_ws_principal_uk on ofertas (workspace_id) where es_principal;
create unique index if not exists ofertas_ws_brief_uk     on ofertas (workspace_id) where desde_brief;
-- Segunda capa determinista del dedup (la prosa del prompt no alcanza).
create unique index if not exists ofertas_nombre_uk on ofertas (workspace_id, lower(btrim(nombre)));
create index if not exists idx_ofertas_ws on ofertas (workspace_id);

comment on table ofertas is
  'Cómo se PRESENTA un producto para que se compre. N ofertas : 1 producto vía oferta_productos. Los 5 campos del brief NO se copian: con desde_brief=true viven en app_settings y los resuelve ofertaPrincipal(). #374';
comment on column ofertas.desde_brief is
  'true = precio/promesa/incluye/garantia NO están acá: viven en app_settings mako.onboarding.answers. NUNCA se copian — una segunda copia se queda vieja (AGENTS.md § Una cosa, un lugar).';

-- ── Puente oferta ↔ producto. N:M en las dos direcciones ─────────────────────
-- 1 producto : N ofertas = las «versiones de la oferta».
-- N productos : 1 oferta = el bundle.
create table if not exists oferta_productos (
  id           bigint generated by default as identity primary key,
  workspace_id bigint not null references workspaces(id),
  oferta_id    bigint not null references ofertas(id)   on delete cascade,
  producto_id  bigint not null references productos(id) on delete cascade,
  rol          text   not null default 'incluido',  -- 'principal'|'bump'|'incluido'
  orden        int    not null default 0,
  created_at   timestamptz not null default now()
);
-- «Un mismo producto no se liga dos veces a la misma oferta».
-- Molde exacto: share_invitados_unico_idx (0099_shares_invitados.sql:36-37).
create unique index if not exists uq_oferta_producto       on oferta_productos (oferta_id, producto_id);
create unique index if not exists uq_oferta_prod_principal on oferta_productos (oferta_id) where rol = 'principal';
create index if not exists idx_oferta_prod_prod on oferta_productos (workspace_id, producto_id);

-- ⚠️ NO lleva columna `activo`: duplicaría productos.activo (0117:27) y
-- ofertas.activa. Desligar = borrar la fila. Discontinuar = activa=false, en un
-- solo lugar.

-- ── El LEAD MAGNET deja de ser un blob singleton ─────────────────────────────
-- El repo YA lo declara hijo de la oferta: la taxonomía (lib/cerebro-modelo.ts:86-88,
-- la carpeta madre «Oferta» con tres hijas: «La oferta» + «Productos» + «Lead
-- Magnet») y las aristas del grafo (lib/cerebro-grafo.ts:430,448, con el motivo
-- «El elemento tangible que hace entendible la oferta»). Pero vive en
-- app_settings['mako.entregable'] SIN oferta_id (lib/entregable.ts:28-38): con dos
-- ofertas, el imán de una se le inyecta a los prompts de la otra.
create table if not exists lead_magnets (
  id           bigint generated by default as identity primary key,
  workspace_id bigint not null references workspaces(id),
  oferta_id    bigint references ofertas(id) on delete set null,  -- null = del negocio (legacy)
  nombre       text not null,
  tipo         text,      -- Dashboard | Excel | Documento | Metodología…
  que_es       text,
  fomo         text,
  enlace       text,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_lead_magnets_ws on lead_magnets (workspace_id, orden, id);

-- La oferta por la que ENTRÓ el lead (lo que se le prometió). Distinta de
-- leads.producto_id (lo que compró), que existe desde 0117:34.
alter table leads add column if not exists oferta_id bigint references ofertas(id) on delete set null;

-- productos.promesa y productos.garantia quedan DEPRECADAS con comentario. NO se
-- dropean acá ni en 0130: su único lector real es lib/agente-contexto.ts:107-115
-- (el único lugar que emite «Garantía del catálogo») y ese select está envuelto
-- en un .catch(() => []) — dropear antes de migrarlo hace desaparecer el catálogo
-- del contexto de la IA SIN UN SOLO LOG.
comment on column productos.promesa  is 'DEPRECADA (0125): la promesa es de la OFERTA. Lector a migrar: lib/agente-contexto.ts:107-115.';
comment on column productos.garantia is 'DEPRECADA (0125): la garantía es de la OFERTA. Lector a migrar: lib/agente-contexto.ts:107-115.';

alter table ofertas         enable row level security;
alter table oferta_productos enable row level security;
alter table lead_magnets    enable row level security;
revoke all on ofertas, oferta_productos, lead_magnets from anon, authenticated;  -- molde 0118

notify pgrst, 'reload schema';
```

> **`generated by default as identity`, no `always`.** `lib/clonar-config.ts` y `lib/datos-mau.ts` copian filas entre workspaces; con `ALWAYS` no pueden insertar con id explícito. `workspaces` (`0054:29`) usa `by default`; `productos` (`0117:17`) usa `always` y por eso no se puede clonar con id. No repetir ese error.

### 0126 — `funnels`

```sql
-- =============================================================================
-- 0126 — N funnels por workspace. `funnel_config` queda INTACTA.
-- =============================================================================
-- Hoy la base PROHÍBE el segundo funnel: índice único funnel_config_ws_uk sobre
-- (workspace_id) (0054_workspaces.sql:95) y saveFunnel upsertea con
-- onConflict:'workspace_id' (lib/leads.ts:1525-1528). Dropear ese índice rompe el
-- upsert con 42P10 en la ventana entre migración y deploy. Tabla nueva es la
-- ÚNICA opción aditiva.

create table if not exists funnels (
  id           bigint generated by default as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nombre       text not null,
  -- El BOFU: dónde se CIERRA (CanalId, lib/fase-diagnostico.ts:363).
  -- NULL = hereda el canal del NEGOCIO (app_settings 'negocio.fase.diagnostico',
  -- lib/fase-store.ts:13). BAJA al funnel pero NO se muda: el mismo campo adapta
  -- la pregunta de volumen del diagnóstico de fase (VOLUMEN_POR_CANAL,
  -- lib/fase-diagnostico.ts:374-398), y eso es del negocio.
  canal        text,
  plantilla    text,   -- de qué FUNNEL_TEMPLATES se sembró (lib/pipeline.ts:677-757)
  -- MISMA forma que funnel_config.data: {pipeline, suppressed, entradas, evento,
  -- umbrales}. Así mergeFunnelData, sanearPipeline, parseEntradas y parseEvento se
  -- reusan SIN TOCAR UNA LÍNEA, y se hereda el contrato de MERGE que impide que un
  -- tecleo del editor borre `umbrales` (lib/leads.ts:1505-1512).
  -- El TOFU vive adentro, en data.entradas — que es donde ya vive.
  data         jsonb not null default '{}'::jsonb,
  declarado    boolean not null default false,  -- = el origen 'declarado' vs 'sin-fila'
  es_default   boolean not null default false,
  activo       boolean not null default true,
  orden        int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Guard en POSITIVO: un ws SIEMPRE tiene exactamente un funnel default.
create unique index if not exists funnels_ws_default_uk on funnels (workspace_id) where es_default;
create unique index if not exists funnels_nombre_uk     on funnels (workspace_id, lower(btrim(nombre)));
create index        if not exists idx_funnels_ws        on funnels (workspace_id);

comment on column funnels.canal is
  'BOFU: dónde se cierra. NULL = hereda el del negocio. El TOFU (cómo entra) va en data.entradas, y son ejes INDEPENDIENTES: confundirlos fue un bug real, documentado en lib/fase-diagnostico.ts:357-362.';

-- ── Backfill: copia NO destructiva de funnel_config ──────────────────────────
insert into funnels (workspace_id, nombre, data, declarado, es_default)
select fc.workspace_id, 'Funnel principal', fc.data, true, true
from funnel_config fc
where not exists (select 1 from funnels f where f.workspace_id = fc.workspace_id);

-- ⚠️ Y el workspace que NO tenía fila IGUAL recibe la suya, con declarado=false
-- y data='{}' → sigue cayendo a DEFAULT_PIPELINE con `entradas` vacío. Cero
-- cambio de comportamiento: ningún prompt empieza a afirmar un funnel que nadie
-- declaró. Esto NO es cosmético: sin esta fila, los leads de esos workspaces se
-- quedarían sin participación en 0128 (funnel_id es NOT NULL) y desaparecerían
-- de /comercial en silencio el día que las vistas cambien de fuente.
insert into funnels (workspace_id, nombre, data, declarado, es_default)
select w.id, 'Funnel principal', '{}'::jsonb, false, true
from workspaces w
where not exists (select 1 from funnels f where f.workspace_id = w.id);

-- El BOFU compartido, sin entidad: una secuencia SIN funnel sirve a TODOS.
-- Hoy leadsDeCohorte('etapa_actual') trae todos los leads abiertos del ws y filtra
-- EN MEMORIA por pipelineStageOf (lib/nutricion.ts:285-313), sin ninguna noción de
-- funnel: con dos funnels que generan 'noshow_r1', el mismo lead se enrola en las
-- dos secuencias y recibe los dos WhatsApp y los dos emails. Sin error y sin log.
-- Es el único riesgo de este proyecto que sale de la pantalla.
alter table nutricion_secuencias add column if not exists funnel_id bigint references funnels(id) on delete cascade;
comment on column nutricion_secuencias.funnel_id is
  'NULL = sirve a TODOS los funnels (el tramo de cierre compartido). Con valor, solo a ese.';

-- funnel_config NO se dropea acá. Queda como respaldo, sin lectores, hasta contar
-- funnels contra funnel_config en prod. El DROP es la mitad irreversible y va solo.
comment on table funnel_config is
  'DEPRECADA por `funnels` (0126). No escribir. Se dropea en un push aparte, cuando el conteo contra funnels cierre.';

alter table funnels enable row level security;
revoke all on funnels from anon, authenticated;

notify pgrst, 'reload schema';
```

### 0127 — `funnel_ofertas` + la vista derivada

```sql
-- =============================================================================
-- 0127 — funnel_ofertas: la N:M de la respuesta 1 del dueño
-- =============================================================================
-- Molde: nutricion_inscripciones (0034:28-43), la ÚNICA junction N:M con
-- atributos propios del repo. Se copia: PK propia (no compuesta), FKs not null
-- on delete cascade, workspace_id PROPIO (getTenantDb filtra y estampa POR esa
-- columna — no la hereda de las FK) y DOS índices.

create table if not exists funnel_ofertas (
  id           bigint generated by default as identity primary key,
  workspace_id bigint not null references workspaces(id),
  funnel_id    bigint not null references funnels(id) on delete cascade,
  oferta_id    bigint not null references ofertas(id) on delete cascade,
  -- Qué se ofrece PRIMERO en el wizard de cierre y cuál es el foco por defecto del
  -- writer. Es una decisión DECLARADA, nunca array[0] (AGENTS.md: «lo que se ve sin
  -- abrir se elige a mano, nunca por el índice de un array»).
  es_principal boolean not null default false,
  orden        int not null default 0,
  origen       text not null default 'manual',  -- 'manual'|'propuesto'|'migracion'
  created_at   timestamptz not null default now(),
  unique (funnel_id, oferta_id)
);
create unique index if not exists funnel_ofertas_principal_uk on funnel_ofertas (funnel_id) where es_principal;
create index if not exists idx_funnel_ofertas_oferta on funnel_ofertas (oferta_id);
create index if not exists idx_funnel_ofertas_ws     on funnel_ofertas (workspace_id);

-- El N:M producto ↔ funnel que pidió el dueño: DERIVADO, no una tercera tabla que
-- alguien tenga que mantener sincronizada.
create or replace view v_funnel_productos as
select fo.workspace_id, fo.funnel_id, op.producto_id, op.rol,
       bool_or(fo.es_principal and op.rol = 'principal') as es_principal
from funnel_ofertas fo
join oferta_productos op on op.oferta_id = fo.oferta_id
group by fo.workspace_id, fo.funnel_id, op.producto_id, op.rol;

comment on view v_funnel_productos is
  'Qué productos vende un funnel. DERIVADO de funnel_ofertas ⋈ oferta_productos: producto↔funnel no tiene tabla propia a propósito (AGENTS.md § Una cosa, un lugar).';

-- Backfill: el funnel default vende la oferta principal, si las dos existen.
insert into funnel_ofertas (workspace_id, funnel_id, oferta_id, es_principal, origen)
select o.workspace_id, f.id, o.id, true, 'migracion'
from ofertas o
join funnels f on f.workspace_id = o.workspace_id and f.es_default
where o.es_principal
  and not exists (select 1 from funnel_ofertas fo where fo.funnel_id = f.id and fo.oferta_id = o.id);

alter table funnel_ofertas enable row level security;
revoke all on funnel_ofertas from anon, authenticated;

notify pgrst, 'reload schema';
```

### 0128 — `lead_participaciones` (la única migración con backfill de datos vivos)

```sql
-- =============================================================================
-- 0128 — un lead × un funnel × un intento (respuesta 2 del dueño)
-- =============================================================================
-- «Un lead podría aparecer en 2 funnels a la vez… pero eso no significa duplicar
-- al lead.»
--
-- ⚠️ EL COSTO REAL NO ES LA TABLA, ES LA ETAPA. La etapa del lead NO está
-- guardada: deriveStageKey la calcula de OCHO columnas de la fila `leads`
-- (StageDerivable + deriveStageKey, lib/pipeline.ts:871-904). Dos recorridos
-- sobre una fila = el segundo PISA al primero. Por eso las ~35 columnas de
-- recorrido se MUDAN acá.
--
-- ⚠️ Y NINGUNA COLUMNA DE `leads` SE DROPEA. `leads` las conserva todas como
-- ESPEJO de la participación activa. Eso es exactamente lo que deja que los
-- ~1.000 call-sites que leen por pipelineStageOf / etapaVigenteDe / LISTA_COLS
-- sigan siendo correctos sin tocarse. El espejo lo escribe TypeScript en un choke
-- point único, NO un trigger: el repo tiene UN solo trigger (set_updated_at,
-- 0001:130-145) y ninguna columna GENERATED — un trigger nuevo sería el primero
-- de su clase y quedaría invisible a `npm run typecheck`, que es la única red que
-- queda (next build tiene typescript.ignoreBuildErrors: true).
--
-- ⚠️ LOS TIPOS SON LOS DEL REPO, NO LOS «OBVIOS». fecha_agenda / fecha_junta_1 /
-- fecha_junta_2 son DATE (0001:92-94) y junta_1_at / junta_2_at son TIMESTAMPTZ
-- (0070:11): la 0070 creó esa distinción a propósito. Si acá se declaran
-- timestamptz, `fecha_cierre - fecha_junta_1` deja de ser integer y pasa a ser
-- interval → la columna dias_promedio_ciclo de las vistas de cohortes cambia de
-- tipo y el CREATE OR REPLACE de la 0130 aborta con 42P16.

create table if not exists lead_participaciones (
  id           bigint generated by default as identity primary key,
  workspace_id bigint not null references workspaces(id),
  lead_id      bigint not null references leads(id)   on delete cascade,
  funnel_id    bigint not null references funnels(id),
  intento      int not null default 1,

  -- QUÉ le prometimos y QUÉ compró: son DOS cosas y no la misma.
  oferta_id    bigint references ofertas(id)   on delete set null,
  producto_id  bigint references productos(id) on delete set null,

  -- Por qué le tocó este funnel. Misma disciplina que FunnelConfig.origen
  -- (lib/leads.ts:1450-1455): la ficha DICE en vez de AFIRMAR.
  origen       text not null default 'manual',  -- 'manual'|'default'|'webhook'|'import'|'mako'|'reactivacion'|'migracion'

  -- ── RECORRIDO / ETAPA (0013, 0019, 0020, 0044, 0122) ──────────────────────
  pipeline_stage            text,
  etapa_vista               text,
  estado_lead               text not null default 'abierto',
  motivo_perdida            text,
  nutricion_realizada       boolean not null default false,
  nutricion_manual_deadline date,

  -- ── REUNIONES (0001, 0064, 0069, 0070, 0020) ──────────────────────────────
  fecha_agenda   date,
  fecha_junta_1  date,
  fecha_junta_2  date,
  junta_1_at     timestamptz,
  junta_2_at     timestamptz,
  asistio_j1     boolean,
  asistio_j2     boolean,
  calificado     boolean,
  sin_r1         boolean,
  sin_r2         boolean,
  fathom_omitido boolean,
  r2_agenda_externa_motivo text,
  fathom_links   jsonb not null default '[]'::jsonb,

  -- ── DINERO: un intento = un cierre. Dos cierres = dos participaciones. ─────
  -- Sin ESTE bloque completo, el caso central del dueño (compró el low-ticket y
  -- meses después el high-ticket) sigue pisando el contrato y el plan de cuotas
  -- del primer cierre, aunque exista pagos.participacion_id.
  cerro                 boolean,
  monto_cierre_usd      numeric(10,2),
  fecha_cierre          date,
  fecha_confirmacion    date,
  venta_tipo            text not null default 'unico',
  suscripcion_monto_usd numeric,
  suscripcion_meses     int,
  cobro_inicial_usd     numeric(12,2),
  monto_cuota_usd       numeric(12,2),
  total_cuotas          smallint,
  dia_de_pago           smallint,
  fecha_primer_pago     date,
  monto_primer_pago     numeric,
  total_cobrado_usd     numeric,
  fecha_inicio_servicio date,
  contrato_nombre       text,
  contrato_path         text,
  deal_servicio         jsonb,
  deal_promesa          jsonb,   -- snapshot {resultado, garantia}: se PRELLENA de la oferta
  deal_obligaciones     jsonb,
  constraint lp_total_cuotas_check check (total_cuotas is null or total_cuotas between 1 and 6),
  constraint lp_dia_de_pago_check  check (dia_de_pago  is null or dia_de_pago  between 1 and 28),

  -- ── TOFU: por dónde entró ESTA vez ────────────────────────────────────────
  -- La atribución es «por dónde entró esta vez» = el TOFU, que según la respuesta 1
  -- del dueño es lo que DIFERENCIA dos funnels. Hoy es una columna sola en `leads`
  -- y el segundo intento la PISA en silencio (lib/leads.ts:1007-1016).
  origen_lead        text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  meta_lead_id text, meta_ad_id text, meta_ad_name text,
  meta_campaign_name text, meta_adset_name text,
  adset_id_origen text, visitor_id text,

  closer text, setter text,   -- quién trabajó ESTE intento

  -- ── CICLO DE VIDA ─────────────────────────────────────────────────────────
  abierta_at   timestamptz not null default now(),
  cerrada_at   timestamptz,          -- null = intento vivo
  -- EL RELOJ DE LA REACTIVACIÓN VIVE ACÁ, no en updated_at. T6 mide el frío con
  -- diasEntre(hoy, l.updated_at) (lib/crm-auto-plan.ts:127) y un trigger pisa
  -- leads.updated_at en CADA escritura (0001:130-145): con espejo, escribir en la
  -- participación B reseteaba el reloj de la A y el lead nunca se enfriaba.
  ultima_actividad_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ⚠️ NO lleva unique (lead_id, funnel_id) a secas. El repo YA pagó exactamente esa
-- trampa: nutricion_inscripciones lo tiene (0034:37) y el comentario de
-- procesarEnvios dice textual que quemaba la cadencia «sin reinscripción posible
-- por el unique(lead, secuencia)» (lib/nutricion.ts:832-833). Ese unique prohíbe
-- LITERALMENTE el caso que pidió el dueño. El guard correcto es el índice PARCIAL:
-- una participación ABIERTA a la vez, las cerradas sin límite.
-- Molde: uq_svc_inc_open (0089_service_incidents.sql:38).
-- (funnel_id es NOT NULL porque la 0126 le dio funnel default a TODOS los
--  workspaces: no hace falta un coalesce(funnel_id, 0) sobre una expresión.)
create unique index if not exists uq_lp_abierta
  on lead_participaciones (lead_id, funnel_id) where cerrada_at is null;
create index if not exists idx_lp_lead   on lead_participaciones (lead_id);
create index if not exists idx_lp_funnel on lead_participaciones (workspace_id, funnel_id, estado_lead);
create index if not exists idx_lp_j1     on lead_participaciones (workspace_id, fecha_junta_1) where fecha_junta_1 is not null;

-- El puntero: cuál participación se está ESPEJANDO hoy en `leads`.
alter table leads add column if not exists participacion_activa_id bigint references lead_participaciones(id) on delete set null;
alter table leads add column if not exists funnel_id bigint references funnels(id) on delete set null;
comment on column leads.participacion_activa_id is
  'Qué participación se espeja en las ~35 columnas de recorrido de esta fila. La escribe SOLO lib/participaciones.ts. No se edita a mano.';

-- ── BACKFILL: una participación por lead, intento=1, al funnel default ───────
insert into lead_participaciones (
  workspace_id, lead_id, funnel_id, oferta_id, producto_id, intento, origen,
  pipeline_stage, etapa_vista, estado_lead, motivo_perdida, nutricion_realizada, nutricion_manual_deadline,
  fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at,
  asistio_j1, asistio_j2, calificado, sin_r1, sin_r2, fathom_omitido,
  r2_agenda_externa_motivo, fathom_links,
  cerro, monto_cierre_usd, fecha_cierre, fecha_confirmacion,
  venta_tipo, suscripcion_monto_usd, suscripcion_meses,
  cobro_inicial_usd, monto_cuota_usd, total_cuotas, dia_de_pago,
  fecha_primer_pago, monto_primer_pago, total_cobrado_usd, fecha_inicio_servicio,
  contrato_nombre, contrato_path, deal_servicio, deal_promesa, deal_obligaciones,
  origen_lead, utm_source, utm_medium, utm_campaign, utm_content,
  meta_lead_id, meta_ad_id, meta_ad_name, meta_campaign_name, meta_adset_name,
  adset_id_origen, visitor_id, closer, setter,
  abierta_at, cerrada_at, ultima_actividad_at
)
select
  l.workspace_id, l.id, f.id, fo.oferta_id, l.producto_id, 1, 'migracion',
  l.pipeline_stage, l.etapa_vista, coalesce(l.estado_lead, 'abierto'), l.motivo_perdida,
  coalesce(l.nutricion_realizada, false), l.nutricion_manual_deadline,
  l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2, l.junta_1_at, l.junta_2_at,
  l.asistio_j1, l.asistio_j2, l.calificado, l.sin_r1, l.sin_r2, l.fathom_omitido,
  l.r2_agenda_externa_motivo, coalesce(l.fathom_links, '[]'::jsonb),
  l.cerro, l.monto_cierre_usd, l.fecha_cierre, l.fecha_confirmacion,
  coalesce(l.venta_tipo, 'unico'), l.suscripcion_monto_usd, l.suscripcion_meses,
  l.cobro_inicial_usd, l.monto_cuota_usd, l.total_cuotas, l.dia_de_pago,
  l.fecha_primer_pago, l.monto_primer_pago, l.total_cobrado_usd, l.fecha_inicio_servicio,
  l.contrato_nombre, l.contrato_path, l.deal_servicio, l.deal_promesa, l.deal_obligaciones,
  l.origen_lead, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content,
  l.meta_lead_id, l.meta_ad_id, l.meta_ad_name, l.meta_campaign_name, l.meta_adset_name,
  l.adset_id_origen, l.visitor_id, l.closer, l.setter,
  coalesce(l.created_at, now()),
  -- ⚠️ SOLO 'ganado' cierra el intento. 'perdido' / 'no_responde' / 'descalificado'
  -- quedan ABIERTOS a propósito: siguen en el board, siguen nutriéndose y siguen
  -- siendo reactivables — que es justo lo que los guards de T2/T6 bloquean hoy
  -- (lib/crm-auto-plan.ts:126 · lib/crm-auto.ts:211).
  case when l.estado_lead = 'ganado' then coalesce(l.fecha_cierre::timestamptz, l.updated_at) end,
  coalesce(l.updated_at, l.created_at, now())
from leads l
join funnels f on f.workspace_id = l.workspace_id and f.es_default
left join funnel_ofertas fo on fo.funnel_id = f.id and fo.es_principal
where not exists (select 1 from lead_participaciones p where p.lead_id = l.id);
-- El `where not exists` lo hace RE-EJECUTABLE: se vuelve a correr como último paso
-- del deploy, para los leads que el código viejo creó entre la migración y el deploy.

update leads l
   set participacion_activa_id = p.id,
       funnel_id = p.funnel_id,
       oferta_id = coalesce(l.oferta_id, p.oferta_id)
  from lead_participaciones p
 where p.lead_id = l.id and p.intento = 1 and l.participacion_activa_id is null;

comment on table lead_participaciones is
  'Un lead × un funnel × un intento. FUENTE DE VERDAD del recorrido a partir de 0128; las columnas homónimas de `leads` son su ESPEJO, escrito por escribirParticipacion() en lib/participaciones.ts. Un lead en dos funnels son DOS filas acá y UNA en leads: la persona no se duplica.';

alter table lead_participaciones enable row level security;
revoke all on lead_participaciones from anon, authenticated;

notify pgrst, 'reload schema';
```

### 0129 — las tres tablas que colisionan con el segundo intento (aditiva, sin DROPs)

```sql
-- =============================================================================
-- 0129 — participacion_id en lead_audit, pagos y nutricion_inscripciones
-- =============================================================================
-- Las tres columnas se agregan NULLABLE y se backfillean desde la participación
-- activa. Los uniques VIEJOS **NO se dropean acá**: mientras haya una sola
-- participación por lead son equivalentes fila a fila, y dropearlos con el código
-- viejo todavía vivo revienta — lib/pagos.ts:188 upsertea con
-- onConflict:'lead_id,numero', y sin ese índice eso es un 42P10 inmediato en el
-- wizard de cierre. Los DROP van en 0131, junto con el deploy del release-gate.

alter table lead_audit              add column if not exists participacion_id bigint references lead_participaciones(id) on delete cascade;
alter table pagos                   add column if not exists participacion_id bigint references lead_participaciones(id) on delete cascade;
alter table nutricion_inscripciones add column if not exists participacion_id bigint references lead_participaciones(id) on delete cascade;

update lead_audit a              set participacion_id = l.participacion_activa_id from leads l where l.id = a.lead_id and a.participacion_id is null;
update pagos p                   set participacion_id = l.participacion_activa_id from leads l where l.id = p.lead_id and p.participacion_id is null;
update nutricion_inscripciones n set participacion_id = l.participacion_activa_id from leads l where l.id = n.lead_id and n.participacion_id is null;

create index if not exists idx_lead_audit_part on lead_audit (participacion_id, created_at desc);

-- Los uniques NUEVOS conviven con los viejos (parciales, solo donde ya hay
-- participación). En 0131 se dropean idx_pagos_lead_numero (0014:72) y
-- nutricion_inscripciones_lead_id_secuencia_id_key (0034:37).
create unique index if not exists uq_pagos_part_numero
  on pagos (participacion_id, numero) where participacion_id is not null;
create unique index if not exists uq_nutri_insc_part_seq
  on nutricion_inscripciones (participacion_id, secuencia_id) where participacion_id is not null;

notify pgrst, 'reload schema';
```

### 0130 — las cohortes cambian de fuente, con el shape EXACTO

```sql
-- =============================================================================
-- 0130 — v_cohortes_* pasan a leer lead_participaciones
-- =============================================================================
-- Con exactamente UNA participación por lead, el join es 1:1 y estas vistas
-- devuelven EXACTAMENTE los mismos números que hoy. Por eso van ANTES del segundo
-- intento y no después: después, el día que se abra la segunda participación, el
-- dueño ve caer los números de meses ya cerrados. Eso no es un dato faltante: es
-- un dato FALSO.
--
-- ⚠️⚠️ CREATE OR REPLACE VIEW NO PUEDE CAMBIAR NOMBRE, ORDEN NI TIPO DE UNA SOLA
-- COLUMNA (42P16, «cannot change name of view column»). La 0084 lo dejó escrito
-- en su cabecera (:11-13) y por eso puso workspace_id AL FINAL. Las 11 columnas de
-- abajo son las de 0084:35-52 en el mismo orden. Y OJO: en la MENSUAL el orden de
-- dias_promedio_ciclo y estado_madurez está INVERTIDO respecto de la semanal
-- (0084:76-83). Copiarlo mal aborta la migración.
--
-- Si igual se forzara con DROP VIEW, se cae /comercial: _getResumenComercialMaduras
-- filtra por .eq('estado_madurez','madura') y lanza (lib/queries.ts:418-427), y
-- lee dias_promedio_ciclo. No es un número peor: es una pantalla que no carga.

create or replace view v_cohortes_semanales as
with base as (
  select
    workspace_id,
    date_trunc('week', fecha_junta_1)::date                                                   as semana_inicio,
    count(*)                                                                                  as total_j1,
    count(*) filter (where asistio_j1 = true)                                                 as asistencias,
    count(*) filter (where asistio_j1 = true and calificado = true)                           as limpias,
    count(*) filter (where cerro = true)                                                      as cierres,
    coalesce(sum(monto_cierre_usd) filter (where cerro = true), 0)                            as ingreso_total_usd,
    max(fecha_junta_1)                                                                        as ultima_j1_cohorte,
    avg(fecha_cierre - fecha_junta_1) filter (where cerro = true and fecha_cierre is not null) as dias_promedio_ciclo_raw
  from lead_participaciones
  where fecha_junta_1 is not null
  group by workspace_id, date_trunc('week', fecha_junta_1)
)
select
  semana_inicio,
  total_j1,
  asistencias,
  limpias,
  cierres,
  ingreso_total_usd,
  ultima_j1_cohorte,
  (current_date - ultima_j1_cohorte)                                                          as dias_desde_ultima_j1,
  case
    when (current_date - ultima_j1_cohorte) >= 14 then 'madura'
    when (current_date - ultima_j1_cohorte) >= 5  then 'madurando'
    else 'reciente'
  end                                                                                         as estado_madurez,
  round(dias_promedio_ciclo_raw::numeric, 1)                                                   as dias_promedio_ciclo,
  workspace_id                                                                                 as workspace_id
from base
order by semana_inicio desc;

create or replace view v_cohortes_mensuales as
with base as (
  select
    workspace_id,
    date_trunc('month', fecha_junta_1)::date                                                  as mes_inicio,
    count(*)                                                                                  as total_j1,
    count(*) filter (where asistio_j1 = true)                                                 as asistencias,
    count(*) filter (where asistio_j1 = true and calificado = true)                           as limpias,
    count(*) filter (where cerro = true)                                                      as cierres,
    coalesce(sum(monto_cierre_usd) filter (where cerro = true), 0)                            as ingreso_total_usd,
    max(fecha_junta_1)                                                                        as ultima_j1_cohorte,
    avg(fecha_cierre - fecha_junta_1) filter (where cerro = true and fecha_cierre is not null) as dias_promedio_ciclo_raw
  from lead_participaciones
  where fecha_junta_1 is not null
  group by workspace_id, date_trunc('month', fecha_junta_1)
)
select
  mes_inicio,
  total_j1,
  asistencias,
  limpias,
  cierres,
  ingreso_total_usd,
  ultima_j1_cohorte,
  (current_date - ultima_j1_cohorte)                                                          as dias_desde_ultima_j1,
  round(dias_promedio_ciclo_raw::numeric, 1)                                                   as dias_promedio_ciclo,
  case
    when (current_date - ultima_j1_cohorte) >= 14 then 'madura'
    when (current_date - ultima_j1_cohorte) >= 5  then 'madurando'
    else 'reciente'
  end                                                                                         as estado_madurez,
  workspace_id                                                                                 as workspace_id
from base
order by mes_inicio desc;

-- ⚠️ EL CORTE POR FUNNEL VA EN UNA VISTA NUEVA, NUNCA metiendo funnel_id al
-- GROUP BY de las de arriba: si entrara ahí, `cohortes_maduras_count:
-- cohortes.length` (lib/queries.ts:458) pasaría a contar semana × funnel y
-- dejaría de responder «cuántas cohortes maduras hay» — sin error, devolviendo
-- otro número. Y estas dos NO se suman con las de arriba: la unidad de una es la
-- semana y la de la otra es semana × funnel.
create or replace view v_cohortes_semanales_funnel as
select
  workspace_id, funnel_id,
  date_trunc('week', fecha_junta_1)::date as semana_inicio,
  count(*)                                                       as total_j1,
  count(distinct lead_id)                                        as leads_distintos,
  count(*) filter (where asistio_j1 = true)                      as asistencias,
  count(*) filter (where asistio_j1 = true and calificado = true) as limpias,
  count(*) filter (where cerro = true)                           as cierres,
  coalesce(sum(monto_cierre_usd) filter (where cerro = true), 0) as ingreso_total_usd
from lead_participaciones
where fecha_junta_1 is not null
group by workspace_id, funnel_id, date_trunc('week', fecha_junta_1);
-- `leads_distintos` existe para que la pantalla pueda decir las dos cosas:
-- «cuántas R1 hubo» (la unidad correcta, el INTENTO) y «cuántas personas».

notify pgrst, 'reload schema';
```

### 0131 — release-gate (va con el deploy que habilita la 2ª participación, no antes)

```sql
drop index if exists idx_pagos_lead_numero;                                        -- 0014:72
alter table nutricion_inscripciones drop constraint if exists nutricion_inscripciones_lead_id_secuencia_id_key;  -- 0034:37
create unique index if not exists uq_pagos_part_numero_final on pagos (participacion_id, numero);
create unique index if not exists uq_nutri_insc_part_final   on nutricion_inscripciones (participacion_id, secuencia_id);
```

### En el MISMO commit que cada migración, en TypeScript

- **`lib/workspace.ts:60-79` → `TENANT_TABLES`** suma `ofertas`, `oferta_productos`, `lead_magnets`, `funnels`, `funnel_ofertas`, `lead_participaciones`, `v_funnel_productos`, `v_cohortes_semanales_funnel`. `productos` ya está (`:72`). Con N filas por lead, olvidarse el `.eq` ya no da "no encuentra": **da las participaciones de otro cliente**, y esa es la tabla que lleva la plata. `funnel_config` está exceptuada por ser singleton (`:57-59`); **`funnels` no lo es**.
- **`lib/reset-workspace.ts`, `lib/clonar-config.ts`, `lib/datos-mau.ts`** suman las tablas nuevas. Y el reset **recrea el funnel default después de vaciar** — guard en positivo: un ws siempre tiene exactamente un funnel default.
- **`lib/plan-senales.ts:98`** (`funnel_config` por string) → `funnels`. Y `:104`, la señal `oferta-definida`, deja de mirar `'mako.entregable'` —que es el **lead magnet**— y pasa a ser "hay una oferta con promesa y precio". Tres conceptos colapsados en un booleano, ya cazado en `docs/hallazgos-plan.md:716`.

---

## 3. El lead en dos funnels

**La regla en una línea: `lead_participaciones` es la fuente de verdad del recorrido; las ~35 columnas homónimas de `leads` son su ESPEJO de la participación activa; el espejo lo escribe UN solo writer; ninguna columna se dropea nunca.**

### Por qué el espejo funciona — y es el hecho central, no una conveniencia

La etapa del lead **hoy no está guardada**: es una función pura de la fila. `deriveStageKey` (`lib/pipeline.ts:886-903`) hace un switch sobre `estado_lead` y después mira `fecha_agenda`/`fecha_junta_1`/`fecha_junta_2`/`asistio_j1`/`asistio_j2`/`nutricion_realizada`; `pipelineStageOf` (`:906-908`) le antepone el override `pipeline_stage`. Ocho columnas, todas del intento.

Si `leads` sigue trayendo esas ocho columnas con los valores de la participación **vigente**, `pipelineStageOf(lead)` sigue devolviendo lo correcto y los call-sites que pasan por él, por `etapaVigenteDe` o por el select `LISTA_COLS` (`lib/leads.ts:238-244`) **no se tocan**: el board (`app/crm/`, ~326 líneas en 16 archivos), la ficha, el wizard de etapa (`lib/stage-requirements.ts`), el export, MaKo, `lib/lead-insights.ts`, WhatsApp/Chatwoot. Todos describen "el intento vigente", que es exactamente lo que describen hoy.

### Quién escribe qué, durante la transición

| Campo | Fuente de verdad | Quién la escribe | Qué es `leads.<campo>` |
|---|---|---|---|
| `nombre`, `email`, `telefono`, `telefono_normalizado`, `empresa`, `deal_fiscal`, `facturado_por_id`, `created_at` | **`leads`** | los mismos escritores de hoy | la fuente. No cambia entre intentos |
| las ~35 de recorrido (etapa, reuniones, dinero, TOFU, closer/setter) | **`lead_participaciones`** desde 0128 | `escribirParticipacion()` en `lib/participaciones.ts`, **y nadie más** | espejo de la participación activa. **No se edita a mano** |
| `participacion_activa_id`, `funnel_id`, `oferta_id` | **`leads`** | `escribirParticipacion` / `abrirParticipacion` | el puntero |
| `producto_id` (0117:34) | **`lead_participaciones.producto_id`** | `escribirParticipacion` | espejo |
| `lead_audit`, `pagos`, `nutricion_inscripciones` | su propia tabla, con `participacion_id` | sus escritores de hoy, con el id de la participación | — |

**Cuál es la participación activa:** la de `ultima_actividad_at` más reciente entre las **abiertas**. Lo decide `escribirParticipacion`, en un solo lugar, nunca `array[0]`. El board pinta esa; la ficha muestra las dos con un selector de intento.

### El prerrequisito que no se puede saltear: el choke point

Hoy hay **≥32 escrituras** a `leads` con `update`/`insert`/`upsert` en 15 archivos (`app/crm/actions.ts` concentra 12, `lib/leads.ts` 4, más `lib/meta-write.ts`, `lib/mako-confirmaciones.ts`, `lib/crm-auto.ts` y una cada uno en pagos, nutricion, etapa-historial, email-marketing, deal-actions, whatsapp/block, webhooks/chatwoot, extract-deal-fiscal, extract-contract, email/unsubscribe). Se colapsan en tres módulos:

1. **`lib/participaciones-modelo.ts` — SIN `server-only`, a propósito.** Contiene `COLUMNAS_ESPEJO` (la única lista de qué se espeja) y `espejoDe(p): Partial<Lead>`. Mismo criterio que `exigirClienteDePrueba` (`lib/auth-session.ts`) y `lib/model-catalogo.ts`: la regla que más duele si falla va donde un test la pueda importar. Con un test que falla si `COLUMNAS_ESPEJO` deja de ser subconjunto de las keys del tipo `Lead`.
2. **`lib/participaciones.ts` (`server-only`)** — `escribirParticipacion(participacionId, patch)` escribe la fila **y** espeja en `leads` en el mismo camino, más `ultima_actividad_at = now()`; `abrirParticipacion(leadId, funnelId, origen)` crea el intento N+1, mueve el puntero y re-espeja; `cerrarParticipacion(id, desenlace)` sella `cerrada_at` y libera el índice parcial. **Lanza** — molde `saveLeadMeta` (`lib/leads.ts:1843`). El antimolde a no copiar es el update suelto con `console.error` que devuelve `ok:true` (`app/crm/actions.ts:463-474`).
3. **`lib/participaciones-lectura.ts`** — `participacionesDe(leadId)`, `participacionActiva(leadId)`, para la ficha.

**Este paso va ANTES de la 0128**, con una sola participación conceptual por lead: es refactor puro, verificable y reversible. Sin él, el espejo se desincroniza por el camino que nadie migró y el síntoma aparece días después en otra pantalla — el mecanismo exacto del contrato del `detalle` que documenta AGENTS.md.

### El release-gate: qué tiene que estar hecho antes de que un lead pueda tener DOS participaciones abiertas

Mientras haya exactamente una por lead, todo lo de abajo es equivalente y nada cambia. Las cinco cosas producen **datos falsos, no vacíos**, así que ninguna es diferible:

1. **0130 aplicada** + `cohortes_maduras_count: cohortes.length` (`lib/queries.ts:458`) revisado, + `getFunnelMadurasLeads` (`lib/queries.ts:524-560`, donde sí habría doble conteo real de ingreso) + `getMrrActivo` (`lib/queries.ts:749-771`, que hoy asume una suscripción por lead y hace desaparecer el MRR de la venta anterior).
2. **`etapa_vista` leyéndose de la participación.** Es memoria de UNA etapa por lead (mig 0122) y la pasada masiva escribe una línea de historial **firmada por MaKo** cuando la etapa efectiva no coincide (`lib/etapa-historial.ts:174-221`). Al conmutar la participación activa, esa pasada ve `vista !== etapa` y escribe historia **inventada** con el nombre de MaKo encima.
3. **`lead_audit.participacion_id` escribiéndose** (0129). Sin eso, el "tiempo en cada etapa" de la ficha mezcla los dos intentos en una sola línea de tiempo y no hay forma de filtrar.
4. **Los dos guards de reactivación reescritos contra la participación.** `l.pipeline_stage !== 'reactivacion'` (`lib/crm-auto-plan.ts:126`) y `if (lead.pipeline_stage === 'reactivacion') return 'skip'` (`lib/crm-auto.ts:211`) hacen que un lead reactivado una vez **nunca** se pueda volver a reactivar — que es literalmente el escenario del dueño, bloqueado por construcción. Y el reloj de T6 (`diasEntre(hoy, l.updated_at)`, `:127`) pasa a `ultima_actividad_at`.
5. **`encuentroGrabable()` recibiendo el canal del funnel** (`lib/encuentro-ws.ts:36-44`). Hoy decide por workspace sin parámetros — el gate que produjo veinte No-Shows falsos por semana en un taller presencial. Con dos BOFU distintos en el mismo workspace está **garantizadamente mal para uno**. Su parte pura, `seGraba` (`lib/pipeline.ts:655-660`), ya recibe el canal por parámetro: el cambio es del caller.

### Un bug que está VIVO hoy y esto cierra de paso

`upsertLeadFromCalendly` matchea por `telefono_normalizado` y después por email, y en modo webhook en vivo escribe `basePayload` —que incluye `fecha_agenda`, `fecha_junta_1` y `junta_1_at`— sobre la fila existente (`lib/leads.ts:943-1016, 1054-1079`), **sin tocar `estado_lead`**. Y `deriveStageKey` hace short-circuit por `estado_lead` antes de mirar las fechas. Resultado: un lead 'perdido' que reagenda seis meses después queda en la columna Perdido con una R1 futura, **pierde la fecha de su primera reunión**, y migra retroactivamente de cohorte semanal — una semana cerrada hace meses cambia de número sola. Con participaciones eso es `abrirParticipacion(origen='reactivacion')` y la primera se conserva entera. *(Leído del código; no verificado contra la base — la query está en §5.)*

### Lo que esto NO resuelve, dicho ahora y no a mitad de camino

`slotPorIndice` sigue devolviendo **dos** slots de reunión (`lib/funnel-etapas.ts:65-68, 101-103`, con el comentario que declara que "a partir del índice 2 no hay slot"). Dos participaciones dan cuatro reuniones, pero un BOFU con **tres** pasos dentro de una participación (discovery + demo + cierre) sigue sin tener dónde guardar la tercera. Eso necesita una tabla `reuniones` y **no entra en este proyecto**.

---

## 4. Lo que queda invalidado de `docs/productos-y-funnels-plan.md`

| Dónde | Qué decía | Qué pasa |
|---|---|---|
| **§2, `:92-97`** | "`funnels.producto_id` nullable. **No tabla puente.** Un N:M vuelve ambiguo «¿qué producto es este lead?»" | **INVALIDADO.** El vínculo va a la **oferta**, y producto↔funnel es N:M derivado (`v_funnel_productos`). La ambigüedad que temía ya la contesta otro campo (`leads.producto_id` = lo que se vendió), y es exactamente el caso que el dueño describe como real. |
| **§2, `:98-113`** ("El lead: dos columnas") | `leads.funnel_id` + `funnel_origen` como el modelo del lead | **REEMPLAZADO** por `lead_participaciones`. `leads.funnel_id` sobrevive solo como **espejo** de la participación activa; `funnel_origen` pasa a ser `lead_participaciones.origen`. La frase "el upsell ya tiene casa sin tabla puente" (`:111-112`) es falsa: un segundo cierre pisa el contrato, el plan de cuotas y el MRR del primero. |
| **§2, `:114-119`** ("Las stage keys NO se prefijan") | **SE MANTIENE**, y ahora con más razón: el ámbito lo da `lead_participaciones.funnel_id`. Las 11 canónicas de `deriveStageKey` siguen significando lo mismo en todos los funnels — es lo que permite el "BOFU compartido por reuso de clave". |
| **§2, `:121-127`** ("El precio es SNAPSHOT, no JOIN") | **SE MANTIENE**, corregido: el snapshot ahora vive en `lead_participaciones` (`venta_tipo`, `monto_cierre_usd`, `suscripcion_*`), no en `leads`. Y se agrega `deal_promesa` como snapshot de la **oferta** por deal. |
| **§2, `:128-144`** ("La capa de IA") | `lib/oferta-contrato.ts` + `lib/oferta-contexto.ts`, unidad de contexto = par (producto, funnel) | **SE MANTIENE**, con un cambio: la unidad de contexto es el par **(oferta, funnel)**. La oferta tiene el QUÉ *prometido* (promesa, garantía, bonos, urgencia, lead magnet) y llega al producto por `oferta_productos` cuando hace falta el precio facturable. `resolverOferta({leadId?, funnelId?, ofertaId?})`, fail-closed, con `origen` explícito. |
| **F0, `:168`** | "`lib/productos.ts:57-67` — escribir `orden` (hoy el `.order('orden')` es inerte)" | **HECHO.** `lib/productos.ts:78` + `proximoOrden()` (`:85-90`) + `reordenarProductos()` (`:93-99`). Tachar. |
| **F0, `:174`** | "Llamar por fin a `seedProductosDesdeOferta()` desde el GET de la ruta de productos" | **HECHO.** `app/api/onboarding/productos/route.ts:90`. Tachar (y corregir `:21`). |
| **F1, `:181-209`** | tabla `funnels`, rename `getFunnel()`→`getFunnelDefault()`, checklist de los lugares que nombran `funnel_config` por string | **SE MANTIENE ENTERA.** Es la mejor parte del plan viejo. Solo cambia el número (0126) y se le quita `producto_id` a la tabla. El checklist está verificado: `lib/leads.ts:1477,1521` · `lib/crm-auto.ts:51` · `lib/clonar-config.ts:55,109,122` · `lib/datos-mau.ts:185` · `lib/plan-senales.ts:98` · `lib/reset-workspace.ts:65`. |
| **F2, `:211-230`** | "Catálogo con casa propia y **N funnels por producto** · 0126" | **RENUMERADA a 0125/0127 y recortada.** El unique `(workspace_id, lower(btrim(nombre)))` se mantiene pero se aplica a `ofertas`, no a `productos` (para `productos` requiere saneo previo de colisiones y no es prerrequisito de nada). La vista "producto → funnels en carriles" pasa a ser "oferta → funnels". El wizard "Agregar un funnel" con `WizardShell` usando `pasos`+`pasoActual`: **se mantiene**. |
| **F3, `:232-264`** | "El lead sabe su funnel y su producto · 0127": `leads.funnel_id` + backfill + `resolverFunnelDeLead` fail-closed | **REEMPLAZADA POR ENTERO** por la §3 de este documento. Lo que sobrevive intacto: el bloque del **paso `producto` del wizard Ganado** (`:243-259`), incluidas las tres trampas — condición de faltante propia (`ofertaId == null`, nunca colgada de `'monto'`, porque `stepsForStage` no pide `'monto'` cuando ya hay uno, `lib/stage-requirements.ts:232`, y el bloque entero se omite del payload, `StageMoveDialog.tsx:527-532`); pedirlo solo **al entrar** a la etapa; cablear los 4 constructores de `MoveLeadInfo`; persistir con `saveLeadMeta` (que lanza). |
| **F4, `:266-287`** | `funnel_id` en las tablas de contenido, bloqueante | **SE MANTIENE** como parte del release-gate. `nutricion_secuencias.funnel_id` entra ya en 0126. |
| **F6, `:304-312`** | "`v_cohortes_*` con `producto_id` y `funnel_id` **en el GROUP BY**" | **INVALIDADO.** Meter la dimensión en esas vistas rompe su shape (42P16 en el `CREATE OR REPLACE`) y hace que `cohortes_maduras_count` pase a contar semana × funnel sin ningún error. El corte va en **vistas nuevas** (`v_cohortes_semanales_funnel`) que **no se suman** con las de siempre. Y las de siempre cambian de fuente en 0130, conservando las 11 columnas exactas. |
| **§5, pregunta 1** ("¿el canal baja al funnel?") | Recomendación: SÍ | **CONFIRMADO.** `funnels.canal` nullable = hereda el del negocio. No se muda: el mismo campo adapta `VOLUMEN_POR_CANAL` del diagnóstico de fase. Corolario: `TEMPLATE_POR_CANAL` deja de significar "qué funnel le toca a este cliente" y pasa a significar "con qué tramo de cierre se **siembra** este funnel nuevo". |
| **§5, pregunta 2** (`:360-366`) | "**NO. Un lead = un funnel a la vez.**" | **REVERTIDA** por la respuesta 2 del dueño. Lo que ese párrafo tenía bien es el diagnóstico del costo (los slots de reunión); lo que tenía mal es concluir que por eso no se hace. |
| **§5, pregunta 3** (`:368-376`) | "**SÍ, deprecar el grupo `oferta`** a favor del catálogo, en dos tiempos" | **REVERTIDA** por la respuesta 3. No se depreca y no se fusiona: **sube de nivel**. El grupo del brief se queda como declaración inicial, resuelto por `ofertaPrincipal()` con `desde_brief`. La tarjeta "Oferta" del hub **no se retira**. |
| **§6, `:391-394`** | "razones y lead magnet son por producto" | **CORREGIDO.** El lead magnet es de la **oferta** (el repo ya lo declara así: `lib/cerebro-modelo.ts:86-88` y `lib/cerebro-grafo.ts:430,448`) y baja con ella en 0125. `razones` y la `matriz` son la **misma entidad indexada por AVATAR** (`lib/razones.ts:8-12,47`) y son del **mensaje**, no de la oferta: siguen fuera de alcance. |
| **§6, `:398-399`** | "Un deal con DOS productos… la puerta futura es `pagos.producto_id`" | **SE MANTIENE fuera de alcance**, ahora explícito: `pagos` gana `participacion_id` (0129) pero no `producto_id`. Un deal con dos productos sigue siendo irrepresentable. |

---

## 5. Lo que sigue sin resolver — y qué hacer mientras tanto

Para cada uno: **una decisión por defecto, reversible.** No una pregunta al dueño.

**1. Nada está verificado contra la base.** Ninguna query corrida. Las cinco a correr **antes de 0125**, todas de una línea:
```sql
select workspace_id, count(*) from leads group by 1;                    -- ¿el backfill de 0128 va en un statement o por lotes?
select count(*) from funnel_config;                                     -- ¿cuántas filas copia 0126? (el repo dice 4 en un comentario, lib/leads.ts:1510)
select workspace_id, count(*) from productos group by 1;                -- ¿hay catálogo para ligar en oferta_productos?
select count(*) from leads where estado_lead in ('perdido','no_responde','ganado') and fecha_junta_1 > current_date;
select count(*) from lead_audit where campo='Fecha R1' and valor_anterior is not null;
```
Las dos últimas son las que convierten "el segundo intento pisa al primero" de lectura de código en evidencia de producción. El repo se contradice sobre el conteo de ws1: `0084:14` dice 514 y `lib/etapa-historial.ts:141-142` dice 812. **Decisión por defecto:** asumir que entra en un solo statement transaccional (a ~1.100 leads sobra), y si algún workspace pasa de 50k, partir el `insert … select` por `workspace_id` — el `where not exists` ya lo hace re-ejecutable, así que partirlo no cuesta nada.

**2. Los 5 campos `oferta_*` conviven con `ofertas` por tiempo indefinido.** Nadie decidió cuándo el blob deja de ser la fuente. **Decisión por defecto:** *nunca automáticamente*. El día que alguien edite la oferta principal desde la pantalla nueva, `guardarOferta()` escribe los valores en la fila y pone `desde_brief = false`, en la misma transacción. La migración del dato la hace el usuario editando, no un cron. Reversible: volver a poner `desde_brief = true` y vaciar los campos.

**3. `getFunnelEtapas` no se puede cortar por funnel, y el CAC por funnel no existe.** `lib/queries.ts:1182-1290` mezcla dos fuentes: las filas `imp_click`, `click_form` y `form_agenda` salen de `getMarketingWindow` → `marketing_metrics_daily`/meta_insights, que **no tienen dimensión de funnel ni de producto**; la fila puente `form_agenda` toma entrada del workspace entero y salida de `leads`, así que filtrar solo la salida da un **porcentaje falso**, no un dato faltante. Igual el CAC (`lib/queries.ts:664-693`): el spend de Meta no tiene atribución a funnel en ninguna tabla. **Decisión por defecto:** la pantalla lo **dice**, en tinta normal: *«Impresiones, clics y formularios todavía no se pueden separar por embudo: el gasto de Meta no sabe a qué embudo pertenece»*. Cortar solo la mitad de abajo, y no listar CAC por funnel como "métrica en construcción" — decir que no existe. No verifiqué si alguien usa `utm_campaign` o `meta_ad_name` como proxy manual; si existiera, esto pasa de imposible a aproximable.

**4. `stageMetaOpt` va a pintar la etiqueta del otro funnel.** `lib/pipeline.ts:855-868` cae a `DEFAULT_STAGES` y `NUTRI_EXTRA` para etiquetar keys legacy, y esa caída **no distingue** "key vieja" de "key de otro funnel". Modo de falla silencioso y con buena pinta — el que más cuesta cazar en QA. **Decisión por defecto:** mientras haya un solo funnel por workspace no hace nada; el día que se habilite el segundo, `stageMetaOpt` recibe el funnel de la participación como parámetro obligatorio y el rename fuerza al compilador a mostrar los call-sites. Ninguna migración lo cubre.

**5. `huecosDeSecuencias` es funnel-ciega.** `lib/secuencias-huecos.ts:33-79` calcula sobre `funnel.stages` de la única config del workspace y cruza contra `nutricion_secuencias` sin noción de funnel, con un mapa legacy trigger→etapas hardcodeado (`:33-44`). Con N funnels, o cuenta un hueco para todos o cuenta N veces el mismo. `nutricion_secuencias.funnel_id` sola no lo arregla. **Decisión por defecto:** hasta que se le dé ámbito, calcular los huecos **solo sobre el funnel default** y rotular la sección con su nombre. Un número acotado y dicho es mejor que un número que suma embudos.

**6. Bonos, urgencia y prueba como campos de texto libre.** Un textarea vacío no lo llena nadie, y después parece que la feature no sirve. **Decisión por defecto:** `urgencia_tipo` es un chip cerrado (fecha / cupos / capacidad / inicio) + `urgencia_dato` + `urgencia_razon`, porque así el sistema puede **verificar solo** cuándo venció y apagar el ángulo en código. `bonos` es jsonb para que MaKo pueda **proponer tres** desde lo que ya está cargado y el dueño tilde — el mismo criterio de "minimizar config del usuario". `prueba` y `objeciones` sí quedan como texto libre en la v1, y se revisa cuando haya datos de uso.

**7. `ofertas.entregable_ids` no existe: el lead magnet queda a medias.** `lead_magnets` (0125) tiene `oferta_id`, pero `lib/entregable.ts` sigue leyendo el blob `'mako.entregable'` (`:38`) y hay que migrarlo. **Decisión por defecto:** 0125 crea la tabla vacía y **nadie la lee todavía**; `lib/entregable.ts` sigue igual. La migración del blob a la tabla es un commit propio, sin migración, con el mismo patrón de seed perezoso. Hasta entonces, con dos ofertas el lead magnet de una se le sigue inyectando a los prompts de la otra — declarado, no resuelto.

**8. Uniques escondidos por `lead_id` en las tablas de comunicación.** No revisé tabla por tabla si `wa_mensajes`, `wa_borradores`, `wa_bloqueados`, `wa_ocultos`, `email_broadcast_envios` o `chat_agent_handoffs` tienen algún unique que colisione con dos participaciones. Todas tienen `lead_id` nullable (migs 0073-0076, 0046, 0111) y no vi ninguno. **Decisión por defecto:** correr `select conname, conrelid::regclass from pg_constraint where contype='u' and conrelid::regclass::text in (...)` como parte del paso 0. Si aparece alguno, se suma a 0129 (aditivo) y su DROP a 0131.

**9. Cuántos call-sites son realmente diferibles.** La estimación de que ~1.000 de los ~1.207 que nombran campos de recorrido pasan por `pipelineStageOf`/`etapaVigenteDe`/`LISTA_COLS` viene de la distribución por archivo, no de un conteo. Los que leen **columna cruda** son los que el espejo no protege si alguna vez `leads` deja de escribirse. **Decisión por defecto:** no barrerlos ahora. El espejo es **permanente** en este plan (ninguna columna se dropea nunca), así que un lector de columna cruda sigue siendo correcto indefinidamente. El barrido se vuelve necesario solo el día que alguien quiera dropear las columnas de `leads`, y ese día es otro proyecto.

---

## El test de aceptación

Es lo único que hace revisable un cambio de esta superficie, y es **ejecutable**, no "mirar pantallas".

**Contra la base, después de 0128:**
```sql
select count(*) from leads;                                     -- = 
select count(*) from lead_participaciones;                      -- este
select count(*) from leads where participacion_activa_id is null;  -- = 0
select count(*) from leads l join funnels f on f.workspace_id = l.workspace_id and f.es_default
  where not exists (select 1 from lead_participaciones p where p.lead_id = l.id);  -- = 0
```

**Contra la app, antes y después de 0130** (y este test hay que **escribirlo antes**, no después): `getResumenComercialMaduras()`, `getCohortesMensuales()` y `getFunnelEtapas()` devuelven objetos **idénticos**. Con una sola participación por lead, todas las pantallas y todos los números tienen que dar exactamente lo de hoy. Si algo cambia, está mal el espejo, no el modelo.

**Y `npm test` a mano antes de pushear.** El hook de pre-push corre el typecheck y los dos chequeos de sincronización, pero **no corre los tests** (AGENTS.md). Este proyecto renombra `getFunnel()`, toca `nav.ts`, crea tabs y toca catálogos: es exactamente el caso donde un renombre pasa el typecheck perfecto y rompe una aserción por **nombre**.