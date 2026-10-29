// =============================================================================
// /ai-avatar — el estudio de Higgsfield: proyectos, presets y la barra de prompt
// =============================================================================
// 29/10/2026, Martín: «Lo mismo para AI Avatar... replica a higgsfield tal cual». Una sola pantalla, con el diseño
// único de Create (app/_crear/PantallaCrear.tsx: el chat de MaKo fijo a la izquierda, los proyectos con su «←» y «Nuevo
// avatar» con los presets bajo «¿Qué vas a crear hoy?»), sin tabs internas y sin onboarding: la tab ES la herramienta y su vacío ES «Nueva». La pantalla
// y lo que copia de Higgsfield: ./Estudio.tsx. Las rutas de las cuatro secciones de HeyGen (17/10) redirigen acá.
// Hoy la ve sólo el super admin (./acceso.ts).
//
// La query: `?plantilla=<preset>` abre «Nueva» con ese preset elegido; `?avatar=<proyecto o mediaId>` abre ese proyecto.

import './estudio.css';
import { requireAiAvatar } from './acceso';
import { Pagina } from '@/app/_ui';
import { ErrorState } from '@/app/_ui/Estados';
import { EstudioAvatar } from './Estudio';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/PantallaCrear';
import { inicioAvatarAction } from './actions';
import { FranjaPrueba } from '@/app/_ui/FranjaPrueba';

export const dynamic = 'force-dynamic';

export default async function AiAvatarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAiAvatar();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 120) : undefined);
  const inicio = await inicioAvatarAction();
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      {/* Las tres cosas con tope que se hacen acá: el look (imagen), el video con avatar y sus tomas. */}
      <FranjaPrueba cosas={['prueba.imagenes', 'prueba.avatares', 'prueba.tomas']} />
      {inicio.ok
        ? <EstudioAvatar inicio={inicio} plantillaInicial={uno(sp.plantilla)} avatarInicial={uno(sp.avatar)} ahora={Date.now()} />
        : <ErrorState titulo="No se pudo abrir AI Avatar" detalle={inicio.error} />}
    </Pagina>
  );
}
