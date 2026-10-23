export function haversineKm(a, b) {
  const rad = v => v * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}
export function planRoute(origin, stops) {
  const remaining = [...stops], ordered = []; let current = origin, km = 0;
  while(remaining.length) {
    let best = 0, dist = Infinity;
    for(let i=0;i<remaining.length;i++) { const d=haversineKm(current, remaining[i]); if(d<dist) {dist=d;best=i;} }
    const next = remaining.splice(best,1)[0]; ordered.push({...next, distanciaTrechoKm: Number(dist.toFixed(2))}); km+=dist; current=next;
  }
  return { paradas: ordered, distanciaEstimadaKm: Number(km.toFixed(2)), metodo: 'VIZINHO_MAIS_PROXIMO_HAVERSINE' };
}
