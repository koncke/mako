// Los visuales PROPIOS de la portada de las landings que copian a un competidor: uno por función que no tenía un gráfico
// de portada en /vsl (app/vsl/_detalle/feature-visuals.ts). Cada uno vive en ./<id>.tsx, es un server component sin
// JavaScript, trae su propio <style> con clases `mk-v-<id>-…` y no dibuja fotos ni caras de nadie.
// Un visual nuevo se suma acá con el MISMO id que usa su landing en `visual: { tipo: 'propio', slug }`.
import type { ComponentType } from 'react';
import VisualVideo from './video';
import VisualCompetitorSpy from './competitor-spy';
import VisualCopiloto from './ads';
import VisualImage from './image';
import VisualCopywriting from './copywriting';
import VisualWebGenerator from './web-generator';
import VisualOffer from './offer';
import VisualAgenda from './agenda';

export const VISUALES_PROPIOS: Record<string, ComponentType> = {
  video: VisualVideo,
  'competitor-spy': VisualCompetitorSpy,
  ads: VisualCopiloto,
  image: VisualImage,
  copywriting: VisualCopywriting,
  'web-generator': VisualWebGenerator,
  offer: VisualOffer,
  agenda: VisualAgenda,
};
