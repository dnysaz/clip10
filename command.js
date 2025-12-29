/**
 * command.js - Clip10 Advanced Command System (Synced & Optimized)
 */
const Commands = {
    execute(cmd, editorElement) {
        const cleanCmd = cmd.toLowerCase().trim();

        switch (cleanCmd) {
            case ':help':
                this.showHelp();
                return true;
            case ':show-qr':
                this.showQRCode();
                return true;
            case ':clear':
                this.clearEditor(editorElement);
                return true;
            case ':save':
                this.downloadNote(editorElement);
                return true;
            case ':stop-time':
                this.toggleTimer(false);
                return true;
            case ':start-time':
                this.toggleTimer(true);
                return true;
            case ':image':
                this.uploadImage(editorElement);
                return true;
            default:
                return false;
        }
    },

    downloadNote(editor) {
        const text = editor.innerText;
        if (!text || text.trim() === "") {
            window.setStat("⚠️");
            return;
        }

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `clip10-${window.roomId}-${timestamp}.txt`;
        
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.setStat("💾");
    },

    createModal(id, contentHTML) {
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = id;
        modal.className = "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in";
        modal.innerHTML = `
            <div class="bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative animate-scale-up">
                <button onclick="this.parentElement.parentElement.remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
                ${contentHTML}
            </div>`;
        document.body.appendChild(modal);
    },

    showHelp() {
        const helpHTML = `
            <h2 class="text-xl font-black mb-4 text-slate-900 dark:text-white uppercase italic">Help Menu</h2>
            <ul class="space-y-3 text-sm font-mono">
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:help</span>
                    <span class="text-slate-400">Show help menu</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:image</span>
                    <span class="text-slate-400">Upload & Share Image</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:show-qr</span>
                    <span class="text-slate-400">Display QR Code</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:save</span>
                    <span class="text-slate-400">Download as .txt</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:stop-time</span>
                    <span class="text-slate-400">Permanent mode</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:start-time</span>
                    <span class="text-slate-400">Activate 10m timer</span>
                </li>
                <li class="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-blue-500 font-bold">:clear</span>
                    <span class="text-slate-400">Wipe all content</span>
                </li>
            </ul>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-6 bg-slate-900 dark:bg-white dark:text-black text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-colors">Got it</button>
        `;
        this.createModal('help-modal', helpHTML);
    },

    showQRCode() {
        const url = window.location.href;
        const qrHTML = `
            <h2 class="text-xl font-black mb-4 text-center text-slate-900 dark:text-white uppercase tracking-tighter italic">Sync Device</h2>
            <div class="flex justify-center bg-white p-4 rounded-2xl">
                <canvas id="qrcode-canvas"></canvas>
            </div>
            <p class="mt-4 text-[10px] font-mono text-center text-slate-400 break-all bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">${url}</p>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-6 bg-slate-900 dark:bg-white dark:text-black text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest">Close</button>
        `;
        this.createModal('qr-modal', qrHTML);
        setTimeout(() => {
            if (window.QRCode) {
                QRCode.toCanvas(document.getElementById('qrcode-canvas'), url, { width: 220, margin: 0 });
            }
        }, 50);
    },

    clearEditor(editor) {
        editor.innerHTML = "";
        if (typeof window.save === 'function') window.save();
        window.setStat("🧹");
    },

    async toggleTimer(shouldRun) {
        window.isTimerStopped = !shouldRun;
        window.setStat(shouldRun ? "⏳" : "∞");
        try {
            await window.client.from('clipboard')
                .update({ is_permanent: !shouldRun })
                .eq('id', window.roomId); 
        } catch (err) { console.error(err); }
    },

    async uploadImage(editor) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            editor.innerHTML = editor.innerHTML.replace(/:image/gi, '').trim();

            let progress = 0;
            const progressInterval = setInterval(() => {
                if (progress < 95) {
                    progress += Math.floor(Math.random() * 15) + 5;
                    if (progress > 95) progress = 95;
                    window.setStat(progress + "%");
                }
            }, 500);

            try {
                const fileName = file.name.replace(/\s+/g, '-');
                const filePath = `${window.roomId}/${Date.now()}-${fileName}`;

                const { data, error } = await window.client.storage.from('clip10-images').upload(filePath, file);
                if (error) throw error;

                const { data: publicURLData } = window.client.storage.from('clip10-images').getPublicUrl(filePath);
                const publicURL = publicURLData.publicUrl;

                clearInterval(progressInterval);
                window.setStat("✅");

                // KUNCI: Gunakan publicURL sebagai teks tampilan link
                const linkHTML = `<br><a href="${publicURL}" target="_blank" rel="noopener" class="text-blue-500 underline break-all font-bold" contenteditable="false">${publicURL}</a><br>&#8203;`;
                editor.insertAdjacentHTML('beforeend', linkHTML);

                if (window.moveCursorToEnd) window.moveCursorToEnd(editor);
                if (window.save) window.save();

            } catch (error) {
                clearInterval(progressInterval);
                window.setStat("❌");
            }
        };
        input.click();
    }
};