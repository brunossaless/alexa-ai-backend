import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  const http = app.getHttpAdapter().getInstance();
  http.get(
    '/health',
    (_req: unknown, res: { send: (body: string) => void }) => {
      res.send('ok');
    },
  );

  await app.listen(port);
  console.log(`🚀 Servidor Alexa AI rodando em: http://localhost:${port}`);
}
bootstrap();
