/**
 * Apolo — contador de compactaciones en la barra inferior
 *
 * Añade "#N" a la línea de estadísticas, pegado a la derecha del porcentaje
 * de contexto (justo después de "(auto)"):
 *   - #0–#3  mismo color (dim) que el resto de la barra
 *   - #4–#6  ámbar (mismo umbral que el contexto >70%)
 *   - #7+    rojo (mismo umbral que el contexto >90%)
 *
 * Cómo funciona: no parchea nada de pi. Re-renderiza el FooterComponent
 * original (importado de @earendil-works/pi-coding-agent) con un "shim" de
 * sesión que reutiliza los datos que da la API de extensiones, e inyecta el
 * indicador en la línea de stats. Si en el futuro pi cambia el formato
 * interno del footer, el indicador simplemente no aparece (se devuelve la
 * línea original).
 *
 * Nota: el API de extensiones no expone el toggle de auto-compactación,
 * así que el "(auto)" se muestra siempre.
 *
 * Como además es el único dueño del footer, también alinea los estados de extensión
 * de la 3ª línea: los que empiezan por el marcador de ancho cero RIGHT_MARKER van
 * pegados a la derecha y el resto a la izquierda (p. ej. "rol: …" a la izquierda
 * y "📖 LIBRO ON" a la derecha). El marcador lo escribe la extensión que quiere
 * alinearse (libro-tutor.ts) y aquí se quita; si nadie lo usa, la línea queda
 * exactamente como la genera pi.
 */
import { FooterComponent } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const RESET_FG = "\u001b[39m";
const RIGHT_MARKER = "\u200B\u200B"; // debe coincidir con el de libro-tutor.ts

/**
 * Reescribe la línea de estados poniendo a la derecha los marcados con RIGHT_MARKER.
 * Devuelve undefined para dejar intacta la línea que genera pi.
 */
function alignStatuses(statuses: ReadonlyMap<string, string> | undefined, width: number): string | undefined {
	if (!statuses || statuses.size === 0) return undefined;
	const clean = (t: string) => t.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
	const left: string[] = [];
	const right: string[] = [];
	for (const [, text] of [...statuses.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const t = clean(text ?? "");
		if (!t) continue;
		if (t.startsWith(RIGHT_MARKER)) right.push(clean(t.slice(RIGHT_MARKER.length)));
		else left.push(t);
	}
	if (!right.length) return undefined; // nada marcado: la línea integrada de pi
	const l = left.join(" ");
	const r = right.join(" ");
	const gap = width - visibleWidth(l) - visibleWidth(r);
	if (!l) return " ".repeat(Math.max(0, gap)) + r; // solo hay estados de la derecha
	if (gap >= 1) return `${l}${" ".repeat(gap)}${r}`;
	// No cabe todo: se recorta la izquierda para que el estado de la derecha nunca desaparezca.
	const l2 = truncateToWidth(l, Math.max(0, width - visibleWidth(r) - 1), "");
	if (!l2) return " ".repeat(Math.max(0, width - visibleWidth(r))) + r;
	return `${l2}${" ".repeat(Math.max(1, width - visibleWidth(l2) - visibleWidth(r)))}${r}`;
}

export default function (pi: ExtensionAPI) {
	let lastCtx: ExtensionContext | undefined;
	let footerInstalled = false;

	// "Sesión" mínima con lo único que usa FooterComponent en render().
	// Ojo: modelRuntime se usa en el tope de la sesión (session.modelRuntime…)
	// y también dentro de state; lo dejamos en ambos sitios.
	const modelRuntime = { isUsingSubscription: () => false };
	const sessionShim = {
		modelRuntime,
		get state() {
			return {
				model: lastCtx?.model,
				thinkingLevel: lastCtx?.thinkingLevel ?? "off",
				modelRuntime,
			};
		},
		get sessionManager() {
			return lastCtx?.sessionManager;
		},
		getContextUsage: () => lastCtx?.getContextUsage(),
	};

	const makeFooter = (ctx: ExtensionContext) =>
		ctx.ui.setFooter((_tui, theme, footerData) => {
			const builtIn = new FooterComponent(sessionShim as never, footerData as never);
			builtIn.setAutoCompactEnabled(true);

			const countCompactions = () =>
				(lastCtx?.sessionManager?.getEntries() ?? []).filter((e) => e.type === "compaction").length;

			return {
				invalidate() {},
				render(width: number): string[] {
					if (!lastCtx?.sessionManager) return ["", ""];
					let lines: string[];
					try {
						lines = builtIn.render(width);
					} catch {
						return ["", ""];
					}
					const stats = lines[1];
					if (typeof stats === "string") {
						// La parte de contexto: "43.2%/200k (auto)", "?/200k (auto)", …
						const m = stats.match(/(\?|\d+(?:\.\d+)%)\/\S+(?: \(auto\))?/);
						if (m && m.index !== undefined) {
							// El footer colorea la parte de contexto si el uso >70% (ámbar)
							// o >90% (rojo). Solo en ese caso el indicador va dentro de un
							// span de color y hay que resetear antes de insertar; si no, el
							// label debe heredar el dim del resto de la barra sin tocar nada.
							const pct = lastCtx.getContextUsage()?.percent ?? 0;
							const ctxColored = pct > 70;

							const n = countCompactions();
							let label: string;
							if (n >= 7) label = theme.fg("error", `#${n}`);
							else if (n >= 4) label = theme.fg("warning", `#${n}`);
							else label = `#${n}`;
							const insert = (ctxColored ? RESET_FG : "") + label;

							const pos = m.index + m[0].length;
							let out = stats.slice(0, pos) + insert + stats.slice(pos);

							// Compensar el ancho: quitar ese número de espacios del padding
							// (la corrida de espacios antes del nombre del modelo, a la derecha).
							const rest = out.slice(pos + insert.length);
							const pad = rest.match(/ {2,}/);
							if (pad && pad.index !== undefined) {
								const remove = Math.min(insert.length, pad[0].length - 1);
								out =
									out.slice(0, pos + insert.length) +
									rest.slice(0, pad.index) +
									" ".repeat(pad[0].length - remove) +
									rest.slice(pad.index + pad[0].length);
							}
							lines[1] = out;
						}
					}

					// 3ª línea: estados de extensión (rol, libro, …) con alineación izq/der.
					if (typeof lines[2] === "string") {
						try {
							const aligned = alignStatuses(footerData.getExtensionStatuses(), width);
							if (aligned !== undefined) lines[2] = aligned;
						} catch {
							/* si pi cambia de formato interno, queda su línea original */
						}
					}
					return lines;
				},
			};
		});

	const install = (ctx: ExtensionContext) => {
		lastCtx = ctx; // los snapshots (model, sessionManager…) se renuevan en cada evento
		if (footerInstalled) return;
		footerInstalled = true;
		try {
			makeFooter(ctx);
		} catch {
			// Si setFooter falla, queda el footer integrado de pi.
		}
	};

	// Eventos que llevan ctx y mantienen los snapshots frescos
	// (cambio de sesión, de modelo, de thinking, compactación, árbol…).
	const events = [
		"session_start",
		"agent_start",
		"turn_start",
		"model_select",
		"thinking_level_select",
		"session_compact",
		"session_tree",
	];
	for (const name of events) {
		pi.on(name as never, ((event: unknown, ctx: ExtensionContext) => install(ctx)) as never);
	}
}
