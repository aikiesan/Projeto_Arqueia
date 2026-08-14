import type { Metadata } from 'next';

import { EquipmentPageClient } from './equipment-page-client';

export const metadata: Metadata = { title: 'Equipamentos' };

export default function EquipmentPage() {
  return <EquipmentPageClient />;
}
