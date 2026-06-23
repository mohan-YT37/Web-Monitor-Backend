import { LogAction, LogResourceType } from 'src/common/enum/log.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 50 })
  public_id!: string;

  @BeforeInsert()
  generatePublicId() {
    if (!this.public_id) {
      this.public_id = uuidv4().replace(/-/g, '');
    }
  }

  @Column({ nullable: true })
  user_id!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  user_name!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  user_email!: string;

  @Column({
    type: 'enum',
    enum: [
      'viewed',
      'created',
      'updated',
      'deleted',
      'copied',
      'shared_link',
      'shared_users',
      'moved',
    ],
  })
  action!: LogAction;

  @Column({ type: 'enum', enum: ['item', 'folder'] })
  resource_type!: LogResourceType;

  @Column({ nullable: true })
  resource_id!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resource_public_id!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  resource_name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn()
  created_at!: Date;
}