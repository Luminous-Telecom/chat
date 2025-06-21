import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import { logger } from "../utils/logger";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  tenantId: number;
  iat: number;
  exp: number;
}

interface Data {
  id: number | string;
  profile: string;
  tenantId: number | string;
}
interface Result {
  isValid: boolean;
  data: Data;
}

const decode = (token: string): Result => {
  const validation = {
    isValid: false,
    data: {
      id: "",
      profile: "",
      tenantId: 0,
    },
  };
  
  try {
    // Verificar se o token foi fornecido
    if (!token || typeof token !== 'string') {
      logger.warn('[decodeTokenSocket] Token não fornecido ou inválido');
      return validation;
    }

    const decoded = verify(token, authConfig.secret);
    const { id, profile, tenantId } = decoded as TokenPayload;
    
    // Validar se os campos obrigatórios existem
    if (!id || !profile || !tenantId) {
      logger.warn('[decodeTokenSocket] Token decodificado não contém campos obrigatórios');
      return validation;
    }
    
    validation.isValid = true;
    validation.data = {
      id,
      profile,
      tenantId,
    };
    
    logger.info(`[decodeTokenSocket] Token decodificado com sucesso para usuário ${id}`);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      logger.warn(`[decodeTokenSocket] JWT inválido: ${err.message}`);
    } else if (err.name === 'TokenExpiredError') {
      logger.warn(`[decodeTokenSocket] Token expirado: ${err.message}`);
    } else {
      logger.error(`[decodeTokenSocket] Erro ao decodificar token: ${err.message}`);
    }
  }
  
  return validation;
};

export default decode;
