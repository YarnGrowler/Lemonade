/**
 * Discord Cryptochat - Simplified Message Processor
 * Simple encoding/decoding with user key discovery
 */

class ECMessageProcessor {
  constructor() {
    this.ecCrypto = null;
    this.messagePrefix = 'EC:';
    this.isEnabled = false;
    
    console.log('🔐 [MSG] Initializing simplified message processor...');
    this.init();
  }

  async init() {
    try {
      // Wait for ecCrypto to be available
      if (typeof window.ecCrypto !== 'undefined') {
        this.ecCrypto = window.ecCrypto;
        this.isEnabled = true;
        console.log('🔐 [MSG] ✅ Message processor initialized');
      } else {
        setTimeout(() => this.init(), 500);
      }
    } catch (error) {
      console.error('🔐 [MSG] ❌ Failed to initialize:', error);
    }
  }

  // ==================== MESSAGE ENCRYPTION ====================

  async encryptMessage(plaintext, recipientUserId = null) {
    if (!this.isEnabled || !this.ecCrypto) {
      throw new Error('Message processor not initialized');
    }

    console.log('🔐 [MSG] 📤 ENCRYPTING MESSAGE...');
    console.log('🔐 [MSG] 📝 Text:', plaintext);
    console.log('🔐 [MSG] 🎯 Recipient:', recipientUserId || 'auto-detect');

    try {
      // Encrypt using ECCrypto
      const encryptedData = await this.ecCrypto.encrypt(plaintext, recipientUserId);
      
      // Format: EC:encryptedData:PK:senderPublicKey:keyId
      const formattedMessage = `${this.messagePrefix}${encryptedData.encrypted}:PK:${encryptedData.senderPublicKey}:${encryptedData.keyId}`;
      
      // Encode as Chinese characters for stealth
      const chineseMessage = this.encodeAsChineseCharacters(formattedMessage);
      
      console.log('🔐 [MSG] ✅ ENCRYPTION COMPLETE!');
      console.log('🔐 [MSG] 🔑 Key strategy:', encryptedData.keyUsed);
      console.log('🔐 [MSG] 🆔 Key ID:', encryptedData.keyId);
      console.log('🔐 [MSG] 📦 Final length:', chineseMessage.length);
      
      return chineseMessage;
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ ENCRYPTION FAILED:', error);
      throw error;
    }
  }

  // ==================== MESSAGE DECRYPTION ====================

  async decryptMessage(chineseMessage, senderUserId = null) {
    if (!this.isEnabled || !this.ecCrypto) {
      throw new Error('Message processor not initialized');
    }

    console.log('🔐 [MSG] 📨 DECRYPTING MESSAGE...');
    console.log('🔐 [MSG] 👤 Sender:', senderUserId || 'unknown');
    console.log('🔐 [MSG] 📦 Message length:', chineseMessage.length);

    try {
      // Decode Chinese characters back to formatted message
      const decodedMessage = this.decodeChineseCharacters(chineseMessage);
      console.log('🔐 [MSG] 🔄 Decoded format:', decodedMessage.substring(0, 50) + '...');
      
      // Parse the message format: EC:encryptedData:PK:senderPublicKey:keyId
      const match = decodedMessage.match(/^EC:([A-Za-z0-9+/=]+):PK:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]{12})$/);
      
      if (!match) {
        throw new Error('Invalid message format');
      }
      
      const [, encryptedData, senderPublicKey, keyId] = match;
      
      console.log('🔐 [MSG] 🔍 PARSING MESSAGE...');
      console.log('🔐 [MSG] 🆔 Sender Key ID:', keyId);
      console.log('🔐 [MSG] 📦 Encrypted data length:', encryptedData.length);
      
      // Extract and store sender's public key if we have user info
      if (senderUserId) {
        this.storeSenderPublicKey(senderUserId, senderPublicKey, keyId);
      }
      
      // Decrypt the message
      const decryptedText = await this.ecCrypto.decrypt(encryptedData, senderPublicKey, senderUserId);
      
      console.log('🔐 [MSG] ✅ DECRYPTION SUCCESS!');
      console.log('🔐 [MSG] 📝 Decrypted:', decryptedText);
      
      return decryptedText;
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ DECRYPTION FAILED:', error);
      throw error;
    }
  }

  // ==================== PUBLIC KEY DISCOVERY ====================

  storeSenderPublicKey(senderUserId, publicKeyBase64, keyId, username = 'Unknown') {
    if (!this.ecCrypto) return;
    
    console.log('🔐 [MSG] 🔍 STORING SENDER PUBLIC KEY...');
    console.log('🔐 [MSG] 👤 User ID:', senderUserId);
    console.log('🔐 [MSG] 🆔 Key ID:', keyId);
    console.log('🔐 [MSG] 👤 Username:', username);
    
    // Check if this is a new key for this user
    const existingKey = this.ecCrypto.getUserKey(senderUserId);
    const existingKeyId = existingKey ? this.ecCrypto.generateKeyId(existingKey) : null;
    
    if (!existingKey || existingKeyId !== keyId) {
      // New user or new key for existing user
      this.ecCrypto.addUserKey(senderUserId, publicKeyBase64, username);
      console.log('🔐 [MSG] 🆕 NEW KEY STORED!');
    } else {
      console.log('🔐 [MSG] ✅ Key already known, updating last seen');
      // Update last seen time for existing key
      const userInfo = this.ecCrypto.userKeys.get(senderUserId);
      if (userInfo) {
        userInfo.lastSeen = Date.now();
        this.ecCrypto.userKeys.set(senderUserId, userInfo);
        this.ecCrypto.saveUserKeys();
      }
    }
  }

  scanMessageForPublicKeys(chineseMessage, messageElement = null) {
    console.log('🔐 [MSG] 🔍 SCANNING MESSAGE FOR PUBLIC KEYS...');
    
    try {
      // Decode the message
      const decodedMessage = this.decodeChineseCharacters(chineseMessage);
      
      // Look for public key pattern: PK:publicKey:keyId
      const publicKeyPattern = /PK:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]{12})/g;
      const matches = [...decodedMessage.matchAll(publicKeyPattern)];
      
      if (matches.length > 0) {
        console.log('🔐 [MSG] 🎯 Found', matches.length, 'public key(s)!');
        
        // Extract Discord user info from message element
        let userInfo = { userId: null, username: 'Unknown' };
        if (messageElement) {
          userInfo = this.extractDiscordUserInfo(messageElement);
        }
        
        // Process each public key
        for (const match of matches) {
          const [, publicKey, keyId] = match;
          console.log('🔐 [MSG] 🔑 Processing public key - ID:', keyId);
          
          if (userInfo.userId) {
            this.storeSenderPublicKey(userInfo.userId, publicKey, keyId, userInfo.username);
          }
        }
        
        return true;
      } else {
        console.log('🔐 [MSG] ❌ No public keys found in message');
        return false;
      }
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ Error scanning for public keys:', error);
      return false;
    }
  }

  extractDiscordUserInfo(messageElement) {
    console.log('🔐 [MSG] 👤 EXTRACTING USER INFO FROM MESSAGE...');
    
    try {
      // Find the message container or go up the DOM tree
      let currentElement = messageElement;
      while (currentElement && !currentElement.classList.contains('messageListItem__5126c') && 
             !currentElement.classList.contains('contents_c19a55') && currentElement.parentElement) {
        currentElement = currentElement.parentElement;
      }
      
      if (!currentElement) {
        console.log('🔐 [MSG] ❌ Could not find message container');
        return { userId: null, username: 'Unknown' };
      }
      
      let userId = null;
      let username = 'Unknown';
      
      // Method 1: Extract user ID from avatar URL (most reliable)
      const avatarImg = currentElement.querySelector('img.avatar_c19a55[src*="/avatars/"]');
      if (avatarImg) {
        const avatarMatch = avatarImg.src.match(/\/avatars\/(\d+)\//);
        if (avatarMatch) {
          userId = avatarMatch[1];
          console.log('🔐 [MSG] 🎯 Found user ID from avatar:', userId);
        }
      }
      
      // Method 2: Look for username in message header  
      const usernameElement = currentElement.querySelector('.username_c19a55, [class*="username"], [class*="author"]');
      if (usernameElement) {
        username = usernameElement.textContent.trim();
        console.log('🔐 [MSG] 👤 Found username:', username);
      }
      
      // Method 3: Alternative - look for data-text attribute
      if (!username || username === 'Unknown') {
        const dataTextElement = currentElement.querySelector('[data-text]');
        if (dataTextElement) {
          username = dataTextElement.getAttribute('data-text') || username;
        }
      }
      
      // Method 4: Fallback - look for user link with ID
      if (!userId) {
        const userLink = currentElement.querySelector('a[href*="/users/"]');
        if (userLink) {
          const match = userLink.href.match(/\/users\/(\d+)/);
          if (match) {
            userId = match[1];
          }
        }
      }
      
      // Method 5: Look for data attributes as final fallback
      if (!userId) {
        const dataUserElements = currentElement.querySelectorAll('[data-user-id]');
        for (const element of dataUserElements) {
          const dataUserId = element.getAttribute('data-user-id');
          if (dataUserId && dataUserId !== '0') {
            userId = dataUserId;
            break;
          }
        }
      }
      
      console.log('🔐 [MSG] 📋 Extracted user info:');
      console.log('🔐 [MSG] 🆔 User ID:', userId || 'Not found');
      console.log('🔐 [MSG] 👤 Username:', username);
      
      return { userId, username };
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ Error extracting user info:', error);
      return { userId: null, username: 'Unknown' };
    }
  }

  // ==================== ENCODING/DECODING ====================

  encodeAsChineseCharacters(message) {
    console.log('🔐 [MSG] 🈲 Encoding as Chinese characters...');
    
    // Convert message to base64 first for safety
    const base64Message = btoa(message);
    
    // Convert each character to Chinese
    let chineseMessage = '';
    const baseCharCode = 0x4E00; // Start of CJK unified ideographs
    
    for (let i = 0; i < base64Message.length; i++) {
      const charCode = base64Message.charCodeAt(i);
      const chineseCharCode = baseCharCode + (charCode * 13 + i * 7) % 3000;
      chineseMessage += String.fromCharCode(chineseCharCode);
    }
    
    // Add spaces every 4-6 characters for natural appearance
    let result = '';
    for (let i = 0; i < chineseMessage.length; i++) {
      result += chineseMessage[i];
      const spaceInterval = 4 + (i % 3);
      if ((i + 1) % spaceInterval === 0 && i < chineseMessage.length - 1) {
        result += ' ';
      }
    }
    
    console.log('🔐 [MSG] ✅ Encoded to Chinese characters - length:', result.length);
    return result;
  }

  decodeChineseCharacters(chineseMessage) {
    console.log('🔐 [MSG] 🈲 Decoding Chinese characters...');
    
    try {
      // Remove spaces
      const cleanChinese = chineseMessage.replace(/\s+/g, '');
      
      // Convert Chinese characters back to base64
      let base64Message = '';
      const baseCharCode = 0x4E00;
      
      for (let i = 0; i < cleanChinese.length; i++) {
        const chineseCharCode = cleanChinese.charCodeAt(i);
        const offset = chineseCharCode - baseCharCode;
        
        // Reverse the mapping
        let originalCharCode = 33;
        for (let j = 33; j <= 126; j++) {
          if ((j * 13 + i * 7) % 3000 === offset) {
            originalCharCode = j;
            break;
          }
        }
        
        base64Message += String.fromCharCode(originalCharCode);
      }
      
      // Decode from base64
      const decodedMessage = atob(base64Message);
      console.log('🔐 [MSG] ✅ Decoded from Chinese characters');
      
      return decodedMessage;
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ Error decoding Chinese characters:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  isChineseEncryptedMessage(text) {
    if (!text || text.length === 0) return false;
    
    // Remove spaces and check if most characters are in our Chinese range
    const textWithoutSpaces = text.replace(/\s+/g, '');
    if (textWithoutSpaces.length < 10) return false;
    
    let chineseCount = 0;
    for (let i = 0; i < textWithoutSpaces.length; i++) {
      const charCode = textWithoutSpaces.charCodeAt(i);
      if (charCode >= 0x4E00 && charCode <= 0x7000) {
        chineseCount++;
      }
    }
    
    const ratio = chineseCount / textWithoutSpaces.length;
    return ratio > 0.7;
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      ecCryptoReady: !!this.ecCrypto,
      userCount: this.ecCrypto ? this.ecCrypto.userKeys.size : 0
    };
  }
}

// Export for use by other modules
window.ecMessageProcessor = new ECMessageProcessor(); 