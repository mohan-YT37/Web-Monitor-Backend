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
  });

  app.useGlobalPipes(
    //This only works when DTO validation fails. It will not work when there is an error in the controller or service.
    new ValidationPipe({
      whitelist: true, // removes extra fields
      forbidNonWhitelisted: false, // it onlyallow DTO based feilds only
      transform: true,
      exceptionFactory: (errors) => {
        const formateErrors =
          errors?.map((err) => Object.values(err.constraints || {})).flat() ||
          [];
        console.log('formateErrors', formateErrors);
        return new BadRequestException({
          status: false,
          data: [],
          message: 'Validation error',
          errors: formateErrors,
        });
      },
    }),
  );

  await app.listen(3000);

  console.log('SERVER RUNNING');
}

bootstrap();
