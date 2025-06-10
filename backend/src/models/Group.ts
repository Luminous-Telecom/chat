import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  DataType
} from "sequelize-typescript";
import Contact from "./Contact";
import Whatsapp from "./Whatsapp";
import Tenant from "./Tenant";

@Table
class Group extends Model<Group> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  groupId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Tenant)
  @Column
  tenantId: number;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsToMany(() => Contact, () => GroupContact)
  contacts: Contact[];

  // Adicionando definições de tipo para os métodos gerados pelo Sequelize
  declare addContacts: (contacts: Contact | Contact[]) => Promise<void>;
  declare setContacts: (contacts: Contact | Contact[]) => Promise<void>;
}

@Table
class GroupContact extends Model<GroupContact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Group)
  @Column
  groupId: number;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Group;
export { GroupContact }; 