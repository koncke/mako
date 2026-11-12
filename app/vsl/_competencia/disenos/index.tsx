// Los DISEÑOS copiados de cada referencia (11/11/2026): una página entera por landing, con la barra, las secciones, la
// tipografía y los espacios de la página del competidor, y de MaKo sólo el logo, los colores de marca, el botón de la
// llamada, el caso de Mauricio y los links del pie (./../marca.tsx). Cada uno vive en ./<slug>.tsx y dibuja TODOS los bloques
// de su landing (app/vsl/_competencia/<slug>.ts) en su orden: los textos y lo que se afirma siguen saliendo de ahí.
// Una landing sin diseño acá se dibuja con la cara común de /vsl (LandingCompetencia.tsx).
import type { ComponentType } from 'react';
import type { LandingCompetencia } from '../tipos';

export type PropsDiseno = { landing: LandingCompetencia };

export const DISENOS: Record<string, ComponentType<PropsDiseno>> = {};
