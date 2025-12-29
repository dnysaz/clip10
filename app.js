/**
 * clip10 - Stable Link Version
 */

// Global Init
window.client = supabase.createClient(CONFIG.STR_URL, CONFIG.STR_KEY);
const editor = document.getElementById('editor');
const timerDisplay = document.getElementById('timer');
const displayId = document.getElementById('display-id');
const indicator = document.getElementById('indicator');

window.roomId = decodeURIComponent(location.hash.slice(1)); 
let expirationTime = null;
let isExpired = false;
let isTyping = false;
let saveTimeout;
window.isTimerStopped = false; 

function setupUI() {
    if (!window.roomId || window.roomId.length < 5) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        window.roomId = '';
        for (let i = 0; i < 5; i++) window.roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        location.hash = encodeURIComponent(window.roomId);
    }
    displayId.innerText = window.roomId;
    if (editor.innerText.trim() === "") editor.innerHTML = "";
}

window.moveCursorToEnd = function(el) {
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
};

// --- PREVIEW SYSTEM ---
async function renderInlinePreview(url) {
    let cleanUrl = url.trim().replace(/[.,]$/, ""); 
    
    // Jika user ketik youtube.com, ubah jadi https://youtube.com untuk API & Image check
    if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
    }
    
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) return;
    if (previewContainer.querySelector(`[data-url="${cleanUrl}"]`)) return;

    // Cek apakah itu link gambar (Supabase atau format gambar umum)
    const isImage = /\.(jpeg|jpg|png|gif|webp|svg|avif)(\?.*)?$/i.test(cleanUrl) || 
                    cleanUrl.includes('supabase.co/storage/v1/object/public');

    if (isImage) {
        const card = document.createElement('div');
        card.className = "inline-preview-card animate-fade-in";
        card.setAttribute('data-url', cleanUrl);
        card.innerHTML = `
            <div class="preview-thumb-img flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-2">
                <img src="${cleanUrl}" class="max-h-[120px] rounded object-contain shadow-sm">
            </div>
            <div class="preview-body">
                <div class="preview-title text-blue-500 font-bold italic text-sm">Image Attached</div>
                <div class="preview-site text-[10px] opacity-50 uppercase tracking-widest">${new URL(cleanUrl).hostname}</div>
            </div>`;
        card.onclick = () => window.open(cleanUrl, '_blank');
        previewContainer.appendChild(card);
        return; 
    }

    // Untuk link umum (YouTube, dll)
    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`);
        const json = await response.json();
        if (json.status === 'success') {
            const data = json.data;
            const card = document.createElement('div');
            card.className = "inline-preview-card animate-fade-in";
            card.setAttribute('data-url', cleanUrl); // Gunakan URL yang sudah ada https
            const thumb = data.image ? data.image.url : '';
            card.innerHTML = `
                ${thumb ? `<img src="${thumb}" class="preview-thumb">` : `<div class="w-[220px] min-w-[90px] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-mono">LINK</div>`}
                <div class="preview-body">
                    <div class="preview-title text-sm font-bold">${data.title || 'Link Preview'}</div>
                    <div class="preview-desc text-xs opacity-70">${data.description || 'No description available.'}</div>
                    <div class="preview-site text-[10px]">${new URL(cleanUrl).hostname}</div>
                </div>`;
            card.onclick = () => window.open(cleanUrl, '_blank');
            previewContainer.appendChild(card);
        }
    } catch (err) { console.warn("Microlink skipped."); }
}

// --- FORMATTING (LINK SAJA) ---
function formatLinks(text) {
    if (!text || text.trim() === "") return ""; 
    
    // Regex: Mencari https:// ATAU kata yang punya akhiran domain populer
    const urlRegex = /((https?:\/\/)[^\s\n\r]+)|([a-zA-Z0-9][a-zA-Z0-9-]+\.(com|net|org|id|co.id|io|me|xyz|site|my|edu|gov)(\/[^\s\n\r]*)?)/gi;
    
    const lines = text.split('\n');
    return lines.map(line => {
        if (!line.trim()) return "";
        return line.replace(urlRegex, (url) => {
            let href = url.trim().replace(/[.,;]$/, "");
            let fullLink = href;
            
            // Tambahkan https:// secara otomatis jika tidak ada
            if (!href.match(/^https?:\/\//i)) {
                fullLink = 'https://' + href;
            }

            return `<a href="${fullLink}" target="_blank" rel="noopener" class="text-blue-500 underline break-all font-bold" contenteditable="false">${href}</a>`;
        });
    }).join('<br>');
}
// --- CORE SAVE SYSTEM ---
window.save = async function save() {
    if (isExpired) return;
    window.setStat("⏳");

    // Gunakan innerText untuk data mentah ke database
    const plainText = editor.innerText; 
    
    // EKSTRAK URL: Cari semua link potensial (termasuk yang belum jadi <a>)
    const urlRegex = /((https?:\/\/)[^\s\n\r]+)|([a-zA-Z0-9][a-zA-Z0-9-]+\.(com|net|org|co.id|id|io|me|xyz|site|my|edu|gov)(\/[^\s\n\r]*)?)/gi;
    const matches = plainText.match(urlRegex) || [];
    
    // Bersihkan URL (tambahkan https jika perlu)
    const allUrls = [...new Set(matches)].map(url => {
        let u = url.trim().replace(/[.,;]$/, "");
        return u.match(/^https?:\/\//i) ? u : 'https://' + u;
    });

    // Update Kartu Preview
    const previewContainer = document.getElementById('preview-container');
    const existingCards = previewContainer.querySelectorAll('.inline-preview-card');
    
    // Hapus kartu yang link-nya sudah tidak ada di editor
    existingCards.forEach(card => {
        if (!allUrls.includes(card.getAttribute('data-url'))) card.remove();
    });

    // Render kartu baru
    allUrls.forEach(url => renderInlinePreview(url));

    try {
        await window.client.from('clipboard').upsert({ id: window.roomId, content: plainText });
        window.setStat("✅");
    } catch (err) { window.setStat("❌"); }
}
// --- LISTENERS ---
editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const lines = editor.innerText.split('\n');
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith(':')) {
            const isCommand = Commands.execute(lastLine, editor);
            if (isCommand) { e.preventDefault(); return; }
        }
    }
});

editor.addEventListener('keyup', (e) => {
    // Jika menekan spasi (32) atau Enter (13)
    if (e.keyCode === 32 || e.keyCode === 13) {
        const plainText = editor.innerText;
        const urlRegex = /(https?:\/\/[^\s\n\r]+)/gi;
        
        // Jika ada URL di baris tersebut
        if (urlRegex.test(plainText)) {
            const currentHTML = editor.innerHTML;
            const newHTML = formatLinks(plainText);
            
            if (currentHTML !== newHTML) {
                // Simpan posisi kursor sebelum update
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    // Update editor
                    editor.innerHTML = newHTML;
                    // Paksa kursor ke paling akhir setelah link terbentuk
                    window.moveCursorToEnd(editor);
                }
            }
        }
    }
});

editor.addEventListener('input', () => {
    isTyping = true;
    window.setStat("✍️");
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        window.save();
        isTyping = false;
    }, 1000); 
});

editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertText", false, text);
});

editor.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
        window.open(link.href, '_blank');
    }
});

// --- DATA HANDLING ---
async function connectData() {
    try {
        const { data } = await window.client.from('clipboard').select('*').eq('id', window.roomId).maybeSingle();
        const now = new Date().getTime();

        if (data) {
            window.isTimerStopped = data.is_permanent || false;
            const serverExp = new Date(data.expires_at).getTime();
            if (!window.isTimerStopped && now > serverExp) { await sesi_hancurkan(); return; }
            
            expirationTime = serverExp;
            const content = data.content || "";
            
            if (content.trim() !== "") {
                editor.innerHTML = formatLinks(content);
                setTimeout(() => { window.save(); }, 300);
            }
        } else {
            expirationTime = now + (10 * 60 * 1000);
            await window.client.from('clipboard').upsert({ 
                id: window.roomId, content: "", expires_at: new Date(expirationTime).toISOString(), is_permanent: false
            });
        }
        startTimer();
        subscribeRealtime();
    } catch (err) { console.error("Sync Error"); }
}

function startTimer() {
    if (window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => {
        if (window.isTimerStopped) {
            timerDisplay.innerText = "∞ INFINITY";
            timerDisplay.style.color = "#10b981";
            return; 
        }
        const dist = expirationTime - new Date().getTime();
        if (dist <= 0) { clearInterval(window.timerInterval); sesi_hancurkan(); return; }
        timerDisplay.style.color = "#3b82f6";
        const m = Math.floor(dist / 60000), s = Math.floor((dist % 60000) / 1000);
        timerDisplay.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}

function subscribeRealtime() {
    window.client.channel(`room-${window.roomId}`).on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'clipboard', filter: `id=eq.${window.roomId}` 
    }, payload => {
        if (!isTyping) {
            const newContent = payload.new.content || "";
            if (editor.innerText !== newContent) {
                editor.innerHTML = (newContent.trim() !== "") ? formatLinks(newContent) : "";
                window.save();
            }
        }
    }).subscribe();
}

async function sesi_hancurkan() {
    isExpired = true;
    timerDisplay.innerText = "00:00";
    editor.contentEditable = false;
    
    try {
        const { data: files } = await window.client.storage.from('clip10-images').list(window.roomId);
        if (files && files.length > 0) {
            const filesToDelete = files.map(f => `${window.roomId}/${f.name}`);
            await window.client.storage.from('clip10-images').remove(filesToDelete);
        }
    } catch (e) {}

    await window.client.from('clipboard').delete().eq('id', window.roomId);
    editor.innerHTML = `<div class="mt-20 text-center"><p class="text-slate-400 text-xs mb-4 uppercase">Session Cleared</p><button onclick="window.location.hash=''; window.location.reload();" class="text-xs font-bold text-blue-500 border border-blue-500 px-6 py-2 rounded-full uppercase">New Clip</button></div>`;
}

window.setStat = function(emoji) {
    indicator.innerText = emoji;
    indicator.style.opacity = "1";
    if (emoji === "✅") setTimeout(() => { indicator.style.opacity = "0.3"; indicator.innerText = "⏎"; }, 1500);
}

window.addEventListener('hashchange', () => { location.reload(); });

setupUI();
connectData();