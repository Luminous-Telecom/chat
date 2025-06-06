import { logger } from "../utils/logger";

export const isSessionClosedError = (error: any): boolean => {
  const errorMessage = error.message || error.toString();
  return errorMessage.includes('Session closed') || 
         errorMessage.includes('Protocol error') ||
         errorMessage.includes('Target closed') ||
         errorMessage.includes('Most likely the page has been closed') ||
         errorMessage.includes('Cannot read properties of undefined');
};

export const handleSessionError = (error: any, context: string): void => {
  if (isSessionClosedError(error)) {
    logger.warn(`Session closed error in ${context}, ignoring:`, error.message);
  } else {
    logger.error(`Error in ${context}:`, error);
    throw error;
  }
};