'use client';

// =============================================================================
// CampoCodigo — el campo donde se escribe un código de 6 dígitos (o uno de recuperación)
// =============================================================================
// Pedido de Martín (14/10/2026), para el alta y para entrar:
//   1. «que detecte lo que tiene copiado»: lo primero es `autocomplete="one-time-code"` +
//      `inputmode="numeric"`, que ya hacen que iOS y Android ofrezcan el código; después, pegar un
//      texto con el código adentro lo extrae (`extraerCodigo`); y al volver a la pestaña (de la app
//      de autenticación) se lee el portapapeles SÓLO si el navegador ya dio el permiso: nunca se
//      pide de golpe (es un cartel feo). El permiso se pide recién con el gesto de «Pegar».
//   2. «si es correcto que ya avance»: con los 6 dígitos, se manda solo.
//
// ⚠️ Avanzar solo NO ablanda el freno de fuerza bruta: se manda UNA vez por cada código distinto
// de 6 dígitos (nunca por tecla), y cada envío lo cuenta el server igual que un clic (`intentar`).
// ⚠️ Un error no borra lo tipeado: el código queda a la vista con el error al lado, seleccionado,
// así la próxima tecla lo reemplaza. Y el mismo código malo no se vuelve a mandar solo.
// Los códigos de recuperación (largo 11) no avanzan solos: se escriben a mano y se confirman.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { extraerCodigo } from '@/lib/mfa-texto';

type Props = {
  valor: string;
  onCambio: (v: string) => void;
  /** Se llama solo cuando hay 6 dígitos nuevos; también con Enter. */
  onCompleto: () => void;
  ocupado: boolean;
  /** El error del último intento: al cambiar, se selecciona lo tipeado. */
  error: string | null;
  estilo: CSSProperties;
  /** 6 = código de la app o mandado; 11 = código de recuperación (xxxxx-xxxxx). */
  largo?: 6 | 11;
};

export function CampoCodigo({ valor, onCambio, onCompleto, ocupado, error, estilo, largo = 6 }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const enviado = useRef<string | null>(null);
  const leidoDelPortapapeles = useRef<string | null>(null);
  const corto = largo === 6;
  // «Pegar» sólo donde el navegador sabe leer el portapapeles. Se decide después de montar: en el
  // server no hay `navigator`, y decidirlo al dibujar daría un HTML distinto del de la hidratación.
  const [puedePegar, setPuedePegar] = useState(false);
  useEffect(() => { setPuedePegar(!!navigator.clipboard?.readText); }, []);

  // 2. Avanzar solo: una vez por código distinto, y nunca mientras hay un pedido en vuelo.
  useEffect(() => {
    if (!corto || ocupado || valor.length !== 6 || enviado.current === valor) return;
    enviado.current = valor;
    onCompleto();
  }, [corto, ocupado, valor, onCompleto]);

  // Un error deja el código a la vista y seleccionado: no se borra en silencio.
  useEffect(() => {
    if (error) ref.current?.select();
  }, [error]);

  // 1. Al volver a esta pestaña, el código copiado — sólo con el permiso ya dado.
  useEffect(() => {
    if (!corto) return;
    const leer = async () => {
      if (valor || document.visibilityState !== 'visible') return;
      try {
        const permiso = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
        if (permiso?.state !== 'granted') return;
        const c = extraerCodigo(await navigator.clipboard.readText());
        if (c && c !== leidoDelPortapapeles.current) { leidoDelPortapapeles.current = c; onCambio(c); }
      } catch { /* sin permiso o sin API: queda el autocompletado del sistema y pegar */ }
    };
    void leer();
    window.addEventListener('focus', leer);
    document.addEventListener('visibilitychange', leer);
    return () => { window.removeEventListener('focus', leer); document.removeEventListener('visibilitychange', leer); };
  }, [corto, valor, onCambio]);

  const pegar = async () => {
    try {
      const c = extraerCodigo(await navigator.clipboard.readText());
      if (c) { leidoDelPortapapeles.current = c; onCambio(c); } else ref.current?.focus();
    } catch { ref.current?.focus(); }
  };

  return (
    <div>
      <input
        ref={ref} value={valor} autoFocus inputMode={corto ? 'numeric' : 'text'} autoComplete="one-time-code"
        maxLength={corto ? 6 : 11} placeholder={corto ? '000000' : 'xxxxx-xxxxx'} aria-label="Código"
        onChange={(e) => onCambio(corto ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
        onPaste={(e) => {
          if (!corto) return;
          const c = extraerCodigo(e.clipboardData.getData('text'));
          if (c) { e.preventDefault(); onCambio(c); }
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && valor && !ocupado) { enviado.current = valor; onCompleto(); } }}
        style={estilo}
      />
      {corto && puedePegar && (
        <div style={{ textAlign: 'right', marginTop: '6px' }}>
          <button type="button" onClick={() => void pegar()} disabled={ocupado}
            style={{ background: 'none', border: 'none', padding: 0, color: '#2F6FED', fontSize: '13px', cursor: 'pointer' }}>
            Pegar
          </button>
        </div>
      )}
    </div>
  );
}
