import { describe, expect, it } from 'vitest';

import { documentIdOf, editViewPath } from './editView';

describe('documentIdOf', () => {
  it('takes the id from the URL for a collection type', () => {
    expect(documentIdOf({ documentId: 'abc', document: { documentId: 'abc' } })).toBe('abc');
  });

  it('falls back to the loaded document for a single type, whose URL has no id', () => {
    expect(documentIdOf({ documentId: undefined, document: { documentId: 'home' } })).toBe('home');
  });

  it('is undefined for an entry that has not been saved yet', () => {
    expect(documentIdOf({ documentId: undefined, document: undefined })).toBeUndefined();
    expect(documentIdOf({ documentId: undefined, document: {} })).toBeUndefined();
    expect(documentIdOf(undefined)).toBeUndefined();
  });
});

describe('editViewPath', () => {
  const item = { contentTypeUid: 'api::x.x', documentId: 'abc', locale: null };

  it('links a collection type by its document id', () => {
    expect(editViewPath({ ...item, contentTypeKind: 'collectionType' })).toBe(
      '/content-manager/collection-types/api::x.x/abc'
    );
  });

  it('links a single type without one', () => {
    expect(editViewPath({ ...item, contentTypeKind: 'singleType' })).toBe(
      '/content-manager/single-types/api::x.x'
    );
  });

  it('keeps the locale', () => {
    expect(editViewPath({ ...item, contentTypeKind: 'singleType', locale: 'pl' })).toBe(
      '/content-manager/single-types/api::x.x?plugins[i18n][locale]=pl'
    );
  });
});
