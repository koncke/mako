'use client';

// =============================================================================
// DialogoExportar — la pestaña «Exportar» de Gamma (y su diálogo propio)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Copia de Compartir → Exportar
// (gamma-ui.md §6.1): el rango («Todas las secciones» · «Sección actual» · «Rango
// personalizado», p. ej. 1-5,8,11-15) y las filas grandes con el cuadradito de color de cada
// formato y la flecha de bajar: Exportar a PDF, a PowerPoint, como PNG y —propio de una landing—
// como HTML. Mientras genera, la fila dice «Tu PDF se está exportando…» con la barra de
// progreso. Abajo, «Instalar fuentes» para el .pptx (las fuentes del tema, con su link a Google
// Fonts), como la caja azul de Gamma.
//
// `CuerpoExportar` es lo de adentro: lo monta este diálogo (`dialogo === 'exportar'`) y la
// pestaña Exportar de DialogoCompartir (`incrustado`). Las cuatro exportaciones viven en
// lib/editor-landing/exportar-*.ts; las librerías pesadas (html-to-image, jszip, pptxgenjs) se
// cargan con `import()` recién al exportar.
//
// Qué se exporta: las secciones de la PÁGINA ABIERTA, leídas del editor en vivo (no lo guardado:
// lo que la persona ve es lo que se lleva), sin las ocultas. Los enlaces a otras páginas salen
// resueltos contra la dirección publicada; sin publicar, quedan en «#».
//
// Lo que NO se copia de Gamma: Google Slides y LinkedIn (no hay integración), «Calidad de
// exportación» (el PNG sale a 2x siempre) y «Tablas editables» (las tablas salen como texto).
// =============================================================================

import { useState } from 'react';
import type { JsonNodo } from '@/lib/editor-landing/doc';
import { elegirTarjetas, parsearRango, exportarHtml, type OpExportar, type RangoExportar } from '@/lib/editor-landing/exportar-html';
import { exportarPdf } from '@/lib/editor-landing/exportar-pdf';
import { exportarPng } from '@/lib/editor-landing/exportar-png';
import { exportarPptx, fuentesDelTema } from '@/lib/editor-landing/exportar-pptx';
import { useEditorLanding } from '../contexto';
import { EstilosGmp, Icono, ModalGma, SelectorGma, useFijo } from './piezas-gma';

type Formato = 'pdf' | 'pptx' | 'png' | 'html';
type TipoRango = RangoExportar['tipo'];

const FORMATOS: { valor: Formato; texto: string; corto: string; nombre: string; color: string }[] = [
  { valor: 'pdf', texto: 'Exportar a PDF', corto: 'PDF', nombre: 'PDF', color: '#e5322d' },
  { valor: 'pptx', texto: 'Exportar a PowerPoint', corto: 'PPT', nombre: 'PowerPoint', color: '#d24726' },
  { valor: 'png', texto: 'Exportar como PNG', corto: 'PNG', nombre: 'PNG', color: '#8131dc' },
  { valor: 'html', texto: 'Exportar como HTML', corto: 'HTML', nombre: 'HTML', color: '#0858f7' },
];

const CSS_EXPORTAR = [
  '.gmp-exp-intro{margin:0 0 14px;color:var(--gmp-texto)}',
  '.gmp-exp-rango{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px}',
  '.gmp-exp-filas{display:grid;gap:8px}',
  '.gmp-export{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 14px 8px 10px;border:0;border-radius:10px;background:var(--gmp-suave);color:var(--gmp-tinta);font-size:14px;font-weight:600;text-align:left;cursor:pointer;transition:background .12s}',
  '.gmp-export:not(:disabled):hover{background:var(--gmp-hover)}',
  '.gmp-export:disabled{cursor:default}',
  '.gmp-export[data-ocupado]{color:var(--gmp-tenue)}',
  '.gmp-export-icono{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:none;border-radius:8px;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.02em}',
  '.gmp-export-txt{flex:1;min-width:0;display:grid;gap:6px}',
  '.gmp-fuentes{margin-top:16px;padding:12px 14px;border-radius:10px;background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro);font-size:13px}',
  '.gmp-fuentes p{margin:0 0 8px;font-weight:600}',
  '.gmp-fuentes div{display:flex;flex-wrap:wrap;gap:6px}',
  '.gmp-fuentes a{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;background:var(--gmp-fondo);color:var(--gmp-tinta);font-weight:500;text-decoration:none}',
  '.gmp-fuentes a:hover{text-decoration:underline}',
].join('\n');

/** Lo de adentro de «Exportar»: el rango, las cuatro filas y las fuentes. */
export function CuerpoExportar() {
  const { titulo, paginas, paginaActual, editor, config, tema, urlPublica, tarjetaActiva, avisar } = useEditorLanding();
  const [tipo, setTipo] = useState<TipoRango>('todas');
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState<Formato | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pagina = paginas.find((p) => p.id === paginaActual) ?? paginas[0];
  const nodosVivos = (): JsonNodo[] => (editor ? ((editor.getJSON().content as JsonNodo[] | undefined) ?? []) : pagina?.doc.content ?? []);
  const total = (pagina?.doc.content ?? []).filter((n) => n.type === 'tarjeta').length;
  const rango: RangoExportar = tipo === 'todas' ? { tipo } : tipo === 'actual' ? { tipo, tarjetaId: tarjetaActiva } : { tipo, texto };
  const errorRango = tipo === 'personalizado' && texto.trim() ? (() => { const r = parsearRango(texto, Math.max(total, 1)); return r.ok ? null : r.error; })() : null;

  const exportar = async (formato: Formato) => {
    if (!pagina || ocupado) return;
    const r = elegirTarjetas(nodosVivos(), rango);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setOcupado(formato);
    setProgreso(0);
    const op: OpExportar = {
      titulo: titulo || 'Landing',
      pagina,
      elegidas: r.elegidas,
      config,
      tema,
      urlBase: urlPublica,
      paginas: paginas.map((p) => ({ id: p.id, ruta: p.ruta })),
      onProgreso: setProgreso,
    };
    try {
      if (formato === 'pdf') await exportarPdf(op);
      else if (formato === 'pptx') await exportarPptx(op);
      else if (formato === 'png') await exportarPng(op);
      else await exportarHtml(op);
      if (formato !== 'pdf') avisar('Archivo descargado');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo exportar');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div>
      <EstilosGmp extra={{ href: 'gmp-exportar', css: CSS_EXPORTAR }} />
      <p className="gmp-exp-intro">Descarga una copia estática de esta página.</p>
      <div className="gmp-exp-rango">
        <SelectorGma etiqueta="Secciones" ancho={230} valor={tipo} onCambiar={(v) => { setTipo(v); setError(null); }}
          opciones={[
            { valor: 'todas', texto: 'Todas las secciones' },
            { valor: 'actual', texto: 'Sección actual' },
            { valor: 'personalizado', texto: 'Rango personalizado' },
          ]} />
        {tipo === 'personalizado' && (
          <input className="gmp-input" style={{ width: 200 }} value={texto} placeholder="p. ej. 1-5,8,11-15" aria-label="Rango personalizado"
            onChange={(e) => setTexto(e.target.value)} />
        )}
        {errorRango && <span className="gmp-error">{errorRango}</span>}
      </div>
      <div className="gmp-exp-filas">
        {FORMATOS.map((f) => {
          const este = ocupado === f.valor;
          return (
            <button key={f.valor} type="button" className="gmp-export" data-ocupado={este ? '' : undefined}
              disabled={!!ocupado || !!errorRango} aria-busy={este} onClick={() => void exportar(f.valor)}>
              <span className="gmp-export-icono" style={{ background: f.color }}>{f.corto}</span>
              <span className="gmp-export-txt">
                <span>{este ? `Tu ${f.nombre} se está exportando…` : f.texto}</span>
                {este && <span className="gmp-barra" aria-hidden><i style={{ width: `${Math.round(Math.max(0.05, progreso) * 100)}%` }} /></span>}
              </span>
              <Icono nombre="descargar" tam={18} />
            </button>
          );
        })}
      </div>
      {error && <p className="gmp-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      <div className="gmp-fuentes">
        <p>Instalar fuentes</p>
        <div>
          {fuentesDelTema(tema).map((f) => (
            <a key={f} href={`https://fonts.google.com/specimen/${f.replace(/ /g, '+')}`} target="_blank" rel="noopener noreferrer">
              {f}<Icono nombre="abrir" tam={12} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DialogoExportar({ onCerrar, incrustado = false }: { onCerrar?: () => void; incrustado?: boolean } = {}) {
  const { dialogo, setDialogo } = useEditorLanding();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setDialogo(null)));
  if (incrustado) return <CuerpoExportar />;
  if (dialogo !== 'exportar') return null;
  return (
    <ModalGma titulo="Exportar" icono={<Icono nombre="descargar" tam={22} style={{ color: 'var(--gmp-titulo)' }} />} onCerrar={cerrar} ancho={600}
      pie={(
        <>
          <button type="button" className="gmp-btn gmp-btn-fantasma" onClick={() => setDialogo('analitica')}><Icono nombre="grafico" tam={15} />Ver análisis</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="gmp-btn gmp-btn-primario" onClick={cerrar}>Listo</button>
        </>
      )}>
      <CuerpoExportar />
    </ModalGma>
  );
}

export default DialogoExportar;
