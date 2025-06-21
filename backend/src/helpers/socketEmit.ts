import { getIO } from "../libs/socket";

type Events =
  | "chat:create"
  | "chat:delete"
  | "chat:update"
  | "chat:ack"
  | "chat:messagesRead"
  | "ticket:update"
  | "ticket:create"
  | "contact:update"
  | "contact:delete"
  | "notification:new";

interface ObjEvent {
  tenantId: number | string;
  type: Events;
  // eslint-disable-next-line @typescript-eslint/ban-types
  payload: object;
}

const emitEvent = ({ tenantId, type, payload }: ObjEvent): void => {
  const io = getIO();
  let eventChannel = `${tenantId}:ticketList`;

  // CORREÇÃO: Apenas chat:create usa o canal tenant:appMessage
  // chat:ack precisa ir para o canal ticketList onde o frontend está escutando
  if (type === "chat:create") {
    // Emitir para o canal específico que o frontend está escutando para novas mensagens
    io.emit(`tenant:${tenantId}:appMessage`, {
      action: "create",
      message: payload,
      ticket: (payload as any)?.ticket,
      contact: (payload as any)?.ticket?.contact,
    });
    
    return;
  }

  if (type.indexOf("contact:") !== -1) {
    eventChannel = `${tenantId}:contactList`;
  }

  io.to(tenantId.toString()).emit(eventChannel, {
    type,
    payload,
  });
};

export default emitEvent;
