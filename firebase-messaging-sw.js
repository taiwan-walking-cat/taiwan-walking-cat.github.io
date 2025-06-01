console.log(`[Service Worker]`);

// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAkVwAIwink5oFLRQ0SF90eZ4p4RYEpKMc",
    authDomain: "my-event-18887.firebaseapp.com",
    projectId: "my-event-18887",
    storageBucket: "my-event-18887.firebasestorage.app",
    messagingSenderId: "502808990513",
    appId: "1:502808990513:web:36f90b7360d495e44d1610",
    measurementId: "G-YD0KWHR4JB"
};

class CustomPushEvent extends Event {
    constructor(data) {
        super('push');

        Object.assign(this, data);
        this.custom = true;
    }
}

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

/*
 * Overrides push notification data, to avoid having 'notification' key and firebase blocking
 * the message handler from being called
 */
self.addEventListener('push', async (e) => {

    e.preventDefault(); // 阻止預設的推播通知顯示

    // Stop event propagation
    e.stopImmediatePropagation();

    // Skip if event is our own custom event
    if (e.custom) return;

    // Kep old event data to override
    const oldData = e.data;
    console.log('[firebase-messaging-sw.js] Received push background message ', oldData.json());

    // Create a new event to dispatch, pull values from notification key and put it in data key,
    // and then remove notification key
    const data = {
        ehheh: oldData.json(),
        json() {
            const newData = oldData.json();

            newData.data = {
                ...newData.data,
                ...newData.notification,
            };

            delete newData.notification;
            return newData;
        },
    }

    // console.log('[firebase-messaging-sw.js] 新的', newEvent.data.json());

    // // foreground handling: eventually passed to onMessage hook
    // const clientList = await getClientList();
    // if (hasVisibleClients(clientList)) {
    //     return sendMessagePayloadInternalToWindows(clientList, newEvent);
    // }

    const customPushEvent = new Event("customPushEvent");
    customPushEvent.data = data; // 傳遞當前事件的資料到新事件

    // Dispatch the new wrapped event
    dispatchEvent(customPushEvent);
});

const notification_click_handler = async function (event) {

    // Prevent other listeners from receiving the event
    event.stopImmediatePropagation();
    event.notification.close();
    console.log("[Service Worker] data:", event.notification.data);

    const payload = event.notification?.data;
    console.log("[Service Worker] payload:", payload);

    if (!payload) {
        return;
    } else if (event.action) {
        // User clicked on an action button. This will allow developers to act on action button clicks
        // by using a custom onNotificationClick listener that they define.
        return;
    }

    const link = payload.click_action || payload.url || "/";

    // // FM should only open/focus links from app's origin.
    // const url = new URL(link, self.location.href);
    // const originUrl = new URL(self.location.origin);

    // // if (url.host !== originUrl.host) {
    // //     return;
    // // }

    console.log('goto:' + link);

    event.waitUntil(
        new Promise(async (resolve) => {
            let client = await getWindowClient(link);

            if (!client) {
                client = await clients.openWindow(link);

                // Wait three seconds for the client to initialize and set up the message handler so that it
                // can receive the message.
                await sleep(3000);
            } else {
                client = await client.focus();
            }

            if (!client) {
                // Window Client will not be returned if it's for a third party origin.
                return;
            }

            payload.messageType = 'notification_clicked';
            payload.isFirebaseMessaging = true;
            client.postMessage(payload);
            resolve();
        })
    );
};

// CustomPushEvent 事件處理器
self.addEventListener('customPushEvent', async function (event) {
    event.preventDefault(); // 阻止預設的推播通知顯示

    console.log('[firebase-messaging-sw.js] CustomPushEvent message ', event.data.json());
    const payload = event.data.json();

    // Customize notification here
    const notificationTitle = payload.data.title;
    const notificationOptions = {
        body: payload.data.body,
        icon: payload.data.icon || '/favicon.png',
        badge: payload.data.badge || '/favicon.png',
        data: payload.data
    };

    // Check if there's an image, then add it to the notification options
    if (payload.data.image) {
        notificationOptions.image = payload.data.image;
    }

    // Optionally, handle the notification click event to open a URL
    self.addEventListener('notificationclick', notification_click_handler);

    // Show the notification
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 停止 Firebase 自動顯示推播通知
messaging.onBackgroundMessage(function (payload) {

    // 在此處理消息，不顯示預設的通知
    console.log('[firebase-messaging-sw.js] Background message received: ', payload);

    // 如果不需要顯示通知，可以選擇在此處不做任何處理，或手動自定義顯示邏輯
});


// messaging.onBackgroundMessage(async function (payload) {
//     console.log('[firebase-messaging-sw.js] Received background message ', payload);

//     // Customize notification here
//     const notificationTitle = payload.data.title + "[background]";
//     const notificationOptions = {
//         body: payload.data.body,
//         icon: payload.data.icon || '/favicon.png',
//         badge: payload.data.badge || '/badge.png',
//         data: payload.data
//     };

//     if (!!payload.data.image) {
//         notificationOptions.image = payload.data.image;
//     }

//     self.registration.showNotification(notificationTitle, notificationOptions);
// });

self.addEventListener('notificationclick', notification_click_handler);

/** Returns a promise that resolves after given time passes. */
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * @param url The URL to look for when focusing a client.
 * @return Returns an existing window client or a newly opened WindowClient.
 */
async function getWindowClient(url) {
    const clientList = await getClientList();

    for (const client of clientList) {
        const clientUrl = new URL(client.url, self.location.href);

        if (url.href === clientUrl.href) {
            return client;
        }
    }

    return null;
}

function getClientList() {
    return self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    });
}

/**
 * @returns If there is currently a visible WindowClient, this method will resolve to true,
 * otherwise false.
 */
function hasVisibleClients(clientList) {
    return clientList.some(
        client =>
            client.visibilityState === 'visible' &&
            // Ignore chrome-extension clients as that matches the background pages of extensions, which
            // are always considered visible for some reason.
            !client.url.startsWith('chrome-extension://')
    );
}

function sendMessagePayloadInternalToWindows(clientList, internalPayload) {
    internalPayload.isFirebaseMessaging = true;
    internalPayload.messageType = 'push_received';

    for (const client of clientList) {
        client.postMessage(internalPayload);
    }
}

self.addEventListener("install", event => {
    console.log("[Service Worker] Install");
});
