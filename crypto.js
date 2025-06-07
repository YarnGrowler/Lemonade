/**
 * Discord Cryptochat - Encryption Utilities
 * Provides AES-GCM encryption/decryption functions
 */

class DiscordCrypto {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
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
    
    console.log(`🔐 [CRYPTO] Compression: ${text.length} → ${compressed.length} chars (${((1 - compressed.length/text.length) * 100).toFixed(1)}% reduction)`);
    
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
}

// Global instance
const discordCrypto = new DiscordCrypto(); 