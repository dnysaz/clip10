/**
 * command.js - Clip10 Advanced Command System
 */
const Commands = {
    execute(cmd, editorElement) {
        const cleanCmd = cmd.toLowerCase().trim();

        switch (cleanCmd) {
            case ':help':
                this.showHelp();
                return true;
            case ':show-qrcode':
                this.showQRCode();
                return true;
            case ':clear':
                this.clearEditor(editorElement);
                return true;
            case ':stop-time':
                this.toggleTimer(false);
                return true;
            case ':start-time':
                this.toggleTimer(true);
                return true;
            default:
                return false;
        }
    },

    // Create a base modal for UI commands
    createModal(id, contentHTML) {
        // Remove existing if any
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = id;
        modal.className = "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/10 dark:bg-black/20 backdrop-blur-md animate-fade-in";
        modal.innerHTML = `
            <div class="bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative animate-scale-up">
                <button onclick="this.parentElement.parentElement.remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
                ${contentHTML}
            </div>`;
        document.body.appendChild(modal);
    },

    showHelp() {
        const helpHTML = `
            <h2 class="text-xl font-black mb-4 text-slate-900 dark:text-white">COMMANDS</h2>
            <ul class="space-y-3 text-sm font-mono">
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500">:help</span>
                    <span class="text-slate-400">Show this menu</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500">:show-qrcode</span>
                    <span class="text-slate-400">Share via QR Code</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500">:clear</span>
                    <span class="text-slate-400">Wipe all text</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500">:stop-time</span>
                    <span class="text-slate-400">Lifetime mode</span>
                </li>
                <li class="flex justify-between pb-2">
                    <span class="text-blue-500">:start-time</span>
                    <span class="text-slate-400">Resume timer</span>
                </li>
            </ul>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-6 bg-slate-900 dark:bg-white dark:text-black text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest">Got it</button>
        `;
        this.createModal('help-modal', helpHTML);
    },

    showQRCode() {
        const url = window.location.href;
        const qrHTML = `
            <h2 class="text-xl font-black mb-4 text-center text-slate-900 dark:text-white uppercase tracking-tighter">Scan to Sync</h2>
            <div class="flex justify-center bg-white p-4 rounded-2xl">
                <canvas id="qrcode-canvas"></canvas>
            </div>
            <p class="mt-4 text-[10px] font-mono text-center text-slate-400 break-all bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">${url}</p>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-6 bg-blue-500 text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest">Close</button>
        `;
        this.createModal('qr-modal', qrHTML);
        setTimeout(() => {
            if (window.QRCode) {
                QRCode.toCanvas(document.getElementById('qrcode-canvas'), url, { 
                    width: 240,
                    margin: 0,
                    color: { dark: '#0f172a', light: '#ffffff' }
                });
            }
        }, 50);
    },

    // Tambahkan ini di dalam objek Commands di command.js
    clearEditor(editor) {
        editor.innerHTML = "";
        editor.innerText = "";
        // Paksa simpan konten kosong ke database
        if (typeof save === 'function') {
            // Beri sedikit delay agar DOM benar-benar bersih sebelum save
            setTimeout(() => {
                save(); 
                console.log("Editor cleared and synced.");
            }, 50);
        }
    },

    // clearEditor(editor) {
    //     editor.innerHTML = "";
    //     // Simpan perubahan ke DB (biar terhapus di HP lain juga)
    //     if (typeof save === 'function') save(); 
    // },

    async toggleTimer(shouldRun) {
        window.isTimerStopped = !shouldRun;
        const display = document.getElementById('timer');
        
        if (!shouldRun) {
            display.innerText = "∞ INFINITY";
            display.style.color = "#10b981"; // Hijau
        } else {
            display.style.color = "#3b82f6"; // Biru
        }

        // UPDATE KE SUPABASE: Agar permanen saat reload
        try {
            await client.from('clipboard')
                .update({ is_permanent: !shouldRun })
                .eq('id', roomId); 
            console.log("Status permanent synced to DB");
        } catch (err) { 
            console.error("Failed to sync timer status:", err); 
        }
    }
};