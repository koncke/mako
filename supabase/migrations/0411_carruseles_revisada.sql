-- =============================================================================
-- 0411 — Un ejemplo nuevo de la biblioteca no se ve hasta que alguien lo mira (6/11/2026)
-- =============================================================================
-- El agujero que cerraba (docs/hallazgos-carruseles.md → «Sin hacer», encargo 110): la biblioteca de ejemplos la curó una
-- persona a mano (598 escondidas de 1.588, el 5 y el 6/11), pero **lo que trajera la próxima lectura iba a aparecerle al
-- cliente sin que nadie lo mirara**. Y el filtro automático ya se midió y NO sirve: el modelo barato se pasó de estricto (35
-- de 388 escondidos volvieron) y el filtro gratis `(laminas ?? 0) >= 3 && parece_contenido === true` tiraba 457 piezas de las
-- que 363 servían. Así que no se filtra: se ESPERA a que una persona la mire.
--
-- `revisada_en` null = **nadie la miró todavía**, y la biblioteca no la muestra. Con fecha = una persona la dejó pasar.
-- Es un estado aparte de `dejo_de_verse_en` A PROPÓSITO: «la miramos y no sirve» y «nadie la miró» no son lo mismo, y los
-- dos SQL de deshacer que viven en el documento salen de la FECHA de `dejo_de_verse_en` — mezclarlos los rompería.
--
-- ⚠️ EL BACKFILL NO ES OPCIONAL: sin él, aplicar esta migración vacía la vidriera de golpe (las 990 que hoy se ven pasarían a
-- «sin mirar»). Las que ya están pasaron por la curaduría del 5 y 6/11, así que quedan marcadas con la fecha de la migración.
-- Es idempotente: sólo toca las que tienen `revisada_en` en null Y ya existen, y una segunda corrida no encuentra ninguna
-- (las que entren DESPUÉS ya nacen sin mirar, que es el punto).
--
-- ORDEN DE DESPLIEGUE: indiferente. El código lee con `*` y aguanta que falte: sin la columna, la biblioteca se comporta como
-- antes (todo visible) y el comando `revisar` del script lo dice en vez de fallar (lib/carruseles/biblioteca.ts,
-- `estaRevisada`). Global, como las tablas de la 0392: sin `workspace_id`, RLS sin políticas, sin permisos para la clave
-- pública.
-- =============================================================================
begin;

alter table carruseles_biblioteca_piezas add column if not exists revisada_en timestamptz;

-- Lo que ya está guardado YA pasó por la curaduría a mano: no se esconde de golpe.
update carruseles_biblioteca_piezas set revisada_en = now() where revisada_en is null;

-- La biblioteca lee lo visible y sin mirar es el caso raro: un índice parcial sobre las que faltan revisar.
create index if not exists carruseles_biblioteca_piezas_sin_revisar_idx
  on carruseles_biblioteca_piezas (id desc) where revisada_en is null;

comment on column carruseles_biblioteca_piezas.revisada_en is
  'Cuando una persona la miro y la dejo pasar. null = nadie la miro todavia y la biblioteca NO la muestra (el filtro automatico se midio y no sirve: ver docs/hallazgos-carruseles.md). Distinto de dejo_de_verse_en, que es «la miramos y no sirve».';

commit;
