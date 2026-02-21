import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Description • Renewvia',
  description:
    'CS 6150 Computing For Good – Solar Mini-Grid Powerline Distribution Networks',
  icons: { icon: '/favicon.ico' },
};

export default function ProjectDescriptionPage() {
  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-24 text-center'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-5xl px-6'>
          <div className='mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>☀️</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              C4G - Renewvia Energy
            </span>
          </div>

          <h1 className='mb-4 text-6xl font-bold tracking-tighter md:text-7xl'>
            Project Description
          </h1>
          <p className='text-3xl font-light text-emerald-100 md:text-4xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>

          <div className='mt-8 text-xl font-light tracking-wide text-emerald-200'>
            CS 6150 • Computing For Good
          </div>

          <div className='mt-12 flex justify-center'>
            <div className='flex items-center gap-6 rounded-3xl border border-white/20 bg-white/10 px-8 py-4 text-sm backdrop-blur-xl'>
              <div className='text-left'>
                <div className='text-lg font-medium'>Partner</div>
                <div className='text-emerald-100'>
                  Renewvia • Nicholas Selby
                </div>
              </div>
              <div className='h-9 w-px bg-white/30' />
              <div className='text-left'>
                <div className='text-lg font-medium'>Team</div>
                <div className='text-emerald-100'>
                  5 Georgia Tech Masters Students
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className='mx-auto max-w-5xl space-y-20 px-6 py-20'>
        {/* Partner Organization */}
        <section>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>🏢</div>
            <div>
              <div className='text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
                PARTNER ORGANIZATION
              </div>
              <h2 className='text-4xl font-bold tracking-tighter'>Renewvia</h2>
            </div>
          </div>

          <div className='rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10 text-lg leading-relaxed'>
            <p className='mb-6'>
              Renewvia creates solar-powered mini-grids in remote areas, acting
              as a “tiny utility company” for entire regions.
            </p>
            <p>
              Partner:{' '}
              <span className='font-medium text-emerald-400'>
                Nicholas Selby
              </span>{' '}
              —{' '}
              <a
                href='mailto:nicholas.selby@renewvia.com'
                className='underline hover:text-emerald-300'
              >
                nicholas.selby@renewvia.com
              </a>
            </p>
          </div>
        </section>

        {/* The Challenge */}
        <section>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>⚡</div>
            <div>
              <div className='text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
                THE CHALLENGE
              </div>
              <h2 className='text-4xl font-bold tracking-tighter'>
                Partner Needs
              </h2>
            </div>
          </div>

          <div className='prose prose-invert max-w-none space-y-6 text-[17px] leading-relaxed text-zinc-300'>
            <p>
              Renewvia currently designs mini-grids using heuristics due to
              funding, scalability, and technological constraints. They need an
              efficient, algorithmic way to optimize electricity distribution —
              specifically the placement of power transmission poles and lines
              to serve local homes and businesses from a central solar-powered
              mini-grid.
            </p>
            <p>
              Key priorities include scalability as towns grow, end-user load
              requirements, project cost (poles + cable per unit length),
              voltage drop over distance, and compliance with safety codes.
              Topography is considered but roads are rare, so not a primary
              factor.
            </p>
            <p>
              A satellite overlay of the final pole and line layout is highly
              desired for clear communication. The solution should start with a
              simple low-voltage system using a single pole and cable type, with
              future extensibility to medium/high voltage for larger towns.
            </p>
          </div>
        </section>

        {/* Our Approach */}
        <section>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>🌐</div>
            <div>
              <div className='text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
                OUR APPROACH
              </div>
              <h2 className='text-4xl font-bold tracking-tighter'>
                Formulated Project
              </h2>
            </div>
          </div>

          <div className='rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10'>
            <div className='space-y-8 text-[17px] leading-relaxed text-zinc-300'>
              <p>
                We are building a modular optimization algorithm that determines
                the optimal locations of power poles and distribution lines to
                minimize total cost and voltage drop while respecting safety
                codes, load requirements, and other constraints.
              </p>
              <p>Expected inputs from Renewvia:</p>
              <ul className='list-none space-y-2 text-emerald-100'>
                <li className='flex gap-3'>
                  • Locations and power requirements of end users
                </li>
                <li className='flex gap-3'>
                  • Location and production capacity of the solar source
                </li>
                <li className='flex gap-3'>
                  • Local & international safety codes / constraints
                </li>
                <li className='flex gap-3'>
                  • Material costs (poles, cable per unit length)
                </li>
                <li className='flex gap-3'>
                  • Labor/installation costs (per unit or distance, potentially
                  varying by topography/maintenance)
                </li>
                <li className='flex gap-3'>
                  • Optional: endpoint priority / criticality (e.g. hospitals,
                  schools, other high-priority locations)
                </li>
              </ul>
              <p className='border-t border-zinc-700 pt-6'>
                We are exploring well-known approaches such as Minimum Spanning
                Tree (MST) and Steiner Tree algorithms. The codebase will be
                clean, well-documented, and designed as a plug-and-play solution
                that Renewvia engineers can run locally and extend in the
                future.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>
          © 2026 Renewvia • CS 6150 Computing For Good • Solar Mini-Grid Project
        </p>
      </footer>
    </div>
  );
}
