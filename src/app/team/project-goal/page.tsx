import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Goals • Renewvia',
  description: 'CS 6150 Computing For Good – Project Goals & Objectives',
  icons: { icon: '/favicon.ico' },
};

export default function ProjectGoalsPage() {
  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-24 text-center'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-5xl px-6'>
          <div className='mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>🎯</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              C4G - Renewvia Energy Project
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Project Goals
          </h1>
          <p className='text-3xl font-light text-emerald-100 md:text-4xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className='mx-auto max-w-5xl space-y-20 px-6 py-20'>
        {/* Primary Goals Section */}
        <section>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>→</div>
            <div>
              <div className='text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
                CORE OBJECTIVES
              </div>
              <h2 className='text-4xl font-bold tracking-tighter'>
                Our Project Goals
              </h2>
            </div>
          </div>

          <div className='rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10'>
            <ul className='space-y-8 text-[17px] leading-relaxed text-zinc-300'>
              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  1
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Formalize project requirements
                  </div>
                  <p className='text-zinc-400'>
                    Define clear scope, inputs, outputs, and all constraints in
                    collaboration with Renewvia.
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  2
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Obtain necessary data
                  </div>
                  <p className='text-zinc-400'>
                    Collect end-user locations, power requirements, source
                    location, safety codes, material/labor costs, and any
                    priority information (e.g., hospitals, schools).
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  3
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Plan algorithm and tool architecture
                  </div>
                  <p className='text-zinc-400'>
                    Design a modular, extensible structure for the optimization
                    tool.
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  4
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Develop benchmarking methodology
                  </div>
                  <p className='text-zinc-400'>
                    Create reliable ways to evaluate and compare algorithm
                    outputs mathematically and potentially via simulation.
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  5
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Implement and compare MST & Steiner Tree algorithms
                  </div>
                  <p className='text-zinc-400'>
                    Build, test, and evaluate both Minimum Spanning Tree and
                    Steiner Tree approaches (and others as needed).
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  6
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Benchmark, iterate, and refine
                  </div>
                  <p className='text-zinc-400'>
                    Measure performance against Renewvia’s needs and improve the
                    solution iteratively.
                  </p>
                </div>
              </li>

              <li className='flex gap-5'>
                <span className='mt-1 text-2xl font-bold text-emerald-400'>
                  7
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Package and deliver production-ready solution
                  </div>
                  <p className='text-zinc-400'>
                    Provide an easy-to-use, well-documented codebase ready for
                    Renewvia engineers to run and extend.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Supporting Notes */}
        <section className='rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10'>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>📌</div>
            <h3 className='text-3xl font-semibold tracking-tight'>
              Key Principles
            </h3>
          </div>

          <div className='space-y-6 text-[17px] leading-relaxed text-zinc-300'>
            <p>
              The solution prioritizes simplicity and extensibility: start with
              a low-voltage system using one pole and cable type, while
              designing the code to support future enhancements (medium/high
              voltage, nuanced costs, topography, etc.).
            </p>
            <p>
              We aim for a clean, plug-and-play algorithm — no fancy UI required
              — delivered via a fully documented GitHub repository that Nicholas
              Selby and Renewvia can own and improve long-term.
            </p>
          </div>
        </section>

        {/* Deliverables */}
        <section>
          <div className='mb-8 flex items-center gap-4'>
            <div className='text-5xl'>📦</div>
            <div>
              <div className='text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
                DELIVERABLES
              </div>
              <h2 className='text-4xl font-bold tracking-tighter'>
                What We Will Deliver
              </h2>
            </div>
          </div>

          <div className='rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10'>
            <ul className='space-y-8 text-zinc-300'>
              <li className='flex items-start gap-5'>
                <span className='mt-1 text-3xl font-bold text-emerald-400'>
                  ✓
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Easy plug-and-play solution
                  </div>
                  <p className='text-zinc-400'>
                    A simple, locally runnable tool with minimal setup required.
                  </p>
                </div>
              </li>

              <li className='flex items-start gap-5'>
                <span className='mt-1 text-3xl font-bold text-emerald-400'>
                  ✓
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Core optimization algorithm
                  </div>
                  <p className='text-zinc-400'>
                    Algorithm to solve the placement and connection of power
                    poles and lines.
                  </p>
                </div>
              </li>

              <li className='flex items-start gap-5'>
                <span className='mt-1 text-3xl font-bold text-emerald-400'>
                  ✓
                </span>
                <div>
                  <div className='mb-1 text-xl font-medium text-white'>
                    Extensively documented GitHub repository
                  </div>
                  <p className='text-zinc-400'>
                    Fully commented code focused on enabling future improvements
                    by Renewvia engineers or subsequent students.
                  </p>
                </div>
              </li>
            </ul>

            <div className='mt-10 border-t border-zinc-700 pt-8 text-center text-zinc-400 italic'>
              Delivered as a zero-cost, local-run algorithm — no fancy website
              required.
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>
          ©© 2026 • CS 6150 Computing For Good • Renewvia Project • Project
          Goals
        </p>
      </footer>
    </div>
  );
}
