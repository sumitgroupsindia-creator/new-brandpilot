import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { apiGetProjects } from '../../lib/api';

export function ProjectsPage() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: apiGetProjects });
  const projects = projectsQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Reusable Workflows"
        title="Saved Projects"
        description="Review and relaunch reusable frame + values + parameter presets."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Project Library" subtitle="Continue existing drafts and presets." />
        {projectsQuery.isLoading ? <LoadingState lines={4} /> : null}
        {projectsQuery.isError ? <ErrorState description="Failed to load projects." /> : null}
        {!projectsQuery.isLoading && !projectsQuery.isError ? (
          projects.length ? (
            <div className="space-y-3">
              {projects.map(project => (
                <article key={project.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <h3 className="font-semibold text-[var(--color-ink)]">{project.name}</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">Frame: {project.frameName}</p>
                  <p className="text-xs text-[var(--color-ink-subtle)]">Updated: {new Date(project.updatedAt).toLocaleString()}</p>
                  <Button className="mt-3" variant="secondary" size="sm" type="button">Run project</Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No saved projects" description="Save a project from the editor to reuse it here." />
          )
        ) : null}
      </Card>
    </>
  );
}
