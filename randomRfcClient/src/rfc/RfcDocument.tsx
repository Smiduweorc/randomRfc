import type { RfcEditorSingleResponse } from "./RfcApi";

const RFC_EDITOR = "https://www.rfc-editor.org";

// Formats in reading order; the first one the RFC has becomes the main link.
const FORMATS = [
	{ key: "HTML", extension: "html", label: "HTML" },
	{ key: "TEXT", extension: "txt", label: "Plain text" },
	{ key: "PDF", extension: "pdf", label: "PDF" },
	{ key: "XML", extension: "xml", label: "XML" },
];

const RELATIONS = [
	{ field: "obsoletes", label: "Obsoletes" },
	{ field: "updates", label: "Updates" },
	{ field: "updated_by", label: "Updated by" },
	{ field: "see_also", label: "See also" },
] as const;

const statusLabel = (status: string) =>
	status.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

interface Props {
	rfc: RfcEditorSingleResponse;
	onOpen: (rfcNumber: number) => void;
}

// Relations arrive as "RFC2616", "STD0097", "BCP0014". Only RFCs can be opened here.
function DocumentRef({ id, onOpen }: { id: string; onOpen: Props["onOpen"] }) {
	const [, series, digits] = /^([A-Z]+)0*(\d+)$/.exec(id) ?? [];
	if (series !== "RFC") {
		return <span>{series ? `${series} ${digits}` : id}</span>;
	}
	return (
		<a
			href={`?rfc=${digits}`}
			onClick={(event) => {
				event.preventDefault();
				onOpen(Number(digits));
			}}
		>
			RFC {digits}
		</a>
	);
}

function DocumentRefs({ ids, onOpen }: { ids: string[]; onOpen: Props["onOpen"] }) {
	return (
		<ul className="refs">
			{ids.map((id) => <li key={id}><DocumentRef id={id} onOpen={onOpen} /></li>)}
		</ul>
	);
}

export function RfcDocument({ rfc, onOpen }: Props) {
	const formats = FORMATS.filter(({ key }) => rfc.format.includes(key));
	const [mainFormat, ...otherFormats] = formats;
	const fileUrl = (extension: string) => `${RFC_EDITOR}/rfc/rfc${rfc.number}.${extension}`;
	const relations = RELATIONS.filter(({ field }) => rfc[field].length > 0);

	return (
		<article className="rfc">
			<h1>
				<span className="rfc-number">RFC {rfc.number}</span>
				<span className="sr-only">: </span>
				<span className="rfc-title">{rfc.title}</span>
			</h1>

			{rfc.obsoleted_by.length > 0 && (
				<div className="obsoleted">
					<p>Obsoleted by</p>
					<DocumentRefs ids={rfc.obsoleted_by} onOpen={onOpen} />
				</div>
			)}

			<div className="rfc-header">
				<dl>
					<div>
						<dt>Status</dt>
						<dd>{statusLabel(rfc.status)}</dd>
					</div>
					<div>
						<dt>Published</dt>
						<dd>{rfc.pub_date}</dd>
					</div>
					{rfc.page_count > 0 && (
						<div>
							<dt>Length</dt>
							<dd>{rfc.page_count} {rfc.page_count === 1 ? "page" : "pages"}</dd>
						</div>
					)}
					<div>
						<dt>Source</dt>
						<dd>{rfc.source}</dd>
					</div>
					{rfc.draft && (
						<div>
							<dt>Draft</dt>
							<dd>{rfc.draft}</dd>
						</div>
					)}
				</dl>
				<div>
					<h2>{rfc.authors.length === 1 ? "Author" : "Authors"}</h2>
					<ul>
						{rfc.authors.map((author) => <li key={author}>{author}</li>)}
					</ul>
				</div>
			</div>

			<section>
				<h2>Abstract</h2>
				{rfc.abstract
					? <p className="abstract">{rfc.abstract}</p>
					: <p className="abstract empty">The RFC Editor has no abstract for this one.</p>}
			</section>

			{mainFormat && (
				<div className="read">
					<a className="read-main" href={fileUrl(mainFormat.extension)}>
						Read RFC {rfc.number} as {mainFormat.label}
					</a>
					{otherFormats.length > 0 && (
						<p>
							Also as{" "}
							{otherFormats.map(({ key, extension, label }, index) => (
								<span key={key}>
									{index > 0 && ", "}
									<a href={fileUrl(extension)}>{label}</a>
								</span>
							))}
						</p>
					)}
				</div>
			)}

			{(relations.length > 0 || rfc.keywords.length > 0) && (
				<dl className="relations">
					{relations.map(({ field, label }) => (
						<div key={field}>
							<dt>{label}</dt>
							<dd><DocumentRefs ids={rfc[field]} onOpen={onOpen} /></dd>
						</div>
					))}
					{rfc.keywords.length > 0 && (
						<div>
							<dt>Keywords</dt>
							<dd className="keywords">{rfc.keywords.join(", ")}</dd>
						</div>
					)}
				</dl>
			)}

			<p className="more">
				<a href={`${RFC_EDITOR}/info/rfc${rfc.number}`}>RFC Editor page</a>
				{rfc.errata_url && <a href={rfc.errata_url.href}>Errata</a>}
				{rfc.doi && <a href={`https://doi.org/${rfc.doi}`}>DOI {rfc.doi}</a>}
			</p>
		</article>
	);
}
