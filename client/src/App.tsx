import { lazy, Suspense } from 'react';
import { HealthStatus } from './components/HealthStatus';
import { BrandMark } from './components/Icon';
import { LanguageSwitch } from './components/LanguageSwitch';
import { Link } from './components/Link';
import { Loading } from './components/Loading';
import { Toaster } from './components/Toaster';
import { useI18n } from './i18n/useI18n';
import { ProjectsPage } from './pages/ProjectsPage';
import { matchRoute, usePathname } from './router';

// The project page carries the 3D viewer (That Open + Three.js, the heaviest part of the
// bundle): it is downloaded only when a project is opened.
const ProjectPage = lazy(() =>
  import('./pages/ProjectPage').then((module) => ({ default: module.ProjectPage })),
);

export function App() {
  const route = matchRoute(usePathname());
  const { t } = useI18n();

  return (
    <div className="app">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BrandMark size={20} />
          </span>
          {t('app.title')}
        </Link>
        <div className="header-tools">
          <LanguageSwitch />
          <HealthStatus />
        </div>
      </header>
      <main className="app-main">
        {route.name === 'projects' && <ProjectsPage />}
        {route.name === 'project' && (
          <Suspense fallback={<Loading text={t('app.loadingViewer')} />}>
            <ProjectPage key={route.id} id={route.id} />
          </Suspense>
        )}
        {route.name === 'notFound' && (
          <div className="card">
            <p>{t('app.notFound')}</p>
            <Link href="/">{t('app.backToProjects')}</Link>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
