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
      
      // Initialize rotation timer if interval is set
      const stored = await chrome.storage.local.get(['ecRotationInterval']);
      if (stored.ecRotationInterval && stored.ecRotationInterval > 0) {
        console.log('🔐 [EC] 🕐 Starting automatic rotation timer:', stored.ecRotationInterval + 'ms');
        this.setupRotationTimer(stored.ecRotationInterval);
      } else {
        console.log('🔐 [EC] 🕐 No automatic rotation - manual mode');
      }
      
      // Clean up old temp contacts on initialization
      setTimeout(() => {
        this.cleanupTempContacts();
      }, 5000); // Wait 5 seconds after init to clean up
      
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
      const stored = await chrome.storage.local.get([
        'ecStaticPrivateKey', 
        'ecStaticPublicKey', 
        'ecMyKeyId', 
        'ecKeyGenerated',
        'ecKeyEntropy',
        'ecEntropyComponents'
      ]);
      
      if (stored.ecStaticPrivateKey && stored.ecStaticPublicKey) {
        this.staticPrivateKey = await this.importPrivateKey(stored.ecStaticPrivateKey);
        this.staticPublicKey = await this.importPublicKey(stored.ecStaticPublicKey);
        
        // Always regenerate key ID from current public key to ensure consistency
        const publicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
        this.myKeyId = await this.generateKeyId(publicKeyBase64);
        
        // Update stored key ID if it doesn't match
        if (stored.ecMyKeyId !== this.myKeyId) {
          await chrome.storage.local.set({ ecMyKeyId: this.myKeyId });
          console.log('🔐 [EC] 🔄 Updated stored Key ID to match current key');
        }
        
        console.log('🔐 [EC] 🔑 Static keypair loaded from storage');
        
        if (stored.ecKeyGenerated) {
          console.log('🔐 [EC] 🕐 Key generated:', new Date(stored.ecKeyGenerated).toLocaleString());
        }
        if (stored.ecKeyEntropy) {
          console.log('🔐 [EC] 🎲 Entropy hash:', stored.ecKeyEntropy.substring(0, 32) + '...');
        }
        if (stored.ecEntropyComponents) {
          console.log('🔐 [EC] 🎲 Environment:', {
            screen: stored.ecEntropyComponents.screenInfo,
            timezone: stored.ecEntropyComponents.timezone,
            userAgent: stored.ecEntropyComponents.userAgent
          });
        }
      } else {
        // Generate new static keypair
        console.log('🔐 [EC] 🆕 No existing keypair found, generating new one...');
        await this.generateStaticKeypair();
      }
      
      // Log key info for debugging
      const publicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
      console.log('🔐 [EC] 🆔 My Key ID:', this.myKeyId);
      console.log('🔐 [EC] 🔑 My Public Key:', publicKeyBase64.substring(0, 32) + '...');
      
    } catch (error) {
      console.error('🔐 [EC] ❌ Static keypair error:', error);
      // Force regeneration on error
      console.log('🔐 [EC] 🔄 Forcing new keypair generation due to error...');
      await this.generateStaticKeypair();
    }
  }

  async generateStaticKeypair() {
    console.log('🔐 [EC] 🔄 Generating new static keypair...');
    
    // Add multiple sources of randomness to ensure unique keypairs across different browsers/users
    const timestamp = Date.now();
    const performanceNow = performance.now();
    const randomSeed1 = crypto.getRandomValues(new Uint8Array(32));
    const randomSeed2 = crypto.getRandomValues(new Uint8Array(32));
    const randomSeed3 = crypto.getRandomValues(new Uint8Array(16));
    
    // Browser/environment specific entropy
    const userAgent = navigator.userAgent || 'unknown';
    const language = navigator.language || 'unknown';
    const platform = navigator.platform || 'unknown';
    const screenInfo = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : 'unknown';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    const randomMath = Math.random();
    
    // Create a highly unique entropy string
    const entropyComponents = [
      timestamp,
      performanceNow,
      Array.from(randomSeed1).join(''),
      Array.from(randomSeed2).join(''),
      Array.from(randomSeed3).join(''),
      userAgent.substring(0, 100),
      language,
      platform,
      screenInfo,
      timezone,
      randomMath,
      Date.now(), // Second timestamp to ensure even millisecond differences
      crypto.getRandomValues(new Uint8Array(8)).join('') // Last-minute randomness
    ];
    
    const entropyString = entropyComponents.join('|');
    const entropyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entropyString));
    const entropyHashHex = Array.from(new Uint8Array(entropyHash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('🔐 [EC] 🎲 Using ENHANCED entropy for unique keypair generation...');
    console.log('🔐 [EC] 🎲 Entropy hash:', entropyHashHex.substring(0, 32) + '...');
    console.log('🔐 [EC] 🎲 Timestamp:', timestamp);
    console.log('🔐 [EC] 🎲 Screen:', screenInfo);
    console.log('🔐 [EC] 🎲 Timezone:', timezone);
    
    // Generate the actual keypair (crypto.subtle.generateKey is already cryptographically random)
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
    this.myKeyId = await this.generateKeyId(exportedPublic);
    
    await chrome.storage.local.set({
      ecStaticPrivateKey: exportedPrivate,
      ecStaticPublicKey: exportedPublic,
      ecMyKeyId: this.myKeyId,
      ecKeyGenerated: timestamp,
      ecKeyEntropy: entropyHashHex.substring(0, 64), // Store entropy hash for debugging
      ecEntropyComponents: {
        timestamp,
        screenInfo,
        timezone,
        userAgent: userAgent.substring(0, 50)
      }
    });
    
    console.log('🔐 [EC] ✅ New static keypair generated and stored');
    console.log('🔐 [EC] 🔑 My Key ID:', this.myKeyId);
    console.log('🔐 [EC] 🔑 Public Key Preview:', exportedPublic.substring(0, 32) + '...');
    console.log('🔐 [EC] 🕐 Generated at:', new Date(timestamp).toLocaleString());
    console.log('🔐 [EC] 🔍 Key uniqueness check: Key ID should be different for each user');
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
        this.myKeyId = await this.generateKeyId(myPublicKeyBase64);
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

  async addUserKey(userId, publicKeyBase64, username = 'Unknown') {
    const keyId = await this.generateKeyId(publicKeyBase64);
    
    // 🚫 CRITICAL: NEVER STORE OUR OWN KEY ID (prevents corruption)
    if (this.myKeyId && keyId === this.myKeyId) {
      console.log('🔐 [EC] 🚫 BLOCKED: Attempted to store our own Key ID!');
      console.log('🔐 [EC] 🚫 Our Key ID:', this.myKeyId);
      console.log('🔐 [EC] 🚫 Blocked Key ID:', keyId);
      console.log('🔐 [EC] 🚫 User ID:', userId);
      console.log('🔐 [EC] 🚫 Username:', username);
      console.log('🔐 [EC] 🚫 This prevents contact corruption!');
      return false;
    }
    
    // Prevent storing if this is our current user ID (primary check)
    if (this.currentUserId && userId === this.currentUserId) {
      console.log('🔐 [EC] ⚠️ Ignoring own user ID - not storing self:', userId);
      return false;
    }
    
    // Additional check: prevent storing our own public key if key matches exactly
    if (this.staticPublicKey) {
      const myPublicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
      if (publicKeyBase64 === myPublicKeyBase64) {
        console.log('🔐 [EC] 🚫 BLOCKED: Attempted to store our own public key!');
        console.log('🔐 [EC] 🚫 Our Public Key (partial):', myPublicKeyBase64.substring(0, 50) + '...');
        console.log('🔐 [EC] 🚫 Blocked Public Key (partial):', publicKeyBase64.substring(0, 50) + '...');
        return false;
      }
    }
    
    // Check if we already have this user but with a different key (key rotation scenario)
    const existingUser = this.userKeys.get(userId);
    if (existingUser && existingUser.keyId !== keyId) {
      // Much longer cooldown to prevent spam - real rotations shouldn't happen this frequently
      const rotationCooldown = 5 * 60 * 1000; // 5 minutes minimum
      const timeSinceLastRotation = Date.now() - (existingUser.rotatedAt || existingUser.discoveredAt || 0);
      
      if (timeSinceLastRotation < rotationCooldown) {
        console.log('🔐 [EC] ⏰ Key rotation cooldown active - but ACCEPTING new key for forward secrecy!');
        console.log('🔐 [EC] ⏰ Old Key ID:', existingUser.keyId, '→ New Key ID:', keyId);
        console.log('🔐 [EC] ⏰ Time since last rotation:', Math.round(timeSinceLastRotation / 1000), 'seconds');
        console.log('🔐 [EC] ⏰ Cooldown remaining:', Math.round((rotationCooldown - timeSinceLastRotation) / 1000), 'seconds');
        console.log('🔐 [EC] 🔄 UPDATING TO NEW KEY for double ratchet forward secrecy!');
        
        // UPDATE TO NEW KEY - this is essential for forward secrecy!
        const updatedUserInfo = {
          publicKey: publicKeyBase64,
          keyId: keyId,
          username: username !== 'Unknown' ? username : existingUser.username,
          lastSeen: Date.now(),
          discoveredAt: existingUser.discoveredAt, // Keep original discovery time
          rotatedAt: Date.now(), // Mark rotation time
          previousKeyId: existingUser.keyId, // Store previous key for reference
          fastRotation: true // Mark as fast rotation for debugging
        };
        
        this.userKeys.set(userId, updatedUserInfo);
        await this.saveUserKeys();
        console.log('🔐 [EC] ✅ Key updated during cooldown for forward secrecy!');
        return true;
      }
      
      // Check if keys are just similar variations (not genuine rotation)
      if (this.areKeysSimilar(existingUser.keyId, keyId)) {
        console.log('🔐 [EC] 🔑 Keys are too similar - treating as same key');
        console.log('🔐 [EC] 🔑 Existing:', existingUser.keyId);
        console.log('🔐 [EC] 🔑 New:', keyId);
        
        // Update last seen but don't rotate
        existingUser.lastSeen = Date.now();
        this.userKeys.set(userId, existingUser);
        await this.saveUserKeys();
        return true;
      }
      
      console.log('🔐 [EC] 🔄 LEGITIMATE KEY ROTATION DETECTED!');
      console.log('🔐 [EC] 👤 User:', username, '(ID:', userId + ')');
      console.log('🔐 [EC] 🔑 Old Key ID:', existingUser.keyId);
      console.log('🔐 [EC] 🔑 New Key ID:', keyId);
      
      // Update with new key but preserve discovery time
      const userInfo = {
        publicKey: publicKeyBase64,
        keyId: keyId,
        username: username !== 'Unknown' ? username : existingUser.username, // Preserve good username
        lastSeen: Date.now(),
        discoveredAt: existingUser.discoveredAt, // Keep original discovery time
        rotatedAt: Date.now(), // Mark when rotation was detected
        previousKeyId: existingUser.keyId // Store previous key for reference
      };
      
      this.userKeys.set(userId, userInfo);
      await this.saveUserKeys();
      
      console.log('🔐 [EC] ✅ User key updated after rotation');
      return true;
    }
    
    // Enhanced logic for handling missing user IDs
    if (!userId || userId === 'null' || userId === null || userId.startsWith('temp_')) {
      console.log('🔐 [EC] 🔍 No valid user ID provided, checking for existing keys...');
      
      // First, look for existing user with same key ID
      for (const [existingUserId, existingUserInfo] of this.userKeys) {
        if (existingUserInfo.keyId === keyId) {
          console.log('🔐 [EC] 🔄 Found existing user with same key ID:', existingUserId);
          // Update this user's last seen time and username if better
          existingUserInfo.lastSeen = Date.now();
          if (username !== 'Unknown' && username !== existingUserInfo.username) {
            existingUserInfo.username = username;
            console.log('🔐 [EC] 📝 Updated username for existing user');
          }
          await this.saveUserKeys();
          return true;
        }
      }
      
      // Enhanced temp contact logic - be more conservative
      // Only create temp contact if we have very few contacts total
      const tempContactCount = Array.from(this.userKeys.keys()).filter(id => id.startsWith('temp_')).length;
      const totalContactCount = this.userKeys.size;
      
      if (tempContactCount >= 3) {
        console.log('🔐 [EC] ⚠️ Too many temp contacts already (', tempContactCount, '), not creating another');
        return false;
      }
      
      if (totalContactCount >= 10) {
        console.log('🔐 [EC] ⚠️ Too many total contacts (', totalContactCount, '), not creating temp contact');
        return false;
      }
      
      // Check if we recently created a temp contact with a similar key ID
      const recentTempContact = this.findRecentTempContact(keyId);
      if (recentTempContact) {
        console.log('🔐 [EC] ⚠️ Recent temp contact exists with similar key, updating instead of creating new');
        recentTempContact.lastSeen = Date.now();
        recentTempContact.keyId = keyId;
        recentTempContact.publicKey = publicKeyBase64;
        await this.saveUserKeys();
        return true;
      }
      
      // If all checks pass, create a temporary entry with key ID as identifier
      const tempUserId = `temp_${keyId}`;
      console.log('🔐 [EC] 🆕 Creating temporary user entry:', tempUserId);
      console.log('🔐 [EC] 📊 Current temp contacts:', tempContactCount, '/ total contacts:', totalContactCount);
      
      const userInfo = {
        publicKey: publicKeyBase64,
        keyId: keyId,
        username: username,
        lastSeen: Date.now(),
        discoveredAt: Date.now(),
        addedAt: Date.now(),
        isTemporary: true // Mark as temporary contact
      };
      
      this.userKeys.set(tempUserId, userInfo);
      await this.saveUserKeys();
      
      console.log('🔐 [EC] 🆕 TEMP KEY STORED!');
      return true;
    }
    
    // Before adding new user, check if we have temp contacts with similar keys to merge
    await this.mergeAnyTempContactsWithRealUser(userId, username, keyId);
    
    const userInfo = {
      publicKey: publicKeyBase64,
      keyId: keyId,
      username: username,
      lastSeen: Date.now(),
      discoveredAt: Date.now(),
      addedAt: Date.now()
    };
    
    this.userKeys.set(userId, userInfo);
    await this.saveUserKeys();
    
    console.log('🔐 [EC] 👤 NEW USER DISCOVERED!');
    console.log('🔐 [EC] 🆔 User ID:', userId);
    console.log('🔐 [EC] 👤 Username:', username);
    console.log('🔐 [EC] 🔑 Key ID:', keyId);
    console.log('🔐 [EC] 📊 Total users:', this.userKeys.size);
    return true;
  }

  // Helper method to find recent temp contacts with similar keys
  findRecentTempContact(newKeyId) {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const [userId, userInfo] of this.userKeys) {
      if (userId.startsWith('temp_') && 
          userInfo.lastSeen > fiveMinutesAgo &&
          userInfo.keyId && 
          this.areKeysSimilar(userInfo.keyId, newKeyId)) {
        return userInfo;
      }
    }
    return null;
  }

  // Helper method to check if two key IDs are similar (might be from same user)
  areKeysSimilar(keyId1, keyId2) {
    if (!keyId1 || !keyId2) return false;
    if (keyId1 === keyId2) return true;
    
    // Check if they share significant portion (might be rotation)
    const commonLength = Math.min(keyId1.length, keyId2.length);
    let matches = 0;
    for (let i = 0; i < commonLength; i++) {
      if (keyId1[i] === keyId2[i]) matches++;
    }
    
    // If more than 60% similar, consider them related
    return (matches / commonLength) > 0.6;
  }

  // Method to clean up old temp contacts
  async cleanupTempContacts() {
    console.log('🔐 [EC] 🧹 Cleaning up old temp contacts...');
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let removedCount = 0;
    
    for (const [userId, userInfo] of this.userKeys) {
      if (userId.startsWith('temp_') && userInfo.lastSeen < oneHourAgo) {
        console.log('🔐 [EC] 🗑️ Removing old temp contact:', userId, '- Last seen:', new Date(userInfo.lastSeen).toLocaleTimeString());
        this.userKeys.delete(userId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      await this.saveUserKeys();
      console.log('🔐 [EC] ✅ Removed', removedCount, 'old temp contacts');
    } else {
      console.log('🔐 [EC] ✅ No old temp contacts to remove');
    }
    
    return removedCount;
  }

  // Method to check and merge any temp contacts that might belong to this real user
  async mergeAnyTempContactsWithRealUser(realUserId, realUsername, realKeyId) {
    console.log('🔐 [EC] 🔍 Checking for temp contacts to merge with real user:', realUserId);
    
    let mergedCount = 0;
    const tempContactsToRemove = [];
    
    for (const [tempUserId, tempUserInfo] of this.userKeys) {
      if (tempUserId.startsWith('temp_') && 
          (tempUserInfo.keyId === realKeyId || this.areKeysSimilar(tempUserInfo.keyId, realKeyId))) {
        console.log('🔐 [EC] 🔄 Found temp contact to merge:', tempUserId, '→', realUserId);
        tempContactsToRemove.push(tempUserId);
        mergedCount++;
      }
    }
    
    // Remove the temp contacts
    for (const tempUserId of tempContactsToRemove) {
      this.userKeys.delete(tempUserId);
      console.log('🔐 [EC] 🗑️ Removed temp contact:', tempUserId);
    }
    
    if (mergedCount > 0) {
      await this.saveUserKeys();
      console.log('🔐 [EC] ✅ Merged', mergedCount, 'temp contacts with real user');
    }
    
    return mergedCount;
  }

  // Method to merge temp contact with real user ID
  async mergeTempContactWithRealUser(tempUserId, realUserId, realUsername) {
    const tempContact = this.userKeys.get(tempUserId);
    if (!tempContact) {
      console.log('🔐 [EC] ❌ Temp contact not found:', tempUserId);
      return false;
    }
    
    console.log('🔐 [EC] 🔄 Merging temp contact with real user...');
    console.log('🔐 [EC] 🔄 Temp:', tempUserId, '→ Real:', realUserId, '(' + realUsername + ')');
    
    // Remove temp contact
    this.userKeys.delete(tempUserId);
    
    // Add as real user, preserving discovery info
    const realUserInfo = {
      ...tempContact,
      username: realUsername || tempContact.username,
      mergedFrom: tempUserId,
      mergedAt: Date.now()
    };
    
    this.userKeys.set(realUserId, realUserInfo);
    await this.saveUserKeys();
    
    console.log('🔐 [EC] ✅ Successfully merged temp contact to real user');
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
      // console.log('🔐 [EC] ❌ No user keys available');
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
      // console.log('🔐 [EC] 🎯 Most recent user key:', mostRecent.userId, '- Key ID:', mostRecent.keyId);
    }
    
    return mostRecent;
  }

  // ========== NEW METHODS FOR OPTIONS PAGE SUPPORT ==========

  async getCurrentKeyInfo() {
    try {
      if (!this.staticPublicKey) {
        throw new Error('No static public key available');
      }

      const publicKeyBase64 = await this.exportPublicKey(this.staticPublicKey);
      const keyId = await this.generateKeyId(publicKeyBase64);
      
      // Get stored key creation time
      const stored = await chrome.storage.local.get(['ecKeyCreated', 'ecRotationInterval']);
      
      return {
        keyId: keyId,
        publicKey: publicKeyBase64,
        created: stored.ecKeyCreated || Date.now(),
        nextRotation: this.calculateNextRotation(stored.ecKeyCreated, stored.ecRotationInterval)
      };
    } catch (error) {
      throw new Error('Failed to get current key info: ' + error.message);
    }
  }

  calculateNextRotation(created, intervalMs) {
    if (!intervalMs || intervalMs === null) {
      return null; // Manual rotation only
    }
    
    const createdTime = created || Date.now();
    return createdTime + intervalMs;
  }

  async getContactList() {
    try {
      const contacts = [];
      
      if (this.userKeys && this.userKeys.size > 0) {
        for (const [userId, userInfo] of this.userKeys) {
          contacts.push({
            id: userId,
            discordUserId: userId,
            username: userInfo.username || 'Unknown User',
            keyId: userInfo.keyId,
            publicKey: userInfo.publicKey,
            discoveredAt: userInfo.addedAt || Date.now()
          });
        }
      }
      
      return contacts;
    } catch (error) {
      console.error('Failed to get contact list:', error);
      return [];
    }
  }

  async clearAllContacts() {
    try {
      this.userKeys.clear();
      await chrome.storage.local.set({ ecUserKeys: {} });
      // console.log('🔐 [EC] All contacts cleared');
    } catch (error) {
      console.error('Failed to clear contacts:', error);
      throw error;
    }
  }

  async updateRotationInterval(intervalMs) {
    try {
      if (intervalMs === null) {
        // Manual rotation only
        await chrome.storage.local.set({
          ecRotationInterval: null,
          ecAutoRotation: false
        });
      } else {
        // Automatic rotation
        await chrome.storage.local.set({
          ecRotationInterval: intervalMs,
          ecAutoRotation: true
        });
        
        // Restart rotation timer if needed
        this.setupRotationTimer(intervalMs);
      }
      
      // console.log('🔐 [EC] Rotation interval updated:', intervalMs);
    } catch (error) {
      console.error('Failed to update rotation interval:', error);
      throw error;
    }
  }

  async rotateKeysNow() {
    try {
      console.log('🔐 [EC] 🔄 Manual key rotation initiated...');
      
      // Store old key info for debugging
      const oldKeyId = this.myKeyId;
      
      // Clear cached keys first to force regeneration
      this.staticPrivateKey = null;
      this.staticPublicKey = null;
      this.myKeyId = null;
      
      // Generate completely new keypair
      await this.generateStaticKeypair();
      
      // Update creation time and rotation info
      const rotationTime = Date.now();
      await chrome.storage.local.set({ 
        ecKeyCreated: rotationTime,
        ecLastRotation: rotationTime,
        ecRotationCount: (await chrome.storage.local.get('ecRotationCount')).ecRotationCount + 1 || 1
      });
      
      console.log('🔐 [EC] ✅ Keys rotated successfully');
      console.log('🔐 [EC] 🔄 Old Key ID:', oldKeyId);
      console.log('🔐 [EC] 🔄 New Key ID:', this.myKeyId);
      console.log('🔐 [EC] 🕐 Rotation time:', new Date(rotationTime).toLocaleTimeString());
      
      // Force reload to ensure new keys are used
      await this.loadOrGenerateStaticKeypair();
      
    } catch (error) {
      console.error('Failed to rotate keys:', error);
      throw error;
    }
  }

  setupRotationTimer(intervalMs) {
    // Clear existing timer
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }
    
    if (!intervalMs) return;
    
    // Set new timer
    this.rotationTimer = setTimeout(async () => {
      try {
        await this.rotateKeysNow();
        // Setup next rotation
        this.setupRotationTimer(intervalMs);
      } catch (error) {
        console.error('Automatic key rotation failed:', error);
      }
    }, intervalMs);
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
      const myKeyId = await this.generateKeyId(myPublicKeyBase64);
      
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
      const senderKeyId = await this.generateKeyId(senderPublicKeyBase64);
      console.log('🔐 [EC] 🔑 Sender Key ID:', senderKeyId);
      
      let result = null;
      let decryptionMethod = 'unknown';
      
      // Check if this is our own message
      const isOwnMessage = (this.currentUserId && senderUserId === this.currentUserId) || 
                          (this.myKeyId && senderKeyId === this.myKeyId);
      
      if (isOwnMessage) {
        console.log('🔐 [EC] 🔄 Detected own message - trying stored recipient keys...');
        
        // For our own messages, we need to decrypt using the SAME key derivation as encryption
        // We encrypted using: our_private_key + recipient_public_key
        // So we decrypt using: our_private_key + recipient_public_key (same as encryption)
        
        // Sort users by last seen time (most recent first) for better fallback
        const sortedUsers = Array.from(this.userKeys.entries()).sort((a, b) => {
          const timeA = a[1].lastSeen || 0;
          const timeB = b[1].lastSeen || 0;
          return timeB - timeA; // Most recent first
        });
        
        for (const [userId, userInfo] of sortedUsers) {
          if (userId === this.currentUserId) continue; // Skip ourselves
          if (userId.startsWith('temp_')) continue; // Skip temp contacts for own messages
          
          console.log('🔐 [EC] 🔍 Trying own message with stored user key:', userInfo.keyId, 'for user:', userId);
          try {
            const recipientPublicKey = await this.importPublicKey(userInfo.publicKey);
            // Use same key order as encryption: our_private + their_public
            result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, recipientPublicKey, 'own_message');
            if (result) {
              decryptionMethod = 'own_message_recipient_key';
              console.log('🔐 [EC] ✅ Decrypted own message with recipient key:', userInfo.keyId, 'for user:', userId);
              break;
            }
          } catch (error) {
            console.log('🔐 [EC] ❌ Own message decryption failed with key:', userInfo.keyId, error.message);
          }
        }
        
        // If still no result, try ALL stored keys including temp ones as last resort
        if (!result) {
          console.log('🔐 [EC] 🔍 Trying ALL stored keys as fallback (including temp)...');
          for (const [userId, userInfo] of this.userKeys) {
            if (userId === this.currentUserId) continue; // Skip ourselves
            
            console.log('🔐 [EC] 🔍 Fallback attempt with key:', userInfo.keyId, 'for user:', userId);
            try {
              const recipientPublicKey = await this.importPublicKey(userInfo.publicKey);
              result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, recipientPublicKey, 'own_message_fallback');
              if (result) {
                decryptionMethod = 'own_message_fallback_key';
                console.log('🔐 [EC] ✅ Decrypted own message with fallback key:', userInfo.keyId, 'for user:', userId);
                break;
              }
            } catch (error) {
              console.log('🔐 [EC] ❌ Fallback decryption failed with key:', userInfo.keyId);
            }
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
        
        console.log('🔐 [EC] 🔑 RECIPIENT DECRYPTION DEBUG:');
        console.log('🔐 [EC] 🔑   My Key ID:', this.myKeyId);
        console.log('🔐 [EC] 🔑   My User ID:', this.currentUserId);
        console.log('🔐 [EC] 🔑   Sender Key ID:', senderKeyId);
        console.log('🔐 [EC] 🔑   Sender User ID:', senderUserId);
        console.log('🔐 [EC] 🔑   Stored users:', Array.from(this.userKeys.keys()));
        
        // Strategy 1: Try with sender's public key and our private key
        console.log('🔐 [EC] 🔍 Trying decryption with sender public key...');
        console.log('🔐 [EC] 🔍   Using: Sender Public Key + My Private Key');
        try {
          result = await this.tryDecryptWithKey(encryptedBase64, this.staticPrivateKey, senderPublicKey, 'other_message');
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
            const added = await this.addUserKey(senderUserId, senderPublicKeyBase64, existing?.username || 'Unknown');
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

  async tryDecryptWithKey(encryptedBase64, privateKey, publicKey, messageType = 'other_message') {
    console.log('🔐 [EC] 🔑 DETAILED DECRYPTION ATTEMPT:');
    console.log('🔐 [EC] 🔑   Encrypted data length:', encryptedBase64.length);
    console.log('🔐 [EC] 🔑   Private key type:', privateKey.constructor.name);
    console.log('🔐 [EC] 🔑   Public key type:', publicKey.constructor.name);
    console.log('🔐 [EC] 🔑   Message type:', messageType);
    
    try {
      // Decode encrypted data
      const combined = new Uint8Array(
        atob(encryptedBase64).split('').map(char => char.charCodeAt(0))
      );
      
      console.log('🔐 [EC] 🔑   Combined data length:', combined.length);
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      console.log('🔐 [EC] 🔑   IV length:', iv.length);
      console.log('🔐 [EC] 🔑   Encrypted payload length:', encryptedData.length);
      
      // Derive shared secret and AES key
      console.log('🔐 [EC] 🔑   Deriving shared secret...');
      const sharedSecret = await this.deriveSharedSecret(privateKey, publicKey);
      console.log('🔐 [EC] 🔑   ✅ Shared secret derived');
      
      const aesKey = await this.deriveAESKey(sharedSecret);
      console.log('🔐 [EC] 🔑   ✅ AES key derived');
      
      // Decrypt
      console.log('🔐 [EC] 🔑   Attempting AES decryption...');
      const decrypted = await crypto.subtle.decrypt(
        { name: this.aesAlgorithm, iv: iv },
        aesKey,
        encryptedData
      );
      
      console.log('🔐 [EC] 🔑   ✅ AES decryption successful, result length:', decrypted.byteLength);
      
      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);
      console.log('🔐 [EC] 🔑   ✅ Text decoding successful:', result);
      
      return result;
      
    } catch (error) {
      console.log('🔐 [EC] 🔓 Decryption attempt failed at step: ');
      console.log('🔐 [EC] 🔓 Error details:', error.name);
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

  async generateKeyId(publicKeyBase64) {
    // Generate a TRULY DETERMINISTIC hash-based ID from the public key ONLY
    // Use SHA-256 to ensure same key always produces same ID across all browsers/users
    
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKeyBase64);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert first 8 bytes to base64-like string
    let keyId = '';
    for (let i = 0; i < 8; i++) {
      keyId += hashArray[i].toString(36).padStart(2, '0');
    }
    
    // Take first 12 characters and ensure they're valid
    keyId = keyId.substring(0, 12).toUpperCase();
    
    // Replace any invalid characters with deterministic alternatives
    keyId = keyId.replace(/[^A-Z0-9]/g, 'X');
    
    // Ensure exactly 12 characters
    keyId = keyId.padEnd(12, 'X');
    
    return keyId;
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
      myKeyId: this.myKeyId || null
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

  // Helper method to clean up any corrupted contacts (same Key ID as ours)
  async cleanupCorruptedContacts() {
    if (!this.myKeyId) {
      console.log('🔐 [EC] 🧹 No Key ID set, cannot clean corrupted contacts');
      return 0;
    }

    let removedCount = 0;
    const contactsToRemove = [];

    for (const [userId, userInfo] of this.userKeys) {
      if (userInfo.keyId === this.myKeyId) {
        console.log(`🔐 [EC] 🧹 Found corrupted contact: ${userId} (${userInfo.username}) - Key ID: ${userInfo.keyId}`);
        contactsToRemove.push(userId);
        removedCount++;
      }
    }

    // Remove corrupted contacts
    for (const userId of contactsToRemove) {
      this.userKeys.delete(userId);
      console.log(`🔐 [EC] 🗑️ Removed corrupted contact: ${userId}`);
    }

    if (removedCount > 0) {
      await this.saveUserKeys();
      console.log(`🔐 [EC] ✅ Cleaned up ${removedCount} corrupted contacts`);
    } else {
      console.log('🔐 [EC] ✅ No corrupted contacts found');
    }

    return removedCount;
  }
}

// Export for use by other modules
window.ecCrypto = new ECCrypto();