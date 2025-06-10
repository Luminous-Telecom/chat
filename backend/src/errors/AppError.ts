class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }

  static readonly ERRORS = {
    // Erros de autenticação
    ERR_NO_WHATSAPP_SESSION: {
      message: "No WhatsApp session found",
      statusCode: 404
    },
    ERR_NO_TICKET_FOUND: {
      message: "No ticket found",
      statusCode: 404
    },
    ERR_TICKET_CLOSED: {
      message: "Ticket is closed",
      statusCode: 400
    },

    // Erros de mensagem
    ERR_MESSAGE_BODY_REQUIRED: {
      message: "Message body is required",
      statusCode: 400
    },
    ERR_INVALID_MESSAGE_LENGTH: {
      message: "Message length must be between 1 and 4096 characters",
      statusCode: 400
    },
    ERR_SENDING_WAPP_MSG: {
      message: "Error sending WhatsApp message",
      statusCode: 500
    },

    // Erros de botões
    ERR_INVALID_BUTTONS: {
      message: "Invalid buttons array",
      statusCode: 400
    },
    ERR_TOO_MANY_BUTTONS: {
      message: "Maximum of 3 buttons allowed",
      statusCode: 400
    },
    ERR_INVALID_BUTTON: {
      message: "Invalid button: id and text are required",
      statusCode: 400
    },
    ERR_INVALID_BUTTON_LENGTH: {
      message: "Button id and text must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_BUTTON_TYPE: {
      message: "Invalid button type. Must be 'reply', 'url', or 'quick_reply'",
      statusCode: 400
    },
    ERR_BUTTON_URL_REQUIRED: {
      message: "URL is required for URL type buttons",
      statusCode: 400
    },
    ERR_INVALID_BUTTON_URL: {
      message: "Invalid button URL",
      statusCode: 400
    },
    ERR_INVALID_BUTTON_IMAGE_URL: {
      message: "Invalid button image URL",
      statusCode: 400
    },

    // Erros de lista
    ERR_INVALID_LIST: {
      message: "Invalid list: title, buttonText and items are required",
      statusCode: 400
    },
    ERR_TOO_MANY_LIST_ITEMS: {
      message: "Maximum of 10 list items allowed",
      statusCode: 400
    },
    ERR_INVALID_LIST_ITEM: {
      message: "Invalid list item: id and title are required",
      statusCode: 400
    },
    ERR_INVALID_LIST_TITLE_LENGTH: {
      message: "List title and button text must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_LIST_ITEM_LENGTH: {
      message: "List item id and title must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_LIST_ITEM_DESCRIPTION_LENGTH: {
      message: "List item description must be between 1 and 1024 characters",
      statusCode: 400
    },
    ERR_INVALID_LIST_ITEM_IMAGE_URL: {
      message: "Invalid list item image URL",
      statusCode: 400
    },

    // Erros de carrossel
    ERR_INVALID_CAROUSEL: {
      message: "Invalid carousel: title and items are required",
      statusCode: 400
    },
    ERR_TOO_MANY_CAROUSEL_ITEMS: {
      message: "Maximum of 10 carousel items allowed",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEM: {
      message: "Invalid carousel item: id, title and imageUrl are required",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_TITLE_LENGTH: {
      message: "Carousel title must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_DESCRIPTION_LENGTH: {
      message: "Carousel description must be between 1 and 1024 characters",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEM_LENGTH: {
      message: "Carousel item id and title must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEM_DESCRIPTION_LENGTH: {
      message: "Carousel item description must be between 1 and 1024 characters",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEM_IMAGE_URL: {
      message: "Invalid carousel item image URL",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEMS_COUNT: {
      message: "Carousel must have between 1 and 10 items",
      statusCode: 400
    },
    ERR_INVALID_CAROUSEL_ITEM_BUTTONS_COUNT: {
      message: "Carousel item must have between 1 and 3 buttons",
      statusCode: 400
    },

    // Erros de localização
    ERR_INVALID_LOCATION: {
      message: "Invalid location: latitude and longitude are required",
      statusCode: 400
    },
    ERR_INVALID_LATITUDE: {
      message: "Invalid latitude: must be between -90 and 90",
      statusCode: 400
    },
    ERR_INVALID_LONGITUDE: {
      message: "Invalid longitude: must be between -180 and 180",
      statusCode: 400
    },
    ERR_INVALID_LOCATION_NAME_LENGTH: {
      message: "Location name must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_LOCATION_ADDRESS_LENGTH: {
      message: "Location address must be between 1 and 1024 characters",
      statusCode: 400
    },

    // Erros de contato
    ERR_INVALID_CONTACT: {
      message: "Invalid contact: name and number are required",
      statusCode: 400
    },
    ERR_INVALID_CONTACT_NUMBER: {
      message: "Invalid contact number: must be between 10 and 15 digits",
      statusCode: 400
    },
    ERR_INVALID_CONTACT_EMAIL: {
      message: "Invalid contact email",
      statusCode: 400
    },
    ERR_INVALID_CONTACT_NAME_LENGTH: {
      message: "Contact name must be between 1 and 256 characters",
      statusCode: 400
    },

    // Erros de respostas rápidas
    ERR_INVALID_QUICK_REPLIES: {
      message: "Invalid quick replies array",
      statusCode: 400
    },
    ERR_TOO_MANY_QUICK_REPLIES: {
      message: "Maximum of 3 quick replies allowed",
      statusCode: 400
    },
    ERR_INVALID_QUICK_REPLY: {
      message: "Invalid quick reply: must be a non-empty string",
      statusCode: 400
    },
    ERR_INVALID_QUICK_REPLY_LENGTH: {
      message: "Quick reply must be between 1 and 256 characters",
      statusCode: 400
    },
    ERR_INVALID_QUICK_REPLIES_COUNT: {
      message: "Must have between 1 and 3 quick replies",
      statusCode: 400
    },

    // Erros de mídia
    ERR_MEDIA_DIR_INIT: {
      message: "Error initializing media directory",
      statusCode: 500
    },
    ERR_MEDIA_INFO: {
      message: "Error getting media information",
      statusCode: 500
    },
    ERR_MEDIA_COMPRESSION: {
      message: "Error compressing media file",
      statusCode: 500
    },
    ERR_IMAGE_COMPRESSION: {
      message: "Error compressing image",
      statusCode: 500
    },
    ERR_VIDEO_COMPRESSION: {
      message: "Error compressing video",
      statusCode: 500
    },
    ERR_AUDIO_COMPRESSION: {
      message: "Error compressing audio",
      statusCode: 500
    },
    ERR_MEDIA_TOO_LARGE: {
      message: "Media file is too large",
      statusCode: 400
    },
    ERR_NO_MEDIA_MESSAGE: {
      message: "No media message found",
      statusCode: 400
    },
    ERR_NO_MEDIA_KEY: {
      message: "No media key found",
      statusCode: 400
    },
    ERR_MEDIA_DOWNLOAD: {
      message: "Error downloading media",
      statusCode: 500
    },
    ERR_MEDIA_NOT_FOUND: {
      message: "Media file not found",
      statusCode: 404
    },
    ERR_MEDIA_DELETE: {
      message: "Error deleting media file",
      statusCode: 500
    },
    ERR_MEDIA_UPLOAD: {
      message: "Error uploading media file",
      statusCode: 500
    },
    ERR_MEDIA_METADATA: {
      message: "Error getting media metadata",
      statusCode: 500
    },
    ERR_MEDIA_TYPE_NOT_SUPPORTED: {
      message: "Media type not supported",
      statusCode: 400
    },
    ERR_MEDIA_QUEUE_FULL: {
      message: "Media processing queue is full",
      statusCode: 503
    },
    ERR_MEDIA_CACHE_FULL: {
      message: "Media cache is full",
      statusCode: 503
    },
    ERR_MEDIA_PROCESSING: {
      message: "Error processing media file",
      statusCode: 500
    },
    ERR_MEDIA_CONVERSION: {
      message: "Error converting media file",
      statusCode: 500
    },
    ERR_MEDIA_STREAM: {
      message: "Error streaming media file",
      statusCode: 500
    },
    ERR_MEDIA_FORMAT: {
      message: "Invalid media format",
      statusCode: 400
    },
    ERR_MEDIA_DURATION: {
      message: "Invalid media duration",
      statusCode: 400
    },
    ERR_MEDIA_DIMENSIONS: {
      message: "Invalid media dimensions",
      statusCode: 400
    },
    ERR_MEDIA_BITRATE: {
      message: "Invalid media bitrate",
      statusCode: 400
    },
    ERR_MEDIA_CODEC: {
      message: "Unsupported media codec",
      statusCode: 400
    },
    ERR_MEDIA_RESOLUTION: {
      message: "Invalid media resolution",
      statusCode: 400
    },
    ERR_MEDIA_ASPECT_RATIO: {
      message: "Invalid media aspect ratio",
      statusCode: 400
    },
    ERR_MEDIA_FRAME_RATE: {
      message: "Invalid media frame rate",
      statusCode: 400
    },
    ERR_MEDIA_SAMPLE_RATE: {
      message: "Invalid media sample rate",
      statusCode: 400
    },
    ERR_MEDIA_CHANNELS: {
      message: "Invalid media channels",
      statusCode: 400
    },
    ERR_MEDIA_QUALITY: {
      message: "Invalid media quality",
      statusCode: 400
    },
    ERR_MEDIA_SIZE: {
      message: "Invalid media size",
      statusCode: 400
    },
    ERR_MEDIA_NAME: {
      message: "Invalid media name",
      statusCode: 400
    },
    ERR_MEDIA_EXTENSION: {
      message: "Invalid media extension",
      statusCode: 400
    },
    ERR_MEDIA_MIME: {
      message: "Invalid media MIME type",
      statusCode: 400
    },
    ERR_MEDIA_HASH: {
      message: "Error calculating media hash",
      statusCode: 500
    },
    ERR_MEDIA_PERMISSIONS: {
      message: "Insufficient permissions for media operation",
      statusCode: 403
    },
    ERR_MEDIA_STORAGE: {
      message: "Error storing media file",
      statusCode: 500
    },
    ERR_MEDIA_RETRIEVAL: {
      message: "Error retrieving media file",
      statusCode: 500
    },
    ERR_MEDIA_VALIDATION: {
      message: "Error validating media file",
      statusCode: 400
    },
    ERR_MEDIA_TRANSFORMATION: {
      message: "Error transforming media file",
      statusCode: 500
    },
    ERR_MEDIA_OPTIMIZATION: {
      message: "Error optimizing media file",
      statusCode: 500
    },
    ERR_MEDIA_ENCRYPTION: {
      message: "Error encrypting media file",
      statusCode: 500
    },
    ERR_MEDIA_DECRYPTION: {
      message: "Error decrypting media file",
      statusCode: 500
    },
    ERR_MEDIA_SIGNATURE: {
      message: "Invalid media signature",
      statusCode: 400
    },
    ERR_MEDIA_INTEGRITY: {
      message: "Media file integrity check failed",
      statusCode: 400
    },
    ERR_MEDIA_CORRUPTION: {
      message: "Media file is corrupted",
      statusCode: 400
    },
    ERR_MEDIA_VERSION: {
      message: "Unsupported media version",
      statusCode: 400
    },
    ERR_MEDIA_COMPATIBILITY: {
      message: "Media file is not compatible",
      statusCode: 400
    },
    ERR_MEDIA_LIMIT: {
      message: "Media limit exceeded",
      statusCode: 400
    },
    ERR_MEDIA_QUOTA: {
      message: "Media quota exceeded",
      statusCode: 400
    },
    ERR_MEDIA_EXPIRATION: {
      message: "Media file has expired",
      statusCode: 400
    },
    ERR_MEDIA_BLOCKED: {
      message: "Media file is blocked",
      statusCode: 403
    },
    ERR_MEDIA_RESTRICTED: {
      message: "Media file is restricted",
      statusCode: 403
    },
    ERR_MEDIA_POLICY: {
      message: "Media file violates policy",
      statusCode: 403
    },
    ERR_MEDIA_COMPLIANCE: {
      message: "Media file does not comply with requirements",
      statusCode: 400
    },
    ERR_MEDIA_SECURITY: {
      message: "Media file security check failed",
      statusCode: 400
    },
    ERR_MEDIA_SCAN: {
      message: "Media file scan failed",
      statusCode: 400
    },
    ERR_MEDIA_VIRUS: {
      message: "Media file contains virus",
      statusCode: 400
    },
    ERR_MEDIA_MALWARE: {
      message: "Media file contains malware",
      statusCode: 400
    },
    ERR_MEDIA_SPAM: {
      message: "Media file is spam",
      statusCode: 400
    },
    ERR_MEDIA_ABUSE: {
      message: "Media file is abusive",
      statusCode: 400
    },
    ERR_MEDIA_OFFENSIVE: {
      message: "Media file is offensive",
      statusCode: 400
    },
    ERR_MEDIA_ILLEGAL: {
      message: "Media file is illegal",
      statusCode: 400
    },
    ERR_MEDIA_COPYRIGHT: {
      message: "Media file violates copyright",
      statusCode: 400
    },
    ERR_MEDIA_LICENSE: {
      message: "Media file license is invalid",
      statusCode: 400
    },
    ERR_MEDIA_RIGHTS: {
      message: "Media file rights are not granted",
      statusCode: 400
    },
    ERR_MEDIA_TERMS: {
      message: "Media file violates terms of service",
      statusCode: 400
    },
    ERR_MEDIA_AGREEMENT: {
      message: "Media file violates user agreement",
      statusCode: 400
    },
    ERR_MEDIA_POLICY_VIOLATION: {
      message: "Media file violates policy",
      statusCode: 400
    },
    ERR_MEDIA_GUIDELINES: {
      message: "Media file violates guidelines",
      statusCode: 400
    },
    ERR_MEDIA_RULES: {
      message: "Media file violates rules",
      statusCode: 400
    },
    ERR_MEDIA_STANDARDS: {
      message: "Media file violates standards",
      statusCode: 400
    },
    ERR_MEDIA_REQUIREMENTS: {
      message: "Media file does not meet requirements",
      statusCode: 400
    },
    ERR_MEDIA_SPECIFICATIONS: {
      message: "Media file does not meet specifications",
      statusCode: 400
    },
    ERR_MEDIA_CONSTRAINTS: {
      message: "Media file violates constraints",
      statusCode: 400
    },
    ERR_MEDIA_LIMITATIONS: {
      message: "Media file exceeds limitations",
      statusCode: 400
    },
    ERR_MEDIA_RESTRICTIONS: {
      message: "Media file violates restrictions",
      statusCode: 400
    },
    ERR_MEDIA_BOUNDARIES: {
      message: "Media file exceeds boundaries",
      statusCode: 400
    },
    ERR_MEDIA_THRESHOLDS: {
      message: "Media file exceeds thresholds",
      statusCode: 400
    },
    ERR_MEDIA_CAPACITY: {
      message: "Media file exceeds capacity",
      statusCode: 400
    },
    ERR_MEDIA_VOLUME: {
      message: "Media file exceeds volume",
      statusCode: 400
    },
    ERR_MEDIA_SPACE: {
      message: "Media file exceeds space",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_LIMIT: {
      message: "Media storage limit exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_QUOTA: {
      message: "Media storage quota exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_CAPACITY: {
      message: "Media storage capacity exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SPACE: {
      message: "Media storage space exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_VOLUME: {
      message: "Media storage volume exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_BOUNDARY: {
      message: "Media storage boundary exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_THRESHOLD: {
      message: "Media storage threshold exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_LIMITATION: {
      message: "Media storage limitation exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_RESTRICTION: {
      message: "Media storage restriction exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_CONSTRAINT: {
      message: "Media storage constraint exceeded",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_REQUIREMENT: {
      message: "Media storage requirement not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SPECIFICATION: {
      message: "Media storage specification not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_STANDARD: {
      message: "Media storage standard not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_GUIDELINE: {
      message: "Media storage guideline not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_RULE: {
      message: "Media storage rule not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_POLICY: {
      message: "Media storage policy not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_TERM: {
      message: "Media storage term not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_AGREEMENT: {
      message: "Media storage agreement not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_LICENSE: {
      message: "Media storage license not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_RIGHT: {
      message: "Media storage right not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_COPYRIGHT: {
      message: "Media storage copyright not met",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_ILLEGAL: {
      message: "Media storage illegal",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_OFFENSIVE: {
      message: "Media storage offensive",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_ABUSIVE: {
      message: "Media storage abusive",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SPAM: {
      message: "Media storage spam",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_MALWARE: {
      message: "Media storage malware",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_VIRUS: {
      message: "Media storage virus",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SCAN: {
      message: "Media storage scan failed",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SECURITY: {
      message: "Media storage security check failed",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_COMPLIANCE: {
      message: "Media storage compliance check failed",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_POLICY_VIOLATION: {
      message: "Media storage policy violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_GUIDELINE_VIOLATION: {
      message: "Media storage guideline violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_RULE_VIOLATION: {
      message: "Media storage rule violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_STANDARD_VIOLATION: {
      message: "Media storage standard violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SPECIFICATION_VIOLATION: {
      message: "Media storage specification violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_REQUIREMENT_VIOLATION: {
      message: "Media storage requirement violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_CONSTRAINT_VIOLATION: {
      message: "Media storage constraint violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_RESTRICTION_VIOLATION: {
      message: "Media storage restriction violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_LIMITATION_VIOLATION: {
      message: "Media storage limitation violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_THRESHOLD_VIOLATION: {
      message: "Media storage threshold violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_BOUNDARY_VIOLATION: {
      message: "Media storage boundary violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_VOLUME_VIOLATION: {
      message: "Media storage volume violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_SPACE_VIOLATION: {
      message: "Media storage space violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_CAPACITY_VIOLATION: {
      message: "Media storage capacity violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_QUOTA_VIOLATION: {
      message: "Media storage quota violation",
      statusCode: 400
    },
    ERR_MEDIA_STORAGE_LIMIT_VIOLATION: {
      message: "Media storage limit violation",
      statusCode: 400
    },

    // Erros de mensagem interativa
    ERR_INVALID_INTERACTIVE_MESSAGE: {
      message: "Invalid interactive message: must have body, buttons, list, location, or contact",
      statusCode: 400
    }
  };

  static getError(errorKey: keyof typeof AppError.ERRORS): AppError {
    const error = AppError.ERRORS[errorKey];
    return new AppError(error.message, error.statusCode);
  }
}

export default AppError;
