import { useDensity } from '../../theme/DensityContext';

function IconRowsLoose() {
  return (
    <svg className="ico" width="15" height="15" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconRowsTight() {
  return (
    <svg className="ico" width="15" height="15" viewBox="0 0 24 24">
      <path d="M4 5h16M4 9h16M4 13h16M4 17h16M4 21h16" />
    </svg>
  );
}

/** Flips grids between comfortable (40px rows) and compact (32px rows). */
export function DensityToggle() {
  const { density, toggle } = useDensity();
  const compact = density === 'compact';
  return (
    <button
      className="iconbtn"
      onClick={toggle}
      title={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
      aria-pressed={compact}
    >
      {compact ? <IconRowsLoose /> : <IconRowsTight />}
    </button>
  );
}
