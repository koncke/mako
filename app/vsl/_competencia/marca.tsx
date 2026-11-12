// =============================================================================
// Lo de MaKo que viaja a cada landing con DISEÑO COPIADO de su referencia (app/vsl/_competencia/disenos/<slug>.tsx)
// =============================================================================
// Martín (11/11/2026, al ver las 19 landings con la misma cara): «Vuelve a arrasarlo todo, copia de las referencias, copia
// la estructura, copia el diseño. Lo único que tal vez debe quedar un poco es sutilmente el tema de los colores, el tema del
// logo y cambios sutiles, pero no inventes, copia la estructura de las páginas».
//
// Cada diseño copia la página de su competidor (barra, hero, secciones, pie, tipografía, espacios) y de MaKo lleva SÓLO esto:
// el logo, el botón para empezar (`RUTA_CTA` + `TEXTO_CTA`), los colores de marca (azul y la estrella dorada), el caso de
// Mauricio como prueba y los links al resto de las funciones en el pie. Sin estilos: cada diseño los dibuja con el tratamiento
// de su referencia.
// =============================================================================

import { LANDINGS_COMPETENCIA } from './registro';

// El botón para empezar y la frase del cierre viven en ./cta.ts (sin imports del registro: los .ts de cada landing los usan).
export { RUTA_CTA, TEXTO_CTA, TEXTO_CIERRE } from './cta';

/** Los colores de marca de MaKo: el azul de los botones y la estrella dorada. Lo demás (fondos, grises, tipografía) es de la referencia. */
export const MAKO = { azul: '#2F6FED', azulOscuro: '#1F57C8', dorado: '#F2B01E', tinta: '#12151B' } as const;

const ESTRELLA = 'M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z';

/** La estrella de MaKo (el isotipo). */
export function EstrellaMaKo({ size = 20, color = MAKO.dorado }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill={color} /></svg>;
}

/**
 * El logo de MaKo: la estrella en su cuadro oscuro y la palabra. `className` lo posiciona; el tamaño y la letra los pone el
 * diseño (la palabra hereda la tipografía de la barra de la referencia).
 */
export function LogoMaKo({ className, tamano = 32, claro = false }: { className?: string; tamano?: number; claro?: boolean }) {
  return (
    <a href="/" className={className} aria-label="MaKo — volver a la landing" style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(tamano / 3.2), textDecoration: 'none', color: claro ? '#fff' : MAKO.tinta }}>
      <span style={{ width: tamano, height: tamano, borderRadius: Math.round(tamano * 0.28), background: claro ? 'rgba(255,255,255,.12)' : '#1A1712', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <EstrellaMaKo size={Math.round(tamano * 0.6)} />
      </span>
      <span style={{ fontWeight: 700, fontSize: Math.round(tamano * 0.68), letterSpacing: '-0.02em', lineHeight: 1 }}>MaKo</span>
    </a>
  );
}


/** La prueba de todas las landings: el caso de Mauricio, como DATOS (cada diseño lo dibuja con el tratamiento de testimonio de su referencia). */
export const CASO = {
  // ⚠️ El test busca «De meses por debajo de» en lo dibujado: el titular va tal cual.
  titulo: 'De meses por debajo de <span style="white-space:nowrap">$10k USD</span> a más de $70k USD en tres meses.',
  sub: 'Sin cambiar la oferta. Sin cambiar el funnel.',
  quien: 'Mauricio',
  rol: 'Más de 20 años de trayectoria y 30 mil seguidores',
  video: '/vsl-assets/mauricio.mp4',
  historia: [
    'Mauricio no era ningún novato. Más de 20 años de trayectoria, más de 30 mil seguidores y videos con <strong>millones de vistas</strong>.',
    'Pero vendía por impulsos: un mes bien, dos flojos, y nunca sabía por qué. Miraba Meta por un lado, Calendly por otro, y el resto lo cargaba a mano en un Excel.',
  ],
  resultado: 'De meses por debajo de los <strong>$10k</strong> a más de <strong>$70k en tres meses</strong>: 14k en abril, 20k en mayo, +40k en junio. La misma oferta. El mismo funnel. <strong>Lo único que cambió fue que empezó a decidir con datos.</strong>',
  meses: [{ mes: 'Abril', monto: '$14k' }, { mes: 'Mayo', monto: '$20k' }, { mes: 'Junio', monto: '+$40k' }],
} as const;

/** El resto de las landings de función, para el pie (el lugar donde la referencia lista sus productos). */
export function otrasFunciones(slug: string): { nombre: string; href: string }[] {
  return LANDINGS_COMPETENCIA.filter((l) => l.slug !== slug).map((l) => ({ nombre: l.nombre, href: `/vsl/${l.slug}` }));
}

/** Para los textos de la landing, que traen <strong> y <em>. */
export const html = (s: string) => ({ __html: s });
