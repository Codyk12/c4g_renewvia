export default function Home() {
  return (
    <main className='relative isolate overflow-hidden'>
      {/* Background */}
      <div className='pointer-events-none absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-linear-to-b from-slate-950 via-slate-950 to-slate-900' />
        <div className='absolute -top-48 left-1/2 h-112 w-4xl -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl' />
        <div className='absolute top-40 left-1/2 h-88 w-4xl -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl' />
      </div>

      <section className='mx-auto flex min-h-[calc(100dvh-8.4rem)] max-w-5xl flex-col items-center justify-center px-6 py-16 text-center'>
        {/* Badge */}
        <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur'>
          <span className='h-2 w-2 rounded-full bg-emerald-400' />
          Georgia Tech • Computing for Good • Spring 2026
        </div>

        {/* Title */}
        <h1 className='text-4xl font-semibold tracking-tight text-balance text-white sm:text-6xl'>
          Renewvia Mini-Grid{' '}
          <span className='bg-linear-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent'>
            Optimization
          </span>{' '}
          Project
        </h1>

        {/* Subtitle */}
        <p className='mt-6 max-w-2xl text-base leading-relaxed text-pretty text-white/70 sm:text-lg'>
          Improving planning and performance for real-world mini-grid
          deployments with data-driven tooling and a clean, usable interface.
        </p>

        {/* Actions */}
        <div className='mt-10 flex flex-col items-center gap-3 sm:flex-row'>
          <a
            href='/team'
            className='inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white/90 focus:ring-2 focus:ring-white/30 focus:outline-none'
          >
            Meet the team
          </a>
          <a
            href='/team/project-description'
            className='inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10 focus:ring-2 focus:ring-white/20 focus:outline-none'
          >
            Read project description
          </a>
          <a
            href='/team/demo'
            className='inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/100 px-5 py-3 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10 focus:ring-2 focus:ring-white/20 focus:outline-none'
          >
            See the Demo
          </a>
        </div>

        {/* Bottom card */}
        <div className='mt-12 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 text-left text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div>
              <div className='text-xs tracking-wide text-white/50 uppercase'>
                Focus
              </div>
              <div className='mt-1 font-medium text-white'>
                Tree Optimization
              </div>
            </div>
            <div>
              <div className='text-xs tracking-wide text-white/50 uppercase'>
                Partner
              </div>
              <div className='mt-1 font-medium text-white'>Renewvia</div>
            </div>
            <div>
              <div className='text-xs tracking-wide text-white/50 uppercase'>
                Term
              </div>
              <div className='mt-1 font-medium text-white'>Spring 2026</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
