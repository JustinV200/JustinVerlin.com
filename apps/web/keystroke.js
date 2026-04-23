/* Keystroke Sandbox — Synthesize + Compare modes.
 *
 * Relies on the /keystroke endpoint returning:
 *   { chars: [...], dwell_ms: [...], flight_ms: [null, ...], cpm: [...] }
 */
(function () {
	const API_BASE = "";
	const SYNTH_URL = `${API_BASE}/keystroke`;
	const STATUS_URL = `${API_BASE}/keystroke/status`;

	const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
	const fmt = (n, unit = "") => (n == null || Number.isNaN(n) ? "—" : `${Math.round(n)}${unit}`);

	// ---------------------------------------------------------------
	// Warm-up: ping /keystroke/status, trigger a load if cold.
	// ---------------------------------------------------------------
	const statusEl = document.getElementById("ks-status");
	const statusText = statusEl?.querySelector(".ks-status-text");

	function setStatus(msg, tone) {
		if (!statusEl) return;
		statusEl.hidden = false;
		statusEl.dataset.tone = tone || "";
		if (statusText) statusText.textContent = msg;
	}
	function hideStatus() {
		if (statusEl) statusEl.hidden = true;
	}

	async function warmup() {
		try {
			const r = await fetch(STATUS_URL);
			const d = await r.json();
			if (d.ready) {
				hideStatus();
				return;
			}
			setStatus("Warming up the model… first request may take ~30s.", "warming");
			// Kick a tiny inference call to trigger load; don't block UI on it.
			fetch(SYNTH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "hi" }),
			})
				.then(() => {
					setStatus("Model ready.", "ready");
					setTimeout(hideStatus, 1500);
				})
				.catch(() => setStatus("Model unavailable. API offline?", "error"));
		} catch {
			setStatus("API offline — start the backend to use this demo.", "error");
		}
	}
	warmup();

	// ---------------------------------------------------------------
	// Tabs
	// ---------------------------------------------------------------
	const tabs = document.querySelectorAll(".ks-tab");
	const panels = {
		synth: document.getElementById("ks-panel-synth"),
		compare: document.getElementById("ks-panel-compare"),
	};
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			tabs.forEach((t) => {
				t.classList.toggle("active", t === tab);
				t.setAttribute("aria-selected", t === tab ? "true" : "false");
			});
			const target = tab.dataset.tab;
			Object.entries(panels).forEach(([k, p]) => {
				p.hidden = k !== target;
			});
		});
	});

	// ---------------------------------------------------------------
	// API call
	// ---------------------------------------------------------------
	async function synthesize(text) {
		const r = await fetch(SYNTH_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
		});
		if (!r.ok) {
			let msg = `Error ${r.status}`;
			try {
				const j = await r.json();
				if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
			} catch {}
			throw new Error(msg);
		}
		return r.json();
	}

	// ---------------------------------------------------------------
	// SYNTHESIZE MODE
	// ---------------------------------------------------------------
	const synthInput = document.getElementById("ks-synth-input");
	const synthCount = document.getElementById("ks-synth-count");
	const synthGo = document.getElementById("ks-synth-go");
	const synthReplay = document.getElementById("ks-synth-replay");
	const synthSpeed = document.getElementById("ks-synth-speed");
	const synthPlayback = document.getElementById("ks-synth-playback");
	const synthStats = document.getElementById("ks-synth-stats");

	let lastSynthResp = null;
	let playbackToken = 0; // guards against overlapping playbacks

	synthInput.addEventListener("input", () => {
		synthCount.textContent = synthInput.value.length;
	});

	async function playback(resp) {
		const myToken = ++playbackToken;
		synthPlayback.textContent = "";
		const speed = parseFloat(synthSpeed.value) || 1;
		const { chars, dwell_ms, flight_ms } = resp;

		for (let i = 0; i < chars.length; i++) {
			if (myToken !== playbackToken) return; // cancelled
			const flight = flight_ms[i] != null ? flight_ms[i] : 0;
			if (i > 0) await sleep(flight / speed);

			const span = document.createElement("span");
			span.className = "ks-char";
			// Render whitespace as a soft placeholder so it still animates.
			if (chars[i] === " ") {
				span.classList.add("ks-char-space");
				span.textContent = "\u00a0"; // nbsp
			} else if (chars[i] === "\n") {
				span.classList.add("ks-char-break");
				span.innerHTML = "<br>";
			} else {
				span.textContent = chars[i];
			}
			synthPlayback.appendChild(span);
			// trigger transition
			requestAnimationFrame(() => span.classList.add("ks-char-pressed"));
			await sleep(dwell_ms[i] / speed);
			span.classList.remove("ks-char-pressed");
			span.classList.add("ks-char-released");
		}
	}

	function renderSynthStats(resp) {
		const { dwell_ms, flight_ms, cpm } = resp;
		const avgDwell = mean(dwell_ms);
		const avgFlight = mean(flight_ms.filter((x) => x != null));
		const avgCpm = mean(cpm);
		const totalMs = dwell_ms.reduce((a, b) => a + b, 0) +
			flight_ms.filter((x) => x != null).reduce((a, b) => a + b, 0);

		document.getElementById("ks-synth-cpm").textContent = fmt(avgCpm);
		document.getElementById("ks-synth-dwell").textContent = fmt(avgDwell, " ms");
		document.getElementById("ks-synth-flight").textContent = fmt(avgFlight, " ms");
		document.getElementById("ks-synth-total").textContent =
			totalMs < 1000 ? `${Math.round(totalMs)} ms` : `${(totalMs / 1000).toFixed(2)} s`;
		synthStats.hidden = false;
	}

	async function runSynth() {
		const text = synthInput.value.trim();
		if (!text) return;
		synthGo.disabled = true;
		synthReplay.disabled = true;
		synthPlayback.textContent = "";
		synthStats.hidden = true;
		setStatus("Generating keystrokes…", "working");
		try {
			const resp = await synthesize(text);
			lastSynthResp = resp;
			hideStatus();
			renderSynthStats(resp);
			synthReplay.disabled = false;
			await playback(resp);
		} catch (e) {
			setStatus(`Failed: ${e.message}`, "error");
		} finally {
			synthGo.disabled = false;
		}
	}

	synthGo.addEventListener("click", runSynth);
	synthReplay.addEventListener("click", () => {
		if (lastSynthResp) playback(lastSynthResp);
	});
	synthInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			runSynth();
		}
	});

	// ---------------------------------------------------------------
	// COMPARE MODE
	// ---------------------------------------------------------------
	const cmpInput = document.getElementById("ks-cmp-input");
	const cmpCount = document.getElementById("ks-cmp-count");
	const cmpGo = document.getElementById("ks-cmp-go");
	const cmpReset = document.getElementById("ks-cmp-reset");
	const cmpResults = document.getElementById("ks-cmp-results");
	const cmpChart = document.getElementById("ks-cmp-chart");

	// committed[] stays aligned with the final visible text.
	// Each entry: { char, downT, upT, dwell, flight }
	let committed = [];
	let lastDownT = null;

	function resetCompare() {
		committed = [];
		lastDownT = null;
		cmpInput.value = "";
		cmpCount.textContent = "0";
		cmpResults.hidden = true;
		cmpGo.disabled = true;
	}

	cmpInput.addEventListener("input", () => {
		cmpCount.textContent = cmpInput.value.length;
		cmpGo.disabled = cmpInput.value.trim().length === 0;
	});

	cmpInput.addEventListener("keydown", (e) => {
		if (e.key === "Backspace") {
			committed.pop();
			return;
		}
		// Only record "normal" printable keys (length === 1) and Enter.
		const ch = e.key === "Enter" ? "\n" : e.key;
		if (ch.length !== 1 && ch !== "\n") return;
		const t = e.timeStamp;
		committed.push({
			char: ch,
			downT: t,
			upT: null,
			dwell: null,
			flight: lastDownT == null ? null : t - lastDownT,
		});
		lastDownT = t;
	});

	cmpInput.addEventListener("keyup", (e) => {
		const ch = e.key === "Enter" ? "\n" : e.key;
		if (ch.length !== 1 && ch !== "\n") return;
		const t = e.timeStamp;
		// Match the most recent entry for this char with no upT yet.
		for (let i = committed.length - 1; i >= 0; i--) {
			if (committed[i].char === ch && committed[i].upT == null) {
				committed[i].upT = t;
				committed[i].dwell = t - committed[i].downT;
				break;
			}
		}
	});

	cmpReset.addEventListener("click", resetCompare);

	cmpGo.addEventListener("click", async () => {
		const text = cmpInput.value;
		if (!text.trim()) return;
		cmpGo.disabled = true;
		setStatus("Running model inference…", "working");
		try {
			const resp = await synthesize(text);
			hideStatus();
			renderComparison(text, resp);
		} catch (e) {
			setStatus(`Failed: ${e.message}`, "error");
		} finally {
			cmpGo.disabled = false;
		}
	});

	function renderComparison(text, modelResp) {
		// Align user timings with model output char-by-char.
		// Model returns chars that may have been truncated; use its length as ground truth.
		const n = Math.min(committed.length, modelResp.chars.length);

		const youDwell = [];
		const youFlight = [];
		const youCharMs = []; // dwell + flight per char, for CPM calc
		for (let i = 0; i < n; i++) {
			const c = committed[i];
			youDwell.push(c.dwell != null ? c.dwell : 0);
			youFlight.push(c.flight);
			const perChar = (c.dwell || 0) + (c.flight || 0);
			youCharMs.push(perChar);
		}

		const modelDwell = modelResp.dwell_ms.slice(0, n);
		const modelFlight = modelResp.flight_ms.slice(0, n);
		const modelCpm = mean(modelResp.cpm.slice(0, n));

		// CPM from user: total chars / total time in minutes.
		const totalUserMs = youCharMs.reduce((a, b) => a + b, 0);
		const userCpm = totalUserMs > 0 ? (n / (totalUserMs / 60000)) : 0;

		const meanYouD = mean(youDwell);
		const meanYouF = mean(youFlight.filter((x) => x != null));
		const meanModD = mean(modelDwell);
		const meanModF = mean(modelFlight.filter((x) => x != null));

		document.getElementById("ks-cmp-cpm-you").textContent = fmt(userCpm);
		document.getElementById("ks-cmp-cpm-model").textContent = fmt(modelCpm);
		document.getElementById("ks-cmp-dwell-you").textContent = fmt(meanYouD, " ms");
		document.getElementById("ks-cmp-dwell-model").textContent = fmt(meanYouD == null ? NaN : meanModD, " ms");
		document.getElementById("ks-cmp-flight-you").textContent = fmt(meanYouF, " ms");
		document.getElementById("ks-cmp-flight-model").textContent = fmt(meanModF, " ms");

		// Model-match score: 100 - normalized MAE of dwell+flight vs model prediction.
		const score = modelMatch(youDwell, modelDwell, youFlight, modelFlight);
		document.getElementById("ks-cmp-score").textContent = `${Math.round(score)}%`;
		document.getElementById("ks-cmp-verdict").innerHTML = buildVerdict(
			youDwell, modelDwell, youFlight, modelFlight, userCpm, modelCpm
		);

		// Cache data + draw dwell by default.
		cmpChart._data = {
			chars: modelResp.chars.slice(0, n),
			youDwell,
			modelDwell,
			youFlight,
			modelFlight,
		};
		drawChart("dwell");
		cmpResults.hidden = false;
	}

	function modelMatch(yd, md, yf, mf) {
		// Mean absolute error per metric, normalized by typical spread, then 100 - mean.
		const maeD = meanAbsErr(yd, md);
		const validF = [];
		for (let i = 0; i < yf.length; i++) {
			if (yf[i] != null && mf[i] != null) validF.push(Math.abs(yf[i] - mf[i]));
		}
		const maeF = validF.length ? validF.reduce((a, b) => a + b, 0) / validF.length : 0;
		// Normalize: 100ms dwell error and 200ms flight error each drop score ~50%.
		const dwellPenalty = Math.min(50, (maeD / 100) * 50);
		const flightPenalty = Math.min(50, (maeF / 200) * 50);
		return Math.max(0, 100 - dwellPenalty - flightPenalty);
	}

	function buildVerdict(yd, md, yf, mf, yCpm, mCpm) {
		const meanYd = mean(yd);
		const meanMd = mean(md);
		const meanYf = mean(yf.filter((x) => x != null));
		const meanMf = mean(mf.filter((x) => x != null));

		// Coefficient of variation (stddev / mean) — compares rhythm consistency.
		const cvYd = cov(yd);
		const cvMd = cov(md);
		const cvYf = cov(yf.filter((x) => x != null));
		const cvMf = cov(mf.filter((x) => x != null));
		const userCv = (cvYd + cvYf) / 2;
		const modelCv = (cvMd + cvMf) / 2;

		const speedDelta = yCpm - mCpm;
		const speedPct = mCpm > 0 ? Math.abs(speedDelta / mCpm) * 100 : 0;
		const speedWord = speedPct < 8
			? "about the same speed as"
			: speedDelta > 0 ? "faster than" : "slower than";

		const dwellDelta = meanYd - meanMd;
		const dwellWord = Math.abs(dwellDelta) < 10
			? "similar key-hold times"
			: dwellDelta > 0
				? `longer key-holds (${Math.round(dwellDelta)} ms more per press)`
				: `shorter key-holds (${Math.round(-dwellDelta)} ms less per press)`;

		const flightDelta = meanYf - meanMf;
		const flightWord = Math.abs(flightDelta) < 15
			? "a similar gap between keys"
			: flightDelta > 0
				? `longer gaps between keys (${Math.round(flightDelta)} ms more)`
				: `shorter gaps between keys (${Math.round(-flightDelta)} ms less)`;

		const varianceDelta = userCv - modelCv;
		let varianceLine;
		if (Math.abs(varianceDelta) < 0.08) {
			varianceLine = "Your rhythm is about as steady as the model predicted.";
		} else if (varianceDelta > 0) {
			varianceLine = "Your rhythm is more erratic than the model — bigger swings between fast and slow keys.";
		} else {
			varianceLine = "Your rhythm is steadier than the model predicted — unusually consistent timing.";
		}

		const speedPctTxt = speedPct < 8 ? "" : ` (${Math.round(speedPct)}%)`;
		return (
			`You type <strong>${speedWord}</strong> the model${speedPctTxt}, with <strong>${dwellWord}</strong> and <strong>${flightWord}</strong>. ` +
			varianceLine
		);
	}

	function cov(arr) {
		if (arr.length < 2) return 0;
		const m = mean(arr);
		if (m === 0) return 0;
		const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
		return Math.sqrt(v) / m;
	}

	function meanAbsErr(a, b) {
		const n = Math.min(a.length, b.length);
		if (!n) return 0;
		let s = 0;
		for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
		return s / n;
	}

	function drawChart(metric) {
		const data = cmpChart._data;
		if (!data) return;
		const youVals = metric === "dwell" ? data.youDwell : data.youFlight;
		const modelVals = metric === "dwell" ? data.modelDwell : data.modelFlight;

		// Max for scaling (ignore nulls).
		let max = 0;
		for (const v of youVals) if (v != null && v > max) max = v;
		for (const v of modelVals) if (v != null && v > max) max = v;
		if (max === 0) max = 1;

		cmpChart.innerHTML = "";
		for (let i = 0; i < data.chars.length; i++) {
			const row = document.createElement("div");
			row.className = "ks-chart-row";

			const label = document.createElement("span");
			label.className = "ks-chart-label";
			label.textContent = data.chars[i] === " " ? "␣" : data.chars[i] === "\n" ? "⏎" : data.chars[i];
			row.appendChild(label);

			const bars = document.createElement("div");
			bars.className = "ks-chart-bars";

			const y = youVals[i];
			const m = modelVals[i];
			const youBar = document.createElement("div");
			youBar.className = "ks-bar ks-bar-you";
			youBar.style.width = y != null ? `${(y / max) * 100}%` : "0%";
			youBar.title = y != null ? `You: ${Math.round(y)} ms` : "—";

			const modelBar = document.createElement("div");
			modelBar.className = "ks-bar ks-bar-model";
			modelBar.style.width = m != null ? `${(m / max) * 100}%` : "0%";
			modelBar.title = m != null ? `Model: ${Math.round(m)} ms` : "—";

			bars.appendChild(youBar);
			bars.appendChild(modelBar);
			row.appendChild(bars);
			cmpChart.appendChild(row);
		}
	}

	document.querySelectorAll(".ks-chart-toggle .ks-chip").forEach((chip) => {
		chip.addEventListener("click", () => {
			document.querySelectorAll(".ks-chart-toggle .ks-chip").forEach((c) =>
				c.classList.toggle("active", c === chip)
			);
			drawChart(chip.dataset.metric);
		});
	});

	// ---------------------------------------------------------------
	// helpers
	// ---------------------------------------------------------------
	function mean(arr) {
		if (!arr.length) return 0;
		return arr.reduce((a, b) => a + b, 0) / arr.length;
	}
})();
