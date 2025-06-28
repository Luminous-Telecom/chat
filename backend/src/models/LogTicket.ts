import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey,
  AllowNull,
  AutoIncrement,
} from "sequelize-typescript";
import Ticket from "./Ticket";
import User from "./User";
import Queue from "./Queue";

@Table
class LogTicket extends Model<LogTicket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  type: string;

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Ticket)
  @Column(DataType.INTEGER)
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => User)
  @Default(null)
  @AllowNull
  @Column(DataType.INTEGER)
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Queue)
  @AllowNull
  @Default(null)
  @Column(DataType.INTEGER)
  queueId: number | null;

  @BelongsTo(() => Queue)
  queue: Queue;
}

export default LogTicket;
