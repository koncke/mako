// Las landings de funcionalidad que copian la estructura de un competidor (11/11/2026), en un solo lugar: las leen sus
// page.tsx y tests/vsl-landings-competencia.test.ts. Una landing nueva se suma acá y en su app/vsl/<slug>/page.tsx.
import { LANDING_AI_AVATAR } from './ai-avatar';
import { LANDING_SEGUIMIENTO } from './seguimiento';
import { LANDING_WHATSAPP } from './whatsapp';
import { LANDING_CRM } from './crm';
import { LANDING_DASHBOARD } from './dashboard';
import { LANDING_VIDEO } from './video';
import { LANDING_COMPETITOR_SPY } from './competitor-spy';
import { LANDING_ADS } from './ads';
import { LANDING_IMAGE } from './image';
import { LANDING_COPYWRITING } from './copywriting';
import { LANDING_WEB_GENERATOR } from './web-generator';
import { LANDING_OFFER } from './offer';
import { LANDING_MAKO } from './mako';
import { LANDING_PRIORIDADES } from './prioridades';
import { LANDING_SCRIPT } from './script';
import { LANDING_FUNNEL } from './funnel';
import { LANDING_EMAIL } from './email';
import { LANDING_COBRANZA } from './cobranza';
import { LANDING_AGENDA } from './agenda';
import type { LandingCompetencia } from './tipos';

export const LANDINGS_COMPETENCIA: readonly LandingCompetencia[] = [LANDING_AI_AVATAR, LANDING_SEGUIMIENTO, LANDING_WHATSAPP, LANDING_CRM, LANDING_DASHBOARD, LANDING_VIDEO, LANDING_COMPETITOR_SPY, LANDING_ADS,
  LANDING_IMAGE, LANDING_COPYWRITING, LANDING_WEB_GENERATOR, LANDING_OFFER, LANDING_MAKO, LANDING_PRIORIDADES, LANDING_SCRIPT, LANDING_FUNNEL, LANDING_EMAIL, LANDING_COBRANZA, LANDING_AGENDA,
];
