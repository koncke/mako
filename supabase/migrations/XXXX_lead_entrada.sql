-- =============================================================================
-- XXXX_lead_entrada — cómo entró el lead: la página donde se registró y su primera entrada social
-- =============================================================================
-- Tanda B del CRM (14/10/2026), la ficha por bloques (docs/diseno-ficha-bloques.md §5, «Datos que
-- hacen falta»). Martín: «piensa en todos los bloques que un usuario, con los diferentes funnels que
-- tenemos... podría llegar a querer ver», «también los funnels orgánico, de Instagram, LinkedIn, DM
-- Funnel, YouTube, lead magnet». Dos datos que el alta conocía y tiraba:
--
--  · `pagina_registro` (bloque `pagina-de-registro`): la página donde dejó sus datos. El opt-in de la
--    landing la recibe en cada envío (`pagina`, la usa para probar que el Pixel está en una página y
--    para elegir el producto) y no la guardaba en el lead. Es la URL NORMALIZADA (`normalizarUrl`,
--    lib/landing-paginas.ts: sin UTM ni click-ids). El cuándo es `created_at`.
--  · `entrada_social` (bloques `origen` y `publicacion-de-entrada`): cómo entró por Instagram o
--    Messenger —comentario, historia, DM, anuncio, enlace de referencia o QR—, la publicación, lo que
--    comentó (la palabra clave del DM funnel), el `ref` y el anuncio. Un jsonb que escribe UNA vez el
--    alta de Zernio (`entradaSocialDe`, lib/canal-social.ts). Hasta acá `ig_conversaciones` guardaba
--    sólo el ÚLTIMO comentario (cada uno pisa al anterior: el motor necesita ése para la respuesta
--    privada), y el texto del comentario, el `ref` y el anuncio no quedaban en ningún lado.
--
-- Las escribe SÓLO el alta (`createLead`, lib/leads.ts), nunca un update: son el primer contacto y
-- no se pisan. SIN BACKFILL: de los leads que ya están no hay de dónde sacarlas (la página de un lead
-- viejo, si hace falta, sale de `landing_visits.landing_url` por `visitor_id`, que es otra pregunta:
-- por dónde pasó, no dónde se registró).
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES O JUNTO CON EL DEPLOY. El alta las nombra en su insert, y un insert
-- con una columna que no existe se rechaza entero. Si igual llega DESPUÉS, no se pierde ningún lead:
-- `createLead` reintenta una vez sin estas dos columnas (lib/lead-alta-columnas.ts) y el lead entra
-- sin la página ni la entrada, con un log «falta la migración XXXX_lead_entrada». Lo que se pierde es
-- ese dato de los leads que entren en el medio. Las lecturas no las nombran (la ficha lee con `*` y
-- el tablero no las pide), así que ninguna pantalla depende de esta migración para abrir.
-- Aplicarla antes no le molesta a la versión desplegada: son dos columnas nullable que nadie lee.
-- Idempotente (`if not exists`).
-- =============================================================================

begin;

alter table leads add column if not exists pagina_registro text;
alter table leads add column if not exists entrada_social jsonb;

comment on column leads.pagina_registro is
  'La página donde el lead dejó sus datos (opt-in de la landing), normalizada sin UTM ni click-ids. La escribe sólo el alta (app/api/track/optin). Cuándo = created_at. Tanda B del CRM, 14/10/2026.';
comment on column leads.entrada_social is
  'Cómo entró por Instagram o Messenger, guardado UNA vez al crear el lead (lib/zernio-entrante.ts, entradaSocialDe): { canal, como, at, cuenta_id, post_id, comentario_id, texto, ref, anuncio_id }. Se lee con entradaSocialGuardada (lib/canal-social.ts).';

commit;

notify pgrst, 'reload schema';
