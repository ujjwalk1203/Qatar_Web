export const operators = { O: 'Ooredoo', V: 'Vodafone', Q: 'QNBN' };
export const manholes = [
  {
    id: 'MH-101',
    name: 'West Bay Gate',
    status: 'In-Place',
    x: 116,
    y: 270,
    lon: 51.523,
    lat: 25.328,
  },
  {
    id: 'MH-102',
    name: 'Diplomatic Quarter',
    status: 'In-Place',
    x: 289,
    y: 179,
    lon: 51.534,
    lat: 25.335,
  },
  {
    id: 'MH-103',
    name: 'Corniche North',
    status: 'In-Place',
    x: 469,
    y: 251,
    lon: 51.546,
    lat: 25.329,
  },
  {
    id: 'MH-104',
    name: 'Corniche South',
    status: 'In-Place',
    x: 656,
    y: 346,
    lon: 51.558,
    lat: 25.322,
  },
  { id: 'MH-105', name: 'Al Dafna', status: 'In-Place', x: 511, y: 99, lon: 51.549, lat: 25.342 },
];
export const spans = [
  {
    id: 'DS-201',
    ductType: 'Duct',
    a: 'MH-101',
    b: 'MH-102',
    length: 210,
    bores: [31, 52],
    status: 'In-Place',
  },
  {
    id: 'DS-202',
    ductType: 'Sub-duct',
    a: 'MH-102',
    b: 'MH-103',
    length: 185,
    bores: [44, 66],
    status: 'In-Place',
  },
  { id: 'DS-203', a: 'MH-103', b: 'MH-104', length: 253, bores: [49, 74], status: 'In-Place' },
  { id: 'DS-204', a: 'MH-103', b: 'MH-105', length: 132, bores: [26, 40], status: 'Locked' },
];
export const catalog = {
  limit: 75,
  ductLimits: { Duct: 75, 'Sub-duct': 70 },
  cables: [
    { id: '24F', name: '24-core fibre', share: 3 },
    { id: '48F', name: '48-core fibre', share: 6 },
    { id: '96F', name: '96-core fibre', share: 10 },
  ],
  spliceTypes: ['Fusion', 'Mechanical'],
};
const now = Date.now();
export const auditSeed = Array.from({ length: 24 }, (_, i) => {
  const types = ['Sign-in', 'Decision', 'Override', 'Reservation submitted'];
  const action = i >= 3 && i <= 5 ? 'Sign-in' : types[i % 4];
  return {
    id: 'EV-' + (3024 - i),
    at: new Date(now - i * 65 * 60000).toISOString(),
    user:
      i >= 3 && i <= 5
        ? 'operator.demo'
        : ['cra.reviewer', 'cra.supervisor', 'operator.demo'][i % 3],
    action,
    status: i >= 3 && i <= 5 ? 'Failed' : 'Success',
    target: i >= 3 && i <= 5 ? 'Portal access' : i % 4 ? 'REQ-' + (8120 - i) : 'CRA portal',
    detail:
      i >= 3 && i <= 5
        ? 'Demo sign-in refused'
        : i % 4 === 2
          ? 'Supervisor capacity override recorded'
          : i % 4 === 1
            ? 'Review decision recorded'
            : 'Demo activity',
  };
});
