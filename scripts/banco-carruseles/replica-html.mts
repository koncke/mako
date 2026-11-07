// Dibuja el diseño que arma «Editar» (lib/carruseles/replica.ts) como HTML, con las letras reales del editor (@fontsource por jsDelivr),
// para MIRARLO: lo que devolvería una IA (textos chicos, a un costado, serif) y lo que sale de documentoDeReplica / documentoDeCarrusel.
// Uso: node --import tsx scripts/banco-carruseles/replica-html.mts → scripts/banco-carruseles/salida/replica.html (y /replica.html del servidor).
import fs from 'node:fs';
import path from 'node:path';
import { documentoDeCarrusel } from '../../lib/carruseles/documento';
import { documentoDeReplica, leerReplica, type Replica } from '../../lib/carruseles/replica';
import { estiloSinSerif } from '../../lib/carruseles/marca-kit';
import { tipoCarrusel } from '../../lib/carruseles/tipos';

let n = 0;
const nuevoId = () => `o${++n}`;
const marca = { nombre: 'Sonrisa Llena', usuario: 'sonrisa.llena' };

// Lo que devolvería un modelo: posiciones y tamaños tímidos (lo que se veía en editar-aviso.png), sin letra.
const T = (rol: string, texto: string, o: Record<string, unknown> = {}) => ({ rol, texto, x: 0.07, y: 0.12, ancho: 0.55, tamano: 0.03, color: '#FFFFFF', negrita: true, alinear: 'left', mayus: false, ...o });
const cruda = JSON.stringify({
  proporcion: '4:5', titulo: '5 errores al cobrar tu consulta',
  laminas: [
    { fondo: '#111111', foto: { x: 0.5, y: 0.45, ancho: 0.5, alto: 0.55, quien: 'dueno', descripcion: 'la dueña en su consultorio' }, textos: [T('rotulo', 'SONRISA LLENA', { y: 0.05, tamano: 0.014, color: '#F2B01E', ancho: 0.5 }), T('titulo', '5 errores al cobrar tu consulta', { y: 0.3, tamano: 0.035 })] },
    { fondo: '#F5F1E8', foto: null, textos: [T('rotulo', 'ERROR 1', { y: 0.2, tamano: 0.012, color: '#B45309' }), T('titulo', 'Decir el precio antes del valor', { y: 0.26, tamano: 0.03, color: '#111111', ancho: 0.6 }), T('cuerpo', 'Primero cuenta qué cambia en la vida del paciente y luego el precio.', { y: 0.55, tamano: 0.018, color: '#444444', negrita: false })] },
    { fondo: '#0F3D3E', foto: null, textos: [T('titulo', 'Ofrecer descuento sin que lo pidan', { y: 0.3, tamano: 0.034, color: '#F4E9D8' }), T('cuerpo', 'Un descuento a la fuerza baja el valor de tu trabajo.', { y: 0.6, tamano: 0.02, color: '#C9D6CF', negrita: false })] },
    { fondo: '#F2B01E', foto: null, textos: [T('titulo', 'Comenta CITA y te escribo para agendar', { y: 0.35, tamano: 0.04, color: '#111111', alinear: 'center', x: 0.2, ancho: 0.6 }), T('firma', 'Sonrisa Llena', { y: 0.92, tamano: 0.015, color: '#111111', negrita: false })] },
  ],
});
const replica = leerReplica(cruda, { laminas: 4 }) as Replica;
const estilo = estiloSinSerif(tipoCarrusel('lista')!.estilo, null);

// Una foto de mentira para MIRAR dónde cae (un SVG, así el banco no baja nada).
const RETRATO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#2b3a42"/><circle cx="400" cy="380" r="150" fill="#d9c3a9"/><rect x="220" y="560" width="360" height="440" rx="160" fill="#d9c3a9"/></svg>')}`;
const LA_FOTO = { id: 'retrato', url: RETRATO, ancho: 800, alto: 1000 };

// 1. La lámina 1 muestra a SU AUTOR: ahí va la foto del cliente.
const conIA = documentoDeReplica({ replica, estilo, marca, foto: LA_FOTO, nuevoId });
// 2. La MISMA lámina, pero el ejemplo muestra a OTRA persona (un paciente): la cara del cliente NO va, y el lugar queda
//    reservado porque la foto la está armando su IA de imagen (lib/carruseles/foto-lamina.ts).
const ajena: Replica = { ...replica, laminas: replica.laminas.map((l, i) => (i === 0 && l.foto ? { ...l, foto: { ...l.foto, quien: 'otra' as const } } : l)) };
const conAjena = documentoDeReplica({ replica: ajena, estilo, marca, foto: LA_FOTO, nuevoId, reservadas: [0] });
// 3. Y la misma, sin IA de imagen conectada: no se reserva nada y el texto llena la lámina.
const sinFlow = documentoDeReplica({ replica: ajena, estilo, marca, foto: LA_FOTO, nuevoId });
const sinIA = documentoDeCarrusel({ laminas: tipoCarrusel('lista')!.estructura(4), estilo, marca, nuevoId });


type Obj = Record<string, unknown>;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
function pagina(p: Obj, W: number, H: number, k: number): string {
  const fondo = ((p.background as Obj)?.color as string) ?? '#fff';
  const objs = (p.objects as Obj[]).map((o) => {
    if (o.type === 'textbox') {
      return `<div style="position:absolute;left:${(o.left as number) * k}px;top:${(o.top as number) * k}px;width:${(o.width as number) * k}px;font:${o.fontWeight} ${(o.fontSize as number) * k}px/${o.lineHeight} ${String(o.fontFamily).split(String.fromCharCode(34)).join(String.fromCharCode(39))};color:${o.fill};text-align:${o.textAlign};letter-spacing:${((o.charSpacing as number) ?? 0) / 1000}em;text-transform:${o.textCase === 'upper' ? 'uppercase' : 'none'}">${esc(String(o.text))}</div>`;
    }
    if (o.type === 'image') {
      const w = (o.width as number) * (o.scaleX as number); const h = (o.height as number) * (o.scaleY as number);
      return `<img src="${o.src}" style="position:absolute;left:${(o.left as number) * k}px;top:${(o.top as number) * k}px;width:${w * k}px;height:${h * k}px;object-fit:cover">`;
    }
    if (o.type === 'rect') return `<div style="position:absolute;left:${(o.left as number) * k}px;top:${(o.top as number) * k}px;width:${(o.width as number) * k}px;height:${(o.height as number) * k}px;background:${o.fill}"></div>`;
    if (o.type === 'ellipse') return `<div style="position:absolute;left:${((o.left as number) - (o.width as number) / 2) * k}px;top:${((o.top as number) - (o.height as number) / 2) * k}px;width:${(o.width as number) * k}px;height:${(o.height as number) * k}px;border-radius:50%;background:${o.fill}"></div>`;
    return '';
  }).join('');
  return `<div style="position:relative;width:${W * k}px;height:${H * k}px;background:${fondo};overflow:hidden;border-radius:6px;flex:none">${objs}</div>`;
}
function fila(titulo: string, doc: Record<string, unknown>): string {
  const k = 0.2;
  const W = doc.width as number; const H = doc.height as number;
  return `<h2>${titulo}</h2><div class="fila">${(doc.pages as Obj[]).map((p) => pagina(p, W, H, k)).join('')}</div>`;
}
const fuentes = ['montserrat@5/800', 'montserrat@5/400', 'inter@5/400', 'inter@5/700', 'archivo-black@5/400', 'anton@5/400', 'playfair-display@5/800', 'dm-serif-display@5/400']
  .map((f) => `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/${f.split('@')[0]}@${f.split('@')[1].split('/')[0]}/${f.split('/')[1]}.css">`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8">${fuentes}<style>body{margin:0;padding:18px;background:#e9e9e6;font-family:Inter,sans-serif}h2{font-size:15px;margin:14px 0 8px}.fila{display:flex;gap:10px}</style></head><body>
${fila('Editar con la IA del negocio: el ejemplo muestra a SU AUTOR → ahí va la foto del cliente', conIA)}
${fila('El ejemplo muestra a OTRA persona + su IA de imagen: su cara NO va, y el lugar queda reservado (la foto llega después)', conAjena)}
${fila('Lo mismo SIN su IA de imagen: no se reserva nada y el texto llena la lámina', sinFlow)}
${fila('Editar sin IA o sin láminas: la estructura con guías, texto grande y centrado', sinIA)}
</body></html>`;
const sal = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'salida');
fs.mkdirSync(sal, { recursive: true });
fs.writeFileSync(path.join(sal, 'replica.html'), html);
console.log('replica.html listo');
