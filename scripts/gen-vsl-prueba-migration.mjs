// Genera supabase/migrations/0023_vsl_prueba_history.sql desde el CSV de YouTube
// del VSL anterior ("Clase práctica... DOS"). Solo escribe el .sql; no toca la BD.
import { readFileSync, writeFileSync } from 'node:fs';

const CSV = 'C:/Users/marti/Downloads/Contenido 2025-11-30_2026-06-19 Clase práctica de un sistema operativo para director (DOS)/Totales.csv';
const VIDEO_ID = 'vsl-prueba-dos'; // marcador (no es un id real de YouTube; no hay cron para este video)

const lines = readFileSync(CSV, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const rows = [];
for (const l of lines) {
  const [fecha, vis] = l.split(',');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue; // salta encabezado
  rows.push([fecha, Number(vis) || 0]);
}

const total = rows.reduce((s, [, v]) => s + v, 0);
const pico = rows.reduce((m, [f, v]) => (v > m.v ? { f, v } : m), { f: '', v: -1 });

const values = rows.map(([f, v]) => `  ('${f}', ${v})`).join(',\n');

const sql = `-- =============================================================================
-- 0023 — Histórico del VSL ANTERIOR ("Clase práctica... DOS") para Tendencias
-- =============================================================================
-- Mauricio probó varios VSL; este es uno anterior. NO se contabiliza en el
-- funnel (por eso youtube_video_type queda NULL → las queries de vsl_views y
-- la serie "Plays del VSL" lo ignoran). Solo se siembra para poder dibujar su
-- propia línea en el gráfico de Tendencias (serie 'vsl_prueba'), que filtra por
-- youtube_video_id = '${VIDEO_ID}'.
--
-- Datos: vistas diarias medidas (export de YouTube), ${rows.length} días.
-- Total: ${total} vistas | pico: ${pico.v} el ${pico.f}.
-- Idempotente: borra el marcador y reinserta el rango completo.
-- =============================================================================

BEGIN;

DELETE FROM marketing_metrics_daily
WHERE plataforma = 'youtube' AND youtube_video_id = '${VIDEO_ID}';

INSERT INTO marketing_metrics_daily (
  fecha, plataforma, youtube_video_id, youtube_video_type, youtube_views, raw_payload
)
SELECT v.fecha::date, 'youtube', '${VIDEO_ID}', NULL, v.vistas,
       jsonb_build_object('source', 'vsl-prueba-seed', 'titulo', 'Clase práctica de un sistema operativo para director (DOS)')
FROM (VALUES
${values}
) AS v(fecha, vistas);

COMMIT;
`;

const out = 'supabase/migrations/0023_vsl_prueba_history.sql';
writeFileSync(out, sql, 'utf8');
console.log(`Generado ${out} — ${rows.length} días, total ${total}, pico ${pico.v} (${pico.f})`);
