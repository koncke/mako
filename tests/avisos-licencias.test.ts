// =============================================================================
// Los avisos de licencia de lo que MaKo toma de código abierto (lib/avisos/, 29/10/2026)
// =============================================================================
// Las plantillas reales de Create toman el método de expertos con licencia MIT (docs/plantillas-reales/README.md, sección
// 5), y la MIT pide conservar el aviso. Una copia literal por repo en lib/avisos/ (LEEME.md). Esto cuida que cada archivo
// SEA la licencia (no una página de error guardada por una descarga que dio 404 o 403) y con el copyright de la tabla,
// que la tabla del LEEME no se desfase de la carpeta, y que lo que nombra un aviso exista.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const AVISOS = join(RAIZ, 'lib/avisos');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

/** El copyright de cada aviso, como figura en la tabla de licencias del plan (leída el 29/10/2026). */
const COPYRIGHT: Readonly<Record<string, string>> = {
  'LICENSE-MARKETINGSKILLS': 'Copyright (c) 2025 Corey Haines',
  'LICENSE-PROFOUND': 'Copyright (c) 2026 Profound',
  'LICENSE-CLAUDE-YOUTUBE': 'Copyright (c) 2025 Daniel Agrici',
  'LICENSE-CRAIGHEWITT-SKILLS': 'Copyright (c) 2026 Craig Hewitt',
  'LICENSE-VIDEO-USE': 'Copyright (c) 2026 Browser Use',
  'LICENSE-CLAUDE-SHORTS': 'Copyright (c) 2026 Daniel Agrici',
  'LICENSE-DIFFUSIONSTUDIO-LOTTIE': 'Copyright (c) 2026 Diffusion Studio Inc.',
  'LICENSE-VIDEO-THUMBNAIL-SKILL': 'Copyright (c) 2026 aabrole',
  'LICENSE-SOCIAL-MEDIA-SKILLS': 'Copyright (c) 2026 Charlie Hills',
  'LICENSE-INSTAGRAM-CAROUSEL-SKILL': 'Copyright (c) 2026 Jeevan Bavandla',
  'LICENSE-MOTION-SKILLS': 'Copyright (c) 2025 Motion',
  // Los trazos de los íconos de Material que usa Admin (app/admin/_polar/orbit/icons/material.tsx).
  'LICENSE-MUI-ICONS': 'Copyright (c) 2014 Call-Em-All',
  // El código de Admin (6/11/2026): polarsource/polar, portado en app/admin/_polar y app/admin/(polar). Es Apache-2.0, no MIT.
  'LICENSE-POLAR': 'Copyright 2023 Polar Software Inc',
};

/** Las que no son MIT, y su texto (el de la Apache-2.0 entera). */
const APACHE = new Set(['LICENSE-POLAR']);

const archivos = () => readdirSync(AVISOS).filter((f) => f.startsWith('LICENSE-')).sort();

test('cada aviso es su licencia entera (MIT o Apache-2.0), con el copyright de su repo', () => {
  assert.deepEqual(archivos(), Object.keys(COPYRIGHT).sort(), 'la carpeta y la lista no coinciden: un aviso nuevo va con su copyright acá');
  for (const f of archivos()) {
    const t = leer(`lib/avisos/${f}`);
    assert.ok(t.split('\n').some((l) => l.trim() === COPYRIGHT[f]), `${f}: no tiene «${COPYRIGHT[f]}»`);
    assert.doesNotMatch(t, /<html|<!DOCTYPE|404: Not Found/i, `${f}: se guardó una página de error`);
    if (APACHE.has(f)) {
      assert.match(t, /Apache License\s+Version 2\.0, January 2004/, `${f}: no es el texto de la Apache-2.0`);
      assert.match(t, /4\. Redistribution\./, `${f}: le falta la condición de redistribución`);
      assert.match(t, /END OF TERMS AND CONDITIONS/, `${f}: está cortado`);
      continue;
    }
    assert.match(t, /Permission is hereby granted, free of charge, to any person obtaining a copy/, `${f}: no es el texto de la MIT`);
    assert.match(t, /The above copyright notice and this permission notice shall be included in all\s+copies or substantial portions of the Software\./, `${f}: le falta la condición de la MIT`);
    assert.match(t, /WITHOUT WARRANTY OF ANY KIND/, `${f}: está cortado`);
    assert.doesNotMatch(t, /<html|<!DOCTYPE|404: Not Found/i, `${f}: se guardó una página de error`);
  }
});

test('la tabla del LEEME nombra cada aviso, y nada que no esté en la carpeta', () => {
  const leeme = leer('lib/avisos/LEEME.md');
  const nombrados = [...new Set([...leeme.matchAll(/`(LICENSE-[A-Z0-9-]+)`/g)].map((m) => m[1]))].sort();
  assert.deepEqual(nombrados, archivos());
});

test('el código que nombra un aviso de lib/avisos/ lo encuentra', () => {
  // Una cabecera que cita `lib/avisos/LICENSE-X` sin el archivo es un aviso que no está.
  const fuentes = (dir: string): string[] => readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((d) => {
    const r = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === 'node_modules' || d.name.startsWith('.') ? [] : fuentes(r);
    return /\.(ts|tsx)$/.test(d.name) ? [r] : [];
  });
  for (const r of [...fuentes('lib'), ...fuentes('app')]) {
    for (const m of leer(r).matchAll(/lib\/avisos\/(LICENSE-[A-Z0-9-]+)/g)) {
      assert.ok(existsSync(join(AVISOS, m[1])), `${r} nombra lib/avisos/${m[1]}, que no existe`);
    }
  }
});
