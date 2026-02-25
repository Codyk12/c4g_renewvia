import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Presentation Slides • Renewvia',
  description: 'Project presentation slides – CS 6150 Computing For Good',
  icons: { icon: '/favicon.ico' },
};

export default function PresentationSlidesPage() {
  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header – consistent style across the site */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-28 text-center md:py-32'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-6xl px-6'>
          <div className='mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>📽️</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              C4G - Renewvia Energy Project Project
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Presentation Slides
          </h1>
          <p className='mb-10 text-3xl font-light text-emerald-100 md:text-4xl lg:text-5xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      {/* Main content – placeholder for slides */}
      <div className='mx-auto max-w-6xl px-6 py-20 md:py-28'>
        <div className='text-center'>
          <div className='inline-block w-full max-w-5xl rounded-3xl border border-zinc-800 bg-zinc-900/70 px-10 py-16 md:py-20'>
            <div className='mb-8 text-7xl'>🖼️</div>
            <h2 className='mb-8 text-4xl font-bold tracking-tight md:text-5xl'>
              Project Presentation Deck
            </h2>
          </div>
        </div>

        {/* Small context note */}
        <div className='mx-auto mt-20 max-w-3xl text-center text-base text-zinc-500'>
          <p>
            Communicating Renewvia’s mini-grid optimization challenge, our
            algorithmic approach, team capabilities, and planned deliverables.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 • CS 6150 Computing For Good • Presentation Slides</p>
      </footer>
    </div>
  );
}
