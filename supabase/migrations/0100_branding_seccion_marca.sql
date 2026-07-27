-- =============================================================================
-- 0100 — "Branding MaKo": sección propia para el material de MARCA
-- =============================================================================
-- La 0098 dejó 4 secciones (gráficos, animaciones, íconos, videos), todas de
-- material DERIVADO. Faltaba la marca en sí: el logotipo, la insignia, las
-- letras y sus animaciones con fondo transparente.

begin;

alter table branding_assets drop constraint if exists branding_assets_seccion_check;
alter table branding_assets add constraint branding_assets_seccion_check
  check (seccion in ('marca', 'graficos', 'animaciones', 'iconos', 'videos'));

commit;

notify pgrst, 'reload schema';
