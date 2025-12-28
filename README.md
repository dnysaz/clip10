# ⚡ CLIP10 PROJECT DOCUMENTATION
> **Secure, Real-time, and Ephemeral Sharing**

---

## 1. BRAND IDENTITY

* **Name:** Clip10
* **Core Concept:** A secure workspace to drop links and notes that vanish in 10 minutes.
* **Value Proposition:** Zero friction, zero logs, total privacy.

---

## 2. TECHNICAL SPECIFICATIONS

* **Frontend:** Built with **HTML5** and **Tailwind CSS** for a modern, responsive UI.
* **Real-time Engine:** Powered by **Supabase** for instant cross-device synchronization.
* **Link Enrichment:** Integrated with **Microlink API** to generate visual cards for shared URLs.
* **Auto-Destruction:** Custom JavaScript logic to purge data from the database after a 10-minute countdown.

---

## 3. SYSTEM REQUIREMENTS

* Supabase Account (Database & Realtime enabled).
* Web Browser (Chrome, Safari, or Firefox).
* Internet Connection.

---

## 4. PROJECT STRUCTURE

| File | Description |
| :--- | :--- |
| `index.html` | The main user interface and SEO-optimized metadata. |
| `app.js` | Core logic for syncing, timer management, and link previews. |
| `config.js` | Storage for API credentials. |
| `README.md` | Documentation for GitHub. |

---

## 5. FUTURE ROADMAP

1.  **Burn on Read:** Implementation of a feature where data deletes immediately after being viewed.
2.  **End-to-End Encryption:** Enhanced security for sensitive text data.
3.  **PWA Support:** Progressive Web App for mobile installation.

---
*Built with passion for privacy.*