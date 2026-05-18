import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { MonitorHistory } from './monitor-history.entity';
import { BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('monitors')
export class Monitor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    unique: true,
    length: 30,
  })
  public_id!: string;

  @BeforeInsert()
  generatePublicId() {
    this.public_id = uuidv4().replace(/-/g, '').slice(0, 30);
  }

  @Column({type: 'varchar', length: 100})
  name!: string;

  @Column({type: 'varchar', length: 255})
  url!: string;

  @Column({
    default: 'UP',
  })
  status!: string;

  @Column({
    default: false,
  })
  paused!: boolean;

  @Column({
    default: 5,
  })
  interval!: number;

  @Column({
    nullable: true,
  })
  response_time!: number;

  @Column({
    nullable: true,
  })
  avg_response!: number;

  @Column({
    nullable: true,
  })
  min_response!: number;

  @Column({
    nullable: true,
  })
  max_response!: number;

  @Column({
    default: 100,
  })
  uptime_percentage!: number;

  @Column({
    default: 0,
  })
  total_checks!: number;

  @Column({
    default: 0,
  })
  success_checks!: number;

  @Column({
    default: 0,
  })
  failed_checks!: number;

  @Column({
    nullable: true,
  })
  ssl_expiry_date!: string;

  @Column({
    nullable: true,
  })
  validation_error!: string;

  @Column({
    nullable: true,
  })
  valid_from!: string;

  @Column({
    nullable: true,
  })
  ssl_days_left!: number;

  @Column({
    nullable: true,
  })
  domain_expiry_date!: string;

  @Column({
    nullable: true,
  })
  domain_days_left!: number;

  @Column({
    default: false,
  })
  ssl_enabled!: boolean;

  @Column({
    nullable: true,
  })
  ssl_status!: string;

  @Column({
    default: false,
  })
  domain_enabled!: boolean;

  @Column({
    nullable: true,
  })
  last_checked!: string;

  @Column({
    nullable: true,
  })
  last_error!: string;

  @Column({
    nullable: true,
  })
  ip_address!: string;

  @Column({
    nullable: true,
  })
  last_down_at!: string;

  @Column({
    nullable: true,
  })
  last_up_at!: string;

  @Column({
    nullable: true,
  })
  notification_email!: string;

  @OneToMany(() => MonitorHistory, (history) => history.monitor)
  history!: MonitorHistory[];
}
