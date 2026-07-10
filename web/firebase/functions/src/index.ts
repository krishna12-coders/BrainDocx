import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.database();

// 1. Register Device (Max 2 devices check)
export const registerDevice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;
  const { deviceId, deviceModel, osVersion } = data;

  if (!deviceId || !deviceModel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing device information.'
    );
  }

  const deviceRef = db.ref(`devices/${uid}/${deviceId}`);
  const deviceSnap = await deviceRef.once('value');

  // If already registered and active to this user, update check-in timestamp and return success
  if (deviceSnap.exists()) {
    const devData = deviceSnap.val();
    if (devData && devData.status === 'active') {
      await deviceRef.update({
        lastUsedAt: admin.database.ServerValue.TIMESTAMP,
        deviceModel,
        osVersion: osVersion || 'unknown',
      });
      return { success: true, message: 'Device check-in successful.' };
    }
    if (devData && devData.status === 'blocked') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This device has been blocked by the administrator.'
      );
    }
  }

  // Check how many active devices this user currently has
  const devicesRef = db.ref(`devices/${uid}`);
  const devicesSnap = await devicesRef.once('value');
  let activeCount = 0;

  if (devicesSnap.exists()) {
    const devices = devicesSnap.val();
    for (const devId in devices) {
      if (devices[devId].status === 'active') {
        activeCount++;
      }
    }
  }

  if (activeCount >= 2) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Maximum device limit reached (2 devices). Please contact support to unbind a device.'
    );
  }

  // Register the new device
  await deviceRef.set({
    id: deviceId,
    userId: uid,
    deviceModel,
    osVersion: osVersion || 'unknown',
    registeredAt: admin.database.ServerValue.TIMESTAMP,
    lastUsedAt: admin.database.ServerValue.TIMESTAMP,
    status: 'active',
  });

  return { success: true, message: 'Device registered successfully.' };
});

// 2. Get Decryption Key
export const getDecryptionKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;
  const { pdfId, deviceId } = data;

  if (!pdfId || !deviceId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing PDF ID or Device ID.'
    );
  }

  // A. Verify that the device is registered to this user and is active
  const deviceRef = db.ref(`devices/${uid}/${deviceId}`);
  const deviceSnap = await deviceRef.once('value');
  if (!deviceSnap.exists() || deviceSnap.val()?.status !== 'active') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'This device is not authorized. Please log in from this device again.'
    );
  }

  // B. Verify that the user is not blocked
  const userSnap = await db.ref(`users/${uid}`).once('value');
  if (userSnap.exists() && userSnap.val()?.status === 'blocked') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Your user account has been disabled.'
    );
  }

  // C. Verify purchase (userId -> pdfId)
  const purchaseRef = db.ref(`purchases/${uid}/${pdfId}`);
  const purchaseSnap = await purchaseRef.once('value');
  const isAdmin = userSnap.exists() && userSnap.val()?.role === 'admin';

  if (!isAdmin) {
    if (!purchaseSnap.exists() || purchaseSnap.val()?.status !== 'active') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You have not purchased this document, or your purchase has been revoked.'
      );
    }
  }

  // D. Fetch key from pdf_keys (which is private and not readable by clients)
  const keySnap = await db.ref(`pdf_keys/${pdfId}`).once('value');
  if (!keySnap.exists()) {
    throw new functions.https.HttpsError(
      'not-found',
      'Decryption key not found for this document.'
    );
  }

  const keyData = keySnap.val();
  return {
    key: keyData?.key, // AES-256 key (base64 encoded string)
    iv: keyData?.iv || '', // Initialisation Vector
  };
});

// 3. Purchase PDF (Dummy transaction flow)
export const purchasePdf = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;
  const { pdfId, couponCode } = data;

  if (!pdfId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing PDF ID.'
    );
  }

  // Check if PDF exists
  const pdfSnap = await db.ref(`pdfs/${pdfId}`).once('value');
  if (!pdfSnap.exists()) {
    throw new functions.https.HttpsError('not-found', 'PDF document not found.');
  }

  // If coupon is provided, we can validate it
  let discount = 0;
  if (couponCode) {
    const couponSnap = await db.ref(`coupons/${couponCode.toUpperCase()}`).once('value');
    if (couponSnap.exists() && couponSnap.val()?.active) {
      discount = couponSnap.val()?.discountPercent || 0;
    }
  }

  await db.ref(`purchases/${uid}/${pdfId}`).set({
    userId: uid,
    pdfId: pdfId,
    purchaseDate: admin.database.ServerValue.TIMESTAMP,
    status: 'active',
    discountApplied: discount,
  });

  // Log purchase analytics
  await db.ref('analytics').push({
    eventType: 'purchase',
    userId: uid,
    pdfId: pdfId,
    timestamp: admin.database.ServerValue.TIMESTAMP,
    metadata: { couponCode: couponCode || 'none', discount },
  });

  return { success: true, message: 'PDF purchased successfully.' };
});

// 4. Admin Toggle User Status
export const setUserStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Ensure caller is admin
  const callerSnap = await db.ref(`users/${context.auth.uid}`).once('value');
  if (!callerSnap.exists() || callerSnap.val()?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can perform this action.'
    );
  }

  const { targetUserId, status } = data; // 'active' or 'blocked'
  if (!targetUserId || !['active', 'blocked'].includes(status)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing target user ID or invalid status.'
    );
  }

  await db.ref(`users/${targetUserId}`).update({
    status: status,
  });

  // Toggle devices status for this user
  const devicesRef = db.ref(`devices/${targetUserId}`);
  const devicesSnap = await devicesRef.once('value');
  if (devicesSnap.exists()) {
    const devices = devicesSnap.val();
    const updates: any = {};
    for (const devId in devices) {
      updates[`devices/${targetUserId}/${devId}/status`] = status;
    }
    await db.ref().update(updates);
  }

  return { success: true, message: `User status set to ${status}.` };
});

// 5. Generate PIN (uniquely generated 6-digit PIN, stored as SHA-256 hash)
export const generatePin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;

  // Fetch current user details to check if there is an existing pin hash to invalidate
  const userRef = db.ref(`users/${uid}`);
  const userSnap = await userRef.once('value');
  const userData = userSnap.val();

  if (userData && userData.appPinHash) {
    // Invalidate previous pin immediately
    await db.ref(`pin_lookups/${userData.appPinHash}`).remove();
  }

  // Generate a unique 6-digit PIN
  let pin = '';
  let pinHash = '';
  let unique = false;
  let attempts = 0;

  while (!unique && attempts < 15) {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    const lookupSnap = await db.ref(`pin_lookups/${pinHash}`).once('value');
    if (!lookupSnap.exists()) {
      unique = true;
    }
    attempts++;
  }

  if (!unique) {
    throw new functions.https.HttpsError(
      'internal',
      'Unable to generate a unique PIN. Please try again.'
    );
  }

  // Save new lookup
  await db.ref(`pin_lookups/${pinHash}`).set({
    uid,
    createdAt: admin.database.ServerValue.TIMESTAMP,
  });

  // Save hash & metadata in user node
  await userRef.update({
    appPinHash: pinHash,
    pinCreatedAt: admin.database.ServerValue.TIMESTAMP,
    pinStatus: 'active',
  });

  return { pin };
});

// 6. Revoke PIN
export const revokePin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;
  const userRef = db.ref(`users/${uid}`);
  const userSnap = await userRef.once('value');
  const userData = userSnap.val();

  if (userData && userData.appPinHash) {
    await db.ref(`pin_lookups/${userData.appPinHash}`).remove();
  }

  await userRef.update({
    appPinHash: null,
    pinStatus: 'revoked',
  });

  return { success: true };
});

// 7. Verify PIN (sign-in from Mobile App, returns Firebase Custom Auth Token)
export const verifyPin = functions.https.onCall(async (data, context) => {
  const { pin, deviceId, deviceModel, osVersion } = data;

  if (!pin || !deviceId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing PIN or Device ID.'
    );
  }

  // 1. Rate Limiting & Lockout Check
  const failureRef = db.ref(`pin_failures/${deviceId}`);
  const failureSnap = await failureRef.once('value');
  const failureData = failureSnap.val();

  if (failureData) {
    const now = Date.now();
    if (failureData.lockedUntil && failureData.lockedUntil > now) {
      const remainingMin = Math.ceil((failureData.lockedUntil - now) / 60000);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Too many failed attempts. Device is temporarily locked out. Try again in ${remainingMin} minutes.`
      );
    }
  }

  // 2. Hash and lookup the PIN
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
  const lookupSnap = await db.ref(`pin_lookups/${pinHash}`).once('value');

  if (!lookupSnap.exists()) {
    // Increment failures
    let attempts = 1;
    let lockedUntil = null;

    if (failureData) {
      attempts = (failureData.attempts || 0) + 1;
      if (attempts >= 5) {
        lockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins lockout
      }
    }

    await failureRef.set({
      attempts,
      lockedUntil,
      lastAttempt: admin.database.ServerValue.TIMESTAMP,
    });

    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid PIN.'
    );
  }

  const lookupData = lookupSnap.val();
  const uid = lookupData.uid;

  // 3. Retrieve user profile and perform validation
  const userRef = db.ref(`users/${uid}`);
  const userSnap = await userRef.once('value');
  const userData = userSnap.val();

  if (!userData || userData.status === 'blocked') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User account is disabled or does not exist.'
    );
  }

  if (userData.pinStatus !== 'active' || userData.appPinHash !== pinHash) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'PIN is inactive or has been revoked.'
    );
  }

  // 4. Multiple Devices Check (Enabled/disabled by admin settings)
  const settingsSnap = await db.ref('settings/allowMultipleDevices').once('value');
  const allowMultipleDevices = settingsSnap.exists() ? settingsSnap.val() : true;

  const devicesRef = db.ref(`devices/${uid}`);
  const devicesSnap = await devicesRef.once('value');
  let activeDeviceCount = 0;
  let isThisDeviceActive = false;

  if (devicesSnap.exists()) {
    const devices = devicesSnap.val();
    for (const devId in devices) {
      if (devices[devId].status === 'active') {
        activeDeviceCount++;
        if (devId === deviceId) {
          isThisDeviceActive = true;
        }
      }
    }
  }

  if (!allowMultipleDevices && activeDeviceCount > 0 && !isThisDeviceActive) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Multiple device access is disabled. An active session already exists on another device.'
    );
  }

  if (activeDeviceCount >= 2 && !isThisDeviceActive) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Maximum device limit reached (2 devices).'
    );
  }

  // Register or check-in device
  await db.ref(`devices/${uid}/${deviceId}`).set({
    id: deviceId,
    userId: uid,
    deviceModel: deviceModel || 'Generic Device',
    osVersion: osVersion || 'unknown',
    registeredAt: admin.database.ServerValue.TIMESTAMP,
    lastUsedAt: admin.database.ServerValue.TIMESTAMP,
    status: 'active',
  });

  // 5. Success cleanup & update stats
  await failureRef.remove(); // Reset failures
  await userRef.update({
    pinLastUsed: admin.database.ServerValue.TIMESTAMP,
  });

  // Generate secure custom token
  const customToken = await admin.auth().createCustomToken(uid);

  return {
    customToken,
    user: {
      uid,
      email: userData.email,
      name: userData.name,
    }
  };
});

