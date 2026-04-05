type Props = {
  warnings: string[];
};

export function WarningList({ warnings }: Props) {
  return (
    <div className="panel panel-warning">
      <h3>Important warnings</h3>
      <ul className="warning-list">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
