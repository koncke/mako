// El banco de las portadas de outliers (12/11/2026): Copywriting, Image y Web Generator con datos INVENTADOS, sin base ni chat.
// `?p=copy|image|web`, `&tel=1` (el teléfono), `&mis=1` (como adentro de la pantalla de Create: «Mis guiones / diseños / landings»).
import { createRoot } from 'react-dom/client';
import { OutliersCopy } from '@/app/copywriter/OutliersCopy';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { OutliersLandings } from '@/app/web-generator/OutliersLandings';
import { PortadaCrearCtx } from '@/app/_crear/portada-ctx';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { filtrosThumbnailDeQuery } from '@/lib/thumbnails/explorar';
import type { FormatoCopy, OutlierCopy } from '@/lib/copywriter/outliers';
import type { OutlierLanding, TipoLanding } from '@/lib/landing-outliers';
import { datosDeEjemplo, lamina } from '../banco-carruseles/datos';

const q = new URLSearchParams(window.location.search);
const telefono = q.get('tel') === '1';
const dia = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/**
 * Una portada dibujada con la forma de su red: una escena con una persona, SIN texto (13/11/2026: con los primeros 18 caracteres del
 * gancho dibujados, «Cobrar mejor no» parecía un título cortado de la tarjeta). El carrusel y el anuncio usan una lámina del otro banco.
 */
function dibujo(formato: FormatoCopy, texto: string, i: number): string {
  if (formato === 'carrusel' || formato === 'anuncio') return lamina(texto, i, 0, 6, i % 2 === 0);
  const [w, h] = formato === 'youtube' ? [1280, 720] : [1080, 1920];
  const fondos = [['#c9b8a6', '#7d6a58'], ['#9fb7c9', '#4f6b80'], ['#d8c3a5', '#8e6f4e'], ['#a7c4a0', '#56704f'], ['#c7a9c9', '#6e5070'], ['#b9b9b9', '#5e5e5e']];
  const [claro, oscuro] = fondos[i % fondos.length];
  const r = Math.min(w, h);
  const cx = formato === 'youtube' ? w * 0.68 : w * 0.5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect x="${w * 0.08}" y="${h * 0.1}" width="${w * 0.25}" height="${h * 0.35}" rx="12" fill="#fff" opacity=".18"/><circle cx="${cx}" cy="${h * 0.42}" r="${r * 0.16}" fill="#2a211c"/><rect x="${cx - r * 0.3}" y="${h * 0.42 + r * 0.17}" width="${r * 0.6}" height="${h}" rx="${r * 0.2}" fill="#1f2a3a"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GANCHOS: Array<[FormatoCopy, string, string]> = [
  ['reel', 'Cobrar mejor no es suerte, es sistema.', 'Que paja la gente que paga poco, vieron? Que te paga un servicio de cien dólares te está pagando dos mil. Sos su empleado, te manda a cualquier hora, las reuniones exige un montón, no te hace caso y después no les gustan los resultados. Lo que cambió todo fue subir el precio y explicar por qué.'],
  ['youtube', 'Cómo escalar tu agencia a 50 mil al mes sin contratar a nadie', 'En este video te muestro el sistema completo.'],
  ['carrusel', 'Los 5 errores que te hacen perder clientes en el primer mensaje', 'El primero es hablar de vos. El segundo es mandar el precio sin contexto. El tercero es no preguntar nada. El cuarto: un audio de cuatro minutos. El quinto: desaparecer después del «lo pienso».'],
  ['anuncio', 'Dejá de perseguir clientes: que te escriban ellos.', 'Taller gratis de 45 minutos. Cupos limitados. Te muestro el embudo exacto que usamos con 120 negocios de servicios.'],
  ['reel', '¿Tu WhatsApp está lleno de «lo pienso»?', 'Esto es lo que les digo yo para que respondan en el día, y no es presionar. Es hacer una sola pregunta.'],
  ['youtube', 'Hice 100 llamadas de venta en una semana: esto aprendí', 'Los datos reales, los guiones y los errores.'],
  ['carrusel', 'Guardá esto antes de tu próxima llamada de cierre', 'Paso 1: repetí su problema con sus palabras. Paso 2: preguntá qué pasa si no lo resuelve. Paso 3: callate.'],
  ['reel', 'El precio no es el problema.', 'Cuando alguien te dice que es caro, en realidad te está diciendo otra cosa. Te explico qué y cómo contestar.'],
  ['anuncio', 'Tu próximo cliente ya te está buscando', 'Plantillas de mensajes, el guion de la llamada y el seguimiento de 7 días. Gratis por esta semana.'],
  ['youtube', 'La landing que convirtió 9%: la desarmo parte por parte', 'Titular, prueba, oferta y garantía.'],
  ['reel', 'Tres frases que nunca más vas a decir en una venta', 'Una: «te mando la info». Dos: «cualquier cosa me avisás». Tres: «es un precio especial».'],
  ['carrusel', 'Cómo pasé de 3 a 41 conversaciones por día', 'Sin pagar anuncios. Con un solo cambio en la bio y dos historias por día.'],
];

function outliersCopy(): OutlierCopy[] {
  return GANCHOS.map(([formato, gancho, sigue], i) => ({
    id: `spy:${900 + i}`, fuente: 'spy', formato,
    creador: { nombre: ['Ventas Claras', 'Marta Rios Coach', 'Estudio Lumen', 'Café Brasa'][i % 4], usuario: ['ventas.claras', 'marta.rios.coach', 'estudio.lumen', 'cafebrasa'][i % 4], foto: null, competidorId: null },
    url: formato === 'youtube' ? `https://www.youtube.com/watch?v=EJEMPLO${String(i).padStart(4, '0')}` : 'https://www.instagram.com/p/EJEMPLO/',
    miniatura: i === 10 ? null : dibujo(formato, gancho, i), gancho, texto: `${gancho} ${sigue}`,
    deDonde: formato === 'reel' && i % 3 === 0 ? 'guion' : formato === 'anuncio' ? 'copy' : formato === 'youtube' ? 'descripcion' : 'pie',
    multiplo: formato === 'anuncio' ? null : { veces: [70.9, 12.4, 5.1, 3.2, 2.1, 18.7][i % 6], metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 12 },
    ...(formato === 'anuncio' ? { diasAlAire: 30 + i } : {}),
    vistas: 12_000 * (i + 1), megusta: 900 * (i + 2), comentarios: 40 * (i + 1), publicada: dia(3 + i * 9),
    ...(formato === 'carrusel' ? { laminas: 5 + (i % 4) } : {}),
  }));
}

function larga(i: number): string {
  const c = ['#111827', '#F5F1E8', '#0F3D3E', '#2563EB'][i % 4];
  const t = i % 2 ? '#111' : '#fff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 2400"><rect width="640" height="2400" fill="${c}"/><text x="40" y="120" font-family="Arial Black, Arial" font-size="44" fill="${t}">Tu titular aquí</text><rect x="40" y="200" width="560" height="315" fill="${t}" opacity=".15"/><rect x="40" y="600" width="560" height="60" rx="30" fill="#F2B01E"/><rect x="40" y="800" width="560" height="900" fill="${t}" opacity=".08"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const TIPOS: TipoLanding[] = ['vsl', 'webinar', 'aplicacion', 'lead-magnet'];
const landings: OutlierLanding[] = Array.from({ length: 6 }, (_, i) => ({
  id: `relevo:${i}`, fuente: 'relevo', url: `https://ejemplo-${i}.com/`, titulo: ['Cómo conseguir 10 clientes nuevos en 30 días', 'Clase gratis: el sistema de ventas por WhatsApp', 'Agenda tu llamada de diagnóstico', 'Descarga la guía de precios'][i % 4],
  quien: { nombre: ['Ventas Claras', 'Marta Rios Coach', 'Estudio Lumen'][i % 3], nicho: 'Coaching' }, tipo: TIPOS[i % 4],
  // La primera, con una captura que nunca llega: se ve el marco de espera (el color de su tipo y el dominio), no una caja gris.
  porque: 'Promesa concreta con plazo, prueba social arriba y un solo botón.', imagen: i === 0 ? '/no-existe.png' : larga(i), alto: 2400, idioma: 'es',
}));

const portada = (q.get('p') ?? 'copy') === 'image'
  ? <ExplorarCarruseles datos={datosDeEjemplo()} telefono={telefono} filtrosIniciales={filtrosDeQuery(q)} thumbnailsIniciales={filtrosThumbnailDeQuery(q)} />
  : q.get('p') === 'web'
    ? <OutliersLandings portada={{ outliers: landings, caidas: [] }} telefono={telefono} />
    : <OutliersCopy portada={{ outliers: outliersCopy(), caidas: [] }} telefono={telefono} />;

createRoot(document.getElementById('raiz')!).render(
  <PortadaCrearCtx.Provider value={q.get('mis') === '1' ? { verProyectos: () => alert('Mis …') } : null}>
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>{portada}</div>
  </PortadaCrearCtx.Provider>,
);
