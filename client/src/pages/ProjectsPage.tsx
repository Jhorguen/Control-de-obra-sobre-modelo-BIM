import type { Project } from '@bim/shared';
import { useState, type FormEvent } from 'react';
import { createProject, deleteProject, listProjects } from '../api/projects';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { formatDate } from '../format';
import { Link } from '../components/Link';
import { navigate } from '../router';

function CreateProjectForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({ name, description: description || undefined });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Nuevo proyecto</h2>
      <label>
        Nombre
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Edificio Torre Norte"
          maxLength={120}
          required
        />
      </label>
      <label>
        Descripción <span className="muted">(opcional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="primary" disabled={saving || !name.trim()}>
        {saving ? 'Creando…' : 'Crear proyecto'}
      </button>
    </form>
  );
}

function ProjectCard({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el proyecto "${project.name}" y todos sus datos?`)) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (err) {
      window.alert(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <li className="card project-card">
      <div>
        <h3>
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
          {project.isDemo && <span className="tag">Demo</span>}
        </h3>
        {project.description && <p className="muted">{project.description}</p>}
        <p className="meta">
          Creado el {formatDate(project.createdAt)} ·{' '}
          {project.files.frag
            ? `Modelo: ${project.files.ifc?.fileName ?? 'cargado'}`
            : 'Sin modelo'}
        </p>
      </div>
      {!project.isDemo && (
        <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Eliminando…' : 'Eliminar'}
        </button>
      )}
    </li>
  );
}

export function ProjectsPage() {
  const { state, reload } = useAsync(listProjects, 'projects');

  return (
    <div className="projects-page">
      <section>
        <h2 className="section-title">Proyectos</h2>
        {state.status === 'loading' && <p className="muted">Cargando proyectos…</p>}
        {state.status === 'error' && (
          <div className="card error-box">
            <p>{state.error}</p>
            <button type="button" onClick={reload}>
              Reintentar
            </button>
          </div>
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <p className="card muted">Aún no hay proyectos. Crea el primero con el formulario.</p>
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <ul className="project-list">
            {state.data.map((project) => (
              <ProjectCard key={project.id} project={project} onDeleted={reload} />
            ))}
          </ul>
        )}
      </section>
      <aside>
        <CreateProjectForm />
      </aside>
    </div>
  );
}
