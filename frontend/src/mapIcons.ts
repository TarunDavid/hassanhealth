import L from 'leaflet'

export const typeColor = (t: string) => {
  switch (t) {
    case 'hub': return '#dc2626'
    case 'chc': return '#2563eb'
    case 'phc': return '#059669'
    case 'clinic': return '#7c3aed'
    case 'vet': return '#d97706'
    case 'user': return '#dc2626'
    case 'amb': return '#16a34a'
    case 'camp': return '#c026d3'
    default: return '#475569'
  }
}

export function pin(kind: string, size = 32, label?: string): L.DivIcon {
  const color = typeColor(kind)
  let iconSvg = ''
  let labelHtml = label ? `<span style="font-size:11px;font-weight:700;background:rgba(255,255,255,0.92);color:#1e293b;padding:2px 6px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.2);white-space:nowrap;margin-top:2px;">${label}</span>` : ''

  if (kind === 'hub') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"/></svg>`
    if (!label) labelHtml = `<span style="font-size:10px;font-weight:800;color:#dc2626;background:#fff;padding:1px 5px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);margin-top:2px;">HIMS</span>`
  } else if (kind === 'phc') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-3H8v-2h3V8h2v3h3v2h-3v3z"/></svg>`
    if (!label) labelHtml = `<span style="font-size:10px;font-weight:700;color:#059669;background:#fff;padding:1px 4px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);margin-top:2px;">PHC ಕೇಂದ್ರ</span>`
  } else if (kind === 'clinic') {
    iconSvg = `<span style="color:#fff;font-weight:800;font-size:15px;line-height:1">C</span>`
    if (!label) labelHtml = `<span style="font-size:10px;font-weight:700;color:#7c3aed;background:#fff;padding:1px 4px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);margin-top:2px;">Clinic</span>`
  } else if (kind === 'vet') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><circle cx="4.5" cy="10" r="2"/><circle cx="9" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="19.5" cy="10" r="2"/><path d="M12 10.5c-3.2 0-5.8 2.2-5.8 5.2 0 2 1.3 3.8 3.3 4.8 1.4.7 3.6.7 5 0 2-1 3.3-2.8 3.3-4.8 0-3-2.6-5.2-5.8-5.2z"/></svg>`
    if (!label) labelHtml = `<span style="font-size:10px;font-weight:700;color:#b45309;background:#fff;padding:1px 4px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);margin-top:2px;">Vet ಪಶು</span>`
  } else if (kind === 'user') {
    return L.divIcon({
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(220,38,38,0.3);animation:pulse-red-glow 2s infinite;"></div>
            <div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
          <span style="font-size:10px;font-weight:800;color:#1e293b;background:#fff;padding:1px 5px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.25);margin-top:2px;white-space:nowrap;">ನಿಮ್ಮ ಸ್ಥಳ</span>
        </div>`,
    })
  } else if (kind === 'amb') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M19 17h2c.6 0 1-.4 1-1v-3.5L18.5 8H15V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v11c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2" fill="#fff"/><circle cx="17" cy="17" r="2" fill="#fff"/></svg>`
    if (!label) labelHtml = `<span style="font-size:10px;font-weight:800;color:#15803d;background:#fff;padding:1px 4px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);margin-top:2px;">108</span>`
  } else if (kind === 'camp') {
    iconSvg = `<span style="font-size:16px;">⛺</span>`
  }

  return L.divIcon({
    className: '',
    iconSize: [size, size + 16],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:${size}px;height:${size}px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
          ${iconSvg}
        </div>
        ${labelHtml}
      </div>`,
  })
}
