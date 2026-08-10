import type { Metadata } from 'next';
import ValidatorLookup from './ValidatorLookup';

export const metadata: Metadata = {
  title: 'Validator pool position',
  description:
    "Look up a validator's live Definity-pool stake — directed and curve — and the GDI curve target the optimiser steers toward, computed from its G score.",
};

export default function ValidatorLookupPage() {
  return <ValidatorLookup />;
}
