import type { SourcePreviewQuery, SourceRecord } from '@app-starter/shared';

export interface PreviewFilters {
  text: string;
  from: string;
  to: string;
}

/** Date inputs represent the curator's local days, including the entire end day. */
export const previewQuery = ({ text, from, to }: PreviewFilters): SourcePreviewQuery => {
  const end = to ? new Date(`${to}T00:00:00`) : null;
  if (end) end.setDate(end.getDate() + 1);
  return {
    ...(text.trim() ? { text: text.trim() } : {}),
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(end ? { to: end.toISOString() } : {}),
  };
};

export const matchesPreview = (
  item: SourceRecord,
  query: SourcePreviewQuery,
  dateField: 'createdAt' | 'updatedAt',
): boolean => {
  const date = item[dateField];
  if ((query.from || query.to) && !date) return false;
  return (
    (!query.text ||
      `${item.title} ${item.text}`.toLocaleLowerCase().includes(query.text.toLocaleLowerCase())) &&
    (!query.from || Date.parse(date!) >= Date.parse(query.from)) &&
    (!query.to || Date.parse(date!) < Date.parse(query.to))
  );
};
