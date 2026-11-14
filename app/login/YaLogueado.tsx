'use client';

// =============================================================================
// YaLogueado — lo que ve alguien que abre /login con la sesión ya abierta
// =============================================================================
// Antes /login le mostraba "Entrá al dashboard" y el botón de Google a alguien que
// YA estaba adentro: parecía que se había deslogueado. Ahora se le avisa quién es
// y se lo lleva solo.
//
// El destino es /inicio, el repartidor (onboarding pendiente → /onboarding; en la
// computadora, el resto al Ops Center desde el 21/10/2026: lib/ops-center-ruta.ts).
// No se duplica esa lógica acá: si mañana cambia, cambia en un solo lugar.
//
// ⚠️ EL BOTÓN ERA ILEGIBLE EN OSCURO, y es el bug que justifica usar el primitive.
// Tenía `background: var(--primary)` (un token, que se da vuelta) con
// `color: '#fff'` CLAVADO: en oscuro `--primary` vale #ededeb, o sea blanco sobre
// casi-blanco — ratio 1,06:1, el texto desaparecía. Y se ve justo acá: el tema
// oscuro sólo se aplica CON sesión (`{sesion && <ModoArranque/>}` en app/layout.tsx),
// y esta es la única pantalla de /login que se dibuja con sesión. `Button` ya
// resuelve la tinta por tema (`[data-tema="oscuro"] .mk-btn--primary` en
// app/_ui/ui.css): un color que EXISTE PARA un fondo se declara al lado de ese
// fondo, no en la pantalla que lo usa.

import { useEffect, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { EncabezadoLogin } from './_ui/TarjetaLogin';

const DESTINO = '/inicio';
const ESPERA_MS = 1200; // suficiente para leer el aviso, poco para no estorbar

export function YaLogueado({ nombre, email }: { nombre: string; email: string }) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    // Si tocó "entrar con otra cuenta", NO lo arrastremos al tablero.
    if (saliendo) return;
    const t = setTimeout(() => { setYendo(true); router.replace(DESTINO); }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [router, saliendo]);

  const quien = nombre?.trim() || email;

  return (
    <>
      <EncabezadoLogin
        titulo="Ya tienes la sesión abierta"
        sub={<>Entraste como <strong>{quien}</strong>. <span role="status">{yendo ? 'Entrando…' : 'Te llevamos a tu tablero.'}</span></>}
      />
      <div className="lg-cuerpo">
        <Button variant="primary" size="lg" full onClick={() => { setYendo(true); router.replace(DESTINO); }}>
          Ir a mi tablero
        </Button>
        {/* Salida para el caso real de "quiero entrar con otra cuenta". Sin esto, alguien
            con la sesión abierta no tendría forma de llegar al botón de Google.
            Ojo: /api/auth/logout devuelve JSON, no redirige — si esto fuera un <form>
            nativo el usuario terminaría mirando {"ok":true}. Se navega a mano, igual
            que el botón de cerrar sesión del sidebar. */}
        <Button
          variant="tertiary"
          full
          loading={saliendo}
          onClick={async () => {
            setSaliendo(true);
            try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* igual salimos */ }
            // location, no router: hay que releer la cookie borrada desde el server.
            window.location.href = '/login';
          }}
        >
          {saliendo ? 'Cerrando sesión…' : 'Entrar con otra cuenta'}
        </Button>
      </div>
    </>
  );
}
