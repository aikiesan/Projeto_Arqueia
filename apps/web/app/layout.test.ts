import { describe, expect, it } from 'vitest';

import { metadata } from './layout';

describe('root layout metadata', () => {
  it('publishes the Arqueia SVG and maskable apple touch icon', () => {
    expect(metadata.icons).toEqual({
      apple: [{ url: '/icons/arqueia-maskable.svg' }],
      icon: [{ type: 'image/svg+xml', url: '/icons/arqueia.svg' }],
    });
  });

  it('configures Apple web app standalone capability', () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: 'default',
      title: 'Arqueia',
    });
  });
});
