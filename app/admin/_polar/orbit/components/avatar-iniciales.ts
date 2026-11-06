// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/orbit/src/components/Avatar.tsx (`getInitials`). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo (6/11/2026): Polar saca las iniciales con `replace(/[^a-zA-Z ]/g, ' ')`, que tira toda letra con tilde: «Ana Gómez» daba
// «AM» (la «G» y la «ó» se iban y «mez» quedaba como otra palabra) y «Óptica Visión Clara», «PC». La regla de la casa
// (AGENTS.md: una inicial sale de `iniciales`, lib/unicode-seguro.ts) toma la primera LETRA de cada palabra, con tilde o sin
// ella, y saltea un emoji. De Polar queda lo que sí es suyo: si le pasan un email, se mira lo de antes de la «@», y los
// separadores de un email (punto, guion, guion bajo, «+») parten palabras como lo hacía su regex. Módulo puro, sin React, para
// que un test lo ejecute.

import { iniciales } from '@/lib/unicode-seguro'

export const getInitials = (fullName: string): string =>
  iniciales(String(fullName ?? '').split('@')[0].replace(/[._+-]+/g, ' '), 2, '')
