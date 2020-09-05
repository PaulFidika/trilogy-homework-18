importScripts('./utils/idb.js')
importScripts('./utils/store.js')

self.addEventListener('sync', async function (event) {
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


// Listen to fetch requests, network with fall back to cache
self.addEventListener('fetch', function (event) {
    if (event.request.method === "GET") {
        event.respondWith(
            fetch(event.request) // try to make a request for it
                .then((response) => {
                    return caches.open(STATIC_CACHE)
                        .then((cache) => { // store the result for the future
                            cache.put(event.request, response.clone())
                            return response // and return it
                        })
                })
                .catch(() => { // otherwise try to find it in our cache
                    caches.match(event.request)
                        .then((response) => {
                            return response
                        })
                        .catch(() => { // default if everything fails
                            return caches.match('./index.html')
                        })
                })
        )
    }
})

