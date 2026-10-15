-- =============================================================================
-- XXXX_lead_instagram_desde_ig — el @ de Instagram de los leads que entraron por Instagram sin él
-- =============================================================================
-- Tanda B del CRM (14/10/2026, docs/diseno-ficha-bloques.md §5): «El @ de Instagram en el lead que
-- entra por Instagram». Hasta esta tanda, el alta de Zernio (`crearLeadDe`, lib/zernio-entrante.ts)
-- creaba el lead SIN su usuario: el usuario quedaba en `ig_conversaciones.username` y la ficha
-- (`redes-y-web`, `charla-dm`) mostraba el Instagram vacío de alguien que llegó por Instagram. El
-- código nuevo lo pasa al alta; esto completa los que ya están.
--
-- QUÉ ESCRIBE: `leads.instagram` SÓLO DONDE ESTÁ VACÍO (null o en blanco): lo que una persona cargó
-- en la ficha no se toca. Desde la conversación de INSTAGRAM (`plataforma = 'instagram'`) y nunca de
-- Messenger: ahí el usuario es el de Facebook, y en `instagram` linkearía al perfil de otra persona.
-- Con la regla de `usuarioDeTexto` (lib/instagram-buscar.ts): sin la @, en minúsculas, de 1 a 30 de
-- [a-z0-9._] y con al menos una letra o número; lo que no tiene esa forma no se escribe. Si el lead
-- tiene dos conversaciones de Instagram (dos cuentas del negocio), la del último mensaje (el mismo
-- desempate que `conversacionQueCuenta`, lib/canal-social.ts). El workspace se compara: el lead y su
-- conversación son del mismo negocio.
--
-- Y CADA LEAD COMPLETADO DEJA SU LÍNEA EN EL HISTORIAL (`lead_audit`, campo «Instagram», autor
-- «Instagram»), con su `workspace_id` EXPLÍCITO: la columna tiene default 1 (mig 0054), y una línea
-- sin él caería en el historial del ws1, que es un cliente real.
--
-- ⚠️ ORDEN DE DESPLIEGUE: DESPUÉS DEL DEPLOY. Corrida antes, los leads de Instagram que entren entre
-- esta migración y el deploy nacen sin su @ (los crea el código viejo) y quedan sin completar. No
-- rompe nada si se corre antes: sólo deja ese hueco, que se llena corriéndola otra vez. Es idempotente:
-- la segunda vez no encuentra ningún lead vacío con conversación, y no escribe ni una línea.
-- Medido en producción el 09/10/2026 (mig 0242): `ig_conversaciones` tenía 0 filas; lo que haya hoy
-- es lo que entró desde ese día.
-- =============================================================================

begin;

with candidatos as (
  select ic.id, ic.lead_id, ic.workspace_id, ic.ultimo_mensaje_at,
         lower(regexp_replace(btrim(ic.username), '^@+', '')) as usuario
  from ig_conversaciones ic
  where ic.plataforma = 'instagram'
    and ic.lead_id is not null
    and ic.username is not null
),
elegidos as (
  select distinct on (lead_id) lead_id, workspace_id, usuario
  from candidatos
  where usuario ~ '^[a-z0-9._]{1,30}$' and usuario ~ '[a-z0-9]'
  order by lead_id, ultimo_mensaje_at desc nulls last, id desc
),
completados as (
  update leads l
  set instagram = e.usuario
  from elegidos e
  where l.id = e.lead_id
    and l.workspace_id = e.workspace_id
    and (l.instagram is null or btrim(l.instagram) = '')
  returning l.id, l.workspace_id, l.instagram
)
insert into lead_audit (lead_id, workspace_id, campo, valor_anterior, valor_nuevo, autor)
select id, workspace_id, 'Instagram', null, instagram, 'Instagram'
from completados;

commit;
