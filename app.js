/**
 * clip10
 * Stable Version: No Duplicate Preview & Safe Enter
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

function setupUI() {
    if (!roomId || roomId.length < 5) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        roomId = '';
        for (let i = 0; i < 5; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        location.hash = encodeURIComponent(roomId);
    }
    displayId.innerText = roomId;
}

// 1. Render Preview Card (Menggunakan Fragment agar tidak merusak kursor)
async function renderInlinePreview(url) {
    const cleanUrl = url.trim().replace(/[.,]$/, ""); 
    const previewContainer = document.getElementById('preview-container'); // Ambil container baru
    
    // Cek di container baru agar tidak duplikat
    if (previewContainer.querySelector(`.inline-preview-card[data-url="${cleanUrl}"]`)) return;

    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`);
        const json = await response.json();
        
        if (json.status === 'success' && json.data.image) {
            const data = json.data;
            const card = document.createElement('div');
            card.className = "inline-preview-card";
            card.setAttribute('data-url', cleanUrl);
            
            // Render kartu (tidak butuh contenteditable="false" karena sudah di luar editor)
            card.innerHTML = `
                <img src="${data.image.url}" class="preview-thumb">
                <div class="preview-body">
                    <div class="preview-title">${data.title || 'Link Preview'}</div>
                    <div class="preview-desc">${data.description || ''}</div>
                    <div class="preview-site">${new URL(cleanUrl).hostname}</div>
                </div>`;

            card.addEventListener('click', () => window.open(cleanUrl, '_blank'));
            
            // Masukkan ke container terpisah, bukan ke editor
            previewContainer.appendChild(card);
            
            saveToDB(); 
        }
    } catch (err) { console.warn(err); }
}

// 2. Fungsi Simpan & Auto-Linker
async function save() {
    if (isExpired) return;
    setStat("⏳");

    let currentHTML = editor.innerHTML;
    // Regex Lookbehind: Pastikan tidak membungkus link yang sudah jadi <a> atau di dalam atribut
    const urlRegex = /(?<!href="|src="|data-url="|">)(https?:\/\/[^\s<]+)/g;
    const linkedHTML = currentHTML.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    });

    if (currentHTML !== linkedHTML) {
        // Update hanya jika ada link baru yang perlu diwarnai biru
        const sel = window.getSelection();
        const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        
        editor.innerHTML = linkedHTML;

        // Kembalikan fokus ke akhir teks
        if (range) {
            const newRange = document.createRange();
            newRange.selectNodeContents(editor);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }

    // Picu pembuatan preview card
    const text = editor.innerText;
    const matches = text.match(/(https?:\/\/[^\s<]+)/gi);
    if (matches) {
        const uniqueUrls = [...new Set(matches)];
        for (const url of uniqueUrls) {
            await renderInlinePreview(url);
        }
    }

    saveToDB();
}

async function saveToDB() {
    const { error } = await client.from('clipboard').upsert({ id: roomId, content: editor.innerHTML });
    setStat(error ? "❌" : "✅");
}

// --- EVENT LISTENERS ---

editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') window.open(e.target.href, '_blank');
});

editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertText", false, text);
    setTimeout(save, 300);
});

editor.addEventListener('keydown', (e) => {
    if (isExpired) return;
    isTyping = true;
    
    // Jika menekan Enter, kita biarkan browser membuat baris baru dulu, baru kita save
    if (e.key === 'Enter') {
        setTimeout(() => {
            save();
            isTyping = false;
        }, 50);
    }
});

editor.addEventListener('blur', () => { 
    isTyping = false; 
    save(); 
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
            editor.innerHTML = data.content || "";
        } else {
            expirationTime = now + (10 * 60 * 1000);
            await client.from('clipboard').upsert({ 
                id: roomId, content: "", expires_at: new Date(expirationTime).toISOString() 
            });
        }
        startTimer();
        subscribeRealtime();
    } catch (err) { console.error(err); }
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
        if (!isTyping && payload.new.content !== editor.innerHTML) {
            editor.innerHTML = payload.new.content;
        }
    }).subscribe();
}

// Menghapus baris data permanen sesuai permintaan
async function sesi_hancurkan() {
    isExpired = true;
    timerDisplay.innerText = "00:00";
    editor.contentEditable = false;
    await client.from('clipboard').delete().eq('id', roomId);
    editor.innerHTML = `
        <div class="mt-20 text-center flex flex-col items-center">
            <p class="text-slate-400 text-xs mb-4 italic">Session expired and data has been permanently deleted.</p>
            <button onclick="window.location.hash=''; window.location.reload();" class="text-xs font-bold text-blue-500 border border-blue-500 px-4 py-2 rounded-md uppercase">Start Write</button>
        </div>`;
}

function setStat(emoji) {
    indicator.innerText = emoji;
    indicator.style.opacity = "1";
    if (emoji === "✅") setTimeout(() => { indicator.innerText = "⏎"; indicator.style.opacity = "0.5"; }, 1200);
}

setupUI();
connectData();