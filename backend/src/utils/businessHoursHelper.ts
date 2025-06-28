import {
  isWithinInterval,
  parse,
  addDays,
  setHours,
  setMinutes,
  getDay,
} from "date-fns";
import ShowBusinessHoursAndMessageService from "../services/TenantServices/ShowBusinessHoursAndMessageService";

interface BusinessHoursValidation {
  isValidTime: boolean;
  isValidDay: boolean;
  nextValidDateTime: Date;
}

/**
 * Verifica se uma data está dentro do horário comercial e em dia útil
 * @param date - Data a ser verificada
 * @param tenantId - ID do tenant
 * @returns Promise<BusinessHoursValidation>
 */
export const validateBusinessHours = async (
  date: Date,
  tenantId: number
): Promise<BusinessHoursValidation> => {
  const tenant = await ShowBusinessHoursAndMessageService({ tenantId });
  
  if (!tenant.businessHours || tenant.businessHours.length === 0) {
    // Se não há configuração de horários, considera como válido
    return {
      isValidTime: true,
      isValidDay: true,
      nextValidDateTime: date
    };
  }

  const dayOfWeek = getDay(date);
  const businessDay = tenant.businessHours.find((d: any) => d.day === dayOfWeek) as any;

  if (!businessDay) {
    // Se não há configuração para o dia, avança para o próximo dia útil
    const nextValidDateTime = getNextBusinessDay(date, tenant.businessHours);
    return {
      isValidTime: false,
      isValidDay: false,
      nextValidDateTime
    };
  }

  // Se o tipo for "O" (Open), o estabelecimento funciona o dia inteiro
  if (businessDay.type === "O") {
    return {
      isValidTime: true,
      isValidDay: true,
      nextValidDateTime: date
    };
  }

  // Se o tipo for "C" (Closed), o estabelecimento está fechado
  if (businessDay.type === "C") {
    const nextValidDateTime = getNextBusinessDay(date, tenant.businessHours);
    return {
      isValidTime: false,
      isValidDay: false,
      nextValidDateTime
    };
  }

  // Se o tipo for "H" (Hours), verifica os horários específicos
  const isFirstInterval = isWithinInterval(date, {
    start: parse(businessDay.hr1, "HH:mm", date),
    end: parse(businessDay.hr2, "HH:mm", date),
  });

  const isSecondInterval = isWithinInterval(date, {
    start: parse(businessDay.hr3, "HH:mm", date),
    end: parse(businessDay.hr4, "HH:mm", date),
  });

  const isValidTime = isFirstInterval || isSecondInterval;

  if (!isValidTime) {
    const nextValidDateTime = getNextValidTimeSlot(date, businessDay, tenant.businessHours);
    return {
      isValidTime: false,
      isValidDay: true,
      nextValidDateTime
    };
  }

  return {
    isValidTime: true,
    isValidDay: true,
    nextValidDateTime: date
  };
};

/**
 * Encontra o próximo horário comercial válido no mesmo dia
 */
const getNextValidTimeSlot = (date: Date, businessDay: any, businessHours: any[]): Date => {
  const firstStart = parse(businessDay.hr1, "HH:mm", date);
  const firstEnd = parse(businessDay.hr2, "HH:mm", date);
  const secondStart = parse(businessDay.hr3, "HH:mm", date);
  
  // Se está antes do primeiro horário, agenda para o início do primeiro horário
  if (date < firstStart) {
    return firstStart;
  }
  
  // Se está entre os horários, agenda para o início do segundo horário
  if (date > firstEnd && date < secondStart) {
    return secondStart;
  }
  
  // Se está após o último horário, agenda para o próximo dia útil
  return getNextBusinessDay(date, businessHours);
};

/**
 * Encontra o próximo dia útil com horário comercial
 */
const getNextBusinessDay = (date: Date, businessHours: any[]): Date => {
  let nextDate = addDays(date, 1);
  let attempts = 0;
  
  while (attempts < 7) { // Evita loop infinito
    const dayOfWeek = getDay(nextDate);
    const businessDay = businessHours.find((d: any) => d.day === dayOfWeek);
    
    if (businessDay && businessDay.type !== "C") {
      // Agenda para o início do primeiro horário do próximo dia útil
      if (businessDay.type === "O") {
        return setMinutes(setHours(nextDate, 8), 0);
      }
      
      const startHour = parse(businessDay.hr1, "HH:mm", nextDate);
      return setMinutes(
        setHours(nextDate, startHour.getHours()),
        startHour.getMinutes()
      );
    }
    
    nextDate = addDays(nextDate, 1);
    attempts++;
  }
  
  // Fallback: próximo dia às 8h
  return setMinutes(setHours(addDays(date, 1), 8), 0);
}; 