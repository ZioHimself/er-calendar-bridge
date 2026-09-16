import nodemailer from 'nodemailer';
import type { AppConfig } from '../config/env.js';
import type { Tier } from '../domain/types/index.js';
import type { WithholdPropagation } from '../sync/withhold-transition.js';
import type { WithholdNotifier, WithholdNotifyParams } from './types.js';

export const WITHHOLD_NOTIFY_SUBJECT =
  'Calendar bridge: event disclosure limited';

export type WithholdNotifierConfig = Pick<
  AppConfig,
  | 'notifyOwnerEmail'
  | 'tagGuidanceUrl'
  | 'smtpHost'
  | 'smtpPort'
  | 'smtpUser'
  | 'smtpPassword'
  | 'smtpFrom'
>;

function buildMinimalBody(params: {
  tier: Tier;
  propagation: WithholdPropagation;
  tagGuidanceUrl?: string;
}): string {
  const propagationLabel =
    params.propagation === 'busy'
      ? 'busy block (limited detail on Google Calendar)'
      : 'withheld (not synced to Google Calendar)';

  const lines = [
    'A calendar event was limited by the ER Calendar Bridge.',
    '',
    `Propagation: ${propagationLabel}`,
    `Classification tier: ${params.tier}`,
    '',
    'Tag guidance:',
    '- ER-PUBLIC: full details may sync to Google Calendar',
    '- ER-INTERNAL: syncs as a busy block only',
    '- ER-SENSITIVE: not synced to Google Calendar',
  ];

  if (params.tagGuidanceUrl) {
    lines.push('', `Documentation: ${params.tagGuidanceUrl}`);
  }

  return lines.join('\n');
}

function isNotifyEnabled(
  notifyOwnerEmail?: string,
): notifyOwnerEmail is string {
  return notifyOwnerEmail !== undefined && notifyOwnerEmail.length > 0;
}

export function createWithholdNotifier(
  config: WithholdNotifierConfig,
): WithholdNotifier {
  if (!isNotifyEnabled(config.notifyOwnerEmail)) {
    return {
      async notifyWithhold(): Promise<{ status: 'sent' }> {
        return { status: 'sent' };
      },
    };
  }

  const transportOptions = {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth:
      config.smtpUser !== undefined
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword,
          }
        : undefined,
  };

  const transporter = nodemailer.createTransport(transportOptions);

  return {
    async notifyWithhold(
      params: WithholdNotifyParams,
    ): Promise<{ status: 'sent' | 'failed' }> {
      try {
        await transporter.sendMail({
          from: config.smtpFrom,
          to: config.notifyOwnerEmail,
          subject: WITHHOLD_NOTIFY_SUBJECT,
          text: buildMinimalBody({
            tier: params.tier,
            propagation: params.propagation,
            tagGuidanceUrl: config.tagGuidanceUrl,
          }),
        });
        return { status: 'sent' };
      } catch {
        return { status: 'failed' };
      }
    },
  };
}
