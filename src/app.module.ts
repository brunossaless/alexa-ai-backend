import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlexaAiService } from './alexa-ai.service';
import { AlexaSkillService } from './alexa-skill.service';
import { AlexaUserAccessService } from './alexa-user-access.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [AlexaAiService, AlexaUserAccessService, AlexaSkillService],
})
export class AppModule implements NestModule {
  constructor(private readonly alexaSkill: AlexaSkillService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(...this.alexaSkill.getExpressHandlers())
      .forRoutes({ path: 'alexa', method: RequestMethod.POST });
  }
}
