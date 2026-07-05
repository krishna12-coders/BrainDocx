/**
 * Cryptographic helper functions for client-side PDF encryption using Web Crypto API.
 */

export interface EncryptionResult {
  encryptedBlob: Blob;
  keyBase64: string;
}

/**
 * Encrypts a file (PDF) using AES-256-GCM.
 * The 12-byte IV is prepended to the ciphertext file.
 * 
 * @param file The file to encrypt
 * @returns An object containing the encrypted Blob and the base64 encoded AES key
 */
export async function encryptFile(file: File): Promise<EncryptionResult> {
  // 1. Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // 2. Generate a random 256-bit AES-GCM key
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // 3. Generate a random 12-byte Initialization Vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 4. Encrypt the file buffer
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    fileBuffer
  );

  // 5. Concatenate IV (12 bytes) and ciphertext
  const ivArray = new Uint8Array(iv);
  const ciphertextArray = new Uint8Array(ciphertextBuffer);
  
  const combinedBuffer = new Uint8Array(ivArray.length + ciphertextArray.length);
  combinedBuffer.set(ivArray, 0);
  combinedBuffer.set(ciphertextArray, ivArray.length);

  // 6. Create encrypted blob
  const encryptedBlob = new Blob([combinedBuffer], { type: 'application/octet-stream' });

  // 7. Export and encode the AES key to base64
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  const keyBase64 = arrayBufferToBase64(exportedKey);

  return {
    encryptedBlob,
    keyBase64,
  };
}

/**
 * Helper to convert an ArrayBuffer to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
