import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
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

  await app.listen(process.env.PORT || 3000);

  console.log(`SERVER RUNNING ON ${process.env.PORT || 3000}`);
}

bootstrap();
