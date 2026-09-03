'use client';

// =============================================================================
// OnboardingCopyGen — la fábrica de creativos, ahora en la tab donde se usa
// =============================================================================
// Estos cinco pasos vivían en el onboarding GLOBAL: se le pedían a todo cliente
// nuevo, antes de dejarlo entrar a nada. Salieron de ahí (el porqué largo está en
// lib/capas.ts) y aterrizan acá, que es donde la matriz se convierte en guiones.
//
// ── LO QUE SE REUSA, Y POR QUÉ NO SE REESCRIBIÓ ────────────────────────────
//
// Las cinco vistas (`EntregableView`, `AvataresView`, `PersonaView`,
// `PersonalidadView`, `MatrizView`) se importan TAL CUAL desde app/onboarding/.
// Cada una es self-contained: habla con su propio endpoint, guarda sola, y avisa
// por `onListo` cuando tiene material suficiente. Copiarlas acá habría duplicado
// cinco pantallas grandes que ya funcionan y que el hub de /onboarding sigue
// mostrando para editarlas después.
//
// ⚠️ EL ORDEN ES EL ENCADENAMIENTO DE LA FÁBRICA, NO UNA PREFERENCIA DE LECTURA.
// entregable → avatares → persona → personalidad → angulos: cada uno alimenta al
// siguiente, y la matriz es el producto de los cuatro anteriores. Por eso `angulos`
// es el ensayo de esta tab (la única pantalla donde el cliente VE salir algo, hecho
// con lo que acaba de contestar) y por eso ninguno es opcional: una matriz sin
// avatares es una grilla vacía.
//
// ⚠️ Y ESTE ORDEN TIENE QUE DECIR LO MISMO QUE EL CATÁLOGO
// (lib/tab-onboarding-catalogo.ts → 'ads-writer'). `marcarPasoTab` valida contra el
// catálogo en el server: si las dos listas se desfasan, el paso 1 devuelve «antes
// falta completar X», que es el paso 2, y no hay forma de avanzar. Pasó el 02/09
// con un cliente delante, en el Video Generator.
//
// ── SIN SALIDA, A PROPÓSITO ────────────────────────────────────────────────
// A diferencia de Carousels o Reels, acá no hay «Lo configuro después»: sin la
// matriz esta tab no tiene NADA que mostrar (su vista principal ES la matriz), así
// que salir sería entregar una pantalla vacía. Es la misma decisión que ya tomó el
// Video Generator, y es la excepción que la skill `tab-onboarding` prevé.

import { useCallback, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { EntregableView } from '../onboarding/EntregableView';
import { AvataresView } from '../onboarding/AvataresView';
import { PersonaView } from '../onboarding/PersonaView';
import { PersonalidadView } from '../onboarding/PersonalidadView';
import { MatrizView } from '../onboarding/MatrizView';
import { marcarPasoCopyAction, type PasoCopyGen } from './onboarding-actions';

const PASOS = ['cg_entregable', 'cg_avatares', 'cg_persona', 'cg_personalidad', 'cg_angulos'] as const;
type Paso = (typeof PASOS)[number];

/** La pregunta de cada paso. Son las MISMAS que tenía el onboarding global: el
 *  cliente que ya las vio no tiene que aprender otro nombre para lo mismo. */
const PREGUNTA: Record<Paso, { pregunta: string; sub: string }> = {
  cg_entregable: {
    pregunta: 'Tu lead magnet',
    sub: 'Lo que entregas a cambio del contacto. Es la promesa concreta con la que empieza cada anuncio.',
  },
  cg_avatares: {
    pregunta: 'Tus avatares',
    sub: 'A quién le hablas. MaKo propone los subnichos con lo que ya sabe de tu negocio y tú los corriges.',
  },
  cg_persona: {
    pregunta: 'La cara de tu marca',
    sub: 'Quién aparece y cómo se lo describe. Sin esto los creativos salen de una marca sin cara.',
  },
  cg_personalidad: {
    pregunta: 'Tu personalidad',
    sub: 'Cómo hablas. Es lo que hace que un guion suene a ti y no a una plantilla.',
  },
  cg_angulos: {
    pregunta: 'Tu matriz de anuncios',
    sub: 'Avatar × razón para comprar. Cada celda es un ángulo, y de cada ángulo sale un guion.',
  },
};

export function OnboardingCopyGen({ alSalir }: { alSalir: () => void }) {
  const [paso, setPaso] = useState<Paso>('cg_entregable');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Un `listo` por paso. Cada vista lo reporta con su propio criterio (≥1 producto,
  // el quiz completo, la matriz generada), y el botón no se habilita sin eso — ni
  // para el super-admin. Pedido explícito de Martín cuando esto vivía en el wizard
  // global: «NO debería poder avanzar jamás si lo anterior no está listo».
  const [listo, setListo] = useState<Record<Paso, boolean>>({
    cg_entregable: false, cg_avatares: false, cg_persona: false, cg_personalidad: false, cg_angulos: false,
  });
  const marcarListo = useCallback((p: Paso) => (v: boolean) => setListo((s) => (s[p] === v ? s : { ...s, [p]: v })), []);

  const idx = PASOS.indexOf(paso);
  const enUltimo = idx === PASOS.length - 1;

  const cerrarPaso = async (): Promise<boolean> => {
    setError(null);
    setPending(true);
    try {
      const r = await marcarPasoCopyAction(paso as PasoCopyGen);
      if (!r.ok) { setError(r.error); return false; }
      return true;
    } finally { setPending(false); }
  };

  return (
    <WizardShell
      titulo="Copy Generator · Configuración"
      pasos={PASOS}
      pasoActual={paso}
      pregunta={PREGUNTA[paso].pregunta}
      sub={PREGUNTA[paso].sub}
      error={error}
      puedeAvanzar={listo[paso]}
      enUltimo={enUltimo}
      confirmLabel="Entrar al Copy Generator →"
      pending={pending}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => setPaso(PASOS[Math.max(0, idx - 1)])}
      onSiguiente={() => { void (async () => { if (await cerrarPaso()) setPaso(PASOS[idx + 1]); })(); }}
      onConfirmar={() => { void (async () => { if (await cerrarPaso()) alSalir(); })(); }}
      onClose={() => { /* sin salida: ver la cabecera */ }}
      bloqueante
      fullscreen
      embebido
      desnudo
      // La matriz es una GRILLA: a 720 px las celdas se leen como una columna de
      // texto y deja de poder compararse, que es lo único que la matriz ofrece.
      anchoCuerpo={paso === 'cg_angulos' ? 1040 : 720}
    >
      {paso === 'cg_entregable' && <EntregableView onListo={marcarListo('cg_entregable')} />}
      {paso === 'cg_avatares' && <AvataresView onListo={marcarListo('cg_avatares')} />}
      {paso === 'cg_persona' && <PersonaView onListo={marcarListo('cg_persona')} />}
      {paso === 'cg_personalidad' && <PersonalidadView onListo={marcarListo('cg_personalidad')} />}
      {paso === 'cg_angulos' && <MatrizView onListo={marcarListo('cg_angulos')} sinCabecera />}
    </WizardShell>
  );
}
