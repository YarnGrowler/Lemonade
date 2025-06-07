# 📄 Discord Cryptochat (SecureDM) - Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2025-01-07

### 🎉 New Features

- **Aesthetic Chinese Text Spacing**: Messages now appear with natural spacing between Chinese characters for better readability
- **Compressed Encryption**: Implemented text compression to significantly reduce encrypted message length
- **Hotkey Support**:
  - `Ctrl+Shift+E`: Toggle auto-encrypt on/off
  - `Ctrl+Shift+D`: Toggle entire extension on/off
- **Version Display**: Extension version now shown in popup UI
- **Base64URL Encoding**: More compact encoding reduces message size by ~25%

### 🔧 Improvements

- **Shorter Encrypted Messages**: "hi" now encrypts to much smaller Chinese text
- **Better Error Handling**: More robust method binding and error recovery
- **Enhanced Debugging**: Added method validation and version logging
- **Natural Text Appearance**: Chinese characters now spaced like natural conversation

### 🐛 Bug Fixes

- Fixed `isAlreadyEncrypted is not a function` error through proper method binding
- Improved extension reload detection and handling
- Better compatibility with Discord's Slate editor

### ⚡ Performance

- Reduced encryption overhead through compression
- More efficient base64url encoding
- Optimized character spacing algorithm

---

## [1.1.0] - 2025-01-06

### 🎉 New Features

- **Auto-Encrypt Toggle**: Added toggle button in popup to automatically encrypt ALL messages
- **Stealth Encoding**: Messages now appear as natural Chinese text instead of suspicious `ENC:` prefix
- **Comprehensive Decryption**:
  - Real-time decryption of new messages
  - Periodic scanning of all messages every 3 seconds
  - Page load scanning for existing messages
- **Professional UI**: Complete popup redesign with Google/Apple-style interface

### 🔧 Improvements

- **Toggle Synchronization**: Real-time sync between popup and content script
- **Visual Indicators**: Added 🔓 icons for decrypted messages
- **Better Message Detection**: Enhanced message scanning with mutation observers
- **Stealth Communications**: Messages look like normal Chinese conversation

### 🐛 Bug Fixes

- Fixed infinite loop when processing own encrypted messages
- Resolved Discord Slate editor compatibility issues
- Fixed clipboard-based text replacement method
- Improved send button detection and triggering

---

## [1.0.0] - 2025-01-05

### 🎉 Initial Release

- **Core Encryption**: AES-GCM encryption with PBKDF2 key derivation
- **Message Interception**: Automatic detection of `!priv` prefixed messages
- **Options Page**: Secure key storage and configuration
- **Content Script**: Discord message box integration
- **Extension Icons**: Professional purple gradient lock icons (16px, 48px, 128px)

### ✅ Core Features

- End-to-end encryption for Discord messages
- `!priv message` syntax for selective encryption
- Chrome Manifest v3 compatibility
- Local key storage with chrome.storage API
- Professional UI with extension popup

### 🔒 Security

- Client-side only encryption (Discord never sees plaintext)
- AES-GCM 256-bit encryption
- PBKDF2 key derivation with 100,000 iterations
- No data transmission to external servers

---

## Upcoming Features 🚀

### Planned for v1.3.0

- **Multi-Key Support**: Different keys for different servers/DMs
- **Message Expiry**: Auto-delete encrypted messages after time
- **File Encryption**: Encrypt and decrypt file uploads
- **Key Exchange**: Secure key sharing between users
- **Mobile Support**: Discord mobile app compatibility research

### Long-term Roadmap

- **Group Encryption**: Multi-user encrypted channels
- **Perfect Forward Secrecy**: Rotating encryption keys
- **Audit Mode**: Encryption/decryption logging for verification
- **Plugin System**: Third-party encryption algorithm support

---

## Installation & Usage

1. **Load Extension**: Load as unpacked extension in Chrome (`chrome://extensions/`)
2. **Set Key**: Open extension options and set your encryption key
3. **Auto-Encrypt**: Toggle auto-encrypt in popup or use `Ctrl+Shift+E`
4. **Manual Encryption**: Type `!priv your message` for selective encryption
5. **Hotkeys**: Use `Ctrl+Shift+D` to toggle extension on/off

## Security Notice ⚠️

This extension is for personal use between trusted users only. It does not protect against:

- Physical device compromise or screen capture
- Discord client modifications or malware
- Man-in-the-middle attacks during key exchange
- Government or corporate surveillance at endpoints

Always verify the integrity of your installation and use strong, unique encryption keys.
