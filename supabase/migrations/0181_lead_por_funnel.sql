-- =============================================================================
-- 0181 — A qué funnel pertenece un lead
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES** del deploy. El código nuevo filtra el tablero por
-- esta columna; sin ella, PostgREST rechaza la consulta y el CRM queda en blanco.
--
-- ⚠️ POR QUÉ EXISTE. Hasta hoy un lead no pertenecía a ningún funnel: el selector
-- del CRM elegía qué funnel se DIBUJA y no cambiaba los leads. Martín creó tres
-- productos («Sistema DOS», «Prueba 2», «Prueba 3») y los tres le mostraron sus
-- 1.145 leads de siempre. Lo reportó así: «creé una prueba 3 y aún no cambió
-- absolutamente nada... los mismos leads, se cargó todo lleno en lugar de vacío».
--
-- Su decisión, textual (28/09/2026): «un lead pertenece a UN solo funnel. Puede
-- estar en varios funnel, pero eso se configura, se carga a un lead a ese funnel.
-- Cuando se crea un nuevo funnel no debería tener nada.»
--
-- De ahí sale una COLUMNA y no una tabla de cruce: la pertenencia por defecto es
-- una sola. El día que haya que poner un lead en dos funnels a la vez, eso es una
-- acción explícita y se modela entonces — hacerlo hoy sería una tabla de cruce con
-- exactamente una fila por lead.
--
-- ⚠️ NULL SIGNIFICA «EL DEL NEGOCIO», Y NO ES UN DESCUIDO. Un lead sin funnel no
-- puede desaparecer del CRM: el tablero por defecto tiene que seguir mostrando
-- todo lo que no está asignado a un funnel secundario. Por eso el backfill de
-- abajo NO rellena los nulls — los deja, y el filtro del server los trata como del
-- funnel del negocio. Rellenarlos sería escribir 1.500 veces un dato que ya se
-- deduce, y que se rompería el día que alguien cambie cuál es el funnel default.
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS funnel_id BIGINT;

COMMENT ON COLUMN leads.funnel_id IS
  'A qué funnel pertenece este lead. NULL = el funnel del negocio (es_default), que es '
  'lo que ve el tablero sin ?funnel=. Un funnel secundario recién creado arranca sin '
  'ningún lead: es lo que lo hace un tablero propio y no una vista del mismo.';

-- ⚠️ SIN FOREIGN KEY A PROPÓSITO. Borrar un funnel no puede borrar ni bloquear leads:
-- son datos del negocio y sobreviven a la configuración. Un `funnel_id` que apunta a
-- un funnel que ya no existe se comporta igual que un NULL (el filtro no lo encuentra
-- y cae al del negocio), que es exactamente lo que se quiere.

-- El tablero pregunta «los de ESTE funnel de ESTE workspace», siempre juntos.
CREATE INDEX IF NOT EXISTS leads_ws_funnel_idx ON leads (workspace_id, funnel_id);

COMMIT;
