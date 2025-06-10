/**
 * Discord Cryptochat - Encryption Utilities
 * Provides AES-GCM encryption/decryption functions
 */

class DiscordCrypto {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.keyRotationCheckInterval = 10000; // Check every 10 seconds minimum
    this.lastKeyRotationCheck = 0;
    
    // Start key rotation monitoring
    // Key rotation monitoring is now handled by background.js
  }

  /**
   * Derives a crypto key from a password string
   */
  async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('discord-cryptochat-salt'); // Static salt for simplicity
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Advanced text compression using multiple techniques
   */
  compressText(text) {
    if (text.length < 5) return text;
    
    let compressed = text;
    
    // Dictionary of common words/patterns -> single characters
    const dictionary = {
      ' the ': '†',
      ' and ': '&',
      ' you ': 'ü',
      ' are ': 'å',
      ' that ': 'þ',
      ' this ': 'ð',
      ' with ': 'ø',
      ' have ': 'æ',
      ' for ': 'ƒ',
      ' not ': 'ñ',
      ' but ': 'ß',
      ' can ': 'ç',
      ' all ': 'α',
      ' will ': 'ω',
      ' from ': 'φ',
      ' they ': 'θ',
      ' been ': 'β',
      ' what ': 'ψ',
      ' your ': 'χ',
      ' when ': 'ξ',
      ' than ': 'ζ',
      ' like ': 'λ',
      ' just ': 'μ',
      ' know ': 'κ',
      ' time ': 'τ',
      ' get ': 'γ',
      ' see ': 'σ',
      ' go ': 'π',
      ' do ': 'δ',
      ' me ': 'ε',
      ' he ': 'η',
      ' we ': 'ρ',
      ' my ': 'υ',
      ' so ': 'ι',
      ' up ': 'ο',
      ' if ': 'ν',
      ' no ': 'ξ',
      ' it ': 'ι',
      ' is ': 'ς',
      ' in ': 'ν',
      ' to ': '→',
      ' of ': '°',
      ' a ': '∙',
      ' I ': 'Ι',
      'ing ': 'ღ',
      'ion ': 'ჩ',
      'tion': 'შ',
      'er ': 'ℰ',
      'ed ': 'ℇ',
      'ly ': 'ℒ',
      'nt ': 'ℕ',
      'll ': 'ℓ',
      're ': 'ℜ',
      've ': '℣',
      'd ': 'ℊ',
      's ': 'ℸ'
    };
    
    // Apply dictionary compression (order matters - longer patterns first)
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const pattern of sortedKeys) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      compressed = compressed.replace(regex, dictionary[pattern]);
    }
    
    // Compress repeated characters (but preserve special chars)
    compressed = compressed.replace(/(.)\1{2,}/g, (match, char) => {
      if (char === ' ') return match; // Don't compress spaces
      return char + '⁂' + match.length; // Use ⁂ as repeat marker
    });
    
    // Final space compression
    compressed = compressed.replace(/\s+/g, '~');
    
    //console.log(`🔐 [CRYPTO] Compression: ${text.length} → ${compressed.length} chars (${((1 - compressed.length/text.length) * 100).toFixed(1)}% reduction)`);
    
    return compressed;
  }

  /**
   * Decompresses text using reverse dictionary and pattern expansion
   */
  decompressText(compressed) {
    if (!compressed) return '';
    
    let decompressed = compressed;
    
    // Restore spaces first
    decompressed = decompressed.replace(/~/g, ' ');
    
    // Expand repeated characters
    decompressed = decompressed.replace(/(.)\⁂(\d+)/g, (match, char, count) => {
      return char.repeat(parseInt(count));
    });
    
    // Reverse dictionary (order matters - restore longer patterns first)
    const dictionary = {
      '†': ' the ',
      '&': ' and ',
      'ü': ' you ',
      'å': ' are ',
      'þ': ' that ',
      'ð': ' this ',
      'ø': ' with ',
      'æ': ' have ',
      'ƒ': ' for ',
      'ñ': ' not ',
      'ß': ' but ',
      'ç': ' can ',
      'α': ' all ',
      'ω': ' will ',
      'φ': ' from ',
      'θ': ' they ',
      'β': ' been ',
      'ψ': ' what ',
      'χ': ' your ',
      'ξ': ' when ',
      'ζ': ' than ',
      'λ': ' like ',
      'μ': ' just ',
      'κ': ' know ',
      'τ': ' time ',
      'γ': ' get ',
      'σ': ' see ',
      'π': ' go ',
      'δ': ' do ',
      'ε': ' me ',
      'η': ' he ',
      'ρ': ' we ',
      'υ': ' my ',
      'ι': ' so ',
      'ο': ' up ',
      'ν': ' if ',
      'ξ': ' no ',
      'ι': ' it ',
      'ς': ' is ',
      'ν': ' in ',
      '→': ' to ',
      '°': ' of ',
      '∙': ' a ',
      'Ι': ' I ',
      'ღ': 'ing ',
      'ჩ': 'ion ',
      'შ': 'tion',
      'ℰ': 'er ',
      'ℇ': 'ed ',
      'ℒ': 'ly ',
      'ℕ': 'nt ',
      'ℓ': 'll ',
      'ℜ': 're ',
      '℣': 've ',
      'ℊ': 'd ',
      'ℸ': 's '
    };
    
    // Apply reverse dictionary
    for (const [symbol, original] of Object.entries(dictionary)) {
      const regex = new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      decompressed = decompressed.replace(regex, original);
    }
    
    return decompressed.trim();
  }

  /**
   * Encrypts plaintext using AES-GCM with compression
   */
  async encrypt(plaintext, password) {
    try {
      const key = await this.deriveKey(password);
      const encoder = new TextEncoder();
      
      // Compress the text first for smaller payload
      const compressed = this.compressText(plaintext);
      const data = encoder.encode(compressed);
      
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Use more compact base64url encoding (no padding)
      return this.toBase64Url(combined);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Converts Uint8Array to base64url encoding (more compact)
   */
  toBase64Url(buffer) {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Converts base64url back to Uint8Array
   */
  fromBase64Url(base64url) {
    // Restore padding if needed
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return new Uint8Array(atob(base64).split('').map(char => char.charCodeAt(0)));
  }

  /**
   * Decrypts base64url encoded ciphertext using AES-GCM with decompression
   */
  async decrypt(base64Ciphertext, password) {
    try {
      const key = await this.deriveKey(password);
      
      // Handle both old base64 and new base64url formats
      let combined;
      try {
        // Try new base64url format first
        combined = this.fromBase64Url(base64Ciphertext);
      } catch (e) {
        // Fallback to old base64 format
        combined = new Uint8Array(
          atob(base64Ciphertext).split('').map(char => char.charCodeAt(0))
        );
      }
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const compressed = decoder.decode(decrypted);
      
      // Decompress the text
      return this.decompressText(compressed);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt message - check your key');
    }
  }

  /**
   * Gets the stored encryption key from Chrome storage
   */
  async getStoredKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['encryptionKey'], (result) => {
        resolve(result.encryptionKey || null);
      });
    });
  }

  /**
   * Stores the encryption key in Chrome storage
   */
  async storeKey(key) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ encryptionKey: key }, () => {
        resolve();
      });
    });
  }

  /**
   * Tests if encryption/decryption works with the current key
   */
  async testKey(key) {
    try {
      const testMessage = "Test encryption message";
      const encrypted = await this.encrypt(testMessage, key);
      const decrypted = await this.decrypt(encrypted, key);
      return decrypted === testMessage;
    } catch (error) {
      return false;
    }
  }

  /**
   * Key Rotation System
   */
  startKeyRotationMonitoring() {
    // Check immediately on startup
    setTimeout(() => this.checkAndRotateKey(), 1000);
    
    // Then check every 10 seconds
    setInterval(() => this.checkAndRotateKey(), this.keyRotationCheckInterval);
    
    //console.log('🔐 [CRYPTO] 🔄 Key rotation monitoring started');
  }

  async checkAndRotateKey() {
    try {
      const now = Date.now();
      
      // Don't check too frequently
      if (now - this.lastKeyRotationCheck < this.keyRotationCheckInterval) {
        return;
      }
      
      this.lastKeyRotationCheck = now;
      
      const settings = await this.getKeyRotationSettings();
      if (!settings.enabled || !settings.baseKey || !settings.intervalMs) {
        return; // Key rotation not configured
      }
      
      const currentKey = await this.getCurrentRotatedKey(settings);
      const storedKey = await this.getStoredKey();
      
      if (currentKey !== storedKey) {
        //console.log('🔐 [CRYPTO] 🔄 Key rotation needed - updating key');
        await this.storeKey(currentKey);
        
        // Security: Delete base key after first rotation for perfect forward secrecy
        await this.deleteBaseKeyAfterFirstRotation(settings);
        
        // Notify all content scripts about key update
        this.notifyContentScriptsKeyUpdate(currentKey);
        
        // Notify user
        if (typeof Logger !== 'undefined') {
          await Logger.log('🔐 [CRYPTO] 🔄 Key automatically rotated based on time interval');
        }
      }
      
    } catch (error) {
      console.error('🔐 [CRYPTO] ❌ Key rotation check failed:', error);
    }
  }

  async getCurrentRotatedKey(settings) {
    const { baseKey, intervalMs, startTimestamp } = settings;
    const now = Date.now();
    const elapsed = now - startTimestamp;
    const rotationsNeeded = Math.floor(elapsed / intervalMs);
    
    //console.log(`🔐 [CRYPTO] 🔄 Calculating enhanced key rotation: ${rotationsNeeded} rotations needed`);
    
    // Enhanced rotation with entropy injection
    let currentKey = baseKey;
    for (let i = 0; i < rotationsNeeded; i++) {
      // Calculate the exact timestamp for this rotation
      const rotationTimestamp = startTimestamp + (i + 1) * intervalMs;
      
      // Inject entropy based on rotation timestamp and interval
      const entropy = await this.generateRotationEntropy(rotationTimestamp, intervalMs, i);
      
      // Combine current key with entropy and hash
      currentKey = await this.hashKeyWithEntropy(currentKey, entropy);
    }
    
    return currentKey;
  }

  async generateRotationEntropy(rotationTimestamp, intervalMs, rotationNumber) {
    // Generate deterministic but unpredictable entropy
    // Both users will generate the same entropy for the same rotation
    
    // Use multiple entropy sources
    const timeFactor = Math.floor(rotationTimestamp / intervalMs); // Rotation period number
    const dateFactor = new Date(rotationTimestamp).toISOString().substring(0, 10); // YYYY-MM-DD
    const hourFactor = Math.floor(rotationTimestamp / 3600000); // Hour since epoch
    const intervalFactor = intervalMs.toString(); // Interval as string
    const rotationFactor = rotationNumber.toString(); // Rotation sequence number
    
    // Combine all factors into entropy string
    const entropyString = `${timeFactor}:${dateFactor}:${hourFactor}:${intervalFactor}:${rotationFactor}`;
    
    // Hash the entropy string
    const encoder = new TextEncoder();
    const data = encoder.encode(entropyString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Return first 16 bytes as hex (32 chars)
    return Array.from(hashArray.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hashKeyWithEntropy(key, entropy) {
    // Combine key and entropy in a specific pattern
    const combinedString = `${key}::${entropy}::${key.length}::${entropy.length}`;
    
    // Hash the combined string
    const encoder = new TextEncoder();
    const data = encoder.encode(combinedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert to hex string
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hashKey(key) {
    // Hash the key using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert to hex string
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getKeyRotationSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'keyRotationEnabled',
        'keyRotationBaseKey', 
        'keyRotationIntervalMs',
        'keyRotationStartTimestamp'
      ], (result) => {
        resolve({
          enabled: result.keyRotationEnabled || false,
          baseKey: result.keyRotationBaseKey || null,
          intervalMs: result.keyRotationIntervalMs || 0,
          startTimestamp: result.keyRotationStartTimestamp || Date.now()
        });
      });
    });
  }

  async setupKeyRotation(baseKey, intervalMs) {
    const startTimestamp = Date.now();
    
    await new Promise((resolve) => {
      chrome.storage.local.set({
        keyRotationEnabled: true,
        keyRotationBaseKey: baseKey,
        keyRotationIntervalMs: intervalMs,
        keyRotationStartTimestamp: startTimestamp,
        encryptionKey: baseKey // Set initial key
      }, resolve);
    });
    
    //console.log(`🔐 [CRYPTO] 🔄 Key rotation setup: ${intervalMs}ms intervals`);
    
    // Force immediate check
    setTimeout(() => this.checkAndRotateKey(), 100);
  }

  async disableKeyRotation() {
    await new Promise((resolve) => {
      chrome.storage.local.set({
        keyRotationEnabled: false
      }, resolve);
    });
    
    //console.log('🔐 [CRYPTO] 🔄 Key rotation disabled');
  }

  formatRotationInterval(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  async deleteBaseKeyAfterFirstRotation(settings) {
    const now = Date.now();
    const elapsed = now - settings.startTimestamp;
    const rotationsCompleted = Math.floor(elapsed / settings.intervalMs);
    
    // Delete base key after first rotation for security
    if (rotationsCompleted > 0) {
      const hasBaseKey = await new Promise(resolve => {
        chrome.storage.local.get(['keyRotationBaseKey'], result => {
          resolve(!!result.keyRotationBaseKey);
        });
      });
      
      if (hasBaseKey) {
        await new Promise(resolve => {
          chrome.storage.local.remove(['keyRotationBaseKey'], () => {
            //console.log('🔐 [CRYPTO] 🗑️ Base key securely deleted after first rotation');
            resolve();
          });
        });
      }
    }
  }

  notifyContentScriptsKeyUpdate(newKey) {
    // Notify all content scripts about the key update
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.includes('discord.com')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'keyRotated',
              newKey: newKey
            }).catch(() => {
              // Tab might not have content script, ignore error
            });
          }
        });
      });
    }
  }

  // ==================== SYNC SUPPORT ====================

  async generateSyncCode(baseKey, intervalMs, startTimestamp) {
    const currentTimestamp = Date.now();
    const rotationsCompleted = Math.floor((currentTimestamp - startTimestamp) / intervalMs);
    
    const syncData = {
      version: 1,
      baseKeyHash: await this.hashKey(baseKey), 
      startTimestamp: startTimestamp,
      intervalMs: intervalMs,
      currentTimestamp: currentTimestamp,
      rotationsCompleted: rotationsCompleted
    };

    // Encrypt with base key
    const syncJson = JSON.stringify(syncData);
    const encryptedSync = await this.encrypt(syncJson, baseKey);
    
    return `DSYNC1:${encryptedSync}`;
  }

  async applySyncCode(syncCode, currentBaseKey) {
    if (!syncCode.startsWith('DSYNC1:')) {
      throw new Error('Invalid sync code format');
    }

    const encryptedData = syncCode.substring(7);
    const decryptedJson = await this.decrypt(encryptedData, currentBaseKey);
    const syncData = JSON.parse(decryptedJson);

    if (syncData.version !== 1) {
      throw new Error('Unsupported sync code version');
    }

    // Verify base key matches
    const currentKeyHash = await this.hashKey(currentBaseKey);
    if (currentKeyHash !== syncData.baseKeyHash) {
      throw new Error('Base key mismatch - ensure both users have the same base key');
    }

    return {
      startTimestamp: syncData.startTimestamp,
      intervalMs: syncData.intervalMs,
      timeDifference: Math.abs(Date.now() - syncData.currentTimestamp),
      rotationsCompleted: syncData.rotationsCompleted
    };
  }
}

// Global instance
const discordCrypto = new DiscordCrypto(); 