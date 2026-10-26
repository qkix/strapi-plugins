import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  SINGLE_UID,
  UID,
  bootWithGreenlight,
  plugin,
  publishedCount,
  seedWorkflow,
} from './helpers';

/**
 * Single types, from issue #179.
 *
 * The edit view's URL has no document id for a single type, which is what broke
 * the panel and the Publish button in the admin. The server never relied on the
 * URL - the Content Manager publishes a single type by `document.documentId` -
 * so these pin that down, plus the one thing the admin cannot work out alone:
 * which kind a queue item is, since the link back to it differs.
 */

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await bootWithGreenlight();
  strapi = app.strapi;
}, 180_000);

afterAll(() => app?.destroy());

beforeEach(async () => {
  await strapi.db.query('plugin::greenlight.assignment').deleteMany({});
  await strapi.db.query('plugin::greenlight.transition').deleteMany({});
  await strapi.db.query('plugin::greenlight.stage').deleteMany({});
  await strapi.db.query('plugin::greenlight.workflow').deleteMany({});
  await strapi.db.query(SINGLE_UID).deleteMany({});
});

const homePage = async () =>
  (await strapi.documents(SINGLE_UID).create({ data: { title: 'Home' } })).documentId;

describe('single types', () => {
  it('are gated like any other document', async () => {
    const wf = await seedWorkflow(strapi, {}, [SINGLE_UID]);
    const documentId = await homePage();

    await expect(strapi.documents(SINGLE_UID).publish({ documentId })).rejects.toThrow(/Draft/);
    expect(await publishedCount(strapi, documentId, SINGLE_UID)).toBe(0);

    const terminal = wf.stages.find((stage: any) => stage.isTerminal);
    const current = await plugin(strapi, 'assignment').ensure(SINGLE_UID, documentId, null);
    await plugin(strapi, 'assignment').transition({
      uid: SINGLE_UID,
      documentId,
      locale: null,
      toStageId: terminal.id,
      version: current.version,
      user: { id: 1, firstname: 'Anna', lastname: 'Kowalska', roles: [] },
    });

    await strapi.documents(SINGLE_UID).publish({ documentId });
    expect(await publishedCount(strapi, documentId, SINGLE_UID)).toBe(1);
  });

  it('come back from the queue marked as single types', async () => {
    await seedWorkflow(strapi, {}, [UID, SINGLE_UID]);
    const single = await homePage();
    const collection = (await strapi.documents(UID).create({ data: { title: 'A' }, locale: 'en' }))
      .documentId;
    await plugin(strapi, 'assignment').ensure(SINGLE_UID, single, null);
    await plugin(strapi, 'assignment').ensure(UID, collection, 'en');

    const { results } = await plugin(strapi, 'queue').list({});
    const kindOf = (documentId: string) =>
      results.find((item: any) => item.documentId === documentId)?.contentTypeKind;

    expect(kindOf(single)).toBe('singleType');
    expect(kindOf(collection)).toBe('collectionType');
  });
});
