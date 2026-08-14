import { redirect } from 'next/navigation';

import { HomeDashboard } from './home-dashboard';
import { createDashboardSummary } from './dashboard';
import { loadLaboratories, loadLaboratoryEquipment, loadPrincipal } from './lib/session';
import { createWorkspacePresentation } from './presentation';

export default async function HomePage({ searchParams }: { readonly searchParams: Promise<{ readonly laboratory?: string }> }) {
  const principal = await loadPrincipal();
  if (principal === null) redirect('/login');

  const laboratories = await loadLaboratories();
  if (laboratories.length === 0) redirect('/login');
  const { laboratory: requestedLaboratoryId } = await searchParams;
  const activeLaboratory = laboratories.find(({ id }) => id === requestedLaboratoryId) ?? laboratories[0];
  if (activeLaboratory === undefined) redirect('/login');
  const equipment = await loadLaboratoryEquipment(activeLaboratory.id);
  const summary = createDashboardSummary(activeLaboratory.id, equipment.items);
  const presentation = createWorkspacePresentation(principal, laboratories, activeLaboratory.id);

  return <HomeDashboard equipmentDataAvailable={equipment.available} presentation={presentation} summary={summary} />;
}
