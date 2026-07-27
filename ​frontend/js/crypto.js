// Web Crypto API - AES-GCM (Military-Grade Encryption)

// 1. Text ko code me badalna (ArrayBuffer)
function enc(str) {
    return new TextEncoder().encode(str);
}

// 2. Code ko wapas Text me badalna
function dec(buf) {
    return new TextDecoder().decode(buf);
}

// 3. Room ID ko use karke ek Secret Password (Key) banana
async function getKey(roomId) {
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc(roomId), // Room ID ko hi password banaya gaya hai
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc("super-secret-salt-for-anonymous-chat"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 }, // AES-256 Bit Encryption
        false,
        ["encrypt", "decrypt"]
    );
}

// 4. Message ko Bhejne se Pehle Lock (Encrypt) karna
async function encryptMessage(message, roomId) {
    const key = await getKey(roomId);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Random lock value
    const encodedMessage = enc(message);

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedMessage
    );

    // IV aur Encrypted data ko ek sath jodna
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Bhejne ke liye Base64 format me convert karna
    return btoa(String.fromCharCode.apply(null, combined));
}

// 5. Message Aane ke Baad Unlock (Decrypt) karna
async function decryptMessage(encryptedBase64, roomId) {
    const key = await getKey(roomId);

    // Wapas Base64 se Uint8Array me badalna
    const combinedStr = atob(encryptedBase64);
    const combined = new Uint8Array(combinedStr.length);
    for (let i = 0; i < combinedStr.length; i++) {
        combined[i] = combinedStr.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );

    return dec(decrypted);
}
