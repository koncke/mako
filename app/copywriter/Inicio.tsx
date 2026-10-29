'use client';

// =============================================================================
// Inicio — «Nueva»: «¿Qué vas a crear hoy?», la caja de MaKo y los templates
// =============================================================================
// Pedido de Martín (29/10/2026): «Nueva» abre TEMPLATES bajo «¿Qué vas a crear hoy?» (docs/diseno-copywriter.md, D12).
// Arriba la caja de mila.gg («Create a doc about whales»): lo escrito es el primer pedido a MaKo en la página nueva.
// Abajo, los templates de lib/copywriter/plantillas.ts en tarjetas, por grupo, como la galería de Notion. Tocar uno crea
// la página y la abre; Enter en la caja, sin elegir, crea una página en blanco y MaKo la escribe.
// =============================================================================

import { useMemo, useState } from 'react';
import type { TipoGuion } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { gruposDePlantillas, plantillasDe, type Plantilla } from '@/lib/copywriter/plantillas';

export function Inicio({ onCrear, creando, catalogos, arbolPlegado = false, onDesplegarArbol, tipoInicial = null }: {
  onCrear: (plantilla: Plantilla, pedido: string) => void;
  creando: boolean;
  catalogos: CatalogosCopy;
  /** La barra de páginas plegada (ventana angosta): «»» la vuelve a abrir, como en las migas del documento. */
  arbolPlegado?: boolean;
  onDesplegarArbol?: () => void;
  /** El tipo pedido por un link viejo (`/copywriter?nuevo=<tipo>`): sus templates van primero. */
  tipoInicial?: TipoGuion | null;
}) {
  const [pedido, setPedido] = useState('');
  const plantillas = useMemo(() => {
    const todas = plantillasDe(catalogos);
    return tipoInicial ? [...todas.filter((p) => p.tipo === tipoInicial), ...todas.filter((p) => p.tipo !== tipoInicial)] : todas;
  }, [catalogos, tipoInicial]);
  const grupos = useMemo(() => gruposDePlantillas(plantillas), [plantillas]);
  const blanco = plantillas.find((p) => p.id === 'blanco') ?? plantillas[plantillas.length - 1];
  const crear = (p: Plantilla) => { if (!creando) onCrear(p, pedido.trim()); };
  return (
    <div className="nt-doc">
      {arbolPlegado && (
        <div className="nt-barra">
          <button type="button" className="nt-boton-ico" onClick={onDesplegarArbol} title="Abrir la barra de páginas" aria-label="Abrir la barra de páginas">»</button>
        </div>
      )}
      <div className="nt-scroll">
        <div className="nt-galeria">
          <h1 className="nt-inicio-titulo">¿Qué vas a crear hoy?</h1>
          <div className="nt-inicio-campo">
            <input value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Cuéntale a MaKo de qué se trata (opcional)"
              aria-label="De qué se trata" maxLength={2000}
              onKeyDown={(e) => { if (e.key === 'Enter' && pedido.trim()) { e.preventDefault(); crear(blanco); } }} />
            <button type="button" className="nt-inicio-ir" onClick={() => crear(blanco)} disabled={creando || !pedido.trim()} aria-label="Crear con MaKo">{creando ? '…' : '→'}</button>
          </div>
          {grupos.map((g) => (
            <section key={g.grupo} className="nt-galeria-grupo" aria-label={g.grupo}>
              <h2 className="nt-galeria-titulo">{g.grupo}</h2>
              <div className="nt-galeria-grilla">
                {g.plantillas.map((p) => (
                  <button key={p.id} type="button" className="nt-plantilla" onClick={() => crear(p)} disabled={creando}>
                    <span className="nt-plantilla-emoji" aria-hidden>{p.emoji}</span>
                    <span className="nt-plantilla-nombre">{p.nombre}</span>
                    <span className="nt-plantilla-desc">{p.descripcion}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
