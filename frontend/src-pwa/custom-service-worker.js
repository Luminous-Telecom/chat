/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.conf > pwa > workboxPluginMode is set to "InjectManifest"
 */

/*
 * Service Worker customizado para notificações push (Quasar PWA)
 * https://quasar.dev/quasar-cli/developing-pwa/service-worker-customization
 */

/* global clients */

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

// Precaching dos assets gerados pelo Quasar CLI
precacheAndRoute(self.__WB_MANIFEST || [])

// Exemplo: cache para chamadas de API
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst()
)

// Listener para eventos 'push' (notificações push)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}

    // Validação adicional de segurança
    if (data.title && typeof data.title !== 'string') {
      data.title = 'Nova Mensagem'
    }
    if (data.body && typeof data.body !== 'string') {
      data.body = 'Você tem uma nova notificação.'
    }
  } catch (e) {
    data = { title: 'Nova Mensagem', body: 'Você tem uma nova notificação.' }
  }

  const title = (data.title || 'Nova Mensagem').substring(0, 100)
  const options = {
    body: (data.body || 'Você tem uma nova notificação.').substring(0, 300),
    icon: data.icon || '/icons/icon-128x128.png',
    badge: data.badge || '/icons/icon-128x128.png',
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'chat-notification'
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Validação de URL mais rigorosa
  let urlToOpen = '/'
  if (event.notification.data?.url) {
    try {
      const url = new URL(event.notification.data.url, self.location.origin)
      // Só permitir URLs do mesmo domínio
      if (url.origin === self.location.origin) {
        urlToOpen = url.pathname + url.search + url.hash
      }
    } catch (e) {
      // URL inválida, usar fallback
      urlToOpen = '/'
    }
  }

  event.waitUntil(
    clients.openWindow(urlToOpen).then((windowClient) => {
      if (windowClient) {
        windowClient.focus()
      }
    })
  )
})
