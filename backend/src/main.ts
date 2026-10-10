import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const openApi = new DocumentBuilder()
    .setTitle('Piplup API')
    .setDescription('API do projeto integrador.')
    .setVersion('1.0.0')
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi));

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
await bootstrap();
