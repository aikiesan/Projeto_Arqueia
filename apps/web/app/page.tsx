import { redirect } from 'next/navigation';

import { HomeDashboard } from './home-dashboard';
import { createUnavailableDashboardSummary } from './dashboard';
import { loadDashboardSummary, loadLaboratories, loadPrincipal } from './lib/session';
import { createWorkspacePresentation } from './presentation';

export default async function HomePage({ searchParams }: { readonly searchParams: Promise<{ readonly laboratory?: string }> }) {
  const principal = await loadPrincipal();
  if (principal === null) redirect('/login');

  const laboratories = await loadLaboratories();
  if (laboratories.length === 0) redirect('/login');
  const { laboratory: requestedLaboratoryId } = await searchParams;
  const activeLaboratory = laboratories.find(({ id }) => id === requestedLaboratoryId) ?? laboratories[0];
  if (activeLaboratory === undefined) redirect('/login');
  const summary =
    (await loadDashboardSummary(activeLaboratory.id)) ??
    createUnavailableDashboardSummary(activeLaboratory.id, activeLaboratory.timezone);
  const presentation = createWorkspacePresentation(principal, laboratories, activeLaboratory.id);

  return <HomeDashboard presentation={presentation} summary={summary} />;
}
