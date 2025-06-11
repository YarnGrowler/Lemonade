/**
 * Lemonade - Discord Encryption
 * Background Script - Handles extension lifecycle and message passing
 * 🍋 Sweet & Secure Discord Encryption
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    //console.log('Lemonade extension installed');
    
    // Open options page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  } else if (details.reason === 'update') {
    //console.log('Lemonade extension updated');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openOptions':
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html')
      });
      break;
      
    case 'getStatus':
      // Return extension status
      sendResponse({
        active: true,
        version: chrome.runtime.getManifest().version
      });
      break;
      
    default:
      //console.log('Unknown message action:', message.action);
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if we're on Discord
  if (tab.url && (tab.url.includes('discord.com'))) {
    // Extension is already active on Discord, open popup
    return;
  } else {
    // Not on Discord, open options page
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  }
});

//console.log('Lemonade background script loaded');

// ==================== KEY ROTATION MONITORING ====================

class BackgroundKeyRotation {
  constructor() {
    this.lastKeyRotationCheck = 0;
    this.keyRotationCheckInterval = 10000; // 10 seconds
    this.currentStoredKey = null;
    this.init();
  }

  async init() {
    //console.log('🔐 [BACKGROUND] Initializing key rotation monitoring...');
    
    // Load current stored key
    const result = await chrome.storage.local.get(['encryptionKey']);
    this.currentStoredKey = result.encryptionKey;
    
    // Start monitoring immediately
    this.startKeyRotationMonitoring();
  }

  startKeyRotationMonitoring() {
    // Check immediately on startup
    setTimeout(() => this.checkAndRotateKey(), 1000);
    
    // Then check every 10 seconds
    setInterval(() => this.checkAndRotateKey(), this.keyRotationCheckInterval);
    
    //console.log('🔐 [BACKGROUND] 🔄 Key rotation monitoring started');
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
      if (!settings.enabled || !settings.intervalMs) {
        return; // Key rotation not configured
      }
      
      // For first rotation we need base key, for subsequent rotations we don't
      const rotationData = await this.getLastRotationData();
      if (rotationData.count === 0 && !settings.baseKey) {
        //console.log('🔐 [BACKGROUND] ⚠️ Base key required for first rotation but not found');
        return;
      }
      
      const currentKey = await this.getCurrentRotatedKey(settings);
      const storedKey = await this.getStoredKey();
      
      if (currentKey !== storedKey) {
        //console.log('🔐 [BACKGROUND] 🔄 Key rotation needed - updating key');
        //console.log(`🔐 [BACKGROUND] Old key: ${storedKey?.substring(0, 8)}...`);
        //console.log(`🔐 [BACKGROUND] New key: ${currentKey?.substring(0, 8)}...`);
        
                 await this.storeKey(currentKey);
         this.currentStoredKey = currentKey;
         
         // Update rotation tracking
         await this.updateRotationData();
         
         // Security: Delete base key after first rotation
         await this.deleteBaseKeyAfterFirstRotation(settings);
         
         // Notify all Discord content scripts about key update
         await this.notifyContentScriptsKeyUpdate(currentKey);
        
        //console.log('🔐 [BACKGROUND] ✅ Key rotation completed and content scripts notified');
      }
      
    } catch (error) {
      //console.log('🔐 [BACKGROUND] ❌ Key rotation check failed:', error);
    }
  }

  async getCurrentRotatedKey(settings) {
    const { baseKey, intervalMs, startTimestamp } = settings;
    const now = Date.now();
    
    // Get current stored key and rotation data
    const storedKey = await this.getStoredKey();
    const lastRotationData = await this.getLastRotationData();
    
    //console.log(`🔐 [BACKGROUND] 🔄 Rotation check: stored key exists=${!!storedKey}, last rotation count=${lastRotationData.count}, last timestamp=${lastRotationData.timestamp}`);
    
    // Determine next rotation time
    let nextRotationTime;
    if (lastRotationData.count === 0 && lastRotationData.timestamp === 0) {
      // First rotation ever
      nextRotationTime = startTimestamp + intervalMs;
      //console.log(`🔐 [BACKGROUND] 🔄 First rotation scheduled at ${new Date(nextRotationTime)}`);
    } else {
      // Subsequent rotations based on last rotation
      nextRotationTime = lastRotationData.timestamp + intervalMs;
      //console.log(`🔐 [BACKGROUND] 🔄 Next rotation scheduled at ${new Date(nextRotationTime)}`);
    }
    
    // Check if rotation is needed
    if (now >= nextRotationTime) {
      const newRotationCount = lastRotationData.count + 1;
      //console.log(`🔐 [BACKGROUND] 🔄 Performing rotation #${newRotationCount}`);
      
      // For first rotation, use base key. For subsequent rotations, use current stored key
      const sourceKey = (lastRotationData.count === 0) ? baseKey : storedKey;
      
      if (!sourceKey) {
        throw new Error(`Source key missing for rotation #${newRotationCount}`);
      }
      
      // Simple sequential hashing - no entropy for better sync compatibility
      const newKey = await this.simpleHashKey(sourceKey, newRotationCount);
      
      //console.log(`🔐 [BACKGROUND] 🔄 Rotation #${newRotationCount}: ${sourceKey.substring(0, 8)}... → ${newKey.substring(0, 8)}...`);
      
      return newKey;
    }
    
    // No rotation needed - return current key
    //console.log(`🔐 [BACKGROUND] 🔄 No rotation needed (next in ${Math.ceil((nextRotationTime - now) / 1000)}s)`);
    return storedKey;
  }

  async simpleHashKey(key, rotationNumber) {
    // Simple sequential hashing: hash(key + rotation number)
    // Much simpler and more reliable for sync
    const combinedString = `${key}::rotation::${rotationNumber}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(combinedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert to hex string
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async deleteBaseKeyAfterFirstRotation(settings) {
    // Only delete base key after we've confirmed first rotation is complete
    const rotationData = await this.getLastRotationData();
    
    if (rotationData.count >= 1) {
      const result = await chrome.storage.local.get(['keyRotationBaseKey']);
      if (result.keyRotationBaseKey) {
        // Use secure deletion
        await this.secureStorageDelete(['keyRotationBaseKey']);
        console.log('🔐 [BACKGROUND] 🗑️ Base key securely wiped after first rotation');
      }
    }
  }

  /**
   * Secure Chrome storage overwrite before deletion (for background script)
   */
  async secureStorageDelete(keys) {
    if (!Array.isArray(keys)) keys = [keys];
    
    console.log('🔐 [BACKGROUND] 🗑️ Secure storage deletion for:', keys);
    
    // Multiple overwrite passes with random data
    for (let pass = 0; pass < 5; pass++) {
      const overwriteData = {};
      for (const key of keys) {
        // Generate random data
        const randomSize = 1024 + Math.floor(Math.random() * 1024); // 1-2KB
        const randomBytes = crypto.getRandomValues(new Uint8Array(randomSize));
        const randomString = Array.from(randomBytes).map(b => 
          String.fromCharCode(b)).join('');
        overwriteData[key] = randomString;
      }
      
      await new Promise((resolve) => {
        chrome.storage.local.set(overwriteData, resolve);
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Delete the keys
    await new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
    
    // Final confusion overwrites
    for (let finalPass = 0; finalPass < 2; finalPass++) {
      const confusionData = {};
      for (const key of keys) {
        confusionData[key] = null;
      }
      await new Promise((resolve) => {
        chrome.storage.local.set(confusionData, resolve);
      });
      
      await new Promise((resolve) => {
        chrome.storage.local.remove(keys, resolve);
      });
    }
    
    console.log('🔐 [BACKGROUND] ✅ Secure storage deletion completed');
  }

  async notifyContentScriptsKeyUpdate(newKey) {
    try {
      const tabs = await chrome.tabs.query({});
      let notificationsSent = 0;
      
      for (const tab of tabs) {
        if (tab.url && tab.url.includes('discord.com')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'keyRotated',
              newKey: newKey
            });
            notificationsSent++;
            //console.log(`🔐 [BACKGROUND] ✅ Notified tab ${tab.id} of key rotation`);
          } catch (error) {
            //console.log(`🔐 [BACKGROUND] ⚠️ Failed to notify tab ${tab.id}:`, error.message);
          }
        }
      }
      
      //console.log(`🔐 [BACKGROUND] 📡 Sent key rotation notifications to ${notificationsSent} Discord tabs`);
      
    } catch (error) {
      //console.log('🔐 [BACKGROUND] ❌ Failed to notify content scripts:', error);
    }
  }

  async getKeyRotationSettings() {
    const result = await chrome.storage.local.get([
      'keyRotationEnabled',
      'keyRotationBaseKey', 
      'keyRotationIntervalMs',
      'keyRotationStartTimestamp'
    ]);
    
    return {
      enabled: result.keyRotationEnabled || false,
      baseKey: result.keyRotationBaseKey || null,
      intervalMs: result.keyRotationIntervalMs || 0,
      startTimestamp: result.keyRotationStartTimestamp || Date.now()
    };
  }

  async getStoredKey() {
    const result = await chrome.storage.local.get(['encryptionKey']);
    return result.encryptionKey || null;
  }

  async storeKey(key) {
    await chrome.storage.local.set({ encryptionKey: key });
  }

  async getLastRotationData() {
    const result = await chrome.storage.local.get(['lastRotationTimestamp', 'rotationCount']);
    return {
      timestamp: result.lastRotationTimestamp || 0,
      count: result.rotationCount || 0
    };
  }

  async updateRotationData() {
    const currentData = await this.getLastRotationData();
    const newTimestamp = Date.now();
    const newCount = currentData.count + 1;
    
    await chrome.storage.local.set({
      lastRotationTimestamp: newTimestamp,
      rotationCount: newCount
    });
    
    //console.log(`🔐 [BACKGROUND] 📊 Rotation tracking updated: count=${newCount}, timestamp=${newTimestamp}`);
  }

  async resetRotationTracking() {
    await chrome.storage.local.set({
      lastRotationTimestamp: Date.now(),
      rotationCount: 0
    });
  }

  // Helper method to calculate expected key for any rotation number (for sync debugging)
  async calculateKeyForRotation(baseKey, intervalMs, rotationNumber) {
    if (rotationNumber === 0) {
      return baseKey; // Rotation 0 is the base key itself
    }
    
    // Simple sequential hashing - no entropy needed
    let currentKey = baseKey;
    for (let i = 1; i <= rotationNumber; i++) {
      currentKey = await this.simpleHashKey(currentKey, i);
    }
    
    return currentKey;
  }
}

// ==================== EC (ASYMMETRIC) KEY ROTATION MONITORING ====================

class BackgroundECRotation {
  constructor() {
    this.lastECRotationCheck = 0;
    this.ecRotationCheckInterval = 5000; // 5 seconds (more frequent for testing)
    this.init();
  }

  async init() {
    //console.log('🔐 [BACKGROUND] 🔑 Initializing EC key rotation monitoring...');
    
    // Start monitoring immediately
    this.startECRotationMonitoring();
  }

  startECRotationMonitoring() {
    // Check immediately on startup
    setTimeout(() => this.checkAndRotateECKey(), 2000);
    
    // Then check every 5 seconds
    setInterval(() => this.checkAndRotateECKey(), this.ecRotationCheckInterval);
    
    //console.log('🔐 [BACKGROUND] 🔑 EC key rotation monitoring started');
  }

  async checkAndRotateECKey() {
    try {
      const now = Date.now();
      
      // Don't check too frequently
      if (now - this.lastECRotationCheck < this.ecRotationCheckInterval) {
        return;
      }
      
      this.lastECRotationCheck = now;
      
      const settings = await this.getECRotationSettings();
      if (!settings.enabled || !settings.intervalMs) {
        return; // EC rotation not configured or disabled
      }
      
                   // PROPER EPOCH-BASED rotation check (survives restarts)
      // Use stored epoch timestamp as absolute reference point
      let rotationEpoch = settings.rotationEpoch || settings.lastRotation || settings.keyGenerated;
      
      if (!rotationEpoch) {
        // No epoch set yet - set it now and store it
        rotationEpoch = now;
        await chrome.storage.local.set({ 
          ecRotationEpoch: rotationEpoch,
          ecLastRotation: rotationEpoch 
        });
        // console.log('🔐 [BACKGROUND] 🔑 Set new EC rotation epoch:', new Date(rotationEpoch).toLocaleString());
      }
      
      // Calculate how many rotation cycles have passed since epoch
      const timeSinceEpoch = now - rotationEpoch;
      const cyclesPassed = Math.floor(timeSinceEpoch / settings.intervalMs);
      
      // Next rotation is at epoch + (cycles + 1) * interval
      const nextRotationTime = rotationEpoch + ((cyclesPassed + 1) * settings.intervalMs);
      
      if (now >= nextRotationTime) {
        //console.log('🔐 [BACKGROUND] 🔑 EC key rotation due - triggering rotation');
        //console.log(`🔐 [BACKGROUND] 🔑 Last rotation: ${new Date(lastRotation).toLocaleString()}`);
        //console.log(`🔐 [BACKGROUND] 🔑 Next rotation was: ${new Date(nextRotationTime).toLocaleString()}`);
        //console.log(`🔐 [BACKGROUND] 🔑 Overdue by: ${Math.round((now - nextRotationTime) / 1000)} seconds`);
        
        // Trigger rotation by notifying Discord tabs
        await this.triggerECKeyRotation();
        
        // Update last rotation time to prevent immediate re-rotation
        await chrome.storage.local.set({
          ecLastRotation: now
        });
        
        console.log('🔐 [BACKGROUND] 🔑 ✅ EC key rotation triggered and timestamp updated');
      } else {
        const timeUntilNext = Math.ceil((nextRotationTime - now) / 1000);
        if (timeUntilNext % 30 === 0) { // Log every 30 seconds
          console.log(`🔐 [BACKGROUND] 🔑 EC rotation in ${timeUntilNext}s (Epoch: ${new Date(rotationEpoch).toLocaleString()}, Cycles: ${cyclesPassed})`);
        }
      }
      
    } catch (error) {
      //console.log('🔐 [BACKGROUND] 🔑 ❌ EC rotation check failed:', error);
    }
  }

  async triggerECKeyRotation() {
    try {
      // Get all Discord tabs
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      if (tabs.length === 0) {
        //console.log('🔐 [BACKGROUND] 🔑 No Discord tabs found for EC rotation');
        return;
      }
      
      // Send rotation command to all Discord tabs
      const rotationPromises = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          action: 'rotateECKeys',
          source: 'background_timer'
        }).catch(error => {
          //console.log(`🔐 [BACKGROUND] 🔑 Failed to send rotation to tab ${tab.id}:`, error.message);
        })
      );
      
      await Promise.all(rotationPromises);
      //console.log(`🔐 [BACKGROUND] 🔑 Sent EC rotation command to ${tabs.length} Discord tabs`);
      
    } catch (error) {
      //console.log('🔐 [BACKGROUND] 🔑 Failed to trigger EC rotation:', error);
    }
  }

  async getECRotationSettings() {
    try {
      const result = await chrome.storage.local.get([
        'ecEnabled',
        'ecRotationInterval', 
        'ecRotationEpoch',
        'ecLastRotation',
        'ecKeyGenerated'
      ]);
      
      return {
        enabled: result.ecEnabled || false,
        intervalMs: result.ecRotationInterval || null,
        rotationEpoch: result.ecRotationEpoch || 0,
        lastRotation: result.ecLastRotation || 0,
        keyGenerated: result.ecKeyGenerated || 0
      };
    } catch (error) {
      //console.log('🔐 [BACKGROUND] 🔑 Failed to get EC rotation settings:', error);
      return { enabled: false, intervalMs: null, rotationEpoch: 0, lastRotation: 0, keyGenerated: 0 };
    }
  }
}

// Initialize key rotation monitoring
const keyRotationManager = new BackgroundKeyRotation(); 
const ecRotationManager = new BackgroundECRotation(); 