import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolarService } from './polar.service';

describe('PolarService', () => {
  const baseConfig: Record<string, string> = {
    POLAR_WEBHOOK_SECRET: 'test-secret',
    POLAR_API_BASE_URL: 'https://api.polar.sh',
    FRONTEND_URL: 'http://localhost:3000',
  };

  const buildService = (overrides: Record<string, string> = {}) => {
    const config = {
      get: jest.fn((key: string) =>
        Object.prototype.hasOwnProperty.call(overrides, key)
          ? overrides[key]
          : baseConfig[key],
      ),
    } as unknown as ConfigService;

    const subscriptionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    const webhookRepo = {
      findOne: jest.fn(),
      insert: jest.fn(),
    } as any;

    const service = new PolarService(config, subscriptionRepo, webhookRepo);
    return { service, subscriptionRepo, webhookRepo };
  };

  it('validates webhook signatures', () => {
    const { service } = buildService();
    const raw = Buffer.from('{"ok":true}');
    expect(() => service.verifyWebhookSignature(raw, 'invalid')).toThrow(
      UnauthorizedException,
    );
  });

  it('fails if webhook secret is missing', () => {
    const { service } = buildService({ POLAR_WEBHOOK_SECRET: '' });
    const raw = Buffer.from('{"ok":true}');
    expect(() => service.verifyWebhookSignature(raw, 'abc')).toThrow(
      BadRequestException,
    );
  });

  it('ignores duplicate events', async () => {
    const { service, webhookRepo } = buildService();
    const raw = Buffer.from(
      JSON.stringify({
        id: 'evt_1',
        type: 'subscription.updated',
        data: { external_customer_id: '123' },
      }),
    );
    webhookRepo.findOne.mockResolvedValue({ id: 1 });
    jest.spyOn(service, 'verifyWebhookSignature').mockImplementation(() => {});
    await service.handleWebhook(raw, 'anything');
    expect(webhookRepo.insert).not.toHaveBeenCalled();
  });
});
