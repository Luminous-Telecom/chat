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
  console.log('Notificação clicada:', event.action)

  event.notification.close()

  // Tratar diferentes actions
  if (event.action === 'close') {
    // Apenas fechar a notificação
    return
  }

  // Para action 'open' ou clique na notificação principal
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Procurar se já existe uma janela aberta
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Se encontrar uma janela, navegar para a URL e focar
          client.navigate(urlToOpen)
          return client.focus()
        }
      }

      // Se não encontrar janela aberta, abrir nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }).catch((err) => {
      console.error('Erro ao abrir janela:', err)
      // Fallback: tentar abrir janela simples
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})
