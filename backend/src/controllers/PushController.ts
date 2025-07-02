import { Request, Response } from 'express'
import webpush from 'web-push'

// Armazenamento simples em memória (substitua por banco de dados em produção)
const subscriptions: any[] = []

// Chaves VAPID (coloque as suas aqui)
const VAPID_PUBLIC_KEY = 'BAw5kERSTL-xfOKbOhmYkz72Hwv24C4kKMF58D-YiYVsq46AJneYVCEcdpKa2jpynEnNTG1dGZcdFnTiMvUZiUc'
const VAPID_PRIVATE_KEY = 'styK4evCzCYzRUM5tasRwF1wCx3pSAqpeZ7tdY3BWwA'

webpush.setVapidDetails(
  'mailto:seu-email@dominio.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const PushController = {
  subscribe: (req: Request, res: Response) => {
    try {
      const subscription = req.body
      if (!subscriptions.find(sub => sub.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription)
      }
      return res.status(201).json({ success: true })
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message })
    }
  },
  // Exportar as subscriptions para uso em outros lugares
  getSubscriptions: () => subscriptions,

  // Enviar notificação de teste para todas as subscriptions
  sendTest: async (req: Request, res: Response) => {
    const payload = JSON.stringify({
      title: 'Notificação Push',
      body: 'Esta é uma notificação de teste!',
      icon: '/icons/icon-128x128.png',
      data: { url: '/' }
    })
    const results: Array<{ endpoint: any; success: boolean; error?: any }> = []
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload)
        results.push({ endpoint: sub.endpoint, success: true })
      } catch (err) {
        results.push({ endpoint: sub.endpoint, success: false, error: err.message })
      }
    }
    return res.json({ results })
  },

  // Enviar notificação real para todas as subscriptions
  send: async (req: Request, res: Response) => {

    const {
 title, body, icon, data 
} = req.body
    const payload = JSON.stringify({
      title: title || 'Notificação',
      body: body || 'Você tem uma nova notificação.',
      icon: icon || '/icons/icon-128x128.png',
      data: data || { url: '/' }
    })
    const results: Array<{ endpoint: any; success: boolean; error?: any }> = []
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload)
        results.push({ endpoint: sub.endpoint, success: true })
      } catch (err) {
        results.push({ endpoint: sub.endpoint, success: false, error: err.message })
        console.error('[PushNotification] Erro ao enviar push:', err.message)
      }
    }
    return res.json({ results })
  }
}

export default PushController 