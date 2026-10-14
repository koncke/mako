import type { Asset, StockPage, StockPhoto } from '@/app/image-editor/_doory/types/api'
import { http } from './client'

export const stockApi = {
  search: (q: string, page = 1, perPage = 30, signal?: AbortSignal) => http.get<StockPage>('/stock/photos/', { query: { q, page, per_page: perPage }, signal }),
  importPhoto: (photo: Pick<StockPhoto, 'provider' | 'id'>) => http.post<Asset>('/stock/photos/import/', { json: { provider: photo.provider, id: photo.id } }),
}
