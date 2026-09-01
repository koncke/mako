-- =============================================================================
-- 0152 — Los formatos que crea el cliente
-- =============================================================================
-- Hasta hoy los formatos («puestas en escena») son DOS y viven hardcodeados en
-- `CATALOGO_PUESTAS`. Esto agrega los del cliente.
--
-- ⚠️ LA REGLA QUE GOBIERNA ESTA TABLA ESTÁ ESCRITA EN EL TIPO `Puesta`, Y NO SE
-- PUEDE AFLOJAR:
--
--   «Para sumar una puesta al menú: se produce un anuncio con ella, se recorta el
--    ejemplo y se agrega acá. SIN EJEMPLO NO ENTRA — no por prolijidad, sino
--    porque ofrecer un formato que nadie produjo es prometer sin haber medido.»
--
-- Y no es sólo un comentario: `puestasOfrecidas()` filtra por `p.ejemplo`. Un
-- formato sin un clip real producido con él NO aparece en el menú, y esta tabla
-- respeta lo mismo con `estado`.
--
-- Por eso un formato no nace `listo`: nace `borrador`, y pasa a `listo` cuando
-- una prueba REAL contra Flow salió bien y la persona la miró. Un formato es un
-- prompt validado, no una fila de configuración.
begin;

create table if not exists formatos (
  -- ⚠️ EL ID ES TEXTO Y LO ELIGE EL SERVIDOR, con prefijo.
  --
  -- Los planes guardados referencian el formato por `puestaId` adentro de
  -- `video-generator.historial`. Si un cliente pudiera elegir el id, podría
  -- escribir `selfie-movimiento` y TAPAR un formato de fábrica: sus anuncios
  -- viejos pasarían a filmarse con otro prompt sin que nada avise.
  -- El prefijo `ws<N>-` hace imposible la colisión.
  id            text primary key,
  workspace_id  bigint not null,

  -- Lo que se ve al elegir. `nombre` en inglés y entendible solo, como los de
  -- fábrica («The Office», «Car Talks»).
  nombre        text not null,
  tecnico       text not null default '',
  descripcion   text not null default '',
  cuando        text not null default '',

  -- ── Las restricciones físicas ─────────────────────────────────────────────
  -- Salen MEDIDAS de un video de referencia o elegidas de opciones cerradas,
  -- nunca escritas a mano en un campo libre.
  personas      smallint not null default 1 check (personas in (1, 2)),
  clips_min     smallint not null check (clips_min between 1 and 24),
  clips_max     smallint not null check (clips_max between 1 and 24),

  -- ⚠️ SOLO LAS CUATRO DURACIONES QUE FLOW GENERA. Pedirle 9 segundos no da un
  -- clip de 9: da uno que no existe. El check lo hace imposible desde la base,
  -- que es el único lugar donde no se puede olvidar.
  segundos_min  smallint not null check (segundos_min in (4, 6, 8, 10)),
  segundos_max  smallint not null check (segundos_max in (4, 6, 8, 10)),

  camara        text not null,
  habla         text not null check (habla in ('siempre', 'nunca', 'mixto')),
  ritmo         text not null default '',

  -- ⚠️ PALABRAS POR SEGUNDO, Y NO ES UNA PREFERENCIA DE ESTILO.
  --
  -- Es cuánto texto acepta el modelo antes de tartamudear o de sobrarle tiempo,
  -- y de acá sale el tope de palabras de cada toma. Un número inventado no da un
  -- error: da anuncios donde la persona habla apurada o se queda muda al final.
  -- Se MIDE contra un video de referencia (palabras ÷ segundos), no se pregunta.
  densidad      numeric(4,2) not null check (densidad > 0 and densidad <= 8),

  -- Cuántas IMÁGENES hay que generar antes del video. Una por ESCENARIO, no por
  -- clip: siete tomas dentro del mismo auto son un escenario.
  escenarios    smallint not null default 1 check (escenarios between 1 and 12),

  -- Las que rompen el formato si se ignoran. Van a la tarjeta y al prompt.
  reglas        jsonb not null default '[]'::jsonb,

  -- ── Los dos prompts, que son el corazón ───────────────────────────────────
  -- El de imagen describe el LUGAR y nunca a la persona: la identidad la
  -- resuelve la foto de referencia, y cualquier descripción compite con ella.
  -- El de video dice qué HACE la persona, no rehace la escena.
  prompt_imagen text not null default '',
  prompt_video  text not null default '',

  -- ── El estado, que es lo que hace honesto al formato ──────────────────────
  --   borrador   se está creando; no se ofrece
  --   listo      una prueba real salió bien y alguien la miró
  --   archivado  se dejó de ofrecer, pero los anuncios viejos lo siguen
  --              resolviendo (ver el comentario de abajo)
  estado        text not null default 'borrador'
                check (estado in ('borrador', 'listo', 'archivado')),

  -- ⚠️ EL EJEMPLO ES LO QUE LO HABILITA. Sin `ejemplo_video` no puede pasar a
  -- `listo`: es el clip que se produjo con este formato, y es a la vez la prueba
  -- de que funciona y lo que se muestra al elegir.
  ejemplo_video text not null default '',
  ejemplo_poster text not null default '',
  ejemplo_seg   numeric(6,2),

  creado_por    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint formatos_rango_clips check (clips_min <= clips_max),
  constraint formatos_rango_segundos check (segundos_min <= segundos_max),
  -- Un formato `listo` SIN ejemplo es exactamente lo que la regla prohíbe, y se
  -- prohíbe acá y no en el código: es el único lugar donde no se puede olvidar.
  constraint formatos_listo_con_ejemplo check (estado <> 'listo' or ejemplo_video <> '')
);

create index if not exists formatos_del_ws on formatos (workspace_id, estado, created_at desc);

-- RLS prendida y CERO policies, igual que `flow_trabajos` (0145) y
-- `montaje_trabajos` (0151): nadie entra con la key anónima. Se lee y se escribe
-- por `getTenantDb`, que scopea por workspace.
alter table formatos enable row level security;

comment on table formatos is
  'Los formatos de video que crea cada cliente. Un formato es un prompt VALIDADO contra Flow, no una fila de config: sin un clip producido con el no pasa a listo (mig 0152).';
comment on column formatos.densidad is
  'Palabras por segundo. Se MIDE contra un video de referencia. Un numero inventado no da error: da anuncios donde la persona habla apurada o se queda muda.';
comment on column formatos.estado is
  'archivado NO es borrado: los anuncios ya guardados lo referencian por id y tienen que poder seguir resolviendolo.';

commit;
