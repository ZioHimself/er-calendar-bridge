import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';

const { createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock('nodemailer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nodemailer')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      createTransport: createTransportMock,
    },
  };
});

import {
  createWithholdNotifier,
  WITHHOLD_NOTIFY_SUBJECT,
} from '../../src/notify/withhold-notifier.js';

/** Fixture title that must never appear in email body (D-09). */
const FORBIDDEN_FIXTURE_SUMMARY = 'Secret Board Meeting Q3 Offsite';

const baseSmtpConfig = {
  notifyOwnerEmail: 'owner@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpFrom: 'bridge@example.com',
  tagGuidanceUrl: undefined as string | undefined,
};

describe('createWithholdNotifier', () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    sendMailMock.mockReset();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: 'test-id' });
  });

  it('returns no-op when notifyOwnerEmail is unset (D-05)', async () => {
    const notifier = createWithholdNotifier({
      notifyOwnerEmail: undefined,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpFrom: 'bridge@example.com',
    });

    const result = await notifier.notifyWithhold({
      tier: 'internal',
      propagation: 'busy',
      dedupKey: 'uuid:busy:1',
    });

    expect(result).toEqual({ status: 'sent' });
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('returns no-op when notifyOwnerEmail is empty string (D-05)', async () => {
    const notifier = createWithholdNotifier({
      ...baseSmtpConfig,
      notifyOwnerEmail: '',
    });

    await notifier.notifyWithhold({
      tier: 'sensitive',
      propagation: 'drop',
      dedupKey: 'uuid:drop:1',
    });

    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('sends mail with fixed subject and minimal body (D-11, D-10)', async () => {
    const notifier = createWithholdNotifier(baseSmtpConfig);

    await notifier.notifyWithhold({
      tier: 'internal',
      propagation: 'busy',
      dedupKey: '550e8400-e29b-41d4-a716-446655440000:busy:1',
    });

    expect(sendMailMock).toHaveBeenCalledOnce();
    const mail = sendMailMock.mock.calls[0]![0] as {
      subject: string;
      text: string;
      to: string;
      bcc?: string;
    };

    expect(mail.subject).toBe(WITHHOLD_NOTIFY_SUBJECT);
    expect(mail.to).toBe('owner@example.com');
    expect(mail.bcc).toBeUndefined();
    expect(mail.text).toContain('busy');
    expect(mail.text).toContain('internal');
    expect(mail.text).toContain('ER-PUBLIC');
    expect(mail.text).toContain('ER-INTERNAL');
    expect(mail.text).toContain('ER-SENSITIVE');
    expect(mail.text).not.toContain(FORBIDDEN_FIXTURE_SUMMARY);
  });

  it('uses the same subject for drop propagation (D-11)', async () => {
    const notifier = createWithholdNotifier(baseSmtpConfig);

    await notifier.notifyWithhold({
      tier: 'sensitive',
      propagation: 'drop',
      dedupKey: 'uuid:drop:2',
    });

    expect(sendMailMock.mock.calls[0]![0].subject).toBe(WITHHOLD_NOTIFY_SUBJECT);
    expect(sendMailMock.mock.calls[0]![0].text).toMatch(/drop/i);
  });

  it('includes tag guidance URL when configured (D-12)', async () => {
    const url = 'https://docs.example.com/er-tags';
    const notifier = createWithholdNotifier({
      ...baseSmtpConfig,
      tagGuidanceUrl: url,
    });

    await notifier.notifyWithhold({
      tier: 'untagged',
      propagation: 'busy',
      dedupKey: 'uuid:busy:1',
    });

    expect(sendMailMock.mock.calls[0]![0].text).toContain(url);
  });

  it('omits placeholder link when tag guidance URL unset (D-12)', async () => {
    const notifier = createWithholdNotifier(baseSmtpConfig);

    await notifier.notifyWithhold({
      tier: 'untagged',
      propagation: 'busy',
      dedupKey: 'uuid:busy:1',
    });

    const text = sendMailMock.mock.calls[0]![0].text as string;
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toContain('TAG_GUIDANCE_URL');
    expect(text).not.toContain('{{');
  });

  it('returns failed without throwing when sendMail rejects (D-08)', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));
    const notifier = createWithholdNotifier(baseSmtpConfig);

    const result = await notifier.notifyWithhold({
      tier: 'internal',
      propagation: 'drop',
      dedupKey: 'uuid:drop:1',
    });

    expect(result).toEqual({ status: 'failed' });
  });

  it('uses secure false for port 587 (Pitfall 4)', () => {
    createWithholdNotifier({ ...baseSmtpConfig, smtpPort: 587 });
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it('uses secure true for port 465 (Pitfall 4)', () => {
    createWithholdNotifier({ ...baseSmtpConfig, smtpPort: 465 });
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('jsonTransport send path produces parseable mail without live SMTP (TEST-05)', async () => {
    createTransportMock.mockImplementation((options) =>
      nodemailer.createTransport(options),
    );

    const notifier = createWithholdNotifier({
      ...baseSmtpConfig,
      smtpHost: undefined,
      smtpPort: undefined,
    });

    await notifier.notifyWithhold({
      tier: 'public',
      propagation: 'busy',
      dedupKey: 'uuid:busy:1',
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    const transport = createTransportMock.mock.results[0]?.value as {
      sendMail: (mail: unknown) => Promise<unknown>;
    };
    expect(transport).toBeDefined();
    const info = await transport.sendMail({
      from: baseSmtpConfig.smtpFrom,
      to: baseSmtpConfig.notifyOwnerEmail,
      subject: WITHHOLD_NOTIFY_SUBJECT,
      text: 'probe',
    });
    expect(info).toBeDefined();
  });
});
