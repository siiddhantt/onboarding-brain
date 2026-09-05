import { matchesPreview, previewQuery } from '../source-preview';

describe('source preview filters', () => {
  const item = {
    id: 'doc',
    title: 'Policy',
    text: 'Juniper access',
    url: 'https://example.com/doc',
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-09-05T12:00:00Z',
  };

  it('includes the whole local end day and distinguishes created from updated dates', () => {
    const query = previewQuery({ text: ' juniper ', from: '2026-09-05', to: '2026-09-05' });
    expect(query.from).toBe(new Date('2026-09-05T00:00:00').toISOString());
    expect(query.to).toBe(new Date('2026-09-06T00:00:00').toISOString());
    expect(matchesPreview(item, query, 'updatedAt')).toBe(true);
    expect(matchesPreview(item, query, 'createdAt')).toBe(false);
    expect(matchesPreview({ ...item, updatedAt: query.to! }, query, 'updatedAt')).toBe(false);
    expect(matchesPreview({ ...item, updatedAt: query.from! }, query, 'updatedAt')).toBe(true);
  });

  it('does not invent creation dates for older snapshots or document providers', () => {
    const undated = { ...item, createdAt: undefined };
    expect(matchesPreview(undated, {}, 'createdAt')).toBe(true);
    expect(matchesPreview(undated, { from: '2026-09-05T00:00:00Z' }, 'createdAt')).toBe(false);
  });
});
