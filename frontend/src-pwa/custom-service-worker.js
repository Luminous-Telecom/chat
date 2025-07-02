/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.conf > pwa > workboxPluginMode is set to "InjectManifest"
 */

/*
 * Service Worker customizado para notificações push (Quasar PWA)
 * https://quasar.dev/quasar-cli/developing-pwa/service-worker-customization
 * Version: 2.0.0 - Fixed notification click handler
 */

/* global clients */

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

// Versão do service worker para forçar atualização
const SW_VERSION = '2.0.0'
console.log(`Service Worker ${SW_VERSION} iniciado`)

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

  // Múltiplos fallbacks para ícones
  const getNotificationIcon = () => {
    if (data.icon && data.icon !== '/icons/icon-128x128.png') {
      return data.icon // Usar ícone personalizado (foto do contato)
    }

    // Fallbacks para ícone do sistema
    const iconFallbacks = [
      '/icons/icon-128x128.png',
      '/icons/favicon-128x128.png',
      '/lumi-suite-logo-mini.png',
      '/favicon.ico'
    ]

    return iconFallbacks[0] // Usar o primeiro como padrão
  }

  const options = {
    body: (data.body || 'Você tem uma nova notificação.').substring(0, 300),
    icon: getNotificationIcon(),
    badge: '/icons/icon-128x128.png',
    image: data.image, // Para notificações com imagem
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'lumi-suite-notification',
    renotify: true,
    timestamp: Date.now(),
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/icons/icon-128x128.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ],
    // Configurações visuais aprimoradas
    silent: false,
    lang: 'pt-BR'
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  // Fechar a notificação
  event.notification.close()

  // Se for ação de fechar, apenas retornar
  if (event.action === 'close') {
    return
  }

  // Construir URL de destino
  let targetUrl = self.location.origin

  try {
    if (event.notification.data && event.notification.data.url) {
      const notificationUrl = event.notification.data.url
      // Se for URL relativa, adicionar origem
      if (notificationUrl.startsWith('/')) {
        targetUrl = self.location.origin + notificationUrl
      } else if (notificationUrl.startsWith(self.location.origin)) {
        targetUrl = notificationUrl
      }
    }
  } catch (e) {
    // Em caso de erro, usar página inicial
    targetUrl = self.location.origin
  }

  // Abrir janela de forma super simples
  event.waitUntil(
    new Promise((resolve) => {
      try {
        // Tentar abrir janela
        const windowPromise = clients.openWindow(targetUrl)
        if (windowPromise && windowPromise.then) {
          windowPromise
            .then(() => resolve())
            .catch(() => {
              // Fallback: tentar abrir só a origem
              clients.openWindow(self.location.origin)
                .then(() => resolve())
                .catch(() => resolve())
            })
        } else {
          resolve()
        }
      } catch (error) {
        // Qualquer erro, apenas resolver
        resolve()
      }
    })
  )
})
