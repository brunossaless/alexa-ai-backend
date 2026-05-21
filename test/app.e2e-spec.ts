import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Alexa skill (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.ALLOWED_ALEXA_USER_IDS = '';
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

describe('Alexa skill force test (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    process.env.ALLOWED_ALEXA_USER_IDS = '';
    process.env.ALEXA_FORCE_TEST_RESPONSE = 'true';
  });

  afterAll(() => {
    delete process.env.ALEXA_FORCE_TEST_RESPONSE;
  });

  beforeEach(async () => {
    process.env.ALLOWED_ALEXA_USER_IDS = '';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      rawBody: true,
      bodyParser: false,
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/alexa (POST) GptQueryIntent retorna "Teste funcionando"', () => {
    return request(app.getHttpServer())
      .post('/alexa')
      .set('Content-Type', 'application/json')
      .send({
        version: '1.0',
        session: {
          new: false,
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
          type: 'IntentRequest',
          requestId: 'test-intent',
          locale: 'pt-BR',
          timestamp: '2026-05-20T17:45:52Z',
          intent: {
            name: 'GptQueryIntent',
            confirmationStatus: 'NONE',
            slots: {
              query: {
                name: 'query',
                value: 'qual é a capital do Brasil',
              },
            },
          },
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.version).toBe('1.0');
        expect(res.body.response.outputSpeech).toEqual({
          type: 'PlainText',
          text: 'Teste funcionando',
        });
      });
  });
});
