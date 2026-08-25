// =============================================================================
// /api/og — la IMAGEN de la tarjeta, distinta por tipo de link
// =============================================================================
// El título y la descripción ya los cambia `generateMetadata` del login, pero en
// WhatsApp lo que se ve de lejos es la IMAGEN: con la misma foto para todo, dos
// mensajes distintos siguen pareciendo el mismo. El dueño lo dijo así: «son todos
// iguales y confunde».
//
// Se genera al vuelo en vez de subir doce archivos: el catálogo de tipos vive en
// lib/preview-links.ts y agregar uno nuevo no tiene que obligar a abrir un editor
// de imágenes. Es la misma razón por la que el texto sale de un catálogo.
//
// PÚBLICA a propósito, y por eso NO recibe ningún dato: solo el `tipo`, que es una
// clave de un conjunto CERRADO. Quien resuelve un OpenGraph es un servidor de
// WhatsApp sin sesión — cualquier cosa que esta ruta pudiera leer de la base sería
// una filtración con forma de miniatura. Un `tipo` desconocido cae al default.
// =============================================================================

import { ImageResponse } from 'next/og';
import { PREVIEW_DEFAULT, previewDeTipo, type PreviewLink } from '@/lib/preview-links';


export const runtime = 'edge';

// Los colores de la marca, literales: esta ruta corre en edge y no puede leer el
// CSS de la app. Si el rebrand los cambia, se cambian acá también — está anotado
// en docs/hallazgos-comunicacion.md.
const TINTA = '#14161B';
const CREMA = '#F3F0E7';
const DORADO = '#facc15';

export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get('tipo') ?? '';
  const p: PreviewLink = previewDeTipo(tipo) ?? PREVIEW_DEFAULT;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: TINTA, padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* ⚠️ LA ESTRELLA VA COMO VECTOR, NO COMO GLIFO. Con el carácter `✦`
              (U+2726) la primera versión salió con un CUADRITO: la fuente por
              defecto del renderer de edge no lo tiene, y un tofu en el logo de la
              marca es peor que no poner logo. Es el mismo path que
              lib/mako-grupo.ts usa para la foto del grupo. */}
          <svg width="56" height="56" viewBox="-16 -16 32 32" style={{ borderRadius: 14, background: DORADO }}>
            <path
              d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z"
              fill={TINTA}
            />
          </svg>
          <div style={{ fontSize: 30, color: DORADO, fontWeight: 700, letterSpacing: 1 }}>MaKo</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 92, marginBottom: 18 }}>{p.icono}</div>
          <div style={{ fontSize: 68, color: CREMA, fontWeight: 800, lineHeight: 1.1 }}>{p.titulo}</div>
          <div style={{ fontSize: 32, color: '#9AA3AF', marginTop: 18, lineHeight: 1.35, maxWidth: 900 }}>
            {p.descripcion}
          </div>
        </div>

        <div style={{ display: 'flex', height: 8, background: DORADO, borderRadius: 4, width: 160 }} />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
