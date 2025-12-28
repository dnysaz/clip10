/**
 * clip10 - Optimized Mobile & Desktop Version
 * Stable: Anti-HTML Leak, Stable Cursor, & Real-time Sync
 */

const client = supabase.createClient(CONFIG.STR_URL, CONFIG.STR_KEY);
const editor = document.getElementById('editor');
const timerDisplay = document.getElementById('timer');
const displayId = document.getElementById('display-id');
const indicator = document.getElementById('indicator');

let roomId = decodeURIComponent(location.hash.slice(1));
let expirationTime = null;
let isExpired = false;
let isTyping = false;
let saveTimeout;

function setupUI() {
    if (!roomId || roomId.length < 5) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        roomId = '';
        for (let i = 0; i < 5; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        location.hash = encodeURIComponent(roomId);
    }
    displayId.innerText = roomId;
}

// 1. Render Preview Card (Di luar Editor)
async function renderInlinePreview(url) {
    const cleanUrl = url.trim().replace(/[.,]$/, ""); 
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer || previewContainer.querySelector(`.inline-preview-card[data-url="${cleanUrl}"]`)) return;

    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`);
        const json = await response.json();
        
        if (json.status === 'success' && json.data.image) {
            const data = json.data;
            const card = document.createElement('div');
            card.className = "inline-preview-card animate-fade-in";
            card.setAttribute('data-url', cleanUrl);
            card.innerHTML = `
                <img src="${data.image.url}" class="preview-thumb">
                <div class="preview-body">
                    <div class="preview-title">${data.title || 'Link Preview'}</div>
                    <div class="preview-desc">${data.description || ''}</div>
                    <div class="preview-site">${new URL(cleanUrl).hostname}</div>
                </div>`;
            card.onclick = () => window.open(cleanUrl, '_blank');
            previewContainer.appendChild(card);
        }
    } catch (err) { console.warn("Microlink Error:", err); }
}

// 2. Formatting Teks agar Link Menjadi Biru (Hanya saat menampilkan)
function formatLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split('\n').map(line => {
        return line.replace(urlRegex, url => `<a href="${url}" target="_blank" class="text-blue-500 underline">${url}</a>`);
    }).join('<br>');
}

// 3. Fungsi Simpan (Utama)
async function save() {
    if (isExpired) return;
    setStat("⏳");

    // Ambil teks murni, bukan HTML, untuk menghindari kebocoran tag
    const plainText = editor.innerText;

    // Cari link untuk di-preview
    const matches = plainText.match(/(https?:\/\/[^\s]+)/gi);
    if (matches) {
        const uniqueUrls = [...new Set(matches)];
        uniqueUrls.forEach(url => renderInlinePreview(url));
    }

    try {
        const { error } = await client.from('clipboard').upsert({ 
            id: roomId, 
            content: plainText, // Simpan teks murni ke DB
            updated_at: new Date().toISOString()
        });
        setStat(error ? "❌" : "✅");
    } catch (err) { setStat("❌"); }
}

// --- EVENT LISTENERS ---

// Debounce Save: Jangan simpan setiap huruf, tunggu user berhenti mengetik sejenak
editor.addEventListener('input', () => {
    isTyping = true;
    setStat("✍️");
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        save();
        isTyping = false;
    }, 1000); 
});

editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertText", false, text);
});

// Perbaikan klik link di dalam contenteditable
editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
        window.open(e.target.href, '_blank');
    }
});

// --- SUPABASE & TIMER ---

async function connectData() {
    try {
        const { data } = await client.from('clipboard').select('content, expires_at').eq('id', roomId).maybeSingle();
        const now = new Date().getTime();

        if (data) {
            const serverExp = new Date(data.expires_at).getTime();
            if (now > serverExp) { await sesi_hancurkan(); return; }
            expirationTime = serverExp;
            // Tampilkan dengan format link biru
            editor.innerHTML = formatLinks(data.content || "");
        } else {
            expirationTime = now + (10 * 60 * 1000);
            await client.from('clipboard').upsert({ 
                id: roomId, content: "", expires_at: new Date(expirationTime).toISOString() 
            });
        }
        startTimer();
        subscribeRealtime();
    } catch (err) { console.error("Connection Error:", err); }
}

function startTimer() {
    const interval = setInterval(() => {
        const dist = expirationTime - new Date().getTime();
        if (dist <= 0) { clearInterval(interval); sesi_hancurkan(); return; }
        const m = Math.floor(dist / 60000), s = Math.floor((dist % 60000) / 1000);
        timerDisplay.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}

function subscribeRealtime() {
    client.channel(`room-${roomId}`).on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'clipboard', filter: `id=eq.${roomId}` 
    }, payload => {
        // Hanya update tampilan jika user lain yang mengetik
        if (!isTyping) {
            editor.innerHTML = formatLinks(payload.new.content || "");
        }
    }).subscribe();
}

async function sesi_hancurkan() {
    isExpired = true;
    timerDisplay.innerText = "00:00";
    editor.contentEditable = false;
    await client.from('clipboard').delete().eq('id', roomId);
    editor.innerHTML = `
        <div class="mt-20 text-center flex flex-col items-center animate-fade-in">
            <p class="text-slate-400 text-xs mb-4 italic text-balance">Session expired. Data has been permanently deleted from Supabase.</p>
            <button onclick="window.location.hash=''; window.location.reload();" class="text-xs font-bold text-blue-500 border border-blue-500 px-6 py-2 rounded-full uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all">New Session</button>
        </div>`;
}

function setStat(emoji) {
    indicator.innerText = emoji;
    indicator.style.opacity = "1";
    if (emoji === "✅") setTimeout(() => { indicator.style.opacity = "0.3"; indicator.innerText = "⏎"; }, 1500);
}

setupUI();
connectData();