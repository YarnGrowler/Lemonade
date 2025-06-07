# 🔄 Key Rotation System - Technical Documentation

## Overview

The Discord Cryptochat Key Rotation System provides **Perfect Forward Secrecy** by automatically rotating encryption keys based on time intervals. This ensures that even if your current key is compromised, past messages remain secure.

## How It Works

### 🔧 Core Mechanism

1. **Base Key**: You set an initial "master" key
2. **Time Intervals**: Choose rotation frequency (1 hour to 1 month, or custom)
3. **One-Way Hashing**: Each rotation applies SHA-256 hash to the current key
4. **Automatic Catch-Up**: Extension calculates how many rotations are needed based on elapsed time

### 🧮 Mathematical Foundation

```
Current Key = SHA256^n(Base Key)
```

Where `n` = number of rotations needed based on elapsed time.

**Example:**

- Base Key: `"mySecretKey123"`
- Interval: 1 week
- After 3 weeks: Current Key = `SHA256(SHA256(SHA256("mySecretKey123")))`

### ⏰ Time Calculation

```javascript
const elapsed = Date.now() - startTimestamp;
const rotationsNeeded = Math.floor(elapsed / intervalMs);
```

**Catch-Up Example:**

- Setup: January 1st with 1-week intervals
- Return: January 22nd (3 weeks later)
- System performs 3 rotations automatically
- New key = SHA256³(baseKey)

## Security Benefits

### 🛡️ Perfect Forward Secrecy

- **Past Security**: If current key is compromised, attackers cannot derive previous keys
- **One-Way Function**: SHA-256 is computationally irreversible
- **Time-Based**: Each time period has a unique key

### 🔒 Attack Resistance

| Attack Scenario        | Protection Level             |
| ---------------------- | ---------------------------- |
| Current key leaked     | ✅ Past messages secure      |
| Old key recovered      | ✅ Future messages secure    |
| Man-in-the-middle      | ✅ Limited to current period |
| Long-term surveillance | ✅ Keys expire automatically |

## Implementation Details

### 🔄 Rotation Monitoring

The system monitors key rotation every 10 seconds minimum:

```javascript
setInterval(() => this.checkAndRotateKey(), 10000);
```

### 💾 Storage Structure

```javascript
{
  keyRotationEnabled: true,
  keyRotationBaseKey: "userMasterKey",
  keyRotationIntervalMs: 604800000, // 1 week
  keyRotationStartTimestamp: 1703980800000,
  encryptionKey: "currentHashedKey" // Auto-updated
}
```

### 🔧 Hash Generation

```javascript
async hashKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

## Usage Scenarios

### 👥 Team Communication

**Setup:**

- Team agrees on base key: `"ProjectAlpha2024"`
- Interval: 1 day
- Start time: Project launch

**Benefits:**

- Daily key rotation
- If member leaves, only current day at risk
- Historical discussions remain secure

### 🏢 Corporate Security

**Setup:**

- Base key: Strong corporate passphrase
- Interval: 1 hour
- Monitored security policies

**Benefits:**

- Minimal exposure window
- Compliance with data retention policies
- Automatic security without manual intervention

### 🔐 Personal Privacy

**Setup:**

- Base key: Personal memorable phrase
- Interval: 1 week
- Long-term communication security

**Benefits:**

- Weekly refresh for ongoing conversations
- Protection against retrospective attacks
- Peace of mind for sensitive discussions

## Advanced Features

### 🔍 Rotation Status Monitoring

The UI displays:

- **Current Status**: Active/Inactive
- **Rotations Completed**: Historical count
- **Next Rotation**: Countdown timer
- **Interval**: Human-readable format

### 🛠️ Catch-Up Algorithm

```javascript
async getCurrentRotatedKey(settings) {
  const { baseKey, intervalMs, startTimestamp } = settings;
  const elapsed = Date.now() - startTimestamp;
  const rotationsNeeded = Math.floor(elapsed / intervalMs);

  let currentKey = baseKey;
  for (let i = 0; i < rotationsNeeded; i++) {
    currentKey = await this.hashKey(currentKey);
  }

  return currentKey;
}
```

### 🎯 Interval Options

| Interval | Use Case                   | Security Level |
| -------- | -------------------------- | -------------- |
| 1 Hour   | High-security environments | Maximum        |
| 1 Day    | Corporate communications   | High           |
| 1 Week   | Personal long-term chats   | Medium         |
| 1 Month  | Casual friend groups       | Basic          |
| Custom   | Specific requirements      | Variable       |

## Best Practices

### 🔐 Key Selection

- **Base Key Length**: Minimum 20 characters
- **Complexity**: Mix of letters, numbers, symbols
- **Uniqueness**: Different from any other passwords
- **Memorable**: You must remember it for the system to work

### ⏰ Interval Selection

- **High Security**: 1 hour - 1 day
- **Balanced**: 1 week
- **Casual**: 1 month
- **Custom**: Based on threat model

### 🔄 Rotation Management

- **Coordination**: All participants must use same base key and interval
- **Backup**: Securely store base key separately
- **Testing**: Verify rotation works before relying on it
- **Monitoring**: Check rotation status periodically

## Troubleshooting

### ❌ Common Issues

**Decryption Failures:**

```
Cause: Participants have different rotation settings
Solution: Verify base key and interval match exactly
```

**Missing Rotations:**

```
Cause: Extension was disabled during rotation period
Solution: System automatically catches up on next check
```

**Time Sync Issues:**

```
Cause: System clocks are significantly different
Solution: Ensure devices have synchronized time
```

### 🔧 Debug Information

Monitor console for rotation logs:

```
🔐 [CRYPTO] 🔄 Calculating key rotation: 5 rotations needed
🔐 [CRYPTO] 🔄 Key rotation needed - updating key
🔐 [CRYPTO] 🔄 Key automatically rotated based on time interval
```

## Security Considerations

### ✅ Strengths

- **Mathematical Security**: SHA-256 is cryptographically secure
- **Forward Secrecy**: Past keys cannot be derived
- **Automatic Operation**: No manual intervention required
- **Catch-Up Capability**: Works after long periods offline

### ⚠️ Limitations

- **Base Key Security**: Base key compromise affects all future keys
- **Clock Dependency**: Requires reasonably synchronized time
- **Coordination Required**: All parties must use same settings
- **Storage Security**: Settings stored in browser extension storage

### 🛡️ Mitigation Strategies

1. **Base Key Protection**: Use strong, unique base keys
2. **Regular Updates**: Periodically change base key manually
3. **Verification**: Test rotation with team members
4. **Monitoring**: Watch for decryption failures

## Future Enhancements

### 🚀 Planned Features

- **Multi-Base Keys**: Different base keys for different conversations
- **Key Exchange Protocol**: Secure in-band base key sharing
- **Blockchain Integration**: Decentralized rotation timestamps
- **Hardware Security**: Integration with hardware security modules

### 🔬 Research Areas

- **Post-Quantum Cryptography**: Quantum-resistant hash functions
- **Zero-Knowledge Proofs**: Verify rotation without revealing keys
- **Distributed Consensus**: Multi-party rotation agreement
- **Biometric Integration**: Use biometric data in rotation algorithm

## Conclusion

The Key Rotation System represents a significant advancement in Discord message security, providing enterprise-level perfect forward secrecy in a user-friendly package. By combining strong cryptographic principles with practical automation, it offers protection against both current and future threats while maintaining ease of use for everyday communication.

The system's ability to automatically catch up after extended periods offline makes it particularly suitable for real-world usage scenarios where continuous operation cannot be guaranteed. This, combined with its mathematical foundation in proven cryptographic primitives, makes it a robust solution for secure communication needs.
