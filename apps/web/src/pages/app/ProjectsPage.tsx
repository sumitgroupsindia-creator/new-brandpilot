import { useQuery } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import { apiGetProjects } from '../../lib/api';

export function ProjectsPage() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: apiGetProjects });
  const projects = projectsQuery.data ?? [];

  return (
    <ShellCard title="Saved Projects" subtitle="Reusable frame + values + parameter presets.">
      {projectsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading projects...</p> : null}
      {projectsQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load projects.</p> : null}
      <div className="space-y-3">
        {projects.map(project => (
          <article key={project.id} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">{project.name}</h3>
            <p className="text-sm text-slate-600">Frame: {project.frameName}</p>
            <p className="text-xs text-slate-500">Updated: {new Date(project.updatedAt).toLocaleString()}</p>
            <button className="btn-secondary mt-3" type="button">Run project</button>
          </article>
        ))}
      </div>
    </ShellCard>
  );
}
