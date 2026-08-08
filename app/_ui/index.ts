// =============================================================================
// app/_ui — la biblioteca de primitives de MaKo
// =============================================================================
// Punto de entrada único:  import { Button, TextField, EmptyState } from '@/app/_ui';
//
// OJO desde un Server Component: casi todo acá es 'use client'. Si solo
// necesitás la escala (colores, radios, tipografía), importá directo de
// './tokens', que no arrastra nada del cliente.
//
// Lo que hay y para qué está, en app/_ui/LEEME.md.

export { Button, ButtonLink, IconButton, useOkFlash, type ButtonVariant, type ButtonSize, type ButtonProps } from './Button';
export { Field, Input, Textarea, TextField } from './Field';
export { Select, type SelectOption, type SelectGroup } from './Select';
export { Checkbox, Radio, RadioGroup, Switch } from './Toggle';
export { Badge, Tag, Status } from './Badge';
export { Spinner, Progress, Skeleton, SkeletonLines, Divider } from './Feedback';
export { Tooltip } from './Tooltip';
export { Avatar } from './Avatar';
export { EmptyState, NoResults, ErrorState, StaleData, PermissionState, Banner, Alert } from './Estados';
export { Mako, type MakoProps, type DatoMako } from './Mako';
export { Confirm, useConfirm } from './Confirm';
export { Toast, useToast, type ToastState } from './Toast';
export { Pagina, Lectura } from './Pagina';
export { PageHeader, Section, Eyebrow } from './PageHeader';
export { Tabs, type Tab } from './Tabs';
export { SANS, MONO, radius, space, type, weight, shadow, TOUCH, FOCUS, EASE, TONO, type Tono } from './tokens';
