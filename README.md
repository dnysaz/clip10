# ⚡ CLIP10 PROJECT DOCUMENTATION
> **Secure, Real-time, and Ephemeral Sharing with Command-Line Power**

---

## 1. BRAND IDENTITY

* **Name:** Clip10
* **Core Concept:** A secure workspace to drop links, notes and images that vanish in 10 minutes or stay forever.
* **Value Proposition:** Instant sync, zero friction, and powerful terminal-style commands.

---

## 2. TECHNICAL SPECIFICATIONS

* **Frontend:** HTML5, Tailwind CSS (Modern & Dark Mode support).
* **Real-time Engine:** Supabase (PostgreSQL & Realtime Channels).
* **Link Engine:** Custom Regex for **Domain Detection**.
* **Rich Media:** Microlink API for visual link previews.
* **Command Processor:** Custom JS Engine to intercept and execute in-editor commands.
* **QR Generator:** `qrcode.js` for instant cross-device handoff.

---

## 3. FEATURE SET (NEW)

* **Smart Link Detection:** Automatically converts `google.com` or `https://google.com` into clickable blue links.
* **Live Preview:** Visual cards for URLs that appear/disappear in real-time as you edit.
* **Lifetime Mode:** Ability to freeze the timer and prevent data deletion.
* **Local Export:** Download editor content directly as a `.txt` file.

---

## 4. COMMAND-LINE INTERFACE (CLI)

Type these commands in the editor and press **Enter** to execute:

| Command | Action | Description |
| :--- | :--- | :--- |
| `:help` | **Open UI Menu** | Displays the English command reference modal. |
| `:show-qr` | **Share Link** | Generates a QR Code modal for the current session. |
| `:image` | **Share Image** | Upload images to the content. |
| `:save` | **Download** | Exports the current text as a `.txt` file. |
| `:clear` | **Wipe Data** | Deletes all text in the editor and syncs with DB. |
| `:stop-time` | **Freeze Timer** | Activates **∞ INFINITY** mode (Saved to DB). |
| `:start-time` | **Resume Timer** | Restores the 10-minute countdown logic. |

---

## 5. PROJECT STRUCTURE

| File | Description |
| :--- | :--- |
| `index.html` | UI structure, SEO, and Modal animation styles. |
| `command.js` | Logic for CLI, Modal UI, and File Download. |
| `app.js` | Core engine: Supabase sync, Smart Link coloring, and Timer. |
| `config.js` | API Keys and Environment Variables. |

---

## 6. DATABASE SCHEMA (Supabase)

**Table:** `clipboard`

* `id` (text, primary key)
* `content` (text)
* `expires_at` (timestamptz)
* **`is_permanent`** (bool, default: `false`) — *New Column for Lifetime mode.*

---

*Built with passion for privacy and efficiency.*