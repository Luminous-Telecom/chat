import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Tenant from "./Tenant";

interface Schedule {
  dayOfWeek: number;
  startTime: number;
  endTime: number;
}

interface BusinessHoursAttributes {
  id: number;
  name: string;
  schedules: Schedule[];
  status: "ACTIVE" | "INACTIVE";
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
}

@Table
class BusinessHours extends Model<BusinessHoursAttributes> implements BusinessHoursAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @Column
  name!: string;

  @Column(DataType.JSONB)
  schedules!: Schedule[];

  @Column(DataType.ENUM("ACTIVE", "INACTIVE"))
  status!: "ACTIVE" | "INACTIVE";

  @ForeignKey(() => Tenant)
  @Column
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}

export default BusinessHours; 