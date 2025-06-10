import { logger } from "./logger";
import AppError from "../errors/AppError";

/**
 * Utilitário para padronizar o tratamento de erros no sistema
 */

// Tipos de erro comuns
export enum ErrorTypes {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL = 'INTERNAL_ERROR',
  WHATSAPP_SESSION = 'WHATSAPP_SESSION_ERROR',
  MESSAGE_CREATION = 'MESSAGE_CREATION_ERROR',
  DATABASE = 'DATABASE_ERROR'
}

// Códigos de erro padronizados
export const ErrorCodes = {
  // Mensagens
  ERR_CREATING_MESSAGE: 'ERR_CREATING_MESSAGE',
  ERR_CREATING_MESSAGE_SYSTEM: 'ERR_CREATING_MESSAGE_SYSTEM',
  ERR_NO_MESSAGE_FOUND: 'ERR_NO_MESSAGE_FOUND',
  
  // WhatsApp
  ERR_WAPP_NOT_INITIALIZED: 'ERR_WAPP_NOT_INITIALIZED',
  ERR_WAPP_INVALID_CONTACT: 'ERR_WAPP_INVALID_CONTACT',
  ERR_WAPP_CHECK_CONTACT: 'ERR_WAPP_CHECK_CONTACT',
  ERR_SENDING_WAPP_MSG: 'ERR_SENDING_WAPP_MSG',
  ERR_DELETE_WAPP_MSG: 'ERR_DELETE_WAPP_MSG',
  
  // Tickets
  ERR_NO_TICKET_FOUND: 'ERR_NO_TICKET_FOUND',
  ERR_CREATING_TICKET: 'ERR_CREATING_TICKET',
  
  // Usuários
  ERR_NO_USER_FOUND: 'ERR_NO_USER_FOUND',
  ERR_INVALID_CREDENTIALS: 'ERR_INVALID_CREDENTIALS',
  
  // Contatos
  ERR_NO_CONTACT_FOUND: 'ERR_NO_CONTACT_FOUND',
  ERR_DUPLICATED_CONTACT: 'ERR_DUPLICATED_CONTACT',
  
  // Sessões
  ERR_SESSION_EXPIRED: 'ERR_SESSION_EXPIRED',
  ERR_NO_WHATSAPP_SESSION: 'ERR_NO_WHATSAPP_SESSION',
  ERR_NO_WHATSAPP_FOUND: 'ERR_NO_WHATSAPP_FOUND'
} as const;

/**
 * Cria um AppError padronizado
 */
export function createAppError(
  code: string,
  statusCode: number = 400,
  context?: string
): AppError {
  const message = context ? `${code}: ${context}` : code;
  return new AppError(message, statusCode);
}

/**
 * Verifica se um erro é recuperável (temporário)
 */
export function isRecoverableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const recoverablePatterns = [
    'timeout',
    'evaluation failed',
    'minified invariant',
    'net::',
    'protocol error',
    'target closed',
    'connection',
    'network',
    'enotfound',
    'econnreset',
    'econnrefused',
    'participants',
    'cannot read properties of undefined'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Verifica se um erro é de sessão fechada
 */
export function isSessionClosedError(error: any): boolean {
  const errorMessage = error.message || error.toString();
  return errorMessage.includes('Session closed') || 
         errorMessage.includes('Protocol error') ||
         errorMessage.includes('Target closed') ||
         errorMessage.includes('Most likely the page has been closed') ||
         errorMessage.includes('Cannot read properties of undefined');
}

/**
 * Trata erros de forma padronizada
 */
export function handleError(
  error: any,
  context: string,
  shouldThrow: boolean = true
): void {
  // Log do erro
  logger.error(`Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    context
  });
  
  // Se é um erro de sessão fechada, apenas avisa
  if (isSessionClosedError(error)) {
    logger.warn(`Session closed error in ${context}, ignoring:`, error.message);
    return;
  }
  
  // Se deve propagar o erro
  if (shouldThrow) {
    if (error instanceof AppError) {
      throw error;
    }
    
    // Converte Error comum para AppError
    throw new AppError(error.message || 'Internal server error', 500);
  }
}

/**
 * Wrapper para executar operações com tratamento de erro
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, false);
    return fallbackValue;
  }
}

/**
 * Cria erros específicos para mensagens
 */
export const MessageErrors = {
  creationFailed: (context?: string) => 
    createAppError(ErrorCodes.ERR_CREATING_MESSAGE, 500, context),
  
  systemCreationFailed: (context?: string) => 
    createAppError(ErrorCodes.ERR_CREATING_MESSAGE_SYSTEM, 500, context),
  
  notFound: (messageId?: string) => 
    createAppError(ErrorCodes.ERR_NO_MESSAGE_FOUND, 404, messageId),
    
  ticketNotFound: (ticketId?: string | number) => 
    createAppError(ErrorCodes.ERR_NO_TICKET_FOUND, 404, ticketId?.toString()),
    
  invalidType: (type?: string) => 
    createAppError('ERR_INVALID_MESSAGE_TYPE', 400, type)
};

/**
 * Cria erros específicos para WhatsApp
 */
export const WhatsAppErrors = {
  notInitialized: () => 
    createAppError(ErrorCodes.ERR_WAPP_NOT_INITIALIZED, 400),
  
  invalidContact: (contact?: string) => 
    createAppError(ErrorCodes.ERR_WAPP_INVALID_CONTACT, 400, contact),
  
  sendingFailed: (context?: string) => 
    createAppError(ErrorCodes.ERR_SENDING_WAPP_MSG, 500, context),
  
  sessionNotFound: (context?: string) => 
    createAppError(ErrorCodes.ERR_NO_WHATSAPP_SESSION, 404, context),
    
  invalidObject: (context?: string) => 
    createAppError('ERR_INVALID_WHATSAPP_OBJECT', 400, context),
    
  initializationFailed: (context?: string) => 
    createAppError('ERR_WHATSAPP_INITIALIZATION_FAILED', 500, context),
    
  initializationBlocked: (context?: string) => 
    createAppError('ERR_WHATSAPP_INITIALIZATION_BLOCKED', 429, context)
};

export default {
  ErrorTypes,
  ErrorCodes,
  createAppError,
  isRecoverableError,
  isSessionClosedError,
  handleError,
  executeWithErrorHandling,
  MessageErrors,
  WhatsAppErrors
};