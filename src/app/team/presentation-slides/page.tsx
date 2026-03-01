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
              C4G - Renewvia Energy Project
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Project Presentation
          </h1>
          <p className='mb-10 text-3xl font-light text-emerald-100 md:text-4xl lg:text-5xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      {/* New Spring 2026 Section with embedded Google Drive video */}
      <section className='mx-auto max-w-6xl border-t border-zinc-800 px-6 py-20 md:py-28'>
        <div className='mb-12 text-center'>
          <h2 className='text-5xl font-bold tracking-tight text-emerald-400 md:text-6xl'>
            Spring 2026
          </h2>
        </div>

        <div className='mx-auto max-w-5xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/50 shadow-2xl'>
          <div className='relative pt-[56.25%]'>
            {' '}
            {/* 16:9 aspect ratio */}
            <iframe
              src='https://drive.google.com/file/d/1VebqKSaWqgsoMk5ZSmD5bwPzyeAciPk4/preview'
              allow='autoplay'
              className='absolute inset-0 h-full w-full'
              title='Spring 2026 Renewvia Project Video'
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 • CS 6150 Computing For Good • Project Presentation</p>
      </footer>
    </div>
  );
}
