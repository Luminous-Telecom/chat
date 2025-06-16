import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

export const GetDashTicketsPerUsersDetail = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-per-users-detail', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados dos usuários:', error.response || error)
    throw error
  }
}

export const GetDashTicketsAndTimes = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-times', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados de tickets e tempos:', error.response || error)
    throw error
  }
}

export const GetDashTicketsEvolutionChannels = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-evolution-channels', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados de evolução dos canais:', error.response || error)
    throw error
  }
}

export const GetDashTicketsInstances = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-instances', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados das instâncias:', error.response || error)
    throw error
  }
}

export const GetDashTicketsEvolutionByPeriod = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-evolution-by-period', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados de evolução por período:', error.response || error)
    throw error
  }
}

export const GetDashTicketsEvolutionByQueue = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-evolution-by-queue', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados de evolução por fila:', error.response || error)
    throw error
  }
}

export const GetDashTicketsChannels = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-channels', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados dos canais:', error.response || error)
    throw error
  }
}

export const GetDashTicketsQueue = async (params) => {
  try {
    const response = await api.get('/statistics/statistics-tickets-queue', {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    return response
  } catch (error) {
    console.error('Erro ao buscar dados das filas:', error.response || error)
    throw error
  }
}
