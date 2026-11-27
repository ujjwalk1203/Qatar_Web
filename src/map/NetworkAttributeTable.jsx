import React from 'react';
import { csv, exportFile } from '../components/Shared.jsx';
import { wgs84ToQnd95, formatQnd95 } from './qnd95.js';

export default function NetworkAttributeTable({
  network,
  assetType,
  setAssetType,
  selectedId,
  onSelect,
}) {
  const rows = network[assetType] || [];
  const byId = Object.fromEntries((network.manholes || []).map((m) => [m.id, m]));

  function getQnd95Label(asset) {
    const lon = asset.a ? ((byId[asset.a]?.lon || 0) + (byId[asset.b]?.lon || 0)) / 2 : asset.lon;
    const lat = asset.a ? ((byId[asset.a]?.lat || 0) + (byId[asset.b]?.lat || 0)) / 2 : asset.lat;
    if (!lon || !lat) return '—';
    const qnd = wgs84ToQnd95(lon, lat);
    return formatQnd95(qnd.easting, qnd.northing);
  }

  function getQarsPinLabel(asset) {
    if (asset.qars && asset.pin) {
      return `Z${asset.qars.zone}·${asset.qars.street}·${asset.qars.building} (${asset.pin})`;
    }
    if (asset.qarsZone) return `Zone ${asset.qarsZone}`;
    return '—';
  }

  function exportRows() {
    exportFile(
      'network-assets.csv',
      csv([
        ['Asset ID', 'Name or route', 'QND95 (EPSG:2932)', 'QARS / PIN', 'Landuse', 'Lifecycle', 'Length (m)'],
        ...rows.map((a) => [
          a.id,
          a.name || a.a + ' – ' + a.b,
          getQnd95Label(a),
          getQarsPinLabel(a),
          a.landuse || '—',
          a.status || 'In-Place',
          a.length,
        ]),
      ]),
      'text/csv;charset=utf-8',
    );
  }
  return (
    <div className="attribute-table">
      <div className="section-head">
        <h2>GIS Attribute table (QND95)</h2>
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
              <th>QND95 (EPSG:2932)</th>
              <th>QARS / PIN</th>
              <th>Landuse</th>
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
                <td>{getQnd95Label(asset)}</td>
                <td>{getQarsPinLabel(asset)}</td>
                <td>{asset.landuse || '—'}</td>
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
