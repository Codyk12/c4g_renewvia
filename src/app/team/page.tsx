import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'C4G Renewvia Project Team • Solar Mini-Grid Optimization',
  description:
    'Volunteer Project 7: Solar Mini-Grid Powerline Distribution Networks',
  icons: { icon: '/favicon.ico' },
};

const teamMembers = [
  {
    name: 'Cody Kesler',
    initials: 'CK',
    role: 'Team Lead',
    skills: [
      'Machine Learning',
      'Optimization',
      'Python',
      'Data Science',
      'Big Data',
    ],
    experience: 'Data scientist',
  },
  {
    name: 'Harry Li',
    initials: 'HL',
    role: 'Team Member',
    skills: ['Data Analysis', 'Full-Stack Development', 'Docker', 'Kubernetes'],
    experience:
      'Data Analyst in Healthcare. Experience with Full-Stack Dev, Docker & Kubernetes.',
  },
  {
    name: 'Haden Sangree',
    initials: 'HS',
    role: 'Team Member',
    skills: ['Machine Learning', 'Embedded Software', 'Electrical Engineering'],
    experience:
      'Embedded software for variable frequency drives, PCB design, HVAC design.',
  },
  {
    name: 'Emily Thomas',
    initials: 'ET',
    role: 'Team Member',
    skills: [
      'Optimization',
      'Machine Learning',
      'Python Prototyping',
      'Customer Education',
    ],
    experience:
      'Machine Learning Product Engineer in EDA. Past experience as Applications Engineer (EDA) and Chemical Engineering.',
  },
  {
    name: 'Mlen-Too Wesley',
    initials: 'MW',
    role: 'Team Member',
    skills: [
      'Software Development',
      'Data Science',
      'Economics',
      'Machine Learning',
    ],
    experience:
      'Currently leading teams at the World Bank supporting tech projects in East Africa.',
  },
];

export default function TeamPage() {
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
            Georgia Tech Renewvia Project Volunteer Team
          </h1>
          <p className='text-3xl font-light text-emerald-100 md:text-4xl'>
            Solar Mini-Grid Powerline Distribution Networks
          </p>

          <div className='mt-10 flex justify-center'>
            <div className='flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 px-8 py-3 text-sm backdrop-blur-xl'>
              <div className='flex -space-x-3'>
                {teamMembers.map((m, i) => (
                  <div
                    key={i}
                    className='flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-zinc-900 ring-2 ring-white'
                  >
                    {m.initials}
                  </div>
                ))}
              </div>
              <div className='text-left'>
                <div className='font-medium'>
                  5 Georgia Tech Masters Students
                </div>
                <div className='text-xs text-emerald-200'>
                  Helping to accelerate the future of rural electrification
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Team Grid */}
      <div className='mx-auto max-w-7xl px-6 py-20'>
        <div className='mb-12 flex items-end justify-between'>
          <div>
            <div className='mb-2 text-sm font-medium tracking-[3px] text-emerald-400 uppercase'>
              MEET THE TEAM
            </div>
            <h2 className='text-5xl font-bold tracking-tighter'>
              The Georgia Tech Team
            </h2>
          </div>
          <div className='hidden max-w-xs text-right text-sm text-zinc-400 md:block'>
            Passionate engineers, data scientists, and developers working
            together to optimize power distribution for communities across
            Africa.
          </div>
        </div>

        <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
          {teamMembers.map((member, index) => (
            <div
              key={index}
              className='group rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 transition-all duration-300 hover:-translate-y-2 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-950/50'
            >
              {/* Avatar */}
              <div className='-mt-2 mb-8 flex justify-center'>
                <div className='flex h-28 w-28 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-cyan-500 text-5xl font-bold text-zinc-950 shadow-xl ring-8 shadow-emerald-900/50 ring-zinc-950 transition-all group-hover:ring-emerald-500/30'>
                  {member.initials}
                </div>
              </div>

              {/* Name & Role */}
              <div className='mb-8 text-center'>
                <h3 className='mb-1 text-3xl font-semibold tracking-tight'>
                  {member.name}
                </h3>
                <p className='text-sm font-medium tracking-wide text-emerald-400'>
                  {member.role}
                </p>
              </div>

              {/* Content – Skills + Experience */}
              <div className='space-y-10'>
                {/* Skills */}
                <div>
                  <div className='mb-3 text-xs tracking-widest text-zinc-500 uppercase'>
                    Skills
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {member.skills.map((skill, i) => (
                      <span
                        key={i}
                        className='rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs transition-colors hover:bg-emerald-900/60'
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <div className='mb-2 text-xs tracking-widest text-zinc-500 uppercase'>
                    Experience
                  </div>
                  <p className='leading-relaxed text-zinc-300'>
                    {member.experience}
                  </p>
                </div>
              </div>

              {/* Decorative bottom accent */}
              <div className='mx-auto mt-10 h-1 w-12 rounded-full bg-linear-to-br from-transparent via-emerald-400 to-transparent' />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 py-12 text-center text-sm text-zinc-500'>
        <p>
          © 2026 Renewvia • Solar Mini-Grid Powerline Distribution Networks •
          Team Page
        </p>
      </footer>
    </div>
  );
}
