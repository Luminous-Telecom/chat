/**
 * Utility functions for data validation
 */

/**
 * Validates if a string is a valid URL
 * @param url The URL to validate
 * @returns boolean indicating if the URL is valid
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates if a string is a valid phone number
 * @param number The phone number to validate
 * @returns boolean indicating if the number is valid
 */
export const isValidPhoneNumber = (number: string): boolean => {
  const numberRegex = /^[0-9]{10,15}$/;
  return numberRegex.test(number);
};

/**
 * Validates if a string is a valid email address
 * @param email The email to validate
 * @returns boolean indicating if the email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates if a string is a valid latitude value
 * @param lat The latitude to validate
 * @returns boolean indicating if the latitude is valid
 */
export const isValidLatitude = (lat: number): boolean => {
  return lat >= -90 && lat <= 90;
};

/**
 * Validates if a string is a valid longitude value
 * @param lng The longitude to validate
 * @returns boolean indicating if the longitude is valid
 */
export const isValidLongitude = (lng: number): boolean => {
  return lng >= -180 && lng <= 180;
};

/**
 * Validates if a string is a valid media type
 * @param type The media type to validate
 * @returns boolean indicating if the media type is valid
 */
export const isValidMediaType = (type: string): boolean => {
  return ['image', 'video', 'audio', 'document'].includes(type);
};

/**
 * Validates if a string is a valid button type
 * @param type The button type to validate
 * @returns boolean indicating if the button type is valid
 */
export const isValidButtonType = (type: string): boolean => {
  return ['reply', 'url', 'quick_reply'].includes(type);
};

/**
 * Validates if an array of strings has valid lengths
 * @param array The array to validate
 * @param minLength Minimum length for each string
 * @param maxLength Maximum length for each string
 * @returns boolean indicating if all strings in the array have valid lengths
 */
export const hasValidStringLengths = (
  array: string[],
  minLength: number = 1,
  maxLength: number = 1024
): boolean => {
  return array.every(str => 
    typeof str === 'string' && 
    str.length >= minLength && 
    str.length <= maxLength
  );
};

/**
 * Validates if a number is within a range
 * @param num The number to validate
 * @param min Minimum value
 * @param max Maximum value
 * @returns boolean indicating if the number is within the range
 */
export const isWithinRange = (
  num: number,
  min: number,
  max: number
): boolean => {
  return num >= min && num <= max;
};

/**
 * Validates if an array has a valid length
 * @param array The array to validate
 * @param minLength Minimum length
 * @param maxLength Maximum length
 * @returns boolean indicating if the array has a valid length
 */
export const hasValidArrayLength = (
  array: any[],
  minLength: number = 1,
  maxLength: number = 10
): boolean => {
  return array.length >= minLength && array.length <= maxLength;
};

/**
 * Validates if a message has a valid length
 * @param message The message to validate
 * @returns boolean indicating if the message length is valid
 */
export const isValidMessageLength = (message: string): boolean => {
  return typeof message === 'string' && message.length >= 1 && message.length <= 4096;
};

/**
 * Validates if a list has valid properties
 * @param list The list to validate
 * @returns boolean indicating if the list is valid
 */
export const isValidList = (list: { title: string; buttonText: string; items: any[] }): boolean => {
  return !!(
    list &&
    typeof list.title === 'string' &&
    typeof list.buttonText === 'string' &&
    Array.isArray(list.items) &&
    hasValidStringLengths([list.title, list.buttonText], 1, 256)
  );
};

/**
 * Validates if a location has valid properties
 * @param location The location to validate
 * @returns boolean indicating if the location is valid
 */
export const isValidLocation = (location: { latitude: number; longitude: number }): boolean => {
  return !!(
    location &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    isValidLatitude(location.latitude) &&
    isValidLongitude(location.longitude)
  );
};

/**
 * Validates if a contact has valid properties
 * @param contact The contact to validate
 * @returns boolean indicating if the contact is valid
 */
export const isValidContact = (contact: { name: string; number: string; email?: string }): boolean => {
  return !!(
    contact &&
    typeof contact.name === 'string' &&
    typeof contact.number === 'string' &&
    hasValidStringLengths([contact.name], 1, 256) &&
    isValidPhoneNumber(contact.number) &&
    (!contact.email || isValidEmail(contact.email))
  );
};

/**
 * Validates if a media URL is valid
 * @param url The media URL to validate
 * @returns boolean indicating if the media URL is valid
 */
export const isValidMediaUrl = (url: string): boolean => {
  return isValidURL(url);
};

/**
 * Validates if a footer has a valid length
 * @param footer The footer to validate
 * @returns boolean indicating if the footer length is valid
 */
export const isValidFooterLength = (footer: string): boolean => {
  return hasValidStringLengths([footer], 1, 1024);
};

/**
 * Validates if the number of buttons is valid
 * @param buttons The buttons array to validate
 * @returns boolean indicating if the number of buttons is valid
 */
export const isValidButtonsCount = (buttons: any[]): boolean => {
  return hasValidArrayLength(buttons, 1, 3);
};

/**
 * Validates if the number of list items is valid
 * @param items The list items array to validate
 * @returns boolean indicating if the number of list items is valid
 */
export const isValidListItemsCount = (items: any[]): boolean => {
  return hasValidArrayLength(items, 1, 10);
}; 