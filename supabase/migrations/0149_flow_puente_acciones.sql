-- =============================================================================
-- 0149 · Qué acciones de reCAPTCHA usa Flow de verdad
-- =============================================================================
-- El espejo de la extensión ya mide con qué nombre de acción la propia página de
-- Flow acuña sus tokens. Ese dato vivía solo en la consola del service worker, o
-- sea que para leerlo había que pedirle a una persona que abriera DevTools y
-- copiara una línea — y cuando el navegador es de otro, ni eso.
--
-- Mismo criterio que la columna `version` (mig 0148): un dato de diagnóstico que
-- hay que pedirle a alguien no es un dato, es una molestia. Viaja en el latido.
alter table public.flow_puentes
  add column if not exists acciones_captcha text not null default '';

comment on column public.flow_puentes.acciones_captcha is
  'Nombres de acción con los que la página de Flow acuñó tokens de reCAPTCHA, separados por coma. Es la medición que dice si la acción que nosotros usamos es la correcta.';
