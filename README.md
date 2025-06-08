# Discord Cryptochat (SecureDM) - Simplified Version

🔐 **End-to-end encryption for Discord messages with simplified user key discovery**

## 🎯 Overview

This is a **completely simplified** version of the Discord encryption extension that:

- Uses a **hardcoded static key** as the base encryption method
- **Automatically discovers** public keys from other users' messages
- **Stores user-key pairs** for future encryption
- Uses the **most recent discovered key** when encrypting messages
- Falls back to **static key** when no user keys are available
- **Comprehensive logging** for debugging and transparency

## 🔧 How It Works

### 🔑 Key Strategy (SIMPLE!)

1. **Static Fallback Key**: Every user has a hardcoded static keypair stored locally
2. **User Discovery**: When you receive an encrypted message, it contains the sender's public key
3. **Automatic Storage**: The extension automatically stores `userId -> publicKey` mappings
4. **Smart Encryption**: When sending a message, use the most recent user key or fall back to static

### 📤 Outgoing Messages

```
User types: "hello" or "!priv hello"
↓
Extension finds most recent user key OR uses static key
↓
Encrypts with chosen key
↓
Encodes as Chinese characters (stealth mode)
↓
Sends to Discord
```

### 📨 Incoming Messages

```
Receives Chinese-looking message
↓
Detects it's encrypted (70%+ Chinese characters)
↓
Decodes Chinese back to encrypted format
↓
Extracts sender's public key and stores it
↓
Decrypts with your static private key
↓
Shows decrypted message with 🔐 indicator
```

## 🚀 Installation

1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. The extension will automatically initialize on Discord

## 📋 Usage

### Basic Operation

- **Automatic Mode**: Turn on auto-encrypt in options, then all messages are encrypted
- **Manual Mode**: Type `!priv your message` to encrypt a specific message
- **Hotkeys**:
  - `Ctrl+Shift+E`: Toggle auto-encrypt mode
  - `Ctrl+Shift+D`: Toggle extension on/off

### User Discovery Process

1. **First Contact**: You and your friend both install the extension
2. **Send Message**: One person sends an encrypted message (contains their public key)
3. **Key Exchange**: The receiver automatically stores the sender's public key
4. **Future Messages**: All future messages between you use each other's keys
5. **Fallback Safety**: If something goes wrong, always falls back to static key

## 🔍 Logging & Debug

The simplified system has **comprehensive logging**:

```javascript
🔐 [EC] 👤 NEW USER DISCOVERED!
🔐 [EC] 🆔 User ID: 1234567890
🔐 [EC] 👤 Username: FriendName
🔐 [EC] 🔑 Key ID: TUZrd0V3WUhL
🔐 [EC] 📊 Total users: 1

🔐 [EC] 📤 ENCRYPTING MESSAGE...
🔐 [EC] 📝 Message: hello world
🔐 [EC] 🎯 Recipient: 1234567890
🔐 [EC] 🔑 Using specific user key for: 1234567890
🔐 [EC] ✅ ENCRYPTION SUCCESS!

🔐 [EC] 📨 DECRYPTING MESSAGE...
🔐 [EC] 📦 Encrypted data length: 184
🔐 [EC] 👤 Sender: 1234567890
🔐 [EC] ✅ DECRYPTION SUCCESS!
🔐 [EC] 📝 Decrypted: hello world
```

## 🛠️ Technical Details

### File Structure

```
discord-cryptochat-extension/
├── manifest.json              # Extension configuration
├── content.js                 # Main Discord integration (1200 lines → simplified)
├── ec-crypto.js               # Core encryption (400 lines → 350 lines, simplified)
├── ec-message-processor.js    # Message processing (400 lines → 280 lines, simplified)
├── asymmetric-content.js      # Integration layer (400 lines → 200 lines, simplified)
├── crypto.js                  # Symmetric encryption fallback
├── options.html/js            # Settings page
├── popup.html/js              # Quick access popup
└── icons/                     # Extension icons
```

### Encryption Flow

1. **Static Key Generation**: On first run, generates ECDH P-256 keypair
2. **Message Format**: `EC:encryptedData:PK:senderPublicKey:keyId`
3. **Chinese Encoding**: Converts to Chinese characters for stealth
4. **User Storage**: Maps Discord UserID → {publicKey, keyId, username, lastSeen}
5. **Key Selection**: Always uses most recent user key, falls back to static

### Security Features

- **ECDH P-256**: Industry-standard elliptic curve encryption
- **AES-GCM**: Authenticated encryption for message content
- **Key Isolation**: Each user's keys are stored separately
- **Forward Compatibility**: Can add new users without breaking existing ones
- **Fallback Safety**: Always has static key as backup

## 🐛 Troubleshooting

### Common Issues

1. **No Decryption**: Check if both users have extension installed
2. **Key Not Found**: Look for "USER DISCOVERED" logs in console
3. **Encryption Failed**: Verify extension is enabled (Ctrl+Shift+D)
4. **Message Corruption**: Refresh Discord page and try again

### Debug Commands

Open browser console on Discord and run:

```javascript
// Test the crypto system
window.testCrypto();

// Check current status
window.ecCrypto.getStatus();

// List discovered users
window.ecCrypto.getUserList();

// Clear all stored users (emergency reset)
window.ecCrypto.clearAllUsers();

// Manual encryption test
window.ecCrypto.encrypt("test message");
```

## 🔒 Privacy & Security

- **Local Storage Only**: All keys stored locally in browser
- **No Cloud/Server**: No data sent to external servers
- **Discord Blind**: Discord sees only Chinese characters
- **P2P Encryption**: Direct encryption between users
- **Open Source**: All code is readable and auditable

## 📞 Contact Detection Example

```
User A sends message → Contains public key → User B stores it
User B sends reply → Uses User A's stored key → User A gets message
Now both users have each other's keys for future messaging!
```

## ⚠️ Important Notes

- **Both users need the extension** for encrypted communication
- **Keys are device-specific** - each browser/device has its own keys
- **No message recovery** if keys are lost (clear browser data)
- **For trusted contacts only** - not meant to bypass Discord ToS
- **Educational/Personal Use** - use responsibly

---

🔐 **Simple. Robust. Straightforward.** Just like you asked!
