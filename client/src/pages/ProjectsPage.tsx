import type { Project } from '@bim/shared';
import { useState, type FormEvent } from 'react';
import { createProject, deleteProject, listProjects } from '../api/projects';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { formatBytes, formatDate, formatNumber } from '../format';
import { useI18n } from '../i18n/useI18n';
import { ArrowRightIcon, BrandMark, TrashIcon } from '../components/Icon';
import { Link } from '../components/Link';
import { Loading } from '../components/Loading';
import { navigate } from '../router';

function CreateProjectForm() {
  const { t } = useI18n();
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
    <form className="card form form-card" onSubmit={handleSubmit}>
      <h2>{t('projects.new')}</h2>
      <label>
        {t('projects.name')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.namePlaceholder')}
          maxLength={120}
          required
        />
      </label>
      <label>
        <span>
          {t('common.description')} <span className="muted">{t('common.optional')}</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="primary" disabled={saving || !name.trim()}>
        {saving ? t('projects.creating') : t('projects.create')}
      </button>
    </form>
  );
}

function ProjectCard({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(t('projects.deleteConfirm', { name: project.name }))) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (err) {
      window.alert(errorMessage(err));
      setDeleting(false);
    }
  }

  const ifc = project.files.ifc;

  return (
    <li className="project-card">
      <span className="project-tile" aria-hidden="true">
        <BrandMark size={24} />
      </span>
      <div>
        <h2>
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
          {project.isDemo && <span className="tag">Demo</span>}
        </h2>
        {project.description && <p className="muted">{project.description}</p>}
        <ul className="project-facts">
          <li className="chip">
            {ifc ? `${ifc.fileName} · ${formatBytes(ifc.sizeBytes)}` : t('projects.noModel')}
          </li>
          <li className="chip">{t('projects.created', { date: formatDate(project.createdAt) })}</li>
        </ul>
      </div>
      <div className="row-actions">
        {!project.isDemo && (
          <button
            type="button"
            className="danger icon-only"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={t('projects.deleteLabel', { name: project.name })}
            title={t('projects.deleteTitle')}
          >
            <TrashIcon />
          </button>
        )}
        <ArrowRightIcon className="card-arrow" size={18} />
      </div>
    </li>
  );
}

export function ProjectsPage() {
  const { state, reload } = useAsync(listProjects, 'projects');
  const { t } = useI18n();
  const count = state.status === 'success' ? state.data.length : null;

  return (
    <div className="projects-page">
      <section aria-labelledby="projects-title">
        <div className="page-head">
          <div className="row">
            <h1 id="projects-title">{t('projects.title')}</h1>
            {count !== null && count > 0 && <span className="count">{formatNumber(count)}</span>}
          </div>
          <p>{t('projects.intro')}</p>
        </div>
        {state.status === 'loading' && <Loading text={t('projects.loading')} />}
        {state.status === 'error' && (
          <div className="card error-box">
            <p>{state.error}</p>
            <button type="button" onClick={reload}>
              {t('common.retry')}
            </button>
          </div>
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <div className="card empty-state">
            <span className="project-tile" aria-hidden="true">
              <BrandMark size={24} />
            </span>
            <p>{t('projects.empty')}</p>
          </div>
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
