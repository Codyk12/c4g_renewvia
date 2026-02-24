'use client';

import React, { useEffect, useRef, useState, ChangeEvent } from 'react';
import Script from 'next/script';
import Papa from 'papaparse';

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

const formatMeters = (m: number) =>
  m.toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatUSD = (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

interface MSTEdge {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  lengthMeters: number;
  voltage: 'low' | 'high';
}

interface CostBreakdown {
  lowVoltageMeters: number;
  highVoltageMeters: number;
  totalMeters: number;

  lowWireCost: number;
  highWireCost: number;
  wireCost: number;

  poleCount: number;
  poleCost: number;
  pointCount: number;

  grandTotal: number;

  // Debug / transparency
  usedPoleCost?: number;
  usedLowCostPerMeter?: number;
  usedHighCostPerMeter?: number;
}

export default function DemoPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
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

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(
    null
  );
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [isDragOver, setIsDragOver] = useState(false);

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
    if (!map) return;

    // Always clear old markers so a new CSV fully refreshes the map
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (dataPoints.length === 0) return;

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

      const marker = new google.maps.Marker({
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

      markersRef.current.push(marker);
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
          strokeWeight: 5, // fixed for now — remove * edge.weight if it's huge
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
    e.target.value = ''; // allow uploading the same file name again
    if (!file) return;

    processFile(file);
  };

  const processFile = (file: File) => {
    // Reset anything derived from the previous CSV so the map + UI refresh cleanly
    setMstEdges([]);
    setCostBreakdown(null);
    setCalcError(null);
    setError(null);
    setDataPoints([]);

    setFileName(file.name);
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

              // Validate coordinate precision (require at least 6 decimal places)
              const latPrecision = (latStr.split('.')[1] || '').length;
              const lngPrecision = (lngStr.split('.')[1] || '').length;

              if (latPrecision < 6 || lngPrecision < 6) {
                console.warn(
                  `Low precision coordinates for ${name}: lat=${latStr} (${latPrecision} decimals), lng=${lngStr} (${lngPrecision} decimals)`
                );
                // Still accept but warn - could make this stricter if needed
              }

              return { name, lat, lng };
            })
            .filter((p): p is LocationPoint => p !== null);

          if (parsedPoints.length === 0) {
            setError(
              'No valid rows found. Expected columns: Name, Latitude, Longitude (case-insensitive). Make sure lat/lng are numbers.'
            );
            setDataPoints([]); // ensure old markers stay cleared
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

  const generateTestData = (count: number) => {
    // Reset anything derived from the previous data
    setMstEdges([]);
    setCostBreakdown(null);
    setCalcError(null);
    setError(null);
    setFileName(null);

    // Generate random points within a 100 square mile area
    // 100 square miles is roughly 10 miles x 10 miles
    // 1 degree latitude ≈ 69 miles, so 10 miles ≈ 0.145 degrees
    // Longitude degrees vary with latitude, but we'll use a center point
    const centerLat = 33.77728650419152; // Georgia Tech campus, Atlanta, GA
    const centerLng = 84.39617097270636;
    const latRange = 0.145; // ~10 miles north/south
    const lngRange = 0.145 / Math.cos((centerLat * Math.PI) / 180); // Adjust for longitude compression

    const points: LocationPoint[] = [];
    const maxAttempts = count * 10; // Prevent infinite loops
    let attempts = 0;

    while (points.length < count && attempts < maxAttempts) {
      // Generate coordinates with high precision
      const latOffset = (Math.random() - 0.5) * latRange * 2;
      const lngOffset = (Math.random() - 0.5) * lngRange * 2;

      // Maintain high precision by using more decimal places in calculation
      const lat = parseFloat((centerLat + latOffset).toFixed(8));
      const lng = parseFloat((centerLng + lngOffset).toFixed(8));

      // Check for duplicates (within 0.0001 degrees ≈ 30 feet)
      const isDuplicate = points.some(
        (point) =>
          Math.abs(point.lat - lat) < 0.0001 &&
          Math.abs(point.lng - lng) < 0.0001
      );

      if (!isDuplicate) {
        points.push({
          name: `Location_${String(points.length + 1).padStart(2, '0')}`,
          lat,
          lng,
        });
      }
      attempts++;
    }

    if (points.length < count) {
      throw new Error(
        `Could not generate ${count} unique locations within the 100 square mile area. Try a smaller number of points.`
      );
    }

    setDataPoints(points);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (
        file.type === 'text/csv' ||
        file.name.toLowerCase().endsWith('.csv')
      ) {
        // Process the file directly instead of creating a synthetic event
        processFile(file);
      } else {
        setError('Please drop a CSV file.');
      }
    }
  };

  const handleRunOptimization = async () => {
    if (dataPoints.length < 2) {
      alert('Need at least 2 points to run optimization.');
      return;
    }

    setComputingMst(true);
    setMstEdges([]);
    setCostBreakdown(null); // ← clear previous breakdown
    setCalcError(null);

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/optimize';

    try {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: dataPoints.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            name: p.name ?? null,
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
        throw new Error(
          errData.detail || errData.error || 'Optimization failed'
        );
      }

      const data = await res.json();

      console.log('Optimization result:', data);

      if (data.error) throw new Error(data.error);

      // ────────────────────────────────────────────────
      // Backend now already gives us everything we need
      // ────────────────────────────────────────────────
      const edges = data.edges || [];

      // Use pre-computed values from backend
      const {
        totalLowVoltageMeters = 0,
        totalHighVoltageMeters = 0,
        numPolesEstimate = 0,
        poleCostEstimate = 0,
        lowWireCostEstimate = 0,
        highWireCostEstimate = 0,
        totalWireCostEstimate = 0,
        totalCostEstimate = 0,
        pointCount = 0,
        usedCosts, // optional – for display/debug
      } = data;

      // Update edges (now includes lengthMeters & voltage)
      setMstEdges(
        edges.map((e: MSTEdge) => ({
          start: e.start,
          end: e.end,
          lengthMeters: e.lengthMeters ?? 0,
          voltage: e.voltage ?? 'low',
        }))
      );

      // Update cost breakdown state – directly from backend
      setCostBreakdown({
        lowVoltageMeters: totalLowVoltageMeters,
        highVoltageMeters: totalHighVoltageMeters,
        totalMeters: totalLowVoltageMeters + totalHighVoltageMeters,

        lowWireCost: lowWireCostEstimate,
        highWireCost: highWireCostEstimate,
        wireCost: totalWireCostEstimate,

        poleCount: numPolesEstimate,
        poleCost: poleCostEstimate,
        pointCount: pointCount,

        grandTotal: totalCostEstimate,

        usedPoleCost: usedCosts?.poleCost,
        usedLowCostPerMeter: usedCosts?.lowVoltageCostPerMeter,
        usedHighCostPerMeter: usedCosts?.highVoltageCostPerMeter,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to run optimization';
      setCalcError(message);
      console.error('Optimization error:', err);
    } finally {
      setComputingMst(false);
    }
  };

  const generateRandomCosts = () => {
    // Generate realistic cost ranges for mini-grid components
    const poleCost = Math.round((100 + Math.random() * 200) * 100) / 100; // $100-300
    const lowVoltageCost = Math.round((1.5 + Math.random() * 3) * 100) / 100; // $1.50-4.50/m
    const highVoltageCost = Math.round((3 + Math.random() * 4) * 100) / 100; // $3-7/m

    setPoleCost(poleCost);
    setLowVoltageCost(lowVoltageCost);
    setHighVoltageCost(highVoltageCost);
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
              C4G - Renewvia Energy
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
          <p className='mb-4 text-sm text-zinc-500'>
            Example:{' '}
            <code className='text-blue-300'>
              Georgia Tech,33.77728650,-84.39617097
            </code>
          </p>

          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragOver
                ? 'border-emerald-400 bg-emerald-900/20'
                : 'border-zinc-600 hover:border-zinc-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className='space-y-4'>
              <div className='text-4xl'>📄</div>
              <div>
                <p className='mb-2 text-lg font-medium text-zinc-300'>
                  {isDragOver
                    ? 'Drop your CSV file here'
                    : 'Drag & drop your CSV file here'}
                </p>
                <p className='text-sm text-zinc-500'>or</p>
              </div>
              <label className='inline-block cursor-pointer rounded bg-emerald-600 px-5 py-3 font-medium transition hover:bg-emerald-700'>
                Choose CSV File
                <input
                  type='file'
                  accept='.csv'
                  onChange={handleFileUpload}
                  className='hidden'
                />
              </label>
            </div>
          </div>

          {fileName && (
            <div className='mt-4 text-center'>
              <span className='text-sm text-zinc-300'>
                Selected: {fileName}
              </span>
            </div>
          )}

          {error && <p className='mt-4 text-red-400'>{error}</p>}
          {loading && <p className='mt-4 text-emerald-400'>Processing...</p>}
          {dataPoints.length > 0 && !loading && (
            <p className='mt-4 text-emerald-300'>
              Loaded {dataPoints.length} valid location
              {dataPoints.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Test Data UI */}
        <div className='mb-10 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
          <label className='mb-3 block text-lg font-medium'>
            Or generate test data
          </label>
          <p className='mb-4 text-sm text-zinc-400'>
            Generate random location points within a 100 square mile area for
            testing the optimization algorithm.
          </p>

          <div className='flex items-center gap-4'>
            <select
              value={selectedCount}
              onChange={(e) => setSelectedCount(parseInt(e.target.value))}
              className='rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none'
            >
              {Array.from({ length: 91 }, (_, i) => i + 10).map((num) => (
                <option key={num} value={num}>
                  {num} points
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                try {
                  generateTestData(selectedCount);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Failed to generate test data'
                  );
                }
              }}
              className='rounded bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700'
            >
              Generate Test Data
            </button>
          </div>
        </div>

        {/* Cost Inputs & Calculate Section */}
        <div className='mt-12 rounded-lg border border-zinc-700 bg-zinc-900/50 p-8 backdrop-blur-sm'>
          <h3 className='mb-6 text-3xl font-bold'>Mini-Grid Optimization</h3>
          <p className='mb-6 text-zinc-300'>
            Enter approximate costs per unit. The algorithm will process these
            values as hyperparameters and calculate locations for Poles, Wire,
            and transformers.
          </p>
          <p className='mb-4 text-sm text-zinc-500'>
            Example: Pole $175.00, Low Voltage $2.75/m, High Voltage $4.25/m
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
                onChange={(e) => setPoleCost(parseFloat(e.target.value))}
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
                onChange={(e) => setLowVoltageCost(parseFloat(e.target.value))}
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
                onChange={(e) => setHighVoltageCost(parseFloat(e.target.value))}
                className='w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none'
                placeholder='e.g. 5.75'
              />
            </div>
          </div>

          <div className='mt-6 flex gap-4'>
            <button
              onClick={generateRandomCosts}
              className='rounded bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600'
            >
              Generate Random Costs
            </button>
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
                  {formatMeters(costBreakdown.totalMeters) ?? '0'} m ≈{' '}
                </p>
              </div>

              <div className='text-right'>
                <p className='text-sm text-zinc-400'>Grand Total Estimate</p>
                <p className='text-2xl font-bold text-emerald-300'>
                  ${formatUSD(costBreakdown.grandTotal) ?? '0.00'}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className='grid gap-6 md:grid-cols-3'>
              {/* Poles */}
              <div className='rounded bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>Poles (est.)</p>
                <p className='text-lg font-medium text-emerald-400'>
                  {costBreakdown.poleCount ?? '—'} units
                </p>
                <p className='text-base font-semibold'>
                  ${formatUSD(costBreakdown.poleCost) ?? '0.00'}
                </p>
              </div>

              {/* Low Voltage */}
              <div className='rounded border-l-4 border-blue-500 bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>Low Voltage Wire</p>
                <p className='text-lg font-medium text-blue-300'>
                  {formatMeters(costBreakdown.lowVoltageMeters) ?? '0'} m
                </p>
                <p className='text-base font-semibold'>
                  ${formatUSD(costBreakdown.lowWireCost) ?? '0.00'}
                </p>
              </div>

              {/* High Voltage */}
              <div className='rounded border-l-4 border-purple-500 bg-zinc-800/50 p-4'>
                <p className='text-sm text-zinc-400'>High Voltage Wire</p>
                <p className='text-lg font-medium text-purple-300'>
                  {formatMeters(costBreakdown.highVoltageMeters) ?? '0'} m
                </p>
                <p className='text-base font-semibold'>
                  ${formatUSD(costBreakdown.highWireCost) ?? '0.00'}
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

      {/* Locations List */}
      {dataPoints.length > 0 && (
        <section className='mx-auto max-w-7xl px-6 py-12'>
          <h3 className='mb-6 text-2xl font-bold text-white'>
            Location Points ({dataPoints.length})
          </h3>
          <div className='rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
            <div className='font-mono text-sm text-zinc-300'>
              {dataPoints.map((point, index) => (
                <div key={index} className='mb-1'>
                  {index + 1}. {point.name} - Lat: {point.lat.toFixed(8)}, Lng:{' '}
                  {point.lng.toFixed(8)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 Renewvia • CS 6150 Computing For Good • Project Demo</p>
      </footer>
    </div>
  );
}
