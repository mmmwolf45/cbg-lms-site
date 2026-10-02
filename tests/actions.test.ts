import { describe, expect, it } from 'vitest';
import { findLoginButton } from '../src/actions';

type Btn = { textContent: string | null; name: string };
const btn = (text: string | null, name = text ?? '') => ({ textContent: text, name });

// A fake document that answers only the selector findLoginButton uses.
function fakeDoc(navbarButtons: Btn[], _afterLogo?: Btn[]) {
  return { querySelectorAll: (sel: string) => (sel === '#navbar button' ? navbarButtons : []) };
}

describe('findLoginButton', () => {
  it('finds the navbar button labelled Login, ignoring surrounding whitespace', () => {
    const doc = fakeDoc([btn('Menu'), btn('\n  Login  '), btn('Register')], [btn('Menu')]);
    expect(findLoginButton(doc)?.name).toBe('\n  Login  ');
  });

  it('matches the label exactly, not "Login" inside other text', () => {
    const doc = fakeDoc([btn('Login help'), btn('Register')], []);
    expect(findLoginButton(doc)).toBeUndefined();
  });

  it('never clicks some other button (e.g. a logged-in user menu)', () => {
    const doc = fakeDoc([btn('Maasoom'), btn('My courses')]);
    expect(findLoginButton(doc)).toBeUndefined();
  });

  it('copes with buttons that have no text', () => {
    const doc = fakeDoc([btn(null, 'icon'), btn('Login')], []);
    expect(findLoginButton(doc)?.name).toBe('Login');
  });

  it('returns undefined when there is no button (e.g. logged in, or no navbar)', () => {
    expect(findLoginButton(fakeDoc([]))).toBeUndefined();
  });
});
