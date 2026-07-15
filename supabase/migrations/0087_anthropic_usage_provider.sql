-- =============================================================================
-- 0087_anthropic_usage_provider — proveedor de IA en el registro de uso
-- =============================================================================
-- Ahora también gastamos en modelos baratos (Groq/OpenAI) y STT, no solo Claude.
-- Registramos TODO en la misma tabla para que el historial muestre en qué se gastó
-- cada centavo; `provider` distingue el gasto de Claude (que descuenta del saldo
-- prepago) del resto (que se ve pero no toca ese saldo).

begin;

alter table anthropic_usage
  add column if not exists provider text not null default 'anthropic';

create index if not exists ix_anthropic_usage_provider
  on anthropic_usage (provider, created_at desc);

comment on column anthropic_usage.provider is
  'anthropic | groq | openai … — quién cobró. Solo "anthropic" descuenta del saldo prepago de Claude.';

commit;

notify pgrst, 'reload schema';
