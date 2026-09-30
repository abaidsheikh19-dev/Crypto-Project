import 'server-only';
import type { Prisma } from '@prisma/client';
import { db, type Tx } from './db';

export type AuditActor = { type: 'admin' | 'system' | 'customer' | 'anonymous'; id?: number | null };

/**
 * Append-only audit trail. Metadata must reference IDs and counts only, never
 * names, emails, addresses or tokens.
 */
export async function audit(
  actor: AuditActor,
  action: string,
  target?: { type: string; id: string | number } | null,
  metadata?: Prisma.InputJsonValue,
  options: { ipHash?: string | null; tx?: Tx } = {},
) {
  await (options.tx ?? db).auditLog.create({
    data: {
      actorType: actor.type,
      actorId: actor.id ?? null,
      action,
      targetType: target?.type ?? null,
      targetId: target ? String(target.id) : null,
      metadata: metadata ?? undefined,
      ipHash: options.ipHash ?? null,
    },
  });
}
