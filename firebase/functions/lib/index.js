"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserStatus = exports.purchasePdf = exports.getDecryptionKey = exports.registerDevice = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// 1. Register Device (Max 2 devices check)
exports.registerDevice = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const uid = context.auth.uid;
    const { deviceId, deviceModel, osVersion } = data;
    if (!deviceId || !deviceModel) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing device information.');
    }
    const deviceRef = db.collection('devices').doc(deviceId);
    const deviceSnap = await deviceRef.get();
    // If already registered and active to this user, update check-in timestamp and return success
    if (deviceSnap.exists) {
        const devData = deviceSnap.data();
        if (devData && devData.userId === uid && devData.status === 'active') {
            await deviceRef.update({
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                deviceModel,
                osVersion: osVersion || 'unknown',
            });
            return { success: true, message: 'Device check-in successful.' };
        }
        if (devData && devData.status === 'blocked') {
            throw new functions.https.HttpsError('permission-denied', 'This device has been blocked by the administrator.');
        }
        // If it was registered to a different user, we will re-evaluate limits for the current user
    }
    // Check how many active devices this user currently has
    const activeDevicesSnap = await db
        .collection('devices')
        .where('userId', '==', uid)
        .where('status', '==', 'active')
        .get();
    const activeCount = activeDevicesSnap.size;
    if (activeCount >= 2) {
        throw new functions.https.HttpsError('failed-precondition', 'Maximum device limit reached (2 devices). Please contact support to unbind a device.');
    }
    // Register the new device
    await deviceRef.set({
        id: deviceId,
        userId: uid,
        deviceModel,
        osVersion: osVersion || 'unknown',
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
    });
    return { success: true, message: 'Device registered successfully.' };
});
// 2. Get Decryption Key
exports.getDecryptionKey = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const uid = context.auth.uid;
    const { pdfId, deviceId } = data;
    if (!pdfId || !deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing PDF ID or Device ID.');
    }
    // A. Verify that the device is registered to this user and is active
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    if (!deviceSnap.exists || deviceSnap.data()?.userId !== uid || deviceSnap.data()?.status !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'This device is not authorized. Please log in from this device again.');
    }
    // B. Verify that the user is not blocked
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists && userSnap.data()?.status === 'blocked') {
        throw new functions.https.HttpsError('permission-denied', 'Your user account has been disabled.');
    }
    // C. Verify purchase (userId_pdfId)
    const purchaseId = `${uid}_${pdfId}`;
    const purchaseSnap = await db.collection('purchases').doc(purchaseId).get();
    const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
    if (!isAdmin) {
        if (!purchaseSnap.exists || purchaseSnap.data()?.status !== 'active') {
            throw new functions.https.HttpsError('permission-denied', 'You have not purchased this document, or your purchase has been revoked.');
        }
    }
    // D. Fetch key from pdf_keys (which is private and not readable by clients)
    const keySnap = await db.collection('pdf_keys').doc(pdfId).get();
    if (!keySnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Decryption key not found for this document.');
    }
    const keyData = keySnap.data();
    return {
        key: keyData?.key, // AES-256 key (base64 encoded string)
        iv: keyData?.iv || '', // Initialisation Vector
    };
});
// 3. Purchase PDF (Dummy transaction flow)
exports.purchasePdf = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const uid = context.auth.uid;
    const { pdfId, couponCode } = data;
    if (!pdfId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing PDF ID.');
    }
    // Check if PDF exists
    const pdfSnap = await db.collection('pdfs').doc(pdfId).get();
    if (!pdfSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'PDF document not found.');
    }
    // If coupon is provided, we can validate it
    let discount = 0;
    if (couponCode) {
        const couponSnap = await db.collection('coupons').doc(couponCode.toUpperCase()).get();
        if (couponSnap.exists && couponSnap.data()?.active) {
            discount = couponSnap.data()?.discountPercent || 0;
        }
    }
    const purchaseId = `${uid}_${pdfId}`;
    await db.collection('purchases').doc(purchaseId).set({
        id: purchaseId,
        userId: uid,
        pdfId: pdfId,
        purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        discountApplied: discount,
    });
    // Log purchase analytics
    await db.collection('analytics').add({
        eventType: 'purchase',
        userId: uid,
        pdfId: pdfId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: { couponCode: couponCode || 'none', discount },
    });
    return { success: true, message: 'PDF purchased successfully.' };
});
// 4. Admin Toggle User Status
exports.setUserStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // Ensure caller is admin
    const callerSnap = await db.collection('users').doc(context.auth.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only administrators can perform this action.');
    }
    const { targetUserId, status } = data; // 'active' or 'blocked'
    if (!targetUserId || !['active', 'blocked'].includes(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing target user ID or invalid status.');
    }
    await db.collection('users').doc(targetUserId).update({
        status: status,
    });
    // If blocking user, also disable their registered devices
    if (status === 'blocked') {
        const devicesSnap = await db.collection('devices').where('userId', '==', targetUserId).get();
        const batch = db.batch();
        devicesSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { status: 'blocked' });
        });
        await batch.commit();
    }
    else {
        // Re-activating: unblock devices
        const devicesSnap = await db.collection('devices').where('userId', '==', targetUserId).get();
        const batch = db.batch();
        devicesSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { status: 'active' });
        });
        await batch.commit();
    }
    return { success: true, message: `User status set to ${status}.` };
});
//# sourceMappingURL=index.js.map