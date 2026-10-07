-- =============================================================================
-- 0213 — El PASO 5 del curso (#665): la IA propone, el cliente aprueba o corrige
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Agrega y no saca nada.
--
--   · El código nuevo LEE estas columnas de `curso_progreso` al armar el portal del alumno y la
--     pestaña Curso de la ficha (`COLS_PROGRESO_IA`, lib/curso-datos.ts). Un `select` de PostgREST
--     con UNA columna que no existe rechaza la consulta ENTERA: sin esta migración, el portal y la
--     ficha dirían que no pueden leer el curso.
--   · Y el cron de las sesiones de entrega (/api/cron/cs-sesiones-entrega) lee y escribe las dos de
--     `closing_analyses`. Sin ellas, su segunda pasada (las propuestas) falla con su log y el
--     análisis de la sesión sigue igual (lib/closing-entrega.ts la envuelve).
--   · Aplicarla antes no molesta a la versión desplegada: ningún código viejo las nombra.
--
-- Decisión de Martín (06/10/2026, memoria cs-decisiones-cierre-0610): «Paso 5: IA + aprobación».
-- Después de la llamada de entrega, la IA (GRATIS) reescribe la respuesta del cliente con lo que se
-- habló, y el CLIENTE la aprueba o la corrige en su portal. Mauricio: «no quisiera automatizarlo al
-- cien por ciento» — por eso la IA NUNCA escribe `valores`.
--
-- ── 1. La propuesta, al lado de la respuesta (curso_progreso) ──────────────────
--   · valores_ia       = la versión de la IA, con la MISMA forma que `valores` (validada contra el
--                        formulario de la clase al proponer: lib/curso-propuesta.ts, `validarPropuesta`).
--   · ia_estado        = pendiente | aprobada | corregida. NULL = no hay propuesta.
--   · ia_recording_id  = de qué grabación salió (`closing_analyses.recording_id`). Sin FK a propósito:
--                        la PK de closing_analyses es (workspace_id, recording_id) y un ON DELETE SET
--                        NULL compuesto vaciaría también el workspace. Si la grabación se borra, la
--                        propuesta (y lo que el cliente decidió) se queda.
--   · ia_propuesta_at  = cuándo se propuso. Es el TOKEN del compare-and-set de «Aprobar»: se aprueba
--                        sólo si sigue `pendiente` Y es la misma propuesta que el cliente vio.
--   · ia_resuelta_at   = cuándo la aprobó o la corrigió.
--
-- ⚠️ `valores` (lo que escribió el cliente) NO SE TOCA AL PROPONER. Sólo «Aprobar» copia la versión
-- de la IA ahí, y lo hace el cliente con un click (lib/curso-datos.ts, `aprobarPropuestaIA`).
--
-- ── 2. Qué sesión ya se miró para proponer (closing_analyses) ──────────────────
--   · curso_propuesta_at   = cuándo el cron miró esta sesión para proponer. NULL = todavía no. La
--                            cola se CALCULA con esto (como la del análisis: no se escribe en otro lado).
--   · curso_propuesta_nota = qué pasó: cuántas propuestas, o por qué ninguna. Un descarte sin rastro
--                            hace indistinguibles «no había nada que proponer» y «falló» (AGENTS.md,
--                            «Una política puede RECHAZAR; no puede no dejar rastro»).
--
-- No hay tabla nueva: las dos ya están en TENANT_TABLES y tienen RLS + revoke (0037, 0202).

begin;

-- ── 1. curso_progreso ────────────────────────────────────────────────────────
alter table curso_progreso
  add column if not exists valores_ia      jsonb,
  add column if not exists ia_estado       text,
  add column if not exists ia_recording_id bigint,
  add column if not exists ia_propuesta_at timestamptz,
  add column if not exists ia_resuelta_at  timestamptz;

alter table curso_progreso drop constraint if exists curso_progreso_ia_estado_valido;
alter table curso_progreso add constraint curso_progreso_ia_estado_valido
  check (ia_estado is null or ia_estado in ('pendiente', 'aprobada', 'corregida'));

-- Las tres van juntas: un estado sin versión (o una versión sin cuándo) no se puede aprobar ni
-- dibujar, y el saneo al leer la tiraría en silencio.
alter table curso_progreso drop constraint if exists curso_progreso_ia_coherente;
alter table curso_progreso add constraint curso_progreso_ia_coherente
  check (
    (ia_estado is null) = (valores_ia is null)
    and (ia_estado is null) = (ia_propuesta_at is null)
    and (valores_ia is null or jsonb_typeof(valores_ia) = 'object')
  );

comment on column curso_progreso.valores_ia is
  'La versión de la IA de esta respuesta (paso 5 de #665), con la forma de `valores`. La escribe el cron de las sesiones de entrega; NUNCA pisa `valores`: el cliente la aprueba o la corrige en su portal.';
comment on column curso_progreso.ia_estado is
  'pendiente | aprobada | corregida. NULL = sin propuesta.';
comment on column curso_progreso.ia_recording_id is
  'De qué grabación (closing_analyses.recording_id) salió la propuesta. Sin FK a propósito (ver 0213).';
comment on column curso_progreso.ia_propuesta_at is
  'Cuándo se propuso: el token del compare-and-set al aprobar.';
comment on column curso_progreso.ia_resuelta_at is
  'Cuándo el cliente la aprobó o la corrigió.';

-- ── 2. closing_analyses ──────────────────────────────────────────────────────
alter table closing_analyses
  add column if not exists curso_propuesta_at   timestamptz,
  add column if not exists curso_propuesta_nota text;

comment on column closing_analyses.curso_propuesta_at is
  'Sesión de entrega: cuándo se la miró para proponer las respuestas del curso (paso 5 de #665). NULL = todavía no.';
comment on column closing_analyses.curso_propuesta_nota is
  'Qué salió de mirarla para proponer: cuántas propuestas, o por qué ninguna.';

commit;
