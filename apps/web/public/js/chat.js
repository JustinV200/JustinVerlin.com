const API_URL = "/api/chat";

/* ---------- Mobile nav toggle (runs on every page) ---------- */
(function initNavToggle() {
	const nav = document.getElementById("site-nav");
	const toggle = document.getElementById("nav-toggle");
	if (!nav || !toggle) return;
	toggle.addEventListener("click", () => {
		const open = nav.classList.toggle("nav-open");
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
	});
	nav.querySelectorAll(".nav-links a").forEach((a) =>
		a.addEventListener("click", () => {
			nav.classList.remove("nav-open");
			toggle.setAttribute("aria-expanded", "false");
		})
	);
})();

async function streamChat(message, history, onToken) {
	const res = await fetch(API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ message, history }),
	});

	if (!res.ok) {
		if (res.status === 429) {
			onToken("Whoa — rate limit hit. Try again in a bit, twin.");
			return "";
		}
		onToken(`Error: ${res.status}`);
		return "";
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let full = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		const t = decoder.decode(value, { stream: true });
		full += t;
		onToken(t);
	}
	return full;
}

/* ---------- Hero chat (index.html only) ---------- */
const heroForm = document.getElementById("hero-form");
if (heroForm) {
	const heroInput = document.getElementById("hero-input");
	const heroResponse = document.getElementById("hero-response");
	const heroHistory = [];

	async function runHero(message) {
		if (!message.trim()) return;
		heroInput.value = "";
		heroResponse.hidden = false;
		heroResponse.textContent = "";
		heroResponse.classList.add("streaming");
		const btn = heroForm.querySelector("button[type=submit]");
		btn.disabled = true;
		try {
			const reply = await streamChat(message, heroHistory, (t) => {
				heroResponse.textContent += t;
			});
			heroHistory.push({ role: "user", content: message });
			heroHistory.push({ role: "assistant", content: reply });
		} catch {
			heroResponse.textContent = "Couldn't reach the API. Is it running?";
		} finally {
			heroResponse.classList.remove("streaming");
			btn.disabled = false;
		}
	}

	heroForm.addEventListener("submit", (e) => {
		e.preventDefault();
		runHero(heroInput.value);
	});

	document.querySelectorAll(".chip").forEach((chip) => {
		chip.addEventListener("click", () => {
			const prompt = chip.dataset.prompt;
			heroInput.value = prompt;
			runHero(prompt);
		});
	});
}

/* ---------- Floating chat bubble (injected on every page) ---------- */
(function injectBubble() {
	const html = `
		<button id="chat-bubble" class="chat-bubble" aria-label="Open chat">
			<span class="bubble-label">JustAnAI</span>
		</button>
		<div id="chat-panel" class="chat-panel" hidden>
			<div class="chat-panel-header">
				<strong>Ask JustAnAI</strong>
				<button id="chat-close" aria-label="Close">&times;</button>
			</div>
			<div id="chat-log" class="chat-log"></div>
			<form id="panel-form" class="chat-form panel-form">
				<input id="panel-input" type="text" autocomplete="off" maxlength="500" placeholder="Ask anything..." />
				<button type="submit" aria-label="Send">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
				</button>
			</form>
		</div>
	`;
	const wrap = document.createElement("div");
	wrap.innerHTML = html;
	while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

	const bubble = document.getElementById("chat-bubble");
	const panel = document.getElementById("chat-panel");
	const closeBtn = document.getElementById("chat-close");
	const panelForm = document.getElementById("panel-form");
	const panelInput = document.getElementById("panel-input");
	const chatLog = document.getElementById("chat-log");
	const panelHistory = [];

	function addMsg(cls, text) {
		const div = document.createElement("div");
		div.className = `msg ${cls}`;
		div.textContent = text;
		chatLog.appendChild(div);
		chatLog.scrollTop = chatLog.scrollHeight;
		return div;
	}

	bubble.addEventListener("click", () => {
		panel.hidden = !panel.hidden;
		if (!panel.hidden) panelInput.focus();
	});
	closeBtn.addEventListener("click", () => {
		panel.hidden = true;
	});

	panelForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const message = panelInput.value.trim();
		if (!message) return;
		panelInput.value = "";
		addMsg("user", message);
		const botMsg = addMsg("bot", "");
		botMsg.classList.add("typing");
		const btn = panelForm.querySelector("button[type=submit]");
		btn.disabled = true;
		try {
			const reply = await streamChat(message, panelHistory, (t) => {
				botMsg.classList.remove("typing");
				botMsg.textContent += t;
				chatLog.scrollTop = chatLog.scrollHeight;
			});
			panelHistory.push({ role: "user", content: message });
			panelHistory.push({ role: "assistant", content: reply });
		} catch {
			botMsg.classList.remove("typing");
			botMsg.textContent = "Couldn't reach the API.";
		} finally {
			btn.disabled = false;
		}
	});
})();
