import { useEffect, useState } from 'react'

export interface Pos {
  lat: number
  lng: number
  approx: boolean
  accuracy?: number
}
export const HASSAN: Pos = { lat: 13.0033, lng: 76.1004, approx: true }

/** Resolve the device location; fall back to Hassan city centre if denied/unavailable. */
export function getPosition(timeoutMs = 7000): Promise<Pos> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(HASSAN)
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          approx: false,
          accuracy: Math.round(p.coords.accuracy),
        }),
      () => resolve(HASSAN),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

export function usePosition(): Pos {
  const [pos, setPos] = useState<Pos>(HASSAN)
  useEffect(() => {
    void getPosition().then(setPos)
  }, [])
  return pos
}

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371, rad = Math.PI / 180
  const dp = (b.lat - a.lat) * rad, dl = (b.lng - a.lng) * rad
  const x = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}

/**
 * Shared helper to estimate transit ETA in minutes based on distance in kilometers.
 * Assumed average rural transit speed: 35 km/h across mixed paved and unpaved Hassan rural roads.
 */
export function etaMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 1
  return Math.max(1, Math.round((distanceKm / 35) * 60))
}
