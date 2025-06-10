/**
 * Discord Cryptochat - Simplified Message Processor
 * Simple encoding/decoding with user key discovery
 */

class ECMessageProcessor {
  constructor() {
    this.ecCrypto = null;
    this.messagePrefix = 'EC:';
    this.isEnabled = false;
    
    //console.log('🔐 [MSG] Initializing simplified message processor...');
    this.init();
  }

  async init() {
    try {
      // Wait for ecCrypto to be available
      if (typeof window.ecCrypto !== 'undefined') {
        this.ecCrypto = window.ecCrypto;
        this.isEnabled = true;
        //console.log('🔐 [MSG] ✅ Message processor initialized');
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



    try {
      // Encrypt using ECCrypto
      const encryptedData = await this.ecCrypto.encrypt(plaintext, recipientUserId);
      
      // Format: EC:encryptedData:PK:senderPublicKey:keyId
      const formattedMessage = `${this.messagePrefix}${encryptedData.encrypted}:PK:${encryptedData.senderPublicKey}:${encryptedData.keyId}`;
      
      // Encode as Chinese characters for stealth
      const chineseMessage = this.encodeAsChineseCharacters(formattedMessage);
      

      
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



    try {
      // Decode Chinese characters back to formatted message
      const decodedMessage = this.decodeChineseCharacters(chineseMessage);
      
      // Parse the message format: EC:encryptedData:PK:senderPublicKey:keyId
      const match = decodedMessage.match(/^EC:([A-Za-z0-9+/=]+):PK:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]{12})$/);
      
      if (!match) {
        throw new Error('Invalid message format');
      }
      
      const [, encryptedData, senderPublicKey, keyId] = match;
      

      
      // Extract and store sender's public key if we have user info
      if (senderUserId) {
        this.storeSenderPublicKey(senderUserId, senderPublicKey, keyId);
      }
      
      // Decrypt the message
      const decryptedText = await this.ecCrypto.decrypt(encryptedData, senderPublicKey, senderUserId);
      

      
      return decryptedText;
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ DECRYPTION FAILED:', error);
      throw error;
    }
  }

  // ==================== PUBLIC KEY DISCOVERY ====================

  async storeSenderPublicKey(senderUserId, publicKeyBase64, keyId, username = 'Unknown') {
    if (!this.ecCrypto) return;
    

    
    // CRITICAL: Prevent storing our own key due to DOM confusion
    const currentUser = this.ecCrypto.getCurrentUser();
    if (currentUser.userId && senderUserId === currentUser.userId) {
      //console.log('🔐 [MSG] ⚠️ BLOCKED: Attempted to store key for current user');
      return;
    }
    
    // ADDITIONAL: Prevent storing if key ID matches our own key
    if (this.ecCrypto.myKeyId && keyId === this.ecCrypto.myKeyId) {
      //console.log('🔐 [MSG] ⚠️ BLOCKED: Attempted to store our own key ID');
      return;
    }
    
    // If no user ID, try to find existing user with this key ID or create temp entry
    if (!senderUserId || senderUserId === 'null' || senderUserId === null) {
      //console.log('🔐 [MSG] 🔍 No user ID provided, checking for existing keys...');
      
      // Check if we have this exact key already stored
      const existingUsers = this.ecCrypto.userKeys || new Map();
      for (const [existingUserId, existingUserInfo] of existingUsers) {
        if (existingUserInfo.keyId === keyId) {
          //console.log('🔐 [MSG] 🔄 Found existing user with same key ID:', existingUserId);
          // Update this user's last seen time and username if better
          existingUserInfo.lastSeen = Date.now();
          if (username !== 'Unknown' && username !== existingUserInfo.username) {
            existingUserInfo.username = username;
            //console.log('🔐 [MSG] 📝 Updated username for existing user');
          }
          await this.ecCrypto.saveUserKeys();
          return;
        }
      }
      
      // If no exact match, create a temporary entry with key ID as identifier
      const tempUserId = `temp_${keyId}`;
      //console.log('🔐 [MSG] 🆕 Creating temporary user entry:', tempUserId);
              await this.ecCrypto.addUserKey(tempUserId, publicKeyBase64, username);
      //console.log('🔐 [MSG] 🆕 TEMP KEY STORED!');
      return;
    }
    
    // Check if this is a new key for this user
    const existingKey = this.ecCrypto.getUserKey(senderUserId);
    const existingKeyId = existingKey ? await this.ecCrypto.generateKeyId(existingKey) : null;
    
    if (!existingKey || existingKeyId !== keyId) {
      // New user or new key for existing user
      await this.ecCrypto.addUserKey(senderUserId, publicKeyBase64, username);
      //console.log('🔐 [MSG] 🆕 NEW KEY STORED!');
    } else {
      //console.log('🔐 [MSG] ✅ Key already known, updating last seen');
      // Update last seen time for existing key
      const userInfo = this.ecCrypto.userKeys.get(senderUserId);
      if (userInfo) {
        userInfo.lastSeen = Date.now();
        this.ecCrypto.userKeys.set(senderUserId, userInfo);
        await this.ecCrypto.saveUserKeys();
      }
    }
  }

  async scanMessageForPublicKeys(chineseMessage, messageElement = null) {

    
    try {
      // Decode the message
      const decodedMessage = this.decodeChineseCharacters(chineseMessage);
      
      // Look for public key pattern: PK:publicKey:keyId
      const publicKeyPattern = /PK:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]{12})/g;
      const matches = [...decodedMessage.matchAll(publicKeyPattern)];
      
      if (matches.length > 0) {
        //console.log('🔐 [MSG] 🎯 Found', matches.length, 'public key(s)!');
        
        // Extract Discord user info from message element
        let userInfo = { userId: null, username: 'Unknown' };
        if (messageElement) {
          userInfo = await this.extractDiscordUserInfo(messageElement);
        }
        
        // Process each public key
        for (const match of matches) {
          const [, publicKey, keyId] = match;
          //console.log('🔐 [MSG] 🔑 Processing public key - ID:', keyId);
          
          // Always store the public key, even if we don't have user ID
          await this.storeSenderPublicKey(userInfo.userId, publicKey, keyId, userInfo.username);
        }
        
        return true;
      } else {
        //console.log('🔐 [MSG] ❌ No public keys found in message');
        return false;
      }
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ Error scanning for public keys:', error);
      return false;
    }
  }

  async extractDiscordUserInfo(messageElement) {
    //console.log('🔐 [MSG] 👤 EXTRACTING USER INFO FROM MESSAGE...');
    
    try {
      // Start from the message element and traverse up to find the message container
      let messageContainer = messageElement;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Navigate up to find the main message container
      while (messageContainer && attempts < maxAttempts) {
        if (messageContainer.classList && (
          messageContainer.classList.contains('messageListItem__5126c') ||
          messageContainer.classList.contains('message__5126c') ||
          messageContainer.classList.contains('wrapper_c19a55') ||
          messageContainer.id && messageContainer.id.includes('chat-messages')
        )) {
          break;
        }
        messageContainer = messageContainer.parentElement;
        attempts++;
      }
      
      if (!messageContainer) {
        //console.log('🔐 [MSG] ⚠️ Could not find message container, using provided element');
        messageContainer = messageElement;
      }
      
      let userId = null;
      let username = 'Unknown';
      
      //console.log('🔐 [MSG] 🔍 Searching for avatar image...');
      
      // Method 1: Find avatar image with user ID in URL (MOST RELIABLE)
      // Look for patterns like: /avatars/852155629836828683/hash.webp
      const avatarSelectors = [
        'img.avatar_c19a55[src*="/avatars/"]',
        'img[src*="/avatars/"]', 
        'img.avatar_c19a55',
        'img[class*="avatar"]',
        'img[alt*="avatar"]'
      ];
      
      let avatarImg = null;
      for (const selector of avatarSelectors) {
        avatarImg = messageContainer.querySelector(selector);
        if (avatarImg && avatarImg.src && avatarImg.src.includes('/avatars/')) {
          //console.log('🔐 [MSG] 🎯 Found avatar with selector:', selector);
          //console.log('🔐 [MSG] 🔗 Avatar URL:', avatarImg.src);
          break;
        }
      }
      
      if (avatarImg && avatarImg.src) {
        // Extract user ID from avatar URL
        // Format: https://cdn.discordapp.com/avatars/852155629836828683/hash.webp?size=100
        const avatarMatches = [
          avatarImg.src.match(/\/avatars\/(\d{17,19})\//),  // Standard format
          avatarImg.src.match(/\/avatars\/(\d{17,19})$/),   // Without hash
          avatarImg.src.match(/user[_-]?id[=:](\d{17,19})/i), // Query param
          avatarImg.src.match(/(\d{17,19})/g)  // Any 17-19 digit number
        ];
        
        for (const match of avatarMatches) {
          if (match && match[1]) {
            userId = match[1];
            //console.log('🔐 [MSG] ✅ Extracted user ID from avatar:', userId);
            break;
          } else if (match && Array.isArray(match)) {
            // For the global match, take the first valid Discord user ID
            for (const id of match) {
              if (id.length >= 17 && id.length <= 19) {
                userId = id;
                //console.log('🔐 [MSG] ✅ Extracted user ID (pattern match):', userId);
                break;
              }
            }
            if (userId) break;
          }
        }
      } else {
        //console.log('🔐 [MSG] ❌ No avatar image found or no src attribute');
      }
      
      //console.log('🔐 [MSG] 🔍 Searching for username...');
      
      // Method 2: Extract username from various possible locations
      const usernameSelectors = [
        '.username_c19a55',
        '[class*="username"]', 
        '[class*="author"]',
        '.headerText_c19a55 .username_c19a55',
        '.header_c19a55 .username_c19a55',
        'span[data-text]',
        'h3 span span', // Based on your DOM structure
        '.clickable_c19a55[role="button"]', // Based on your DOM sample
        'h3 .headerText_c19a55 .username_c19a55', // More specific path
        'h3 .username_c19a55', // Direct h3 child
        '[data-text]' // Any element with data-text
      ];
      
      for (const selector of usernameSelectors) {
        //console.log('🔐 [MSG] 🔍 Trying username selector:', selector);
        const usernameElement = messageContainer.querySelector(selector);
        if (usernameElement) {
          //console.log('🔐 [MSG] 🎯 Found element with selector:', selector);
          //console.log('🔐 [MSG] 📝 Element text content:', usernameElement.textContent);
          //console.log('🔐 [MSG] 📝 Element data-text:', usernameElement.getAttribute('data-text'));
          
          // Try textContent first
          let extractedUsername = usernameElement.textContent ? usernameElement.textContent.trim() : '';
          
          // If textContent is empty or not useful, try data-text attribute
          if (!extractedUsername || extractedUsername === '' || extractedUsername === 'Unknown') {
            const dataText = usernameElement.getAttribute('data-text');
            if (dataText && dataText.trim()) {
              extractedUsername = dataText.trim();
              //console.log('🔐 [MSG] 🔄 Using data-text instead:', extractedUsername);
            }
          }
          
          if (extractedUsername && extractedUsername !== 'Unknown' && extractedUsername.length > 0) {
            username = extractedUsername;
            //console.log('🔐 [MSG] ✅ Found username with selector:', selector, '- Username:', username);
            break;
          } else {
            //console.log('🔐 [MSG] ❌ Username not useful:', extractedUsername);
          }
        } else {
          //console.log('🔐 [MSG] ❌ No element found with selector:', selector);
        }
      }
      
      // Method 3: Look for data-text attribute (Discord sometimes uses this)
      if (username === 'Unknown') {
        const dataTextElement = messageContainer.querySelector('[data-text]');
        if (dataTextElement) {
          const dataText = dataTextElement.getAttribute('data-text');
          if (dataText && dataText.trim()) {
            username = dataText.trim();
            //console.log('🔐 [MSG] ✅ Found username from data-text:', username);
          }
        }
      }
      
      // Method 4: Look for user links with IDs (Discord profile links)
      if (!userId) {
        //console.log('🔐 [MSG] 🔍 Searching for user profile links...');
        const userLinkSelectors = [
          'a[href*="/users/"]',
          '[href*="/users/"]',
          '[data-user-id]',
          '[user-id]'
        ];
        
        for (const selector of userLinkSelectors) {
          const userLink = messageContainer.querySelector(selector);
          if (userLink) {
            if (userLink.href) {
              const match = userLink.href.match(/\/users\/(\d{17,19})/);
              if (match) {
                userId = match[1];
                //console.log('🔐 [MSG] ✅ Found user ID from profile link:', userId);
                break;
              }
            }
            
            // Check data attributes
            const dataUserId = userLink.getAttribute('data-user-id') || userLink.getAttribute('user-id');
            if (dataUserId && dataUserId !== '0' && dataUserId.match(/^\d{17,19}$/)) {
              userId = dataUserId;
              //console.log('🔐 [MSG] ✅ Found user ID from data attribute:', userId);
              break;
            }
          }
        }
      }
      
      // Method 5: Look in previous sibling messages if no avatar (Discord groups messages)
      if (!userId && !avatarImg) {
        //console.log('🔐 [MSG] 🔍 No avatar found, checking previous messages...');
        let previousMessage = messageContainer.previousElementSibling;
        let lookbackAttempts = 0;
        const maxLookback = 15; // Increased from 5 to 15
        
        while (previousMessage && lookbackAttempts < maxLookback) {
          //console.log('🔐 [MSG] 🔍 Checking previous message', lookbackAttempts + 1, ':', previousMessage.className);
          
          // Look for avatar in this previous message
          const prevAvatarSelectors = [
            'img[src*="/avatars/"]',
            'img.avatar_c19a55',
            'img[class*="avatar"]'
          ];
          
          let prevAvatar = null;
          for (const selector of prevAvatarSelectors) {
            prevAvatar = previousMessage.querySelector(selector);
            if (prevAvatar && prevAvatar.src && prevAvatar.src.includes('/avatars/')) {
              //console.log('🔐 [MSG] 🎯 Found avatar in previous message with selector:', selector);
              //console.log('🔐 [MSG] 🔗 Previous avatar URL:', prevAvatar.src);
              break;
            }
          }
          
          if (prevAvatar && prevAvatar.src) {
            // Extract user ID from previous avatar
            const avatarMatches = [
              prevAvatar.src.match(/\/avatars\/(\d{17,19})\//),
              prevAvatar.src.match(/\/avatars\/(\d{17,19})$/),
              prevAvatar.src.match(/(\d{17,19})/g)
            ];
            
            for (const match of avatarMatches) {
              if (match && match[1]) {
                userId = match[1];
                //console.log('🔐 [MSG] ✅ Extracted user ID from previous message avatar:', userId);
                break;
              } else if (match && Array.isArray(match)) {
                for (const id of match) {
                  if (id.length >= 17 && id.length <= 19) {
                    userId = id;
                    //console.log('🔐 [MSG] ✅ Extracted user ID from previous message (pattern):', userId);
                    break;
                  }
                }
                if (userId) break;
              }
            }
            
            if (userId) {
              //console.log('🔐 [MSG] 🎯 SUCCESS! Found user ID in previous message #' + (lookbackAttempts + 1));
              break;
            }
          }
          
          // Also check for username in previous message if we still need it
          if (username === 'Unknown') {
            const usernameSelectors = [
              '.username_c19a55',
              '[class*="username"]',
              '[data-text]',
              '.clickable_c19a55[role="button"]'
            ];
            
            for (const selector of usernameSelectors) {
              const prevUsername = previousMessage.querySelector(selector);
              if (prevUsername && prevUsername.textContent && prevUsername.textContent.trim()) {
                const extractedUsername = prevUsername.textContent.trim();
                if (extractedUsername !== 'Unknown' && extractedUsername.length > 0) {
                  username = extractedUsername;
                  //console.log('🔐 [MSG] ✅ Found username from previous message:', username);
                  break;
                }
              }
            }
          }
          
          previousMessage = previousMessage.previousElementSibling;
          lookbackAttempts++;
        }
        
        if (!userId) {
          //console.log('🔐 [MSG] ❌ Could not find user ID in any of the previous', maxLookback, 'messages');
        }
      }
      
      // Method 6: Look in next sibling messages too (sometimes avatars are there)
      if (!userId && !avatarImg) {
        //console.log('🔐 [MSG] 🔍 Checking next messages for avatar...');
        let nextMessage = messageContainer.nextElementSibling;
        let lookforwardAttempts = 0;
        const maxLookforward = 5;
        
        while (nextMessage && lookforwardAttempts < maxLookforward) {
          const nextAvatar = nextMessage.querySelector('img[src*="/avatars/"]');
          if (nextAvatar && nextAvatar.src) {
            const match = nextAvatar.src.match(/\/avatars\/(\d{17,19})\//);
            if (match) {
              userId = match[1];
              //console.log('🔐 [MSG] ✅ Found user ID from next message avatar:', userId);
              break;
            }
          }
          
          nextMessage = nextMessage.nextElementSibling;
          lookforwardAttempts++;
        }
      }
      
      // Method 7: Look for parent container with more context
      if (!userId) {
        //console.log('🔐 [MSG] 🔍 Looking in parent containers for avatar...');
        let parentContainer = messageContainer.parentElement;
        let parentAttempts = 0;
        const maxParentAttempts = 3;
        
        while (parentContainer && parentAttempts < maxParentAttempts) {
          const parentAvatar = parentContainer.querySelector('img[src*="/avatars/"]');
          if (parentAvatar && parentAvatar.src) {
            const match = parentAvatar.src.match(/\/avatars\/(\d{17,19})\//);
            if (match) {
              userId = match[1];
              //console.log('🔐 [MSG] ✅ Found user ID from parent container avatar:', userId);
              break;
            }
          }
          
          parentContainer = parentContainer.parentElement;
          parentAttempts++;
        }
      }
      
      // Method 8: Look for message ID patterns that might contain user info
      if (!userId) {
        const messageId = messageContainer.id;
        if (messageId) {
          // Extract potential user IDs from message ID patterns
          const idMatch = messageId.match(/(\d{17,19})/);
          if (idMatch) {
            userId = idMatch[1];
            //console.log('🔐 [MSG] ✅ Extracted user ID from message ID:', userId);
          }
        }
      }
      
      // Method 9: AGGRESSIVE CHANNEL SCAN - scan entire message history for avatars
      if (!userId) {
        //console.log('🔐 [MSG] 🔍 AGGRESSIVE SCAN: Searching entire channel for recent avatars...');
        userId = await this.scanEntireChannelForUserAvatar(messageContainer);
        if (userId) {
          //console.log('🔐 [MSG] 🎯 AGGRESSIVE SCAN SUCCESS! Found user ID:', userId);
        }
      }
      
      // Final validation
      if (userId && !userId.match(/^\d{17,19}$/)) {
        //console.log('🔐 [MSG] ⚠️ Invalid user ID format, discarding:', userId);
        userId = null;
      }
      
      //console.log('🔐 [MSG] 📋 FINAL EXTRACTED USER INFO:');
      //console.log('🔐 [MSG] 🆔 User ID:', userId || 'NOT FOUND');
      //console.log('🔐 [MSG] 👤 Username:', username);
      //console.log('🔐 [MSG] 🏗️ Message container:', messageContainer.tagName, messageContainer.className);
      
      if (!userId) {
        //console.log('🔐 [MSG] ❌ FAILED TO EXTRACT USER ID - this will create temp contacts');
        // Log the DOM structure for debugging
        //console.log('🔐 [MSG] 🔍 DOM structure for debugging:');
        //console.log('🔐 [MSG] Container HTML (first 200 chars):', messageContainer.innerHTML.substring(0, 200));
      }
      
      return { userId, username };
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ Error extracting user info:', error);
      return { userId: null, username: 'Unknown' };
    }
  }

  // ==================== ENCODING/DECODING ====================

  encodeAsChineseCharacters(message) {

    
    // Convert message to base64 first for safety
    const base64Message = btoa(message);
    
    // Convert each character to Chinese using simple, reversible mapping
    let chineseMessage = '';
    const baseCharCode = 0x4E00; // Start of CJK unified ideographs
    
    for (let i = 0; i < base64Message.length; i++) {
      const charCode = base64Message.charCodeAt(i);
      // Simple direct mapping - just add the char code to base
      const chineseCharCode = baseCharCode + (charCode - 32); // Shift printable ASCII range (32-126) to Chinese range
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
    
    //console.log('🔐 [MSG] ✅ Encoded to Chinese characters - length:', result.length);
    return result;
  }

  decodeChineseCharacters(chineseMessage) {
    //console.log('🔐 [MSG] 🈲 Decoding Chinese characters...');
    
    try {
      // Remove spaces
      const cleanChinese = chineseMessage.replace(/\s+/g, '');
      
      // Convert Chinese characters back to base64 using simple, reversible mapping
      let base64Message = '';
      const baseCharCode = 0x4E00;
      
      for (let i = 0; i < cleanChinese.length; i++) {
        const chineseCharCode = cleanChinese.charCodeAt(i);
        
                 // Check if it's in our expected range
         if (chineseCharCode < baseCharCode || chineseCharCode > baseCharCode + 94) {
           // console.warn('🔐 [MSG] Character out of expected range:', chineseCharCode, 'at position', i);
           // Try to handle gracefully - skip this character
           continue;
         }
         
         // Simple reverse mapping
         const originalCharCode = (chineseCharCode - baseCharCode) + 32;
         
         // Validate the result is in printable ASCII range
         if (originalCharCode < 32 || originalCharCode > 126) {
           // console.warn('🔐 [MSG] Invalid ASCII char code:', originalCharCode);
           continue;
         }
        
        base64Message += String.fromCharCode(originalCharCode);
      }
      
      // Decode from base64
      const decodedMessage = atob(base64Message);
      //console.log('🔐 [MSG] ✅ Decoded from Chinese characters');
      
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
      currentUserId: this.currentUserId,
      currentUsername: this.currentUsername,
      isInitialized: this.isInitialized
    };
  }

  // Aggressive method to scan entire channel for user avatars when local methods fail
  async scanEntireChannelForUserAvatar(currentMessageContainer) {
    try {
      //console.log('🔐 [MSG] 🔍 AGGRESSIVE SCAN: Starting channel-wide avatar search...');
      
      // Find the main messages container (scrollable area)
      const messagesContainer = document.querySelector('[class*="scrollerInner"], ol[aria-label*="Messages"]');
      if (!messagesContainer) {
        //console.log('🔐 [MSG] ❌ Could not find messages container for aggressive scan');
        return null;
      }
      
      // Get all message elements in the channel
      const allMessages = messagesContainer.querySelectorAll('[class*="message"], li[class*="messageListItem"]');
      //console.log('🔐 [MSG] 🔍 Found', allMessages.length, 'total messages in channel');
      
      // Start from current message and scan backwards (most recent avatars first)
      const currentIndex = Array.from(allMessages).indexOf(currentMessageContainer);
      let scanRange = [];
      
      if (currentIndex >= 0) {
        // Scan 50 messages before and 10 messages after current
        const startIndex = Math.max(0, currentIndex - 50);
        const endIndex = Math.min(allMessages.length, currentIndex + 10);
        scanRange = Array.from(allMessages).slice(startIndex, endIndex);
        //console.log('🔐 [MSG] 🔍 Scanning', scanRange.length, 'messages around current position');
      } else {
        // Fallback: scan last 100 messages
        scanRange = Array.from(allMessages).slice(-100);
        //console.log('🔐 [MSG] 🔍 Fallback: scanning last', scanRange.length, 'messages');
      }
      
      // Look for avatars in the scan range
      for (let i = scanRange.length - 1; i >= 0; i--) {
        const message = scanRange[i];
        
        // Skip current message (we already checked it)
        if (message === currentMessageContainer) continue;
        
        const avatar = message.querySelector('img[src*="/avatars/"]');
        if (avatar && avatar.src) {
          const match = avatar.src.match(/\/avatars\/(\d{17,19})\//);
          if (match) {
            //console.log('🔐 [MSG] 🎯 AGGRESSIVE SCAN: Found user ID in message', i, ':', match[1]);
            //console.log('🔐 [MSG] 🔗 Avatar URL:', avatar.src);
            return match[1];
          }
        }
      }
      
      //console.log('🔐 [MSG] ❌ AGGRESSIVE SCAN: No user avatars found in', scanRange.length, 'messages');
      return null;
      
    } catch (error) {
      console.error('🔐 [MSG] ❌ AGGRESSIVE SCAN ERROR:', error);
      return null;
    }
  }
}

// Export for use by other modules
window.ecMessageProcessor = new ECMessageProcessor(); 