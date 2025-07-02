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

// Função para verificar se uma subscription é inválida
const isInvalidSubscriptionError = (err: any): boolean => {
  return err.statusCode === 410 || 
         err.statusCode === 404 || 
         err.message?.includes('invalid') ||
         err.message?.includes('expired') ||
         err.message?.includes('unregistered') ||
         err.message?.includes('gone')
}

// Função para limpar subscriptions inválidas periodicamente
const cleanInvalidSubscriptions = async (): Promise<number> => {
  const invalidIndices: number[] = []
  
  // Validar estrutura das subscriptions sem enviar notificações
  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i]
    
    // Verificar se a subscription tem a estrutura mínima necessária
    if (!sub || 
        !sub.endpoint || 
        typeof sub.endpoint !== 'string' ||
        !sub.keys ||
        !sub.keys.p256dh ||
        !sub.keys.auth) {
      // Subscription inválida estruturalmente
      invalidIndices.push(i)
      continue
    }
    
    // Verificar se o endpoint está em formato válido
    try {
      new URL(sub.endpoint)
    } catch {
      // URL inválida
      invalidIndices.push(i)
    }
  }
  
  // Remover em ordem reversa
  invalidIndices.reverse().forEach(index => {
    subscriptions.splice(index, 1)
  })
  
  if (invalidIndices.length > 0) {
    console.info(`[PushController] Limpeza automática: ${invalidIndices.length} subscriptions inválidas removidas`)
  }
  
  return invalidIndices.length
}

// Iniciar limpeza automática a cada 30 minutos
setInterval(() => {
  cleanInvalidSubscriptions().catch(err => {
    console.error('[PushController] Erro na limpeza automática:', err.message)
  })
}, 30 * 60 * 1000) // 30 minutos

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

  // Função para obter estatísticas das subscriptions
  getStats: (req: Request, res: Response) => {
    return res.json({
      totalSubscriptions: subscriptions.length,
      subscriptions: subscriptions.map(sub => ({
        endpoint: sub.endpoint?.substring(0, 50) + '...',
        keys: sub.keys ? 'presente' : 'ausente'
      }))
    })
  },

  // Função para limpeza manual de subscriptions inválidas
  cleanInvalid: async (req: Request, res: Response) => {
    try {
      const removedCount = await cleanInvalidSubscriptions()
      return res.json({ 
        success: true, 
        message: `${removedCount} subscriptions inválidas foram removidas`,
        remainingSubscriptions: subscriptions.length
      })
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }
  },

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
    let successCount = 0
    let invalidSubscriptions: number[] = []
    
    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i]
      try {
        await webpush.sendNotification(sub, payload)
        results.push({ endpoint: sub.endpoint, success: true })
        successCount++
      } catch (err) {
        results.push({ endpoint: sub.endpoint, success: false, error: err.message })
        
        // Usar função utilitária para verificar se é subscription inválida
        if (isInvalidSubscriptionError(err)) {
          // Subscription inválida - marcar para remoção
          invalidSubscriptions.push(i)
          console.warn(`[PushNotification] Subscription inválida removida: ${err.message}`)
        } else {
          // Erro real - logar como erro
          console.error('[PushNotification] Erro crítico ao enviar push:', err.message)
        }
      }
    }
    
    // Remover subscriptions inválidas (em ordem reversa para não afetar índices)
    invalidSubscriptions.reverse().forEach(index => {
      subscriptions.splice(index, 1)
    })
    
    // Log de resumo apenas se houver problemas críticos
    if (successCount === 0 && results.length > 0) {
      console.error(`[PushNotification] Falha total no envio de push - ${results.length} tentativas falharam`)
    } else if (successCount > 0 && invalidSubscriptions.length > 0) {
      console.info(`[PushNotification] Push enviado com sucesso para ${successCount} dispositivos, ${invalidSubscriptions.length} subscriptions inválidas removidas`)
    }
    
    return res.json({ results, successCount, removedInvalidSubscriptions: invalidSubscriptions.length })
  }
}

export default PushController 