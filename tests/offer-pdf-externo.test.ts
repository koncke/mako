// =============================================================================
// Offer: el PDF de la oferta para mandarle a un prospecto (17/10/2026)
// =============================================================================
// docs/relevo/offer.md: «el PDF externo (sin diagnóstico ni "[completar]", para un prospecto)», sin hacer desde el 12/10.
// El PDF de siempre es del DUEÑO (el diagnóstico, los números, lo que propuso MaKo, los datos a completar). Éste es la
// MISMA propuesta con sólo lo que lee su cliente, y sin un solo hueco. Se lee el PDF de vuelta con unpdf.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): sin sacar los renglones con «[completar]» → 1 / 2; con «Números» adentro → 1 / 2;
// con «Cómo decirlo en la llamada» → 2 / 1; la ruta sin `tipo=externo` → 2 / 1. Base: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nombreArchivoOfertaExterna, pdfExternoDeOferta, seccionesExternas } from '../lib/offer-pdf';
import { MARCA_COMPLETAR, type ConclusionOferta } from '../lib/offer-marco';

async function leerPdf(bytes: Uint8Array): Promise<string> {
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
  return String(text).replace(/\s+/g, ' ');
}

function ejemplo(): ConclusionOferta {
  const c: unknown = {
    version: 3, at: '2026-10-17T12:00:00.000Z', modelo: 'x',
    calculo: { total: 58, cuello: 'D3', lista: false, alertas: [] },
    diagnostico: { tesis: 'La promesa es clara pero falta el método.', fuerte: 'Ya hay 12 clientes.', dimensiones: [], cambios: [] },
    propuesta: {
      nombre: 'Reto Plato Fuerte — 90 días',
      frase: 'Ayudo a mamás que trabajan a bajar 6 kg en 90 días sin dietas de hambre.',
      mensajes: { corto: 'GUION CORTO INTERNO', largo: 'x', entrada: 'y' },
      paraQuien: { perfil: 'Mamás de 30 a 45 años que trabajan.', minimo: 'Pueden invertir en su salud.', noEs: 'Quien busca una pastilla mágica.' },
      problema: { hoy: 'Prueba dietas y rebota.', despues: 'Come rico y baja de peso.', obstaculos: ['Falta de tiempo'], yaProbo: 'Dietas de moda.' },
      mecanismo: { nombres: ['Plato en 3 pasos (propuesta)', 'Método Rebote Cero (propuesta)'], pasos: ['Ordenar el plato', 'Plan de antojos'], distinto: 'No prohíbe comidas.' },
      ruta: [{ fase: 'Semana 1', objetivo: 'Ordenar el plato', hito: 'Primer kilo menos' }],
      incluye: [{ nombre: 'Guía del plato', beneficio: 'Saber qué comer' }],
      formato: 'Grupal, 12 semanas.',
      prueba: `${MARCA_COMPLETAR} Casos con números.`,
      garantia: { nombre: 'Garantía Plato Lleno', condiciones: 'Si asistes al 80%…', plazo: '90 días', siNoCumple: 'Seguimos gratis.' },
      bonos: [{ nombre: 'Recetario rápido', objecion: 'OBJECION INTERNA', valor: MARCA_COMPLETAR }],
      inversion: { valorTotal: '3.600 USD', precio: '1.200 USD en 3 pagos', contado: '1.000 USD', plan: '3 pagos de 400 USD', comoDecirlo: 'GUION DEL PRECIO' },
      urgencia: `${MARCA_COMPLETAR} Define una fecha.`,
      escenarios: { mejor: 'ESCENARIO', peor: 'x' },
      ecuacion: [{ variable: 'tiempo', antes: '6 meses', despues: '90 días' }],
      numeros: ['LTV:CAC estimado (estimado por MaKo)'],
      validar: ['VALIDAR INTERNO'],
      siguiente: 'ESCALON INTERNO',
      completar: ['Casos con números'],
      propuestoPorMako: [{ seccion: 'Precio', que: 'PROPUESTO INTERNO' }],
    },
  };
  return c as ConclusionOferta;
}

test('el PDF para el prospecto lleva la oferta y nada de lo interno ni un solo «[completar]»', async () => {
  const t = await leerPdf(pdfExternoDeOferta(ejemplo(), { negocio: 'Nutrición Ñandú', titulo: 'Mi oferta', fecha: new Date('2026-10-17T15:00:00Z') }));
  for (const si of ['Reto Plato Fuerte', 'Mamás de 30 a 45', 'Plato en 3 pasos', 'Garantía Plato Lleno', '1.200 USD en 3 pagos', 'Recetario rápido', 'Guía del plato']) {
    assert.ok(t.includes(si), `falta «${si}»`);
  }
  for (const no of ['[completar]', 'Tu oferta hoy', 'La promesa es clara', 'GUION CORTO INTERNO', 'GUION DEL PRECIO', 'OBJECION INTERNA', 'ESCENARIO', 'LTV:CAC', 'VALIDAR INTERNO', 'ESCALON INTERNO', 'PROPUESTO INTERNO', '(propuesta)', 'Lo que propuso MaKo', 'Generado por MaKo']) {
    assert.ok(!t.includes(no), `se coló «${no}»`);
  }
});

test('las secciones: sin las internas, sin los renglones con hueco, y una sección que queda vacía no sale', () => {
  const s = seccionesExternas(ejemplo().propuesta);
  const titulos = s.map(([t]) => t);
  for (const fuera of ['Mensajes', 'Números', 'Cómo validarla', 'Siguiente escalón', 'Ecuación de valor', 'Mejor y peor escenario', 'Prueba', 'Urgencia']) {
    assert.ok(!titulos.includes(fuera), fuera);
  }
  assert.ok(titulos.includes('Garantía') && titulos.includes('Inversión'));
  assert.equal(nombreArchivoOfertaExterna('Reto Plato Fuerte'), 'oferta-reto-plato-fuerte.pdf');
});

test('la ruta y la pantalla: `tipo=externo` y el botón «PDF para tu cliente»', () => {
  const ruta = readFileSync(join(__dirname, '..', 'app/api/offer/pdf/route.ts'), 'utf8');
  assert.match(ruta, /const externo = req\.nextUrl\.searchParams\.get\('tipo'\) === 'externo';/);
  assert.match(ruta, /externo \? pdfExternoDeOferta\(conclusion, meta\) : pdfDeOferta\(conclusion, meta\)/);
  const ui = readFileSync(join(__dirname, '..', 'app/offer/Conclusion.tsx'), 'utf8');
  assert.match(ui, /descargarPdf\(sesion\.id, null, \{ externo: true \}\)/);
  assert.match(ui, />\s*PDF para tu cliente\s*</);
});
