// Dexie is a library for accessing IndexedDB
// self.importScripts('./utils/dexie.min.js')
// self.importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.3/workbox-sw.js')

// if (workbox) {
//     console.log('Workbox is loaded');
// } else {
//     console.log('Workbox did not loaded');
// }

//Precaching
// workbox.precaching.precacheAndRoute([
//     { url: 'index.html', revision: '0000' },
//     { url: 'manifest.json', revision: '0000' },
//     { url: 'images/icons/icon-48x48.png', revision: '0000' },
// ])

//BackgroundSync
//On https://ptsv2.com/t/n5y9f-1556037444 you can check for received posts
// const bgSyncPlugin = new workbox.backgroundSync.Plugin('queue', {
//     maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
// })

// workbox.routing.registerRoute(
//     'https://ptsv2.com/t/n5y9f-1556037444/post',
//     new workbox.strategies.NetworkOnly({
//         plugins: [bgSyncPlugin]
//     }),
//     'POST'
// )

importScripts('./utils/idb.js')
importScripts('./utils/store.js')

self.addEventListener('sync', async function (event) {
    console.log('sync event called')

    event.waitUntil(
        store.outbox('readonly').then(function (outbox) {
            return outbox.getAll()
        }).then((messages) => {
            return Promise.all(messages.map((message) => {
                let body = { // pulling out only the stored ata we need
                    name: message.name,
                    value: message.value,
                    date: message.date
                }
                return fetch('/api/transaction', {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: {
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/json"
                    }
                }).then((response) => {
                    console.log(response)
                    if (response.status === 200) {
                        return store.outbox('readwrite').then((outbox) => {
                            return outbox.delete(message.idCache)
                        })
                    }
                })
            }))
        }).catch(function (err) { console.error(err) })
    )
})


const FILES_TO_CACHE = [
    "/index.html",
    "/styles.css",
    "/index.js",
    "/utils/chart.min.js",
    "/utils/idb.js",
    "/utils/store.js"
]

const STATIC_CACHE = "v1"
const RUNTIME_CACHE = "runtime-cache"

self.addEventListener("install", event => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(FILES_TO_CACHE)
            })
            .then(() => self.skipWaiting()) // take control rather than waiting for the previous SW to finish
    )
})

// The activate handler takes care of cleaning up old caches.
self.addEventListener("activate", event => {
    const currentCaches = [STATIC_CACHE, RUNTIME_CACHE]
    event.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                // return array of cache names that are old to delete
                return cacheNames.filter(
                    cacheName => !currentCaches.includes(cacheName)
                )
            })
            .then(cachesToDelete => {
                return Promise.all(
                    cachesToDelete.map(cacheToDelete => {
                        return caches.delete(cacheToDelete);
                    })
                )
            })
            .then(() => self.clients.claim())
    )
})


// Listen to fetch requests
self.addEventListener('fetch', async function (event) {
    if (event.request.method === "GET") {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || // match found in cache
                        fetch(event.request) // otherwise make a request for it
                            .then((response) => { //...and store it in our cache for future reference
                                return caches.open(STATIC_CACHE)
                                    .then((cache) => {
                                        cache.put(event.request, response.clone())
                                        return response
                                    })
                            })
                })
                .catch(() => { // default if everything fails
                    return caches.match('./index.html')
                })
        )
    }
    // We will cache all POST requests
    else if (event.request.method === "POST") {
        // let db = new Dexie("post_cache") // Init the cache
        // db.version(1).stores({
        //     post_cache: 'key, response, timestamp'
        // })

        // event.respondWith(
        //     // First try to fetch the request from the server
        //     fetch(event.request.clone())
        //         .then(function (response) {
        //             // If it works, put the response into IndexedDB
        //             cachePut(event.request.clone(), response.clone(), db.post_cache);
        //             return response
        //         })
        //         .catch(function () {
        //             // If it does not work, return the cached response. If the cache does not
        //             // contain a response for our request, it will give us a 503-response
        //             return cacheMatch(event.request.clone(), db.post_cache)
        //         })
        // );
    }
})

// Saves the response for the given request eventually overriding the previous version.
// Takes data and returns a Promise
function cachePut(request, response, store) {
    var key, data
    getPostId(request.clone())
        .then(function (id) {
            key = id;
            return serializeResponse(response.clone())
        }).then(function (serializedResponse) {
            data = serializedResponse
            var entry = {
                key: key,
                response: data,
                timestamp: Date.now()
            };
            store
                .add(entry)
                .catch(function (error) {
                    store.update(entry.key, entry);
                })
        })
}

// Returns the cached response for the given request or an empty 503-repsponse for a cache miss.
// Takes a request nd returns a Promise
function cacheMatch(request) {
    return getPostId(request.clone())
        .then(function (id) {
            return store.get(id)
        }).then(function (data) {
            if (data) {
                return deserializeResponse(data.response);
            } else {
                return new Response('', { status: 503, statusText: 'Service Unavailable' });
            }
        })
}

// Serializes a Request into a plain JS object. Takes a request, returns a promise
function serializeRequest(request) {
    var serialized = {
        url: request.url,
        headers: serializeHeaders(request.headers),
        method: request.method,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer
    }

    // Only if method is not `GET` or `HEAD` is the request allowed to have body.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return request.clone().text().then(function (body) {
            serialized.body = body;
            return Promise.resolve(serialized);
        });
    }
    return Promise.resolve(serialized)
}

// Serializes a response into a plain JS object.Takes a request, returns a promise
function serializeResponse(response) {
    var serialized = {
        headers: serializeHeaders(response.headers),
        status: response.status,
        statusText: response.statusText
    }

    return response.clone().text().then(function (body) {
        serialized.body = body;
        return Promise.resolve(serialized);
    })
}

// Serializes headers into a plain JS object. Takes headers, and returns an object
function serializeHeaders(headers) {
    var serialized = {}
    for (var entry of headers.entries()) {
        serialized[entry[0]] = entry[1]
    }
    return serialized
}

// Creates a Response from it's serialized version. Takes data and returns a promise
function deserializeResponse(data) {
    return Promise.resolve(new Response(data.body, data));
}

// Returns a string identifier for our POST request.
// takes a request and returns a string
function getPostId(request) {
    return Promise.resolve(JSON.stringify(serializeRequest(request.clone())))
}

// this event is triggered when we were offline, and are now online
// self.addEventListener('sync', event => {
//     event.waitUntil(retryApiCalls());
// });