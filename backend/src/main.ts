import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '16kb' });
  app.enableShutdownHooks();
  if (process.env.NODE_ENV === 'development') {
    app.enableCors({
      origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  if (process.env.NODE_ENV !== 'production') {
    setupOpenApi(app);
  }

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

function setupOpenApi(app: NestExpressApplication) {
  const openApi = new DocumentBuilder()
    .setTitle('Piplup API')
    .setDescription('API do projeto integrador.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'token do Agent' },
      'agentBearer',
    )
    .build();

  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, openApi),
  );
}

await bootstrap();
