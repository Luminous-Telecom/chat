import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  HasMany,
  BeforeCreate,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  DataType,
} from "sequelize-typescript";
import Campaign from "./Campaign";
import CampaignContacts from "./CampaignContacts";
import ContactCustomField from "./ContactCustomField";

// import Message from "./Message";
import Tags from "./Tag";
import Tenant from "./Tenant";
import Ticket from "./Ticket";
import ContactTag from "./ContactTag";
import User from "./User";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @AllowNull(true)
  @Column
  number: string;

  @AllowNull(true)
  @Default(null)
  @Column
  email: string;

  @Column(DataType.TEXT)
  profilePicUrl: string;

  @AllowNull(true)
  @Default(null)
  @Column
  pushname: string;

  @AllowNull(true)
  @Default(null)
  @Column
  telegramId: string;

  @AllowNull(true)
  @Default(null)
  @Column
  messengerId: string;

  @AllowNull(true)
  @Default(null)
  @Column
  instagramPK: number;

  @Default(false)
  @Column
  isUser: boolean;

  @Default(false)
  @Column
  isWAContact: boolean;

  @Default(false)
  @Column
  isGroup: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @BelongsToMany(() => Tags, () => ContactTag, "contactId", "tagId")
  tags: Tags[];



  @HasMany(() => CampaignContacts)
  campaignContacts: CampaignContacts[];

  @BelongsToMany(
    () => Campaign,
    () => CampaignContacts,
    "contactId",
    "campaignId"
  )
  campaign: Campaign[];

  @ForeignKey(() => Tenant)
  @Column
  tenantId: number;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;
}

export default Contact;
