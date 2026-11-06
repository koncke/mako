// Datos INVENTADOS para el banco (ni un creador ni un carrusel real): láminas dibujadas en SVG, de varios colores y largos.
import type { Carrusel } from '@/lib/carruseles/explorar';
import type { DatosExplorador } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import type { Thumbnail } from '@/lib/thumbnails/explorar';

const PALETAS = [['#111827', '#F59E0B'], ['#F5F1E8', '#B45309'], ['#0F3D3E', '#F4E9D8'], ['#2563EB', '#FFFFFF'], ['#F25C54', '#FFF4E6'], ['#1D3557', '#F1FAEE'], ['#FAFAF7', '#111111'], ['#264653', '#E9C46A']];
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function lineas(t: string, n: number): string[] {
  const out: string[] = [];
  let l = '';
  for (const w of t.split(' ')) {
    if ((l + ' ' + w).trim().length > n) { out.push(l.trim()); l = w; } else l += ' ' + w;
  }
  if (l.trim()) out.push(l.trim());
  return out;
}
export function lamina(texto: string, pal: number, i: number, de: number, persona = false): string {
  const [fondo, tinta] = PALETAS[pal % PALETAS.length];
  const ls = lineas(texto, i === 0 ? 14 : 18);
  const tam = i === 0 ? 112 : 84;
  const y0 = 560 - (ls.length * tam) / 2;
  const txt = ls.map((l, k) => `<text x="90" y="${y0 + k * tam * 1.1}" font-family="Arial Black, Arial, sans-serif" font-weight="800" font-size="${tam}" fill="${tinta}">${esc(l)}</text>`).join('');
  const cara = persona ? `<circle cx="820" cy="1000" r="150" fill="${tinta}" opacity=".25"/><rect x="660" y="1100" width="320" height="250" rx="120" fill="${tinta}" opacity=".25"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="${fondo}"/>${cara}${txt}<text x="90" y="1260" font-family="Arial" font-size="40" fill="${tinta}" opacity=".7">${i + 1} / ${de}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const dia = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const CREADORES = [
  { id: -1, nombre: 'Ventas Claras', usuario: 'ventas.claras' }, { id: -2, nombre: 'Marta Rios Coach', usuario: 'marta.rios.coach' },
  { id: -3, nombre: 'Estudio Lumen', usuario: 'estudio.lumen' }, { id: -4, nombre: 'Café Brasa', usuario: 'cafebrasa' },
  { id: -5, nombre: 'Lucía Vega', usuario: 'lucia.vega.marketing' }, { id: -6, nombre: 'Dr. Paz', usuario: 'drpaz.dental' },
];
const GANCHOS: Array<[string, Carrusel['formato'], string | null]> = [
  ['Mi primer cliente de US$1.000', 'storytime', 'PLAN'], ['5 errores al cobrar tu consulta', 'lista', 'GUÍA'], ['Cómo cobrar más sin perder ventas', 'tutorial', null],
  ['Antes y después de ordenar mi oferta', 'antes-despues', null], ['Mito: bajar el precio vende más', 'mito', 'PRECIO'], ['Tu Instagram también puede transformarse', '', null],
  ['3 preguntas que le hago a cada cliente nuevo', 'preguntas', null], ['Lo que nadie te cuenta de vender por WhatsApp', 'opinion', 'WHATSAPP'],
  ['7 prompts para escribir tu semana de contenido', 'lista', 'PROMPTS'], ['Así armé un embudo en una tarde', 'tutorial', null], ['Un cliente me dijo que no. Esto hice', 'storytime', null],
  ['Guarda este checklist para tu próximo lanzamiento', 'lista', null],
];
export function datosDeEjemplo(n = 24): DatosExplorador {
  const carruseles: Carrusel[] = Array.from({ length: n }, (_, i) => {
    const [g, formato, palabra] = GANCHOS[i % GANCHOS.length];
    const cr = CREADORES[i % CREADORES.length];
    const laminas = [0, 5, 7, 6, 0, 4, 8, 0, 6, 5, 3, 9][i % 12];
    const outlier = [12.4, 3.7, 1.4, 5.2, 2.1, 8.8, 1.1, 4.1, 2.6, 6.3, null, 1.8][i % 12];
    const lams = laminas ? Array.from({ length: laminas }, (_, k) => lamina(k === 0 ? g : k === laminas - 1 ? 'Comenta la palabra y te lo mando' : `Idea ${k}: ${g.split(' ').slice(0, 3).join(' ')}`, i, k, laminas, k === 1 && i % 3 === 0)) : [];
    const mediana = 800 + i * 90;
    return {
      id: -(i + 1), competidorId: cr.id, origen: i % 4 === 3 ? 'cuentas' : 'biblioteca', creador: { nombre: cr.nombre, usuario: cr.usuario, foto: null }, url: 'https://www.instagram.com/p/EJEMPLO/',
      miniatura: lamina(g, i, 0, laminas || 5), texto: `${g}. ${palabra ? `Comenta ${palabra} y te lo mando.` : 'Guárdalo.'}`, gancho: g, tipoGancho: null, cierre: null, formato, medio: 'carrusel',
      laminas: laminas || (i % 5 === 0 ? 6 : null), megusta: Math.round(mediana * (outlier ?? 1) * 0.9), comentarios: Math.round(mediana * (outlier ?? 1) * 0.1), publicada: dia(2 + i * 3), traida: dia(1), outlier,
      multiplo: outlier == null ? undefined : { veces: outlier, formato: 'imagenes', metrica: 'interaccion', canal: 'instagram', valor: Math.round(mediana * outlier), mediana, comparadas: 12 },
      pareceContenido: true, clase: 'carrusel', laminasImagenes: lams, cta: palabra ? { palabra, via: 'comentario' } : null,
    } as Carrusel;
  });
  return { carruseles, guardados: [-2], busquedas: [{ id: 'b1', nombre: 'Cobrar más', query: 'q=cobrar', en: dia(1) }], paso: 'listo', frase: '', accion: null, ejemplos: carruseles.length, avisoBiblioteca: null, anuncios: 0,
    thumbnails: { ok: true, lista: miniaturasDeEjemplo(), guardados: [3], sinTablas: false } };
}

// ── Miniaturas de YouTube (la tab Thumbnails, 6/11/2026), también inventadas. La imagen la pinta entrada.tsx: la tarjeta pide la de
// i.ytimg.com por el id del video, y el banco la cambia por un SVG 16:9 con el titular (`miniaturaSvg`).
const CANALES = [
  { id: 1, nombre: 'Ventas Claras', handle: '@ventasclaras' }, { id: 2, nombre: 'Negocio Simple', handle: '@negociosimple' },
  { id: 3, nombre: 'Marketing con Lupe', handle: '@marketingconlupe' }, { id: 4, nombre: 'Emprende Hoy', handle: '@emprendehoy' },
  { id: 5, nombre: 'Clientes Fieles', handle: '@clientesfieles' },
];
export const TITULARES = ['DEJA DE COBRAR BARATO', '3 ERRORES AL VENDER', 'ASÍ CONSEGUÍ 50 CLIENTES', 'NADIE TE LO DICE', 'VENDE POR WHATSAPP', 'MI PRIMER US$10.000',
  'EL PRECIO NO ES EL PROBLEMA', 'CIERRA EN 1 LLAMADA', 'ARMA TU OFERTA HOY', '¿POR QUÉ NO TE COMPRAN?', '7 IDEAS DE CONTENIDO', 'TU WEB NO VENDE'];
const TITULOS = ['Cómo cobrar lo que vale tu servicio', 'Los 3 errores que te hacen perder ventas', 'Así conseguí mis primeros 50 clientes', 'Lo que nadie te dice de emprender',
  'Cómo vender por WhatsApp sin parecer insistente', 'Mi primer mes de US$10.000 con un servicio', 'Por qué el precio no es el problema', 'Cómo cerrar una venta en una sola llamada',
  'Arma una oferta que no puedan rechazar', 'Por qué no te compran (y cómo arreglarlo)', '7 ideas de contenido para tu negocio', 'Tu página web no vende: esto le falta'];
export const idDeVideo = (i: number) => `vid${String(i).padStart(8, '0')}`;
export function miniaturaSvg(i: number): string {
  const [fondo, tinta] = PALETAS[(i + 3) % PALETAS.length];
  const ls = lineas(TITULARES[i % TITULARES.length], 12);
  const txt = ls.map((l, k) => `<text x="60" y="${250 + k * 120}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="104" fill="${tinta}">${esc(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${fondo}"/><circle cx="1040" cy="330" r="170" fill="${tinta}" opacity=".22"/><rect x="860" y="470" width="360" height="250" rx="140" fill="${tinta}" opacity=".22"/>${txt}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export function miniaturasDeEjemplo(n = 18): Thumbnail[] {
  return Array.from({ length: n }, (_, i) => {
    const c = CANALES[i % CANALES.length];
    return {
      id: i + 1, video: idDeVideo(i + 1), canalId: c.id, canal: { nombre: c.nombre, handle: c.handle, foto: null },
      titulo: TITULOS[i % TITULOS.length], publicado: dia(5 + i * 9), duracion: `PT${8 + (i % 9)}M${10 + i}S`,
      vistas: [184_000, 92_300, 1_240_000, 48_900, 310_000, 27_400][i % 6] + i * 1300, megusta: 3000 + i * 40, comentarios: 120 + i,
      nicho: (['ventas', 'marketing', 'emprendimiento', 'servicios'] as const)[i % 4], idioma: 'es', outlier: null,
    };
  });
}
