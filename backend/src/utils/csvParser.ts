/** Result of parsing a CSV document: column headers plus one record per data row. */
export interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Parses RFC4180-style CSV text (quoted fields, escaped `""`, embedded commas/newlines).
 * The first row is treated as the header; blank rows are dropped.
 */
export function parseCsv(content: string): CsvParseResult {
  const rawRows = splitCsvRows(content).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rawRows[0]!.map((h) => h.trim());
  const rows = rawRows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (row[i] ?? '').trim();
    });
    return record;
  });

  return { headers, rows };
}

function splitCsvRows(content: string): string[][] {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
