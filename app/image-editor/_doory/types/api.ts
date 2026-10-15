/** Types of the HTTP API (the serializers of the backend apps). Keep both in sync. */
import type { DoryDocument } from './document'

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string[] | string>
    /** Machine-readable codes per field (e.g. `password_too_common`). */
    field_codes?: Record<string, string[] | string>
    /** Seconds to wait before retrying (429 responses). */
    retry_after?: number
  }
}

/** A segmentation model the browser may download from this origin. */
export interface BackgroundRemovalModel {
  id: string
  name: string
  /** Same-origin URL; the file name carries the start of the hash, so it can be cached forever. */
  url: string
  bytes: number
  sha256: string
  input: { name: string; size: number; mean: [number, number, number]; std: [number, number, number]; rescale: 'max' | '255' }
  output: string
}

export interface AppConfig {
  google_client_id: string
  /** `background_removal` is absent on servers that predate it. */
  features: { stock_photos: boolean; server_pdf: boolean; google_login: boolean; email_verification: boolean; background_removal?: boolean; realtime?: boolean }
  limits: { max_upload_bytes: number; max_pages: number; max_document_bytes: number; realtime_max_participants?: number }
  /** Files the browser downloads at run time; absent on servers that predate it. */
  assets?: { background_removal_model: BackgroundRemovalModel | null }
}

export interface ApiUser {
  id: string
  email: string
  display_name: string
  name: string
  avatar_url: string | null
  is_email_verified: boolean
  has_password: boolean
  google_linked: boolean
  created_at: string
}

export interface DesignSummary {
  id: string
  title: string
  width: number
  height: number
  preset: string
  page_count: number
  thumbnail_url: string | null
  folder: string | null
  starred: boolean
  revision: number
  created_at: string
  updated_at: string
  trashed_at: string | null
}
export interface Design extends DesignSummary {
  document: DoryDocument
}
export interface DesignQuery {
  q?: string
  folder?: string | 'root'
  starred?: boolean
  trashed?: boolean
  ordering?: '-updated_at' | 'updated_at' | 'title' | '-title' | '-created_at'
  page?: number
  page_size?: number
}
export interface DesignCreateInput {
  title?: string
  width?: number
  height?: number
  preset?: string
  document?: DoryDocument
  folder?: string | null
  template?: string
}
export interface DesignPatchInput {
  title?: string
  document?: DoryDocument
  base_revision?: number
  folder?: string | null
  starred?: boolean
}
export type BulkAction = 'trash' | 'restore' | 'delete' | 'star' | 'unstar' | 'move'

export interface VersionSummary {
  id: string
  label: string
  is_auto: boolean
  page_count: number
  thumbnail_url: string | null
  created_at: string
}
export interface VersionDetail extends VersionSummary {
  document: DoryDocument
}

export interface FolderT {
  id: string
  name: string
  parent: string | null
  design_count: number
  created_at: string
}

export type AssetKind = 'image' | 'svg' | 'audio'
export interface Asset {
  id: string
  kind: AssetKind
  name: string
  url: string
  thumb_url: string
  width: number
  height: number
  size: number
  mime: string
  tags: string[]
  /** Credit for imported stock photos; null for the user's own uploads. */
  attribution: { provider: string; author: string; author_url: string; source_url: string } | null
  /** Length of an audio file when the container says (null for images and for audio that does not say). */
  duration_ms?: number | null
  created_at: string
}

export interface StockPhoto {
  id: string
  provider: string
  thumb_url: string
  preview_url: string
  width: number
  height: number
  author: string
  author_url: string
  source_url: string
}
export interface StockPage {
  configured: boolean
  provider: string
  total: number
  next_page: number | null
  results: StockPhoto[]
}

export interface BrandColor {
  id: string
  name: string
  hex: string
}
export interface BrandFont {
  role: 'heading' | 'subheading' | 'body'
  family: string
}
export interface BrandKit {
  id: string
  name: string
  is_default: boolean
  colors: BrandColor[]
  fonts: BrandFont[]
  logos: Asset[]
  created_at: string
  updated_at: string
}
export interface BrandKitInput {
  name: string
  is_default?: boolean
  colors: BrandColor[]
  fonts: BrandFont[]
  logo_ids: string[]
}

export interface TemplateCategory {
  id: string
  slug: string
  name: string
  icon: string
  template_count: number
  sort_order: number
}
export interface TemplateSummary {
  id: string
  slug: string
  title: string
  category: { id: string; slug: string; name: string } | null
  tags: string[]
  width: number
  height: number
  orientation: 'landscape' | 'portrait' | 'square'
  preset: string
  page_count: number
  thumbnail_url: string | null
  is_featured: boolean
  use_count: number
  created_at: string
}
export interface TemplateDetail extends TemplateSummary {
  description: string
  document: DoryDocument
}
export interface TemplateQuery {
  category?: string
  q?: string
  orientation?: 'landscape' | 'portrait' | 'square'
  preset?: string
  featured?: boolean
  ordering?: 'use_count' | '-use_count' | 'created_at' | '-created_at' | 'title' | '-title'
  page?: number
  page_size?: number
}

export type ElementKind = 'shape' | 'line' | 'icon' | 'sticker' | 'illustration' | 'frame' | 'graphic'
/** How an icon is drawn; blank where the distinction does not apply (shapes, charts, …). */
export type ElementStyle = '' | 'outline' | 'filled' | 'duotone' | 'colour'
export interface ElementPack {
  id: string
  slug: string
  name: string
  kind: ElementKind
  thumbnail_url: string | null
  element_count: number
  /** SPDX expression, e.g. `CC0-1.0` or `MIT`. */
  license: string
  /** The licence text; empty when the pack has none to point to. */
  license_url: string
  /** The copyright notice the licence asks to keep with the artwork; empty for CC0. Show it wherever the pack is credited. */
  attribution: string
  /** Where the artwork comes from; empty when unknown. */
  source_url: string
}
export interface ElementItem {
  id: string
  name: string
  kind: ElementKind
  style: ElementStyle
  pack: { id: string; slug: string; name: string }
  tags: string[]
  svg_url: string
  width: number
  height: number
  colors: string[]
  is_recolorable: boolean
}
export interface ElementQuery {
  pack?: string
  kind?: ElementKind
  style?: Exclude<ElementStyle, ''>
  q?: string
  /** With `q` the default is `relevance`; otherwise pack order. Prefix `-` to reverse (not for `relevance`). */
  ordering?: 'relevance' | 'name' | '-name' | 'created_at' | '-created_at' | 'sort_order' | '-sort_order'
  page?: number
  page_size?: number
}

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'
export interface FontVariant {
  weight: number
  style: 'normal' | 'italic'
  /** The Latin file. */
  url: string
  /** Per-script files (`subset` is e.g. "latin-ext", "cyrillic"). */
  subsets?: Array<{ subset: string; url: string }>
}
export interface FontFamily {
  id: string
  family: string
  category: FontCategory
  scripts: string[]
  is_variable: boolean
  is_user_font: boolean
  variants: FontVariant[]
  /** Rank: 1 is the most popular, 9999 means unranked. */
  popularity: number
  /** CSS `unicode-range` per subset, for `@font-face` declarations. */
  unicode_ranges?: Record<string, string>
}
export interface FontQuery {
  q?: string
  category?: FontCategory
  script?: string
  /** `popularity` (default), `family` or `created_at`; prefix `-` to reverse. */
  ordering?: 'popularity' | '-popularity' | 'family' | '-family' | 'created_at' | '-created_at'
  page?: number
  page_size?: number
}

export type ShareRole = 'view' | 'comment' | 'edit'
export interface ShareLink {
  id: string
  token: string
  role: ShareRole
  url: string
  is_active: boolean
  expires_at: string | null
  has_password: boolean
  created_at: string
}
export interface SharedDesign {
  /** The design's id, for its live room. */
  design_id: string
  role: ShareRole
  title: string
  width: number
  height: number
  revision: number
  owner: { name: string; avatar_url: string | null }
  document: DoryDocument
  /** The owner's uploaded font families that the document uses (so viewers can draw the text as the owner sees it). */
  fonts: FontFamily[]
}
export interface CommentT {
  id: string
  author: { id: string; name: string; avatar_url: string | null }
  body: string
  page_id: string | null
  x: number | null
  y: number | null
  parent: string | null
  resolved: boolean
  created_at: string
}
export type AssetQuery = { kind?: AssetKind; q?: string; page?: number; page_size?: number }

export interface AssetUsage {
  used_bytes: number
  quota_bytes: number
}

export interface DesignBulkInput {
  ids: string[]
  action: BulkAction
  folder?: string | null
}

export interface GoogleLoginResult {
  user: ApiUser
  created: boolean
}

export interface RegisterInput {
  email: string
  password: string
  display_name?: string
}

/** A font file the server embeds into a print PDF itself (same-origin `/media/…` URL). */
export interface PdfFontFile {
  family: string
  url: string
  weight: number
  style: 'normal' | 'italic'
}

export interface PdfExportInput {
  pages: Blob[]
  /** The first page's size (what servers that predate `sizes` read). */
  width: number
  height: number
  /** Trim size of every page in px, in the order of `pages`; sent as the `sizes` JSON field. */
  sizes?: { width: number; height: number }[]
  bleedMm?: number
  cropMarks?: boolean
  title?: string
  lang?: string
  fonts?: PdfFontFile[]
  signal?: AbortSignal
  onUploadProgress?: (fraction: number) => void
}

export interface ShareLinkInput {
  role: ShareRole
  expires_at?: string | null
  password?: string
}

export interface CommentInput {
  body: string
  page_id?: string | null
  x?: number | null
  y?: number | null
  parent?: string | null
}

/** A new place for a comment's pin: the page (by id) and a point in that page's own pixels. */
export interface CommentMove {
  page_id: string
  x: number
  y: number
}

export interface UserFontUploadInput {
  /** One file per weight/style (ttf, otf, woff, woff2). */
  files: File[]
  family?: string
  category?: FontCategory
}

export interface UserFontUploadOptions {
  signal?: AbortSignal
  /** Upload progress, 0..1. */
  onProgress?: (fraction: number) => void
}

/** Error codes of `POST /fonts/mine/` (all carry a user-presentable `message`). */
export type UserFontErrorCode = 'variant_exists' | 'font_name_taken' | 'font_limit_reached' | 'font_storage_limit'
