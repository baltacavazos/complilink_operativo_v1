export function OfficialWaitLayer({ status }: { status: string }) {
  const consulting = status === "consultando";
  return (
    <div data-testid="official-wait-layer" className="mb-2">
      <span
        data-testid="official-wait-state"
        data-state={consulting ? "en-consulta" : "en-consulta"}
        className="ap-state-pill"
      >
        En consulta
      </span>
    </div>
  );
}
