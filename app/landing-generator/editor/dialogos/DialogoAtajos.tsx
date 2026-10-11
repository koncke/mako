'use client';

// =============================================================================
// DialogoAtajos — «Atajos de teclado» (el panel de Gamma)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (paquete I2). La lista y los NOMBRES salen del panel «Atajos de
// teclado» de Gamma (relevo gamma-ui §7, del código de Gamma), con «sección» donde Gamma dice
// «diapositiva» (en una página web Gamma dice sección).
//
// ⚠️ SÓLO LO QUE EXISTE ACÁ. Quedan afuera los de Gamma que este editor no tiene: ecuación
//    matemática, fragmento de código, nota al pie, formato libre (agrupar/desagrupar), seguir
//    escribiendo con IA (+++), dividir diapositiva (***), menciones (@), la galería de imágenes
//    con selección múltiple, las diapositivas anidadas y la edición rápida al presentar.
//    Un atajo que se lista y no anda se lee como un editor roto: si el motor del editor
//    (extensiones/*, EditorLanding.tsx) no ata alguno de éstos, se saca de acá. Verificado en la
//    integración (11/10/2026): todos atados — Mod+K por `registrarAbrirEnlace` (BarraFormato),
//    Mod+Enter en captura (EditorLanding: el HardBreak de StarterKit también la escuchaba).
// ⚠️ `Mod` es ⌘ en Mac y Ctrl en el resto, como lo escribe Gamma.
// =============================================================================

import { useMemo } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { useEditorLanding } from '../contexto';
import { EstilosPanelesB } from '../paneles/PanelAgente';

/** Una tecla por elemento; varias combinaciones alternativas, separadas. `Mod` se traduce. */
export type Atajo = { accion: string; teclas: string[][] };
export type GrupoAtajos = { titulo: string; atajos: Atajo[] };

export const ATAJOS: GrupoAtajos[] = [
  {
    titulo: 'Texto y formato',
    atajos: [
      { accion: 'Encabezado 1 / 2 / 3 / 4', teclas: [['Mod', 'Alt', '1'], ['Mod', 'Alt', '2'], ['Mod', 'Alt', '3'], ['Mod', 'Alt', '4']] },
      { accion: 'Texto normal', teclas: [['Mod', 'Alt', '0']] },
      { accion: 'Negrita', teclas: [['Mod', 'B']] },
      { accion: 'Cursiva', teclas: [['Mod', 'I']] },
      { accion: 'Subrayar', teclas: [['Mod', 'U']] },
      { accion: 'Tachado', teclas: [['Mod', 'Shift', 'X']] },
      { accion: 'Enlace', teclas: [['Mod', 'K']] },
      { accion: 'Resaltar texto', teclas: [['Mod', 'Shift', 'H']] },
      { accion: 'Alinear a la izquierda', teclas: [['Mod', 'Shift', 'L']] },
      { accion: 'Alinear al centro', teclas: [['Mod', 'Shift', 'E']] },
      { accion: 'Alinear a la derecha', teclas: [['Mod', 'Shift', 'R']] },
      { accion: 'Lista numerada', teclas: [['Mod', 'Shift', '7']] },
      { accion: 'Lista con viñetas', teclas: [['Mod', 'Shift', '8']] },
      { accion: 'Lista de tareas pendientes', teclas: [['Mod', 'Shift', '9']] },
      { accion: 'Editar con IA', teclas: [['Mod', 'E']] },
      { accion: 'Deshacer', teclas: [['Mod', 'Z']] },
      { accion: 'Rehacer', teclas: [['Mod', 'Shift', 'Z'], ['Mod', 'Y']] },
      { accion: 'Copiar / Cortar / Pegar', teclas: [['Mod', 'C'], ['Mod', 'X'], ['Mod', 'V']] },
      { accion: 'Abrir menú de comandos', teclas: [['/']] },
      // «---» en una línea suelta PARTE la sección (extensiones/plugins.ts, PartirConGuiones); la
      // línea divisoria de Gamma sale del «/» («Separador»). Se lista lo que hace de verdad.
      { accion: 'Dividir sección', teclas: [['-', '-', '-']] },
      { accion: 'Atajos de Markdown', teclas: [['#'], ['##'], ['###'], ['-'], ['1.'], ['[]'], ['>']] },
    ],
  },
  {
    titulo: 'Documento',
    atajos: [
      { accion: 'Activar modo presentación', teclas: [['Mod', 'Enter']] },
      { accion: 'Eliminar sección (en la tira)', teclas: [['Supr'], ['Retroceso']] },
    ],
  },
  {
    titulo: 'Modo presentación',
    atajos: [
      { accion: 'Sección anterior / siguiente', teclas: [['←'], ['→']] },
      { accion: 'Siguiente sección', teclas: [['Espacio']] },
      { accion: 'Destacar encendido/apagado', teclas: [['S']] },
      { accion: 'Notas del orador', teclas: [['N']] },
      { accion: 'Reiniciar presentación', teclas: [['R']] },
      { accion: 'Salir del modo presentación', teclas: [['Esc']] },
    ],
  },
];

function esMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const plataforma = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.userAgent;
  return /mac|iphone|ipad/i.test(plataforma);
}

/** Cómo se escribe una tecla en esta compu. */
export function nombreTecla(t: string, mac: boolean): string {
  if (t === 'Mod') return mac ? '⌘' : 'Ctrl';
  if (t === 'Alt') return mac ? '⌥' : 'Alt';
  if (t === 'Shift') return mac ? '⇧' : 'Shift';
  if (t === 'Enter') return mac ? '↩' : 'Enter';
  return t;
}

export function DialogoAtajos({ onCerrar }: { onCerrar?: () => void } = {}) {
  const { setDialogo } = useEditorLanding();
  const cerrar = useCerrarEstable(onCerrar ?? (() => setDialogo(null)));
  const mac = useMemo(() => esMac(), []);

  return (
    <Modal titulo="Atajos de teclado" onCerrar={cerrar} ancho={680}>
      <EstilosPanelesB />
      <style href="gma-atajos" precedence="medium">{CSS_ATAJOS}</style>
      <div className="gma gma-pb gma-at">
        {ATAJOS.map((g) => (
          <section key={g.titulo} className="gma-at-grupo">
            <h3 className="gma-at-h">{g.titulo}</h3>
            <dl className="gma-at-lista">
              {g.atajos.map((a) => (
                <div key={a.accion} className="gma-at-fila">
                  <dt>{a.accion}</dt>
                  <dd>
                    {a.teclas.map((combo, i) => (
                      <span key={i} className="gma-at-combo">
                        {i > 0 && <span className="gma-at-o">/</span>}
                        {combo.map((t, j) => <kbd key={j}>{nombreTecla(t, mac)}</kbd>)}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}

export default DialogoAtajos;

const CSS_ATAJOS = `
.gma-at{display:grid;gap:20px}
.gma-at-grupo{display:grid;gap:6px}
.gma-at-h{margin:0;font-size:12.5px;font-weight:700;color:var(--pb-suave)}
.gma-at-lista{display:grid;margin:0}
.gma-at-fila{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;padding:4px 0;border-bottom:1px solid var(--pb-sup2)}
.gma-at-fila:last-child{border-bottom:0}
.gma-at-fila dt{font-size:13.5px;color:var(--pb-texto)}
.gma-at-fila dd{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;margin:0}
.gma-at-combo{display:inline-flex;align-items:center;gap:3px}
.gma-at-o{margin:0 3px;color:var(--pb-suave);font-size:12px}
.gma-at kbd{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:5px;background:var(--pb-sup);box-shadow:inset 0 -1px 0 var(--pb-borde),0 0 0 1px var(--pb-borde);color:var(--pb-texto);font:inherit;font-size:12px;font-weight:600}
`;
