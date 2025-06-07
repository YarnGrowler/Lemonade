📄 Discord Encryption Browser Extension – Requirements Document
🔧 Project Title:
Discord Cryptochat (SecureDM)

🧠 Summary
This browser extension provides end-to-end encryption for Discord messages between trusted users. It encrypts messages before sending and decrypts them automatically on display, allowing only users with the shared key to read meaningful content. To the outside world, messages appear as encrypted blobs.

🎯 Objectives
Encrypt outgoing messages before they're sent to Discord servers.

Automatically decrypt incoming messages that match a specific pattern.

Use a shared secret key stored locally via browser extension options.

Ensure all encryption/decryption happens client-side.

Function as a Chrome extension that can be shared via ZIP file.

🛠️ Functional Requirements
✅ 1. Outgoing Message Interception & Encryption
Trigger:
User types in Discord message box (provided DOM element).

Presses Enter.

Action:
Detect keydown on the following:

html
Copy
Edit

<div role="textbox" ... data-slate-editor="true" contenteditable="true">
On Enter key:

Get message text from the editable div.

If the message starts with !priv, remove the prefix and encrypt the remaining text using AES (with a shared key stored locally).

Replace the content in the text box with a format like:

txt
Copy
Edit
ENC:<base64 encrypted payload>
Dispatch synthetic Enter key event to submit the message through the native flow.

✅ 2. Incoming Message Detection & Decryption
Message DOM Target:
Observe mutations under:

html
Copy
Edit

<ol class="scrollerInner__36d07" aria-label="Messages in ..." role="list">
Detect newly added <li class="messageListItem__5126c"> nodes.

Decryption Flow:
For each new message:

Get content from:

html
Copy
Edit

<div class="markup__75297 messageContent_c19a55">
If it starts with ENC::

Extract base64 payload.

Decrypt using the stored shared key.

Replace .textContent with the decrypted plain text.

Optional: visually mark as "decrypted" (e.g. small lock icon).

✅ 3. Shared Key Configuration
Include an options page (options.html) in the extension.

Field to set/update a shared encryption key (stored in chrome.storage.local).

Optional: allow choosing AES mode, show fingerprint of key, or test encryption.

✅ 4. Extension Packaging
Must be installable as a ZIP Chrome extension:

Manifest v3

Scripts: content.js, crypto.js, options.html, background.js (if needed)

🔒 Security Considerations
All encryption happens client-side. Discord never sees plaintext.

Only users with the shared key can decrypt.

AES-GCM encryption using crypto.subtle API.

Consider optional support for auto-delete or message expiry later.

🚫 Non-Goals
Not compatible with mobile Discord app.

Not intended to bypass Discord TOS; should be for personal, trusted use only.

Does not protect against screen snooping or physical device compromise.

🧪 Optional Enhancements (Future)
Toggle encryption on/off with a button in Discord UI.

Support multiple profiles or keys (per server/DM).

Detect whether friend decrypted successfully (ack ping).

Encrypt file/image uploads (with client decryption).

📁 File Structure (Minimum Viable)
pgsql
Copy
Edit
discord-cryptochat-extension/
├── manifest.json
├── content.js // Message send/receive hooks
├── crypto.js // AES helpers
├── options.html // Key input UI
├── options.js // Key storage logic
└── style.css // Simple styles (optional)
✅ Example Flow (User Perspective)

1. Setup:

User installs extension, opens options, enters a shared secret.

2. Sending:

Types !priv hey man we on at 7?

Extension intercepts on Enter → encrypts hey man we on at 7?

Sends message: ENC:<base64>

3. Receiving:

Friend’s extension sees ENC:<base64>, decrypts, and replaces text with:

“hey man we on at 7?”
