import { HealthStatus } from './components/HealthStatus';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Control de obra BIM</h1>
        <p className="muted">Modelo IFC, cantidades, presupuesto y avance de obra.</p>
      </header>
      <main>
        <HealthStatus />
      </main>
    </div>
  );
}
