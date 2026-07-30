import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createCompanyInviteRepository } from '../../src/features/companyAccounts/companyInviteRepository.js';
import { createCompanyMembershipRepository } from '../../src/features/companyAccounts/companyMembershipRepository.js';
import { createCompanyRepository } from '../../src/features/companyAccounts/companyRepository.js';
import { createCompanyService } from '../../src/features/companyAccounts/companyService.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createApprovalRepository } from '../../src/features/orderApprovals/approvalRepository.js';
import { createApprovalService } from '../../src/features/orderApprovals/approvalService.js';

void test('approval decisions enforce approver role and company non-disclosure', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-approval-workflow-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const now = new Date('2026-07-29T12:00:00.000Z');
  const clock = { now: () => now };
  const unitOfWork = createUnitOfWork(db);
  const mailbox = createMailboxRepository(db);
  const audit = createAuditWriter({ repository: createAuditRepository(db), clock });
  const companies = createCompanyService({
    companies: createCompanyRepository(db),
    memberships: createCompanyMembershipRepository(db),
    invites: createCompanyInviteRepository(db),
    mailbox,
    unitOfWork,
    audit,
    clock,
    baseUrl: 'http://example.test/',
  });
  const approvals = createApprovalService({
    approvals: createApprovalRepository(db),
    companies,
    mailbox,
    unitOfWork,
    audit,
    clock,
  });
  const addUser = (email: string) =>
    Number(
      (
        db
          .prepare(
            `INSERT INTO users (email, display_name, password_hash, password_salt, role)
           VALUES (?, 'User', 'hash', 'salt', 'customer') RETURNING id`,
          )
          .get(email) as { id: number }
      ).id,
    );
  const owner = addUser('owner@example.test');
  const buyer = addUser('buyer@example.test');
  const approver = addUser('approver@example.test');
  const ordinaryMember = addUser('ordinary@example.test');
  const outsider = addUser('outsider@example.test');
  const company = Number(
    db
      .prepare(
        `INSERT INTO company_accounts (name, created_by_user_id, approval_threshold_cents, created_at, updated_at)
         VALUES ('Co', ?, 0, ?, ?) RETURNING id`,
      )
      .get(owner, now.toISOString(), now.toISOString()).id,
  );
  for (const [userId, role] of [
    [owner, 'owner'],
    [buyer, 'buyer'],
    [approver, 'approver'],
    [ordinaryMember, 'buyer'],
  ] as const) {
    db.prepare(
      `INSERT INTO company_memberships (company_id, user_id, role, active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
    ).run(company, userId, role, now.toISOString());
  }
  const evaluated = approvals.evaluate({
    userId: buyer,
    cartId: '1c0a91c8-20b8-4e9c-8c57-96d6b8a4999d',
    quoteTotalCents: 100_000,
    resolvedCommitments: {
      deliverySiteId: null,
      deliveryAddress: { line1: '1 Street', city: 'Town', postcode: 'AB1 2CD', countryCode: 'GB' },
      billingEntity: {
        legalName: 'Buyer Ltd',
        registrationNumber: null,
        vatNumber: null,
        address: { line1: '1 Street', city: 'Town', postcode: 'AB1 2CD', countryCode: 'GB' },
      },
      deliverySlot: { date: '2026-08-05', window: 'am' },
      purchaseOrderReference: null,
    },
    idempotencyKey: 'b547e4d7-9f1a-4d25-878c-299bb33bd198',
    context: { actor: { type: 'user', userId: buyer }, requestId: 'request' },
  });
  assert.equal(evaluated.gate, 'defer');
  if (evaluated.gate !== 'defer') throw new Error('Expected deferral');
  const approvalId = Number(evaluated.approvalRequestId);
  assert.equal(
    approvals.decide(ordinaryMember, approvalId, 'approve', undefined, {
      actor: { type: 'user', userId: ordinaryMember },
      requestId: 'ordinary',
    }).code,
    'NOT_APPROVER',
  );
  assert.equal(
    approvals.decide(outsider, approvalId, 'approve', undefined, {
      actor: { type: 'user', userId: outsider },
      requestId: 'outsider',
    }).code,
    'APPROVAL_NOT_FOUND',
  );
  assert.equal(
    approvals.decide(approver, approvalId, 'reject', 'Insufficient budget', {
      actor: { type: 'user', userId: approver },
      requestId: 'approver',
    }).ok,
    true,
  );
  assert.equal(
    approvals.evaluate({
      userId: buyer,
      cartId: '1c0a91c8-20b8-4e9c-8c57-96d6b8a4999d',
      quoteTotalCents: 100_000,
      resolvedCommitments: {
        deliverySiteId: null,
        deliveryAddress: {
          line1: '1 Street',
          city: 'Town',
          postcode: 'AB1 2CD',
          countryCode: 'GB',
        },
        billingEntity: {
          legalName: 'Buyer Ltd',
          registrationNumber: null,
          vatNumber: null,
          address: { line1: '1 Street', city: 'Town', postcode: 'AB1 2CD', countryCode: 'GB' },
        },
        deliverySlot: { date: '2026-08-05', window: 'am' },
        purchaseOrderReference: null,
      },
      idempotencyKey: 'b547e4d7-9f1a-4d25-878c-299bb33bd198',
      context: { actor: { type: 'user', userId: buyer }, requestId: 'retry' },
    }).gate,
    'rejected',
  );
});
