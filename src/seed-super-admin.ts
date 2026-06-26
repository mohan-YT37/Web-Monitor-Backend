import { INestApplicationContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from './roles/entities/role.entity';
import { User } from './users/entities/user.entity';
import { PermissionsService } from './permissions/permissions.service';

export async function seedSuperAdmin(app: INestApplicationContext) {
  const roleRepo = app.get(getRepositoryToken(Role));
  const userRepo = app.get(getRepositoryToken(User));
  const permissionsService = app.get(PermissionsService);

  // 1. Role
  let role = await roleRepo.findOne({ where: { value: 'super_admin' } });
  if (!role) {
    role = roleRepo.create({ name: 'Super Admin', is_system_role: true });
    role = await roleRepo.save(role);
    await permissionsService.assignDefaultPermissions(role);
    console.log('Super Admin role created');
  } else {
    console.log('Super Admin role already exists, skipping');
  }

  // 2. User
  const existingUser = await userRepo.findOne({
    where: { role: 'super_admin' },
  });
  if (existingUser) {
    console.log('Super Admin user already exists, skipping');
    return;
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD missing in .env, skipping user seed',
    );
    return;
  }

  const user = userRepo.create({
    username: process.env.SUPER_ADMIN_USERNAME || 'Super Admin',
    email: email.toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: role.value,
  });

  await userRepo.save(user);
  console.log(`Super Admin user created: ${email}`);
}
