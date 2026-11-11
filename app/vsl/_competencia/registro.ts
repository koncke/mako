// Las landings de funcionalidad que copian la estructura de un competidor (11/11/2026), en un solo lugar: las leen sus
// page.tsx y tests/vsl-landings-competencia.test.ts. Una landing nueva se suma acá y en su app/vsl/<slug>/page.tsx.
import { LANDING_AI_AVATAR } from './ai-avatar';
import { LANDING_SEGUIMIENTO } from './seguimiento';
import { LANDING_WHATSAPP } from './whatsapp';
import { LANDING_CRM } from './crm';
import { LANDING_DASHBOARD } from './dashboard';
import type { LandingCompetencia } from './tipos';

export const LANDINGS_COMPETENCIA: readonly LandingCompetencia[] = [LANDING_AI_AVATAR, LANDING_SEGUIMIENTO, LANDING_WHATSAPP, LANDING_CRM, LANDING_DASHBOARD];
