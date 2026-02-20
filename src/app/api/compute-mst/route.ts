import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface Point {
  lat: number;
  lng: number;
  name?: string; // optional, since name is not used in MST calculation
}

type Costs = {
  poleCost: number;
  lowVoltageCostPerMeter: number;
  highVoltageCostPerMeter: number;
};

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const body = (await req.json()) as { points: Point[]; costs: Costs }; // or type costs too
    const { points, costs } = body;

    if (!Array.isArray(points) || points.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 valid points' },
        { status: 400 }
      );
    }

    const receivedCosts = {
      poleCost: Number(costs?.poleCost) || 0,
      lowVoltageCostPerMeter: Number(costs?.lowVoltageCostPerMeter) || 0,
      highVoltageCostPerMeter: Number(costs?.highVoltageCostPerMeter) || 0,
    };

    // Create temp CSV with just lat,lng (ignore name for MST calc)
    const csvContent = [
      'Latitude,Longitude',
      ...points.map((p) => `${p.lat},${p.lng}`),
    ].join('\n');

    tempFilePath = path.join(os.tmpdir(), `mst-input-${Date.now()}.csv`);
    await fs.writeFile(tempFilePath, csvContent);

    // Pass costs as JSON string to Python (argv[2])
    const costsJson = JSON.stringify(receivedCosts);
    const pythonCmd = `python3 ${path.join(process.cwd(), 'scripts/mst.py')} "${tempFilePath}" '${costsJson}'`;

    const { stdout, stderr } = await execAsync(pythonCmd);

    if (stderr && !stderr.toLowerCase().includes('warn')) {
      console.error('Python stderr:', stderr);
      return NextResponse.json(
        { error: stderr.trim() || 'Python execution failed' },
        { status: 500 }
      );
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'stdout was:', stdout);
      return NextResponse.json(
        { error: 'Invalid response from Python script' },
        { status: 500 }
      );
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      receivedCosts, // for frontend confirmation/debug
    });
  } catch (err: unknown) {
    console.error('API error:', err);

    let errorMessage = 'Failed to run optimization';

    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = String((err).message);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
}
