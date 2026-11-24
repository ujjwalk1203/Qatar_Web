import React from 'react';
import { csv, exportFile } from '../components/Shared.jsx';

export default function NetworkAttributeTable({
  network,
  assetType,
  setAssetType,
  selectedId,
  onSelect,
}) {
  const rows = network[assetType] || [];
  function exportRows() {
    exportFile(
      'network-assets.csv',
      csv([
        ['Asset ID', 'Name or route', 'Lifecycle', 'Length (m)'],
        ...rows.map((a) => [a.id, a.name || a.a + ' – ' + a.b, a.status || 'In-Place', a.length]),
      ]),
      'text/csv;charset=utf-8'
    );
  }
  return (
    <div className="attribute-table">
      <div className="section-head">
        <h2>Attribute table</h2>
        <div className="tabs">
          <button aria-pressed={assetType === 'spans'} onClick={() => setAssetType('spans')}>
            Duct spans
          </button>
          <button aria-pressed={assetType === 'manholes'} onClick={() => setAssetType('manholes')}>
            Manholes
          </button>
          <button onClick={exportRows}>Export CSV</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Asset ID</th>
              <th>Name or route</th>
              <th>Lifecycle</th>
              <th>Length</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr key={asset.id} className={selectedId === asset.id ? 'selected-row' : ''}>
                <td>
                  <button className="asset-link" onClick={() => onSelect(asset.id)}>
                    {asset.id}
                  </button>
                </td>
                <td>{asset.name || asset.a + ' – ' + asset.b}</td>
                <td>{asset.status || 'In-Place'}</td>
                <td>{asset.length ? asset.length + ' m' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
