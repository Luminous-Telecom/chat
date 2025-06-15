import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

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
