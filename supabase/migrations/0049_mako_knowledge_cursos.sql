-- =============================================================================
-- 0049_mako_knowledge_cursos — Conocimiento por CURSOS y ÁREA de aplicación
-- =============================================================================
-- Evoluciona mako_knowledge de una lista plana a "cursos" (agrupador por autor /
-- metodología) con un ÁREA de aplicación, para que cada conocimiento se enchufe
-- donde corresponde:
--   - area='mensajes' → reactivación / copy de WhatsApp (ej. "Levanta Muertos")
--   - area='ads'      → creativos de anuncios (futuro)
--   - area='general'  → aplica en cualquier lugar del dashboard (default)
-- Todo es aditivo y nullable: las filas existentes quedan como 'general' y el RAG
-- de hoy sigue funcionando idéntico (searchKnowledge sin filtro las incluye).
-- fuente: 'manual' (escrito) | 'transcripcion' (subiste un video/audio y OpenAI
-- lo transcribió) — solo informativo para la UI.

alter table mako_knowledge add column if not exists curso  text;
alter table mako_knowledge add column if not exists autor  text;
alter table mako_knowledge add column if not exists area   text not null default 'general';
alter table mako_knowledge add column if not exists fuente text not null default 'manual';

create index if not exists mako_knowledge_area_idx  on mako_knowledge (area);
create index if not exists mako_knowledge_curso_idx on mako_knowledge (curso);
