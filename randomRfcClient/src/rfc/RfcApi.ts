import { useEffect, useState } from "react";

const RFC_EDITOR = "https://www.rfc-editor.org";
const REQUEST_TIMEOUT_MS = 10_000;
// Numbers are consecutive up to about 9999, then the newest few dozen have holes (10000, 10009...), so a pick can land on one.
const RANDOM_PICK_ATTEMPTS = 6;

// I can't seem to find a specific documentation that explicitly tells me what kind of possible data/enums that exists in this case, i ended up going with a wider type
interface RawRfcEditorSingleResponse {
	draft: string | null;
	doc_id: string;
	title: string;
	authors: string[];
	format: string[];
	page_count: string; // will be handled by JSON.parse, note original API seems to return a string, but idw to download a whole ass validation library
	pub_status: string;
	status: string;
	source: string;
	abstract: string;
	pub_date: string;
	keywords: string[];
	obsoletes: string[];
	obsoleted_by: string[];
	updates: string[];
	updated_by: string[];
	see_also: string[];
	doi: string;
	errata_url: string | null;
}

// I can't seem to find a specific documentation that explicitly tells me what kind of possible data/enums that exists in this case, i ended up going with a wider type
export interface RfcEditorSingleResponse {
	number: number;
	draft: string | null;
	doc_id: string;
	title: string;
	authors: string[];
	format: string[];
	page_count: number;
	pub_status: string;
	status: string;
	source: string;
	abstract: string;
	pub_date: string;
	keywords: string[];
	obsoletes: string[];
	obsoleted_by: string[];
	updates: string[];
	updated_by: string[];
	see_also: string[];
	doi: string;
	errata_url: URL | null;
}

function transformRawRfcResponse(raw: RawRfcEditorSingleResponse): RfcEditorSingleResponse {
	return {
		...raw,
		number: parseInt(raw.doc_id.replace(/^RFC/i, ""), 10),
		errata_url: raw.errata_url ? new URL(raw.errata_url) : null,
		page_count: parseInt(raw.page_count, 10)
	}
}

function withTimeout(signal?: AbortSignal): AbortSignal {
	const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export const fetchRfcMetaData = async (rfcNumber: number, signal?: AbortSignal): Promise<RfcEditorSingleResponse> => {
	const response = await fetch(`${RFC_EDITOR}/rfc/rfc${rfcNumber}.json`, { signal: withTimeout(signal) });
	if (!response.ok) {
		throw new Error(`RFC ${rfcNumber}: HTTP ${response.status}`);
	}
	const rawData: RawRfcEditorSingleResponse = await response.json();

	return transformRawRfcResponse(rawData);
}

// The datatracker API has no CORS headers and rfc-index is 13 MB; the recent-RFCs feed is 14 KB and always lists the newest number.
let latestRfcNumber: Promise<number> | null = null;

export function fetchMaxRfcIndex(): Promise<number> {
	latestRfcNumber ??= fetch(`${RFC_EDITOR}/rfcrss.xml`, { signal: withTimeout() })
		.then((response) => {
			if (!response.ok) {
				throw new Error(`RFC feed: HTTP ${response.status}`);
			}
			return response.text();
		})
		.then((feed) => {
			const numbers = Array.from(feed.matchAll(/\/info\/rfc(\d+)\//g), (match) => Number(match[1]));
			if (numbers.length === 0) {
				throw new Error("RFC feed listed no RFCs");
			}
			return Math.max(...numbers);
		})
		.catch((error) => {
			latestRfcNumber = null;
			throw error;
		});

	return latestRfcNumber;
}

async function fetchRandomRfc(signal: AbortSignal): Promise<RfcEditorSingleResponse> {
	const maxRfcIndex = await fetchMaxRfcIndex();

	for (let attempt = 1; ; attempt++) {
		try {
			return await fetchRfcMetaData(1 + Math.floor(Math.random() * maxRfcIndex), signal);
		} catch (error) {
			if (signal.aborted || attempt === RANDOM_PICK_ATTEMPTS) {
				throw error;
			}
		}
	}
}

function rfcNumberFromLocation(): number | null {
	const rfc = Number(new URLSearchParams(location.search).get("rfc"));
	return Number.isInteger(rfc) && rfc > 0 ? rfc : null;
}

// The first random pick replaces the entry so Back leaves the site; every later pick is a new history entry.
function showRfcInLocation(rfcNumber: number) {
	if (rfcNumberFromLocation() === rfcNumber) {
		return;
	}
	const hasRfcParam = new URLSearchParams(location.search).has("rfc");
	history[hasRfcParam ? "pushState" : "replaceState"](null, "", `?rfc=${rfcNumber}`);
}

// A fresh object per request: a request is settled when its identity matches, so loading needs no flag.
interface RfcRequest {
	target: number | null;
}

interface SettledRequest {
	request: RfcRequest;
	rfc: RfcEditorSingleResponse | null;
	error: string | null;
}

export function useRfc() {
	const [request, setRequest] = useState<RfcRequest>(() => ({ target: rfcNumberFromLocation() }));
	const [settled, setSettled] = useState<SettledRequest | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		const load = request.target === null
			? fetchRandomRfc(controller.signal)
			: fetchRfcMetaData(request.target, controller.signal);

		load.then(
			(rfc) => {
				showRfcInLocation(rfc.number);
				setSettled({ request, rfc, error: null });
			},
			(error: unknown) => {
				if (controller.signal.aborted) {
					return;
				}
				console.error(`Loading ${request.target === null ? "a random RFC" : `RFC ${request.target}`} failed`, error);
				setSettled({
					request,
					rfc: null,
					error: request.target === null
						? "The RFC Editor did not answer after six tries."
						: `RFC ${request.target} did not load. Either it was never issued or the RFC Editor did not answer.`
				});
			}
		);

		return () => controller.abort();
	}, [request]);

	useEffect(() => {
		const onPopState = () => setRequest({ target: rfcNumberFromLocation() });
		addEventListener("popstate", onPopState);
		return () => removeEventListener("popstate", onPopState);
	}, []);

	const open = (target: number | null) => {
		scrollTo({ top: 0 });
		setRequest({ target });
	};

	return {
		rfc: settled?.rfc ?? null,
		error: settled?.error ?? null,
		loading: settled?.request !== request,
		another: () => open(null),
		open,
		retry: () => open(request.target)
	};
}
