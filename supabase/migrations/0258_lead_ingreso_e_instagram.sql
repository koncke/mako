-- =============================================================================
-- 0258 — leads.ingreso_estimado y leads.instagram: dos datos nuevos de la ficha
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy (o junto, pero nunca después). El código nuevo
-- LEE las dos columnas en el `select` del tablero (`LISTA_COLS`, lib/leads.ts), y un
-- `select` de PostgREST con UNA columna que no existe rechaza la consulta ENTERA: sin esta
-- migración el CRM de TODOS los workspaces abre vacío, sin un error que lo diga (AGENTS.md,
-- «Un `select` de PostgREST con UNA columna que no existe…»). Aplicarla antes no le molesta
-- a la versión desplegada: son dos columnas nullable que nadie lee todavía.
--
-- Pedidos de Martín (12/10/2026, feedback del CRM):
--
--   · Punto 21: «Y en "Información principal" pon una opción de "Ingreso Estimado", para
--     poder colocarle un ingreso estimado a ese lead... Y si en una columna hay dinero,
--     debería tener el total arriba del todo, cerca del título de la columna... Obvio que
--     con una aclaración sutil o con un ícono o algo que represente "estimado", solo el
--     verdadero ingreso en Ganados.»
--     En USD, como todo el dinero del CRM (`monto_cierre_usd`, `suscripcion_monto_usd`).
--     NO es el monto de la venta: es lo que alguien CREE que vale el lead mientras está
--     abierto. Por eso es otra columna y no se mezcla con `monto_cierre_usd`, que es lo que
--     cuentan Revenue, el dashboard y el CAC. Lo escribe una persona desde la ficha
--     (`guardarCampoLeadAction`, campo 'ingreso_estimado'), que valida número ≥ 0.
--
--   · Punto 28: el alta de un lead pasa a cuatro campos —«Nombre, Email, Telefono,
--     Instagram»— con un buscador de perfiles de Instagram. Se guarda el USUARIO, sin la @
--     (lo normaliza `usuarioInstagram`, app/crm/campo-inline.ts), nunca la foto: la foto de
--     un perfil es una URL del CDN de Meta que VENCE. La ficha lo muestra y lo edita en
--     «Información principal», con link al perfil.
--
-- Sin backfill: no hay de dónde sacar ninguno de los dos datos para los leads que ya están.
-- Idempotente (`if not exists`): correrla dos veces no hace nada.
-- =============================================================================

begin;

alter table leads add column if not exists ingreso_estimado numeric;
alter table leads add column if not exists instagram text;

comment on column leads.ingreso_estimado is
  'Ingreso ESTIMADO del lead en USD (lo escribe una persona en la ficha). No es una venta: lo real vive en monto_cierre_usd / suscripcion_monto_usd. El tablero lo suma por columna con la marca de estimado (punto 21, 12/10/2026).';
comment on column leads.instagram is
  'Usuario de Instagram del lead, SIN la @ (lo normaliza usuarioInstagram, app/crm/campo-inline.ts). Lo escribe el alta (buscador de perfiles) o la ficha. La foto del perfil no se guarda: la URL de Meta vence (punto 28, 12/10/2026).';

commit;
