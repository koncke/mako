-- =============================================================================
-- 0365 — el TikTok de un competidor (ítems 10/11 de Competitors Spy, 3/11/2026)
-- =============================================================================
-- Martín: «con un dato, traer todas sus redes», y validarlas. La búsqueda de sus otras redes
-- (`lib/spy-otras-redes.ts`) trae YouTube, Instagram y TikTok; los dos primeros ya tenían columna.
--
-- ⚠️ SPY NO LEE TIKTOK: esto guarda DÓNDE está, confirmado por la persona, para que la ficha lo
-- muestre y no haya que volver a buscarlo. Leer sus piezas es otro trabajo.
--
-- ⚠️ Y ANTES DE ESTA COLUMNA UN LINK A TIKTOK EN LA BIO SE GUARDABA COMO SU «LANDING»: `queEs`
-- clasificaba tiktok.com como un sitio cualquiera.
--
-- Sólo AGREGA una columna que puede quedar en null: no cambia ninguna fila existente.
-- =============================================================================
begin;

alter table spy_competidores
  add column if not exists tiktok text
    check (tiktok is null or tiktok ~ '^[a-z0-9._]{2,30}$');

comment on column spy_competidores.tiktok is
  'Su @ de TikTok, sin la arroba y en minúsculas. Lo guarda sólo la persona (escribiéndolo o confirmando un candidato de la búsqueda): nada de una búsqueda entra sin su «sí».';

commit;
