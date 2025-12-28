/**
 * clip10 - Integrated Command & Timer Version
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
window.isTimerStopped = false; // Flag untuk command :stop-time

function setupUI() {
    if (!roomId || roomId.length < 5) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        roomId = '';
        for (let i = 0; i < 5; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        location.hash = encodeURIComponent(roomId);
    }
    displayId.innerText = roomId;
}

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

function formatLinks(text) {
    if (!text || text.trim() === "") return ""; 

    // Regex baru: Mencari yang diawali http ATAU yang punya format domain (misal google.com)
    const urlRegex = /((https?:\/\/)[^\s]+|(?<![\w])[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?[^\s]*)/gi;
    
    return text.split('\n').map(line => {
        return line.replace(urlRegex, (url) => {
            // Cek apakah link punya protokol http/https
            let href = url;
            if (!/^https?:\/\//i.test(url)) {
                href = 'https://' + url; // Tambahkan https:// otomatis agar bisa diklik
            }
            
            // Bersihkan titik atau koma di akhir link jika ada (biasanya karena tanda baca kalimat)
            href = href.replace(/[.,]$/, "");
            const displayUrl = url.replace(/[.,]$/, "");

            return `<a href="${href}" target="_blank" rel="noopener" class="text-blue-500 underline" contenteditable="false">${displayUrl}</a>`;
        });
    }).join('<br>');
}

async function save() {
    if (isExpired) return;
    setStat("⏳");

    const plainText = editor.innerText;
    const previewContainer = document.getElementById('preview-container');

    const matches = plainText.match(/((https?:\/\/)[^\s]+|(?<![\w])[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?[^\s]*)/gi) || [];
    const uniqueUrls = [...new Set(matches.map(url => {
        let clean = url.trim().replace(/[.,]$/, "");
        // Tambahkan protokol jika tidak ada agar API preview tidak error
        return /^https?:\/\//i.test(clean) ? clean : 'https://' + clean;
    }))];

    const existingCards = previewContainer.querySelectorAll('.inline-preview-card');
    existingCards.forEach(card => {
        const cardUrl = card.getAttribute('data-url');
        if (!uniqueUrls.includes(cardUrl)) card.remove();
    });

    uniqueUrls.forEach(url => renderInlinePreview(url));

    // --- LIVE COLORING (Link jadi biru instan) ---
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && isTyping) {
        const range = selection.getRangeAt(0);
        const formatted = formatLinks(plainText);
        
        // Hanya update jika tampilan berbeda (mencegah kedipan/jump kursor)
        if (editor.innerHTML !== formatted) {
            // Simpan posisi offset kursor relatif terhadap kontainer
            const offset = range.startOffset;
            
            editor.innerHTML = formatted;

            // Kembalikan kursor ke posisi paling akhir (paling aman untuk mobile)
            const newRange = document.createRange();
            newRange.selectNodeContents(editor);
            newRange.collapse(false); // false berarti di akhir
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

// --- EVENT LISTENERS ---

editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // Ambil baris terakhir sebelum Enter diproses
        const lines = editor.innerText.split('\n');
        const lastLine = lines[lines.length - 1].trim();

        if (lastLine.startsWith(':')) {
            const isCommand = Commands.execute(lastLine, editor);
            if (isCommand) {
                e.preventDefault();
                
                // Jika bukan :clear, kita hapus teks command-nya
                if (lastLine.toLowerCase() !== ':clear') {
                    const fullText = editor.innerText;
                    const pos = fullText.lastIndexOf(lastLine);
                    editor.innerText = fullText.substring(0, pos).trim();
                }
                
                if (editor.innerText.trim() === "") editor.innerHTML = "";
                return;
            }
        }
        
        // PENTING: Untuk mencegah kursor melompat ke atas saat ENTER:
        // Kita kunci isTyping dan jangan panggil save() secara instan
        isTyping = true;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            save();
            setTimeout(() => { isTyping = false; }, 2000);
        }, 1500); // Beri jeda lebih lama setelah Enter
    }
});

editor.addEventListener('input', () => {
    isTyping = true;
    setStat("✍️");
    
    if (editor.innerText.trim() === "") {
        editor.innerHTML = "";
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        save();
        setTimeout(() => { isTyping = false; }, 2000);
    }, 1000); 
});

editor.addEventListener('input', () => {
    isTyping = true;
    setStat("✍️");
    if (editor.innerText.trim() === "") editor.innerHTML = "";
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

editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') window.open(e.target.href, '_blank');
});

// --- SUPABASE & TIMER ---

async function connectData() {
    try {
        // Ambil semua kolom termasuk is_permanent
        const { data } = await client.from('clipboard').select('*').eq('id', roomId).maybeSingle();
        const now = new Date().getTime();

        if (data) {
            // SET STATUS PERMANEN DARI DB
            window.isTimerStopped = data.is_permanent || false;
            
            const serverExp = new Date(data.expires_at).getTime();
            
            // Cek kadaluwarsa HANYA jika TIDAK permanen
            if (!window.isTimerStopped && now > serverExp) { 
                await sesi_hancurkan(); 
                return; 
            }
            
            expirationTime = serverExp;
            const content = data.content || "";
            editor.innerHTML = (content.trim() !== "") ? formatLinks(content) : "";
        } else {
            // Room Baru
            expirationTime = now + (10 * 60 * 1000);
            await client.from('clipboard').upsert({ 
                id: roomId, 
                content: "", 
                expires_at: new Date(expirationTime).toISOString(),
                is_permanent: false // Default false
            });
        }
        startTimer();
        subscribeRealtime();
    } catch (err) { console.error("Connection Error"); }
}


function startTimer() {
    if (window.timerInterval) clearInterval(window.timerInterval);
    
    window.timerInterval = setInterval(() => {
        const display = document.getElementById('timer');
        
        // JIKA STATUS PERMANEN: Hentikan hitung mundur & ganti teks
        if (window.isTimerStopped) {
            display.innerText = "∞ INFINITY";
            display.style.color = "#10b981";
            return; 
        }

        const dist = expirationTime - new Date().getTime();
        if (dist <= 0) { 
            clearInterval(window.timerInterval); 
            sesi_hancurkan(); 
            return; 
        }
        
        display.style.color = "#3b82f6";
        const m = Math.floor(dist / 60000), s = Math.floor((dist % 60000) / 1000);
        display.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

window.addEventListener('hashchange', () => {
    const newRoomId = decodeURIComponent(location.hash.slice(1));
    if (newRoomId && newRoomId !== roomId) {
        roomId = newRoomId;
        displayId.innerText = roomId;
        editor.innerHTML = "";
        const pc = document.getElementById('preview-container');
        if (pc) pc.innerHTML = "";
        connectData();
    }
});

setupUI();
connectData();