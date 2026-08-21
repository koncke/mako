-- =============================================================================
-- 0139 — service_incidents.confirmado: «Meta lo dijo» vs «no pudimos preguntarle»
-- =============================================================================
-- EL CASO (2026-08-21). Un cliente recibió CUATRO WhatsApps de MaKo diciéndole
-- «⛔ Tu cuenta publicitaria está NO SE PUDO LEER EL ESTADO DE META. 🛑 Hace 3 h
-- 25 min que no corre un solo anuncio. 💸 Seguís sin recibir un solo lead.»
--
-- Su cuenta estaba ACTIVA, sin deuda y entregando. Lo único roto era que su
-- META_AD_ACCOUNT_ID se había guardado sin el prefijo `act_`, así que la Graph
-- API contestaba 400 y no se podía LEER el estado.
--
-- La tabla no tenía forma de decir la diferencia entre estas dos cosas:
--
--   · «Meta contestó y dijo: Saldo impago»      → un hecho. Hay que perseguir.
--   · «Meta no contestó / no supimos preguntar»  → una ignorancia. NO es un hecho.
--
-- Las dos entraban como `severidad: 'rojo'` y la alerta crítica —que persigue por
-- WhatsApp cada hora hasta que se resuelva— no podía distinguirlas. Es la regla
-- de AGENTS.md «"No puedo hacer X con este dato" no es "este dato es falso"»,
-- cobrada en la pantalla de un cliente real.
--
-- `confirmado` es esa distinción, como COLUMNA y no como una convención sobre el
-- texto de `status_label`: el guard que decide a quién se persigue tiene que
-- poder escribirse en POSITIVO («solo lo que Meta confirmó») y no adivinando si
-- una cadena de texto parece o no un estado de cuenta.
--
-- DEFAULT TRUE: todas las filas que ya existen salieron de una lectura real de
-- Meta salvo dos casos de error de lectura, que ya están cerrados. El default
-- deja el comportamiento de siempre para todo lo demás.
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

ALTER TABLE service_incidents
  ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN service_incidents.confirmado IS
  'TRUE = el servicio contestó y ESTE es su estado (un hecho). FALSE = no se pudo leer el estado (una ignorancia): se muestra en el historial, pero NUNCA dispara la alerta que persigue por WhatsApp. Ver lib/alerta-critica.ts → esCritico().';

COMMIT;
