import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Alexa skill (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      rawBody: true,
      bodyParser: false,
    });
    await app.init();
  });

  it('/alexa (POST) LaunchRequest returns 200', () => {
    return request(app.getHttpServer())
      .post('/alexa')
      .set('Content-Type', 'application/json')
      .send({
        version: '1.0',
        session: {
          new: true,
          sessionId: 'test',
          application: { applicationId: 'test' },
          attributes: {},
          user: { userId: 'test' },
        },
        context: {
          System: {
            application: { applicationId: 'test' },
            user: { userId: 'test' },
            device: { deviceId: 'test', supportedInterfaces: {} },
          },
        },
        request: {
          type: 'LaunchRequest',
          requestId: 'test',
          locale: 'pt-BR',
          timestamp: '2026-05-20T17:45:52Z',
        },
      })
      .expect(200)
      .expect((res) => {
        const speech = res.body.response.outputSpeech;
        const text = speech.text ?? speech.ssml ?? '';
        expect(text).toMatch(/assistente|inteligência/i);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
