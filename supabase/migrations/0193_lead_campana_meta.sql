-- =============================================================================
-- 0193 — el lead guarda DE QUÉ CAMPAÑA vino, por id
-- =============================================================================
-- ORDEN DE DESPLIEGUE: esta migración AGREGA una columna que el código nuevo ESCRIBE,
-- así que va ANTES o JUNTO con el deploy. Al revés es el peor caso de la familia: el
-- webhook de Meta manda `meta_campaign_id`, PostgREST rechaza la fila ENTERA por una
-- columna que no existe, y el webhook atrapa el error por lead y contesta 200 — o sea
-- que Meta NO reintenta y el lead del formulario SE PIERDE. No es «se guarda sin la
-- campaña»: es que no entra.
--
-- POR QUÉ. Pedido de Martín (05/10/2026): asignar campañas y/o conjuntos de Meta a un
-- PRODUCTO desde la etapa «Lead entrante», para que sus leads caigan en el tablero de
-- ese producto. Para eso el lead tiene que saber de qué campaña vino, y hasta hoy
-- guardaba sólo el NOMBRE (`meta_campaign_name`): un nombre no es una clave —se
-- renombra, se repite entre cuentas— y el ruteo decide en qué tablero aparece alguien.
--
-- POR QUÉ UNA COLUMNA Y NO DOS. El conjunto ya tenía la suya desde la 0001:
-- `adset_id_origen`, comentada como «para atribuir; requiere UTMs», y medida el
-- 05/10/2026 con CERO filas escritas en los 7 workspaces con leads. Agregar un
-- `meta_adset_id` al lado dejaría dos columnas para el mismo dato, y la que nadie
-- escribe es la que alguien va a leer creyendo que está vacía por otra razón. Se usa
-- la que existe y se le corrige el comentario.
--
-- El índice va por workspace porque toda lectura de leads pasa por `getTenantDb`, que
-- filtra por `workspace_id` primero.
-- =============================================================================

alter table leads add column if not exists meta_campaign_id text;

comment on column leads.meta_campaign_id is
  'ID de la campaña de Meta de la que vino el lead. Lo escribe SOLO el formulario de Meta (Graph lo trae). En los leads de landing el id vive en utm_campaign y no se copia acá. Decide el producto si la campaña está asignada a uno (setting meta.campanas).';

comment on column leads.adset_id_origen is
  'ID del conjunto de anuncios de Meta del que vino el lead. Lo escribe el formulario de Meta (Graph trae adset_id) desde la 0193; hasta entonces no lo escribía nadie.';

create index if not exists idx_leads_ws_campana
  on leads (workspace_id, meta_campaign_id)
  where meta_campaign_id is not null;
