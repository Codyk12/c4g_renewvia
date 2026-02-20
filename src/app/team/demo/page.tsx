'use client';

import React, { useEffect, useRef, useState, ChangeEvent } from 'react';
import Script from 'next/script';
import Papa from 'papaparse';

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

interface MSTEdge {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  weight: number;
  voltage: 'low' | 'high';
}


export default function DemoPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [dataPoints, setDataPoints] = useState<LocationPoint[]>([]);
  const [mstEdges, setMstEdges] = useState<MSTEdge[]>([]);
  const [computingMst, setComputingMst] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [poleCost, setPoleCost] = useState<number>(0);
  const [lowVoltageCost, setLowVoltageCost] = useState<number>(0);
  const [highVoltageCost, setHighVoltageCost] = useState<number>(0);
  const [calculationResult] = useState<string>('');
  const [calcError, setCalcError] = useState<string | null>(null);


  const [costBreakdown, setCostBreakdown] = useState<{
    LowVoltageMeters: number | null;
    HighVoltageMeters: number | null;
    totalMeters: number | null;
    lowWireCostEst: number;
    highWireCostEst: number;
    poleCountEst: number;
    poleCostEst: number;
    wireCostEst: number;
    grandTotalEst: number;
  } | null>(null);

  // Initialize map once Google Maps script loads
  const initMap = () => {
    if (!window.google?.maps || !mapRef.current) return;

    const googleMap = new window.google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, // US center fallback
      zoom: 4,
      mapTypeId: 'satellite' as google.maps.MapTypeId,
      fullscreenControl: false,
      streetViewControl: false,
    });

    setMap(googleMap);
  };

  // Add markers and fit bounds whenever dataPoints or map changes
  // Effect 1: Draw / update markers (runs when dataPoints or map changes)
  useEffect(() => {
    if (!map || dataPoints.length === 0) return;

    // Optional: Clear old markers if you have them in a ref too
    // For now assuming markers are recreated each time (simple but works)

    const bounds = new google.maps.LatLngBounds();

    // Your existing color assignment + marker creation
    const colorPalette = [
      'red',
      'blue',
      'green',
      'yellow',
      'purple',
      'pink',
      'orange',
      'ltblue',
      'cyan',
      'magenta',
      'lime',
      'teal',
    ];
    const nameToColor = new Map<string, string>();
    let colorIndex = 0;

    dataPoints.forEach((point) => {
      if (!nameToColor.has(point.name)) {
        nameToColor.set(
          point.name,
          colorPalette[colorIndex % colorPalette.length]
        );
        colorIndex++;
      }
    });

    dataPoints.forEach((point) => {
      if (isNaN(point.lat) || isNaN(point.lng)) return;

      const color = nameToColor.get(point.name) || 'red';

      new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        label: {
          text: point.name,
          color: 'white',
          fontSize: '13px',
          fontWeight: 'bold',
        },
        icon: {
          url: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
          scaledSize: new google.maps.Size(36, 36),
        },
        title: point.name,
      });

      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    // Fit bounds only if no MST yet (or always – your choice)
    if (mstEdges.length === 0) {
      map.fitBounds(bounds, { bottom: 100, left: 80, right: 80, top: 100 });
    }
  }, [map, dataPoints, mstEdges]); // ← add mstEdges if you want refit after MST

  useEffect(() => {
    if (!map) return;

    // Clear old lines
    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];

    mstEdges.forEach((edge, index) => {
      if (!edge?.start || !edge?.end) {
        console.warn(`Skipping invalid edge at index ${index}:`, edge);
        return;
      }

      try {
        const polyline = new google.maps.Polyline({
          path: [edge.start, edge.end],
          geodesic: true,
          strokeColor: '#FF4444',
          strokeOpacity: 0.95,
          strokeWeight: 5,  // fixed for now — remove * edge.weight if it's huge
          map: map,
        });

        polylinesRef.current.push(polyline);
      } catch (err) {
        console.error('Failed to draw polyline:', err, edge);
      }
    });
  }, [map, mstEdges]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setLoading(true);

    Papa.parse(file, {
      header: true, // treat first row as headers
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(), // normalize headers
      complete: (result) => {
        try {
          const rows = result.data as Record<string, string>[];

          const parsedPoints: LocationPoint[] = rows
            .map((row) => {
              const name = row.name?.trim() || row['name'] || 'Unnamed';
              const latStr = row.latitude || row.lat || '';
              const lngStr = row.longitude || row.lng || row.logitude || '';

              const lat = parseFloat(latStr);
              const lng = parseFloat(lngStr);

              if (isNaN(lat) || isNaN(lng)) return null;

              return { name, lat, lng };
            })
            .filter((p): p is LocationPoint => p !== null);

          if (parsedPoints.length === 0) {
            setError(
              'No valid rows found. Expected columns: Name, Latitude, Longitude (case-insensitive). Make sure lat/lng are numbers.'
            );
          } else {
            setDataPoints(parsedPoints);
          }
        } catch (err) {
          setError('Error parsing CSV. Please check file format.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError('Failed to read file.');
        console.error(err);
        setLoading(false);
      },
    });
  };

  function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's mean radius in meters

    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
  }

  const handleRunOptimization = async () => {
    if (dataPoints.length < 2) {
      alert('Need at least 2 points to run optimization.');
      return;
    }

    setComputingMst(true);
    setMstEdges([]);
    setCalcError(null);

    try {
      const res = await fetch('/api/compute-mst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: dataPoints.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            name: p.name,
          })),
          costs: {
            poleCost: poleCost || 0,
            lowVoltageCostPerMeter: lowVoltageCost || 0,
            highVoltageCostPerMeter: highVoltageCost || 0,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Optimization failed');
      }

      const data = await res.json();

      console.log('Optimization result:', data);

      if (data.error) throw new Error(data.error);

      let totalLowVoltageMeters = 0;
      let totalHighVoltageMeters = 0;

      const edges = data.edges || [];

      // comput haverstine distance between each edge
      edges.forEach((edge: MSTEdge) => {
        if (!edge?.start || !edge?.end) return;

        const dist = haversineMeters(
          edge.start.lat,
          edge.start.lng,
          edge.end.lat,
          edge.end.lng
        );

        if (edge.voltage === 'low') {
          totalLowVoltageMeters += dist;
        } else {
          totalHighVoltageMeters += dist;
        }
      });


      // ────────────────────────────────────────────────
      // Cost estimation using real meters
      // ────────────────────────────────────────────────
      const numPolesEstimate = edges.length + 1; // rough: poles ≈ segments + 1
      const poleCostEst = numPolesEstimate * poleCost;

      // For now assume all wire is low-voltage (change later)
      const lowWireCostEst = totalLowVoltageMeters * (lowVoltageCost || 0);
      const highWireCostEst = totalHighVoltageMeters * (highVoltageCost || 0);
      // Or split: const wireCostEst = totalMeters * 0.7 * lowVoltageCost + totalMeters * 0.3 * highVoltageCost;

      // Update states
      setMstEdges(edges);
      setCostBreakdown({
        LowVoltageMeters: totalLowVoltageMeters,
        HighVoltageMeters: totalHighVoltageMeters,
        totalMeters: totalLowVoltageMeters + totalHighVoltageMeters, // new
        lowWireCostEst: lowWireCostEst,
        highWireCostEst: highWireCostEst,
        poleCountEst: numPolesEstimate,
        poleCostEst: poleCostEst,
        wireCostEst: lowWireCostEst + highWireCostEst,
        grandTotalEst: poleCostEst + lowWireCostEst + highWireCostEst,
      });

      // Optional: show the echoed costs (for debugging/confirmation)
    } catch (err: unknown) {

      if (err instanceof Error)
      setCalcError(err.message || 'Failed to run optimization');
      console.error(err);
    } finally {
      setComputingMst(false);
    }
  };

  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header – unchanged */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-28 text-center md:py-32'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-6xl px-6'>
          <div className='mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>🚀</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              Renewvia Energy
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Project Demo
          </h1>
          <p className='mb-10 text-3xl font-light text-emerald-100 md:text-4xl lg:text-5xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-12'>
        <h2 className='mb-6 text-4xl font-bold'>
          Mini-Grid Locations (Satellite View)
        </h2>

        {/* Upload UI */}
        <div className='mb-10 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
          <label className='mb-3 block text-lg font-medium'>
            Upload CSV with your locations
          </label>
          <p className='mb-4 text-sm text-zinc-400'>
            Expected columns: <code className='text-emerald-300'>Name</code>,{' '}
            <code className='text-emerald-300'>Latitude</code>,{' '}
            <code className='text-emerald-300'>Longitude</code>{' '}
            (case-insensitive)
          </p>

          <div className='flex items-center gap-4'>
            <label className='cursor-pointer rounded bg-emerald-600 px-5 py-3 font-medium transition hover:bg-emerald-700'>
              Choose CSV File
              <input
                type='file'
                accept='.csv'
                onChange={handleFileUpload}
                className='hidden'
              />
            </label>

            {fileName && (
              <span className='text-sm text-zinc-300'>
                Selected: {fileName}
              </span>
            )}
          </div>

          {error && <p className='mt-4 text-red-400'>{error}</p>}
          {loading && <p className='mt-4 text-emerald-400'>Processing...</p>}
          {dataPoints.length > 0 && !loading && (
            <p className='mt-4 text-emerald-300'>
              Loaded {dataPoints.length} valid location
              {dataPoints.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Cost Inputs & Calculate Section */}
        <div className='mt-12 rounded-lg border border-zinc-700 bg-zinc-900/50 p-8 backdrop-blur-sm'>
          <h3 className='mb-6 text-3xl font-bold'>Mini-Grid Optimization</h3>
          <p className='mb-6 text-zinc-300'>
            Enter approximate costs per unit. The algorithm will process these
            values as hyperparameters and calculate locations for Poles, Wire,
            and transformers.
          </p>

          <div className='grid gap-6 md:grid-cols-3'>
            <div>
              <label className='mb-2 block text-sm font-medium'>
                Cost per Pole ($)
              </label>
              <input
                type='number'
                step='0.01'
                min='0'
                value={poleCost}
                onChange={(e) => setPoleCost(parseFloat(e.target.value) || 0)}
                className='w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none'
                placeholder='e.g. 150.00'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium'>
                Low Voltage Wire ($/meter)
              </label>
              <input
                type='number'
                step='0.01'
                min='0'
                value={lowVoltageCost}
                onChange={(e) =>
                  setLowVoltageCost(parseFloat(e.target.value) || 0)
                }
                className='w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none'
                placeholder='e.g. 2.50'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium'>
                High Voltage Wire ($/meter)
              </label>
              <input
                type='number'
                step='0.01'
                min='0'
                value={highVoltageCost}
                onChange={(e) =>
                  setHighVoltageCost(parseFloat(e.target.value) || 0)
                }
                className='w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none'
                placeholder='e.g. 5.75'
              />
            </div>
          </div>

          <button
            onClick={handleRunOptimization}
            disabled={computingMst || dataPoints.length < 2}
            className='mt-8 rounded bg-purple-600 px-8 py-4 font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {computingMst
              ? 'Running Optimization...'
              : 'Run Optimization Algorithm'}
          </button>

          {calculationResult && (
            <div className='mt-8 rounded bg-zinc-800 p-6'>
              <h4 className='mb-4 text-xl font-semibold'>
                Result from Python Script:
              </h4>
              <pre className='text-sm whitespace-pre-wrap text-emerald-300'>
                {calculationResult}
              </pre>
            </div>
          )}

          {calcError && <p className='mt-6 text-red-400'>{calcError}</p>}
        </div>

        {costBreakdown && (
          <div className='mt-8 rounded-lg border border-emerald-700/30 bg-zinc-900/70 p-6 backdrop-blur-sm'>
            <h4 className='mb-4 text-xl font-semibold text-emerald-300'>
              Estimated Mini-Grid Costs (Real Distance)
            </h4>

            {/* Summary Totals */}
            <div className='mb-6 grid gap-4 md:grid-cols-2'>
              <div>
                <p className='text-sm text-zinc-400'>Total Wire Length</p>
                <p className='text-xl font-medium text-white'>
                  {costBreakdown.totalMeters?.toLocaleString() ?? '0'} m ≈{' '}
                </p>
              </div>

              <div className='text-right'>
                <p className='text-sm text-zinc-400'>Grand Total Estimate</p>
                <p className='text-2xl font-bold text-emerald-300'>
                  $
                  {costBreakdown.grandTotalEst?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? '0.00'}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className='grid gap-6 md:grid-cols-3'>
              {/* Poles */}
              <div className='rounded bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>Poles (est.)</p>
                <p className='text-lg font-medium text-emerald-400'>
                  {costBreakdown.poleCountEst ?? '—'} units
                </p>
                <p className='text-base font-semibold'>
                  $
                  {costBreakdown.poleCostEst?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? '0.00'}
                </p>
              </div>

              {/* Low Voltage */}
              <div className='rounded border-l-4 border-blue-500 bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>Low Voltage Wire</p>
                <p className='text-lg font-medium text-blue-300'>
                  {costBreakdown.LowVoltageMeters?.toLocaleString() ?? '0'} m
                </p>
                <p className='text-base font-semibold'>
                  $
                  {costBreakdown.lowWireCostEst?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? '0.00'}
                </p>
              </div>

              {/* High Voltage */}
              <div className='rounded border-l-4 border-purple-500 bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>High Voltage Wire</p>
                <p className='text-lg font-medium text-purple-300'>
                  {costBreakdown.HighVoltageMeters?.toLocaleString() ?? '0'} m
                </p>
                <p className='text-base font-semibold'>
                  $
                  {costBreakdown.highWireCostEst?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? '0.00'}
                </p>
              </div>
            </div>

            <p className='mt-6 text-center text-xs text-zinc-500'>
              Based on MST great-circle distances • pole count ≈ edges + 1
            </p>
          </div>
        )}

        {/* Map container */}
        <div
          ref={mapRef}
          className='mt-8 h-[70vh] w-full rounded-xl border border-zinc-700 shadow-2xl'
        >
          Loading satellite map...
        </div>

        {/* Script loader */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`}
          strategy='afterInteractive'
          onLoad={initMap}
        />
      </main>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 Renewvia • CS 6150 Computing For Good • Project Demo</p>
      </footer>
    </div>
  );
}
