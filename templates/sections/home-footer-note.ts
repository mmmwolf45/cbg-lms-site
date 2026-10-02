import { esc, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

export const footerNote = ({ 'footer-note': s }: Home) =>
  section('footer-note', `<p class="cbg-small">${esc(s.text)}</p>`);
