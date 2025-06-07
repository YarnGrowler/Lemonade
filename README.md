# 🔐 Discord Cryptochat (SecureDM)

A Chrome browser extension that provides end-to-end encryption for Discord messages between trusted users.

## ✨ Features

- **End-to-End Encryption**: Messages are encrypted client-side using AES-GCM before being sent to Discord
- **Automatic Decryption**: Incoming encrypted messages are automatically decrypted and displayed
- **Shared Key System**: Uses a shared secret key that you set with your trusted contacts
- **Visual Indicators**: Decrypted messages show a small unlock icon for identification
- **Easy to Use**: Simply type `!priv` before your message to encrypt it
- **Secure**: All encryption happens in your browser - Discord never sees the plaintext

## 🚀 Installation

### Method 1: Load as Unpacked Extension (Recommended)

1. **Download the Extension**

   - Download all the extension files to a folder on your computer

2. **Open Chrome Extensions**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)

3. **Load the Extension**

   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Set Your Encryption Key**
   - The options page will open automatically
   - Enter a shared secret key (minimum 8 characters)
   - Share this exact key with your trusted contacts
   - Click "Save Encryption Key"

### Method 2: Package as ZIP

1. Create a ZIP file containing all extension files
2. Load as unpacked extension using the extracted folder

## 🔧 Setup

1. **Configure Your Key**

   - Click the extension icon in Chrome's toolbar
   - Click "Open Settings"
   - Enter your shared encryption key
   - Make sure your contacts use the exact same key

2. **Test the Extension**
   - Click "Test Encryption" to verify everything works
   - You should see a success message if configured correctly

## 💬 Usage

### Sending Encrypted Messages

1. Go to Discord in your browser
2. In any chat, type your message with the `!priv` prefix:
   ```
   !priv This message will be encrypted!
   ```
3. Press Enter - the message will be automatically encrypted and sent as:
   ```
   ENC:<encrypted_base64_string>
   ```

### Receiving Encrypted Messages

- Messages starting with `ENC:` will be automatically decrypted
- Successfully decrypted messages show a small 🔓 icon
- Failed decryption attempts show an error message in red

## 🔒 Security Notes

- **Share Keys Securely**: Only share your encryption key through secure channels
- **Key Storage**: Keys are stored locally in your browser
- **Client-Side Only**: All encryption/decryption happens in your browser
- **Discord Compatibility**: This doesn't violate Discord's ToS as it's for personal use
- **Limited Protection**: Doesn't protect against screen capture or physical device access

## 🛠️ Files Structure

```
discord-cryptochat-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main functionality (message handling)
├── crypto.js             # Encryption/decryption utilities
├── options.html          # Settings page
├── options.js            # Settings page logic
├── popup.html            # Extension popup
├── popup.js              # Popup logic
├── background.js         # Background service worker
├── style.css             # Visual styling
└── README.md             # This file
```

## 🚨 Important Warnings

- **Backup Your Key**: Store your encryption key securely - if lost, you cannot decrypt old messages
- **Trusted Contacts Only**: Only use with people you trust completely
- **Not Mobile Compatible**: Only works in Chrome browser, not Discord mobile app
- **Beta Software**: This is experimental software - use at your own risk

## 🎯 How It Works

1. **Outgoing Messages**: When you type `!priv <message>`, the extension:

   - Intercepts the Enter key press
   - Encrypts your message using AES-GCM
   - Replaces the message with `ENC:<base64_encrypted_data>`
   - Sends the encrypted message through Discord's normal flow

2. **Incoming Messages**: The extension monitors for new messages:
   - Detects messages starting with `ENC:`
   - Attempts to decrypt using your stored key
   - Replaces the encrypted text with the decrypted message
   - Adds a visual indicator

## 🔧 Troubleshooting

**Extension not working?**

- Make sure you're on discord.com (not the desktop app)
- Check that the extension is enabled in Chrome
- Verify your encryption key is set

**Messages not decrypting?**

- Ensure you and your contact have the exact same key
- Check browser console for error messages
- Try the "Test Encryption" feature

**Can't see encrypted messages?**

- Refresh the Discord page
- Check if the extension indicator (🔐) appears in the top-right

## 📝 Version History

- **v1.0.0**: Initial release with core encryption functionality

## ⚖️ Legal & Compliance

This extension is for personal use between consenting adults. Users are responsible for compliance with local laws and Discord's Terms of Service. The developers are not liable for any misuse or legal issues arising from the use of this software.

---

**Made with ❤️ for privacy-conscious Discord users**
