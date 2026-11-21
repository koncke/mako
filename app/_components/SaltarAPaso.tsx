'use client';
// =============================================================================
// «IR A UN PASO»: el desplegable de la revisión en la barra del administrador (20/11/2026)
// =============================================================================
// Martín: «viste que hay un desplegable en el artefacto que me deja ir avanzando o retrocediendo. Si no, cada vez que quiero ver algo
// que ya pasó, tengo que resetear todo». Cada paso del onboarding V2, la llegada al Ops Center y los días del reto: elegir uno deja el
// negocio ahí con el estado REAL (/api/admin/saltar-onboarding → lib/onboarding-v2/saltar-server.ts), limpia este navegador como
// «Reiniciar onboarding» y, en el reto, anota como vistos los videos de los días de antes. Después, navegación COMPLETA.
// SÓLO si el server dice que sí (alguien de MaKo en un negocio de prueba, el 3 o el 9): si no, no se dibuja. Nunca a un cliente.
// =============================================================================
import { useEffect, useState, type CSSProperties } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { limpiarClavesDelOnboarding } from '@/lib/reinicio-en-el-navegador';
import type { PASOS_DE_REVISION, SaltoPendiente } from '@/lib/onboarding-v2/saltar';
import { anotarSalto } from '@/lib/onboarding-v2/salto-pendiente';
import { AvisoFlotante } from './AvisoFlotante';
import { cerrarTutorial, usePasoDelMotor, useSenal } from '@/app/_ui/tutorial/store';
import { usePathname } from 'next/navigation';

const MONO = "'Geist Mono', monospace";
const caja: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', maxWidth: 220,
};
type Paso = (typeof PASOS_DE_REVISION)[number];

export function SaltarAPaso() {
  const ws = useWs();
  const [pasos, setPasos] = useState<readonly Paso[] | null>(null);
  const [puede, setPuede] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // EL PASO EN EL QUE ESTÁ (21/11/2026, Martín: «debería ir avanzando automáticamente… si no, me pierdo»): el del estado guardado lo
  // dice el server (se pregunta al cambiar de pantalla y cada 5 s, con la pestaña a la vista); el del recorrido, el motor.
  const [actual, setActual] = useState<string | null>(null);
  const ruta = usePathname();
  useEffect(() => {
    let vivo = true;
    const pedir = () => {
      if (document.hidden) return;
      fetch(conWs('/api/admin/saltar-onboarding', ws), { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { puede?: boolean; pasos?: readonly Paso[]; actual?: string | null } | null) => { if (vivo && j?.puede && j.pasos) { setPasos(j.pasos); setPuede(true); setActual(j.actual ?? null); } })
        .catch(() => { /* sin el sí del server, no se dibuja */ });
    };
    pedir();
    const t = window.setInterval(pedir, 5000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [ws, ruta]);
  const senal = useSenal();
  const pasoMotor = usePasoDelMotor();
  const delRecorrido = senal?.tipo === 'tutorial' && senal.tutorial.pestana === 'recorrido' && pasoMotor != null && pasoMotor >= 0 ? `recorrido-${pasoMotor + 1}` : null;
  const valor = delRecorrido ?? actual ?? '';
  if (!puede) return null;
  const ir = async (paso: string) => {
    if (!paso || yendo) return;
    setYendo(true);
    try {
      const r = await fetch(conWs('/api/admin/saltar-onboarding', ws), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paso }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; destino?: string; vistos?: string[]; salto?: SaltoPendiente | null; avisos?: string[] } | null;
      if (!r.ok || !j?.ok || !j.destino) throw new Error(j?.error || 'No pude ir a ese paso.');
      // EL RECORRIDO ENTERO DE NUEVO (21/11/2026, Martín: en su captura quedó el «Hola de nuevo» en la esquina, en el día 1). Lo visto de
      // los tutoriales y de la llegada ya lo borró el server (saltar-server.ts → «Reiniciar onboarding»); acá, el tutorial o el video que
      // estuviera corriendo o flotando, y lo que guarda ESTE navegador.
      cerrarTutorial();
      try {
        limpiarClavesDelOnboarding([window.localStorage, window.sessionStorage]);
        for (const k of j.vistos ?? []) window.localStorage.setItem(k, new Date().toISOString());
        // La marca exacta (21/11): el recorrido desde su paso o la tarea desde su marca, la toma la pantalla a la que se va.
        anotarSalto(j.salto);
      } catch { /* sin almacenamiento: el paso queda igual en el server */ }
      // Lo que el server no pudo dejar listo (el recorrido sin ver, sin dueño) se dice, no se traga: se lee antes de ir.
      if (j.avisos?.length) { setAviso(`Fui al paso, con avisos: ${j.avisos.join(' · ')}`); await new Promise((ok) => setTimeout(ok, 3500)); }
      window.location.assign(conWs(j.destino, ws));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
      setYendo(false);
    }
  };
  return (
    <>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ir a un paso del onboarding o del reto</span>
        <select value={valor} disabled={yendo} onChange={(e) => void ir(e.target.value)} style={caja} aria-label="Ir a un paso del onboarding o del reto">
          <option value="" style={{ color: '#171511' }}>{yendo ? 'Yendo…' : 'Ir a un paso'}</option>
          {[...new Set((pasos ?? []).map((p) => p.grupo))].map((g) => (
            <optgroup key={g} label={g} style={{ color: '#171511' }}>
              {(pasos ?? []).filter((p) => p.grupo === g).map((p) => <option key={p.id} value={p.id} style={{ color: '#171511' }}>{p.rotulo}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {aviso && <AvisoFlotante mensaje={aviso} tono="error" onCerrar={() => setAviso(null)} />}
    </>
  );
}
