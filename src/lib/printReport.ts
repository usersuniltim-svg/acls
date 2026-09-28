/**
 * Print exactly one clinical report.
 *
 * Every <PrintableReport> renders into its own portal on <body>, and the print
 * stylesheet shows all of them. In the Journal tab the active code's report and
 * a saved case's report can be mounted at the same time, so a plain
 * window.print() would put two patients' records into one PDF.
 *
 * This hides every report except the chosen one while printing, then puts the
 * page back as it was.
 */

const STYLE_ID = 'acls-print-target-style';

/** Escape a value for use inside a double-quoted CSS attribute selector. */
function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let finishPreviousPrint: (() => void) | null = null;

export function printReport(printId: string, documentTitle?: string): void {
  // If an earlier print never reported that it finished, tidy it up first.
  finishPreviousPrint?.();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `@media print { .acls-print-report-portal:not([data-print-id="${cssString(printId)}"]) { display: none !important; } }`;
  document.head.appendChild(style);

  const originalTitle = document.title;
  if (documentTitle) document.title = documentTitle; // becomes the suggested PDF file name

  const finish = () => {
    window.removeEventListener('afterprint', finish);
    style.remove();
    document.title = originalTitle;
    if (finishPreviousPrint === finish) finishPreviousPrint = null;
  };
  finishPreviousPrint = finish;

  // window.print() blocks on desktop browsers but can return straight away on
  // mobile, so undo the changes when the browser says printing has ended.
  window.addEventListener('afterprint', finish);
  window.print();
}
