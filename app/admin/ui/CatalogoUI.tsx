'use client';

// =============================================================================
// CatalogoUI — todas las piezas del sistema, con todos sus estados
// =============================================================================
// Regla de este archivo: NO se escribe un solo estilo que no salga de los
// tokens. Es la prueba de que una pantalla nueva se puede armar sin inventar
// nada — que es exactamente el criterio de «listo» de la tarea #516.

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import {
  Button, ButtonLink, IconButton, useOkFlash,
  TextField,
  Select, Checkbox, RadioGroup, Switch,
  Badge, Tag, Status, Tooltip, Avatar,
  Spinner, Progress, Skeleton, SkeletonLines, Divider,
  EmptyState, NoResults, ErrorState, StaleData, PermissionState, Banner, Alert,
  Confirm, useConfirm, Toast, useToast,
  PageHeader, Section, Pagina, Tabs, type Tab,
  MONO, type Tono,
} from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { MakoStar } from '@/app/_components/MakoBrand';
import { Roadmap, ChangeHistory } from '@/app/admin/dev/_registro/Registro';
import { BITACORA, PARTES } from './bitacora';
import { LaSidebar, LosIconos } from './Barra';
import { LaMarca } from './Marca';
import { LaGramatica } from './Gramatica';
import { LosTemas } from './Temas';

const TONOS: Tono[] = ['mako', 'info', 'good', 'warn', 'bad', 'neutral'];

/**
 * Las vistas de esta pantalla. Son hermanas de verdad —ninguna es el detalle de
 * otra—, que es la condición para que sean tabs y no navegación.
 */
const TABS: Tab[] = [
  // La `id` sigue siendo 'rediseno' aunque el label cambió: está escrita en la
  // URL (?tab=) y en links ya mandados. Se renombra el label, no la clave.
  { id: 'rediseno', label: 'Roadmap' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'iconos', label: 'Íconos' },
  { id: 'marca', label: 'Marca' },
  // El rebrand se decide probando el tema sobre la app REAL, no sobre una
  // maqueta: por eso es una tab y no un documento.
  { id: 'temas', label: 'Temas' },
  { id: 'fundamentos', label: 'Fundamentos' },
  { id: 'piezas', label: 'Piezas' },
  // Los estados de PANTALLA (#519: vacío, error, sin permiso) y los estados de
  // la INTELIGENCIA (#520) son cosas distintas y van separados a propósito: el
  // primero dice qué le pasa a la vista, el segundo qué está haciendo MaKo.
  { id: 'estados', label: 'Estados' },
  { id: 'mako', label: 'Gramática de MaKo' },
];

/** Envoltorio local: la Section del sistema, siempre con tarjeta. */
function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return <Section titulo={titulo} nota={nota} card>{children}</Section>;
}

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr)', gap: 16, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
      <div className="mk-row">{children}</div>
    </div>
  );
}

/** Los siete niveles del §18.3, con su tamaño real leído del token. */
const ESCALA: { token: string; uso: string; desktop: string; mobile: string }[] = [
  { token: '--fs-page', uso: 'Título de página', desktop: '30', mobile: '26' },
  { token: '--fs-kpi', uso: 'KPI principal', desktop: '34', mobile: '30' },
  { token: '--fs-sect', uso: 'Título de sección', desktop: '21', mobile: '20' },
  { token: '--fs-card', uso: 'Título de tarjeta', desktop: '15.5', mobile: '16.5' },
  { token: '--fs-md', uso: 'Texto base', desktop: '14', mobile: '16' },
  { token: '--fs-sm', uso: 'Texto secundario', desktop: '13', mobile: '14.5' },
  { token: '--fs-meta', uso: 'Metadata', desktop: '12', mobile: '13' },
];

export function CatalogoUI({ tabInicial }: { tabInicial?: string }) {
  const [texto, setTexto] = useState('');
  const [conError, setConError] = useState('sin-arroba');
  const [sel, setSel] = useState('crm');
  const [check, setCheck] = useState(true);
  const [radio, setRadio] = useState('b');
  const [sw, setSw] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const { ok, flash } = useOkFlash();
  const { confirm, confirmNode } = useConfirm();
  const { toast, show, clear } = useToast();

  // La tab también viaja en la URL, para poder mandar el link a una sección
  // concreta ("mirá /admin/ui?tab=barra") en vez de decir "y bajá hasta…".
  // El estado manda y la URL lo acompaña —no al revés—: así la primera pintura
  // ya sale del servidor con la tab correcta.
  const router = useRouter();
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === tabInicial) ? tabInicial! : 'rediseno'));
  const irA = (id: string) => {
    setTab(id);
    router.replace(id === 'rediseno' ? '/admin/ui' : `/admin/ui?tab=${id}`, { scroll: false });
  };

  return (
    <Pagina>
      <PageHeader
        titulo="MaKo UX/UI"
        estado={<Status tono="mako">Fase 1</Status>}
        accion={<ButtonLink href="/general" variant="secondary">Ver la app →</ButtonLink>}
      />

      <Tabs tabs={TABS} activa={tab} onCambio={irA} />

      {tab === 'rediseno' && <><Roadmap partes={PARTES} /><ChangeHistory hitos={BITACORA} /></>}
      {tab === 'sidebar' && <LaSidebar />}
      {tab === 'iconos' && <LosIconos />}
      {tab === 'marca' && <LaMarca />}
      {tab === 'temas' && <LosTemas />}
      {tab === 'mako' && <LaGramatica />}

      {tab === 'fundamentos' && (<>
      {/* ── Tipografía ───────────────────────────────────────────────────── */}
      <Seccion titulo="Escala tipográfica" nota="suben solas en pantalla chica">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ESCALA.map((e) => (
            <div key={e.token} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'baseline', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: `var(${e.token})`, fontWeight: e.token === '--fs-page' || e.token === '--fs-kpi' ? 700 : 500, color: 'var(--ink)', letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.uso}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                {e.token} · {e.desktop} → {e.mobile}
              </span>
            </div>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.5 }}>
          No hay token por debajo de 12 px a propósito: el documento reserva el 10-11 para «información excepcionalmente
          secundaria», y hoy hay 2.392 de 3.815 <code style={{ fontFamily: MONO }}>fontSize</code> en línea por debajo de 14.
          Si existiera el token, se usaría.
        </p>
      </Seccion>

      {/* ── Color ────────────────────────────────────────────────────────── */}
      <Seccion titulo="Un significado por color">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
          {[
            { n: 'MaKo', v: '--mako', q: 'marca + intervino la IA' },
            { n: 'Acción', v: '--primary', q: 'vos actuás' },
            { n: 'Resultado', v: '--good', q: 'favorable o completado' },
            { n: 'Cuidado', v: '--warn-fill', q: 'atención · NO es dorado' },
            { n: 'Riesgo', v: '--bad', q: 'error o destrucción' },
            { n: 'Neutro', v: '--faint', q: 'sin carga semántica' },
          ].map((c) => (
            <div key={c.v} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <div style={{ height: 54, background: `var(${c.v})` }} />
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}>{c.n}</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', marginTop: 2 }}>{c.q}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{c.v}</div>
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      </>)}

      {tab === 'piezas' && (<>
      {/* ── Botones ──────────────────────────────────────────────────────── */}
      <Seccion titulo="Botones" nota="nunca dos primary compitiendo en la misma vista">
        <Fila label="Variantes">
          <Button>Primaria</Button>
          <Button variant="secondary">Secundaria</Button>
          <Button variant="tertiary">Terciaria</Button>
          <Button variant="danger">Destructiva</Button>
          <Button variant="mako" icon={<MakoStar size={14} color="#17140C" />}>Pedirle a MaKo</Button>
        </Fila>
        <Fila label="Tamaños">
          <Button size="sm">Chico</Button>
          <Button size="md">Medio</Button>
          <Button size="lg">Grande</Button>
        </Fila>
        <Fila label="Estados">
          <Button loading>Guardando</Button>
          <Button disabled>Deshabilitado</Button>
          <Button ok={ok} okLabel="✓ Guardado" onClick={flash}>Tocá para ver el éxito</Button>
        </Fila>
        <Fila label="Con ícono">
          <Button icon={<Icon name="check" size={16} />}>Confirmar</Button>
          <ButtonLink href="/admin/ui" variant="secondary" iconRight={<span>→</span>}>Enlace-botón</ButtonLink>
          <IconButton title="Buscar"><Icon name="search" size={18} /></IconButton>
          <IconButton title="Eliminar" danger><Icon name="trash" size={18} /></IconButton>
        </Fila>
      </Seccion>

      {/* ── Campos ───────────────────────────────────────────────────────── */}
      <Seccion titulo="Campos" nota="el error se dice con TEXTO, no solo con el borde rojo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, paddingTop: 4 }}>
          <TextField label="Nombre del negocio" placeholder="Ej.: Panadería del centro"
            value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={60}
            hint="Como querés que MaKo lo nombre en los mensajes." />
          <TextField label="Email de contacto" required error="Falta el arroba."
            value={conError} onChange={(e) => setConError(e.target.value)} />
          <TextField label="Presupuesto diario" prefix="$" suffix="USD" placeholder="0,00" value="" onChange={() => {}} />
          <TextField label="Deshabilitado" value="No se puede editar" onChange={() => {}} disabled />
          <Select label="Tab principal" value={sel} onChange={setSel}
            hint="Con más de 8 opciones aparece el buscador solo."
            options={[
              { value: 'crm', label: 'CRM', sub: 'leads y pipeline' },
              { value: 'plan', label: 'Plan', sub: 'tareas y proyectos' },
              { value: 'ads', label: 'Ads Manager', sub: 'campañas de Meta' },
            ]} />
          <TextField label="Nota" multiline placeholder="Escribí lo que MaKo tiene que saber…" value="" onChange={() => {}} />
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 8 }}>
          <Checkbox checked={check} onChange={setCheck} label="Avisarme por WhatsApp" hint="Solo lo urgente." />
          <Switch checked={sw} onChange={setSw} label="Secuencias activas" hint="Se aplica al instante." />
          <RadioGroup label="Canal" value={radio} onChange={setRadio}
            options={[{ value: 'a', label: 'Oficial' }, { value: 'b', label: 'No oficial' }]} />
        </div>
      </Seccion>

      {/* ── Señalización ─────────────────────────────────────────────────── */}
      <Seccion titulo="Badge · Tag · Status" nota="tres cosas distintas: contador · categoría · estado">
        <Fila label="Badge">
          <Badge>3</Badge>
          <Badge tono="good">12</Badge>
          <Badge tono="mako">1</Badge>
          <Badge>{148}</Badge>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>si todo tiene badge, nada tiene badge</span>
        </Fila>
        <Fila label="Tag">
          <Tag>Sin categoría</Tag>
          <Tag color="#7C5CE0">Content Machine</Tag>
          <Tag color="#0E9AA7">Cliente: Leandro</Tag>
        </Fila>
        <Fila label="Status">
          {TONOS.map((t) => <Status key={t} tono={t}>{t}</Status>)}
        </Fila>
        <Fila label="Status sólido">
          <Status tono="bad" solido>Vencida</Status>
          <Status tono="mako" solido>MaKo detectó</Status>
        </Fila>
        <Fila label="Otros">
          <Avatar name="Mauricio Bustos" />
          <Avatar name="Leandro" size={40} />
          <Tooltip text="Costo por lead: gasto dividido leads del período."><span style={{ borderBottom: '1px dashed var(--faint)', cursor: 'help', fontSize: 'var(--fs-sm)' }}>CPL</span></Tooltip>
        </Fila>
      </Seccion>

      {/* ── Espera ───────────────────────────────────────────────────────── */}
      <Seccion titulo="Espera">
        <Fila label="Spinner"><Spinner /><span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>no sé cuánto falta</span></Fila>
        <Fila label="Progress">
          <div style={{ flex: 1, minWidth: 220 }}><Progress value={62} label="Onboarding" /></div>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>62% · sé el total</span>
        </Fila>
        <Fila label="Skeleton">
          <div style={{ flex: 1, minWidth: 220 }}><SkeletonLines lines={3} /></div>
          <Skeleton w={46} h={46} radius="var(--r-md)" />
        </Fila>
      </Seccion>

      </>)}

      {tab === 'estados' && (<>
      {/* ── Los estados que faltaban ─────────────────────────────────────── */}
      <Seccion titulo="Cintas: Banner y Alert">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <Banner tono="bad" accion={{ label: 'Reconectar', onClick: () => show('Reconectando…') }}>
            <strong>Meta se desconectó.</strong> Las campañas siguen corriendo, pero MaKo no ve los resultados desde ayer.
          </Banner>
          <Banner tono="mako" onCerrar={() => show('Aviso descartado.')}>
            MaKo detectó que el show rate cayó 18% esta semana y ya preparó un experimento.
          </Banner>
          <Alert tono="warn">Esta campaña está en pausa desde el martes.</Alert>
          <StaleData desde="6/8 a las 09:14" onActualizar={() => show('Actualizado.')} />
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.5 }}>
          <strong>Banner</strong> es de alcance global o de módulo y va arriba de todo. <strong>Alert</strong> va pegado a
          lo que afecta. Es el mismo componente: misma forma, distinto alcance.
        </p>
      </Seccion>

      <Seccion titulo="Estados de pantalla" nota="ninguna vista puede quedar en blanco sin decir qué pasó">
        <Divider style={{ margin: '0 0 18px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8 }}>
          <EmptyState titulo="Todavía no hay experimentos"
            detalle="Acá vas a ver qué probaste, qué aprendiste y qué conviene repetir. Empezá por el cuello de botella que detectó MaKo."
            accion={{ label: 'Crear el primero', onClick: () => show('Ejemplo del catálogo.') }} inline />
          <NoResults query="cliente que no existe" onLimpiar={() => show('Filtros limpios.')} inline />
          <ErrorState onReintentar={() => show('Reintentando…')} detalleTecnico="TypeError: fetch failed (ECONNREFUSED 127.0.0.1:54321)" inline />
          <PermissionState motivo="rol" que="el Ads Manager" inline />
          <PermissionState motivo="plan" que="Content Machine" accion={{ label: 'Ver planes', href: '/integraciones' }} inline />
        </div>
      </Seccion>

      {/* ── Confirmación y avisos ────────────────────────────────────────── */}
      <Seccion titulo="Confirmar y avisar" nota="una sola confirmación en toda la app">
        <Fila label="Confirmación">
          <Button variant="danger" onClick={() => setConfirmando(true)}>Eliminar campaña</Button>
          <Button variant="secondary" onClick={async () => { if (await confirm('¿Eliminar los 3 leads seleccionados?')) show('3 leads eliminados.', () => show('Restaurados.')); }}>
            Con promesa (reemplaza window.confirm)
          </Button>
        </Fila>
        <Fila label="Aviso">
          <Button variant="secondary" onClick={() => show('Guardado.')}>Toast simple</Button>
          <Button variant="secondary" onClick={() => show('Tarea archivada.', () => show('Restaurada.'))}>Con deshacer</Button>
        </Fila>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.5 }}>
          Un toast <strong>no sustituye un registro de actividad</strong> cuando la acción importa: si tiene que poder
          consultarse mañana, va al historial.
        </p>
      </Seccion>

      </>)}

      {confirmando && (
        <Confirm title="¿Eliminar la campaña «Frío · VSL · Julio»?"
          message="Se va a pausar en Meta y a borrar de MaKo. Los resultados históricos se conservan."
          confirmLabel="Eliminar" onConfirm={() => { setConfirmando(false); show('Campaña eliminada.', () => show('Restaurada.')); }}
          onCancel={() => setConfirmando(false)} />
      )}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
    </Pagina>
  );
}
