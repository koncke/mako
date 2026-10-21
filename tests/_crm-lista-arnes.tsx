// =============================================================================
// Arnés de la vista LISTA de /crm: la dibuja con los componentes REALES y la mide en un navegador (21/10/2026)
// =============================================================================
// NO es un test (no termina en .test.ts). Escribe una página por pantalla —934×639 y 1024×768, con la barra lateral
// abierta (244 px) y plegada (68 px)— con el encabezado y filas de verdad (`TitulosLista`, `CeldasLead`, `estiloFila`,
// las columnas de `columnasQueEntran`) adentro del mismo relleno que /crm (44 px por lado). Cada página se mide sola al
// cargar (`window.__medida`): cuántas celdas tienen texto VISIBLE fuera de su lugar (se pisan), qué rótulos terminan en
// «…», y cuántas letras del nombre se ven.
//   Correr: node --import tsx tests/_crm-lista-arnes.tsx <carpeta>   → y abrir <carpeta>/lista-<ancho>-<barra>.html
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeldasLead, TitulosLista, estiloEncabezado, estiloFila } from '../app/crm/TablaListaLeads';
import { anchoMinimo, columnasQueEntran, plantillaDeColumnas } from '../app/crm/tabla-columnas';

const CARPETA = process.argv[2] ?? '.';
const RELLENO_CRM = 44;
const CHIP = { display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#eef', color: '#335', border: '1px solid #ccd', whiteSpace: 'nowrap' } as const;

const FILAS = [
  { nombre: 'Daniel Fernández Gutiérrez', email: 'daniel.fernandez@empresagrande.com', empresa: 'Inmobiliaria del Sur', origen: 'Meta Ads · VSL', etapa: 'Nutrición – Reactivación', agenda: 'Sí, 22/10', monto: '$1.500 USD', ganado: false, creado: '21/10/2026' },
  { nombre: 'María José Rodríguez', email: 'mjrodriguez@gmail.com', empresa: 'Estudio Rodríguez & Asociados', origen: 'Landing orgánica', etapa: 'Agendado R1', agenda: 'No', monto: '$2.300 USD', ganado: true, creado: '20/10/2026' },
  { nombre: 'Juan Pérez', email: 'juan@x.com', empresa: '', origen: 'WhatsApp', etapa: 'Ganado', agenda: null, monto: '$900 USD', ganado: true, creado: '02/10/2026' },
];

function pagina(ancho: number, alto: number, barra: number): string {
  // El ancho del recuadro de la tabla (su `clientWidth`, sin el borde de 1 px por lado): lo que mide CrmBoard.
  const recuadro = ancho - barra - RELLENO_CRM * 2 - 2;
  const cols = columnasQueEntran(recuadro);
  const plantilla = plantillaDeColumnas(cols);
  const min = anchoMinimo(cols);
  const casilla = <input type="checkbox" style={{ width: 16, height: 16 }} />;
  const acciones = <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}><span style={{ width: 28, height: 28, display: 'inline-block' }} /><span style={{ width: 28, height: 28, display: 'inline-block' }} /></div>;
  const tabla = renderToStaticMarkup(
    <div id="tabla" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden' }}>
      <div data-fila="encabezado" style={estiloEncabezado(plantilla, min)}>
        <span>{casilla}</span>
        <TitulosLista cols={cols} orden="creado" dir="desc" onSort={() => {}} />
        <span aria-label="Acciones" />
      </div>
      {FILAS.map((f, i) => (
        <div key={i} data-fila={`fila-${i}`} style={estiloFila(plantilla, min)}>
          {casilla}
          <CeldasLead cols={cols} nombre={f.nombre} email={f.email} empresa={f.empresa} origen={f.origen}
            etapa={{ rotulo: f.etapa, estilo: CHIP }} agenda={f.agenda} monto={{ texto: f.monto, ganado: f.ganado }} creado={f.creado} />
          {acciones}
        </div>
      ))}
    </div>,
  );
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>lista ${ancho}x${alto} barra ${barra}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
<style>:root{--border:#e3e5ea;--surface:#fff;--surface-2:#f6f7f9;--dim:#5b6170;--faint:#8a90a0;--ink:#12151b;--primary:#2f6fde;--good:#1e8a4c}
html,body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head>
<body><div style="display:flex;min-height:100vh"><aside style="width:${barra}px;flex:none;background:#1e2230"></aside>
<main style="flex:1;min-width:0;padding:16px ${RELLENO_CRM}px 60px ${RELLENO_CRM}px">${tabla}</main></div>
<script>
(async () => {
  await document.fonts.ready;
  const clipDe = (el, hasta) => { let r = { l: -1e9, r: 1e9 }; for (let n = el; n && n !== hasta.parentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.overflowX !== 'visible') { const b = n.getBoundingClientRect(); r = { l: Math.max(r.l, b.left), r: Math.min(r.r, b.right) }; } } return r; };
  const filas = [...document.querySelectorAll('[data-fila]')];
  let pisan = 0; const detalle = [];
  for (const f of filas) {
    const celdas = [...f.children];
    celdas.forEach((c, i) => {
      const caja = c.getBoundingClientRect();
      const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!t.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        const clip = clipDe(t.parentElement, c);
        for (const r of rg.getClientRects()) {
          const izq = Math.max(r.left, clip.l), der = Math.min(r.right, clip.r);
          if (der - izq < 1) continue;
          if (izq < caja.left - 1 || der > caja.right + 1) { pisan++; detalle.push(f.dataset.fila + ' celda ' + i + ': «' + t.textContent.trim() + '»'); }
        }
      }
    });
  }
  const rotulos = [...document.querySelectorAll('[data-fila=encabezado] button span:first-child')].map((s) => ({ texto: s.textContent, cortado: s.scrollWidth > s.clientWidth + 1 }));
  const nombres = [...document.querySelectorAll('[data-celda=nombre]')].map((el) => {
    const t = el.firstChild; const clip = el.getBoundingClientRect(); let n = 0;
    for (let k = 0; k < t.textContent.length; k++) { const rg = document.createRange(); rg.setStart(t, k); rg.setEnd(t, k + 1); const r = rg.getBoundingClientRect(); if (r.right <= clip.right + 0.5) n++; }
    return { nombre: t.textContent, letras: n, enteras: n === t.textContent.length, ancho: Math.round(clip.width) };
  });
  const tabla = document.getElementById('tabla');
  window.__medida = { pantalla: '${ancho}x${alto}', barra: ${barra}, recuadro: tabla.clientWidth, esperado: ${recuadro}, columnas: ${JSON.stringify(cols)}, scrollDeCostado: tabla.scrollWidth > tabla.clientWidth + 1, pisan, detalle, rotulos, nombres };
  document.title = 'listo';
})();
</script></body></html>`;
}

mkdirSync(CARPETA, { recursive: true });
for (const [ancho, alto] of [[934, 639], [1024, 768]]) for (const barra of [244, 68]) {
  const f = join(CARPETA, `lista-${ancho}-${barra}.html`);
  writeFileSync(f, pagina(ancho, alto, barra));
  process.stdout.write(`${f}\n`);
}
