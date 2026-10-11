import { buildStickerId, parseStickerId } from "../sticker-id";
import type {
	StickerBrowseResult,
	StickerItem,
	StickerProvider,
	StickerSearchResult,
} from "../types";
import { REGIONS, REGION_GROUPS } from "./countries-data";
import type { CountryRecord, RegionId } from "./countries-data";

const FLAGS_PROVIDER_ID = "flags";
const DEFAULT_SEARCH_LIMIT = 100;
const DEFAULT_FLAGS_BASE_URL = "/ve/flags";

let countriesPromise: Promise<CountryRecord[]> | null = null;

function getFlagsBaseUrl(): string {
	return DEFAULT_FLAGS_BASE_URL.replace(/\/$/, "");
}

function buildFlagUrl({ code }: { code: string }): string {
	const normalizedCode = code.toLowerCase();
	return `${getFlagsBaseUrl()}/${encodeURIComponent(normalizedCode)}.svg`;
}

async function loadCountries(): Promise<CountryRecord[]> {
	if (countriesPromise) {
		return countriesPromise;
	}

	countriesPromise = import("./countries-data")
		.then((m) => m.COUNTRIES)
		.catch((error) => {
			console.error("Failed to load countries dataset:", error);
			return [];
		});

	return countriesPromise;
}

// Los nombres del dataset están en inglés; el navegador trae los de CLDR en
// español («Alemania», «Estados Unidos»), que es lo que ve el usuario y lo que
// queda como nombre del clip.
let nombresEs: Intl.DisplayNames | null | undefined;
function nombreEnEspanol(code: string): string | null {
	if (nombresEs === undefined) {
		try {
			nombresEs = new Intl.DisplayNames(["es"], { type: "region" });
		} catch {
			nombresEs = null;
		}
	}
	try {
		const nombre = nombresEs?.of(code.toUpperCase());
		return nombre && nombre !== code.toUpperCase() ? nombre : null;
	} catch {
		return null;
	}
}

function sinTildes(texto: string): string {
	return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toStickerItem({ country }: { country: CountryRecord }): StickerItem {
	const normalizedCode = country.code.toUpperCase();
	return {
		id: buildStickerId({
			providerId: FLAGS_PROVIDER_ID,
			providerValue: normalizedCode,
		}),
		provider: FLAGS_PROVIDER_ID,
		name: nombreEnEspanol(normalizedCode) ?? country.name,
		previewUrl: buildFlagUrl({ code: normalizedCode }),
		metadata: {
			code: normalizedCode,
			region: country.region ?? null,
			languages: country.languages ?? [],
			flagColors: country.flag_colors ?? [],
		},
	};
}

function normalizeQuery({ query }: { query: string }): string {
	return query.trim().toLowerCase();
}

function findMatchingRegions({
	query,
}: {
	query: string;
}): (typeof REGIONS)[number][] {
	return REGIONS.filter(
		(r) =>
			r.id.toLowerCase() === query ||
			r.aliases.some((alias) => alias === query),
	);
}

export function resolveQueryToRegions({
	query,
}: {
	query: string;
}): Set<RegionId> | null {
	const group = REGION_GROUPS[query];
	if (group) {
		return new Set(group);
	}

	const matched = findMatchingRegions({ query });
	return matched.length > 0 ? new Set(matched.map((r) => r.id)) : null;
}

export function getRegionLabel({ query }: { query: string }): string {
	if (REGION_GROUPS[query]) {
		return query
			.split(" ")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}

	const matched = findMatchingRegions({ query });
	return matched[0]?.id ?? query;
}

function filterCountriesByQuery({
	countries,
	query,
}: {
	countries: CountryRecord[];
	query: string;
}): CountryRecord[] {
	if (!query) {
		return countries;
	}

	const regionIds = resolveQueryToRegions({ query });

	if (regionIds) {
		return countries.filter((country) => country.region && regionIds.has(country.region));
	}

	const consulta = sinTildes(query);
	return countries.filter((country) => {
		const normalizedName = country.name.toLowerCase();
		const normalizedCode = country.code.toLowerCase();
		const nombreEs = sinTildes(nombreEnEspanol(country.code) ?? "");
		return (
			normalizedName.includes(query) ||
			normalizedCode.includes(query) ||
			nombreEs.includes(consulta) ||
			"bandera".startsWith(consulta)
		);
	});
}

function paginateCountries({
	countries,
	options,
}: {
	countries: CountryRecord[];
	options?: { page?: number; limit?: number };
}): { items: CountryRecord[]; hasMore: boolean; total: number } {
	if (options?.limit === undefined) {
		return { items: countries, hasMore: false, total: countries.length };
	}
	const page = Math.max(1, options.page ?? 1);
	const limit = Math.max(1, options.limit);
	const startIndex = (page - 1) * limit;
	const endIndex = startIndex + limit;
	return {
		items: countries.slice(startIndex, endIndex),
		hasMore: endIndex < countries.length,
		total: countries.length,
	};
}

export const flagsProvider: StickerProvider = {
	id: FLAGS_PROVIDER_ID,
	async search({
		query,
		options,
	}: {
		query: string;
		options?: { limit?: number };
	}): Promise<StickerSearchResult> {
		const countries = await loadCountries();
		const normalizedQuery = normalizeQuery({ query });
		const filteredCountries = filterCountriesByQuery({
			countries,
			query: normalizedQuery,
		});
		const paged = paginateCountries({
			countries: filteredCountries,
			options: {
				page: 1,
				limit: options?.limit ?? DEFAULT_SEARCH_LIMIT,
			},
		});
		return {
			items: paged.items.map((country) => toStickerItem({ country })),
			total: paged.total,
			hasMore: paged.hasMore,
		};
	},
	async browse({
		options,
	}: {
		options?: { page?: number; limit?: number };
	}): Promise<StickerBrowseResult> {
		const countries = await loadCountries();
		const paged = paginateCountries({ countries, options });
		return {
			sections: [
				{
					id: "all",
					items: paged.items.map((country) => toStickerItem({ country })),
					hasMore: paged.hasMore,
					layout: "grid",
				},
			],
		};
	},
	resolveUrl({
		stickerId,
	}: {
		stickerId: string;
		options?: { width?: number; height?: number };
	}): string {
		const { providerValue } = parseStickerId({ stickerId });
		return buildFlagUrl({ code: providerValue });
	},
};
