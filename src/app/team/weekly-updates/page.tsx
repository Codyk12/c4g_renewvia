import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Weekly Updates • Renewvia',
  description: 'Weekly project updates – CS 6150 Computing For Good',
  icons: { icon: '/favicon.ico' },
};

export default function WeeklyUpdatesPage() {
  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header – matching style from previous pages */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-28 text-center md:py-32'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-6xl px-6'>
          <div className='mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>📅</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              Renewvia Energy
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Weekly Updates
          </h1>
          <p className='mb-10 text-3xl font-light text-emerald-100 md:text-4xl lg:text-5xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      {/* Placeholder / Coming Soon Section */}
      <div className='mx-auto max-w-5xl px-6 py-20 md:py-28'>
        <div className='text-center'>
          <div className='inline-block max-w-3xl rounded-3xl border border-emerald-500/30 bg-emerald-900/30 px-10 py-12'>
            <div className='mb-6 text-6xl'>📝</div>
            <h2 className='mb-6 text-4xl font-bold tracking-tight md:text-5xl'>
              Weekly Progress Updates
            </h2>
            <p className='mb-10 text-xl leading-relaxed text-zinc-300 md:text-2xl'>
              This page will showcase our weekly milestones, decisions,
              challenges, and progress toward building an optimized
              pole-and-line placement algorithm for Renewvia’s solar mini-grids.
            </p>
            <p className='text-lg text-zinc-400'>
              First update coming soon after our next meeting with Nicholas
              Selby.
            </p>
          </div>
        </div>

        {/* Optional small teaser of project focus */}
        <div className='mx-auto mt-20 max-w-3xl text-center text-lg text-zinc-400'>
          <p>
            Optimizing power distribution networks • Minimizing cost & voltage
            drop • MST & Steiner Tree exploration • Satellite-integrated layouts
            • Scalable for rural electrification in East Africa
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 • CS 6150 Computing For Good • Weekly Updates</p>
      </footer>
    </div>
  );
}
