import { lazy, Suspense } from 'react';
import { HealthStatus } from './components/HealthStatus';
import { BrandMark } from './components/Icon';
import { Link } from './components/Link';
import { Loading } from './components/Loading';
import { Toaster } from './components/Toaster';
import { ProjectsPage } from './pages/ProjectsPage';
import { matchRoute, usePathname } from './router';

// The project page carries the 3D viewer (That Open + Three.js, the heaviest part of the
// bundle): it is downloaded only when a project is opened.
const ProjectPage = lazy(() =>
  import('./pages/ProjectPage').then((module) => ({ default: module.ProjectPage })),
);

export function App() {
  const route = matchRoute(usePathname());

  return (
    <div className="app">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BrandMark size={20} />
          </span>
          Control de obra BIM
        </Link>
        <HealthStatus />
      </header>
      <main className="app-main">
        {route.name === 'projects' && <ProjectsPage />}
        {route.name === 'project' && (
          <Suspense fallback={<Loading text="Cargando el visor…" />}>
            <ProjectPage key={route.id} id={route.id} />
          </Suspense>
        )}
        {route.name === 'notFound' && (
          <div className="card">
            <p>Esta página no existe.</p>
            <Link href="/">Volver a proyectos</Link>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
