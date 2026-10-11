// =============================================================================
// El registro de cada área, en un solo lugar
// =============================================================================
// La ruta es dinámica (`/admin/dev/[area]`), así que los datos no se pueden
// importar por variable: el bundler necesita ver los imports. Este archivo es
// esa tabla, y es lo único que hay que tocar para sumar un área — la pantalla
// ya está escrita.

import type { Registro } from './_registro/tipos';
import { PARTES as ADMIN_PARTES, BITACORA as ADMIN_BITACORA } from './admin/bitacora';
import { PARTES as ONBOARDING_PARTES, BITACORA as ONBOARDING_BITACORA } from './onboarding/bitacora';
import { PARTES as GENERAL_PARTES, BITACORA as GENERAL_BITACORA } from './general/bitacora';
import { PARTES as CHATBOT_PARTES, BITACORA as CHATBOT_BITACORA } from './chatbot/bitacora';
import { PARTES as ADS_PARTES, BITACORA as ADS_BITACORA } from './ads-writer/bitacora';
import { PARTES as SEMAFORO_PARTES, BITACORA as SEMAFORO_BITACORA } from './semaforo/bitacora';
import { PARTES as PRICING_PARTES, BITACORA as PRICING_BITACORA } from './pricing/bitacora';
import { PARTES as PRODUCTOS_PARTES, BITACORA as PRODUCTOS_BITACORA } from './products-offers/bitacora';
import { PARTES as CS_PARTES, BITACORA as CS_BITACORA } from './customer-success/bitacora';
import { PARTES as VSLTRACK_PARTES, BITACORA as VSLTRACK_BITACORA } from './vsl-tracking/bitacora';
import { PARTES as AISPEND_PARTES, BITACORA as AISPEND_BITACORA } from './ai-spend-cuotas/bitacora';
import { PARTES as SB_PARTES, BITACORA as SB_BITACORA } from './second-brain/bitacora';
import { PARTES as BUILD_PARTES, BITACORA as BUILD_BITACORA } from './build-deploy/bitacora';
import { PARTES as DS_PARTES, BITACORA as DS_BITACORA } from './design-system/bitacora';
import { PARTES as MAKOUI_PARTES, BITACORA as MAKOUI_BITACORA } from './mako-ux-ui/bitacora';
import { PARTES as LOCALDEV_PARTES, BITACORA as LOCALDEV_BITACORA } from './local-dev-environment/bitacora';
import { PARTES as TESTSQA_PARTES, BITACORA as TESTSQA_BITACORA } from './tests-qa/bitacora';
import { PARTES as BYOK_PARTES, BITACORA as BYOK_BITACORA } from './credentials-vault-byok/bitacora';
import { PARTES as VSLGEN_PARTES, BITACORA as VSLGEN_BITACORA } from './vsl-generator/bitacora';
import { PARTES as LANDINGGEN_PARTES, BITACORA as LANDINGGEN_BITACORA } from './landing-generator/bitacora';
import { PARTES as STORIES_PARTES, BITACORA as STORIES_BITACORA } from './stories/bitacora';
import { PARTES as THUMBS_PARTES, BITACORA as THUMBS_BITACORA } from './thumbnails/bitacora';
import { PARTES as LEADMAG_PARTES, BITACORA as LEADMAG_BITACORA } from './lead-magnet-generator/bitacora';
import { PARTES as SALESMAIL_PARTES, BITACORA as SALESMAIL_BITACORA } from './sales-email/bitacora';
import { PARTES as NEWSLETTER_PARTES, BITACORA as NEWSLETTER_BITACORA } from './newsletters/bitacora';
import { PARTES as CLOSINGSC_PARTES, BITACORA as CLOSINGSC_BITACORA } from './closing-script/bitacora';
import { PARTES as YTWRITER_PARTES, BITACORA as YTWRITER_BITACORA } from './youtube-writer/bitacora';
import { PARTES as AIRUNTIMECASCA_PARTES, BITACORA as AIRUNTIMECASCA_BITACORA } from './ai-runtime-cascada/bitacora';
import { PARTES as CAROUSELS_PARTES, BITACORA as CAROUSELS_BITACORA } from './carousels/bitacora';
import { PARTES as CONOCIMIENTOS_PARTES, BITACORA as CONOCIMIENTOS_BITACORA } from './conocimientos/bitacora';
import { PARTES as CRM_PARTES, BITACORA as CRM_BITACORA } from './crm/bitacora';
import { AUDITORIA as CRM_AUDITORIA } from './crm/auditoria';
import { PARTES as GTMOFERTAYPREC_PARTES, BITACORA as GTMOFERTAYPREC_BITACORA } from './gtm-oferta-y-precios/bitacora';
import { PARTES as INSTAGRAM_PARTES, BITACORA as INSTAGRAM_BITACORA } from './instagram/bitacora';
import { PARTES as INTEGRACIONES_PARTES, BITACORA as INTEGRACIONES_BITACORA } from './integraciones/bitacora';
import { PARTES as MAKODOER_PARTES, BITACORA as MAKODOER_BITACORA } from './mako-doer/bitacora';
import { PARTES as PLANSENTITLEME_PARTES, BITACORA as PLANSENTITLEME_BITACORA } from './plans-entitlements/bitacora';
import { PARTES as PAYGW_PARTES, BITACORA as PAYGW_BITACORA } from './payment-gateway/bitacora';
import { PARTES as RATELIMITING_PARTES, BITACORA as RATELIMITING_BITACORA } from './rate-limiting/bitacora';
import { PARTES as REELS_PARTES, BITACORA as REELS_BITACORA } from './reels/bitacora';
import { PARTES as SELFHEALINGDEV_PARTES, BITACORA as SELFHEALINGDEV_BITACORA } from './self-healing-dev-agent/bitacora';
import { PARTES as METAPLATFORM_PARTES, BITACORA as METAPLATFORM_BITACORA } from './meta-platform/bitacora';
import { PARTES as CONFIGURACIONES_PARTES, BITACORA as CONFIGURACIONES_BITACORA } from './configuraciones/bitacora';
import { PARTES as PLAN_PARTES, BITACORA as PLAN_BITACORA } from './plan/bitacora';
import { PARTES as ADSMANAGER_PARTES, BITACORA as ADSMANAGER_BITACORA } from './ads-manager/bitacora';
import { PARTES as WAMAKO_PARTES, BITACORA as WAMAKO_BITACORA } from './whatsapp-de-mako/bitacora';
import { PARTES as WEBHOOKS_PARTES, BITACORA as WEBHOOKS_BITACORA } from './webhook-gateway/bitacora';
import { PARTES as APIMAKO_PARTES, BITACORA as APIMAKO_BITACORA } from './api-mako/bitacora';
import { PARTES as DASHBOARD_PARTES, BITACORA as DASHBOARD_BITACORA } from './dashboard/bitacora';
import { PARTES as MOBILE_PARTES, BITACORA as MOBILE_BITACORA } from './mako-mobile/bitacora';

const REGISTROS: Record<string, Registro> = {
  admin: { partes: ADMIN_PARTES, bitacora: ADMIN_BITACORA },
  configuraciones: { partes: CONFIGURACIONES_PARTES, bitacora: CONFIGURACIONES_BITACORA },
  onboarding: { partes: ONBOARDING_PARTES, bitacora: ONBOARDING_BITACORA },
  general: { partes: GENERAL_PARTES, bitacora: GENERAL_BITACORA },
  dashboard: { partes: DASHBOARD_PARTES, bitacora: DASHBOARD_BITACORA },
  chatbot: { partes: CHATBOT_PARTES, bitacora: CHATBOT_BITACORA },
  'ads-writer': { partes: ADS_PARTES, bitacora: ADS_BITACORA },
  'ads-manager': { partes: ADSMANAGER_PARTES, bitacora: ADSMANAGER_BITACORA },
  semaforo: { partes: SEMAFORO_PARTES, bitacora: SEMAFORO_BITACORA },
  pricing: { partes: PRICING_PARTES, bitacora: PRICING_BITACORA },
  'products-offers': { partes: PRODUCTOS_PARTES, bitacora: PRODUCTOS_BITACORA },
  'customer-success': { partes: CS_PARTES, bitacora: CS_BITACORA },
  'build-deploy': { partes: BUILD_PARTES, bitacora: BUILD_BITACORA },
  'local-dev-environment': { partes: LOCALDEV_PARTES, bitacora: LOCALDEV_BITACORA },
  'tests-qa': { partes: TESTSQA_PARTES, bitacora: TESTSQA_BITACORA },
  'second-brain': { partes: SB_PARTES, bitacora: SB_BITACORA },
  'ai-spend-cuotas': { partes: AISPEND_PARTES, bitacora: AISPEND_BITACORA },
  'vsl-tracking': { partes: VSLTRACK_PARTES, bitacora: VSLTRACK_BITACORA },
  'design-system': { partes: DS_PARTES, bitacora: DS_BITACORA },
  'mako-ux-ui': { partes: MAKOUI_PARTES, bitacora: MAKOUI_BITACORA },
  'mako-mobile': { partes: MOBILE_PARTES, bitacora: MOBILE_BITACORA },
  'credentials-vault-byok': { partes: BYOK_PARTES, bitacora: BYOK_BITACORA },
  'vsl-generator': { partes: VSLGEN_PARTES, bitacora: VSLGEN_BITACORA },
  'landing-generator': { partes: LANDINGGEN_PARTES, bitacora: LANDINGGEN_BITACORA },
  stories: { partes: STORIES_PARTES, bitacora: STORIES_BITACORA },
  thumbnails: { partes: THUMBS_PARTES, bitacora: THUMBS_BITACORA },
  'closing-script': { partes: CLOSINGSC_PARTES, bitacora: CLOSINGSC_BITACORA },
  'youtube-writer': { partes: YTWRITER_PARTES, bitacora: YTWRITER_BITACORA },
  'lead-magnet-generator': { partes: LEADMAG_PARTES, bitacora: LEADMAG_BITACORA },
  'sales-email': { partes: SALESMAIL_PARTES, bitacora: SALESMAIL_BITACORA },
  newsletters: { partes: NEWSLETTER_PARTES, bitacora: NEWSLETTER_BITACORA },
  'ai-runtime-cascada': { partes: AIRUNTIMECASCA_PARTES, bitacora: AIRUNTIMECASCA_BITACORA },
  'carousels': { partes: CAROUSELS_PARTES, bitacora: CAROUSELS_BITACORA },
  'conocimientos': { partes: CONOCIMIENTOS_PARTES, bitacora: CONOCIMIENTOS_BITACORA },
  'crm': { partes: CRM_PARTES, bitacora: CRM_BITACORA, auditoria: CRM_AUDITORIA },
  'gtm-oferta-y-precios': { partes: GTMOFERTAYPREC_PARTES, bitacora: GTMOFERTAYPREC_BITACORA },
  'instagram': { partes: INSTAGRAM_PARTES, bitacora: INSTAGRAM_BITACORA },
  'integraciones': { partes: INTEGRACIONES_PARTES, bitacora: INTEGRACIONES_BITACORA },
  'mako-doer': { partes: MAKODOER_PARTES, bitacora: MAKODOER_BITACORA },
  'plans-entitlements': { partes: PLANSENTITLEME_PARTES, bitacora: PLANSENTITLEME_BITACORA },
  'payment-gateway': { partes: PAYGW_PARTES, bitacora: PAYGW_BITACORA },
  'rate-limiting': { partes: RATELIMITING_PARTES, bitacora: RATELIMITING_BITACORA },
  'reels': { partes: REELS_PARTES, bitacora: REELS_BITACORA },
  'self-healing-dev-agent': { partes: SELFHEALINGDEV_PARTES, bitacora: SELFHEALINGDEV_BITACORA },
  'meta-platform': { partes: METAPLATFORM_PARTES, bitacora: METAPLATFORM_BITACORA },
  plan: { partes: PLAN_PARTES, bitacora: PLAN_BITACORA },
  'whatsapp-de-mako': { partes: WAMAKO_PARTES, bitacora: WAMAKO_BITACORA },
  'webhook-gateway': { partes: WEBHOOKS_PARTES, bitacora: WEBHOOKS_BITACORA },
  'api-mako': { partes: APIMAKO_PARTES, bitacora: APIMAKO_BITACORA },
};

/** Un área sin registro devuelve vacío: la pantalla muestra sus estados vacíos. */
export const registroDe = (slug: string): Registro => REGISTROS[slug] ?? { partes: [], bitacora: [] };

/**
 * Los slugs que tienen bitácora escrita a mano. Existe para que
 * `tests/dev-areas.test.ts` no mantenga su propia lista: la tenía, se quedó vieja
 * sola (`pricing` faltaba) y el test pasaba en verde igual.
 */
export const REGISTROS_SLUGS = Object.keys(REGISTROS);
