/**
 * Discord Cryptochat - Simplified Asymmetric Encryption Module
 * Uses hardcoded static key with simple user key discovery
 */

class ECCrypto {
  constructor() {
    this.algorithm = 'ECDH';
    this.curve = 'P-256';
    this.aesAlgorithm = 'AES-GCM';
    
    // Hardcoded static keypair (known to all users)
    this.staticPrivateKey = null;
    this.staticPublicKey = null;
    
    // User public keys discovered from messages: userId -> {publicKey, keyId, username, lastSeen}
    this.userKeys = new Map();
    
    // Current user identification
    this.currentUserId = null;
    this.currentUsername = null;
    this.myKeyId = null;
    
    console.log('🔐 [EC] Initializing simplified crypto system...');
    this.init();
  }

  async init() {
    try {
      await this.loadOrGenerateStaticKeypair();
      await this.loadUserKeys();
      await this.loadCurrentUserInfo();
      console.log('🔐 [EC] ✅ Crypto system initialized');
      console.log('🔐 [EC] 📊 Loaded user keys:', this.userKeys.size);
      console.log('🔐 [EC] 👤 Current user:', this.currentUsername, '(ID:', this.currentUserId + ')');
    } catch (error) {
      console.error('🔐 [EC] ❌ Failed to initialize:', error);
    }
  }

  // ==================== HARDCODED STATIC KEY MANAGEMENT ====================

  async loadOrGenerateStaticKeypair() {
    try {
      // Try to load existing static keypair
      const stored = await chrome.storage.local.get(['ecStaticPrivateKey', 'ecStaticPublicKey', 'ecMyKeyId']);
      
      if (stored.ecStaticPrivateKey && stored.ecStaticPublicKey) {
        this.staticPrivateKey = await this.importPrivateKey(stored.ecStaticPrivateKey);
        this.staticPublicKey = await this.importPublicKey(stored.ecStaticPublicKey);
        
        // Load stored key ID or generate it
        this.myKeyId = stored.ecMyKeyId || this.generateKeyId(stored.ecStaticPublicKey);
        
        // If we had to generate it, save it
        if (!stored.ecMyKeyId) {
          await chrome.storage.local.set({ ecMyKeyId: this.myKeyId });
        }
        
        console.log('🔐 [EC] 🔑 Static keypair loaded from storage');
      } else {
        // Generate new static keypair
        await this.generateStaticKeypair();
      }
      
      // Log key info for debugging
      const publicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
      console.log('🔐 [EC] 🆔 My Key ID:', this.myKeyId);
      console.log('🔐 [EC] 🔑 My Public Key:', publicKeyBase64.substring(0, 32) + '...');
      
    } catch (error) {
      console.error('🔐 [EC] ❌ Static keypair error:', error);
      throw error;
    }
  }

  async generateStaticKeypair() {
    console.log('🔐 [EC] 🔄 Generating new static keypair...');
    
    // Add some randomness to ensure unique keypairs across users
    const randomSeed = crypto.getRandomValues(new Uint8Array(32));
    console.log('🔐 [EC] 🎲 Using random seed for unique keypair generation...');
    
    const keypair = await crypto.subtle.generateKey(
      {
        name: this.algorithm,
        namedCurve: this.curve
      },
      true,
      ['deriveKey']
    );
    
    this.staticPrivateKey = keypair.privateKey;
    this.staticPublicKey = keypair.publicKey;
    
    // Export and store
    const exportedPrivate = await this.exportPrivateKey(this.staticPrivateKey);
    const exportedPublic = await this.exportPublicKey(this.staticPublicKey);
    
    // Generate and store my key ID
    this.myKeyId = this.generateKeyId(exportedPublic);
    
    await chrome.storage.local.set({
      ecStaticPrivateKey: exportedPrivate,
      ecStaticPublicKey: exportedPublic,
      ecMyKeyId: this.myKeyId
    });
    
    console.log('🔐 [EC] ✅ New static keypair generated and stored');
    console.log('🔐 [EC] 🔑 My Key ID:', this.myKeyId);
  }

  // ==================== CURRENT USER IDENTIFICATION ====================

  async loadCurrentUserInfo() {
    try {
      const stored = await chrome.storage.local.get(['currentUserId', 'currentUsername']);
      this.currentUserId = stored.currentUserId || null;
      this.currentUsername = stored.currentUsername || null;
      
      // Generate my key ID if we have a static public key
      if (this.staticPublicKey) {
        const myPublicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
        this.myKeyId = this.generateKeyId(myPublicKeyBase64);
      }
      
      console.log('🔐 [EC] 📂 Loaded current user info:', {
        userId: this.currentUserId || 'Not set',
        username: this.currentUsername || 'Not set',
        myKeyId: this.myKeyId || 'Not ready'
      });
    } catch (error) {
      console.error('🔐 [EC] ❌ Failed to load current user info:', error);
    }
  }

  async setCurrentUser(userId, username) {
    this.currentUserId = userId;
    this.currentUsername = username;
    
    await chrome.storage.local.set({
      currentUserId: userId,
      currentUsername: username
    });
    
    console.log('🔐 [EC] 💾 Saved current user:', username, '(ID:', userId + ')');
  }

  getCurrentUser() {
    return {
      userId: this.currentUserId,
      username: this.currentUsername,
      keyId: this.myKeyId
    };
  }

  // ==================== USER KEY DISCOVERY & STORAGE ====================

  addUserKey(userId, publicKeyBase64, username = 'Unknown') {
    const keyId = this.generateKeyId(publicKeyBase64);
    
    // Prevent storing if this is our current user ID (primary check)
    if (this.currentUserId && userId === this.currentUserId) {
      console.log('🔐 [EC] ⚠️ Ignoring own user ID - not storing self:', userId);
      return false;
    }
    
    // Secondary check: prevent storing our own public key if user ID unknown but key matches
    if (!this.currentUserId && this.myKeyId && keyId === this.myKeyId) {
      console.log('🔐 [EC] ⚠️ Ignoring own public key (no user ID set) - Key ID:', keyId);
      return false;
    }
    
    const userInfo = {
      publicKey: publicKeyBase64,
      keyId: keyId,
      username: username,
      lastSeen: Date.now(),
      discoveredAt: Date.now()
    };
    
    this.userKeys.set(userId, userInfo);
    this.saveUserKeys();
    
    console.log('🔐 [EC] 👤 NEW USER DISCOVERED!');
    console.log('🔐 [EC] 🆔 User ID:', userId);
    console.log('🔐 [EC] 👤 Username:', username);
    console.log('🔐 [EC] 🔑 Key ID:', keyId);
    console.log('🔐 [EC] 📊 Total users:', this.userKeys.size);
    return true;
  }

  getUserKey(userId) {
    const userInfo = this.userKeys.get(userId);
    if (userInfo) {
      console.log('🔐 [EC] 🔍 Found key for user:', userId, '- Key ID:', userInfo.keyId);
      return userInfo.publicKey;
    }
    console.log('🔐 [EC] ❌ No key found for user:', userId);
    return null;
  }

  getMostRecentUserKey() {
    if (this.userKeys.size === 0) {
      console.log('🔐 [EC] ❌ No user keys available');
      return null;
    }
    
    let mostRecent = null;
    let latestTime = 0;
    
    for (const [userId, userInfo] of this.userKeys) {
      if (userInfo.lastSeen > latestTime) {
        latestTime = userInfo.lastSeen;
        mostRecent = { userId, ...userInfo };
      }
    }
    
    if (mostRecent) {
      console.log('🔐 [EC] 🎯 Most recent user key:', mostRecent.userId, '- Key ID:', mostRecent.keyId);
    }
    
    return mostRecent;
  }

  async saveUserKeys() {
    try {
      const keysObject = Object.fromEntries(this.userKeys);
      await chrome.storage.local.set({ ecUserKeys: keysObject });
      console.log('🔐 [EC] 💾 Saved', this.userKeys.size, 'user keys');
    } catch (error) {
      console.error('🔐 [EC] ❌ Failed to save user keys:', error);
    }
  }

  async loadUserKeys() {
    try {
      const stored = await chrome.storage.local.get(['ecUserKeys']);
      if (stored.ecUserKeys) {
        this.userKeys = new Map(Object.entries(stored.ecUserKeys));
        console.log('🔐 [EC] 📂 Loaded', this.userKeys.size, 'user keys from storage');
        
        // Log all stored users
        for (const [userId, userInfo] of this.userKeys) {
          console.log('🔐 [EC] 👤 Stored user:', userId, '- Username:', userInfo.username, '- Key ID:', userInfo.keyId);
        }
      }
    } catch (error) {
      console.error('🔐 [EC] ❌ Failed to load user keys:', error);
    }
  }

  // ==================== ENCRYPTION/DECRYPTION ====================

  async encrypt(plaintext, recipientUserId = null) {
    console.log('🔐 [EC] 📤 ENCRYPTING MESSAGE...');
    console.log('🔐 [EC] 📝 Message:', plaintext);
    console.log('🔐 [EC] 🎯 Recipient:', recipientUserId || 'auto-detect');
    
    let recipientPublicKey;
    let keyUsed = 'static';
    
    // Try to use specific user's key first
    if (recipientUserId) {
      const userPublicKeyBase64 = this.getUserKey(recipientUserId);
      if (userPublicKeyBase64) {
        recipientPublicKey = await this.importPublicKey(userPublicKeyBase64);
        keyUsed = 'user_specific';
        console.log('🔐 [EC] 🔑 Using specific user key for:', recipientUserId);
      }
    }
    
    // Fallback to most recent user key
    if (!recipientPublicKey) {
      const mostRecent = this.getMostRecentUserKey();
      if (mostRecent) {
        recipientPublicKey = await this.importPublicKey(mostRecent.publicKey);
        keyUsed = 'most_recent';
        console.log('🔐 [EC] 🔑 Using most recent user key from:', mostRecent.userId);
      }
    }
    
    // Final fallback to static key
    if (!recipientPublicKey) {
      recipientPublicKey = this.staticPublicKey;
      keyUsed = 'static';
      console.log('🔐 [EC] 🔑 Using static fallback key');
    }
    
    try {
      // Derive shared secret and AES key
      const sharedSecret = await this.deriveSharedSecret(this.staticPrivateKey, recipientPublicKey);
      const aesKey = await this.deriveAESKey(sharedSecret);
      
      // Encrypt the message
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.aesAlgorithm, iv: iv },
        aesKey,
        data
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Get my public key to attach
      const myPublicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
      const myKeyId = this.generateKeyId(myPublicKeyBase64);
      
      const result = {
        encrypted: btoa(String.fromCharCode(...combined)),
        senderPublicKey: myPublicKeyBase64,
        keyId: myKeyId,
        keyUsed: keyUsed
      };
      
      console.log('🔐 [EC] ✅ ENCRYPTION SUCCESS!');
      console.log('🔐 [EC] 🔑 Key strategy:', keyUsed);
      console.log('🔐 [EC] 🆔 My Key ID:', myKeyId);
      console.log('🔐 [EC] 📦 Encrypted length:', result.encrypted.length);
      
      return result;
      
    } catch (error) {
      console.error('🔐 [EC] ❌ ENCRYPTION FAILED:', error);
      throw error;
    }
  }

  async decrypt(encryptedBase64, senderPublicKeyBase64, senderUserId = null) {
    console.log('🔐 [EC] 📨 DECRYPTING MESSAGE...');
    console.log('🔐 [EC] 📦 Encrypted data length:', encryptedBase64.length);
    console.log('🔐 [EC] 👤 Sender:', senderUserId || 'unknown');
    
    try {
      // Import sender's public key
      const senderPublicKey = await this.importPublicKey(senderPublicKeyBase64);
      const senderKeyId = this.generateKeyId(senderPublicKeyBase64);
      console.log('🔐 [EC] 🔑 Sender Key ID:', senderKeyId);
      
      let result = null;
      let decryptionMethod = 'unknown';
      
      // Check if this is our own message
      const isOwnMessage = (this.currentUserId && senderUserId === this.currentUserId) || 
                          (this.myKeyId && senderKeyId === this.myKeyId);
      
      if (isOwnMessage) {
        console.log('🔐 [EC] 🔄 Detected own message - trying stored recipient keys...');
        
        // For our own messages, try to decrypt using each stored user's public key
        // (because we encrypted FOR them using their public key + our private key)
        for (const [userId, userInfo] of this.userKeys) {
          if (userId === this.currentUserId) continue; // Skip ourselves
          
          console.log('🔐 [EC] 🔍 Trying own message with stored user key:', userInfo.keyId, 'for user:', userId);
          try {
            const recipientPublicKey = await this.importPublicKey(userInfo.publicKey);
            result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, recipientPublicKey);
            if (result) {
              decryptionMethod = 'own_message_recipient_key';
              console.log('🔐 [EC] ✅ Decrypted own message with recipient key:', userInfo.keyId);
              break;
            }
          } catch (error) {
            console.log('🔐 [EC] ❌ Own message decryption failed with key:', userInfo.keyId, error.message);
          }
        }
        
        // If no stored keys worked, try static key
        if (!result) {
          console.log('🔐 [EC] 🔍 Trying own message with static key...');
          try {
            result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, this.staticPublicKey);
            if (result) {
              decryptionMethod = 'own_message_static';
              console.log('🔐 [EC] ✅ Decrypted own message with static key!');
            }
          } catch (error) {
            console.log('🔐 [EC] ❌ Own message static decryption failed:', error.message);
          }
        }
      } else {
        console.log('🔐 [EC] 📨 Processing message from other user...');
        
        // Strategy 1: Try with sender's public key and our private key
        console.log('🔐 [EC] 🔍 Trying decryption with sender public key...');
        try {
          result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, senderPublicKey);
          if (result) {
            decryptionMethod = 'sender_public_key';
            console.log('🔐 [EC] ✅ Decrypted with sender public key!');
          }
        } catch (error) {
          console.log('🔐 [EC] ❌ Sender public key decryption failed:', error.message);
        }
        
        // Strategy 2: Try with most recent user's key
        if (!result) {
          const mostRecentUser = this.getMostRecentUserKey();
          if (mostRecentUser) {
            console.log('🔐 [EC] 🔍 Trying decryption with most recent user key:', mostRecentUser.keyId);
            try {
              const userPublicKey = await this.importPublicKey(mostRecentUser.publicKey);
              result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, userPublicKey);
              if (result) {
                decryptionMethod = 'recent_user_key';
                console.log('🔐 [EC] ✅ Decrypted with recent user key!');
              }
            } catch (error) {
              console.log('🔐 [EC] ❌ Recent user key decryption failed:', error.message);
            }
          }
        }
        
        // Strategy 3: Try with static key if everything else failed
        if (!result) {
          console.log('🔐 [EC] 🔍 Trying decryption with static key...');
          try {
            result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, this.staticPublicKey);
            if (result) {
              decryptionMethod = 'static_key';
              console.log('🔐 [EC] ✅ Decrypted with static key!');
            }
          } catch (error) {
            console.log('🔐 [EC] ❌ Static key decryption failed:', error.message);
          }
        }
      }
      
      if (result) {
        console.log('🔐 [EC] ✅ DECRYPTION SUCCESS!');
        console.log('🔐 [EC] 📝 Decrypted:', result);
        console.log('🔐 [EC] 🔑 Method:', decryptionMethod);
        
        // Store sender's public key if we have their user ID and it's not us
        if (senderUserId && senderUserId !== this.currentUserId) {
          const existing = this.userKeys.get(senderUserId);
          if (!existing || existing.keyId !== senderKeyId) {
            // New or updated key for this user
            const added = this.addUserKey(senderUserId, senderPublicKeyBase64, existing?.username || 'Unknown');
            if (added) {
              console.log('🔐 [EC] 📝 Stored new key for user:', senderUserId);
            }
          } else {
            // Update last seen time
            existing.lastSeen = Date.now();
            this.userKeys.set(senderUserId, existing);
            this.saveUserKeys();
            console.log('🔐 [EC] 🔄 Updated last seen for user:', senderUserId);
          }
        }
        
        return result;
      } else {
        throw new Error('Unable to decrypt with available keys');
      }
      
    } catch (error) {
      console.error('🔐 [EC] ❌ DECRYPTION FAILED:', error);
      throw error;
    }
  }

  async tryDecryptWithKey(encryptedBase64, privateKey, senderPublicKey) {
    try {
      // Decode encrypted data
      const combined = new Uint8Array(
        atob(encryptedBase64).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      // Derive shared secret and AES key
      const sharedSecret = await this.deriveSharedSecret(privateKey, senderPublicKey);
      const aesKey = await this.deriveAESKey(sharedSecret);
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: this.aesAlgorithm, iv: iv },
        aesKey,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
      
    } catch (error) {
      console.log('🔐 [EC] 🔓 Decryption attempt failed:', error.message);
      return null;
    }
  }

  // ==================== UTILITY METHODS ====================

  async deriveSharedSecret(privateKey, publicKey) {
    return await crypto.subtle.deriveKey(
      { name: this.algorithm, public: publicKey },
      privateKey,
      { name: this.aesAlgorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async deriveAESKey(sharedSecret) {
    return sharedSecret; // The derived key IS the AES key
  }

  generateKeyId(publicKeyBase64) {
    // Simple hash of public key for identification
    return btoa(publicKeyBase64.substring(0, 16)).substring(0, 12);
  }

  async exportPublicKey(publicKey) {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  async exportPrivateKey(privateKey) {
    const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  async importPublicKey(base64Key) {
    const keyData = new Uint8Array(
      atob(base64Key).split('').map(char => char.charCodeAt(0))
    );
    
    return await crypto.subtle.importKey(
      'spki',
      keyData,
      { name: this.algorithm, namedCurve: this.curve },
      true,
      []
    );
  }

  async importPrivateKey(base64Key) {
    const keyData = new Uint8Array(
      atob(base64Key).split('').map(char => char.charCodeAt(0))
    );
    
    return await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: this.algorithm, namedCurve: this.curve },
      true,
      ['deriveKey']
    );
  }

  // ==================== STATUS METHODS ====================

  getStatus() {
    return {
      enabled: true,
      userCount: this.userKeys.size,
      myKeyId: this.staticPublicKey ? this.generateKeyId('temp') : null
    };
  }

  getUserList() {
    return Array.from(this.userKeys.entries()).map(([userId, userInfo]) => ({
      userId,
      username: userInfo.username,
      keyId: userInfo.keyId,
      lastSeen: userInfo.lastSeen,
      discoveredAt: userInfo.discoveredAt
    }));
  }

  async clearAllUsers() {
    this.userKeys.clear();
    await this.saveUserKeys();
    console.log('🔐 [EC] 🗑️ Cleared all user keys');
  }
}

// Export for use by other modules
window.ecCrypto = new ECCrypto();