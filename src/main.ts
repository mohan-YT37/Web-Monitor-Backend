// main.ts
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { seedSuperAdmin } from './seed-super-admin';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://web-monitor-frontend-phi.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errors) => {
        const formateErrors =
          errors?.map((err) => Object.values(err.constraints || {})).flat() ||
          [];

        return new BadRequestException({
          status: false,
          data: [],
          message: 'Validation error',
          errors: formateErrors,
        });
      },
    }),
  );

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  await seedSuperAdmin(app);
  await app.listen(process.env.PORT || 3000);

  console.log(`SERVER RUNNING ON ${process.env.PORT || 3000}`);
}

bootstrap();
