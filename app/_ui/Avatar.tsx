'use client';

// =============================================================================
// Avatar — foto de persona, o sus iniciales
// =============================================================================
// La caída a iniciales no es un adorno: la mayoría de los leads y de los
// miembros del equipo no tienen foto, así que el caso «sin foto» es el normal,
// no la excepción. Sin esto cada pantalla dibuja su propio círculo gris.

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ name, url, size = 32, cuadrado = false, color }: {
  name: string;
  url?: string | null;
  size?: number;
  /** Esquinas suaves en vez de círculo: banderas, logos, capturas. */
  cuadrado?: boolean;
  /** Fondo de las iniciales. Por defecto azul (identidad, no estado). */
  color?: string;
}) {
  const radio = cuadrado ? Math.round(size * 0.28) : '50%';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} width={size} height={size} referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: radio, objectFit: 'cover', flex: 'none', display: 'block' }} />
    );
  }
  return (
    <span aria-hidden title={name} style={{
      width: size, height: size, borderRadius: radio, flex: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: color ?? 'var(--primary)', color: '#fff',
      fontSize: Math.round(size * 0.4), fontWeight: 700, lineHeight: 1,
    }}>
      {iniciales(name)}
    </span>
  );
}
