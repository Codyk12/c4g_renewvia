import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lighthouse Report • Renewvia',
  description:
    'Lighthouse performance & accessibility report for the project site',
  icons: { icon: '/favicon.ico' },
};

export default function LighthouseReportPage() {
  return (
    <div className='min-h-screen overflow-hidden bg-zinc-950 text-white'>
      {/* Hero Header – consistent with other pages */}
      <header className='relative bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-700 py-28 text-center md:py-32'>
        <div className='absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] bg-size-[40px_40px]' />
        <div className='relative mx-auto max-w-6xl px-6'>
          <div className='mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-md'>
            <span className='text-2xl'>📊</span>
            <span className='text-sm font-medium tracking-[4px] uppercase'>
              C4G - Renewvia Energy
            </span>
          </div>

          <h1 className='mb-6 text-6xl font-bold tracking-tighter md:text-7xl lg:text-8xl'>
            Lighthouse Report
          </h1>
          <p className='mb-10 text-3xl font-light text-emerald-100 md:text-4xl lg:text-5xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>
        </div>
      </header>

      {/* Main content area – ready for your Lighthouse data */}
      <div className='mx-auto max-w-6xl px-6 py-20 md:py-28'>
        <div className='text-center'>
          <div className='inline-block w-full max-w-4xl rounded-3xl border border-zinc-800 bg-zinc-900/70 px-10 py-16 md:py-20'>
            <div className='mb-8 text-7xl'>📈</div>
            <h2 className='mb-8 text-4xl font-bold tracking-tight md:text-5xl'>
              Performance & Quality Report
            </h2>
            <p className='mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl'>
              This page will display Lighthouse audit results including
              performance scores, accessibility, best practices, SEO, and Core
              Web Vitals for the Renewvia project documentation site.
            </p>

            <div className='mx-auto grid max-w-5xl grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-4'>
              <div className='rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6'>
                <div className='mb-2 text-sm font-medium tracking-wide text-emerald-400 uppercase'>
                  Performance
                </div>
                <div className='text-4xl font-bold text-white'>100</div>
              </div>

              <div className='rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6'>
                <div className='mb-2 text-sm font-medium tracking-wide text-emerald-400 uppercase'>
                  Accessibility
                </div>
                <div className='text-4xl font-bold text-white'>94</div>
              </div>

              <div className='rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6'>
                <div className='mb-2 text-sm font-medium tracking-wide text-emerald-400 uppercase'>
                  Best Practices
                </div>
                <div className='text-4xl font-bold text-white'>100</div>
              </div>

              <div className='rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6'>
                <div className='mb-2 text-sm font-medium tracking-wide text-emerald-400 uppercase'>
                  SEO
                </div>
                <div className='text-4xl font-bold text-white'>100</div>
              </div>
            </div>

            <p className='mt-16 text-lg text-zinc-400'>
              Reports will be updated after major site changes or before key
              milestones.
            </p>
          </div>
        </div>

        {/* Small context footer */}
        <div className='mx-auto mt-20 max-w-3xl text-center text-base text-zinc-500'>
          <p>
            Ensuring fast, accessible, and high-quality documentation for
            Renewvia’s solar mini-grid optimization project.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>© 2026 Renewvia • CS 6150 Computing For Good • Lighthouse Report</p>
      </footer>
    </div>
  );
}
