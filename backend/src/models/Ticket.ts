import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AutoIncrement,
  Default,
  // AfterCreate,
  DataType,
  AllowNull,
  BelongsToMany,
  BeforeCreate,
  BeforeUpdate,
} from "sequelize-typescript";

import { format } from "date-fns";
import Contact from "./Contact";
import Message from "./Message";
import User from "./User";
import Whatsapp from "./Whatsapp";
import AutoReply from "./AutoReply";
import StepsReply from "./StepsReply";
import Queue from "./Queue";
// import ShowStepAutoReplyMessageService from "../services/AutoReplyServices/ShowStepAutoReplyMessageService";
import Tenant from "./Tenant";
import MessagesOffLine from "./MessageOffLine";
import ChatFlow from "./ChatFlow";
import TicketObservation from "./TicketObservation";
import TicketParticipant from "./TicketParticipant";
import Tag from "./Tag";
import TicketTag from "./TicketTag";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Default(null)
  @AllowNull
  @Column
  lastMessageAck: number;

  @Default(null)
  @AllowNull
  @Column
  lastMessageFromMe: boolean;

  @Column
  channel: string;

  @Default(false)
  @Column
  answered: boolean;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default(false)
  @Column
  isActiveDemand: boolean;

  @Default(false)
  @Column
  isFarewellMessage: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column(DataType.DATE)
  lastInteractionBot: Date;

  @Column(DataType.INTEGER)
  botRetries: number;

  @Column(DataType.BIGINT)
  closedAt: number;

  @Column(DataType.BIGINT)
  lastMessageAt: number;

  @Column(DataType.BIGINT)
  startedAttendanceAt: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @HasMany(() => Message)
  messages: Message[];

  @ForeignKey(() => AutoReply)
  @Column
  autoReplyId: number;

  @BelongsTo(() => AutoReply)
  autoReply: AutoReply;

  @ForeignKey(() => StepsReply)
  @Column
  stepAutoReplyId: number;

  @BelongsTo(() => StepsReply)
  stepsReply: StepsReply;

  @ForeignKey(() => ChatFlow)
  @Column
  chatFlowId: number;

  @BelongsTo(() => ChatFlow)
  chatFlow: ChatFlow;

  @Default(null)
  @AllowNull
  @Column(DataType.INTEGER)
  stepChatFlow: number;

  @ForeignKey(() => Queue)
  @Default(null)
  @AllowNull
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => Tenant)
  @Column
  tenantId: number;

  @Default(null)
  @Column(DataType.VIRTUAL)
  isTransference: string | boolean | null;

  @Default(null)
  @Column(DataType.VIRTUAL)
  isCreated: boolean | null;

  @Default([])
  @Column(DataType.VIRTUAL)
  scheduledMessages: Message[];

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @HasMany(() => MessagesOffLine)
  messagesOffLine: MessagesOffLine[];

  @Default(null)
  @AllowNull
  @Column(DataType.JSONB)
  // eslint-disable-next-line @typescript-eslint/ban-types
  apiConfig: object;

  @HasMany(() => TicketObservation)
  observations: TicketObservation[];

  @HasMany(() => TicketParticipant)
  participants: TicketParticipant[];

  @BelongsToMany(() => Tag, () => TicketTag, "ticketId", "tagId")
  tags: Tag[];

  @Column
  protocol: string;

  @Default(false)
  @Column
  isPinned: boolean;

  @BeforeCreate
  @BeforeUpdate
  static generateProtocol(instance: Ticket) {
    if (!instance.protocol) {
      const date = instance.createdAt || new Date();
      const formatDate = format(new Date(date), "yyyyddMMHHmmss");
      const id = instance.id || Math.floor(Math.random() * 1000000);
      instance.protocol = `${formatDate}${id}`;
    }
  }
}

export default Ticket;
