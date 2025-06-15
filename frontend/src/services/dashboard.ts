import api from '../config/api'

export const GetDashTicketsChannels = async (params?: {
  startDate?: string
  endDate?: string
}): Promise<{ label: string; qtd: number }[]> => {
  const { data } = await api.get('/dashboard/tickets-channels', { params })
  return data
}

export const GetDashTicketsQueues = async (params?: {
  startDate?: string
  endDate?: string
}): Promise<{ label: string; qtd: number }[]> => {
  const { data } = await api.get('/dashboard/tickets-queues', { params })
  return data
}

export const GetDashTicketsInstances = async (params?: {
  startDate?: string
  endDate?: string
}): Promise<{ label: string; qtd: number }[]> => {
  const { data } = await api.get('/dashboard/tickets-instances', { params })
  return data
} 