import { HealthStatus } from './components/HealthStatus';
import { ProjectPage } from './pages/ProjectPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { Link } from './components/Link';
import { matchRoute, usePathname } from './router';

export function App() {
  const route = matchRoute(usePathname());

  return (
    <div className="app">
      <header className="app-header">
        <Link href="/" className="brand">
          Control de obra BIM
        </Link>
        <HealthStatus />
      </header>
      <main className="app-main">
        {route.name === 'projects' && <ProjectsPage />}
        {route.name === 'project' && <ProjectPage key={route.id} id={route.id} />}
        {route.name === 'notFound' && (
          <div className="card">
            <p>Esta página no existe.</p>
            <Link href="/">Volver a proyectos</Link>
          </div>
        )}
      </main>
    </div>
  );
}
