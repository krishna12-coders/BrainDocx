import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
