import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PolarService } from './polar.service';

@Controller('polar')
export class PolarController {
  constructor(private readonly polarService: PolarService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('polar-signature') polarSignature?: string,
    @Headers('x-polar-signature') xPolarSignature?: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body no disponible. Habilita rawBody en NestFactory.create().',
      );
    }

    await this.polarService.handleWebhook(
      rawBody,
      polarSignature || xPolarSignature,
    );
    return { received: true };
  }
}
