// =============================================================================
// carruseles/marca-kit — el estilo de un carrusel de MaKo con la marca del negocio (PURO; 5/11/2026)
// =============================================================================
// Leila (llamada del 30/10/2026): sus carruseles sólo tomaban el fondo de su marca. Con un kit (lib/marca/kits.ts), el tipo de
// carrusel conserva su estructura y su diseño, y toma de la marca lo que la marca dice:
//   · el ACENTO (la barra, el rótulo, la flecha, el círculo de la cabecera) es el acento de la marca, o su principal;
//   · el FONDO es el de la marca si lo dice; si no, el del tipo. La TINTA sigue al fondo: si no se lee, pasa a negro o blanco;
//   · el CIERRE (la última lámina) va con el principal de la marca, y su tinta con el contraste que haga falta;
//   · las FUENTES son las de la marca si el editor las tiene (`fuenteDelEditor`); si no, las del tipo.
// Lo que la marca no dice queda como en el tipo: no se inventa.
// =============================================================================

import type { EstiloCarrusel } from './tipos';
import type { Marca } from './documento';
import { colorDeRol, type KitMarca } from '../marca/kits';

/** La luminancia relativa de un #RRGGBB (WCAG). */
function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** El contraste entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** La tinta que se lee sobre `fondo`: la que se pide si alcanza 4,5:1; si no, negro o blanco (el que más contraste). */
export function tintaSobre(fondo: string, pedida?: string | null): string {
  if (pedida && contraste(pedida, fondo) >= 4.5) return pedida;
  return contraste('#111111', fondo) >= contraste('#FFFFFF', fondo) ? '#111111' : '#FFFFFF';
}

export function estiloConKit(e: EstiloCarrusel, kit: KitMarca | null, fuenteDelEditor?: (f: string) => string | null): EstiloCarrusel {
  if (!kit) return e;
  const principal = colorDeRol(kit, 'principal');
  const acento = colorDeRol(kit, 'acento') ?? principal ?? kit.colores.find((c) => !c.rol)?.hex ?? e.acento;
  const fondoMarca = colorDeRol(kit, 'fondo');
  const textoMarca = colorDeRol(kit, 'texto');
  const fondo = fondoMarca ?? e.fondo;
  const tinta = tintaSobre(fondo, textoMarca ?? (fondoMarca ? null : e.tinta));
  // La tinta suave del tipo se pensó para SU fondo: con otro fondo, la suave es la misma tinta.
  const suave = fondoMarca || textoMarca ? tinta : e.suave;
  const fondoCierre = principal && principal !== fondo ? principal : e.fondoCierre;
  const tintaCierre = tintaSobre(fondoCierre, fondoCierre === e.fondoCierre ? e.tintaCierre : null);
  const fam = (f: string | null, actual: EstiloCarrusel['titular']): EstiloCarrusel['titular'] => {
    const nombre = f ? (fuenteDelEditor ? fuenteDelEditor(f) : f) : null;
    return nombre ? { ...actual, familia: nombre } : actual;
  };
  return {
    ...e, fondo, tinta, suave, acento, fondoCierre, tintaCierre,
    titular: fam(kit.fuentes.titulos, e.titular),
    texto: fam(kit.fuentes.texto ?? kit.fuentes.titulos, e.texto),
  };
}

/** El logo del kit como lo pone la cabecera del carrusel (lib/carruseles/documento.ts), o null. */
export function logoDeKit(kit: KitMarca | null): Marca['logo'] {
  const l = kit?.logo;
  return l ? { id: l.subidoId, url: l.url, nombre: l.nombre, ancho: l.ancho, alto: l.alto } : null;
}
