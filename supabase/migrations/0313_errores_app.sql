-- =============================================================================
-- 0313 — Los errores de la app llegan solos: agrupados por HUELLA, y cada uno nuevo es un ticket de bug
-- =============================================================================
-- Pedido de Martín (17/10/2026, 09:36, vía el Cerebro): «lo mismo que corrés en MaKo en WhatsApp detectando errores,
-- córrelo en toda la app: MaKo en los chats de la app, errores al navegar o lo que sea. Y todo lo solucionas
-- automáticamente». Hasta acá app/error.tsx mostraba «Esta pantalla se rompió al dibujarse» y no le avisaba a nadie: el
-- crash de /general en el teléfono de Martín se supo por su captura. El diseño: docs/diseno-ticketera-usuarios.md §8.
--
-- ⚠️ UNA FILA POR HUELLA, NO POR VEZ: mil personas con el mismo error son UN ticket (como los «issues» de Sentry). La
-- huella sale del tipo de error, el mensaje sin números ni textos citados, y la pantalla sin ids (lib/errores-app-reglas.ts).
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Crea una tabla que el código nuevo YA LEE y amplía un CHECK que el código
-- nuevo YA ESCRIBE (`canal = 'sistema'`). Sin ella, /api/errores contesta y no registra nada: no se cae ninguna pantalla.
-- ⚠️ DE LA PLATAFORMA: sin workspace_id (un error es de MaKo, no de un negocio), RLS sin políticas y el revoke. Quiénes
-- lo vieron van en `afectados` (hasta 20), para avisarles cuando esté arreglado.

begin;

-- Un ticket que levanta el SISTEMA (un error que la app vio), además de los que levanta una persona.
alter table tickets drop constraint if exists tickets_canal_check;
alter table tickets add constraint tickets_canal_check
  check (canal in ('chat_app', 'chat_movil', 'whatsapp', 'formulario', 'api', 'sistema'));

create table if not exists errores_app (
  id           bigint generated always as identity primary key,
  huella       text not null unique check (huella ~ '^[0-9a-f]{16}$'),
  origen       text not null check (origen in ('navegador', 'servidor', 'mako')),
  titulo       text not null check (char_length(titulo) between 1 and 200),
  -- La última vez que pasó, saneada (sin emails ni números largos): el mensaje, el tipo, el stack, la pantalla, el navegador.
  ejemplo      jsonb not null default '{}'::jsonb,
  veces        integer not null default 1 check (veces >= 1),
  primera_vez  timestamptz not null default now(),
  ultima_vez   timestamptz not null default now(),
  -- Quiénes lo vieron: [{ "ws": 3, "email": "…" }], hasta 20. Se les avisa cuando el arreglo llega a producción.
  afectados    jsonb not null default '[]'::jsonb,
  -- Quién lo vio primero: con esto se topea cuántos errores NUEVOS puede abrir una persona por día.
  primer_email text,
  ticket_id    bigint references tickets(id) on delete set null
);

comment on table errores_app is 'Los errores de la app agrupados por huella (mig 0313): cada huella nueva es un ticket de bug del sistema. lib/errores-app.ts.';
comment on column errores_app.huella is 'Tipo + mensaje sin números ni citas + pantalla sin ids, resumido a 16 hex (lib/errores-app-reglas.ts, huellaDe).';

create index if not exists errores_app_primer_email_idx on errores_app (primer_email, primera_vez desc);
create index if not exists errores_app_ticket_idx on errores_app (ticket_id) where ticket_id is not null;

alter table errores_app enable row level security;
revoke all on errores_app from anon, authenticated;

commit;
