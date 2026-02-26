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
  type: 'source' | 'destination' | 'pole';
  lat: number;
  lng: number;
}

interface MSTEdge {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  lengthMeters: number;
  voltage: 'low' | 'high';
}

interface MSTNode {
  index: number;
  lat: number;
  lng: number;
  name: string;
  type: 'source' | 'destination' | 'pole';
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
  const [mstNodes, setMstNodes] = useState<MSTNode[]>([]);
  const [computingMst, setComputingMst] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [poleCost, setPoleCost] = useState<number>(1000);
  const [lowVoltageCost, setLowVoltageCost] = useState<number>(4);
  const [highVoltageCost, setHighVoltageCost] = useState<number>(10);
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

  // Helper to create a consistent marker for any point/node
  const createMarker = (
    point: {
      lat: number;
      lng: number;
      name: string;
      type?: 'source' | 'destination' | 'pole';
    },
    map: google.maps.Map
  ) => {
    const type = point.type || 'destination'; // raw uploaded points → treat as 'destination'

    let iconUrl = 'http://maps.google.com/mapfiles/ms/icons/';
    let labelColor = 'white';
    let scaledSize = new google.maps.Size(36, 36);
    let fontSize = '13px';

    switch (type) {
      case 'source':
        iconUrl += 'green-dot.png';
        labelColor = '#00ff00'; // bright green
        scaledSize = new google.maps.Size(44, 44);
        break;

      case 'destination':
        iconUrl += 'blue-dot.png';
        labelColor = 'white';
        // keep default size
        break;

      case 'pole':
        iconUrl += 'yellow-dot.png';
        scaledSize = new google.maps.Size(28, 28);
        fontSize = '11px';
        labelColor = '#ffff99'; // light yellow for visibility
        break;

      default:
        iconUrl += 'red-dot.png';
    }

    const marker = new google.maps.Marker({
      position: { lat: point.lat, lng: point.lng },
      map,
      label: {
        text: point.name,
        color: labelColor,
        fontSize,
        fontWeight: 'bold',
      },
      icon: { url: iconUrl, scaledSize },
      title: point.type ? `${point.name} (${point.type})` : point.name,
      optimized: !!point.type, // optional: can use later if needed
    });

    return marker;
  };

  // Add markers and fit bounds whenever dataPoints or map changes
  // Optimized Markers useEffect – single unified logic
  useEffect(() => {
    if (!map) return;

    // 1. Clear all previous markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // 2. Choose which dataset to display
    const pointsToShow = mstNodes.length > 0 ? mstNodes : dataPoints;

    if (pointsToShow.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidPoints = false;

    // 3. Create markers + extend bounds
    pointsToShow.forEach((point) => {
      if (isNaN(point.lat) || isNaN(point.lng)) {
        return;
      }

      hasValidPoints = true;

      const marker = createMarker(point, map);
      markersRef.current.push(marker);

      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    // 4. Fit map bounds if we have valid points
    if (hasValidPoints && !bounds.isEmpty()) {
      // Slight delay helps when map is still initializing / resizing
      setTimeout(() => {
        map.fitBounds(bounds, { bottom: 80, left: 80, right: 80, top: 80 });
      }, 120);
    }
  }, [map, dataPoints, mstNodes]); // dependencies are correct
  // Draw lines on map
  useEffect(() => {
    if (!map) return;

    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];

    mstEdges.forEach((edge) => {
      if (!edge?.start || !edge?.end) return;

      const color = edge.voltage === 'high' ? '#8B5CF6' : '#3B82F6'; // purple high, blue low
      const weight = edge.voltage === 'high' ? 6 : 4;

      const polyline = new google.maps.Polyline({
        path: [edge.start, edge.end],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: weight,
        map: map,
      });

      polylinesRef.current.push(polyline);
    });
  }, [map, mstEdges]);

  // fit map to uploaded points immediately (before optimization)
  useEffect(() => {
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidPoints = false;

    // Decide which list to render
    const pointsToShow = mstNodes.length > 0 ? mstNodes : dataPoints;

    pointsToShow.forEach((point) => {
      if (isNaN(point.lat) || isNaN(point.lng)) return;
      hasValidPoints = true;

      const marker = createMarker(point, map);
      markersRef.current.push(marker);

      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    // Fit bounds if we have valid points
    if (hasValidPoints && !bounds.isEmpty()) {
      // Small delay helps avoid race conditions with map init
      setTimeout(() => {
        map.fitBounds(bounds, { bottom: 80, left: 80, right: 80, top: 80 });
      }, 150);
    }
  }, [map, dataPoints, mstNodes]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow uploading the same file name again
    if (!file) return;

    processFile(file);
  };

  const processFile = (file: File) => {
    // Reset anything derived from the previous CSV so the map + UI refresh cleanly
    setMstEdges([]);
    setMstNodes([]);
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
              const type = row.type?.trim() || row['type'] || 'Unknown';
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

              return { name, type, lat, lng };
            })
            .filter((p): p is LocationPoint => p !== null);

          console.log('Parsed CSV:', parsedPoints);

          if (parsedPoints.length === 0) {
            setError(
              'No valid rows found. Expected columns: Name, Type, Latitude, Longitude (case-insensitive). ' +
                'Make sure lat/lng are numbers and Type is either "source" or "destination".'
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
    // 1 degree latitude ≈ 69 miles, so 10 miles ≈ 0.145 degrees,
    // 0.001 degrees ≈ 0.07 miles - more on the scale of the mini grids
    // Longitude degrees vary with latitude, but we'll use a center point
    const centerLat = 33.77728650419152; // Georgia Tech campus, Atlanta, GA
    const centerLng = -84.39617097270636;
    const latRange = 0.001; // small
    const lngRange = 0.001 / Math.cos((centerLat * Math.PI) / 180); // Adjust for longitude compression

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
        const type = points.length === 0 ? 'source' : 'destination';
        const name =
          points.length === 0
            ? 'Source'
            : `Destination ${String(points.length + 1).padStart(2, '0')}`;

        points.push({
          name: name,
          type,
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

    const startTime = performance.now();

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

      const endTime = performance.now();
      const durationMs = endTime - startTime;
      const durationSec = (durationMs / 1000).toFixed(2);

      console.log(
        `%c[API Request] Optimization took ${durationMs.toFixed(0)} ms (${durationSec} sec)`,
        'background: #1e293b; color: #60a5fa; padding: 4px 8px; border-radius: 4px;'
      );

      const data = await res.json();

      // console.log('Optimization result:', data);

      if (data.error) throw new Error(data.error);

      // ────────────────────────────────────────────────
      // Backend now already gives us everything we need
      // ────────────────────────────────────────────────
      const edges = data.edges || [];

      // Use pre-computed values from backend
      const {
        totalLowVoltageMeters = 0,
        totalHighVoltageMeters = 0,
        numPolesUsed = 0,
        poleCostEstimate = 0,
        lowWireCostEstimate = 0,
        highWireCostEstimate = 0,
        totalWireCostEstimate = 0,
        totalCostEstimate = 0,
        pointCount = 0,
        usedCosts, // optional – for display/debug
      } = data;

      setMstNodes(data.nodes || []);

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

        poleCount: numPolesUsed,
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

  const downloadNodesCsv = () => {
    if (mstNodes.length === 0) return;

    // Define CSV headers and order
    const headers = ['index', 'name', 'type', 'lat', 'lng'];

    const rows = mstNodes.map((node) => [
      node.index,
      node.name,
      node.type,
      node.lat.toFixed(8),
      node.lng.toFixed(8),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mst_nodes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadEdgesCsv = () => {
    if (mstEdges.length === 0) return;

    const headers = [
      'start_lat',
      'start_lng',
      'end_lat',
      'end_lng',
      'length_meters',
      'voltage',
    ];

    const rows = mstEdges.map((edge) => [
      edge.start.lat.toFixed(8),
      edge.start.lng.toFixed(8),
      edge.end.lat.toFixed(8),
      edge.end.lng.toFixed(8),
      Math.round(edge.lengthMeters), // or keep decimals: edge.lengthMeters.toFixed(2)
      edge.voltage,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mst_edges.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              C4G - Renewvia Energy Project
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
          Mini-Grid Optimization Coordinate and Edges Generation
        </h2>

        {/* Upload UI */}
        <div className='mb-10 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
          <label className='mb-3 block text-lg font-medium'>
            Upload CSV with your locations
          </label>
          <p className='mb-4 text-sm text-zinc-400'>
            Expected columns: <code className='text-emerald-300'>Name</code>,{' '}
            <code className='text-emerald-300'>Type</code>,{' '}
            <code className='text-emerald-300'>Latitude</code>,{' '}
            <code className='text-emerald-300'>Longitude</code>{' '}
            (case-insensitive)
          </p>
          <p className='mb-4 text-sm text-zinc-500'>
            Example: <br />
            <code className='text-blue-300'>
              Georgia Tech, source, 33.77728650, -84.39617097 <br />
              Building 1, destination, 33.77798650, -84.39613097
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
          <h3 className='mb-6 text-3xl font-bold'>Input Variables</h3>
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

          <p className='mt-4 text-center text-sm text-zinc-500'>
            In beta testing until April 26th 2026.
          </p>

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

        {/* Map container */}
        <div
          ref={mapRef}
          className='mt-8 h-[70vh] w-full rounded-xl border border-zinc-700 shadow-2xl'
        >
          Loading satellite map...
        </div>

        {costBreakdown && (
          <div className='mt-8 rounded-lg border border-emerald-700/30 bg-zinc-900/70 p-6 backdrop-blur-sm'>
            <h4 className='mb-4 text-xl font-semibold text-emerald-300'>
              Estimated Mini-Grid Costs
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
          </div>
        )}

        {/* Script loader */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`}
          strategy='afterInteractive'
          onLoad={initMap}
        />
      </main>

      {/* Nodes List – Collapsible */}
      {dataPoints.length > 0 && (
        <section className='mx-auto max-w-7xl px-6 py-12'>
          <details className='group'>
            <summary className='flex cursor-pointer items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/70 px-6 py-4 text-xl font-bold text-white transition hover:bg-zinc-800/70'>
              <h3>
                Source, Destination, and Generated Pole Coordinates (
                {mstNodes.length || dataPoints.length})
              </h3>
              <span className='text-2xl font-light transition-transform group-open:rotate-180'>
                ▼
              </span>
            </summary>

            <div className='mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
              <div className='max-h-[60vh] overflow-y-auto font-mono text-sm text-zinc-300'>
                {(mstNodes.length > 0 ? mstNodes : dataPoints).map(
                  (point, index) => (
                    <div key={index} className='mb-1.5 leading-relaxed'>
                      {index + 1}.{' '}
                      <span className='font-semibold text-emerald-300'>
                        {point.name}
                      </span>
                      {' – Lat: '}
                      <span className='text-blue-300'>
                        {point.lat.toFixed(8)}
                      </span>
                      ,{' Lng: '}
                      <span className='text-blue-300'>
                        {point.lng.toFixed(8)}
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* Optional footer info */}
              {mstNodes.length > 0 && (
                <p className='mt-4 text-center text-xs text-zinc-500'>
                  Showing optimized nodes (source + destinations + poles).
                  Scroll for full list.
                </p>
              )}
            </div>
          </details>
        </section>
      )}

      {/* Download Data Buttons */}
      {costBreakdown && mstNodes.length > 0 && (
        <section className='mx-auto max-w-7xl px-6 py-12'>
          <div className='mx-auto mt-8 max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900/50 p-6 backdrop-blur-sm'>
            <h4 className='mb-5 text-center text-xl font-semibold text-emerald-300'>
              Export Results
            </h4>

            <div className='flex flex-col justify-center gap-5 sm:flex-row'>
              <button
                onClick={downloadNodesCsv}
                className='flex-1 rounded bg-emerald-600 px-10 py-4 text-center font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none'
                disabled={mstNodes.length === 0}
              >
                Download Nodes CSV
              </button>

              <button
                onClick={downloadEdgesCsv}
                className='flex-1 rounded bg-blue-600 px-10 py-4 text-center font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none'
                disabled={mstEdges.length === 0}
              >
                Download Edges CSV
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>
          © 2026 • CS 6150 Computing For Good • Renewvia Project • Demo Page
        </p>
      </footer>
    </div>
  );
}
