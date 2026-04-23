const API_URL = "http://localhost:8000/chat";

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

/* ---------- Hero chat ---------- */
const heroForm = document.getElementById("hero-form");
const heroInput = document.getElementById("hero-input");
const heroResponse = document.getElementById("hero-response");
const heroHistory = [];

async function runHero(message) {
	if (!message.trim()) return;
	heroInput.value = "";
	heroResponse.hidden = false;
	heroResponse.textContent = "";
	const btn = heroForm.querySelector("button[type=submit]");
	btn.disabled = true;
	try {
		const reply = await streamChat(message, heroHistory, (t) => {
			heroResponse.textContent += t;
		});
		heroHistory.push({ role: "user", content: message });
		heroHistory.push({ role: "assistant", content: reply });
	} catch (e) {
		heroResponse.textContent = "Couldn't reach the API. Is it running?";
	} finally {
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

/* ---------- Floating panel ---------- */
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
	const btn = panelForm.querySelector("button[type=submit]");
	btn.disabled = true;
	try {
		const reply = await streamChat(message, panelHistory, (t) => {
			botMsg.textContent += t;
			chatLog.scrollTop = chatLog.scrollHeight;
		});
		panelHistory.push({ role: "user", content: message });
		panelHistory.push({ role: "assistant", content: reply });
	} catch {
		botMsg.textContent = "Couldn't reach the API.";
	} finally {
		btn.disabled = false;
	}
});
