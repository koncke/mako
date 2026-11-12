// Los DISEÑOS copiados de cada referencia (11/11/2026): una página entera por landing, con la barra, las secciones, la
// tipografía y los espacios de la página del competidor, y de MaKo sólo el logo, los colores de marca, el botón de la
// llamada, el caso de Mauricio y los links del pie (./../marca.tsx). Cada uno vive en ./<slug>.tsx y dibuja TODOS los bloques
// de su landing (app/vsl/_competencia/<slug>.ts) en su orden: los textos y lo que se afirma siguen saliendo de ahí.
// Una landing sin diseño acá se dibuja con la cara común de /vsl (LandingCompetencia.tsx).
import type { ComponentType } from 'react';
import type { LandingCompetencia } from '../tipos';
import DisenoAiAvatar from './ai-avatar';
import DisenoSeguimiento from './seguimiento';
import DisenoWhatsapp from './whatsapp';
import DisenoCrm from './crm';
import DisenoDashboard from './dashboard';
import DisenoVideo from './video';
import DisenoCompetitorSpy from './competitor-spy';
import DisenoAds from './ads';
import DisenoImage from './image';
import DisenoCopywriting from './copywriting';
import DisenoWebGenerator from './web-generator';
import DisenoOffer from './offer';
import DisenoMako from './mako';
import DisenoPrioridades from './prioridades';
import DisenoScript from './script';
import DisenoFunnel from './funnel';
import DisenoEmail from './email';
import DisenoCobranza from './cobranza';
import DisenoAgenda from './agenda';

export type PropsDiseno = { landing: LandingCompetencia };

export const DISENOS: Record<string, ComponentType<PropsDiseno>> = {
  'ai-avatar': DisenoAiAvatar,
  'seguimiento': DisenoSeguimiento,
  'whatsapp': DisenoWhatsapp,
  'crm': DisenoCrm,
  'dashboard': DisenoDashboard,
  'video': DisenoVideo,
  'competitor-spy': DisenoCompetitorSpy,
  'ads': DisenoAds,
  'image': DisenoImage,
  'copywriting': DisenoCopywriting,
  'web-generator': DisenoWebGenerator,
  'offer': DisenoOffer,
  'mako': DisenoMako,
  'prioridades': DisenoPrioridades,
  'script': DisenoScript,
  'funnel': DisenoFunnel,
  'email': DisenoEmail,
  'cobranza': DisenoCobranza,
  'agenda': DisenoAgenda,
};
