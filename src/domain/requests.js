const operatorPrefixes = new Set(['O', 'V', 'Q']);

function isContiguous(spans, manholes) {
  if (!spans.length) return false;

  const connections = new Map();
  for (const id of manholes) connections.set(id, []);

  for (const { a, b } of spans) {
    connections.get(a).push(b);
    connections.get(b).push(a);
  }

  const pending = [spans[0].a];
  const visited = new Set(pending);
  while (pending.length) {
    for (const neighbor of connections.get(pending.pop())) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }

  return visited.size === manholes.size;
}

export function assessReservation(form, network) {
  const { spans, catalog } = network;
  const selectedIds = new Set(form.spans);
  const selectedSpans = spans.filter(({ id }) => selectedIds.has(id));
  const routeManholes = new Set(selectedSpans.flatMap(({ a, b }) => [a, b]));
  const contiguous = isContiguous(selectedSpans, routeManholes);

  const cable = catalog.cables.find(({ id }) => id === form.cable);
  const validCableCount = Number.isSafeInteger(form.count) && form.count > 0;
  const additionalUse = cable && validCableCount ? cable.share * form.count : 0;
  const errors = [];

  if (!selectedSpans.length || selectedSpans.length !== selectedIds.size) {
    errors.push('Select valid duct spans.');
  }
  if (selectedSpans.length && !contiguous) {
    errors.push('Duct spans must form a contiguous route.');
  }
  if (routeManholes.size > 100) {
    errors.push('A request may include at most 100 manholes.');
  }
  if (!form.manholes.length || form.manholes.some((id) => !routeManholes.has(id))) {
    errors.push('Select manholes on the chosen route.');
  }
  if (
    form.manholes.some((id) => {
      const point = network.manholes.find((m) => m.id === id);
      return !point || (point.status && point.status !== 'In-Place');
    })
  )
    errors.push('Only In-Place manholes may be requested.');
  if (!operatorPrefixes.has(form.operator)) {
    errors.push('Choose a telecom operator.');
  }
  if (!cable || !validCableCount) {
    errors.push('Choose a cable type and enter a positive whole cable count.');
  }
  if (!Number.isSafeInteger(form.spliceCount) || form.spliceCount < 0) {
    errors.push('Enter a non-negative whole splice count.');
  }
  if (
    form.spliceCount > 0 &&
    (!catalog.spliceTypes.includes(form.spliceType) || !form.manholes.includes(form.spliceAt))
  ) {
    errors.push('Choose a splice type and one of the selected manholes.');
  }

  for (const [manhole, plan] of Object.entries(form.splicePlans || {})) {
    if (
      !form.manholes.includes(manhole) ||
      !Number.isSafeInteger(plan?.count) ||
      plan.count < 0 ||
      (plan.count > 0 && !catalog.spliceTypes.includes(plan.type))
    )
      errors.push('Choose a valid splice type and count for ' + manhole + '.');
  }
  const capacity = selectedSpans.map(({ id, status, bores, ductType }) => {
    const limit = Math.min(75, catalog.limit, catalog.ductLimits?.[ductType] ?? catalog.limit);
    const bore = form.boreChoices?.[id] ?? 0;
    if (!Number.isInteger(bore) || bore < 0 || bore >= bores.length)
      errors.push('Choose a valid bore for ' + id + '.');
    if (status !== 'In-Place') {
      errors.push(id + ' is ' + status + '. Only In-Place spans can be requested.');
    }

    const projected = bores.map((use, index) => (index === bore ? use + additionalUse : use));
    if (projected.some((use) => use > limit)) {
      errors.push(id + ' exceeds the ' + limit + '% utilisation limit.');
    }

    return { id, existing: bores, projected, limit, bore };
  });

  return {
    ok: errors.length === 0,
    errors,
    capacity,
    limit: catalog.limit,
    manholeCount: routeManholes.size,
    contiguous,
  };
}

