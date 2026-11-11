import { getQuantities } from '../../api/elements';
import { QuantitiesTable } from '../../components/QuantitiesTable';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';

interface Props {
  projectId: number;
  /** Changes whenever the element list changes, to refetch the quantities. */
  dataVersion: number;
  selectedGuids: readonly string[];
  onSelect: (guids: string[]) => void;
}

export function QuantitiesTab({ projectId, dataVersion, selectedGuids, onSelect }: Props) {
  const { state, reload } = useAsync(
    (signal) => getQuantities(projectId, signal),
    `${projectId}:${dataVersion}`,
  );

  if (state.status === 'loading') return <Skeleton label="Calculando cantidades" rows={8} />;
  if (state.status === 'error') {
    return (
      <div className="error-box card">
        <p>{state.error}</p>
        <button type="button" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }
  return <QuantitiesTable data={state.data} selectedGuids={selectedGuids} onSelect={onSelect} />;
}
