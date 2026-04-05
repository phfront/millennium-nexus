import type { Config } from 'tailwindcss';
import { nexusUiPreset } from '@phfront/millennium-ui/tailwind-preset';

const config: Config = {
  presets: [nexusUiPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@phfront/millennium-ui/dist/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
