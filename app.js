/**
 * clip10 - Final Stable Version
 * Fix: Immediate Placeholder, Active Links, & No Cursor Jump
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
    } catch (err) { console.warn("Microlink Error"); }
}

// 2. Format Link (Paling Stabil)
function formatLinks(text) {
    if (!text || text.trim() === "") return ""; 
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Pecah per baris, buat link, lalu gabung kembali dengan <br>
    return text.split('\n').map(line => {
        return line.replace(urlRegex, url => {
            return `<a href="${url}" target="_blank" rel="noopener" class="text-blue-500 underline" contenteditable="false">${url}</a>`;
        });
    }).join('<br>');
}

// 3. Fungsi Simpan dengan Pembersihan Preview Otomatis
async function save() {
    if (isExpired) return;
    setStat("⏳");

    const plainText = editor.innerText;
    const previewContainer = document.getElementById('preview-container');

    // --- LOGIKA PEMBERSIHAN PREVIEW (Sync Preview dengan Teks) ---
    const matches = plainText.match(/(https?:\/\/[^\s]+)/gi) || [];
    const uniqueUrls = [...new Set(matches.map(u => u.trim().replace(/[.,]$/, "")))];

    // Hapus preview card jika link-nya sudah tidak ada di teks
    const existingCards = previewContainer.querySelectorAll('.inline-preview-card');
    existingCards.forEach(card => {
        const cardUrl = card.getAttribute('data-url');
        if (!uniqueUrls.includes(cardUrl)) {
            card.remove(); // Langsung hapus kartu preview jika teks link dihapus
        }
    });

    // Munculkan preview baru jika ada link baru
    uniqueUrls.forEach(url => renderInlinePreview(url));

    // --- LIVE COLORING (Link jadi biru instan) ---
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && isTyping) {
        const range = selection.getRangeAt(0);
        const formatted = formatLinks(plainText);
        if (editor.innerHTML !== formatted) {
            editor.innerHTML = formatted;
            // Kembalikan kursor ke posisi akhir
            const newRange = document.createRange();
            newRange.selectNodeContents(editor);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    try {
        await client.from('clipboard').upsert({ id: roomId, content: plainText });
        setStat("✅");
    } catch (err) { setStat("❌"); }
}

// --- EVENT LISTENERS ---

editor.addEventListener('input', () => {
    isTyping = true;
    setStat("✍️");
    
    // Fix Placeholder: Jika kosong, bersihkan semua node agar :empty aktif
    if (editor.innerText.trim() === "") {
        editor.innerHTML = "";
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        save();
        setTimeout(() => { isTyping = false; }, 2000);
    }, 800); 
});

editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertText", false, text);
});

// Pastikan link bisa diklik meskipun di dalam contenteditable
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
            
            const content = data.content || "";
            // Jika konten ada, format jadi link, jika tidak, kosongkan total demi placeholder
            editor.innerHTML = (content.trim() !== "") ? formatLinks(content) : "";
        } else {
            expirationTime = now + (10 * 60 * 1000);
            await client.from('clipboard').upsert({ 
                id: roomId, content: "", expires_at: new Date(expirationTime).toISOString() 
            });
            editor.innerHTML = ""; // Pastikan kosong saat room baru
        }
        startTimer();
        subscribeRealtime();
    } catch (err) { console.error("Connection Error"); }
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
        if (!isTyping) {
            const newContent = payload.new.content || "";
            if (editor.innerText !== newContent) {
                editor.innerHTML = (newContent.trim() !== "") ? formatLinks(newContent) : "";
            }
        }
    }).subscribe();
}

async function sesi_hancurkan() {
    isExpired = true;
    timerDisplay.innerText = "00:00";
    editor.contentEditable = false;
    await client.from('clipboard').delete().eq('id', roomId);
    editor.innerHTML = `
        <div class="mt-20 text-center flex flex-col items-center">
            <p class="text-slate-400 text-xs mb-4 italic">Session ended. File deleted permanently.</p>
            <button onclick="window.location.hash=''; window.location.reload();" class="text-xs font-bold text-blue-500 border border-blue-500 px-6 py-2 rounded-full uppercase">New Clip</button>
        </div>`;
}

function setStat(emoji) {
    indicator.innerText = emoji;
    indicator.style.opacity = "1";
    if (emoji === "✅") setTimeout(() => { indicator.style.opacity = "0.3"; indicator.innerText = "⏎"; }, 1500);
}

// --- DETEKSI PERUBAHAN ID (HASH) SECARA OTOMATIS ---

window.addEventListener('hashchange', () => {
    // 1. Ambil ID baru dari URL
    const newRoomId = decodeURIComponent(location.hash.slice(1));
    
    // 2. Jika ID benar-benar berubah dan valid, muat ulang data
    if (newRoomId && newRoomId !== roomId) {
        roomId = newRoomId;
        displayId.innerText = roomId;
        
        // Bersihkan tampilan lama sebelum muat yang baru
        editor.innerHTML = "";
        const previewContainer = document.getElementById('preview-container');
        if (previewContainer) previewContainer.innerHTML = "";
        
        // Hubungkan ulang ke database dengan ID baru
        connectData();
    }
});

setupUI();
connectData();