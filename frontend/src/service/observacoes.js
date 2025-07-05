import request from './request'

/**
 * @typedef {Object} TicketObservation
 * @property {number} id - ID da observação
 * @property {string} texto - Texto da observação
 * @property {string} [anexo] - URL do anexo (opcional)
 * @property {string} createdAt - Data de criação
 * @property {string} updatedAt - Data de atualização
 * @property {number} ticketId - ID do ticket
 * @property {number} userId - ID do usuário que criou a observação
 */

/**
 * Cria uma nova observação para um ticket
 * @param {number} ticketId - ID do ticket
 * @param {Object} data - Dados da observação
 * @param {string} data.texto - Texto da observação
 * @param {File} [data.anexo] - Arquivo anexo (opcional)
 * @returns {Promise<TicketObservation>} Observação criada
 */
export const CriarObservacao = async (ticketId, data) => {
  if (!ticketId || isNaN(Number(ticketId))) {
    throw new Error('ID do ticket inválido')
  }

  const url = `/api/ticket-observations/ticket/${ticketId}/observations`
  const formData = new FormData()
  formData.append('texto', data.texto)
  if (data.anexo) {
    formData.append('anexo', data.anexo)
  }

  try {
    const response = await request.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    throw error
  }
}

/**
 * Lista todas as observações de um ticket
 * @param {number} ticketId - ID do ticket
 * @returns {Promise<TicketObservation[]>} Lista de observações
 */
export const ListarObservacoes = async (ticketId) => {
  if (!ticketId || isNaN(Number(ticketId))) {
    throw new Error('ID do ticket inválido')
  }

  const response = await request.get(
    `/api/ticket-observations/ticket/${ticketId}/observations`
  )
  return response.data
}
