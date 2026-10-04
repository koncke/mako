-- =============================================================================
-- 0186 — las corridas de un flujo: en qué paso va, y cuándo seguir
-- =============================================================================
-- El pedido, textual (04/10/2026): «si paso el cursor por una flecha, debería dejarme
-- agregar un condicional en medio. O también un "Delay"», y antes «un "Condicional",
-- que este último es por ejemplo, si responde al mensaje anterior».
--
-- ⚠️ POR QUÉ HACÍA FALTA UNA TABLA Y NO ALCANZABA CON UN TIPO DE PASO NUEVO. El paso
-- `esperar` estaba DECLARADO en `lib/flujos-tipos.ts` desde el día uno y hacía
-- `break`: `ejecutarPasos` era un `for` sincrónico adentro del webhook, así que no
-- había dónde anotar en qué paso quedó. Sin eso no hay delay y no hay condicional —
-- no faltaba el tipo de paso, faltaba el ESTADO. La prueba está a la vista: el
-- `esperar` existía, se podía escribir, y no se ejecutaba nunca.
--
-- ORDEN DE DESPLIEGUE: **antes o junto** con el deploy. El drenador y el motor nuevo
-- YA LEEN esta tabla; entre un deploy sin tabla y la migración, un flujo con delay
-- se corta en el primer `esperar` igual que antes — sin error y sin que nada lo diga.
--
-- ⚠️ POR QUÉ NO VA EN `mako.plantillas.store`, que es donde vive el flujo. Las dos
-- razones que la 0183 ya pagó: ese store SE HEREDA del dueño campo por campo (una
-- corrida a medias de Mauricio sería el default de los otros nueve workspaces), y lo
-- reescribe el navegador ENTERO mientras el drenador escribiría `proxima_at` en cada
-- tick — la carrera que la 0161 documentó. Una corrida es de quien la corre.
-- =============================================================================

create table if not exists flujo_corridas (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- El id de la plantilla cuyo flujo está corriendo. Sin FK: el catálogo vive en
  -- código, igual que en `avisos_programados`.
  aviso_id      text not null,
  -- En qué paso va. Es lo único que avanza, y avanza con compare-and-set.
  paso          int not null default 0,
  -- `pendiente` = hay que seguirla · `hecha` = llegó al final · `cortada` = el flujo
  -- cambió debajo o el mensaje se apagó. Se distinguen a propósito: «terminó» y «la
  -- cortamos» son dos hechos, y mezclarlos hace que no se pueda auditar por qué una
  -- corrida no mandó lo que prometía.
  estado        text not null default 'pendiente' check (estado in ('pendiente','hecha','cortada')),
  -- Cuándo despertarla. NULL = seguir en el próximo tick (no está durmiendo).
  proxima_at    timestamptz,
  -- Cuándo se durmió. La espera se mide contra ESTO y no contra `created_at`: un
  -- `esperar` que ya venció tiene que SALTARSE, no volver a dormirse — si no, el
  -- drenador la despierta y la vuelve a acostar para siempre.
  desde_at      timestamptz not null default now(),
  -- ⚠️ LA SEÑAL DEL CONDICIONAL. Se estampa cuando alguien acusa recibo en el grupo
  -- de MaKo, que es la MISMA señal que corta las insistencias y la única respuesta
  -- que este motor puede observar: sus mensajes salen al grupo del dueño, y lo que
  -- va al lead sale por la cola de confirmación. Por eso la tarjeta dice «si alguien
  -- contestó en el grupo» y no «si responde el lead».
  respondio_at  timestamptz,
  -- El contexto del evento que arrancó la corrida, congelado: el lead, su nombre, la
  -- reunión. Si se releyera al despertar, un delay de tres días resolvería contra un
  -- lead que ya cambió de etapa y el mensaje hablaría de otra cosa.
  ctx           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- El drenador pregunta siempre lo mismo: qué hay pendiente y vencido.
create index if not exists flujo_corridas_pendientes
  on flujo_corridas (estado, proxima_at)
  where estado = 'pendiente';

-- Y el webhook, al estampar la respuesta, pregunta por workspace.
create index if not exists flujo_corridas_ws_abiertas
  on flujo_corridas (workspace_id)
  where estado = 'pendiente';

alter table flujo_corridas enable row level security;
revoke all on flujo_corridas from anon, authenticated;
revoke all on sequence flujo_corridas_id_seq from anon, authenticated;
